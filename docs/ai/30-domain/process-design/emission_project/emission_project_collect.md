# EMISSION_PROJECT / EMISSION_PROJECT_COLLECT

## Purpose and completion condition

산정에 필요한 활동자료와 원본 증빙을 책임자별로 수집하고 품질을 관리한다.

## ADMIN screen contract: 활동자료·증빙 수집 관리자 업무 화면

- Route: `/admin/emission/survey-admin-data`
- Responsible actor: `SITE_DATA_OWNER`
- Business purpose: 사업장·배출원별 활동자료의 값, 단위, 기간, 출처와 원본 증빙을 수집하고 제출 품질을 관리한다.
- Entry condition: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
- Completion condition: 필수 자료와 증빙이 품질검사를 통과하고 제출 스냅샷이 DATA_SUBMITTED 상태로 잠긴다.

### Layout, fields, and commands

- KPI: ["제출완료율","증빙연결률","기한초과 건수","품질오류 건수"]
- Sections: ["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]
- Fields: ["사업장","배출원","활동자료","값","단위","기간","출처","증빙","담당자","마감","품질상태"]
- Commands and navigation: ["자료 요청","엑셀 업로드","임시저장","품질검사","제출","보완 요청","다음 업무 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities/import","POST /home/api/emission-projects/{id}/activities/submit"]
- Database entities: ["emission_project_activity","emission_project_activity_request","emission_project_evidence","emission_project_submission"]
- Audit and evidence: ["양식 좌측 표 파싱","단위·기간 검증","증빙 누락 차단","대용량 업로드 원자성","재제출 버전 이력"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 활동자료·증빙 수집 사용자 업무 화면

- Route: `/emission/data_input`
- Responsible actor: `SITE_DATA_OWNER`
- Business purpose: 사업장·배출원별 활동자료의 값, 단위, 기간, 출처와 원본 증빙을 수집하고 제출 품질을 관리한다.
- Entry condition: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
- Completion condition: 필수 자료와 증빙이 품질검사를 통과하고 제출 스냅샷이 DATA_SUBMITTED 상태로 잠긴다.

### Layout, fields, and commands

- KPI: ["제출완료율","증빙연결률","기한초과 건수","품질오류 건수"]
- Sections: ["수집 현황","제출 요청","엑셀·직접 입력","증빙 연결","품질검사","제출 이력"]
- Fields: ["사업장","배출원","활동자료","값","단위","기간","출처","증빙","담당자","마감","품질상태"]
- Commands and navigation: ["자료 요청","엑셀 업로드","임시저장","품질검사","제출","보완 요청","다음 업무 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities/import","POST /home/api/emission-projects/{id}/activities/submit"]
- Database entities: ["emission_project_activity","emission_project_activity_request","emission_project_evidence","emission_project_submission"]
- Audit and evidence: ["양식 좌측 표 파싱","단위·기간 검증","증빙 누락 차단","대용량 업로드 원자성","재제출 버전 이력"]
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
