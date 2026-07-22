# MEMBER_REGISTRATION / MEMBER_REGISTRATION_S5

## Purpose and completion condition

가입 신청 완료·접수번호 확인 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.

## ADMIN screen contract: 회원가입 신청 - 가입 신청 완료·접수번호 확인

- Route: `/admin/system/process-workspace?process=MEMBER_REGISTRATION&step=MEMBER_REGISTRATION_S5`
- Responsible actor: `PUBLIC_APPLICANT`
- Business purpose: 가입 신청 완료·접수번호 확인 업무를 전문적으로 완료한다.
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
    "code": "tenantId",
    "name": "테넌트",
    "type": "STRING",
    "control": "HIDDEN",
    "required": true,
    "validation": {
      "minLength": 1
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "projectId",
    "name": "프로젝트",
    "type": "STRING",
    "control": "PROJECT_SELECT",
    "required": true,
    "validation": {
      "minLength": 1
    },
    "sourceTable": "comtnentrprsmber",
    "sourceColumn": "project_id",
    "evidenceRequired": false
  },
  {
    "code": "processCode",
    "name": "프로세스 코드",
    "type": "CODE",
    "control": "HIDDEN",
    "required": true,
    "validation": {},
    "sourceTable": "framework_process_definition",
    "sourceColumn": "process_code",
    "evidenceRequired": false
  },
  {
    "code": "stepCode",
    "name": "단계 코드",
    "type": "CODE",
    "control": "HIDDEN",
    "required": true,
    "validation": {},
    "sourceTable": "framework_process_step",
    "sourceColumn": "step_code",
    "evidenceRequired": false
  },
  {
    "code": "recordId",
    "name": "업무 레코드 ID",
    "type": "UUID",
    "control": "HIDDEN",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "statusCode",
    "name": "처리 상태",
    "type": "CODE",
    "control": "STATUS_BADGE",
    "required": true,
    "validation": {
      "codeGroup": "WORK_STATUS"
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "ownerActorCode",
    "name": "담당 액터",
    "type": "CODE",
    "control": "ACTOR_SELECT",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "rowVersion",
    "name": "데이터 버전",
    "type": "INTEGER",
    "control": "HIDDEN",
    "required": true,
    "validation": {
      "min": 0
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "createdAt",
    "name": "등록 일시",
    "type": "DATETIME",
    "control": "DATETIME",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "updatedAt",
    "name": "최종 수정 일시",
    "type": "DATETIME",
    "control": "DATETIME",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "evidenceCount",
    "name": "증빙 수",
    "type": "INTEGER",
    "control": "EVIDENCE_LINK",
    "required": false,
    "validation": {
      "min": 0
    },
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "companyId",
    "name": "기업",
    "type": "STRING",
    "control": "COMPANY_SELECT",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "accountId",
    "name": "사용자 계정",
    "type": "STRING",
    "control": "USER_SELECT",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "actorCodes",
    "name": "업무 액터",
    "type": "ARRAY",
    "control": "ACTOR_MULTI_SELECT",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "authorityCode",
    "name": "권한 그룹",
    "type": "CODE",
    "control": "AUTHORITY_SELECT",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "accountStatus",
    "name": "계정 상태",
    "type": "CODE",
    "control": "STATUS_SELECT",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "consentVersion",
    "name": "동의서 버전",
    "type": "STRING",
    "control": "CONSENT_VIEW",
    "required": false,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "businessName",
    "name": "업무명",
    "type": "STRING",
    "control": "TEXT",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "businessPurpose",
    "name": "목적·근거",
    "type": "TEXT",
    "control": "TEXTAREA",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "effectiveFrom",
    "name": "적용 시작일",
    "type": "DATE",
    "control": "DATE",
    "required": true,
    "validation": {},
    "sourceTable": null,
    "sourceColumn": null,
    "evidenceRequired": false
  },
  {
    "code": "effectiveTo",
    "name": "적용 종료일",
    "type": "DATE",
    "control": "DATE",
    "required": false,
    "validation": {},
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
  "READY",
  "EMPTY",
  "DESIGN_BLOCKED",
  "IMPLEMENTATION_PENDING",
  "IMPLEMENTATION_VERIFIED",
  "ERROR",
  "FORBIDDEN",
  "SESSION_EXPIRED"
]

### API, transaction, and data contract

- API: [
  {
    "path": "/admin/api/system/actor-process",
    "scope": "actor and process governance",
    "method": "GET"
  },
  {
    "path": "/home/api/process-executions",
    "scope": "tenant, project and actor",
    "method": "GET"
  },
  {
    "path": "/home/api/process-executions/start",
    "guard": "first step actor",
    "method": "POST"
  },
  {
    "path": "/home/api/process-executions/{executionId}/commands",
    "method": "POST",
    "idempotency": "required"
  }
]
- Database entities: [
  {
    "version": "2.0.0",
    "entity": "framework_process_definition",
    "versionColumn": "process_version"
  },
  {
    "entity": "framework_process_step",
    "relation": "ordered state machine"
  },
  {
    "entity": "framework_simulation_case",
    "relation": "independent expectations"
  },
  {
    "entity": "framework_development_job",
    "relation": "implementation evidence"
  },
  {
    "view": "framework_process_development_progress"
  },
  {
    "view": "framework_process_design_assurance_matrix"
  }
]
- Audit and evidence: [
  {
    "version": "2.0.0",
    "tests": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ROUTE_INTEGRITY",
      "STATE_MACHINE",
      "TEST_COVERAGE",
      "DEVELOPMENT_EVIDENCE",
      "RECOVERY"
    ],
    "failClosed": "design blockers prevent generator promotion"
  }
]
- Security and tenant isolation: {"authentication":"ADMIN","authority":"PERM_PROCESS_ORCHESTRATION_READ","writeMode":"read-only workspace; changes occur in governed management screens","tenantData":"no customer records returned","audit":"selected process and opened route are governance trace events"}

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
