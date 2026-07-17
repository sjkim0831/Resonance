# EMISSION_PROJECT / EMISSION_PROJECT_VALIDATE

## Purpose and completion condition

입력·산정·증빙의 완전성, 정확성, 일관성과 이상치를 검증한다.

## ADMIN screen contract: 데이터·산정 결과 검증 관리자 업무 화면

- Route: `/admin/emission/validate`
- Responsible actor: `VERIFIER`
- Business purpose: 활동자료, 증빙, 계수와 산정 결과의 완전성·정확성·일관성을 규칙 기반으로 독립 검증한다.
- Entry condition: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
- Completion condition: 차단 오류가 0건이면 VERIFIED, 오류가 있으면 근거·담당자·기한을 포함하여 CORRECTION_REQUIRED로 전이된다.

### Layout, fields, and commands

- KPI: ["검증진행률","차단오류 수","경고 수","재검증 대기 수"]
- Sections: ["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]
- Fields: ["규칙","대상 위치","심각도","기대값","실제값","근거","담당자","기한","조치상태"]
- Commands and navigation: ["검증 실행","오류 확인","보완 요청","검증 통과","재검증","산정근거 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/validation","POST /home/api/emission-projects/{id}/validation/run","POST /home/api/emission-projects/{id}/corrections","POST /home/api/emission-projects/{id}/validation/complete"]
- Database entities: ["emission_validation_rule","emission_project_validation_run","emission_project_quality_issue","emission_project_submission"]
- Audit and evidence: ["필수·이상치·중복·단위·계수 검증","검증자 권한","오류 0건 통과","규칙 버전 재현","보완 분기"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 데이터·산정 결과 검증 사용자 업무 화면

- Route: `/emission/validate`
- Responsible actor: `VERIFIER`
- Business purpose: 활동자료, 증빙, 계수와 산정 결과의 완전성·정확성·일관성을 규칙 기반으로 독립 검증한다.
- Entry condition: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
- Completion condition: 차단 오류가 0건이면 VERIFIED, 오류가 있으면 근거·담당자·기한을 포함하여 CORRECTION_REQUIRED로 전이된다.

### Layout, fields, and commands

- KPI: ["검증진행률","차단오류 수","경고 수","재검증 대기 수"]
- Sections: ["검증 요약","규칙 실행","오류 목록","증빙·계산 근거","보완 요청","검증 이력"]
- Fields: ["규칙","대상 위치","심각도","기대값","실제값","근거","담당자","기한","조치상태"]
- Commands and navigation: ["검증 실행","오류 확인","보완 요청","검증 통과","재검증","산정근거 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/validation","POST /home/api/emission-projects/{id}/validation/run","POST /home/api/emission-projects/{id}/corrections","POST /home/api/emission-projects/{id}/validation/complete"]
- Database entities: ["emission_validation_rule","emission_project_validation_run","emission_project_quality_issue","emission_project_submission"]
- Audit and evidence: ["필수·이상치·중복·단위·계수 검증","검증자 권한","오류 0건 통과","규칙 버전 재현","보완 분기"]
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
