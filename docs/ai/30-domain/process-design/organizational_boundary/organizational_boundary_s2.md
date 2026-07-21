# ORGANIZATIONAL_BOUNDARY / ORGANIZATIONAL_BOUNDARY_S2

## Purpose and completion condition

경계 기준·포함 여부 판정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.

## ADMIN screen contract: 경계 기준·포함 여부 판정

- Route: `/admin/emission/organizational-boundary`
- Responsible actor: `COMPANY_MANAGER`
- Business purpose: 경계 기준·포함 여부 판정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Entry condition: STEP_1_COMPLETED
- Completion condition: 경계 기준·포함 여부 판정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.

### Layout, fields, and commands

- KPI: ["includedEntityCount","excludedEntityCount","grossEmission","eliminatedEmission","netEmission","reconciliationDifference"]
- Sections: ["workflowSummary","boundaryVersion","entityRegister","inclusionDecision","eliminationLedger","consolidationResult","approvalHistory"]
- Fields: ["boundaryMethod","reportingBasis","effectiveFrom","effectiveUntil","entityCode","entityName","entityType","countryCode","ownershipPercent","controlType","includedYn","exclusionReason","evidenceRef","grossEmission","eliminatedEmission","netEmission","reviewComment"]
- Commands and navigation: ["saveDraft","markReviewReady","runConsolidation","approve","reject","viewHistory","continueGuide"]
- Required UI states: ["LOADING","EMPTY","EDITING","VALIDATION_ERROR","FORBIDDEN","CONFLICT","READY","LOCKED"]

### API, transaction, and data contract

- API: ["PUT /home/api/emission-projects/{id}/organizational-boundary","POST /home/api/emission-projects/{id}/organizational-boundary/review-ready"]
- Database entities: ["emission_organizational_boundary","emission_organizational_boundary_member","emission_organizational_boundary_elimination","emission_organizational_boundary_consolidation","framework_process_execution_event"]
- Audit and evidence: ["ownershipEvidence","controlEvidence","exclusionReason","internalTransactionEvidence","approvalAudit"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 경계 기준·포함 여부 판정

- Route: `/emission/organizational-boundary`
- Responsible actor: `COMPANY_MANAGER`
- Business purpose: 경계 기준·포함 여부 판정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Entry condition: STEP_1_COMPLETED
- Completion condition: 경계 기준·포함 여부 판정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.

### Layout, fields, and commands

- KPI: ["includedEntityCount","excludedEntityCount","grossEmission","eliminatedEmission","netEmission","reconciliationDifference"]
- Sections: ["workflowSummary","boundaryVersion","entityRegister","inclusionDecision","eliminationLedger","consolidationResult","approvalHistory"]
- Fields: ["boundaryMethod","reportingBasis","effectiveFrom","effectiveUntil","entityCode","entityName","entityType","countryCode","ownershipPercent","controlType","includedYn","exclusionReason","evidenceRef","grossEmission","eliminatedEmission","netEmission","reviewComment"]
- Commands and navigation: ["saveDraft","markReviewReady","runConsolidation","approve","reject","viewHistory","continueGuide"]
- Required UI states: ["LOADING","EMPTY","EDITING","VALIDATION_ERROR","FORBIDDEN","CONFLICT","READY","LOCKED"]

### API, transaction, and data contract

- API: ["PUT /home/api/emission-projects/{id}/organizational-boundary","POST /home/api/emission-projects/{id}/organizational-boundary/review-ready"]
- Database entities: ["emission_organizational_boundary","emission_organizational_boundary_member","emission_organizational_boundary_elimination","emission_organizational_boundary_consolidation","framework_process_execution_event"]
- Audit and evidence: ["ownershipEvidence","controlEvidence","exclusionReason","internalTransactionEvidence","approvalAudit"]
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
