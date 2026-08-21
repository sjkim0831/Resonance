# 중복 메뉴 업무·프로세스·화면 분리 계획

## 1. 공통 디자인 기준

- 전역 Shell: 모든 사용자 화면은 `GlobalUserGnbShell`과 `CommonUserFooter`를 사용하며 페이지에서 헤더·푸터를 생성하거나 변경하지 않는다.
- 업무 홈·현황 기준: `/emission/my-tasks`의 KRDS 정보 구조, 상태 탭, 우선 업무, 프로세스 진행, 인계, 지원 카드를 기준으로 한다.
- 목록 기준: `/emission/project_list`의 검색·필터·목록·상태·페이지 이동 구조를 사용한다.
- 단계 실행 기준: `/work/execution`의 입력·검증·저장·제출·인계 구조를 사용한다.
- 검토·승인 기준: `/emission/review-approval`의 원문/변경/검증/의견/승인 구조를 사용한다.
- 분석 기준: `/monitoring/dashboard`의 KPI·추이·드릴다운·내보내기 구조를 사용한다.
- 모든 화면은 도움말, 화면 설계, QA, 업무 길잡이, 다음 업무, 전체 업무 보기를 같은 설계 계약에서 생성한다.

## 2. 공통 사용자 릴레이

| 순서 | 계정 종류 | 테스트 계정 | 액터 | 핵심 권한 |
|---:|---|---|---|---|
| 1 | 기업 관리자 | `qaowner26` | `COMPANY_MANAGER` | 업무 개시, 목표·범위 확정, 최종 제출 |
| 2 | 자료 담당자 | `qadata26` | `SITE_DATA_OWNER` | 자료 입력, 증빙 등록, 보완 |
| 3 | 산정 담당자 | `qacalc26` | `CALCULATOR` | 산정, 시뮬레이션, 비용·효과 분석 |
| 4 | 검증 담당자 | `qaverify26` | `VERIFIER` | 데이터·산식·증빙 검증, 보완 요청 |
| 5 | 승인권자 | `qaapprove26` | `APPROVER` | 승인·반려, 기준선 확정 |
| 6 | 기업 관리자 | `qaowner26` | `COMPANY_MANAGER` | 후속 투자·실행계획 확정 |
| 7 | 기업 관리자 | `qaowner26` | `COMPANY_MANAGER` | 보고·공유·프로세스 종료 |

권한은 `tenant + project + dataScope + actor + assignment + active period`가 모두 일치해야 하며 하나라도 다르면 조회와 변경을 차단한다.

## 3. 중복 메뉴 37개 분리 목록

### A. 감축 관리 17개 — 전용 단계 화면 17개

