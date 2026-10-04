# 설비 원장 후보 62개 — 설계와 매핑 근거

## 원씽
업체 귀속과 3D 추천을 독립 판정한다. CHECK LIST.xlsx 원문 62행을 보존한다.
업체/공장/라인/공정 FK는 미확정 상태에서 NULL. 제조사/모델 UNKNOWN, 치수 빈 객체. UNKNOWN이라는 가짜 업체를 만들지 않는다.
equipment_intake는 Equipment Instance 이전의 원장 후보 단계이며 실제 설치 확인을 주장하지 않는다. 기존 equipment_instance와 16 Type는 변경하지 않는다.

## 설계 → 화면 → API → DB
contract.intake → intake.html/intake.js → GET /intake 및 POST /intake/attribution → equipment_intake/audit.
공통 KRDS 계열 기존 스타일 재사용. 원문/원본셀/해시/번호/혼재/귀속신뢰도는 evidence JSON에 보존. 모든 원장에 개별 연결.
매핑은 724개 자산의 명칭/용도 전체 검색 후 종류별 의미 검토. 동일 종류의 원문 번호만 다른 행에는 동일 추천 규칙 적용.
36개 REFERENCE,26개 BLOCKED. EXACT/CLOSE/NO_MATCH 없음. 이름만으로 실제 모델 동일성 승인하지 않음.
REFERENCE는 실물 형상 대조 전 배치 기준 후보. 낮은 점수 GBF는 약어/구조 확인 필수. BLOCKED는 후보 부족 또는 선택할 근거 부족이며 새로운 자산 생성 지시가 아님.
추천율=추천 Entry 존재 행/62. 연결 수용률은 별도이며 현재 0. READY/REAL 불변.

## 귀속 일괄 변경
관리자 인증 + Origin/CSRF + 실제 공정 FK + 근거 11자 이상 + 행 version 검사.
선택한 모든 행 잠금 후 전부 성공하거나 전부 롤백. 원문/evidence/매칭/검증은 변경하지 않음.
변경 전 귀속과 액터/근거/대상 기록. 업체/공장 귀속 확정이 실제 설치/기능 검증 완료는 아님.
원장 조회는 프로젝트 관리자 전용. 임의 사용자 권한/계정 추가 없음. 배치 전체를 임의 업체에 연결하지 않음.

## 업무 순서와 종료 기준
원본62행 대조 → 기준 후보 검색 → DB 영속 등록 → 재조회/검색/이미지 확대 → 필터/선택 → 귀속 자료 확보 후 일괄 변경.
페이지와 프로세스 테스트는 intake-qa.json, 화면 렌더는 intake-browser-qa.json 및 intake-desktop.png.
현재 다음 바위: 실제 귀속 근거와 26개 보류 행의 방식/기능/구조 확인. USD 신규 생성 없음.


## 26개 후속 판정
[26개 설비별 추가 판정·필요 정보](blocked26-design.md). 기존 36개 추천을 변경하지 않고 6개 수정 경로 / 20개 정보 필요를 별도 관리한다.
