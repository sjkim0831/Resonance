# EMISSION_PROJECT / EMISSION_PROJECT_SETUP

## Purpose and completion condition

프로젝트 범위, 조직 경계, 담당 액터, 일정과 책임을 확정한다.

## ADMIN screen contract: 배출량 프로젝트 운영

- Route: `/admin/emission/project-operations`
- Responsible actor: `COMPANY_MANAGER`
- Business purpose: 조직경계, 산정기간, Scope, 적용 기준, 책임 액터와 단계별 마감을 확정하여 자료 수집을 시작한다.
- Entry condition: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
- Completion condition: 필수 설정이 버전으로 저장되고 업무분리가 검증되며 프로젝트가 PLANNED 상태로 전이된다.

### Layout, fields, and commands

- KPI: ["설정완료율","미배정 액터 수","기한 미설정 수"]
- Sections: ["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]
- Fields: ["프로젝트명","보고목적","산정기간","조직·사업장","경계방법","Scope 1·2·3","Scope 2 방식","GWP 버전","배출계수 버전","책임자","단계별 마감"]
- Commands and navigation: ["임시저장","설정 검증","프로젝트 시작","사업장 관리","권한 관리","다음 업무 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}","POST /home/api/emission-projects","PUT /home/api/emission-projects/{id}/settings","POST /home/api/emission-projects/{id}/start"]
- Database entities: ["emission_project_registry","emission_project_site","emission_project_task","framework_account_actor_assignment","framework_process_execution"]
- Audit and evidence: ["필수값 검증","업무분리 403","교차 테넌트 차단","중복 생성 멱등성","설정 버전 및 감사로그"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 프로젝트 기본정보 및 책임 확정 사용자 업무 화면

- Route: `/emission/project/create`
- Responsible actor: `COMPANY_MANAGER`
- Business purpose: 조직경계, 산정기간, Scope, 적용 기준, 책임 액터와 단계별 마감을 확정하여 자료 수집을 시작한다.
- Entry condition: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
- Completion condition: 필수 설정이 버전으로 저장되고 업무분리가 검증되며 프로젝트가 PLANNED 상태로 전이된다.

### Layout, fields, and commands

- KPI: ["설정완료율","미배정 액터 수","기한 미설정 수"]
- Sections: ["업무 요약","기본정보","조직·운영경계","Scope·방법론","액터·마감","검토·시작"]
- Fields: ["프로젝트명","보고목적","산정기간","조직·사업장","경계방법","Scope 1·2·3","Scope 2 방식","GWP 버전","배출계수 버전","책임자","단계별 마감"]
- Commands and navigation: ["임시저장","설정 검증","프로젝트 시작","사업장 관리","권한 관리","다음 업무 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}","POST /home/api/emission-projects","PUT /home/api/emission-projects/{id}/settings","POST /home/api/emission-projects/{id}/start"]
- Database entities: ["emission_project_registry","emission_project_site","emission_project_task","framework_account_actor_assignment","framework_process_execution"]
- Audit and evidence: ["필수값 검증","업무분리 403","교차 테넌트 차단","중복 생성 멱등성","설정 버전 및 감사로그"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## State transition and concurrency rules

- The server validates tenantId, projectId, actorCode, commandCode, current state, and version before every transition.
- Repeated commands use an idempotency key and return the existing result without duplicating data or workflow events.
- Conflicting edits return a version conflict, preserve both audit contexts, and require the actor to reload before retrying.
- Completion opens only the next process task; rejection or correction follows the explicitly designed branch and never skips a required actor.

## Executable scenario matrix

- HAPPY_PATH: an authorized actor completes the entry conditions, executes the command, stores evidence, reaches the expected state, and opens the next task once.
- EXCEPTION: missing fields, invalid units, stale versions, and downstream failures remain on the current task with actionable errors and no partial commit.
- AUTHORITY: an actor without the required role receives 403; a forbidden attempt is recorded without changing business data.
- ISOLATION: another tenant or project cannot discover, search, update, export, or infer the protected object.
- RECOVERY: retry after a transaction, integration, or report failure produces no duplicate version, event, notification, or file.

## Frontend, backend, and integration delivery checklist

- Frontend implements the selected KRDS layout, all required states, responsive behavior, keyboard access, direct links, and next-task navigation.
- Backend implements the listed API and database contracts with transaction boundaries, object-level authorization, idempotency, optimistic locking, and immutable audit evidence.
- Contract tests bind every command to its actor and state transition. Browser tests cover both user and administrator routes at mobile, tablet, and desktop widths.
- Integration is complete only when the UI payload, API schema, persisted version, process event, notification, and displayed next task agree.
