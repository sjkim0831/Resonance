#!/usr/bin/env python3
"""Generate the text-first executable specification for the Carbonet platform.

The generator is deterministic and uses only the Python standard library.  It
turns a curated domain catalogue into actor, process, screen/API/data contracts,
flow-graph nodes and test scenarios.  Generated files are build inputs, not
prose-only documentation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "docs/architecture/executable-webapp/generated"


LEGAL_SOURCES = [
    {"id": "LAW-CARBON-NEUTRAL", "name": "기후위기 대응을 위한 탄소중립·녹색성장 기본법", "url": "https://www.law.go.kr/법령/기후위기대응을위한탄소중립ㆍ녹색성장기본법", "applies": ["EMISSION", "REDUCTION", "MONITORING"]},
    {"id": "LAW-ETS", "name": "온실가스 배출권의 할당 및 거래에 관한 법률", "url": "https://www.law.go.kr/법령/온실가스배출권의할당및거래에관한법률", "applies": ["EMISSION", "TRADE", "VERIFICATION"]},
    {"id": "RULE-ETS-MRV", "name": "온실가스 배출권거래제의 배출량 보고 및 인증에 관한 지침", "url": "https://www.law.go.kr/행정규칙/온실가스배출권거래제의배출량보고및인증에관한지침", "applies": ["EMISSION", "VERIFICATION", "REPORT"]},
    {"id": "RULE-ETS-VERIFY", "name": "온실가스 배출권거래제 운영을 위한 검증지침", "url": "https://www.law.go.kr/행정규칙/온실가스배출권거래제운영을위한검증지침", "applies": ["VERIFICATION"]},
    {"id": "LAW-CCUS", "name": "이산화탄소 포집·수송·저장 및 활용에 관한 법률", "url": "https://www.law.go.kr/법령/이산화탄소포집ㆍ수송ㆍ저장및활용에관한법률", "applies": ["CCUS", "TRADE", "CERTIFICATE"]},
    {"id": "RULE-EPD", "name": "환경성적표지 대상제품과 작성지침", "url": "https://www.law.go.kr/행정규칙/환경성적표지대상제품과작성지침", "applies": ["LCA", "REPORT", "CERTIFICATE"]},
    {"id": "LAW-PRIVACY", "name": "개인정보 보호법", "url": "https://www.law.go.kr/법령/개인정보보호법", "applies": ["IDENTITY", "PLATFORM"]},
    {"id": "RULE-PRIVACY-SAFETY", "name": "개인정보의 안전성 확보조치 기준", "url": "https://www.law.go.kr/행정규칙/개인정보의안전성확보조치기준", "applies": ["IDENTITY", "PLATFORM"]},
    {"id": "LAW-E-DOCUMENT", "name": "전자문서 및 전자거래 기본법", "url": "https://www.law.go.kr/법령/전자문서및전자거래기본법", "applies": ["REPORT", "CERTIFICATE", "TRADE"]},
    {"id": "LAW-E-SIGN", "name": "전자서명법", "url": "https://www.law.go.kr/법령/전자서명법", "applies": ["IDENTITY", "APPROVAL", "CERTIFICATE"]},
    {"id": "STD-ISO-14040", "name": "ISO 14040/14044 Life cycle assessment", "url": "https://www.iso.org/standard/37456.html", "applies": ["LCA"], "review": "LICENSED_STANDARD_REVIEW_REQUIRED"},
    {"id": "STD-ISO-14044", "name": "ISO 14044 Life cycle assessment requirements and guidelines", "url": "https://www.iso.org/standard/38498.html", "applies": ["LCA"], "review": "LICENSED_STANDARD_REVIEW_REQUIRED"},
    {"id": "STD-ISO-14067", "name": "ISO 14067 Carbon footprint of products", "url": "https://www.iso.org/standard/71206.html", "applies": ["LCA", "REPORT"], "review": "LICENSED_STANDARD_REVIEW_REQUIRED"},
    {"id": "STD-ISO-14064", "name": "ISO 14064 Greenhouse gases", "url": "https://www.iso.org/standard/66453.html", "applies": ["EMISSION", "VERIFICATION"], "review": "LICENSED_STANDARD_REVIEW_REQUIRED"},
]


ACTORS = [
    ("PUBLIC_VISITOR", "비회원 방문자", "PUBLIC", "공개 정보 조회와 인증서 진위 확인"),
    ("APPLICANT", "가입 신청자", "IDENTITY", "본인·법인 확인 후 가입 신청"),
    ("MEMBER", "일반 회원", "BUSINESS", "허용된 프로젝트 업무 수행"),
    ("COMPANY_REPRESENTATIVE", "기업 대표자", "BUSINESS", "기업 가입과 법적 책임 승인"),
    ("COMPANY_MANAGER", "기업 관리자", "BUSINESS", "기업·조직·프로젝트·사용자 관리"),
    ("ORGANIZATION_MANAGER", "조직 관리자", "BUSINESS", "부서와 담당자 및 데이터 범위 관리"),
    ("SITE_MANAGER", "사업장 관리자", "BUSINESS", "사업장·시설·배출원 기준정보 관리"),
    ("SITE_DATA_OWNER", "활동자료 담당자", "BUSINESS", "활동자료와 증빙 제출 및 보완"),
    ("CALCULATOR", "배출량 산정 담당자", "BUSINESS", "단위·배출계수 매핑과 배출량 산정"),
    ("LCA_PRACTITIONER", "LCA 실무자", "BUSINESS", "시스템 경계·인벤토리·영향평가 수행"),
    ("REDUCTION_MANAGER", "감축 담당자", "BUSINESS", "감축 목표·과제·성과 관리"),
    ("INTERNAL_REVIEWER", "내부 검토자", "REVIEW", "데이터와 계산 근거의 독립 검토"),
    ("APPROVER", "승인권자", "APPROVAL", "검토 결과 승인·반려·확정"),
    ("EXTERNAL_VERIFIER", "외부 검증심사원", "VERIFICATION", "독립 검증과 발견사항 등록"),
    ("VERIFICATION_MANAGER", "검증기관 책임자", "VERIFICATION", "검증계획 승인과 검증의견 확정"),
    ("CERTIFICATE_ISSUER", "인증 발급 담당자", "CERTIFICATE", "인증 적격성 확인과 발급"),
    ("REGULATOR", "규제기관 담당자", "REGULATORY", "법정 보고 접수·적합성 평가·통지"),
    ("AUDITOR", "감사 담당자", "AUDIT", "접근·변경·승인·발급 증적 감사"),
    ("PRIVACY_OFFICER", "개인정보 보호책임자", "SECURITY", "개인정보 처리·열람·파기 감독"),
    ("SECURITY_ADMIN", "보안 관리자", "SECURITY", "인증·접근통제·보안사고 대응"),
    ("PLATFORM_OPERATOR", "플랫폼 운영자", "OPERATION", "테넌트·메뉴·워크플로·운영 관리"),
    ("SYSTEM_INTEGRATOR", "외부 연계 담당자", "INTEGRATION", "API·스키마·동기화·재처리 관리"),
    ("DATA_STEWARD", "기준정보 관리자", "DATA", "단위·물질·배출계수·LCI 버전 관리"),
    ("CONTENT_MANAGER", "콘텐츠 관리자", "CONTENT", "공지·교육·자료·뉴스레터 관리"),
    ("SUPPORT_AGENT", "고객지원 담당자", "SUPPORT", "문의·장애·개선 요청 처리"),
    ("TRADER", "거래 담당자", "TRADE", "공급·수요·제안·계약 업무 수행"),
    ("SETTLEMENT_OFFICER", "정산 담당자", "PAYMENT", "결제·정산·환불·세금계산서 처리"),
    ("CCUS_CAPTURE_OPERATOR", "포집 운영자", "CCUS", "포집량·품질·운영 기록 관리"),
    ("CCUS_TRANSPORT_OPERATOR", "수송 운영자", "CCUS", "인수인계·수송·누출·안전 기록 관리"),
    ("CCUS_STORAGE_OPERATOR", "저장 운영자", "CCUS", "주입·저장·모니터링·폐쇄 기록 관리"),
    ("CCUS_UTILIZATION_OPERATOR", "활용 운영자", "CCUS", "투입 CO2와 제품·부산물 추적"),
]


def p(code, name, domain, owner, stages, legal=()):
    return {"code": code, "name": name, "domain": domain, "owner": owner, "stages": stages, "legal": list(legal)}


PROCESSES = [
    p("IDENTITY_SIGNUP", "회원가입·본인확인", "IDENTITY", "APPLICANT", ["회원유형 선택", "약관·개인정보 동의", "본인·법인 인증", "회원정보 입력", "가입 신청", "승인 결과 통지"], ["LAW-PRIVACY", "LAW-E-SIGN"]),
    p("IDENTITY_ACCESS", "로그인·추가인증·세션", "IDENTITY", "MEMBER", ["자격증명 입력", "위험기반 추가인증", "계정·상태 확인", "액터·데이터범위 로드", "세션 발급", "로그인 감사"], ["LAW-PRIVACY", "RULE-PRIVACY-SAFETY"]),
    p("MEMBER_RECOVERY", "계정 찾기·비밀번호 재설정", "IDENTITY", "MEMBER", ["계정 식별", "추가인증", "재설정 요청", "기존 세션 폐기", "완료 통지"], ["LAW-PRIVACY"]),
    p("MEMBER_LIFECYCLE", "회원 변경·휴면·탈퇴", "IDENTITY", "COMPANY_MANAGER", ["변경 요청", "영향 분석", "본인·승인 확인", "권한·업무 재배정", "정보 변경·분리보관·파기", "후속 시스템 통지", "감사"], ["LAW-PRIVACY"]),
    p("COMPANY_ONBOARDING", "기업·사업장 온보딩", "IDENTITY", "COMPANY_REPRESENTATIVE", ["기업 검색·중복확인", "법인 정보 입력", "증빙 제출", "조직·사업장 등록", "대표권 확인", "관리자 승인", "테넌트 개통"], ["LAW-PRIVACY", "LAW-E-DOCUMENT"]),
    p("ROLE_ASSIGNMENT", "역할·권한·위임", "IDENTITY", "COMPANY_MANAGER", ["대상 사용자 검색", "액터·데이터범위 선택", "직무분리 충돌 검사", "승인", "권한 적용", "캐시·세션 무효화", "이력 저장"], ["LAW-PRIVACY", "RULE-PRIVACY-SAFETY"]),
    p("EMISSION_PROJECT", "배출량 프로젝트 생애주기", "EMISSION", "COMPANY_MANAGER", ["프로젝트 등록", "조직·운영경계 설정", "산정기간·방법론 설정", "담당 액터·마감 배정", "자료수집 개시", "산정·검증", "승인·확정", "보고·종료"], ["LAW-CARBON-NEUTRAL", "LAW-ETS", "RULE-ETS-MRV"]),
    p("ACTIVITY_REQUEST", "활동자료 제출 요청", "EMISSION", "COMPANY_MANAGER", ["요청범위 설정", "대상 사업장·담당자 검색", "입력양식·마감 선택", "요청 발송", "수신·열람 추적", "미제출 알림·에스컬레이션"], ["RULE-ETS-MRV"]),
    p("ACTIVITY_DATA", "활동자료 입력·보완", "EMISSION", "SITE_DATA_OWNER", ["업무 수신", "자료 입력·엑셀 업로드", "단위·기간·출처 검증", "증빙 연결", "임시저장", "제출", "반려 보완", "재제출"], ["RULE-ETS-MRV"]),
    p("EVIDENCE_MANAGEMENT", "증빙자료 생애주기", "EMISSION", "SITE_DATA_OWNER", ["파일 검사", "업로드", "자료행 연결", "해시·메타데이터 저장", "열람권한 적용", "버전 변경", "보존·파기"], ["LAW-E-DOCUMENT", "LAW-PRIVACY"]),
    p("FACTOR_MAPPING", "배출계수·단위 매핑", "EMISSION", "CALCULATOR", ["미매핑 자료 조회", "물질·연료 검색", "후보 순위·근거 확인", "단위 환산 선택", "개별·일괄 매핑", "충돌 검증", "매핑 확정·버전 저장"], ["RULE-ETS-MRV"]),
    p("EMISSION_CALCULATION", "Scope 1·2·3 배출량 산정", "EMISSION", "CALCULATOR", ["산정대상 잠금", "방법론·계수 버전 확인", "단위 환산", "행별 산정", "시설·사업장·Scope 집계", "불확도·품질 평가", "계산근거 저장", "결과 제출"], ["LAW-ETS", "RULE-ETS-MRV", "STD-ISO-14064"]),
    p("EMISSION_VALIDATION", "배출량 데이터 검증", "VERIFICATION", "INTERNAL_REVIEWER", ["검증계획 수립", "완전성·일관성 검사", "이상치·중복 검사", "증빙 표본검사", "계산 재현", "발견사항 등록", "보완 확인", "검증 결론"], ["RULE-ETS-MRV", "RULE-ETS-VERIFY"]),
    p("EMISSION_APPROVAL", "배출량 검토·승인·확정", "APPROVAL", "APPROVER", ["승인대상 조회", "변경·위험 요약 확인", "검증의견 확인", "승인·반려", "전자서명", "결과 잠금", "재개 통제"], ["LAW-E-SIGN", "LAW-ETS"]),
    p("STATEMENT_REPORT", "온실가스 명세서 작성·제출", "REPORT", "COMPANY_MANAGER", ["확정 데이터 선택", "법정 서식 생성", "총괄·사업장·시설 대조", "검증보고서 첨부", "전자서명", "전자 제출", "접수·보완", "최종 보존"], ["LAW-ETS", "RULE-ETS-MRV", "LAW-E-DOCUMENT"]),
    p("LCA_PROJECT", "제품 LCA 프로젝트", "LCA", "LCA_PRACTITIONER", ["목표·범위 설정", "제품·공정 선택", "기능단위 설정", "시스템경계 설정", "데이터수집 계획", "인벤토리·영향평가", "검토·확정", "보고"], ["STD-ISO-14040", "STD-ISO-14067", "RULE-EPD"]),
    p("LCA_INVENTORY", "LCI 인벤토리 수집·매핑", "LCA", "LCA_PRACTITIONER", ["공정 흐름 구성", "원료·보조재 입력", "에너지·스팀 입력", "운송 입력", "제품·부산물 입력", "폐기물·배출물 입력", "LCI 검색·매핑", "질량·에너지 수지 검증"], ["STD-ISO-14040", "RULE-EPD"]),
    p("LCA_ALLOCATION", "제품·부산물 할당", "LCA", "LCA_PRACTITIONER", ["산출물 분류", "질량·경제·물리 기준 선택", "기준자료 입력", "할당비율 계산", "100% 정합성 검사", "민감도 비교", "기준 확정"], ["STD-ISO-14044", "STD-ISO-14067"]),
    p("LCA_IMPACT", "LCIA 영향평가·기여도 분석", "LCA", "LCA_PRACTITIONER", ["영향범주·방법 선택", "특성화 계수 버전 선택", "영향평가 계산", "공정별 기여도", "원료별 기여도", "민감도·시나리오", "결과 검토"], ["STD-ISO-14040", "STD-ISO-14067"]),
    p("LCA_REPORT", "LCA·제품탄소발자국 보고", "REPORT", "LCA_PRACTITIONER", ["확정 결과 선택", "요약·상세 보고서 생성", "가정·제외·품질 표시", "독립 검토", "보고서 확정", "발급·공개 범위 설정"], ["STD-ISO-14067", "RULE-EPD", "LAW-E-DOCUMENT"]),
    p("REDUCTION_TARGET", "감축 목표·로드맵", "REDUCTION", "REDUCTION_MANAGER", ["기준연도 설정", "기준배출량 확정", "조직·사업장 목표 배분", "목표 시나리오", "로드맵 작성", "승인", "변경관리"], ["LAW-CARBON-NEUTRAL"]),
    p("REDUCTION_INITIATIVE", "감축 과제 생애주기", "REDUCTION", "REDUCTION_MANAGER", ["과제 등록", "감축수단·경계 설정", "예상 감축량 산정", "예산·일정·담당자", "타당성 검토", "승인", "실행", "종료"], ["LAW-CARBON-NEUTRAL"]),
    p("REDUCTION_PERFORMANCE", "감축 실적·성과 검증", "REDUCTION", "REDUCTION_MANAGER", ["모니터링 자료 수집", "기준선 조정", "실제 감축량 산정", "비용·효과 분석", "검증", "승인", "성과 보고"], ["LAW-CARBON-NEUTRAL", "STD-ISO-14064"]),
    p("MONITORING_ANALYSIS", "통합 모니터링·이상치 대응", "MONITORING", "INTERNAL_REVIEWER", ["분석범위 선택", "지표 집계", "목표 대비 분석", "품질 점수", "이상치·경보", "원인 조사", "조치·종결", "공유·내보내기"], ["LAW-CARBON-NEUTRAL"]),
    p("CCUS_CAPTURE", "CO2 포집 운영", "CCUS", "CCUS_CAPTURE_OPERATOR", ["배출원·설비 등록", "포집계획", "포집량·운전자료 수집", "CO2 품질 검사", "손실·누출 산정", "인계 계량", "운영기록 보존"], ["LAW-CCUS"]),
    p("CCUS_TRANSPORT", "CO2 수송·인수인계", "CCUS", "CCUS_TRANSPORT_OPERATOR", ["수송계약·경로", "인수 계량·품질 확인", "운송수단·안전 확인", "수송 추적", "사고·누출 대응", "인계 계량", "차이 조정·기록"], ["LAW-CCUS"]),
    p("CCUS_STORAGE", "CO2 저장·모니터링", "CCUS", "CCUS_STORAGE_OPERATOR", ["저장소·허가 확인", "주입계획", "인수·주입 계량", "압력·거동 모니터링", "누출·이상 대응", "저장량 검증", "폐쇄·사후관리", "운영기록 보존"], ["LAW-CCUS"]),
    p("CCUS_UTILIZATION", "CO2 활용·제품 추적", "CCUS", "CCUS_UTILIZATION_OPERATOR", ["활용공정·제품 등록", "CO2 인수·품질 확인", "투입·산출 수지", "고정·재방출량 산정", "제품·부산물 추적", "감축량 산정", "인증 신청"], ["LAW-CCUS", "STD-ISO-14067"]),
    p("CO2_MASS_BALANCE", "CCUS 전 과정 질량수지·감축량", "CCUS", "CALCULATOR", ["포집·수송·저장·활용 데이터 잠금", "계량기·단위 정규화", "인수인계 차이 조정", "누출·에너지 배출 반영", "중복계상 검사", "순감축량 산정", "검증·확정"], ["LAW-CCUS", "STD-ISO-14064"]),
    p("SUPPLY_DEMAND", "CO2 공급·수요 등록·매칭", "TRADE", "TRADER", ["공급·수요 등록", "품질·물량·기간·위치 검증", "상대방 검색", "매칭 후보 산출", "후보 비교", "협의 요청", "매칭 확정"], ["LAW-CCUS"]),
    p("TRADE_EXECUTION", "거래 제안·계약·이행", "TRADE", "TRADER", ["거래 제안", "협상·변경 이력", "상대방 적격성", "전자계약", "인도 계획", "인수인계 증적", "이행 완료", "분쟁·취소"], ["LAW-CCUS", "LAW-E-DOCUMENT", "LAW-E-SIGN"]),
    p("SETTLEMENT", "거래 정산·결제·환불", "PAYMENT", "SETTLEMENT_OFFICER", ["정산대상 확정", "금액·세금 계산", "청구·결제", "입금 대사", "세금계산서", "정산 지급", "환불·취소", "회계 증적"], ["LAW-E-DOCUMENT"]),
    p("CERTIFICATE_ISSUANCE", "인증서 신청·검토·발급", "CERTIFICATE", "CERTIFICATE_ISSUER", ["발급 신청", "대상 결과·증적 잠금", "중복 발급 검사", "적격성 검토", "수수료 확인", "전자서명·발급", "공개키·진위 데이터 등록", "재발급·취소"], ["LAW-CCUS", "LAW-E-DOCUMENT", "LAW-E-SIGN"]),
    p("CERTIFICATE_VERIFY", "보고서·인증서 진위 확인", "CERTIFICATE", "PUBLIC_VISITOR", ["파일·번호·QR 입력", "원본 레지스트리 검색", "전자서명·해시 검증", "시각지문·OCR 보조검사", "핵심 수치·물질 대조", "판정·불일치 상세", "조회 감사"], ["LAW-E-DOCUMENT", "LAW-E-SIGN"]),
    p("REFERENCE_DATA", "기준정보·방법론 버전 관리", "DATA", "DATA_STEWARD", ["변경 요청", "법령·출처 등록", "물질·단위·계수 검색", "신규·개정 값 입력", "영향 분석", "검토·승인", "유효기간 배포", "재산정 대상 통지"], ["RULE-ETS-MRV", "STD-ISO-14067"]),
    p("EXTERNAL_INTEGRATION", "외부 API·동기화·재처리", "INTEGRATION", "SYSTEM_INTEGRATOR", ["연계시스템 등록", "인증·스키마 설정", "필드 매핑", "연결 테스트", "동기화 실행", "검증·대사", "실패 재시도·격리", "모니터링·감사"], ["LAW-PRIVACY", "RULE-PRIVACY-SAFETY"]),
    p("CONTENT_EDUCATION", "콘텐츠·교육 운영", "CONTENT", "CONTENT_MANAGER", ["콘텐츠·과정 작성", "검토·승인", "공개범위·예약", "게시·신청", "출석·진도·평가", "수료증", "보존·폐기"], ["LAW-PRIVACY"]),
    p("CUSTOMER_SUPPORT", "문의·장애·개선 요청", "SUPPORT", "SUPPORT_AGENT", ["요청 접수", "개인정보·긴급도 분류", "담당자 배정", "조사·답변", "개발·운영 이관", "해결 확인", "종결·지식화"], ["LAW-PRIVACY"]),
    p("GOVERNANCE_CHANGE", "메뉴·화면·API·DB 변경관리", "PLATFORM", "PLATFORM_OPERATOR", ["변경 요청", "요구·법령 근거 연결", "영향도 분석", "명세·테스트 생성", "승인", "구현·배포", "캐시 무효화", "운영 검증·복구"], ["RULE-PRIVACY-SAFETY"]),
    p("PLATFORM_OPERATION", "시스템 운영·관측·복구", "PLATFORM", "PLATFORM_OPERATOR", ["상태 수집", "경보 분류", "장애 대응", "DB·백업 보호", "배포·롤백", "복구 검증", "사후 분석", "재발방지"], ["RULE-PRIVACY-SAFETY"]),
    p("PRIVACY_RIGHTS", "개인정보 열람·정정·삭제·처리정지", "IDENTITY", "PRIVACY_OFFICER", ["권리 요청", "본인확인", "대상 정보 검색", "법적 예외 검토", "승인·처리", "결과 통지", "증적 보존"], ["LAW-PRIVACY"]),
    p("SECURITY_INCIDENT", "보안·개인정보 사고 대응", "PLATFORM", "SECURITY_ADMIN", ["탐지·신고", "분류·초동조치", "영향범위 조사", "접근차단·보존", "통지·신고 판단", "복구", "원인분석·재발방지", "감사"], ["LAW-PRIVACY", "RULE-PRIVACY-SAFETY"]),
    p("AUDIT_EXPORT", "감사·법정자료 제출", "PLATFORM", "AUDITOR", ["감사범위·권한 승인", "로그·증적 검색", "무결성 검증", "예외·위반 분석", "보고서 작성", "제출·열람통제", "보존·파기"], ["LAW-PRIVACY", "LAW-E-DOCUMENT"]),
]


SCENARIO_FAMILIES = {
    "HAPPY_PATH": ["STANDARD"],
    "VALIDATION": ["EMPTY_REQUIRED", "MALFORMED", "BELOW_MIN", "ABOVE_MAX", "UNIT_MISMATCH"],
    "AUTHORITY": ["UNASSIGNED_ACTOR", "EXPIRED_ASSIGNMENT", "SEGREGATION_CONFLICT", "DELEGATION_EXPIRED"],
    "ISOLATION": ["OTHER_TENANT", "OTHER_COMPANY", "OTHER_SITE", "OTHER_PROJECT"],
    "STATE": ["INVALID_TRANSITION", "STALE_VERSION", "LOCKED_RECORD", "ALREADY_COMPLETED"],
    "IDEMPOTENCY": ["DUPLICATE_COMMAND", "RETRY_AFTER_TIMEOUT"],
    "CONCURRENCY": ["OPTIMISTIC_LOCK", "PARALLEL_APPROVAL"],
    "DEADLINE": ["DUE_SOON", "OVERDUE", "ESCALATED"],
    "INTEGRATION": ["TIMEOUT", "INVALID_RESPONSE", "PARTIAL_SUCCESS", "RETRY_EXHAUSTED"],
    "PRIVACY": ["MASKING", "PURPOSE_LIMIT", "RETENTION_EXPIRED", "CONSENT_WITHDRAWN"],
    "AUDIT": ["EVIDENCE_REQUIRED", "HASH_MISMATCH", "MISSING_ACCESS_LOG"],
    "RECOVERY": ["ROLLBACK", "REOPEN", "RESUME_FROM_CHECKPOINT"],
    "ACCESSIBILITY": ["KEYBOARD", "SCREEN_READER", "MOBILE_REFLOW"],
}


def slug(value: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in value.upper()).strip("_")


def actor_records():
    records = []
    conflict = {
        "CALCULATOR": ["INTERNAL_REVIEWER", "APPROVER", "EXTERNAL_VERIFIER"],
        "INTERNAL_REVIEWER": ["CALCULATOR", "APPROVER"],
        "EXTERNAL_VERIFIER": ["CALCULATOR", "APPROVER"],
        "APPROVER": ["CALCULATOR", "INTERNAL_REVIEWER", "EXTERNAL_VERIFIER"],
        "SECURITY_ADMIN": ["AUDITOR"],
    }
    for code, name, typ, purpose in ACTORS:
        records.append({
            "actorCode": code, "actorName": name, "actorType": typ, "purpose": purpose,
            "identityContext": ["accountId", "tenantId", "companyId", "organizationId", "siteIds", "projectIds"],
            "assignmentContext": ["actorCode", "dataScope", "validFrom", "validUntil", "delegatedBy", "assignmentStatus"],
            "privacyRules": ["leastPrivilege", "purposeLimitation", "fieldMasking", "accessLogging"],
            "conflictActors": conflict.get(code, []), "delegationAllowed": typ not in {"AUDIT", "REGULATORY"},
        })
    return records


def interaction_contract(stage_name: str):
    searchable = any(k in stage_name for k in ["검색", "선택", "매핑", "대상", "상대방", "계수", "물질"])
    upload = any(k in stage_name for k in ["업로드", "첨부", "증빙", "파일"])
    approval = any(k in stage_name for k in ["승인", "확정", "전자서명"])
    interactions = ["PAGE_HEADER", "STATUS_CONTEXT", "PRIMARY_ACTION", "NEXT_WORK_GUIDANCE"]
    if searchable:
        interactions.append("LOOKUP_POPUP")
    if upload:
        interactions.append("FILE_UPLOAD")
    if approval:
        interactions.append("DECISION_DIALOG")
    contract = {"components": interactions, "responsive": True, "accessibility": "WCAG_2_1_AA_KRDS"}
    if searchable:
        contract["lookupPopup"] = {
            "openTrigger": "explicit button and keyboard shortcut",
            "query": {"emptyQueryAllowed": True, "debounceMs": 250, "minLength": 0},
            "filters": ["tenantScope", "projectScope", "status", "category", "validAt"],
            "ranking": ["exactNormalizedName", "exactAlias", "prefix", "tokenSimilarity", "domainPriority", "recentUse"],
            "pageSize": 20, "minimumCandidateCount": 5, "selection": "single-or-multi-by-field-contract",
            "states": ["initial", "loading", "empty", "error", "ambiguous", "selected"],
            "returns": ["canonicalId", "displayName", "version", "unit", "source", "validity", "confidence", "reason"],
        }
    return contract


def build_processes(actors):
    actor_ids = {a["actorCode"] for a in actors}
    records, screens, apis, data = [], [], [], []
    for proc in PROCESSES:
        assert proc["owner"] in actor_ids
        steps = []
        states = ["READY"] + [f"S{i:02d}_DONE" for i in range(1, len(proc["stages"]) + 1)]
        for i, stage_name in enumerate(proc["stages"], 1):
            step_code = f"{proc['code']}_{i:02d}_{slug(stage_name)[:32]}"
            screen_code = f"SCR_{step_code}"
            api_code = f"API_{step_code}"
            entity_code = f"DATA_{proc['code']}"
            command = f"CMD_{step_code}"
            steps.append({
                "stepCode": step_code, "stepOrder": i, "stepName": stage_name,
                "actorCode": proc["owner"], "fromState": states[i-1], "toState": states[i],
                "commandCode": command, "screenCode": screen_code, "apiCode": api_code,
                "dataContracts": [entity_code, "DATA_IDENTITY_CONTEXT", "DATA_AUDIT_EVIDENCE"],
                "preconditions": ["authenticated-or-explicit-public-step", "activeActorAssignment", "tenantProjectScopeValidated", "priorStateMatched"],
                "completionRules": ["requiredFieldsValid", "businessRulesPass", "evidencePersisted", "stateTransitionCommitted", "auditEventCommitted"],
                "failureTransitions": ["VALIDATION_FAILED", "AUTHORITY_DENIED", "CONFLICT", "INTEGRATION_FAILED"],
                "rollbackCommand": f"ROLLBACK_{step_code}", "idempotencyRequired": True,
            })
            screens.append({
                "screenCode": screen_code, "screenName": f"{proc['name']} - {stage_name}", "processCode": proc["code"], "stepCode": step_code,
                "route": f"/work/{proc['code'].lower().replace('_','-')}/{i}", "allowedActors": [proc["owner"]],
                "sections": ["contextSummary", "decisionInformation", "workInput", "validationResult", "evidenceHistory", "actions"],
                "interactionContract": interaction_contract(stage_name),
                "states": ["loading", "ready", "empty", "validationError", "permissionDenied", "conflict", "offline", "completed"],
                "actions": [command, f"SAVE_DRAFT_{step_code}", f"CANCEL_{step_code}"],
            })
            apis.append({
                "apiCode": api_code, "method": "POST", "path": f"/api/process/{proc['code'].lower()}/{step_code.lower()}/execute",
                "actorCodes": [proc["owner"]], "commandCode": command, "transactional": True,
                "requiredHeaders": ["Authorization", "X-Tenant-Id", "X-Project-Id", "Idempotency-Key", "If-Match"],
                "requestContract": {"executionId": "uuid", "expectedState": states[i-1], "payload": "step-specific-json", "evidenceRefs": "array"},
                "responseContract": {"executionId": "uuid", "state": states[i], "version": "integer", "nextActions": "array"},
                "errors": ["400_VALIDATION", "401_UNAUTHENTICATED", "403_ACTOR_OR_SCOPE", "409_STATE_OR_VERSION", "422_BUSINESS_RULE", "503_DEPENDENCY"],
            })
        records.append({
            "processCode": proc["code"], "processName": proc["name"], "domainCode": proc["domain"], "ownerActorCode": proc["owner"],
            "goal": f"{proc['name']} 업무를 법령·권한·증적 기준에 맞게 종단 완료한다.",
            "startCondition": "필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.",
            "completionCondition": "최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.",
            "legalSourceIds": proc["legal"], "riskLevel": "HIGH" if proc["domain"] in {"IDENTITY", "VERIFICATION", "CCUS", "CERTIFICATE", "PAYMENT"} else "MEDIUM",
            "steps": steps,
        })
        data.append({
            "dataContractCode": f"DATA_{proc['code']}", "ownerActorCode": proc["owner"], "tenantScoped": True, "projectScoped": True,
            "classification": "BUSINESS_CONFIDENTIAL", "requiredMetadata": ["id", "tenantId", "projectId", "status", "version", "createdBy", "createdAt", "updatedBy", "updatedAt"],
            "changePropagation": ["outboxEvent", "affectedProcessRevalidation", "permissionCacheInvalidation", "searchIndexUpdate", "auditEvidence"],
        })
    data.extend([
        {"dataContractCode": "DATA_IDENTITY_CONTEXT", "classification": "PERSONAL_OR_AUTHORIZATION", "fields": ["accountId", "tenantId", "companyId", "organizationId", "siteIds", "projectIds", "actorAssignments", "delegations", "consents", "assuranceLevel", "sessionId"], "controls": ["encryption", "masking", "purposeLimitation", "retention", "accessLog", "subjectRights"]},
        {"dataContractCode": "DATA_AUDIT_EVIDENCE", "classification": "AUDIT", "fields": ["eventId", "actor", "command", "beforeHash", "afterHash", "reason", "timestamp", "sourceIp", "correlationId", "evidenceRefs"], "controls": ["appendOnly", "integrityHash", "retentionPolicy", "restrictedExport"]},
    ])
    return records, screens, apis, data


def build_tests(processes):
    tests = []
    for proc in processes:
        for step in proc["steps"]:
            for family, variants in SCENARIO_FAMILIES.items():
                for variant in variants:
                    code = f"TC_{step['stepCode']}_{family}_{variant}"
                    expected = {
                        "HAPPY_PATH": ["stateTransitionCommitted", "evidencePersisted", "auditEventCommitted", "nextWorkReturned"],
                        "VALIDATION": ["noStateChange", "fieldErrorsReturned", "noPartialWrite"],
                        "AUTHORITY": ["http403", "noDataDisclosure", "denialAudited"],
                        "ISOLATION": ["http403or404", "noCrossScopeData", "denialAudited"],
                        "STATE": ["http409", "noStateChange", "currentVersionReturned"],
                        "IDEMPOTENCY": ["singleBusinessEffect", "sameResultForSameKey"],
                        "CONCURRENCY": ["oneWinner", "loserGetsConflict", "noLostUpdate"],
                        "DEADLINE": ["deadlinePolicyApplied", "notificationOrEscalationRecorded"],
                        "INTEGRATION": ["controlledFailure", "retryOrDeadLetter", "noUntrackedPartialWrite"],
                        "PRIVACY": ["minimumDisclosure", "policyApplied", "accessAudited"],
                        "AUDIT": ["tamperOrMissingEvidenceDetected", "completionBlockedWhenRequired"],
                        "RECOVERY": ["recoverableCheckpoint", "compensationAudited", "consistentFinalState"],
                        "ACCESSIBILITY": ["taskCompletable", "labelsAndFocusValid", "noInformationLoss"],
                    }[family]
                    tests.append({
                        "caseCode": code, "processCode": proc["processCode"], "stepCode": step["stepCode"],
                        "caseType": family, "variant": variant, "severity": "CRITICAL" if family in {"AUTHORITY", "ISOLATION", "PRIVACY", "AUDIT"} else "MAJOR",
                        "given": ["syntheticTenantAndProject", "assignedOrIntentionallyUnassignedActor", f"executionState={step['fromState']}", f"variant={variant}"],
                        "when": {"commandCode": step["commandCode"], "apiCode": step["apiCode"], "screenCode": step["screenCode"]},
                        "then": expected, "requiredEvidence": ["httpTranscript", "databaseSnapshot", "auditEvent", "stateTransition", "uiAssertion"],
                        "automationLayers": ["contract", "database", "service", "api", "ui-e2e"],
                    })
        tests.append({
            "caseCode": f"TC_{proc['processCode']}_END_TO_END", "processCode": proc["processCode"], "caseType": "END_TO_END", "variant": "ALL_STEPS",
            "severity": "CRITICAL", "given": ["completeSyntheticBusinessContext", "allRequiredActorsAssigned"],
            "when": {"orderedSteps": [s["stepCode"] for s in proc["steps"]]},
            "then": ["completionConditionSatisfied", "allEvidenceTraceable", "nextProcessResolved", "noOrphanTask"],
            "requiredEvidence": ["processTimeline", "dataLineage", "actorActions", "finalArtifact"], "automationLayers": ["api", "ui-e2e"],
        })
    return tests


def validate(actors, processes, screens, apis, data, tests):
    errors = []
    def unique(items, key, label):
        vals = [x[key] for x in items]
        dup = sorted({v for v in vals if vals.count(v) > 1})
        if dup: errors.append(f"duplicate {label}: {dup[:10]}")
        return set(vals)
    actor_ids = unique(actors, "actorCode", "actor")
    process_ids = unique(processes, "processCode", "process")
    screen_ids = unique(screens, "screenCode", "screen")
    api_ids = unique(apis, "apiCode", "api")
    data_ids = unique(data, "dataContractCode", "data")
    unique(tests, "caseCode", "test")
    legal_ids = {x["id"] for x in LEGAL_SOURCES}
    required_families = set(SCENARIO_FAMILIES) | {"END_TO_END"}
    for proc in processes:
        if proc["ownerActorCode"] not in actor_ids: errors.append(f"{proc['processCode']}: missing owner")
        if not proc["steps"] or not proc["legalSourceIds"]: errors.append(f"{proc['processCode']}: steps/legal empty")
        unknown = set(proc["legalSourceIds"]) - legal_ids
        if unknown: errors.append(f"{proc['processCode']}: unknown legal {unknown}")
        for idx, step in enumerate(proc["steps"], 1):
            if step["stepOrder"] != idx: errors.append(f"{step['stepCode']}: order gap")
            if step["screenCode"] not in screen_ids or step["apiCode"] not in api_ids: errors.append(f"{step['stepCode']}: missing screen/api")
            if set(step["dataContracts"]) - data_ids: errors.append(f"{step['stepCode']}: missing data contract")
            families = {t["caseType"] for t in tests if t.get("stepCode") == step["stepCode"]}
            if families != set(SCENARIO_FAMILIES): errors.append(f"{step['stepCode']}: scenario family gap")
        process_families = {t["caseType"] for t in tests if t["processCode"] == proc["processCode"]}
        if not required_families.issubset(process_families): errors.append(f"{proc['processCode']}: end-to-end gap")
    return errors


def graph(processes, screens, apis):
    nodes, edges = [], []
    for proc in processes:
        nodes.append({"id": proc["processCode"], "type": "PROCESS", "label": proc["processName"], "lane": proc["domainCode"]})
        previous = proc["processCode"]
        for step in proc["steps"]:
            nodes.extend([
                {"id": step["stepCode"], "type": "STEP", "label": step["stepName"], "lane": proc["domainCode"]},
                {"id": step["screenCode"], "type": "SCREEN", "label": step["screenCode"], "lane": proc["domainCode"]},
                {"id": step["apiCode"], "type": "API", "label": step["apiCode"], "lane": proc["domainCode"]},
            ])
            edges.extend([
                {"from": previous, "to": step["stepCode"], "type": "NEXT"},
                {"from": step["stepCode"], "to": step["screenCode"], "type": "USES_SCREEN"},
                {"from": step["screenCode"], "to": step["apiCode"], "type": "CALLS"},
            ])
            previous = step["stepCode"]
    return {"layout": "HORIZONTAL_SWIMLANE", "nodes": nodes, "edges": edges}


REFERENCE_KEYWORDS = {
    "IDENTITY": ["회원", "로그인", "인증", "개인정보", "계정", "소속"],
    "EMISSION": ["배출", "온실가스", "활동자료", "명세서", "배출계수"],
    "LCA": ["lca", "lci", "전과정", "탄소발자국", "원료", "부산물"],
    "REDUCTION": ["감축", "목표", "로드맵"],
    "CCUS": ["ccus", "포집", "수송", "저장", "활용", "이산화탄소"],
    "TRADE": ["거래", "공급", "수요", "매칭"],
    "PAYMENT": ["결제", "정산", "환불", "세금계산서", "계좌"],
    "CERTIFICATE": ["인증서", "진위", "발급"],
    "REPORT": ["보고서", "리포트", "명세서"],
    "MONITORING": ["모니터링", "통계", "대시보드", "분석"],
    "CONTENT": ["교육", "공지", "게시판", "faq", "뉴스레터"],
    "PLATFORM": ["관리자", "메뉴", "화면", "시스템", "db", "ddl", "설계"],
}


def reference_trace(inventory_path: Path, processes):
    if not inventory_path.exists():
        return []
    by_domain = {}
    for proc in processes:
        by_domain.setdefault(proc["domainCode"], []).append(proc["processCode"])
    traces = []
    for raw in inventory_path.read_text(encoding="utf-8-sig").splitlines():
        if not raw.strip(): continue
        item = json.loads(raw)
        haystack = (item.get("sourcePath", "") + " " + item.get("sourceName", "")).lower()
        domains = sorted(d for d, words in REFERENCE_KEYWORDS.items() if any(w.lower() in haystack for w in words))
        candidates = sorted({code for d in domains for code in by_domain.get(d, [])})
        traces.append({
            **item, "candidateDomains": domains, "candidateProcessCodes": candidates,
            "traceStatus": "CANDIDATE_REQUIRES_CONTENT_EXTRACTION" if candidates else "UNCLASSIFIED_REQUIRES_REVIEW",
            "confidence": 0.55 if candidates else 0.0,
        })
    return traces


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text_design(path: Path, actors, processes, screens, tests, traces):
    screen_by_id = {s["screenCode"]: s for s in screens}
    lines = [
        "# Carbonet 전체 실행 설계", "",
        "> 이 문서는 생성 파일입니다. 원본 카탈로그와 생성기를 수정한 뒤 재생성합니다.", "",
        "## 판정", "",
        "- 구조 검증: 통과", "- 법령·현업 책임자 승인: 대기", 
        f"- 참조 자산 인벤토리: {len(traces):,}개", f"- 액터: {len(actors)}개", f"- 종단 프로세스: {len(processes)}개",
        f"- 테스트 시나리오: {len(tests):,}개", "",
        "## 공통 사용자 문맥", "",
        "모든 비공개 업무는 accountId, tenantId, companyId, organizationId, siteIds, projectIds, actorAssignments, delegations, consents, assuranceLevel, sessionId를 검증한다.", "",
        "실제 개인정보는 테스트 데이터에 포함하지 않으며 합성 데이터, 마스킹, 목적 제한, 보존·파기, 접근기록 규칙을 적용한다.", "",
        "## 액터", "",
    ]
    for actor in actors:
        lines.append(f"- `{actor['actorCode']}` {actor['actorName']}: {actor['purpose']}")
    lines.extend(["", "## 프로세스·화면·기능", ""])
    for proc in processes:
        lines.extend([
            f"### {proc['processName']} (`{proc['processCode']}`)", "",
            f"- 담당 액터: `{proc['ownerActorCode']}`", f"- 영역: `{proc['domainCode']}` / 위험: `{proc['riskLevel']}`",
            f"- 시작: {proc['startCondition']}", f"- 완료: {proc['completionCondition']}",
            f"- 근거: {', '.join(proc['legalSourceIds'])}", "",
        ])
        for step in proc["steps"]:
            screen = screen_by_id[step["screenCode"]]
            lines.extend([
                f"#### {step['stepOrder']}. {step['stepName']}", "",
                f"- 상태: `{step['fromState']}` → `{step['toState']}`",
                f"- 명령/API/화면: `{step['commandCode']}` / `{step['apiCode']}` / `{step['screenCode']}`",
                f"- 경로: `{screen['route']}`",
                f"- 필수 섹션: {', '.join(screen['sections'])}",
                f"- 화면 상태: {', '.join(screen['states'])}",
                f"- 완료조건: {', '.join(step['completionRules'])}",
                f"- 오류·복구: {', '.join(step['failureTransitions'])}; `{step['rollbackCommand']}`",
            ])
            popup = screen["interactionContract"].get("lookupPopup")
            if popup:
                lines.extend([
                    "- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리",
                    f"- 후보 정렬: {', '.join(popup['ranking'])}",
                    f"- 선택 반환값: {', '.join(popup['returns'])}",
                ])
            families = sorted({t["caseType"] for t in tests if t.get("stepCode") == step["stepCode"]})
            count = sum(1 for t in tests if t.get("stepCode") == step["stepCode"])
            lines.extend([f"- 테스트: {count}건 ({', '.join(families)})", ""])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_flowcharts(path: Path, processes):
    lines = ["# 전체 프로세스 가로 순서도", "", "> Mermaid 입력용 자동 생성 파일입니다. 각 프로세스는 왼쪽에서 오른쪽으로 진행됩니다.", ""]
    for proc in processes:
        lines.extend([f"## {proc['processName']}", "", "```mermaid", "flowchart LR"])
        prior = f"START_{proc['processCode']}"
        lines.append(f"  {prior}([시작])")
        for step in proc["steps"]:
            node = step["stepCode"]
            label = step["stepName"].replace('"', "'")
            lines.append(f"  {prior} --> {node}[\"{label}\"]")
            prior = node
        lines.append(f"  {prior} --> END_{proc['processCode']}([완료])")
        lines.extend(["```", ""])
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--reference-inventory", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    actors = actor_records()
    processes, screens, apis, data = build_processes(actors)
    tests = build_tests(processes)
    errors = validate(actors, processes, screens, apis, data, tests)
    if errors:
        raise SystemExit("\n".join(errors))
    inventory_path = args.reference_inventory or (args.out / "reference-inventory.jsonl")
    traces = reference_trace(inventory_path, processes)
    result = {
        "meta": {"specVersion": "1.0.0", "status": "GENERATED_BASELINE_REQUIRES_DOMAIN_APPROVAL", "generator": Path(__file__).name},
        "counts": {"legalSources": len(LEGAL_SOURCES), "referenceAssets": len(traces), "unclassifiedReferenceAssets": sum(1 for x in traces if not x["candidateProcessCodes"]), "actors": len(actors), "processes": len(processes), "steps": sum(len(p["steps"]) for p in processes), "screens": len(screens), "apis": len(apis), "dataContracts": len(data), "tests": len(tests)},
        "qualityGates": {"duplicateIds": 0, "orphanSteps": 0, "missingContracts": 0, "missingScenarioFamilies": 0, "machineValidation": "PASSED", "domainApproval": "PENDING"},
    }
    if not args.check:
        write_json(args.out / "manifest.json", result)
        write_json(args.out / "legal-sources.json", LEGAL_SOURCES)
        write_json(args.out / "actors.json", actors)
        write_json(args.out / "processes.json", processes)
        write_json(args.out / "screens.json", screens)
        write_json(args.out / "apis.json", apis)
        write_json(args.out / "data-contracts.json", data)
        write_json(args.out / "flow-graph.json", graph(processes, screens, apis))
        write_json(args.out / "reference-trace.json", traces)
        write_text_design(args.out / "complete-text-design.md", actors, processes, screens, tests, traces)
        write_flowcharts(args.out / "horizontal-flowcharts.md", processes)
        with (args.out / "test-scenarios.jsonl").open("w", encoding="utf-8") as fh:
            for test in tests:
                fh.write(json.dumps(test, ensure_ascii=False, separators=(",", ":")) + "\n")
        digest = hashlib.sha256()
        for file in sorted(args.out.glob("*.json*")):
            if file.name != "checksums.sha256": digest.update(file.read_bytes())
        (args.out / "checksums.sha256").write_text(digest.hexdigest() + "\n", encoding="ascii")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
