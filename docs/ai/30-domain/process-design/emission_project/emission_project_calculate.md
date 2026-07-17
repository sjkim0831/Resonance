# EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

## Purpose and completion condition

승인된 배출계수와 단위 환산 규칙으로 재현 가능한 배출량을 산정한다.

## ADMIN screen contract: 배출계수 매핑·배출량 산정 관리자 업무 화면

- Route: `/admin/emission/calculation-rule`
- Responsible actor: `CALCULATOR`
- Business purpose: 승인된 배출계수와 단위환산 정책으로 Scope별 배출량을 재현 가능하게 산정하고 계산 근거를 보존한다.
- Entry condition: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
- Completion condition: 모든 대상 행에 계산식과 계수 출처가 연결되고 합계 검증을 통과한 CALCULATED 버전이 생성된다.

### Layout, fields, and commands

- KPI: ["계수매핑률","산정완료율","미매핑 건수","Scope별 배출량"]
- Sections: ["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]
- Fields: ["활동자료","사용량","원단위","배출계수","계수 출처·버전","환산식","GWP","배출량","Scope","계산 버전"]
- Commands and navigation: ["AI 매핑","매핑 확정","일괄 단위 적용","산정 실행","재산정","계산근거 보기","검증 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/calculation","POST /home/api/emission-projects/{id}/factor-mappings","POST /home/api/emission-projects/{id}/calculation","GET /home/api/emission-projects/{id}/calculation/{version}"]
- Database entities: ["emission_factor_mapping","emission_project_calculation","emission_project_calculation_detail","emission_unit_conversion","emission_gwp_value"]
- Audit and evidence: ["동일 요청 멱등성","계수 버전 재현","단위 차원 오류","합계 일치","실패 롤백과 재처리"]
- Security and tenant isolation: 서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.

### Responsive and accessibility contract

- Responsive behavior: 360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.
- Accessibility: KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.

## USER screen contract: 배출계수 매핑·배출량 산정 사용자 업무 화면

- Route: `/emission/simulate`
- Responsible actor: `CALCULATOR`
- Business purpose: 승인된 배출계수와 단위환산 정책으로 Scope별 배출량을 재현 가능하게 산정하고 계산 근거를 보존한다.
- Entry condition: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
- Completion condition: 모든 대상 행에 계산식과 계수 출처가 연결되고 합계 검증을 통과한 CALCULATED 버전이 생성된다.

### Layout, fields, and commands

- KPI: ["계수매핑률","산정완료율","미매핑 건수","Scope별 배출량"]
- Sections: ["산정 요약","계수 매핑","단위 환산","상세 계산","Scope 결과","버전 비교"]
- Fields: ["활동자료","사용량","원단위","배출계수","계수 출처·버전","환산식","GWP","배출량","Scope","계산 버전"]
- Commands and navigation: ["AI 매핑","매핑 확정","일괄 단위 적용","산정 실행","재산정","계산근거 보기","검증 이동"]
- Required UI states: ["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]

### API, transaction, and data contract

- API: ["GET /home/api/emission-projects/{id}/calculation","POST /home/api/emission-projects/{id}/factor-mappings","POST /home/api/emission-projects/{id}/calculation","GET /home/api/emission-projects/{id}/calculation/{version}"]
- Database entities: ["emission_factor_mapping","emission_project_calculation","emission_project_calculation_detail","emission_unit_conversion","emission_gwp_value"]
- Audit and evidence: ["동일 요청 멱등성","계수 버전 재현","단위 차원 오류","합계 일치","실패 롤백과 재처리"]
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
