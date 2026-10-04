# 업체 설비 등록·3D 연결 설계

Customer → Plant → Line → Process → Equipment Instance

공유: Equipment Type, Manufacturer, Model, Variant / Option, 3D Asset, Entry USD

- 16개 종류 코드 보존; 실제 인스턴스로 복제하지 않음
- 724개 공통 자산; 666개 Entry 재사용; 업체별 USD 복제 금지
- 추천과 연결 수용 분리; 증거 없이 READY/REAL 승격 금지
- NO_MATCH만 신규 자산 후보 생성; 실제 USD 제작은 하지 않음
- 업체 권한은 서버에서 검사; P006 PROJECT_ADMIN만 전체 관리

## 폼 (contract → 런타임 JSON form)

- processId: 공정
- equipmentTypeCode: 설비 종류
- code: 설비 코드
- name: 설비명
- modelId: 제조사 / 모델
- optionId: Variant / Option
- serialNumber: 일련번호
- managementNumber: 관리번호
- purpose: 실제 용도 / 공정 역할
- shapeFamily: 형상 계열 (확인된 경우)
- dimensionsMm: 실제 주요 치수 mm — width/depth/height
- installation: 설치 위치 — 좌표계·단위·위치·회전
- workpiece: 작업물 — 재질·규격·인계
- io: 입출력 / 포트 / I/O — 실제 값만

## 운영·검증 경계
기존 16개 매핑은 Equipment Type. 724종 자산/666 Entry는 공통 라이브러리이며 58개 미연결은 보존. 실제 업체/장비 초기값 0. 배치 객체나 종류를 설치 장비로 복제하지 않음. 사용자 자료가 들어와야 인스턴스 수가 증가한다.

매칭은 근거 게이트 규칙 엔진. 영상으로 형상 유사성을 자동 측정하는 AI는 아니다. 기존 Type 추천은 REFERENCE 이상 자동 상속하지 않는다. 제조사/모델/옵션 FK, 사람이 승인한 식별·형상·치수 근거, 입력 치수 1% 이내, 형상 계열 및 식별번호가 확보된 경우만 EXACT. 같은 검증 모델의 크기 차이는 CLOSE/Base·Variant 재검토. 승인 근거가 없거나 대상 역할이 불명확하면 BLOCKED. 검토된 Type에서 적정 후보가 없고 입력 용도·치수가 갖춰진 경우 NO_MATCH. 신규 Type은 자동 NO_MATCH가 아닌 전수 검토 대기. NO_MATCH만 신규 등록 후보 생성. EXACT는 매칭 등급이며 물리/기능/READY/REAL 검증을 의미하지 않는다.

업체 접근은 PROJECT_ADMIN 전체, 나머지는 customer_access의 명시 VIEWER/EDITOR만. UI 필터가 아니라 서버 API에서 계층 FK로 접근 검사. 자료 파일은 공개 정적 폴더 밖 저장, 다운로드 인증·업체 범위 검사. 소속 업체 자동 권한 부여/계정 생성 없음.

통계: 추천 matched_asset_id와 수용 connected_asset_id 분리. 업체 연결률 = 수용한 연결/업체 실제 인스턴스. 검증 완료 = IDENTITY/GEOMETRY/DIMENSION/PORT/FUNCTION 자료의 수동 검토 완료; PHYSICAL/READY/REAL은 별도 미검증. 검증 완료가 장비 안전 인증이라는 의미는 아니다.

DB: PostgreSQL p006_registry 스키마. 각 엔티티 정규화 FK/중복 제약/조회 인덱스, JSONB 확장 필드, 자산 ID 재번호 없음. 10000개 상한 없음. 조회 최대100/페이지, 일괄 등록 500/트랜잭션, 원본 파일 5MB/업로드 및 대용량 원본 경로 참조. 이름 같아도 제조사별 모델 구분, Variant는 모델 종속.

CSRF: 허용 Origin + 사용자 정의 헤더 + application/json. 모든 SQL 매개변수화. 401/403/409/413 오류 JSON. 인증 세션은 기존 P006 계정 사용. audit에 액터/업체/행위 기록. 업데이트 version 충돌 검사 및 변경 시 기존 연결/검증 재검토.

원씽: 실제 업체의 첫 원장을 JSON/CSV로 dry-run 검증한 뒤 등록하고 후보를 수용/보류한다. 다음 바위는 승인 근거 확보이며 모델 수 확대가 아님.

기존 DB 데이터·USD·Type 매핑 파일은 바꾸지 않고 새 스키마에 초기 데이터 마이그레이션. 코드 수정 무빌드, 등록 API만 별도 서비스. 자동 재시작/트랜잭션 롤백으로 부분 등록 방지.

## EXACT 추가 게이트
설비별 IDENTITY/DIMENSION/PORT 승인 근거가 필요하다. 다른 업체의 설비 검증을 복사하지 않는다. 승인된 기준 모델의 용도·작업물·입출력과 일치해야 하며, 이 조건이 빠지면 EXACT가 아니다. 근거의 반려/수정 시 해당 근거에 의존하는 공유 모델 매핑 및 기존 소비 설비의 연결을 재검토 상태로 돌린다. FUNCTION/PHYSICAL/READY/REAL은 형상 매칭에서 상속하지 않는다.

## 확장 등록
POST /assets는 OPEN NO_MATCH 후보와 관리자 검토 사유가 있을 때만 공통 자산을 등록한다. 업체별 USD 복제 없음. Entry/Base는 프로젝트 내부 실제 파일만 허용하며 파일 존재 검사는 실물 동일성 검증이 아니다. 미확보 Entry는 USD_REQUIRED. 새 자산 등록 후 기존 NO_MATCH는 새 후보를 검토하기 전까지 BLOCKED로 판정한다. 새 Equipment Type은 내부 검토 기준이 없으므로 자동 NO_MATCH/EXACT 판정하지 않는다. 사진/메시의 자동 형상 비교는 미구현이며 수동 근거 승인으로 관리한다.

## API 목록
모든 경로 앞에 /projects/P006/registry-api. GET /meta, /stats, /equipment, /equipment/{id}, /assets, /candidates. POST /hierarchy, /manufacturers, /models, /options, /types, /customer-access, /equipment, /equipment/import, /assets. PATCH /equipment/{id}. POST /equipment/{id}/match, /bind, /evidence. GET /evidence/{id}. POST /evidence/{id}/review, /model-assets. DELETE는 미제공; 운영 원장을 임의 영구 삭제하지 않는다.

## 자동화 재실행
서버 runtime/equipment-registry/generate.py: 계약 기반 정적 화면·문서 생성. migrate.py: 동일 초기 seed 해시가 일치할 때 재실행 가능. qa.py: 기존 관리자 로그인 후 테스트 트랜잭션 전체 롤백. browser-qa.cjs: 실제 웹 UI 임시 검수 데이터 생성 후 cleanup-qa.py로 정확한 UUID만 정리. 이전 소스/Entry USD SHA 보존 검증은 preservation.json.


## 귀속 미확정 원장 후보
62개 원장 후보는 equipment_intake에서 관리. 업체/공장 UNKNOWN은 추천 차단 사유가 아님. 실제 설치 인스턴스와 구분한다. 상세 설계: [원장 후보 매핑 설계](intake-design.md). 화면: [62개 원장 매핑](intake.html). 원문과 최초 귀속 근거는 불변이며 일괄 귀속 변경은 실제 공정 FK/근거/version/감사 기록을 요구한다.