| # | 메뉴 | 목표 경로 | 담당 액터 | 주요 기능 | 다음 인계 |
|---:|---|---|---|---|---|
| 1 | 감축 목표 | `/reduction/target` | COMPANY_MANAGER | 기준 범위, 목표연도, 목표량 등록 | 기준연도 |
| 2 | 기준연도 | `/reduction/baseline-year` | COMPANY_MANAGER | 기준연도 자료 선택, 기준선 잠금 | 조직·사업장 목표 |
| 3 | 조직·사업장 목표 | `/reduction/site-target` | COMPANY_MANAGER | 조직/사업장 배분, 합계 검증 | 감축 로드맵 |
| 4 | 감축 로드맵 | `/reduction/roadmap` | COMPANY_MANAGER | 연차별 마일스톤, 의존관계, 책임자 | 과제 목록 |
| 5 | 감축 과제 목록 | `/reduction/tasks` | COMPANY_MANAGER | 검색, 상태, 담당자, 지연, 상세 이동 | 과제 등록 |
| 6 | 감축 과제 등록 | `/reduction/task/new` | SITE_DATA_OWNER | 수단, 대상, 기간, 증빙, 초안 저장 | 담당자·예산·일정 |
| 7 | 담당자·예산·일정 | `/reduction/task/resources` | COMPANY_MANAGER | 담당자 배정, 예산, 일정, 충돌 검증 | 예상 감축량 |
| 8 | 예상 감축량 | `/reduction/task/estimate` | CALCULATOR | 산식, 가정, 기준선, 예상량 계산 | 과제 승인 |
| 9 | 과제 승인 | `/reduction/task/approval` | APPROVER | 원안/검증결과 비교, 승인·반려 | 감축 실적 |
| 10 | 감축 실적 | `/reduction/performance` | SITE_DATA_OWNER | 월별 실적, 증빙, 누계, 보완 | 목표 대비 실적 |
| 11 | 목표 대비 실적 | `/reduction/target-gap` | VERIFIER | 목표/실적 차이, 원인, 경보 | 비용 대비 효과 |
| 12 | 비용 대비 효과 | `/reduction/cost-effectiveness` | CALCULATOR | 투자비·운영비·tCO2e당 비용 | 감축 수단 분석 |
| 13 | 감축 수단 분석 | `/reduction/measures` | CALCULATOR | 수단 비교, 적용성, 위험, 시나리오 | 한계감축비용 |
| 14 | 한계감축비용 | `/reduction/mac` | CALCULATOR | MAC 계산, 곡선, 민감도 | 우선순위 |
| 15 | 우선순위 | `/reduction/prioritization` | VERIFIER | 점수, 제약, 선후관계, 추천 순위 | 투자 계획 |
| 16 | 투자 계획 | `/reduction/investment-plan` | APPROVER | 투자안, 재원, 승인조건, 확정 | 성과 보고서 |
| 17 | 성과 보고서 | `/reduction/performance-report` | COMPANY_MANAGER | 기간 집계, 검증결과, PDF·공유·제출 | 프로세스 종료 |

### B. 교육·지원 정보 5개 — 전용 정보 화면 5개

| 메뉴 | 목표 경로 | 계정/액터 | 주요 기능 | 처리 방식 |
|---|---|---|---|---|
| 공지사항 | `/support/notice_list` | MEMBER / CONTENT_READER | 중요공지, 기간, 첨부, 읽음 | 전용 목록 |
| 자료실 | `/support/download_list` | MEMBER / CONTENT_READER | 분류, 버전, 파일, 다운로드 이력 | 전용 목록 |
| 정책·제도 | `/support/policy` | MEMBER / CONTENT_READER | 관할, 시행일, 개정 이력, 관련 업무 | 전용 목록 |
| 기술 자료 | `/support/technical-resources` | MEMBER / CONTENT_READER | 기술분류, 적용업무, 파일, 버전 | 전용 목록 |
| 자주 묻는 질문 | `/support/faq` | MEMBER / CONTENT_READER | 업무별 FAQ, 검색, 도움말 연결 | 기존 유지 |

### C. 추적·무결성 4개 — 전용 탭 4개

| 메뉴 | 목표 경로 | 담당 액터 | 주요 기능 |
|---|---|---|---|
| MRV 정보 | `/co2/search` | VERIFIER | MRV 검색, 증빙, 인증 상태 |
| 출처·이동 추적 | `/co2/traceability` | VERIFIER | 출처, 소유권, 이동 경로, 타임라인 |
| 무결성 검증 | `/co2/integrity` | VERIFIER | 해시, 원장, 중단 지점, 검증 결과 |
| 중복 사용 확인 | `/co2/duplicate-use` | VERIFIER | 크레딧·인증서 중복, 폐기·사용 상태 |

### D. 모니터링 분석 4개 — 필터가 다른 분석 화면 4개

| 메뉴 | 목표 경로 | 담당 액터 | 주요 기능 |
|---|---|---|---|
| 조직·사업장 분석 | `/monitoring/organization` | COMPANY_MANAGER | 조직/사업장 KPI, 비교, 드릴다운 |
| Scope별 분석 | `/monitoring/scope` | CALCULATOR | Scope 1·2·3 구성, 원천자료, 증감 |
| 기간별 추이 | `/monitoring/trend` | COMPANY_MANAGER | 일·월·분기·연도 추이, 예측 |
| 목표 대비 분석 | `/monitoring/target-gap` | COMPANY_MANAGER | 목표/실적, 차이, 원인, 조치 업무 생성 |

