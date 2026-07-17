# EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

## Purpose and completion condition

검토자와 승인자가 확정 결과를 독립적으로 검토하고 승인한다.

## ADMIN screen contract: 검토·승인·확정 관리자 업무 화면

- Route: `/admin/emission/approval-workflow`
- Responsible actor: `APPROVER`
- Business purpose: 검증 완료 결과를 업무분리 원칙에 따라 검토·승인 또는 반려하고 확정 산정 버전을 잠근다.
- Entry condition: 프로젝트가 VERIFIED이고 승인선, 승인권자, 검토 대상 버전과 검증 증적이 존재한다.
- Completion condition: 권한 있는 승인자의 전자결정과 의견이 저장되고 승인 시 APPROVED 버전이 변경 불가로 확정된다.

### Layout, fields, and commands

- KPI: ["승인대기 건수","평균 처리시간","반려 건수","기한초과 건수"]
- Sections: ["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]
- Fields: ["확정 후보 버전","총 배출량","Scope별 결과","검증 결과","검토 의견","승인자","결정일시","반려사유"]
- Commands and navigation: ["검토 완료","승인","반려","추가자료 요청","결과 비교","보고 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/approval","POST /home/api/emission-projects/{id}/approval/approve","POST /home/api/emission-projects/{id}/approval/reject","GET /home/api/emission-projects/{id}/approval/history"]
- Database entities: ["emission_project_approval","emission_project_submission","emission_project_calculation","framework_process_execution_event"]
- Audit and evidence: ["승인자만 승인","자기승인 차단","반려사유 필수","확정 버전 잠금","동시 승인 충돌"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 검토·승인·확정 사용자 업무 화면

- Route: `/emission/validate?tab=approval`
- Responsible actor: `APPROVER`
- Business purpose: 검증 완료 결과를 업무분리 원칙에 따라 검토·승인 또는 반려하고 확정 산정 버전을 잠근다.
- Entry condition: 프로젝트가 VERIFIED이고 승인선, 승인권자, 검토 대상 버전과 검증 증적이 존재한다.
- Completion condition: 권한 있는 승인자의 전자결정과 의견이 저장되고 승인 시 APPROVED 버전이 변경 불가로 확정된다.

### Layout, fields, and commands

- KPI: ["승인대기 건수","평균 처리시간","반려 건수","기한초과 건수"]
- Sections: ["승인 요약","산정·검증 결과","주요 변동","증빙 표본","검토 의견","결정 이력"]
- Fields: ["확정 후보 버전","총 배출량","Scope별 결과","검증 결과","검토 의견","승인자","결정일시","반려사유"]
- Commands and navigation: ["검토 완료","승인","반려","추가자료 요청","결과 비교","보고 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/approval","POST /home/api/emission-projects/{id}/approval/approve","POST /home/api/emission-projects/{id}/approval/reject","GET /home/api/emission-projects/{id}/approval/history"]
- Database entities: ["emission_project_approval","emission_project_submission","emission_project_calculation","framework_process_execution_event"]
- Audit and evidence: ["승인자만 승인","자기승인 차단","반려사유 필수","확정 버전 잠금","동시 승인 충돌"]
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
