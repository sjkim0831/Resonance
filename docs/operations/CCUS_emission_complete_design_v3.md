# CCUS 탄소배출 업무 상세 설계 v3

작성일: 2026-09-09 / 검토용 상세 설계 / 코드·DB 적용 없음 / 실제 기능 검증 전

## 0. 완료 범위와 제한

70개 항목 각각에 필드 타입·필수 여부·유효성·저장 모델·조회/명령·권한·이전/다음·테스트를 정의했다. 총 188개 논리 operation과 552개 페이지 테스트 정의를 포함한다. 이는 테스트 실행 횟수나 구현된 API 수가 아니다.
목표 API는 현재 엔드포인트의 존재를 주장하지 않는다. 실제 API 재사용/어댑터·DB 마이그레이션·권한 전환은 별도 구현 작업이다. RFP 원문, 외부 규제 제출 의무, 법정 보관기간은 미확인이다. 해당 정책은 구현 전 확정해야 한다.

## 1. 확정된 사용자 요구

1. 기준 메뉴 목록의 번호01~70을 유지하며 수정·검증·컨펌을 한 페이지씩 진행한다.
2. 프로젝트 등록 필수는 이름·참여 사업장·산정기간이며 회사와 생성자는 서버에서 정한다. 설명은 선택. 담당자/결재자/Scope/산정기준은 등록 필수가 아니다.
3. 회사 사용자는 권한 범위 내에서 프로젝트를 선택해 업무를 진행한다. 업무 요청/인계가 필요한 시점에만 담당자, 승인 요청 시 결재자를 지정한다.
4. 사업장별 입력·제출·계산·보고가 같은 프로젝트와 버전으로 연결된다.
5. 모든 화면은 KRDS 공통 디자인·JSON Form/메타데이터를 우선 사용한다. 지원되지 않는 서버 계약 변경까지 무빌드 가능하다고 표시하지 않는다.

## 2. 업무 순서와 선택 분기

```text
01 목록 → 기존 선택 ──────────────────────┐
       └ 신규 → 02 사업장(없을 때) → 03 등록 ─┤
                                            ↓
04 상세 → 11 범위/배출원 → [12 검토: 정책 적용 시]
        → 22 직접입력 또는 21 자료요청 → 22/24 입력
        → 33 품질검사 → 제출 → 35 접수
              ↑ 반려/보완 ─────────┘
        → 37 계수매핑·계산 → 38 결과/근거
        → 42 검토/승인 → 43 확정
              └ 반려 → 36 보완 → 새 제출/접수/계산 → 재검토
        → 45 보고서 → 48 발급 → 51 다운로드 → 52 공개검증
        → [54 제출·접수: 적용 업무만] → 57 마감
```

13~20 기준정보는 최초 준비/변경 시 지원하고, 29~32 업무관리는 직접 처리/인계를 돕는다. 63~70 LCA·감축은 별도 선택 업무다. 09/23/39/46/50은 호환 경로 후보이며 별도 필수 단계로 세지 않는다. 메뉴명과 URL이 다르면 단순 이름 변경으로 끝내지 않고 실제 작업 단위를 검수한다.

## 3. 공통 문맥·공유·권한

|값|출처|적용 규칙|
|---|---|---|
|tenantId/actorId|인증 세션|요청 body의 회사값 무시; 타회사 조회/수정 거절|
|projectId|목록 선택/저장 응답|후속 업무 모든 API에 전달; 미선택은 프로젝트 선택기|
|siteId/sourceId|프로젝트 참여사업장/배출원|서버에서 소속·활성/유효버전 검사; UI 필터만으로 보호하지 않음|
|산정기간|프로젝트 revision|URL 임의기간을 신뢰하지 않음; 변경 시 영향 분석|
|submissionId/calculationId/version|선행 저장 응답|명시된 버전을 사용, 최신값으로 조용히 교체 금지|
|revision/idempotencyKey|서버 revision/클라이언트 요청키|동시수정409·동일요청 동일결과|
|returnTo/nextAction|허용된 route registry|내부 허용 경로만; project/site/version 유지|

같은 회사의 탄소배출 조회 권한자는 목록·상세를 볼 수 있다(기본 제안). 입력/계산/승인은 별도 행위 권한과 사업장 범위가 필요하다. 개인 업무 배정은 권한을 새로 부여하지 않는다. 특정 개인에게 제한된 업무는 배정도 확인한다. 비배정 역할 업무는 권한자가 직접 수행하고 실제 처리자를 기록한다.

## 4. 필드 공통 정의

아래 화면별 필드는 API 입력 계약이다. projectId/revision/idempotencyKey처럼 화면에서 직접 타이핑하지 않는 값도 포함한다. 숨은 값이라고 검증을 생략하지 않는다. 선택이라고 표시돼도 행위별 조건부 필수인 값은 해당 명령 스키마에서 검사한다.

- 기간은 업무 사용자가 보는 산정기간과 작업 마감일을 구분한다. 단위는 수량 입력 단위와 결과 단위를 구분한다.
- 제출 가능한 자료기간은 프로젝트기간과 맞아야 한다. 부분월 프로젝트에 월합계 자료를 넣으면 전월량을 자동 포함하지 않는다. 일별자료/명시적 배분근거 중 정책을 정하고, 미확정이면 제출 차단한다.
- 수량·계수·결과는 decimal로 계산한다. 테스트계수는 실제 운영계수가 아니며 별도 QA 구분이다.
- 빈값·미산정·오류·실제0은 다른 상태다. 목표/기준 배출량은 실측/산정값을 대체하지 않는다.
- 파일은 MIME/시그니처/용량/행수 검사, 원본hash, 실패 전체취소, 보관 분리. 현재 XLSX 지원은 첫시트 첫행헤더·5MB·2000행으로 안내하고 임의 다중시트 지원을 약속하지 않는다.

## 5. 영속 데이터와 계산 계보

### project

- 키: projectId
- 필드: tenantId,name,description,periodStart,periodEnd,revision,createdBy,createdAt,status
- 제약: tenant FK; periodStart<=periodEnd; name nonempty; unique(tenantId,creationIdempotencyKey)

### projectSite

- 키: projectId+siteId+boundaryVersion
- 필드: siteId,displayNameSnapshot,validFrom,validTo
- 제약: site.tenant=project.tenant; referenced site cannot be physically removed; project create requires >=1 active site

### source

- 키: sourceId
- 필드: siteId,sourceCode,name,type,measurementUnit,scopeCategory
- 제약: source.site belongs to project boundary; scope classification is versioned, not hardcoded from UI checkbox

### submissionItem

- 키: submissionId+activityId+activityRevision
- 필드: projectId,tenantId,siteId,siteName,sourceId,sourceName,scopeCategory,activityPeriod,quantityDecimal,unit,evidenceHashes,boundaryVersionId
- 제약: immutable; all rows authorized and same project; all accepted activity rows included in authoritative snapshot

### calculationItem

- 키: calculationId+itemId
- 필드: submissionItemId,siteId,sourceId,scopeCategory,quantity,sourceUnit,conversionFactor,convertedQuantity,factorId,factorVersion,factorValue,factorUnit,gwpVersion,gwpValue,formulaVersion,resultDecimal,resultUnit,roundingRule
- 제약: immutable; factor input dimension compatible; no double GWP if factor already CO2e; sum item amounts using defined rounding policy

### lockedResult

- 키: lockedResultId
- 필드: calculationId,version,inputHash,approvalId,lockedBy,lockedAt,lockHash
- 제약: approval binds exact calculation version; no mutable pointer to latest result

### issuance

- 키: certificateId
- 필드: reportId,reportRevision,lockedResultId,templateVersion,pdfObjectKey,pdfSha256,status,issuedAt,replacesId
- 제약: durable PDF and ledger before ISSUED; immutable original; revocation append-only

사업장별 배출량 집계는 계산 item snapshot의 siteId로 수행한다. 현재 원장 join만으로 과거 사업장 이름/Scope를 다시 결정하지 않는다. 계수가 이미 CO2e라면 GWP를 다시 곱하지 않는다. 단위 환산·GWP 적용 여부는 publish된 방법론에서 명시하며 임의 공식을 화면별로 만들지 않는다.

## 6. 상태와 사건

### project

상태: REGISTERED → IN_PROGRESS → CLOSED

- create -> REGISTERED
- first domain activity -> IN_PROGRESS
- close with applicable gates satisfied -> CLOSED
- approved reopen -> IN_PROGRESS

등록 완료는 조직경계/자료/계산 완료를 의미하지 않는다.

### boundary

상태: DRAFT → IN_REVIEW → PUBLISHED → RETURNED → SUPERSEDED

- saveDraft -> DRAFT
- submit -> IN_REVIEW
- approve/publish with policy -> PUBLISHED
- return -> RETURNED
- change published -> new DRAFT; old remains immutable

### activity

상태: DRAFT → SUBMITTED → ACCEPTED → RETURNED

- create/update draft -> DRAFT
- submit(snapshot) -> SUBMITTED
- review accept -> ACCEPTED
- return -> RETURNED
- resubmit -> new snapshot SUBMITTED

원자료 revision과 제출 상태는 별도 관리한다. 원자료 수정은 제출된 스냅샷을 변경하지 않는다.

### calculation

상태: QUEUED → RUNNING → SUCCEEDED → FAILED → SUPERSEDED

- run(valid input) -> QUEUED
- worker -> RUNNING
- atomic snapshots+totals -> SUCCEEDED
- failure -> FAILED with stage
- new input -> new run; old immutable

### review

상태: REQUESTED → APPROVED → RETURNED → STALE

- requestReview -> REQUESTED
- authorized decision -> APPROVED/RETURNED
- input version changed -> STALE; fresh request required

### issuance

상태: REQUESTED → GENERATING → STORING → ISSUED → FAILED

- issue -> REQUESTED
- render -> GENERATING
- write PDF+ledger -> STORING
- both durable -> ISSUED
- failure -> FAILED; retry idempotently

다운로드 가능 상태는 원본과 원장이 모두 저장된 이후다.

### certificate

상태: ISSUED → REVOKED → SUPERSEDED

- issue -> ISSUED
- revoke(reason) -> REVOKED
- reissue -> new certificate referencing prior; prior status per approved policy

### regulatory

상태: DRAFT → SUBMITTED_MANUAL → SUBMITTED_API → RECEIVED → RETURNED → CANCELLED

- prepare -> DRAFT
- recordSubmission/manual evidence -> SUBMITTED_MANUAL
- verified external response -> SUBMITTED_API
- receipt evidence -> RECEIVED
- return -> RETURNED
- resubmit -> new submission version

### reference

상태: DRAFT → VALIDATED → PUBLISHED → RETIRED

- saveDraft -> DRAFT
- test -> VALIDATED
- publish(validated) -> PUBLISHED
- retire -> RETIRED; historic references retained

프로젝트 전체 상태와 자료/계산/승인/발급 상태를 분리한다. 단순 등록으로 BASIC_INFO 외 후속 업무를 완료시키거나 가짜 담당자·마감일·요청을 만들지 않는다. 대시보드 진행률은 적용되는 필수 작업만 분모로 계산하고 근거를 조회할 수 있어야 한다.

## 7. API·트랜잭션·오류 공통

아래 /api/v2/emission 경로는 **목표 네임스페이스**다. 기존 /home/api/emission-projects 등은 호환 어댑터로 재사용할 수 있다. 조회/명령 ID는 설계 식별자이며 라이브 엔드포인트가 아니다. 

응답: `{data, revision, status, nextActions, correlationId}`. 오류: `{code, message, fieldErrors, blockers, correlationId, retryable}`. 문서 다운로드는 만료되는 참조를 쓰며 파일시스템 경로를 노출하지 않는다.

서버 명령 처리 순서: 인증→회사/사업장/행위권한→입력형식→revision→선행 상태/버전→idempotency→DB 트랜잭션(업무변경+감사+outbox)→commit→후속 알림. PDF/외부 API는 durable job과 재시도를 사용하고 외부 호출 중 DB 트랜잭션을 오래 잡지 않는다.

|HTTP|코드|화면 처리|
|---|---|---|
|400|INVALID_INPUT|필드별 오류, 입력 유지|
|401|SESSION_EXPIRED|로그인 후 허용된 원래 경로 복귀; 민감 폼 자동 보존 금지|
|403|FORBIDDEN_SCOPE|회사·사업장·행위 권한 없음; 상세 존재정보 최소화|
|404|RESOURCE_NOT_FOUND|선택 목록으로 복귀|
|409|REVISION_CONFLICT / IDEMPOTENCY_CONFLICT|최신본 비교 후 재시도; 자동 덮어쓰기 금지|
|422|PRECONDITION_FAILED|누락 조건 및 해결 화면 표시|
|413|FILE_TOO_LARGE|업로드 한도 표시|
|415|UNSUPPORTED_FILE|지원 형식 안내|
|429|RATE_LIMITED|Retry-After 및 중복 실행 방지|
|500/503|PROCESSING_FAILED|단계·correlationId 표시; 실패를 성공으로 표시 금지|

## 8. 70개 화면별 구현 계약

### 01. 배출량 프로젝트 목록 — EMI-001

