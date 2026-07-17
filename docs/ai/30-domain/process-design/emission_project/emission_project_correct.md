# EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

## Purpose and completion condition

검증 결과의 보완 요청을 처리하고 영향 범위를 재산정·재검증한다.

## ADMIN screen contract: 보완·재산정 관리자 업무 화면

- Route: `/admin/emission/validate`
- Responsible actor: `SITE_DATA_OWNER`
- Business purpose: 검증 오류별 원인과 영향 범위를 확인하고 자료 수정, 재산정, 재검증을 통해 보완을 종결한다.
- Entry condition: 프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.
- Completion condition: 모든 보완 요청에 전후 값·사유·증빙이 보존되고 영향 범위 재산정 후 재검증 단계로 복귀한다.

### Layout, fields, and commands

- KPI: ["보완완료율","기한초과 보완 수","재발 오류 수","영향 배출량"]
- Sections: ["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]
- Fields: ["오류번호","검증의견","수정 전 값","수정 후 값","변경사유","대체 증빙","영향 항목","재산정 버전","재검증 상태"]
- Commands and navigation: ["수정 저장","증빙 교체","영향 분석","재산정","재제출","검증 화면 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/corrections","PUT /home/api/emission-projects/{id}/activities/{activityId}","POST /home/api/emission-projects/{id}/recalculate","POST /home/api/emission-projects/{id}/resubmit"]
- Database entities: ["emission_project_quality_issue","emission_project_activity_revision","emission_project_calculation","emission_project_submission"]
- Audit and evidence: ["전후 값 보존","사유 필수","영향 범위 재산정","중복 재제출 방지","재검증 상태 전이"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 보완·재산정 사용자 업무 화면

- Route: `/emission/data_input?mode=correction`
- Responsible actor: `SITE_DATA_OWNER`
- Business purpose: 검증 오류별 원인과 영향 범위를 확인하고 자료 수정, 재산정, 재검증을 통해 보완을 종결한다.
- Entry condition: 프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.
- Completion condition: 모든 보완 요청에 전후 값·사유·증빙이 보존되고 영향 범위 재산정 후 재검증 단계로 복귀한다.

### Layout, fields, and commands

- KPI: ["보완완료율","기한초과 보완 수","재발 오류 수","영향 배출량"]
- Sections: ["보완 요약","검증 의견","원자료 수정","영향 범위","재산정 결과","재제출 이력"]
- Fields: ["오류번호","검증의견","수정 전 값","수정 후 값","변경사유","대체 증빙","영향 항목","재산정 버전","재검증 상태"]
- Commands and navigation: ["수정 저장","증빙 교체","영향 분석","재산정","재제출","검증 화면 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/corrections","PUT /home/api/emission-projects/{id}/activities/{activityId}","POST /home/api/emission-projects/{id}/recalculate","POST /home/api/emission-projects/{id}/resubmit"]
- Database entities: ["emission_project_quality_issue","emission_project_activity_revision","emission_project_calculation","emission_project_submission"]
- Audit and evidence: ["전후 값 보존","사유 필수","영향 범위 재산정","중복 재제출 방지","재검증 상태 전이"]
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
