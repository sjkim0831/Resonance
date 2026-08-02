# REQ_43BDB0EC53F8 / REQ_43BDB0EC53F8_S004

## Purpose and completion condition

산정 담당자는 배출계수 매핑을 확정하고 배출량을 계산한다.

## USER screen contract: 산정 담당자는 배출계수 매핑을 확정하고 배출량을 계산한다. 사용자 업무 화면

- Route: `/generated/ccus-platform/req_43bdb0ec53f8/s004`
- Responsible actor: `COMPANY_MANAGER`
- Business purpose: 산정 담당자는 배출계수 매핑을 확정하고 배출량을 계산한다. 업무를 추적 가능한 방식으로 완료한다.
- Entry condition: STEP_3_COMPLETED 상태이며 COMPANY_MANAGER 액터가 프로젝트에 배정되어 있다.
- Completion condition: 필수 필드, 권한, DB 재조회, 증적 검증을 통과한다. 완료 증적과 감사 이력이 저장된다.

### Layout, fields, and commands

- KPI: ["처리 건수","완료율","기한 준수율","오류 건수"]
- Sections: ["업무 요약","입력 및 검증","처리 결과","증적 및 이력","다음 업무"]
- Fields: [{"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "STRING", "editable": false, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": true, "fieldCode": "tenantId", "fieldName": "테넌트", "fieldGroup": "COMMON", "fieldOrder": 1, "validation": {}, "apiProperty": "tenantId", "controlType": "HIDDEN", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "CONTEXT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": false}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "STRING", "editable": true, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": true, "fieldCode": "projectId", "fieldName": "프로젝트", "fieldGroup": "COMMON", "fieldOrder": 2, "validation": {}, "apiProperty": "projectId", "controlType": "PROJECT_SELECTOR", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "CONTEXT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": false}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "STRING", "editable": false, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": true, "fieldCode": "processCode", "fieldName": "프로세스", "fieldGroup": "COMMON", "fieldOrder": 3, "validation": {}, "apiProperty": "processCode", "controlType": "HIDDEN", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "CONTEXT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": false}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "STRING", "editable": false, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": true, "fieldCode": "stepCode", "fieldName": "업무 단계", "fieldGroup": "COMMON", "fieldOrder": 4, "validation": {}, "apiProperty": "stepCode", "controlType": "HIDDEN", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "CONTEXT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": false}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "STRING", "editable": true, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": true, "fieldCode": "actorCode", "fieldName": "담당 액터", "fieldGroup": "COMMON", "fieldOrder": 5, "validation": {}, "apiProperty": "actorCode", "controlType": "ACTOR_SELECTOR", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "CONTEXT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": false}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "STRING", "editable": false, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": false, "fieldCode": "statusCode", "fieldName": "처리 상태", "fieldGroup": "COMMON", "fieldOrder": 6, "validation": {}, "apiProperty": "statusCode", "controlType": "STATUS", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "LOGICAL_CONTRACT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": false}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "INTEGER", "editable": false, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": false, "fieldCode": "rowVersion", "fieldName": "데이터 버전", "fieldGroup": "COMMON", "fieldOrder": 7, "validation": {}, "apiProperty": "rowVersion", "controlType": "HIDDEN", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "LOGICAL_CONTRACT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": false}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "JSON", "editable": true, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": false, "fieldCode": "businessData", "fieldName": "업무 입력", "fieldGroup": "COMMON", "fieldOrder": 8, "validation": {}, "apiProperty": "businessData", "controlType": "DYNAMIC_FORM", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "LOGICAL_CONTRACT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": true}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "FILE_LIST", "editable": true, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": false, "fieldCode": "evidenceFiles", "fieldName": "증적 파일", "fieldGroup": "COMMON", "fieldOrder": 9, "validation": {}, "apiProperty": "evidenceFiles", "controlType": "FILE_UPLOAD", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "LOGICAL_CONTRACT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": true}, {"route": "/generated/ccus-platform/req_43bdb0ec53f8/s004", "audience": "USER", "dataType": "JSON", "editable": false, "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S004_USER", "required": false, "fieldCode": "auditHistory", "fieldName": "변경 이력", "fieldGroup": "COMMON", "fieldOrder": 10, "validation": {}, "apiProperty": "auditHistory", "controlType": "AUDIT_TIMELINE", "sourceTable": null, "privacyClass": "INTERNAL", "sourceColumn": null, "mappingStatus": "LOGICAL_CONTRACT", "permissionCode": "COMPANY_MANAGER:USER", "evidenceRequired": true}]
- Commands and navigation: ["EXECUTE_REQ_43BDB0EC53F8_S004", "SAVE_DRAFT", "ATTACH_EVIDENCE", "ROLLBACK_REQ_43BDB0EC53F8_S004"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","PROCESSING","COMPLETED"]

### API, transaction, and data contract

- API: [{"contract" : {"path": "/admin/api/system/actor-process/executions/{executionId}/commands", "method": "POST"}}]
- Database entities: [{"entity" : "framework_process_execution"}, {"entity" : "framework_process_execution_event"}, {"contextFields" : ["tenantId", "projectId", "processCode", "stepCode", "actorCode", "statusCode", "rowVersion", "createdAt", "updatedAt"]}, {"input" : {"fields": [{"type": "string", "label": "프로젝트 ID", "required": true, "fieldCode": "projectId"}, {"type": "string", "label": "수행 액터", "required": true, "fieldCode": "actorCode"}, {"type": "string", "label": "업무 상태", "required": true, "fieldCode": "statusCode"}, {"type": "GET", "label": "업무 명령", "required": true, "fieldCode": "commandCode"}, {"type": "object", "label": "업무 입력 데이터", "required": false, "fieldCode": "payload"}, {"type": "integer", "label": "동시성 버전", "required": false, "fieldCode": "rowVersion"}]}}, {"output" : {"toState": "STEP_4_COMPLETED", "stepCode": "REQ_43BDB0EC53F8_S004", "projectId": "string", "rowVersion": "integer", "statusCode": "STEP_4_COMPLETED", "processCode": "REQ_43BDB0EC53F8"}}]
- Audit and evidence: ["REQUEST","RESPONSE","DB_REREAD","AUTHORITY","E2E","ROLLBACK"]
- Security and tenant isolation: Server-enforced tenant, project, actor, command, optimistic-lock, and audit policy.

### Responsive and accessibility contract

- Responsive behavior: KRDS responsive contract for mobile 360px, tablet 768px, and desktop 1280px.
- Accessibility: KRDS and WCAG 2.1 AA keyboard, focus, label, contrast, and error-message contract.

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