화면: [/emission/project_list](http://172.16.1.232/emission/project_list) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|keyword|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|periodFrom|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|periodTo|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/project
- 조회 권한: emission.project.read
- 조회 출력: projectId, name, siteNames, period, status, calculatedStatus, updatedAt
- 저장/조회 모델: Project + ProjectSite + ProjectRevision
- 이전: 6, 56, 57
- 다음: 3, 4

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E1.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E1.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E1.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E1.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E1.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E1.T09|배출량 프로젝트 목록 항목·출력 연결|projectId, name, siteNames, period, status, calculatedStatus, updatedAt 응답 키와 타입 확인; 3, 4번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=배출량 프로젝트 목록: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-001; QA=E1.T01, E1.T02, E1.T03, E1.T04, E1.T05, E1.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 02. 사업장·배출원 원장 — EMI-002

화면: [/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|siteCode|string|필수|trim; length 1..240 if supplied|
|siteName|string|필수|trim; length 1..240 if supplied|
|address|string|필수|trim; length 1..240 if supplied|
|active|boolean|필수|true/false|
|effectiveFrom|date|필수|ISO YYYY-MM-DD; start <= end|
|effectiveUntil|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|description|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/site
- 조회 권한: emission.site.read
- 조회 출력: siteId, siteCode, siteName, address, status, revision, referenceCount
- 저장/조회 모델: Site + SiteRevision
- 이전: 8
- 다음: 3, 11

|명령|목표 API|권한|저장|
|---|---|---|---|
|E02.create|POST /api/v2/emission/company/site:create|emission.site.create|revision+idempotency+감사/outbox 원자 저장|
|E02.update|POST /api/v2/emission/company/site:update|emission.site.update|revision+idempotency+감사/outbox 원자 저장|
|E02.deactivate|POST /api/v2/emission/company/site:deactivate|emission.site.deactivate|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E2.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E2.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E2.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E2.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E2.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E2.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E2.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E2.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E2.T09|사업장·배출원 원장 항목·출력 연결|siteId, siteCode, siteName, address, status, revision, referenceCount 응답 키와 타입 확인; 3, 11번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=사업장·배출원 원장: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-002; QA=E2.T01, E2.T02, E2.T03, E2.T04, E2.T05, E2.T06, E2.T07, E2.T08, E2.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 03. 프로젝트 등록 — EMI-003

화면: [/emission/project/create](http://172.16.1.232/emission/project/create) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|name|string|필수|trim; length 1..240 if supplied|
|siteIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|periodStart|date|필수|ISO YYYY-MM-DD; start <= end|
|periodEnd|date|필수|ISO YYYY-MM-DD; start <= end|
|description|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/company/project
- 조회 권한: emission.project.read
- 조회 출력: projectId, revision, status, siteIds, periodStart, periodEnd
- 저장/조회 모델: Project + ProjectSite + ProjectRevision
- 이전: 1, 2, 8, 57
- 다음: 4

|명령|목표 API|권한|저장|
|---|---|---|---|
|E03.create|POST /api/v2/emission/company/project:create|emission.project.create|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E3.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E3.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E3.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E3.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E3.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E3.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E3.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E3.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E3.T09|프로젝트 등록 항목·출력 연결|projectId, revision, status, siteIds, periodStart, periodEnd 응답 키와 타입 확인; 4번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로젝트 등록: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-003; QA=E3.T01, E3.T02, E3.T03, E3.T04, E3.T05, E3.T06, E3.T07, E3.T08, E3.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 04. 프로젝트 상세 — EMI-004

화면: [/emission/project/detail](http://172.16.1.232/emission/project/detail) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|name|string|필수|trim; length 1..240 if supplied|
|description|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|periodStart|date|필수|ISO YYYY-MM-DD; start <= end|
|periodEnd|date|필수|ISO YYYY-MM-DD; start <= end|
|siteIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/project
- 조회 권한: emission.project.read
- 조회 출력: project, sites, sourceCounts, activityStatus, calculationStatus, nextActions, history
- 저장/조회 모델: Project + ProjectSite + ProjectRevision
- 이전: 1, 3, 5, 6, 7, 9, 31, 62
- 다음: 11, 22, 37, 38, 45, 57

|명령|목표 API|권한|저장|
|---|---|---|---|
|E04.update|POST /api/v2/emission/projects/{projectId}/project:update|emission.project.update|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E4.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E4.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E4.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E4.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E4.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E4.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E4.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E4.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E4.T09|프로젝트 상세 항목·출력 연결|project, sites, sourceCounts, activityStatus, calculationStatus, nextActions, history 응답 키와 타입 확인; 11, 22, 37, 38, 45, 57번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로젝트 상세: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-004; QA=E4.T01, E4.T02, E4.T03, E4.T04, E4.T05, E4.T06, E4.T07, E4.T08, E4.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 05. 프로세스 진행 — EMI-005

화면: [/emission/project/progress](http://172.16.1.232/emission/project/progress) · READ_ONLY · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|phase|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/projects/{projectId}/workflow
- 조회 권한: emission.workflow.read
- 조회 출력: steps, applicability, status, blockingReasons, nextActions
- 저장/조회 모델: Task + Applicability + Blocker projections
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 4

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E5.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E5.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E5.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E5.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E5.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E5.T09|프로세스 진행 항목·출력 연결|steps, applicability, status, blockingReasons, nextActions 응답 키와 타입 확인; 4번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로세스 진행: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-005; QA=E5.T01, E5.T02, E5.T03, E5.T04, E5.T05, E5.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 06. 프로젝트 포트폴리오 — EMI-006

화면: [/emission/project-portfolio](http://172.16.1.232/emission/project-portfolio) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|periodFrom|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|periodTo|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|siteIds|array<id>|선택/행위별 조건부|unique; 1..100; authorize every referenced entity|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/company/portfolio
- 조회 권한: emission.portfolio.read
- 조회 출력: projects, calculatedTotals, notCalculatedCount
- 저장/조회 모델: Project + LockedResult summaries
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 1, 4

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E6.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E6.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E6.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E6.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E6.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E6.T09|프로젝트 포트폴리오 항목·출력 연결|projects, calculatedTotals, notCalculatedCount 응답 키와 타입 확인; 1, 4번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로젝트 포트폴리오: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-006; QA=E6.T01, E6.T02, E6.T03, E6.T04, E6.T05, E6.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 07. 관리자 프로젝트 운영 — EMI-007

화면: [/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|menuCode|string|필수|trim; length 1..240 if supplied|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|periodFrom|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|periodTo|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/project-operations
- 조회 권한: emission.project-operations.read
- 조회 출력: projects, requests, reviewQueue, delays, issueCounts
- 저장/조회 모델: Project + Task + Request + Review projections
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 4, 35, 55

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E7.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E7.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E7.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E7.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E7.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E7.T09|관리자 프로젝트 운영 항목·출력 연결|projects, requests, reviewQueue, delays, issueCounts 응답 키와 타입 확인; 4, 35, 55번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 프로젝트 운영: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-007; QA=E7.T01, E7.T02, E7.T03, E7.T04, E7.T05, E7.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 08. 프로젝트 사전 설정 — EMI-008

화면: [/admin/emission/project-prerequisites](http://172.16.1.232/admin/emission/project-prerequisites) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|siteIds|array<id>|선택/행위별 조건부|unique; 1..100; authorize every referenced entity|

- 조회: GET /api/v2/emission/company/readiness
- 조회 권한: emission.readiness.read
- 조회 출력: companyStatus, activeSites, referenceReadiness, blockingReasons, warnings
- 저장/조회 모델: Company + Site + PublishedReference projections
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 2, 3

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E8.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E8.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E8.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E8.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E8.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E8.T09|프로젝트 사전 설정 항목·출력 연결|companyStatus, activeSites, referenceReadiness, blockingReasons, warnings 응답 키와 타입 확인; 2, 3번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로젝트 사전 설정: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-008; QA=E8.T01, E8.T02, E8.T03, E8.T04, E8.T05, E8.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 09. 프로젝트 설정 후보 — EMI-009

화면: [/emission/project/settings](http://172.16.1.232/emission/project/settings) · COMPATIBILITY_ROUTE · project 문맥
호환 대상: 4번. 입력 파라미터를 검사·전달하며 쓰기 부작용 없이 이동. 삭제 전 컨펌.

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|

- 조회: GET /api/v2/emission/projects/{projectId}/project
- 조회 권한: emission.project.read
- 조회 출력: redirectToDetail
- 저장/조회 모델: Project + ProjectSite + ProjectRevision
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 4

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E9.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E9.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E9.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E9.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E9.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E9.T09|프로젝트 설정 후보 항목·출력 연결|redirectToDetail 응답 키와 타입 확인; 4번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로젝트 설정 후보: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-009; QA=E9.T01, E9.T02, E9.T03, E9.T04, E9.T05, E9.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 10. 배출 정의 관리 — EMI-010

화면: [/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|definitionType|string|필수|trim; length 1..240 if supplied|
|code|string|필수|trim; length 1..240 if supplied|
|name|string|필수|trim; length 1..240 if supplied|
|parentId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|unitDimension|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|scopeCategory|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|effectiveFrom|date|필수|ISO YYYY-MM-DD; start <= end|
|effectiveUntil|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/source-definition
- 조회 권한: emission.source-definition.read
- 조회 출력: definitionId, version, status, references
- 저장/조회 모델: DefinitionVersion
- 이전: 17
- 다음: 11, 13

|명령|목표 API|권한|저장|
|---|---|---|---|
|E10.create|POST /api/v2/emission/company/source-definition:create|emission.source-definition.create|revision+idempotency+감사/outbox 원자 저장|
|E10.update|POST /api/v2/emission/company/source-definition:update|emission.source-definition.update|revision+idempotency+감사/outbox 원자 저장|
|E10.publish|POST /api/v2/emission/company/source-definition:publish|emission.source-definition.publish|revision+idempotency+감사/outbox 원자 저장|
|E10.retire|POST /api/v2/emission/company/source-definition:retire|emission.source-definition.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E10.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E10.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E10.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E10.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E10.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E10.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E10.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E10.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E10.T09|배출 정의 관리 항목·출력 연결|definitionId, version, status, references 응답 키와 타입 확인; 11, 13번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=배출 정의 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-010; QA=E10.T01, E10.T02, E10.T03, E10.T04, E10.T05, E10.T06, E10.T07, E10.T08, E10.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 11. 조직경계·사업장별 범위 설정 — EMI-011

화면: [/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteSources|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|boundaryMethod|string|필수|trim; length 1..240 if supplied|
|standardCode|string|필수|trim; length 1..240 if supplied|
|standardVersion|string|필수|trim; length 1..240 if supplied|
|periodStart|date|필수|ISO YYYY-MM-DD; start <= end|
|periodEnd|date|필수|ISO YYYY-MM-DD; start <= end|
|exclusions|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/boundary
- 조회 권한: emission.boundary.read
- 조회 출력: boundaryId, boundaryVersionId, sites, sources, scopeSet, blockingReasons
- 저장/조회 모델: BoundaryVersion + BoundarySourceSnapshot
- 이전: 2, 4, 10, 12
- 다음: 21, 22

|명령|목표 API|권한|저장|
|---|---|---|---|
|E11.saveDraft|POST /api/v2/emission/projects/{projectId}/boundary:saveDraft|emission.boundary.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E11.submit|POST /api/v2/emission/projects/{projectId}/boundary:submit|emission.boundary.submit|revision+idempotency+감사/outbox 원자 저장|
|E11.publish|POST /api/v2/emission/projects/{projectId}/boundary:publish|emission.boundary.publish|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E11.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E11.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E11.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E11.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E11.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E11.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E11.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E11.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E11.T09|조직경계·사업장별 범위 설정 항목·출력 연결|boundaryId, boundaryVersionId, sites, sources, scopeSet, blockingReasons 응답 키와 타입 확인; 21, 22번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=조직경계·사업장별 범위 설정: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-011; QA=E11.T01, E11.T02, E11.T03, E11.T04, E11.T05, E11.T06, E11.T07, E11.T08, E11.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 12. 조직경계 검토 — EMI-012

화면: [/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|boundaryVersionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|decision|string|필수|trim; length 1..240 if supplied|
|comment|string|필수|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/boundary-review
- 조회 권한: emission.boundary-review.read
- 조회 출력: reviewId, boundaryVersionId, status, issues
- 저장/조회 모델: BoundaryReview
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 11, 21, 22

|명령|목표 API|권한|저장|
|---|---|---|---|
|E12.approve|POST /api/v2/emission/projects/{projectId}/boundary-review:approve|emission.boundary-review.approve|revision+idempotency+감사/outbox 원자 저장|
|E12.return|POST /api/v2/emission/projects/{projectId}/boundary-review:return|emission.boundary-review.return|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E12.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E12.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E12.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E12.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E12.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E12.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E12.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E12.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E12.T09|조직경계 검토 항목·출력 연결|reviewId, boundaryVersionId, status, issues 응답 키와 타입 확인; 11, 21, 22번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=조직경계 검토: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-012; QA=E12.T01, E12.T02, E12.T03, E12.T04, E12.T05, E12.T06, E12.T07, E12.T08, E12.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 13. 배출계수 관리 — EMI-013

화면: [/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|factorCode|string|필수|trim; length 1..240 if supplied|
|name|string|필수|trim; length 1..240 if supplied|
|value|decimal-string|필수|finite decimal; no binary float; quantity >= 0; factor/GWP range by published policy|
|numeratorUnit|string|필수|trim; length 1..240 if supplied|
|denominatorUnit|string|필수|trim; length 1..240 if supplied|
|gasOrCO2e|string|필수|trim; length 1..240 if supplied|
|sourceCitation|string|필수|trim; length 1..240 if supplied|
|effectiveFrom|date|필수|ISO YYYY-MM-DD; start <= end|
|effectiveUntil|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/factor
- 조회 권한: emission.factor.read
- 조회 출력: factorId, factorVersionId, value, units, source, status
- 저장/조회 모델: FactorVersion
- 이전: 10, 14, 63
- 다음: 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E13.create|POST /api/v2/emission/company/factor:create|emission.factor.create|revision+idempotency+감사/outbox 원자 저장|
|E13.update|POST /api/v2/emission/company/factor:update|emission.factor.update|revision+idempotency+감사/outbox 원자 저장|
|E13.publish|POST /api/v2/emission/company/factor:publish|emission.factor.publish|revision+idempotency+감사/outbox 원자 저장|
|E13.retire|POST /api/v2/emission/company/factor:retire|emission.factor.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E13.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E13.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E13.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E13.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E13.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E13.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E13.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E13.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E13.T09|배출계수 관리 항목·출력 연결|factorId, factorVersionId, value, units, source, status 응답 키와 타입 확인; 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=배출계수 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-013; QA=E13.T01, E13.T02, E13.T03, E13.T04, E13.T05, E13.T06, E13.T07, E13.T08, E13.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 14. ecoinvent 계수 관리 — EMI-014

화면: [/admin/emission/ecoinvent](http://172.16.1.232/admin/emission/ecoinvent) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|keyword|string|필수|trim; length 1..240 if supplied|
|databaseVersion|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|category|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|unit|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/factor-catalog
- 조회 권한: emission.factor-catalog.read
- 조회 출력: catalogId, catalogVersion, entries, licenseStatus, adoptedFactorId
- 저장/조회 모델: ExternalCatalogReference + AdoptedFactorVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 13, 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E14.adopt|POST /api/v2/emission/company/factor-catalog:adopt|emission.factor-catalog.adopt|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E14.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E14.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E14.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E14.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E14.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E14.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E14.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E14.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E14.T09|ecoinvent 계수 관리 항목·출력 연결|catalogId, catalogVersion, entries, licenseStatus, adoptedFactorId 응답 키와 타입 확인; 13, 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=ecoinvent 계수 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-014; QA=E14.T01, E14.T02, E14.T03, E14.T04, E14.T05, E14.T06, E14.T07, E14.T08, E14.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 15. 산정식 관리 — EMI-015

화면: [/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|ruleCode|string|필수|trim; length 1..240 if supplied|
|name|string|필수|trim; length 1..240 if supplied|
|formulaExpression|string|필수|trim; length 1..240 if supplied|
|inputDimensions|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|outputDimension|string|필수|trim; length 1..240 if supplied|
|roundingPolicy|string|필수|trim; length 1..240 if supplied|
|version|string|필수|trim; length 1..240 if supplied|
|testVectors|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/calculation-rule
- 조회 권한: emission.calculation-rule.read
- 조회 출력: ruleVersionId, validation, status
- 저장/조회 모델: FormulaRuleVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E15.saveDraft|POST /api/v2/emission/company/calculation-rule:saveDraft|emission.calculation-rule.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E15.validate|POST /api/v2/emission/company/calculation-rule:validate|emission.calculation-rule.validate|도메인 변경 없음; 비용성 검사는 로그/제한|
|E15.publish|POST /api/v2/emission/company/calculation-rule:publish|emission.calculation-rule.publish|revision+idempotency+감사/outbox 원자 저장|
|E15.retire|POST /api/v2/emission/company/calculation-rule:retire|emission.calculation-rule.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E15.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E15.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E15.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E15.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E15.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E15.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E15.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E15.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E15.T09|산정식 관리 항목·출력 연결|ruleVersionId, validation, status 응답 키와 타입 확인; 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=산정식 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-015; QA=E15.T01, E15.T02, E15.T03, E15.T04, E15.T05, E15.T06, E15.T07, E15.T08, E15.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 16. GWP 값 관리 — EMI-016

화면: [/admin/emission/gwp-values](http://172.16.1.232/admin/emission/gwp-values) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|gasCode|string|필수|trim; length 1..240 if supplied|
|value|decimal-string|필수|finite decimal; no binary float; quantity >= 0; factor/GWP range by published policy|
|assessmentSource|string|필수|trim; length 1..240 if supplied|
|timeHorizon|string|필수|trim; length 1..240 if supplied|
|effectiveFrom|date|필수|ISO YYYY-MM-DD; start <= end|
|effectiveUntil|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/gwp
- 조회 권한: emission.gwp.read
- 조회 출력: gwpVersionId, gasCode, value, source, status
- 저장/조회 모델: GwpVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E16.saveDraft|POST /api/v2/emission/company/gwp:saveDraft|emission.gwp.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E16.publish|POST /api/v2/emission/company/gwp:publish|emission.gwp.publish|revision+idempotency+감사/outbox 원자 저장|
|E16.retire|POST /api/v2/emission/company/gwp:retire|emission.gwp.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E16.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E16.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E16.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E16.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E16.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E16.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E16.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E16.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E16.T09|GWP 값 관리 항목·출력 연결|gwpVersionId, gasCode, value, source, status 응답 키와 타입 확인; 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=GWP 값 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-016; QA=E16.T01, E16.T02, E16.T03, E16.T04, E16.T05, E16.T06, E16.T07, E16.T08, E16.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 17. 배출 변수 관리 — EMI-017

화면: [/admin/emission/management](http://172.16.1.232/admin/emission/management) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|variableCode|string|필수|trim; length 1..240 if supplied|
|name|string|필수|trim; length 1..240 if supplied|
|valueType|string|필수|trim; length 1..240 if supplied|
|unitDimension|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|allowedValues|object/array|선택/행위별 조건부|validate against aggregate JSON Schema; reject unknown executable expressions|
|effectiveFrom|date|필수|ISO YYYY-MM-DD; start <= end|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/variable
- 조회 권한: emission.variable.read
- 조회 출력: variableVersionId, definition, status
- 저장/조회 모델: VariableVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 10, 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E17.saveDraft|POST /api/v2/emission/company/variable:saveDraft|emission.variable.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E17.publish|POST /api/v2/emission/company/variable:publish|emission.variable.publish|revision+idempotency+감사/outbox 원자 저장|
|E17.retire|POST /api/v2/emission/company/variable:retire|emission.variable.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E17.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E17.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E17.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E17.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E17.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E17.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E17.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E17.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E17.T09|배출 변수 관리 항목·출력 연결|variableVersionId, definition, status 응답 키와 타입 확인; 10, 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=배출 변수 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-017; QA=E17.T01, E17.T02, E17.T03, E17.T04, E17.T05, E17.T06, E17.T07, E17.T08, E17.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 18. 입력 양식 관리 — EMI-018

화면: [/admin/emission/input-template](http://172.16.1.232/admin/emission/input-template) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|templateCode|string|필수|trim; length 1..240 if supplied|
|name|string|필수|trim; length 1..240 if supplied|
|fieldDefinitions|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|requiredFields|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|allowedUnits|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/input-template
- 조회 권한: emission.input-template.read
- 조회 출력: templateVersionId, jsonSchema, uiSchema, status
- 저장/조회 모델: InputTemplateVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 22, 24

|명령|목표 API|권한|저장|
|---|---|---|---|
|E18.saveDraft|POST /api/v2/emission/company/input-template:saveDraft|emission.input-template.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E18.preview|POST /api/v2/emission/company/input-template:preview|emission.input-template.preview|도메인 변경 없음; 비용성 검사는 로그/제한|
|E18.publish|POST /api/v2/emission/company/input-template:publish|emission.input-template.publish|revision+idempotency+감사/outbox 원자 저장|
|E18.retire|POST /api/v2/emission/company/input-template:retire|emission.input-template.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E18.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E18.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E18.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E18.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E18.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E18.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E18.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E18.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E18.T09|입력 양식 관리 항목·출력 연결|templateVersionId, jsonSchema, uiSchema, status 응답 키와 타입 확인; 22, 24번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=입력 양식 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-018; QA=E18.T01, E18.T02, E18.T03, E18.T04, E18.T05, E18.T06, E18.T07, E18.T08, E18.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 19. 검증 규칙 관리 — EMI-019

화면: [/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|ruleCode|string|필수|trim; length 1..240 if supplied|
|severity|string|필수|trim; length 1..240 if supplied|
|predicate|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|message|string|필수|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|applicability|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|testVectors|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/quality-rule
- 조회 권한: emission.quality-rule.read
- 조회 출력: qualityRuleVersionId, testResults, status
- 저장/조회 모델: QualityRuleVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 33

|명령|목표 API|권한|저장|
|---|---|---|---|
|E19.saveDraft|POST /api/v2/emission/company/quality-rule:saveDraft|emission.quality-rule.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E19.test|POST /api/v2/emission/company/quality-rule:test|emission.quality-rule.test|도메인 변경 없음; 비용성 검사는 로그/제한|
|E19.publish|POST /api/v2/emission/company/quality-rule:publish|emission.quality-rule.publish|revision+idempotency+감사/outbox 원자 저장|
|E19.retire|POST /api/v2/emission/company/quality-rule:retire|emission.quality-rule.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E19.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E19.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E19.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E19.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E19.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E19.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E19.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E19.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E19.T09|검증 규칙 관리 항목·출력 연결|qualityRuleVersionId, testResults, status 응답 키와 타입 확인; 33번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=검증 규칙 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-019; QA=E19.T01, E19.T02, E19.T03, E19.T04, E19.T05, E19.T06, E19.T07, E19.T08, E19.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 20. 승인·알림 정책 — EMI-020

화면: [/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|policyCode|string|필수|trim; length 1..240 if supplied|
|applicableActions|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|requiredRoles|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|separationRules|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|notificationRules|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/approval-policy
- 조회 권한: emission.approval-policy.read
- 조회 출력: policyVersionId, validation, status
- 저장/조회 모델: ApprovalPolicyVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 42

|명령|목표 API|권한|저장|
|---|---|---|---|
|E20.saveDraft|POST /api/v2/emission/company/approval-policy:saveDraft|emission.approval-policy.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E20.simulate|POST /api/v2/emission/company/approval-policy:simulate|emission.approval-policy.simulate|도메인 변경 없음; 비용성 검사는 로그/제한|
|E20.publish|POST /api/v2/emission/company/approval-policy:publish|emission.approval-policy.publish|revision+idempotency+감사/outbox 원자 저장|
|E20.retire|POST /api/v2/emission/company/approval-policy:retire|emission.approval-policy.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E20.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E20.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E20.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E20.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E20.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E20.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E20.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E20.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E20.T09|승인·알림 정책 항목·출력 연결|policyVersionId, validation, status 응답 키와 타입 확인; 42번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=승인·알림 정책: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-020; QA=E20.T01, E20.T02, E20.T03, E20.T04, E20.T05, E20.T06, E20.T07, E20.T08, E20.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 21. 자료 제출 요청 — EMI-021

화면: [/emission/data-request](http://172.16.1.232/emission/data-request) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|sourceIds|array<id>|선택/행위별 조건부|unique; 1..100; authorize every referenced entity|
|periodStart|date|필수|ISO YYYY-MM-DD; start <= end|
|periodEnd|date|필수|ISO YYYY-MM-DD; start <= end|
|requestedItems|array<id>|필수|unique; 1..100; authorize every referenced entity|
|assigneeIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|dueAt|datetime|필수|ISO8601 offset; store UTC; show Asia/Seoul|
|message|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/activity-request
- 조회 권한: emission.activity-request.read
- 조회 출력: requestId, assignees, status, dueAt, notificationStatus
- 저장/조회 모델: ActivityRequest + RequestAssignee + Outbox
- 이전: 11, 12, 32
- 다음: 22, 24, 32

|명령|목표 API|권한|저장|
|---|---|---|---|
|E21.create|POST /api/v2/emission/projects/{projectId}/activity-request:create|emission.activity-request.create|revision+idempotency+감사/outbox 원자 저장|
|E21.remind|POST /api/v2/emission/projects/{projectId}/activity-request:remind|emission.activity-request.remind|revision+idempotency+감사/outbox 원자 저장|
|E21.cancel|POST /api/v2/emission/projects/{projectId}/activity-request:cancel|emission.activity-request.cancel|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E21.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E21.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E21.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E21.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E21.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E21.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E21.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E21.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E21.T09|자료 제출 요청 항목·출력 연결|requestId, assignees, status, dueAt, notificationStatus 응답 키와 타입 확인; 22, 24, 32번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=자료 제출 요청: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-021; QA=E21.T01, E21.T02, E21.T03, E21.T04, E21.T05, E21.T06, E21.T07, E21.T08, E21.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 22. 활동자료 관리 — EMI-022

화면: [/emission/activity-data](http://172.16.1.232/emission/activity-data) · WORKSPACE · site 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteId|string|필수|opaque ID; existence+tenant+project/site authorization|
|sourceId|string|필수|opaque ID; existence+tenant+project/site authorization|
|activityName|string|필수|trim; length 1..240 if supplied|
|activityPeriod|string|필수|trim; length 1..240 if supplied|
|quantity|decimal-string|필수|finite decimal; no binary float; quantity >= 0; factor/GWP range by published policy|
|unit|string|필수|trim; length 1..240 if supplied|
|evidenceIds|array<id>|선택/행위별 조건부|unique; 1..100; authorize every referenced entity|
|measurementKey|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|note|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/activity
- 조회 권한: emission.activity.read
- 조회 출력: activityId, revision, status, siteId, sourceId, period, quantity, unit, evidenceIds
- 저장/조회 모델: ActivityRevision + ActivityEvidenceLink
- 이전: 4, 11, 12, 18, 21, 23, 24, 25, 27, 33, 36, 61
- 다음: 24, 25, 33

|명령|목표 API|권한|저장|
|---|---|---|---|
|E22.create|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/activity:create|emission.activity.create|revision+idempotency+감사/outbox 원자 저장|
|E22.update|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/activity:update|emission.activity.update|revision+idempotency+감사/outbox 원자 저장|
|E22.deleteDraft|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/activity:deleteDraft|emission.activity.deleteDraft|revision+idempotency+감사/outbox 원자 저장|
|E22.submit|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/activity:submit|emission.activity.submit|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E22.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E22.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E22.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E22.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E22.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E22.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E22.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E22.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E22.T09|활동자료 관리 항목·출력 연결|activityId, revision, status, siteId, sourceId, period, quantity, unit, evidenceIds 응답 키와 타입 확인; 24, 25, 33번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=활동자료 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-022; QA=E22.T01, E22.T02, E22.T03, E22.T04, E22.T05, E22.T06, E22.T07, E22.T08, E22.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 23. 활동자료 입력 기존 경로 — EMI-023

화면: [/emission/data_input](http://172.16.1.232/emission/data_input) · COMPATIBILITY_ROUTE · site 문맥
호환 대상: 22번. 입력 파라미터를 검사·전달하며 쓰기 부작용 없이 이동. 삭제 전 컨펌.

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|

- 조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/activity
- 조회 권한: emission.activity.read
- 조회 출력: redirectToActivity
- 저장/조회 모델: ActivityRevision + ActivityEvidenceLink
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 22

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E23.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E23.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E23.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E23.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E23.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E23.T09|활동자료 입력 기존 경로 항목·출력 연결|redirectToActivity 응답 키와 타입 확인; 22번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=활동자료 입력 기존 경로: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-023; QA=E23.T01, E23.T02, E23.T03, E23.T04, E23.T05, E23.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 24. 엑셀 업로드·원본 열 매핑 — EMI-024

화면: [/emission/excel-upload](http://172.16.1.232/emission/excel-upload) · WORKSPACE · site 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteId|string|필수|opaque ID; existence+tenant+project/site authorization|
|file|multipart-file|필수|server MIME+signature check; limits by endpoint; malware scan/quarantine where available|
|columnMapping|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|sourceMapping|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/import
- 조회 권한: emission.import.read
- 조회 출력: importId, previewRows, rowErrors, createdActivityIds, originalHash
- 저장/조회 모델: ImportBatch + OriginalFile + ColumnMap + ActivityRevision
- 이전: 18, 21, 22
- 다음: 22, 33

|명령|목표 API|권한|저장|
|---|---|---|---|
|E24.preview|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/import:preview|emission.import.preview|도메인 변경 없음; 비용성 검사는 로그/제한|
|E24.validate|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/import:validate|emission.import.validate|도메인 변경 없음; 비용성 검사는 로그/제한|
|E24.commit|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/import:commit|emission.import.commit|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E24.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E24.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E24.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E24.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E24.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E24.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E24.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E24.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E24.T09|엑셀 업로드·원본 열 매핑 항목·출력 연결|importId, previewRows, rowErrors, createdActivityIds, originalHash 응답 키와 타입 확인; 22, 33번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=엑셀 업로드·원본 열 매핑: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-024; QA=E24.T01, E24.T02, E24.T03, E24.T04, E24.T05, E24.T06, E24.T07, E24.T08, E24.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 25. 증빙 자료함 — EMI-025

화면: [/emission/evidence](http://172.16.1.232/emission/evidence) · WORKSPACE · site 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteId|string|필수|opaque ID; existence+tenant+project/site authorization|
|activityId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|file|multipart-file|필수|server MIME+signature check; limits by endpoint; malware scan/quarantine where available|
|documentType|string|필수|trim; length 1..240 if supplied|
|documentDate|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|description|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/evidence
- 조회 권한: emission.evidence.read
- 조회 출력: evidenceId, hash, fileName, mimeType, size, linkedActivities
- 저장/조회 모델: EvidenceObject + EvidenceLink
- 이전: 22, 26
- 다음: 22, 33

|명령|목표 API|권한|저장|
|---|---|---|---|
|E25.upload|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/evidence:upload|emission.evidence.upload|revision+idempotency+감사/outbox 원자 저장|
|E25.link|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/evidence:link|emission.evidence.link|revision+idempotency+감사/outbox 원자 저장|
|E25.unlinkDraft|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/evidence:unlinkDraft|emission.evidence.unlinkDraft|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E25.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E25.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E25.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E25.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E25.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E25.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E25.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E25.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E25.T09|증빙 자료함 항목·출력 연결|evidenceId, hash, fileName, mimeType, size, linkedActivities 응답 키와 타입 확인; 22, 33번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=증빙 자료함: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-025; QA=E25.T01, E25.T02, E25.T03, E25.T04, E25.T05, E25.T06, E25.T07, E25.T08, E25.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 26. 관리자 증빙 관리 — EMI-026

화면: [/admin/emission/evidence-management](http://172.16.1.232/admin/emission/evidence-management) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|missingOnly|boolean|선택/행위별 조건부|true/false|
|documentType|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/evidence-operations
- 조회 권한: emission.evidence-operations.read
- 조회 출력: evidence, missingLinks, accessStatus, retentionStatus
- 저장/조회 모델: Evidence + Link projections
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 25, 35

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E26.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E26.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E26.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E26.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E26.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E26.T09|관리자 증빙 관리 항목·출력 연결|evidence, missingLinks, accessStatus, retentionStatus 응답 키와 타입 확인; 25, 35번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 증빙 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-026; QA=E26.T01, E26.T02, E26.T03, E26.T04, E26.T05, E26.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 27. 외부 데이터 연계 — EMI-027

화면: [/emission/external-data](http://172.16.1.232/emission/external-data) · WORKSPACE · site 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteId|string|필수|opaque ID; existence+tenant+project/site authorization|
|connectionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|sourceMapping|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|periodStart|date|필수|ISO YYYY-MM-DD; start <= end|
|periodEnd|date|필수|ISO YYYY-MM-DD; start <= end|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/external-import
- 조회 권한: emission.external-import.read
- 조회 출력: syncRunId, previewRows, rowErrors, activityIds
- 저장/조회 모델: ConnectionRun + ImportBatch
- 이전: 28
- 다음: 22, 33

|명령|목표 API|권한|저장|
|---|---|---|---|
|E27.preview|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/external-import:preview|emission.external-import.preview|도메인 변경 없음; 비용성 검사는 로그/제한|
|E27.sync|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/external-import:sync|emission.external-import.sync|revision+idempotency+감사/outbox 원자 저장|
|E27.retry|POST /api/v2/emission/projects/{projectId}/sites/{siteId}/external-import:retry|emission.external-import.retry|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E27.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E27.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E27.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E27.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E27.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E27.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E27.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E27.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E27.T09|외부 데이터 연계 항목·출력 연결|syncRunId, previewRows, rowErrors, activityIds 응답 키와 타입 확인; 22, 33번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=외부 데이터 연계: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-027; QA=E27.T01, E27.T02, E27.T03, E27.T04, E27.T05, E27.T06, E27.T07, E27.T08, E27.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 28. 외부 시스템 연계 관리 — EMI-028

화면: [/admin/emission/system-link](http://172.16.1.232/admin/emission/system-link) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|name|string|필수|trim; length 1..240 if supplied|
|providerType|string|필수|trim; length 1..240 if supplied|
|endpoint|string|필수|trim; length 1..240 if supplied|
|credentialRef|string|필수|secret store reference only; never return secret value|
|mappingVersion|string|필수|trim; length 1..240 if supplied|
|schedule|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/connection
- 조회 권한: emission.connection.read
- 조회 출력: connectionId, status, lastRun, lastError
- 저장/조회 모델: ConnectionConfig + SecretReference + ConnectionRun
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 27

|명령|목표 API|권한|저장|
|---|---|---|---|
|E28.create|POST /api/v2/emission/company/connection:create|emission.connection.create|revision+idempotency+감사/outbox 원자 저장|
|E28.update|POST /api/v2/emission/company/connection:update|emission.connection.update|revision+idempotency+감사/outbox 원자 저장|
|E28.test|POST /api/v2/emission/company/connection:test|emission.connection.test|도메인 변경 없음; 비용성 검사는 로그/제한|
|E28.disable|POST /api/v2/emission/company/connection:disable|emission.connection.disable|revision+idempotency+감사/outbox 원자 저장|
|E28.retryRun|POST /api/v2/emission/company/connection:retryRun|emission.connection.retryRun|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E28.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E28.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E28.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E28.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E28.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E28.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E28.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E28.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E28.T09|외부 시스템 연계 관리 항목·출력 연결|connectionId, status, lastRun, lastError 응답 키와 타입 확인; 27번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=외부 시스템 연계 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-028; QA=E28.T01, E28.T02, E28.T03, E28.T04, E28.T05, E28.T06, E28.T07, E28.T08, E28.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 29. 내 업무 — EMI-029

화면: [/emission/my-tasks](http://172.16.1.232/emission/my-tasks) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|dueFrom|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|dueTo|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/my-task
- 조회 권한: emission.my-task.read
- 조회 출력: tasks, assignmentMode, projectId, siteId, targetAction, blockingReasons
- 저장/조회 모델: AuthorizedTask projections
- 이전: 30, 32
- 다음: 31

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E29.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E29.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E29.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E29.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E29.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E29.T09|내 업무 항목·출력 연결|tasks, assignmentMode, projectId, siteId, targetAction, blockingReasons 응답 키와 타입 확인; 31번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=내 업무: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-029; QA=E29.T01, E29.T02, E29.T03, E29.T04, E29.T05, E29.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 30. 프로젝트 업무 배정 — EMI-030

화면: [/emission/work-assignment](http://172.16.1.232/emission/work-assignment) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|taskIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|assigneeIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|approverIds|array<id>|선택/행위별 조건부|unique; 1..100; authorize every referenced entity|
|dueAt|datetime|선택/행위별 조건부|ISO8601 offset; store UTC; show Asia/Seoul|
|note|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/assignment
- 조회 권한: emission.assignment.read
- 조회 출력: assignmentId, revision, taskIds, notificationStatus
- 저장/조회 모델: TaskAssignment + AssignmentHistory + Outbox
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 29, 31

|명령|목표 API|권한|저장|
|---|---|---|---|
|E30.assign|POST /api/v2/emission/projects/{projectId}/assignment:assign|emission.assignment.assign|revision+idempotency+감사/outbox 원자 저장|
|E30.reassign|POST /api/v2/emission/projects/{projectId}/assignment:reassign|emission.assignment.reassign|revision+idempotency+감사/outbox 원자 저장|
|E30.revoke|POST /api/v2/emission/projects/{projectId}/assignment:revoke|emission.assignment.revoke|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E30.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E30.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E30.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E30.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E30.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E30.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E30.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E30.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E30.T09|프로젝트 업무 배정 항목·출력 연결|assignmentId, revision, taskIds, notificationStatus 응답 키와 타입 확인; 29, 31번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로젝트 업무 배정: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-030; QA=E30.T01, E30.T02, E30.T03, E30.T04, E30.T05, E30.T06, E30.T07, E30.T08, E30.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 31. 공통 업무 실행 — EMI-031

화면: [/work/execution](http://172.16.1.232/work/execution) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|taskId|string|필수|opaque ID; existence+tenant+project/site authorization|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|revision|integer|필수|positive; optimistic locking|
|actionPayload|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|

- 조회: GET /api/v2/emission/projects/{projectId}/task-execution
- 조회 권한: emission.task-execution.read
- 조회 출력: taskId, status, resultRef, nextActions
- 저장/조회 모델: TaskExecution + DomainCommandEvent
- 이전: 29, 30
- 다음: 4

|명령|목표 API|권한|저장|
|---|---|---|---|
|E31.execute|POST /api/v2/emission/projects/{projectId}/task-execution:execute|emission.task-execution.execute|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E31.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E31.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E31.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E31.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E31.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E31.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E31.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E31.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E31.T09|공통 업무 실행 항목·출력 연결|taskId, status, resultRef, nextActions 응답 키와 타입 확인; 4번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=공통 업무 실행: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-031; QA=E31.T01, E31.T02, E31.T03, E31.T04, E31.T05, E31.T06, E31.T07, E31.T08, E31.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 32. 마감·지연 현황 — EMI-032

화면: [/emission/deadline-status](http://172.16.1.232/emission/deadline-status) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|overdueOnly|boolean|선택/행위별 조건부|true/false|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/deadline
- 조회 권한: emission.deadline.read
- 조회 출력: tasks, dueAt, overdueDuration, lastReminder
- 저장/조회 모델: TaskDeadline projections
- 이전: 21
- 다음: 21, 29

|명령|목표 API|권한|저장|
|---|---|---|---|
|E32.remind|POST /api/v2/emission/company/deadline:remind|emission.deadline.remind|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E32.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E32.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E32.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E32.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E32.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E32.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E32.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E32.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E32.T09|마감·지연 현황 항목·출력 연결|tasks, dueAt, overdueDuration, lastReminder 응답 키와 타입 확인; 21, 29번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=마감·지연 현황: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-032; QA=E32.T01, E32.T02, E32.T03, E32.T04, E32.T05, E32.T06, E32.T07, E32.T08, E32.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 33. 데이터 검증 — EMI-033

화면: [/emission/data-validation](http://172.16.1.232/emission/data-validation) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|submissionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|qualityRuleVersionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/quality-check
- 조회 권한: emission.quality-check.read
- 조회 출력: qualityRunId, issues, blockingCount, warningCount, status
- 저장/조회 모델: QualityRun + QualityIssue
- 이전: 19, 22, 24, 25, 27, 36
- 다음: 22, 35, 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E33.run|POST /api/v2/emission/projects/{projectId}/quality-check:run|emission.quality-check.run|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E33.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E33.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E33.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E33.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E33.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E33.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E33.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E33.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E33.T09|데이터 검증 항목·출력 연결|qualityRunId, issues, blockingCount, warningCount, status 응답 키와 타입 확인; 22, 35, 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=데이터 검증: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-033; QA=E33.T01, E33.T02, E33.T03, E33.T04, E33.T05, E33.T06, E33.T07, E33.T08, E33.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 34. 검증·보정 공통 화면 — EMI-034

화면: [/emission/validate](http://172.16.1.232/emission/validate) · READ_ONLY · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|submissionId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|calculationId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|mode|string|필수|trim; length 1..240 if supplied|
|tab|string|선택/행위별 조건부|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/projects/{projectId}/validation-workspace
- 조회 권한: emission.validation-workspace.read
- 조회 출력: workspaceType, targetVersion, issues, allowedActions
- 저장/조회 모델: Submission/Calculation validation projections
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 36, 42

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E34.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E34.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E34.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E34.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E34.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E34.T09|검증·보정 공통 화면 항목·출력 연결|workspaceType, targetVersion, issues, allowedActions 응답 키와 타입 확인; 36, 42번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=검증·보정 공통 화면: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-034; QA=E34.T01, E34.T02, E34.T03, E34.T04, E34.T05, E34.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 35. 관리자 검증 — EMI-035

화면: [/admin/emission/validate](http://172.16.1.232/admin/emission/validate) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|submissionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|qualityRunId|string|필수|opaque ID; existence+tenant+project/site authorization|
|decision|string|필수|trim; length 1..240 if supplied|
|comment|string|필수|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/submission-review
- 조회 권한: emission.submission-review.read
- 조회 출력: reviewId, submissionId, status, issues
- 저장/조회 모델: SubmissionReview + SubmissionStatusEvent
- 이전: 7, 26, 33
- 다음: 36, 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E35.accept|POST /api/v2/emission/projects/{projectId}/submission-review:accept|emission.submission-review.accept|revision+idempotency+감사/outbox 원자 저장|
|E35.return|POST /api/v2/emission/projects/{projectId}/submission-review:return|emission.submission-review.return|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E35.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E35.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E35.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E35.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E35.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E35.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E35.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E35.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E35.T09|관리자 검증 항목·출력 연결|reviewId, submissionId, status, issues 응답 키와 타입 확인; 36, 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 검증: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-035; QA=E35.T01, E35.T02, E35.T03, E35.T04, E35.T05, E35.T06, E35.T07, E35.T08, E35.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 36. 보완·재산정 — EMI-036

화면: [/emission/correction](http://172.16.1.232/emission/correction) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|correctionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|sourceVersion|string|필수|trim; length 1..240 if supplied|
|resolvedIssueIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|note|string|필수|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/correction
- 조회 권한: emission.correction.read
- 조회 출력: correctionId, newSubmissionId, status, affectedCalculations
- 저장/조회 모델: CorrectionCase + NewSubmissionLink
- 이전: 34, 35, 38, 42
- 다음: 22, 33, 37

|명령|목표 API|권한|저장|
|---|---|---|---|
|E36.saveDraft|POST /api/v2/emission/projects/{projectId}/correction:saveDraft|emission.correction.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E36.resubmit|POST /api/v2/emission/projects/{projectId}/correction:resubmit|emission.correction.resubmit|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E36.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E36.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E36.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E36.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E36.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E36.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E36.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E36.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E36.T09|보완·재산정 항목·출력 연결|correctionId, newSubmissionId, status, affectedCalculations 응답 키와 타입 확인; 22, 33, 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=보완·재산정: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-036; QA=E36.T01, E36.T02, E36.T03, E36.T04, E36.T05, E36.T06, E36.T07, E36.T08, E36.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 37. 배출량 산정·계수 매핑 — EMI-037

화면: [/emission/calculation](http://172.16.1.232/emission/calculation) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|boundaryVersionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|acceptedSubmissionIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|factorMappings|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|ruleSetVersionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|gwpVersionId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/calculation
- 조회 권한: emission.calculation.read
- 조회 출력: calculationId, version, inputHash, status, errors
- 저장/조회 모델: CalculationRun + CalculationItemSnapshot + InputVersionLink
- 이전: 4, 13, 14, 15, 16, 17, 33, 35, 36, 63
- 다음: 38

|명령|목표 API|권한|저장|
|---|---|---|---|
|E37.validateMapping|POST /api/v2/emission/projects/{projectId}/calculation:validateMapping|emission.calculation.validateMapping|도메인 변경 없음; 비용성 검사는 로그/제한|
|E37.saveMapping|POST /api/v2/emission/projects/{projectId}/calculation:saveMapping|emission.calculation.saveMapping|revision+idempotency+감사/outbox 원자 저장|
|E37.run|POST /api/v2/emission/projects/{projectId}/calculation:run|emission.calculation.run|revision+idempotency+감사/outbox 원자 저장|
|E37.retry|POST /api/v2/emission/projects/{projectId}/calculation:retry|emission.calculation.retry|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E37.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E37.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E37.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E37.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E37.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E37.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E37.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E37.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E37.T09|배출량 산정·계수 매핑 항목·출력 연결|calculationId, version, inputHash, status, errors 응답 키와 타입 확인; 38번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=배출량 산정·계수 매핑: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-037; QA=E37.T01, E37.T02, E37.T03, E37.T04, E37.T05, E37.T06, E37.T07, E37.T08, E37.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 38. 산정 결과 — EMI-038

화면: [/emission/calculation-results](http://172.16.1.232/emission/calculation-results) · READ_ONLY · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|calculationId|string|필수|opaque ID; existence+tenant+project/site authorization|
|compareCalculationId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|scope|string|선택/행위별 조건부|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/projects/{projectId}/calculation-result
- 조회 권한: emission.calculation-result.read
- 조회 출력: items, siteScopeTotals, total, formulaTrace, inputVersions, diff
- 저장/조회 모델: CalculationRun + CalculationItemSnapshot
- 이전: 4, 37, 39, 41, 56, 61
- 다음: 36, 42

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E38.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E38.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E38.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E38.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E38.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E38.T09|산정 결과 항목·출력 연결|items, siteScopeTotals, total, formulaTrace, inputVersions, diff 응답 키와 타입 확인; 36, 42번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=산정 결과: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-038; QA=E38.T01, E38.T02, E38.T03, E38.T04, E38.T05, E38.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 39. 결과 조회 기존 경로 — EMI-039

화면: [/emission/result](http://172.16.1.232/emission/result) · COMPATIBILITY_ROUTE · project 문맥
호환 대상: 38번. 입력 파라미터를 검사·전달하며 쓰기 부작용 없이 이동. 삭제 전 컨펌.

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|calculationId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|

- 조회: GET /api/v2/emission/projects/{projectId}/calculation-result
- 조회 권한: emission.calculation-result.read
- 조회 출력: redirectToResults
- 저장/조회 모델: CalculationRun + CalculationItemSnapshot
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 38

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E39.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E39.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E39.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E39.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E39.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E39.T09|결과 조회 기존 경로 항목·출력 연결|redirectToResults 응답 키와 타입 확인; 38번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=결과 조회 기존 경로: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-039; QA=E39.T01, E39.T02, E39.T03, E39.T04, E39.T05, E39.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 40. 관리자 산정 결과 목록 — EMI-040

화면: [/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|siteId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|periodFrom|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|periodTo|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/result-operations
- 조회 권한: emission.result-operations.read
- 조회 출력: runs, versions, projectId, reviewStatus
- 저장/조회 모델: CalculationRun projections
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 41

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E40.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E40.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E40.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E40.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E40.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E40.T09|관리자 산정 결과 목록 항목·출력 연결|runs, versions, projectId, reviewStatus 응답 키와 타입 확인; 41번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 산정 결과 목록: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-040; QA=E40.T01, E40.T02, E40.T03, E40.T04, E40.T05, E40.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 41. 관리자 결과 상세 — EMI-041

화면: [/admin/emission/result_detail](http://172.16.1.232/admin/emission/result_detail) · READ_ONLY · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|calculationId|string|필수|opaque ID; existence+tenant+project/site authorization|

- 조회: GET /api/v2/emission/projects/{projectId}/result-detail
- 조회 권한: emission.result-detail.read
- 조회 출력: run, items, siteScopeTotals, inputVersions, reviewHistory
- 저장/조회 모델: CalculationRun + CalculationItemSnapshot
- 이전: 40
- 다음: 38, 42

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E41.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E41.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E41.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E41.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E41.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E41.T09|관리자 결과 상세 항목·출력 연결|run, items, siteScopeTotals, inputVersions, reviewHistory 응답 키와 타입 확인; 38, 42번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 결과 상세: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-041; QA=E41.T01, E41.T02, E41.T03, E41.T04, E41.T05, E41.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 42. 검토·승인 — EMI-042

화면: [/emission/review-approval](http://172.16.1.232/emission/review-approval) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|calculationId|string|필수|opaque ID; existence+tenant+project/site authorization|
|reviewId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|decision|string|필수|trim; length 1..240 if supplied|
|comment|string|필수|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|approverId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/result-review
- 조회 권한: emission.result-review.read
- 조회 출력: reviewId, approvalId, calculationId, status
- 저장/조회 모델: ReviewRequest + ReviewDecision + ApprovalEvent
- 이전: 20, 34, 38, 41
- 다음: 36, 43

|명령|목표 API|권한|저장|
|---|---|---|---|
|E42.requestReview|POST /api/v2/emission/projects/{projectId}/result-review:requestReview|emission.result-review.requestReview|revision+idempotency+감사/outbox 원자 저장|
|E42.approve|POST /api/v2/emission/projects/{projectId}/result-review:approve|emission.result-review.approve|revision+idempotency+감사/outbox 원자 저장|
|E42.return|POST /api/v2/emission/projects/{projectId}/result-review:return|emission.result-review.return|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E42.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E42.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E42.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E42.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E42.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E42.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E42.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E42.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E42.T09|검토·승인 항목·출력 연결|reviewId, approvalId, calculationId, status 응답 키와 타입 확인; 36, 43번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=검토·승인: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-042; QA=E42.T01, E42.T02, E42.T03, E42.T04, E42.T05, E42.T06, E42.T07, E42.T08, E42.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 43. 배출량 확정 — EMI-043

화면: [/emission/finalization](http://172.16.1.232/emission/finalization) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|calculationId|string|필수|opaque ID; existence+tenant+project/site authorization|
|approvalId|string|필수|opaque ID; existence+tenant+project/site authorization|
|revision|integer|필수|positive; optimistic locking|
|reason|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|

- 조회: GET /api/v2/emission/projects/{projectId}/result-lock
- 조회 권한: emission.result-lock.read
- 조회 출력: lockedResultId, hash, status, changeRequestId
- 저장/조회 모델: LockedResult + LockHash + ChangeRequest
- 이전: 42
- 다음: 45

|명령|목표 API|권한|저장|
|---|---|---|---|
|E43.lock|POST /api/v2/emission/projects/{projectId}/result-lock:lock|emission.result-lock.lock|revision+idempotency+감사/outbox 원자 저장|
|E43.requestChange|POST /api/v2/emission/projects/{projectId}/result-lock:requestChange|emission.result-lock.requestChange|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E43.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E43.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E43.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E43.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E43.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E43.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E43.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E43.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E43.T09|배출량 확정 항목·출력 연결|lockedResultId, hash, status, changeRequestId 응답 키와 타입 확인; 45번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=배출량 확정: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-043; QA=E43.T01, E43.T02, E43.T03, E43.T04, E43.T05, E43.T06, E43.T07, E43.T08, E43.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 44. 보고서 양식 관리 — EMI-044

화면: [/admin/emission/report-template](http://172.16.1.232/admin/emission/report-template) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|templateCode|string|필수|trim; length 1..240 if supplied|
|name|string|필수|trim; length 1..240 if supplied|
|applicability|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|sections|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|requiredFields|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/report-template
- 조회 권한: emission.report-template.read
- 조회 출력: templateVersionId, status, preview
- 저장/조회 모델: ReportTemplateVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 45

|명령|목표 API|권한|저장|
|---|---|---|---|
|E44.saveDraft|POST /api/v2/emission/company/report-template:saveDraft|emission.report-template.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E44.preview|POST /api/v2/emission/company/report-template:preview|emission.report-template.preview|도메인 변경 없음; 비용성 검사는 로그/제한|
|E44.publish|POST /api/v2/emission/company/report-template:publish|emission.report-template.publish|revision+idempotency+감사/outbox 원자 저장|
|E44.retire|POST /api/v2/emission/company/report-template:retire|emission.report-template.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E44.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E44.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E44.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E44.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E44.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E44.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E44.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E44.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E44.T09|보고서 양식 관리 항목·출력 연결|templateVersionId, status, preview 응답 키와 타입 확인; 45번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=보고서 양식 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-044; QA=E44.T01, E44.T02, E44.T03, E44.T04, E44.T05, E44.T06, E44.T07, E44.T08, E44.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 45. 보고서 작성 — EMI-045

화면: [/emission/report-write](http://172.16.1.232/emission/report-write) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lockedResultId|string|필수|opaque ID; existence+tenant+project/site authorization|
|templateVersionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|title|string|필수|trim; length 1..240 if supplied|
|reportMetadata|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/report
- 조회 권한: emission.report.read
- 조회 출력: reportId, revision, preview, validation
- 저장/조회 모델: ReportRevision
- 이전: 4, 43, 44, 46, 47
- 다음: 48, 51

|명령|목표 API|권한|저장|
|---|---|---|---|
|E45.saveDraft|POST /api/v2/emission/projects/{projectId}/report:saveDraft|emission.report.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E45.preview|POST /api/v2/emission/projects/{projectId}/report:preview|emission.report.preview|도메인 변경 없음; 비용성 검사는 로그/제한|
|E45.requestIssue|POST /api/v2/emission/projects/{projectId}/report:requestIssue|emission.report.requestIssue|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E45.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E45.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E45.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E45.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E45.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E45.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E45.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E45.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E45.T09|보고서 작성 항목·출력 연결|reportId, revision, preview, validation 응답 키와 타입 확인; 48, 51번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=보고서 작성: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-045; QA=E45.T01, E45.T02, E45.T03, E45.T04, E45.T05, E45.T06, E45.T07, E45.T08, E45.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 46. 보고서 작성 기존 경로 — EMI-046

화면: [/emission/report_submit](http://172.16.1.232/emission/report_submit) · COMPATIBILITY_ROUTE · project 문맥
호환 대상: 45번. 입력 파라미터를 검사·전달하며 쓰기 부작용 없이 이동. 삭제 전 컨펌.

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|

- 조회: GET /api/v2/emission/projects/{projectId}/report
- 조회 권한: emission.report.read
- 조회 출력: redirectToReport
- 저장/조회 모델: ReportRevision
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 45

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E46.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E46.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E46.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E46.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E46.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E46.T09|보고서 작성 기존 경로 항목·출력 연결|redirectToReport 응답 키와 타입 확인; 45번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=보고서 작성 기존 경로: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-046; QA=E46.T01, E46.T02, E46.T03, E46.T04, E46.T05, E46.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 47. 관리자 보고서 — EMI-047

화면: [/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report) · READ_ONLY · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|reportId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|reportType|string|필수|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/projects/{projectId}/report-operations
- 조회 권한: emission.report-operations.read
- 조회 출력: report, lockedResultRef, preview, allowedActions
- 저장/조회 모델: ReportRevision + LockedResult
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 45, 48

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E47.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E47.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E47.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E47.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E47.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E47.T09|관리자 보고서 항목·출력 연결|report, lockedResultRef, preview, allowedActions 응답 키와 타입 확인; 45, 48번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 보고서: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-047; QA=E47.T01, E47.T02, E47.T03, E47.T04, E47.T05, E47.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 48. PDF 출력·발급 — EMI-048

화면: [/admin/emission/survey-report-print](http://172.16.1.232/admin/emission/survey-report-print) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|reportId|string|필수|opaque ID; existence+tenant+project/site authorization|
|reportRevision|integer|필수|positive; optimistic locking|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/issuance
- 조회 권한: emission.issuance.read
- 조회 출력: issuanceJobId, status, certificateId, pdfHash, downloadRef, errorStage
- 저장/조회 모델: IssuanceJob + PdfOriginal + CertificateLedger
- 이전: 45, 47
- 다음: 49, 51, 52

|명령|목표 API|권한|저장|
|---|---|---|---|
|E48.issue|POST /api/v2/emission/projects/{projectId}/issuance:issue|emission.issuance.issue|revision+idempotency+감사/outbox 원자 저장|
|E48.retry|POST /api/v2/emission/projects/{projectId}/issuance:retry|emission.issuance.retry|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E48.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E48.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E48.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E48.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E48.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E48.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E48.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E48.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E48.T09|PDF 출력·발급 항목·출력 연결|issuanceJobId, status, certificateId, pdfHash, downloadRef, errorStage 응답 키와 타입 확인; 49, 51, 52번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=PDF 출력·발급: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-048; QA=E48.T01, E48.T02, E48.T03, E48.T04, E48.T05, E48.T06, E48.T07, E48.T08, E48.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 49. 보고서·인증서 발급 관리 — EMI-049

화면: [/admin/emission/report-certificates](http://172.16.1.232/admin/emission/report-certificates) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|certificateId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|
|reason|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|

- 조회: GET /api/v2/emission/company/certificate-operations
- 조회 권한: emission.certificate-operations.read
- 조회 출력: certificates, status, originalHash, linkedResult, history
- 저장/조회 모델: CertificateLedger + RevocationEvent
- 이전: 48, 50, 53, 60
- 다음: 51, 52

|명령|목표 API|권한|저장|
|---|---|---|---|
|E49.reissue|POST /api/v2/emission/company/certificate-operations:reissue|emission.certificate-operations.reissue|revision+idempotency+감사/outbox 원자 저장|
|E49.revoke|POST /api/v2/emission/company/certificate-operations:revoke|emission.certificate-operations.revoke|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E49.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E49.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E49.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E49.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E49.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E49.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E49.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E49.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E49.T09|보고서·인증서 발급 관리 항목·출력 연결|certificates, status, originalHash, linkedResult, history 응답 키와 타입 확인; 51, 52번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=보고서·인증서 발급 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-049; QA=E49.T01, E49.T02, E49.T03, E49.T04, E49.T05, E49.T06, E49.T07, E49.T08, E49.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 50. 인증서 관리 후보 — EMI-050

화면: [/admin/emission/certificates](http://172.16.1.232/admin/emission/certificates) · COMPATIBILITY_ROUTE · company 문맥
호환 대상: 49번. 입력 파라미터를 검사·전달하며 쓰기 부작용 없이 이동. 삭제 전 컨펌.

|입력 코드|타입|필수|검사|
|---|---|---|---|
|certificateId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|

- 조회: GET /api/v2/emission/company/certificate-operations
- 조회 권한: emission.certificate-operations.read
- 조회 출력: redirectToCertificateOperations
- 저장/조회 모델: CertificateLedger + RevocationEvent
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 49

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E50.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E50.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E50.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E50.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E50.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E50.T09|인증서 관리 후보 항목·출력 연결|redirectToCertificateOperations 응답 키와 타입 확인; 49번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=인증서 관리 후보: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-050; QA=E50.T01, E50.T02, E50.T03, E50.T04, E50.T05, E50.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 51. 보고서·인증서 다운로드 — EMI-051

화면: [/emission/report-download](http://172.16.1.232/emission/report-download) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|certificateId|string|필수|opaque ID; existence+tenant+project/site authorization|
|shareExpiresAt|datetime|선택/행위별 조건부|ISO8601 offset; store UTC; show Asia/Seoul|
|shareScope|string|선택/행위별 조건부|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/projects/{projectId}/report-download
- 조회 권한: emission.report-download.read
- 조회 출력: downloadRef, shareId, expiresAt, status
- 저장/조회 모델: ShareTokenHash + AccessEvent
- 이전: 45, 48, 49, 59, 60
- 다음: 52, 54

|명령|목표 API|권한|저장|
|---|---|---|---|
|E51.createShare|POST /api/v2/emission/projects/{projectId}/report-download:createShare|emission.report-download.createShare|revision+idempotency+감사/outbox 원자 저장|
|E51.revokeShare|POST /api/v2/emission/projects/{projectId}/report-download:revokeShare|emission.report-download.revokeShare|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E51.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E51.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E51.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E51.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E51.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E51.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E51.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E51.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E51.T09|보고서·인증서 다운로드 항목·출력 연결|downloadRef, shareId, expiresAt, status 응답 키와 타입 확인; 52, 54번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=보고서·인증서 다운로드: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-051; QA=E51.T01, E51.T02, E51.T03, E51.T04, E51.T05, E51.T06, E51.T07, E51.T08, E51.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 52. 공개 진위 확인 — EMI-052

화면: [/home/certificate-verify](http://172.16.1.232/home/certificate-verify) · READ_ONLY · public 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|file|multipart-file|선택/행위별 조건부|server MIME+signature check; limits by endpoint; malware scan/quarantine where available|
|certificateId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|

- 조회: POST /api/v2/emission/public/public-verification:verify
- 조회 권한: PUBLIC_VERIFY
- 조회 출력: verdict, issuedAt, revokedAt, hashMatch, reasonCode
- 저장/조회 모델: CertificateLedger + PdfOriginal hashes
- 이전: 48, 49, 51, 53
- 다음: 결과 확인 후 종료/원래 업무 복귀

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E52.T01|정상 조회·진입|비로그인으로 검증 가능, 사내 상세 미노출|
|E52.T02|다른 회사/사업장 ID 직접 입력|공개 검증용 최소 항목만 제공|
|E52.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E52.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E52.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E52.T09|공개 진위 확인 항목·출력 연결|verdict, issuedAt, revokedAt, hashMatch, reasonCode 응답 키와 타입 확인; 종료/원래 화면 복귀; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=공개 진위 확인: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-052; QA=E52.T01, E52.T02, E52.T03, E52.T04, E52.T05, E52.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 53. 관리자 리포트 진위 확인 — EMI-053

화면: [/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|file|multipart-file|선택/행위별 조건부|server MIME+signature check; limits by endpoint; malware scan/quarantine where available|
|certificateId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|

- 조회: GET /api/v2/emission/company/verification-operations
- 조회 권한: emission.verification-operations.read
- 조회 출력: verdict, ledgerReference, reasonCode
- 저장/조회 모델: CertificateLedger audit view
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 49, 52

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E53.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E53.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E53.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E53.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E53.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E53.T09|관리자 리포트 진위 확인 항목·출력 연결|verdict, ledgerReference, reasonCode 응답 키와 타입 확인; 49, 52번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 리포트 진위 확인: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-053; QA=E53.T01, E53.T02, E53.T03, E53.T04, E53.T05, E53.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 54. 규제기관 제출 — EMI-054

화면: [/emission/report-submission](http://172.16.1.232/emission/report-submission) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lockedResultId|string|필수|opaque ID; existence+tenant+project/site authorization|
|reportIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|authority|string|필수|trim; length 1..240 if supplied|
|submissionType|string|필수|trim; length 1..240 if supplied|
|receiptNumber|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|receiptFileId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/regulatory-submission
- 조회 권한: emission.regulatory-submission.read
- 조회 출력: regulatorySubmissionId, status, receipt, history
- 저장/조회 모델: RegulatorySubmissionVersion + ReceiptEvidence
- 이전: 51, 55
- 다음: 55, 57

|명령|목표 API|권한|저장|
|---|---|---|---|
|E54.prepare|POST /api/v2/emission/projects/{projectId}/regulatory-submission:prepare|emission.regulatory-submission.prepare|revision+idempotency+감사/outbox 원자 저장|
|E54.recordSubmission|POST /api/v2/emission/projects/{projectId}/regulatory-submission:recordSubmission|emission.regulatory-submission.recordSubmission|revision+idempotency+감사/outbox 원자 저장|
|E54.recordReceipt|POST /api/v2/emission/projects/{projectId}/regulatory-submission:recordReceipt|emission.regulatory-submission.recordReceipt|revision+idempotency+감사/outbox 원자 저장|
|E54.recordReturn|POST /api/v2/emission/projects/{projectId}/regulatory-submission:recordReturn|emission.regulatory-submission.recordReturn|revision+idempotency+감사/outbox 원자 저장|
|E54.resubmit|POST /api/v2/emission/projects/{projectId}/regulatory-submission:resubmit|emission.regulatory-submission.resubmit|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E54.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E54.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E54.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E54.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E54.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E54.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E54.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E54.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E54.T09|규제기관 제출 항목·출력 연결|regulatorySubmissionId, status, receipt, history 응답 키와 타입 확인; 55, 57번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=규제기관 제출: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-054; QA=E54.T01, E54.T02, E54.T03, E54.T04, E54.T05, E54.T06, E54.T07, E54.T08, E54.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 55. 관리자 규제 제출 현황 — EMI-055

화면: [/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|authority|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/regulatory-operations
- 조회 권한: emission.regulatory-operations.read
- 조회 출력: submissions, receipts, errors, overdue
- 저장/조회 모델: RegulatorySubmission projections
- 이전: 7, 54
- 다음: 54, 57

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E55.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E55.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E55.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E55.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E55.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E55.T09|관리자 규제 제출 현황 항목·출력 연결|submissions, receipts, errors, overdue 응답 키와 타입 확인; 54, 57번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 규제 제출 현황: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-055; QA=E55.T01, E55.T02, E55.T03, E55.T04, E55.T05, E55.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 56. 배출 현황 대시보드 — EMI-056

화면: [/emission/index](http://172.16.1.232/emission/index) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectIds|array<id>|선택/행위별 조건부|unique; 1..100; authorize every referenced entity|
|siteIds|array<id>|선택/행위별 조건부|unique; 1..100; authorize every referenced entity|
|periodFrom|date|필수|ISO YYYY-MM-DD; start <= end|
|periodTo|date|필수|ISO YYYY-MM-DD; start <= end|
|resultStatus|string|필수|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/company/dashboard
- 조회 권한: emission.dashboard.read
- 조회 출력: totals, siteScopeTotals, unCalculatedCount, coverage, updatedAt
- 저장/조회 모델: LockedResult non-overlapping aggregates
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 1, 38

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E56.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E56.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E56.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E56.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E56.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E56.T09|배출 현황 대시보드 항목·출력 연결|totals, siteScopeTotals, unCalculatedCount, coverage, updatedAt 응답 키와 타입 확인; 1, 38번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=배출 현황 대시보드: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-056; QA=E56.T01, E56.T02, E56.T03, E56.T04, E56.T05, E56.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 57. 프로젝트 완료 — EMI-057

화면: [/emission/project-completion](http://172.16.1.232/emission/project-completion) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|revision|integer|필수|positive; optimistic locking|
|reason|string|선택/행위별 조건부|plain text <= 4000; no HTML execution; reason required for return/revoke/change|
|nextPeriodStart|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|nextPeriodEnd|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|

- 조회: GET /api/v2/emission/projects/{projectId}/project-close
- 조회 권한: emission.project-close.read
- 조회 출력: closeEventId, status, newProjectId
- 저장/조회 모델: ProjectCloseEvent + ReopenRequest
- 이전: 4, 54, 55, 58
- 다음: 1, 3

|명령|목표 API|권한|저장|
|---|---|---|---|
|E57.close|POST /api/v2/emission/projects/{projectId}/project-close:close|emission.project-close.close|revision+idempotency+감사/outbox 원자 저장|
|E57.requestReopen|POST /api/v2/emission/projects/{projectId}/project-close:requestReopen|emission.project-close.requestReopen|revision+idempotency+감사/outbox 원자 저장|
|E57.copyToNextPeriod|POST /api/v2/emission/projects/{projectId}/project-close:copyToNextPeriod|emission.project-close.copyToNextPeriod|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E57.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E57.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E57.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E57.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E57.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E57.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E57.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E57.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E57.T09|프로젝트 완료 항목·출력 연결|closeEventId, status, newProjectId 응답 키와 타입 확인; 1, 3번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=프로젝트 완료: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-057; QA=E57.T01, E57.T02, E57.T03, E57.T04, E57.T05, E57.T06, E57.T07, E57.T08, E57.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 58. 관리자 프로젝트 완료 관리 — EMI-058

화면: [/admin/emission/project-completion](http://172.16.1.232/admin/emission/project-completion) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|status|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/close-operations
- 조회 권한: emission.close-operations.read
- 조회 출력: projects, closeStatus, unresolvedItems, reopenHistory
- 저장/조회 모델: ReopenDecision
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 57

|명령|목표 API|권한|저장|
|---|---|---|---|
|E58.approveReopen|POST /api/v2/emission/company/close-operations:approveReopen|emission.close-operations.approveReopen|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E58.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E58.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E58.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E58.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E58.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E58.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E58.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E58.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E58.T09|관리자 프로젝트 완료 관리 항목·출력 연결|projects, closeStatus, unresolvedItems, reopenHistory 응답 키와 타입 확인; 57번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 프로젝트 완료 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-058; QA=E58.T01, E58.T02, E58.T03, E58.T04, E58.T05, E58.T06, E58.T07, E58.T08, E58.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 59. 다운로드·공유 이력 — EMI-059

화면: [/mypage/download-history](http://172.16.1.232/mypage/download-history) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|certificateId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|from|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|to|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/access-history
- 조회 권한: emission.access-history.read
- 조회 출력: ownAccessEvents, shareStatus
- 저장/조회 모델: OwnAccessEvent
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 51

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E59.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E59.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E59.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E59.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E59.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E59.T09|다운로드·공유 이력 항목·출력 연결|ownAccessEvents, shareStatus 응답 키와 타입 확인; 51번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=다운로드·공유 이력: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-059; QA=E59.T01, E59.T02, E59.T03, E59.T04, E59.T05, E59.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 60. 관리자 보고서 접근 이력 — EMI-060

화면: [/admin/emission/report-access-history](http://172.16.1.232/admin/emission/report-access-history) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|certificateId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|actorId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|from|date|필수|ISO YYYY-MM-DD; start <= end|
|to|date|필수|ISO YYYY-MM-DD; start <= end|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/access-audit
- 조회 권한: emission.access-audit.read
- 조회 출력: accessEvents, shareEvents
- 저장/조회 모델: TenantAccessEvent
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 49, 51

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E60.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E60.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E60.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E60.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E60.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E60.T09|관리자 보고서 접근 이력 항목·출력 연결|accessEvents, shareEvents 응답 키와 타입 확인; 49, 51번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=관리자 보고서 접근 이력: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-060; QA=E60.T01, E60.T02, E60.T03, E60.T04, E60.T05, E60.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 61. 데이터 변경 이력 — EMI-061

화면: [/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history) · READ_ONLY · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|entityType|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|entityId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|from|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|to|date|선택/행위별 조건부|ISO YYYY-MM-DD; start <= end|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/projects/{projectId}/data-history
- 조회 권한: emission.data-history.read
- 조회 출력: revisions, diff, actor, correlationId
- 저장/조회 모델: Revision + AuditEvent
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 22, 38

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E61.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E61.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E61.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E61.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E61.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E61.T09|데이터 변경 이력 항목·출력 연결|revisions, diff, actor, correlationId 응답 키와 타입 확인; 22, 38번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=데이터 변경 이력: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-061; QA=E61.T01, E61.T02, E61.T03, E61.T04, E61.T05, E61.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 62. 감사 로그 — EMI-062

화면: [/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|action|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|actorId|string|선택/행위별 조건부|opaque ID; existence+tenant+project/site authorization|
|result|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|from|date|필수|ISO YYYY-MM-DD; start <= end|
|to|date|필수|ISO YYYY-MM-DD; start <= end|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/audit
- 조회 권한: emission.audit.read
- 조회 출력: events, correlationId, targetVersions
- 저장/조회 모델: AuditEvent
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 4

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E62.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E62.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E62.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E62.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E62.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E62.T09|감사 로그 항목·출력 연결|events, correlationId, targetVersions 응답 키와 타입 확인; 4번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=감사 로그: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-062; QA=E62.T01, E62.T02, E62.T03, E62.T04, E62.T05, E62.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 63. LCI DB 조회 — EMI-063

화면: [/emission/lci](http://172.16.1.232/emission/lci) · READ_ONLY · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|keyword|string|필수|trim; length 1..240 if supplied|
|category|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|unit|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|databaseVersion|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|page|integer|필수|1..100000|
|pageSize|integer|필수|1..100|

- 조회: GET /api/v2/emission/company/lci-catalog
- 조회 권한: emission.lci-catalog.read
- 조회 출력: entries, source, unit, licenseStatus
- 저장/조회 모델: LicensedCatalogReference
- 이전: 64
- 다음: 13, 37

도메인 쓰기 명령 없음. 다운로드/검증/조회 감사·요청 제한은 별도 최소 기록.

|테스트|입력/상황|기대 결과|
|---|---|---|
|E63.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E63.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E63.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E63.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E63.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E63.T09|LCI DB 조회 항목·출력 연결|entries, source, unit, licenseStatus 응답 키와 타입 확인; 13, 37번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=LCI DB 조회: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-063; QA=E63.T01, E63.T02, E63.T03, E63.T04, E63.T05, E63.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 64. LCI 분류 관리 — EMI-064

화면: [/admin/emission/lci-classification](http://172.16.1.232/admin/emission/lci-classification) · WORKSPACE · company 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|code|string|필수|trim; length 1..240 if supplied|
|name|string|필수|trim; length 1..240 if supplied|
|parentCode|string|선택/행위별 조건부|trim; length 1..240 if supplied|
|effectiveFrom|date|필수|ISO YYYY-MM-DD; start <= end|
|version|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/company/lci-classification
- 조회 권한: emission.lci-classification.read
- 조회 출력: classificationVersionId, status
- 저장/조회 모델: LciClassificationVersion
- 이전: 메뉴 직접 진입; 문맥 선택 필요
- 다음: 63, 66

|명령|목표 API|권한|저장|
|---|---|---|---|
|E64.saveDraft|POST /api/v2/emission/company/lci-classification:saveDraft|emission.lci-classification.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E64.publish|POST /api/v2/emission/company/lci-classification:publish|emission.lci-classification.publish|revision+idempotency+감사/outbox 원자 저장|
|E64.retire|POST /api/v2/emission/company/lci-classification:retire|emission.lci-classification.retire|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E64.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E64.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E64.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E64.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E64.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E64.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E64.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E64.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E64.T09|LCI 분류 관리 항목·출력 연결|classificationVersionId, status 응답 키와 타입 확인; 63, 66번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=LCI 분류 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-064; QA=E64.T01, E64.T02, E64.T03, E64.T04, E64.T05, E64.T06, E64.T07, E64.T08, E64.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 65. LCA 분석 — EMI-065

화면: [/emission/lca](http://172.16.1.232/emission/lca) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lcaProjectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|productId|string|필수|opaque ID; existence+tenant+project/site authorization|
|functionalUnit|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|systemBoundary|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|datasetVersion|string|필수|trim; length 1..240 if supplied|

- 조회: GET /api/v2/emission/projects/{projectId}/lca-analysis
- 조회 권한: emission.lca-analysis.read
- 조회 출력: lcaRunId, impactResults, methodVersion
- 저장/조회 모델: LcaRunSnapshot
- 이전: 66, 67, 68
- 다음: 68

|명령|목표 API|권한|저장|
|---|---|---|---|
|E65.run|POST /api/v2/emission/projects/{projectId}/lca-analysis:run|emission.lca-analysis.run|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E65.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E65.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E65.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E65.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E65.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E65.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E65.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E65.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E65.T09|LCA 분석 항목·출력 연결|lcaRunId, impactResults, methodVersion 응답 키와 타입 확인; 68번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=LCA 분석: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-065; QA=E65.T01, E65.T02, E65.T03, E65.T04, E65.T05, E65.T06, E65.T07, E65.T08, E65.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 66. 설문·제품 데이터 관리 — EMI-066

화면: [/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lcaProjectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|productId|string|필수|opaque ID; existence+tenant+project/site authorization|
|processIds|array<id>|필수|unique; 1..100; authorize every referenced entity|
|surveyVersion|string|필수|trim; length 1..240 if supplied|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/survey-project
- 조회 권한: emission.survey-project.read
- 조회 출력: surveyId, version, status
- 저장/조회 모델: SurveyRevision
- 이전: 64, 67
- 다음: 67, 65

|명령|목표 API|권한|저장|
|---|---|---|---|
|E66.saveDraft|POST /api/v2/emission/projects/{projectId}/survey-project:saveDraft|emission.survey-project.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E66.submit|POST /api/v2/emission/projects/{projectId}/survey-project:submit|emission.survey-project.submit|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E66.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E66.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E66.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E66.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E66.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E66.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E66.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E66.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E66.T09|설문·제품 데이터 관리 항목·출력 연결|surveyId, version, status 응답 키와 타입 확인; 67, 65번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=설문·제품 데이터 관리: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-066; QA=E66.T01, E66.T02, E66.T03, E66.T04, E66.T05, E66.T06, E66.T07, E66.T08, E66.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 67. 설문 업로드 데이터 — EMI-067

화면: [/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lcaProjectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|surveyId|string|필수|opaque ID; existence+tenant+project/site authorization|
|file|multipart-file|필수|server MIME+signature check; limits by endpoint; malware scan/quarantine where available|
|columnMapping|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/survey-dataset
- 조회 권한: emission.survey-dataset.read
- 조회 출력: datasetId, version, errors, hash
- 저장/조회 모델: SurveyDatasetVersion
- 이전: 66
- 다음: 66, 65

|명령|목표 API|권한|저장|
|---|---|---|---|
|E67.preview|POST /api/v2/emission/projects/{projectId}/survey-dataset:preview|emission.survey-dataset.preview|도메인 변경 없음; 비용성 검사는 로그/제한|
|E67.validate|POST /api/v2/emission/projects/{projectId}/survey-dataset:validate|emission.survey-dataset.validate|도메인 변경 없음; 비용성 검사는 로그/제한|
|E67.commit|POST /api/v2/emission/projects/{projectId}/survey-dataset:commit|emission.survey-dataset.commit|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E67.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E67.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E67.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E67.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E67.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E67.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E67.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E67.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E67.T09|설문 업로드 데이터 항목·출력 연결|datasetId, version, errors, hash 응답 키와 타입 확인; 66, 65번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=설문 업로드 데이터: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-067; QA=E67.T01, E67.T02, E67.T03, E67.T04, E67.T05, E67.T06, E67.T07, E67.T08, E67.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 68. LCA 요약보고서 출력 — EMI-068

화면: [/admin/emission/survey-report-lca-summary](http://172.16.1.232/admin/emission/survey-report-lca-summary) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lcaProjectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lcaRunId|string|필수|opaque ID; existence+tenant+project/site authorization|
|templateVersionId|string|필수|opaque ID; existence+tenant+project/site authorization|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/lca-report
- 조회 권한: emission.lca-report.read
- 조회 출력: lcaReportId, pdfHash, status
- 저장/조회 모델: LcaReportOriginal
- 이전: 65
- 다음: 65

|명령|목표 API|권한|저장|
|---|---|---|---|
|E68.preview|POST /api/v2/emission/projects/{projectId}/lca-report:preview|emission.lca-report.preview|도메인 변경 없음; 비용성 검사는 로그/제한|
|E68.issue|POST /api/v2/emission/projects/{projectId}/lca-report:issue|emission.lca-report.issue|revision+idempotency+감사/outbox 원자 저장|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E68.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E68.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E68.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E68.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E68.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E68.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E68.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E68.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E68.T09|LCA 요약보고서 출력 항목·출력 연결|lcaReportId, pdfHash, status 응답 키와 타입 확인; 65번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=LCA 요약보고서 출력: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-068; QA=E68.T01, E68.T02, E68.T03, E68.T04, E68.T05, E68.T06, E68.T07, E68.T08, E68.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 69. 감축 시나리오 — EMI-069

화면: [/emission/reduction](http://172.16.1.232/emission/reduction) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|lockedResultId|string|필수|opaque ID; existence+tenant+project/site authorization|
|scenarioName|string|필수|trim; length 1..240 if supplied|
|measures|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|assumptions|object/array|필수|validate against aggregate JSON Schema; reject unknown executable expressions|
|revision|integer|필수|positive; optimistic locking|

- 조회: GET /api/v2/emission/projects/{projectId}/reduction-scenario
- 조회 권한: emission.reduction-scenario.read
- 조회 출력: scenarioId, baselineRef, estimatedReduction, assumptions
- 저장/조회 모델: ReductionScenarioRevision
- 이전: 70
- 다음: 70

|명령|목표 API|권한|저장|
|---|---|---|---|
|E69.saveDraft|POST /api/v2/emission/projects/{projectId}/reduction-scenario:saveDraft|emission.reduction-scenario.saveDraft|revision+idempotency+감사/outbox 원자 저장|
|E69.compare|POST /api/v2/emission/projects/{projectId}/reduction-scenario:compare|emission.reduction-scenario.compare|도메인 변경 없음; 비용성 검사는 로그/제한|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E69.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E69.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E69.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E69.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E69.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E69.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E69.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E69.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E69.T09|감축 시나리오 항목·출력 연결|scenarioId, baselineRef, estimatedReduction, assumptions 응답 키와 타입 확인; 70번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=감축 시나리오: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-069; QA=E69.T01, E69.T02, E69.T03, E69.T04, E69.T05, E69.T06, E69.T07, E69.T08, E69.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

### 70. 감축 전략 시뮬레이션 — EMI-070

화면: [/emission/simulate](http://172.16.1.232/emission/simulate) · WORKSPACE · project 문맥

|입력 코드|타입|필수|검사|
|---|---|---|---|
|projectId|string|필수|opaque ID; existence+tenant+project/site authorization|
|scenarioId|string|필수|opaque ID; existence+tenant+project/site authorization|
|scenarioRevision|integer|필수|positive; optimistic locking|
|idempotencyKey|string|필수|UUID; same key+same payload => same result; different payload =>409|

- 조회: GET /api/v2/emission/projects/{projectId}/reduction-simulation
- 조회 권한: emission.reduction-simulation.read
- 조회 출력: simulationId, estimatedResults, sensitivity, assumptions
- 저장/조회 모델: ReductionSimulationRun
- 이전: 69
- 다음: 69

|명령|목표 API|권한|저장|
|---|---|---|---|
|E70.run|POST /api/v2/emission/projects/{projectId}/reduction-simulation:run|emission.reduction-simulation.run|revision+idempotency+감사/outbox 원자 저장|
|E70.compare|POST /api/v2/emission/projects/{projectId}/reduction-simulation:compare|emission.reduction-simulation.compare|도메인 변경 없음; 비용성 검사는 로그/제한|

|테스트|입력/상황|기대 결과|
|---|---|---|
|E70.T01|정상 조회·진입|권한 있는 계정의 올바른 문맥만 조회|
|E70.T02|다른 회사/사업장 ID 직접 입력|403 또는 정보 노출 없는404, 데이터 변경0|
|E70.T03|필수 입력 누락·형식 오류|400/422, 필드 오류·입력 유지, 저장0|
|E70.T04|새로고침·뒤로가기·다음화면|동일 project/site/version 유지; 문맥 없는 메뉴는 선택 단계|
|E70.T05|빈 목록·네트워크 실패·로딩|각각 구분; 가짜 데이터/0/완료 표시 금지|
|E70.T06|저장·재조회·동일요청 재전송|동일 결과 ID, 중복 저장0, revision 일치|
|E70.T07|동시 수정/선행 버전 변경|409 또는 stale 처리; 기존 확정본 보존|
|E70.T08|권한 없는 실행 및 감사|거절; 허용 실행은 실제 계정/action/target/version 기록|
|E70.T09|감축 전략 시뮬레이션 항목·출력 연결|simulationId, estimatedResults, sensitivity, assumptions 응답 키와 타입 확인; 69번에 같은 문맥 전달; 화면 항목과 실제 저장/조회 일치|

안내 동기화: 도움말=감축 전략 시뮬레이션: 필드 의미·필수조건·예시·오류 해결; 화면설계=EMI-070; QA=E70.T01, E70.T02, E70.T03, E70.T04, E70.T05, E70.T06, E70.T07, E70.T08, E70.T09; 길잡이=현재 화면의 실제 허용 작업; 전체업무보기=번호/분기/nextAction.

현재 판정: 설계됨 / 구현·실행 검증 전.

## 9. 화면별 조건부 필수 및 특별 규칙

- 21 요청 create는 assigneeIds/dueAt 필수. remind/cancel은 requestId+revision 및 필요 사유를 받으며 원래 전체 요청내용 재전송 불필요.
- 22 update는 activityId+revision, deleteDraft는 참조 없는 draft만 가능. submit은 개별행 revision 목록을 고정하여 snapshot 생성.
- 24 preview는 file, validate/commit은 서버가 반환한 importToken+mappingRevision+site/sourceMapping을 받는다. commit은 검증한 같은 파일hash만 허용.
- 25 증빙 upload는 활동자료 이전에도 가능하지만 제출할 때는 activityId에 연결. unlink는 제출된 증빙 snapshot을 제거하지 않는다.
- 37 run은 확정 boundaryVersion과 acceptedSubmissionIds를 고정. 잠금 이후 run은 승인된 변경 절차에 따른 새 버전만 허용.
- 42 requestReview에는 decision을 요구하지 않고 reviewer/approver 지정 정책을 적용. approve/return은 reviewId+revision+comment 필수. 화면 필드 합집합을 모든 명령의 필수 body로 사용하지 않는다.
- 49 revoke는 certificateId+reason+revision 필수. reissue는 기존 인증서와 변경 근거를 연결하고 독립 발급ID 생성.
- 51 공유는 인증 문서 접근 권한이 있는 사용자만 생성. 토큰 원문 대신 hash 저장; 만료/취소/수신범위 검사.
- 52/53은 file 또는 certificateId 중 최소 하나 필수. 둘 다 있으면 지정 문서와의 일치 검사. 서버 장애는 확인불가이지 위조 확정이 아니다.
- 54 수동 제출은 제출시각/문서/근거 필수; 접수 기록은 접수번호/접수증 필수. 외부기관 자동 API가 없으면 수동 기록이라고 명시.
- 56 여러 프로젝트를 합칠 때 기간·사업장·범위 중복을 탐지한다. 중복 프로젝트 결과를 그냥 합산하지 않는다.
- 57 copy는 사업장/배출원/기준 템플릿 복사 가능, 활동량·승인·발급 상태 복사 금지. 새 기간에서 비활성/만료 기준 재검사.
- 63~70은 제품 LCA/감축의 독립 context가 추가로 필요하다. company inventory의 projectId와 lcaProjectId/scenarioId를 혼동하지 않는다.

## 10. 관리자 공용 화면 menuCode 분기

A103 프로젝트 운영의 여러 메뉴는 각각 독립 데이터필터·컬럼·허용 action을 가진 workspace 정의로 등록한다. 같은 컴포넌트를 재사용해도 menuCode가 다른데 제목만 바뀌고 기능은 같아서는 안 된다. unknown menuCode는 명시 오류/기본 목록으로 처리하며 다른 회사 전체 데이터를 보여주지 않는다.

- 프로젝트 상세/진행/마감: Project/Task projections.
- 제출 현황/업로드/증빙/외부 연계: Request/Import/Evidence/Connection projections.
- 검증 대기/보완/승인/반려/이력: Review/Correction/Approval projections.
- 결과/보고/인증/진위: Calculation/Report/Certificate projections.
- 변경을 수행하는 버튼은 원래 도메인 명령으로 이동/호출한다. 운영 목록용 우회 승인 API 금지.

## 11. KRDS 디자인·상호작용

모든 페이지: 헤더/브레드크럼브/제목/설명→프로젝트·사업장 문맥바→폼 또는 표→행동영역→이력·도움. 흰 배경, 공통 간격·색상·타이포·버튼 토큰을 사용한다. 회사/프로젝트/사업장은 보이되 식별자를 기술 문구로 과다 노출하지 않는다.

목록: 검색 한 줄+상태 필터+건수+페이지 이동, 체크박스 일괄선택은 현재 검색결과 범위를 표시. 폼: 필수 표시·필드별 오류·저장중 중복클릭 차단·나가기 미저장 경고. 결과: 합계와 근거 테이블; 미산정과0 구분. 키보드/스크린리더 라벨·포커스 복귀·좁은 화면 표 스크롤 확인. 자동 채움은 출처와 수정가능 여부 표시.

도움말/화면설계/QA/길잡이/전체업무보기는 designId+version을 공통으로 참조한다. 화면 설계에는 대상 화면 설명만 표시하고 현재 선택된 타 프로세스 내용을 섞지 않는다. 운영 사용자에게 QA 계정·SQL·내부 비밀을 노출하지 않는다.

## 12. 프로세스 수용 테스트

|ID|목적|시험 입력|순서|성공 기준|
|---|---|---|---|---|
|P01|회사 준비|같은 회사 A/B 활성 사업장, 다른 회사 C, 조회/입력/계산/승인 권한|01→02→03→04|REGISTERED; 선택한 2개 사업장·기간 재조회; 담당자 없이 등록|
|P02|사업장 귀속|A/B 각각 같은 달 구매전력, 서로 다른 양, 동일 단위|11→22/24→33→35|사업장 간 중복 없음; 제출본에 site/source/Scope 보존|
|P03|계산 재현|A=1000kWh B=2000kWh; 테스트 전용 CO2e 계수 0.5kg/kWh|37→38|A=0.5t, B=1t, 합계1.5t; 테스트값임을 표시; GWP 중복 적용 없음|
|P04|반려/버전|계산 v1 검토 중 A 원자료 수정|42→36→22→33→35→37→42|v1 불변, 새 제출/계산 생성, 새 버전만 승인|
|P05|발급/진위|승인된 같은 결과/기간/사업장|43→45→48→51→52|PDF 원본과 원장 hash 일치; 변조/취소/미등록 구분|
|P06|직접진입/권한|다른 회사 siteId, 없는 ID, 만료 세션, 동시 수정|모든70항목|무권한 데이터 변경0; 올바른 오류; 문맥 없는 진입은 선택 화면|
|P07|마감/차기|규제 제출 미적용 프로젝트|57→03|마감 가능; 차기 기간·기준은 재검토, 과거 활동량/승인 결과 미복사|
|P08|기준정보 변경|기존계산에 사용한 계수 retired 후 새계수 publish|13→37→38|과거 결과의 계수 버전/값 불변; 새 run만 새 기준 선택|

테스트는 fixture/정적검사/API/DB 재조회/브라우저/액터 릴레이를 구분한다. 모든 성공건에 입력·출력·버전·계정·화면·correlationId·스크린샷을 기록하고 사용자가 승인한 후 완료 상태로 올린다. 최소 2개 사업장·2개 회사·권한별 계정으로 음성 테스트를 포함한다.

## 13. 성능·용량·운영

목록 서버 페이지네이션(최대100), 키셋/필터 인덱스 우선. 주요 복합 인덱스: tenant/project/site/period/status, submission/version, calculation/version, certificate/hash. 실제 EXPLAIN으로 검증 후 적용한다. 70화면 전체 검증 10분·배포1분은 목표이며 측정 전 달성 주장 금지.

문서/증빙은 원본hash 기반 중복 관리하되 참조/회사 권한을 보존한다. DB에 대용량 원본을 계속 쌓을지 object storage 경로를 쓸지는 현재 배포에 맞춰 결정한다. 보관정책 확정 전 승인본·발급본 자동 삭제 금지. 임시 업로드 만료와 실패 작업 정리는 보존 참조가 없는 경우만 수행한다. 감사는 함수명/operationId/actor/target/version/결과를 저장하고 원문 파일·개인정보·토큰을 중복 기록하지 않는다.

## 14. 마이그레이션·호환·복구

1. 현 DB·원본파일 백업 및 건수·금액 아닌 배출 합계·hash 기록.
2. site/source/Scope snapshot 컬럼은 우선 nullable로 추가하고 신규 제출부터 필수 저장. 과거 귀속은 확실한 FK 근거로만 보강.
3. 귀속 불명 과거건은 UNRESOLVED로 남기고 확정 보고에 섞지 않는다. 임의 siteId 추정 금지.
4. 기존 이름 기반 사업장 API를 ID 기반 DTO 어댑터로 변환, 잘못된/중복 이름이면 사용자 선택.
5. 읽기 호환 → 신규쓰기 후보 검증 → 인증 E2E → 승인된 런타임 전환. 기존 pending 업무 task ID와 과거 승인본 보존.
6. 단계별 feature flag/계약 버전으로 전환. 실패 시 검증된 소스+스키마 호환 상태로 되돌리며 사용자 새 데이터는 삭제하지 않는다.

## 15. 설계 승인 전 남은 정책

|정책|기본 제안|확정 전 처리|
|---|---|---|
|회사 공개 범위|탄소배출 조회 권한자에게 공유|모든 직원 무조건 공개 안 함|
|검토·자기승인|발행된 정책으로 제한, 실제 처리자 기록|법적 의무라고 단정하지 않음|
|부분월 산정|일별자료 또는 근거 있는 배분|월합계 자동 포함 금지|
|Scope2 산정 방식/복수 방식|적용 방법론 버전별 결과 분리|한 결과로 혼합하지 않음|
|보고 표준/법정 제출|프로젝트 범위설정에서 선택|RFP/기관별 양식 대조 필요|
|보관 기간/공유 만료|운영 정책으로 확정|임의 자동삭제 금지|
|별도 LCA/감축 범위|연계만 유지|기업 배출 업무 필수 아님|

## 16. 구현 진입 조건

이 설계는 화면별 상세 계약의 기준판이다. 정책 미확정 사항은 별도 결정 기록에 남기고 해당 기능의 배포를 차단한다. 개발은 01~04 수직 흐름부터 진행하고, 22~38 진입 전에 B02~B04 snapshot/SQL/중복 정책을 함께 구현한다. 한 페이지의 완료는 다음 페이지의 입력 재현까지 검증한 경우에만 가능하다.

원씽: 사업장·원자료·기준·결과·발급 원본의 **버전 계보**를 끝까지 유지한다. 깨달음: 화면 수를 채우는 것과 업무가 끝까지 이어지는 것은 다르므로, 페이지와 인계 구간을 함께 완료 단위로 삼는다.