### E. 내 업무·프로젝트 교차 진입 5개 — 정본 화면 유지, 진입 문맥 분리

| 메뉴 위치 | 목표 경로 | 처리 |
|---|---|---|
| 홈 > 내 업무 요약 | `/emission/my-tasks?entry=home` | 전체 업무 종류·진행상태 요약 |
| 탄소배출 > 내 업무 | `/emission/my-tasks?entry=emission` | 탄소배출 업무 필터 |
| 마이페이지 > 승인·결재함 | `/emission/my-tasks?entry=approval` | 승인 대기·반려·완료 필터 |
| 탄소배출 > 배출량 프로젝트 | `/emission/project_list?entry=emission` | 전체 프로젝트 목록 |
| 마이페이지 > 내 프로젝트 | `/emission/project_list?entry=mypage` | 본인 참여 프로젝트 필터 |

### F. 지원·개인설정 6개 — 기능별 화면 분리

| 메뉴 | 목표 경로 | 담당 액터 | 주요 기능 |
|---|---|---|---|
| 문의하기 | `/support/inquiry/new` | MEMBER | 문의 유형, 내용, 첨부, 제출 |
| 문의 내역 | `/support/inquiry` | MEMBER | 상태, 답변, 추가질문, 종료 |
| 장애·개선 요청 | `/support/improvement-request` | MEMBER | 심각도, 재현절차, 영향, 추적 |
| 내 정보 | `/mypage/profile` | MEMBER | 개인정보·소속 조회/수정 |
| API·연계 설정 | `/mypage/integrations` | COMPANY_MANAGER | API 연결, 권한 범위, 상태, 감사 |
| 회원 탈퇴 | `/mypage/withdrawal` | MEMBER | 영향 확인, 재인증, 철회기간, 탈퇴 |

### G. 유지 가능한 교차 진입 및 기능 분리 5개

| 메뉴 | 목표 경로 | 판정 |
|---|---|---|
| 홈 > 인증서 진위 확인 | `/home/certificate-verify?entry=home` | 정본 화면 교차 진입 유지 |
| 거래 > 진위 확인 | `/home/certificate-verify?entry=certificate` | 업무 도움말 문맥만 변경 |
| 분석 보고서 | `/monitoring/export?mode=report` | 보고서 생성 모드 |
| 데이터 내보내기 | `/monitoring/export?mode=data` | 원천 데이터 내보내기 모드 |
| 뉴스레터 설정 | `/mypage/marketing?entry=support` | 마이페이지 정본으로 연결 |

### H. 안내 메뉴 2개 — 사이트맵 정본과 사용 안내 분리

| 메뉴 | 목표 경로 | 주요 기능 |
|---|---|---|
| 이용 안내 | `/support/getting-started` | 첫 업무 시작, 계정·권한, 업무 릴레이 안내 |
| 시스템 사용 안내 | `/sitemap` | 전체 메뉴·업무·프로세스·화면 탐색 |

## 4. 수량과 구현 판정

- 현재 중복 배치: 37개
- 전용 화면 필요: 30개
- 기존 정본 화면 + 진입 문맥/필터로 해결: 7개
- 신규 공통 화면 원형: 목표설정, 목록, 입력폼, 자원배정, 계산, 검토승인, 실적, 분석, 보고서, 정보목록, 추적, 문의의 12종
- 헤더·푸터 변경: 0개
- DB 메뉴 URL 변경은 이 문서 승인 후 Flyway 단일 변경으로 수행한다.

## 5. 검토 체크

각 행에 대해 `업무명 → 선행 단계 → 계정 → 액터 → 권한 → 입력 → 기능 → 출력 → 다음 인계 → 화면 → QA`가 맞으면 승인한다. 승인되지 않은 행은 메뉴·DB·라우트에 반영하지 않는다.
