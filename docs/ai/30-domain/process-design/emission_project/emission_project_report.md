# EMISSION_PROJECT / EMISSION_PROJECT_REPORT

## Purpose and completion condition

승인된 결과로 검증 가능한 보고서를 생성·제출·발급한다.

## ADMIN screen contract: 보고서 생성·제출·진위 확인 관리자 업무 화면

- Route: `/admin/emission/survey-report`
- Responsible actor: `COMPANY_MANAGER`
- Business purpose: 확정 산정 결과로 다국어 보고서를 생성·검토·제출하고 정규화 데이터셋과 지문으로 진위를 검증한다.
- Entry condition: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
- Completion condition: PDF와 정규화 데이터셋이 동일 버전에 묶여 발급·제출되고 OCR·시각지문·데이터 비교 검증이 가능하다.

### Layout, fields, and commands

- KPI: ["보고서 발급상태","제출상태","진위검증 성공률","재발급 건수"]
- Sections: ["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]
- Fields: ["보고서 버전","산정 버전","언어","제출처","총 배출량","Scope 결과","제품·부산물","정규화 데이터셋","OCR","시각지문","발급상태"]
- Commands and navigation: ["미리보기","PDF 생성","수치 검증","발급","제출","다운로드","진위확인 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports/{reportId}/submit","POST /home/api/report-verification"]
- Database entities: ["emission_report","emission_report_dataset","emission_report_fingerprint","emission_report_verification","emission_project_submission"]
- Audit and evidence: ["화면·PDF 동일 DOM","폰트·페이지 레이아웃","데이터셋·QR 포함","OCR 전체 항목 대조","재발급·제출 멱등성"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 보고서 생성·제출·진위 확인 사용자 업무 화면

- Route: `/emission/report_submit`
- Responsible actor: `COMPANY_MANAGER`
- Business purpose: 확정 산정 결과로 다국어 보고서를 생성·검토·제출하고 정규화 데이터셋과 지문으로 진위를 검증한다.
- Entry condition: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
- Completion condition: PDF와 정규화 데이터셋이 동일 버전에 묶여 발급·제출되고 OCR·시각지문·데이터 비교 검증이 가능하다.

### Layout, fields, and commands

- KPI: ["보고서 발급상태","제출상태","진위검증 성공률","재발급 건수"]
- Sections: ["보고 요약","양식·언어","미리보기","수치 대조","발급·제출","진위·다운로드 이력"]
- Fields: ["보고서 버전","산정 버전","언어","제출처","총 배출량","Scope 결과","제품·부산물","정규화 데이터셋","OCR","시각지문","발급상태"]
- Commands and navigation: ["미리보기","PDF 생성","수치 검증","발급","제출","다운로드","진위확인 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports/{reportId}/submit","POST /home/api/report-verification"]
- Database entities: ["emission_report","emission_report_dataset","emission_report_fingerprint","emission_report_verification","emission_project_submission"]
- Audit and evidence: ["화면·PDF 동일 DOM","폰트·페이지 레이아웃","데이터셋·QR 포함","OCR 전체 항목 대조","재발급·제출 멱등성"]
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
