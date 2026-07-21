# PLATFORM_OPERATION / PLATFORM_DEPLOY

## Purpose and completion condition

무중단 배포 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.

## ADMIN screen contract: 플랫폼 운영 - 무중단 배포

- Route: `/admin/system/process-workspace?process=PLATFORM_OPERATION&step=PLATFORM_DEPLOY`
- Responsible actor: `PLATFORM_OPERATOR`
- Business purpose: 무중단 배포 업무를 전문적으로 완료한다.
- Entry condition: 권한과 선행 단계가 확인되어야 한다.
- Completion condition: 업무 결과·상태·증거·다음 단계 인계가 저장되어야 한다.

### Layout, fields, and commands

- KPI: [
  {
    "code": "completionRate",
    "label": "완료율"
  },
  {
    "code": "blockerCount",
    "label": "차단 건수"
  },
  {
    "code": "dueAt",
    "label": "처리 기한"
  }
]
- Sections: [
  {
    "code": "summary",
    "label": "업무 요약"
  },
  {
    "code": "task",
    "label": "실행 항목"
  },
  {
    "code": "evidence",
    "label": "검증 증거"
  },
  {
    "code": "history",
    "label": "변경 이력"
  }
]
- Fields: [
  {
    "code": "processCode",
    "name": "프로세스 코드",
    "type": "CODE",
    "control": "HIDDEN",
    "required": true,
    "validation": {
      "minLength": 1
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "process_code",
    "evidenceRequired": false
  },
  {
    "code": "processName",
    "name": "프로세스명",
    "type": "STRING",
    "control": "TEXT",
    "required": true,
    "validation": {
      "maxLength": 300,
      "minLength": 1
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "process_name",
    "evidenceRequired": false
  },
  {
    "code": "domainCode",
    "name": "업무 도메인",
    "type": "CODE",
    "control": "STATUS_BADGE",
    "required": true,
    "validation": {},
    "sourceTable": "framework_process_definition",
    "sourceColumn": "domain_code",
    "evidenceRequired": false
  },
  {
    "code": "ownerActorCode",
    "name": "책임 액터",
    "type": "CODE",
    "control": "ACTOR_LINK",
    "required": true,
    "validation": {
      "activeActorRequired": true
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "owner_actor_code",
    "evidenceRequired": false
  },
  {
    "code": "goal",
    "name": "업무 목표",
    "type": "TEXT",
    "control": "LONG_TEXT",
    "required": true,
    "validation": {
      "minLength": 10
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "goal",
    "evidenceRequired": false
  },
  {
    "code": "startCondition",
    "name": "시작 조건",
    "type": "TEXT",
    "control": "CONDITION_VIEW",
    "required": true,
    "validation": {
      "minLength": 5
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "start_condition",
    "evidenceRequired": false
  },
  {
    "code": "completionCondition",
    "name": "완료 조건",
    "type": "TEXT",
    "control": "CONDITION_VIEW",
    "required": true,
    "validation": {
      "minLength": 5
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "completion_condition",
    "evidenceRequired": true
  },
  {
    "code": "riskLevel",
    "name": "위험 등급",
    "type": "CODE",
    "control": "RISK_BADGE",
    "required": true,
    "validation": {
      "codeGroup": "PROCESS_RISK"
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "risk_level",
    "evidenceRequired": false
  },
  {
    "code": "slaHours",
    "name": "처리 기한",
    "type": "INTEGER",
    "control": "DURATION",
    "required": true,
    "validation": {
      "min": 1
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "sla_hours",
    "evidenceRequired": false
  },
  {
    "code": "reviewCycleDays",
    "name": "검토 주기",
    "type": "INTEGER",
    "control": "DURATION",
    "required": true,
    "validation": {
      "min": 1
    },
    "sourceTable": "framework_process_definition",
    "sourceColumn": "review_cycle_days",
    "evidenceRequired": false
  },
  {
    "code": "regulationRefs",
    "name": "법령·기준 근거",
    "type": "TEXT",
    "control": "REFERENCE_LINKS",
    "required": false,
    "validation": {},
    "sourceTable": "framework_process_definition",
    "sourceColumn": "regulation_refs",
    "evidenceRequired": true
  },
  {
    "code": "lifecycleStatus",
    "name": "생애주기 상태",
    "type": "CODE",
    "control": "STATUS_BADGE",
    "required": true,
    "validation": {},
    "sourceTable": "framework_process_definition",
    "sourceColumn": "lifecycle_status",
    "evidenceRequired": false
  },
  {
    "code": "effectiveFrom",
    "name": "적용 시작일",
    "type": "DATE",
    "control": "DATE",
    "required": false,
    "validation": {},
    "sourceTable": "framework_process_definition",
    "sourceColumn": "effective_from",
    "evidenceRequired": false
  },
  {
    "code": "effectiveUntil",
    "name": "적용 종료일",
    "type": "DATE",
    "control": "DATE",
    "required": false,
    "validation": {},
    "sourceTable": "framework_process_definition",
    "sourceColumn": "effective_until",
    "evidenceRequired": false
  },
  {
    "code": "stepCount",
    "name": "전체 단계 수",
    "type": "INTEGER",
    "control": "METRIC",
    "required": true,
    "validation": {
      "min": 1
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "currentStepCode",
    "name": "현재 단계",
    "type": "CODE",
    "control": "STEP_LINK",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "currentState",
    "name": "현재 상태",
    "type": "CODE",
    "control": "STATUS_BADGE",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "progressPercent",
    "name": "진행률",
    "type": "DECIMAL",
    "control": "PROGRESS",
    "required": true,
    "validation": {
      "max": 100,
      "min": 0
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "dueAt",
    "name": "업무 마감일시",
    "type": "DATETIME",
    "control": "DATETIME",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "assuranceStatus",
    "name": "설계 검증 상태",
    "type": "CODE",
    "control": "STATUS_BADGE",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": true
  },
  {
    "code": "designAccuracyScore",
    "name": "설계 정확도",
    "type": "DECIMAL",
    "control": "SCORE",
    "required": true,
    "validation": {
      "max": 100,
      "min": 0
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "designBlockerCount",
    "name": "설계 차단 건수",
    "type": "INTEGER",
    "control": "METRIC_LINK",
    "required": true,
    "validation": {
      "min": 0
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": true
  },
  {
    "code": "scenarioCount",
    "name": "테스트 시나리오 수",
    "type": "INTEGER",
    "control": "METRIC_LINK",
    "required": true,
    "validation": {
      "min": 5
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": true
  },
  {
    "code": "developmentJobCount",
    "name": "개발 작업 수",
    "type": "INTEGER",
    "control": "METRIC_LINK",
    "required": true,
    "validation": {
      "min": 1
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "verifiedJobCount",
    "name": "검증 완료 작업 수",
    "type": "INTEGER",
    "control": "METRIC_LINK",
    "required": true,
    "validation": {
      "min": 0
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": true
  },
  {
    "code": "evidenceCount",
    "name": "증빙 수",
    "type": "INTEGER",
    "control": "EVIDENCE_LINK",
    "required": true,
    "validation": {
      "min": 0
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": true
  },
  {
    "code": "lastAuditAt",
    "name": "최종 감사일시",
    "type": "DATETIME",
    "control": "DATETIME",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": true
  },
  {
    "code": "nextAction",
    "name": "다음 필수 작업",
    "type": "TEXT",
    "control": "TASK_LINK",
    "required": true,
    "validation": {
      "minLength": 1
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  }
]
- Commands and navigation: [
  {
    "code": "save",
    "transactional": true
  },
  {
    "code": "validate",
    "evidenceRequired": true
  },
  {
    "code": "complete",
    "nextStepRequired": true
  }
]
- Required UI states: [
  "LOADING",
  "EMPTY",
  "READY",
  "VALIDATION_ERROR",
  "AUTHORITY_DENIED",
  "DEPENDENCY_BLOCKED",
  "CONFLICT",
  "SERVER_ERROR"
]

### API, transaction, and data contract

- API: []
- Database entities: [
  "framework_process_step",
  "framework_development_job",
  "framework_process_artifact"
]
- Audit and evidence: [
  "actor",
  "stateTransition",
  "inputSnapshot",
  "decision",
  "timestamp",
  "sourceCommit"
]
- Security and tenant isolation: 테넌트·프로젝트·액터 권한, 업무 분리와 상태 전이를 서버에서 검증하고 감사 로그를 남긴다.

### Responsive and accessibility contract

- Responsive behavior: 360px 단일 열, 768px 2열, 1280px 요약·업무 상세 구조이며 표는 컴포넌트 내부에서만 스크롤한다.
- Accessibility: KRDS 및 WCAG 2.1 AA: 키보드, 포커스, 레이블, 오류 안내, 명도, 상태 비색상 표현을 충족한다.

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
