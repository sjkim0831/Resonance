import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_9f5b66ea737e6c45b53d = {
  "id": "auto-9f5b66ea737e6c45b53d",
  "blueprintCode": "BP_ADOPT_9F5B66EA737E3C45B53D",
  "processCode": "CUSTOMER_WORK_COORDINATION",
  "stepCode": "CUSTOMER_WORK_DISCOVER",
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "pageId": "AUTO_9F5B66EA737E6C45B53D",
  "pageName": "내 업무·프로젝트 선택",
  "routePath": "/emission/my-tasks",
  "screenType": "CONTENT",
  "templateCode": "KRDS_CONTENT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "조직경계, 산정기간, Scope, 적용 기준, 책임 액터와 단계별 마감을 확정하여 자료 수집을 시작한다.",
    "actorResponsibilities": [
      "COMPANY_MANAGER 액터가 권한·업무분리 정책에 따라 내 업무·프로젝트 선택 업무를 수행한다."
    ],
    "entryConditions": [
      "기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다."
    ],
    "exitConditions": [
      "필수 설정이 버전으로 저장되고 업무분리가 검증되며 프로젝트가 PLANNED 상태로 전이된다."
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "SAVING",
      "CONFLICT",
      "STALE_VERSION"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "설정완료율"
      },
      {
        "code": "KPI_2",
        "label": "미배정 액터 수"
      },
      {
        "code": "KPI_3",
        "label": "기한 미설정 수"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "업무 요약"
      },
      {
        "code": "SECTION_2",
        "label": "기본정보"
      },
      {
        "code": "SECTION_3",
        "label": "조직·운영경계"
      },
      {
        "code": "SECTION_4",
        "label": "Scope·방법론"
      },
      {
        "code": "SECTION_5",
        "label": "액터·마감"
      },
      {
        "code": "SECTION_6",
        "label": "검토·시작"
      }
    ],
    "fields": [
      {
        "name": "실행 가능 여부",
        "source": "emission_project_task.task_status",
        "required": true,
        "fieldCode": "actionable",
        "apiProperty": "actionable"
      },
      {
        "name": "담당 액터",
        "source": "emission_project_task.actor_code",
        "required": false,
        "fieldCode": "actorCode",
        "apiProperty": "actorCode"
      },
      {
        "name": "담당자",
        "source": "emission_project_task.assignee_id",
        "required": false,
        "fieldCode": "assignee",
        "apiProperty": "assignee"
      },
      {
        "name": "차단 사유",
        "source": "emission_project_task.blocked_reason",
        "required": false,
        "fieldCode": "blockedReason",
        "apiProperty": "blockedReason"
      },
      {
        "name": "실행 명령",
        "source": "framework_process_step.command_code",
        "required": false,
        "fieldCode": "commandCode",
        "apiProperty": "commandCode"
      },
      {
        "name": "완료 근거",
        "source": "emission_project_task.completion_rule",
        "required": false,
        "fieldCode": "completionEvidence",
        "apiProperty": "completionEvidence"
      },
      {
        "name": "완료 조건",
        "source": "emission_project_task.completion_rule",
        "required": false,
        "fieldCode": "completionRule",
        "apiProperty": "completionRule"
      },
      {
        "name": "완료 충족 여부",
        "source": "emission_project_task.completion_rule",
        "required": false,
        "fieldCode": "completionSatisfied",
        "apiProperty": "completionSatisfied"
      },
      {
        "name": "업무 종류 코드",
        "source": "framework_process_definition.domain_code",
        "required": false,
        "fieldCode": "domainCode",
        "apiProperty": "domainCode"
      },
      {
        "name": "마감일",
        "source": "emission_project_task.due_date",
        "required": false,
        "fieldCode": "dueDate",
        "apiProperty": "dueDate"
      },
      {
        "name": "진입 상태",
        "source": "framework_process_step.from_state",
        "required": false,
        "fieldCode": "entryState",
        "apiProperty": "entryState"
      },
      {
        "name": "기대 산출물 계약",
        "source": "framework_process_step.output_contract",
        "required": false,
        "fieldCode": "expectedOutput",
        "apiProperty": "expectedOutput"
      },
      {
        "name": "업무 ID",
        "source": "emission_project_task.task_id",
        "required": true,
        "fieldCode": "id",
        "apiProperty": "id"
      },
      {
        "name": "업무명",
        "source": "emission_project_task.task_name",
        "required": true,
        "fieldCode": "name",
        "apiProperty": "name"
      },
      {
        "name": "다음 담당 액터",
        "source": "emission_project_task.actor_code",
        "required": false,
        "fieldCode": "nextActorCode",
        "apiProperty": "nextActorCode"
      },
      {
        "name": "다음 업무명",
        "source": "emission_project_task.task_name",
        "required": false,
        "fieldCode": "nextTaskName",
        "apiProperty": "nextTaskName"
      },
      {
        "name": "알림 ID",
        "source": "emission_workflow_notification.notification_id",
        "required": false,
        "fieldCode": "notificationId",
        "apiProperty": "notifications[].id"
      },
      {
        "name": "알림 내용",
        "source": "emission_workflow_notification.message_text",
        "required": false,
        "fieldCode": "notificationMessage",
        "apiProperty": "notifications[].message"
      },
      {
        "name": "알림 확인 일시",
        "source": "emission_workflow_notification.read_at",
        "required": false,
        "fieldCode": "notificationReadAt",
        "apiProperty": "notifications[].readAt"
      },
      {
        "name": "알림 제목",
        "source": "emission_workflow_notification.title",
        "required": false,
        "fieldCode": "notificationTitle",
        "apiProperty": "notifications[].title"
      },
      {
        "name": "미완료 선행업무",
        "source": "emission_project_task.predecessor_codes",
        "required": false,
        "fieldCode": "pendingPredecessors",
        "apiProperty": "pendingPredecessors"
      },
      {
        "name": "우선순위",
        "source": "emission_project_task.priority",
        "required": true,
        "fieldCode": "priority",
        "apiProperty": "priority"
      },
      {
        "name": "프로세스 코드",
        "source": "emission_project_task.process_code",
        "required": false,
        "fieldCode": "processCode",
        "apiProperty": "processCode"
      },
      {
        "name": "프로세스명",
        "source": "framework_process_definition.process_name",
        "required": false,
        "fieldCode": "processName",
        "apiProperty": "processName"
      },
      {
        "name": "프로세스 단계 코드",
        "source": "emission_project_task.process_step_code",
        "required": false,
        "fieldCode": "processStepCode",
        "apiProperty": "processStepCode"
      },
      {
        "name": "프로젝트 ID",
        "source": "emission_project_task.project_id",
        "required": true,
        "fieldCode": "projectId",
        "apiProperty": "projectId"
      },
      {
        "name": "프로젝트명",
        "source": "emission_project_registry.project_name",
        "required": true,
        "fieldCode": "projectName",
        "apiProperty": "projectName"
      },
      {
        "name": "필수 입력 계약",
        "source": "framework_process_step.input_contract",
        "required": false,
        "fieldCode": "requiredInputs",
        "apiProperty": "requiredInputs"
      },
      {
        "name": "사업장",
        "source": "emission_project_registry.site_name",
        "required": false,
        "fieldCode": "site",
        "apiProperty": "site"
      },
      {
        "name": "업무 상태",
        "source": "emission_project_task.task_status",
        "required": true,
        "fieldCode": "status",
        "apiProperty": "status"
      },
      {
        "name": "업무 순서",
        "source": "emission_project_task.step_order",
        "required": true,
        "fieldCode": "stepOrder",
        "apiProperty": "stepOrder"
      },
      {
        "name": "승인 대기 수",
        "source": "emission_project_task.task_code",
        "required": false,
        "fieldCode": "summaryApproval",
        "apiProperty": "summary.approval"
      },
      {
        "name": "완료 업무 수",
        "source": "emission_project_task.task_status",
        "required": false,
        "fieldCode": "summaryCompleted",
        "apiProperty": "summary.completed"
      },
      {
        "name": "지연 업무 수",
        "source": "emission_project_task.due_date",
        "required": false,
        "fieldCode": "summaryOverdue",
        "apiProperty": "summary.overdue"
      },
      {
        "name": "오늘 마감 수",
        "source": "emission_project_task.due_date",
        "required": false,
        "fieldCode": "summaryToday",
        "apiProperty": "summary.today"
      },
      {
        "name": "전체 업무 수",
        "source": "emission_project_task.task_id",
        "required": false,
        "fieldCode": "summaryTotal",
        "apiProperty": "summary.total"
      },
      {
        "name": "업무 화면 경로",
        "source": "emission_project_task.target_url",
        "required": false,
        "fieldCode": "targetUrl",
        "apiProperty": "targetUrl"
      },
      {
        "name": "업무 코드",
        "source": "emission_project_task.task_code",
        "required": true,
        "fieldCode": "taskCode",
        "apiProperty": "taskCode"
      },
      {
        "name": "업무 유형",
        "source": "emission_project_task.task_type",
        "required": false,
        "fieldCode": "type",
        "apiProperty": "type"
      },
      {
        "name": "업무 목적",
        "source": "framework_process_step.requirement_text",
        "required": false,
        "fieldCode": "workPurpose",
        "apiProperty": "workPurpose"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "임시저장"
      },
      {
        "code": "ACTION_2",
        "label": "설정 검증"
      },
      {
        "code": "ACTION_3",
        "label": "프로젝트 시작"
      },
      {
        "code": "ACTION_4",
        "label": "사업장 관리"
      },
      {
        "code": "ACTION_5",
        "label": "권한 관리"
      },
      {
        "code": "ACTION_6",
        "label": "다음 업무 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-tasks"
      },
      {
        "code": "API_2",
        "label": "GET /home/api/emission-projects/{id}/completion"
      }
    ],
    "dataContracts": [
      {
        "api": "GET /home/api/emission-tasks",
        "version": "task-contract-1.0.0",
        "entities": [
          "emission_project_task",
          "emission_project_registry",
          "framework_process_step",
          "framework_process_definition",
          "emission_workflow_notification"
        ],
        "actorScoped": true,
        "tenantScoped": true
      }
    ],
    "permissions": [
      {
        "code": "COMPANY_MANAGER",
        "scope": "TENANT_PROJECT",
        "segregationOfDuties": true,
        "serverAuthorization": true
      }
    ],
    "validations": [
      {
        "code": "ENTRY_AND_REQUIRED_FIELDS",
        "type": "CONTRACT"
      },
      {
        "code": "STATE_AND_VERSION",
        "type": "CONCURRENCY"
      }
    ],
    "errors": [
      {
        "code": "FORBIDDEN",
        "recovery": "권한·업무분리 확인"
      },
      {
        "code": "CONFLICT",
        "recovery": "최신 버전 재조회"
      },
      {
        "code": "DEPENDENCY_FAILURE",
        "recovery": "멱등키로 안전 재시도"
      }
    ],
    "responsive": {
      "mobile": "single-column-actions-bottom",
      "tablet": "adaptive-grid",
      "desktop": "list-detail-workspace"
    },
    "accessibility": {
      "labels": true,
      "keyboard": true,
      "standard": "WCAG_2_1_AA",
      "nonColorStatus": true,
      "focusManagement": true
    },
    "completionRule": "필수 설정이 버전으로 저장되고 업무분리가 검증되며 프로젝트가 PLANNED 상태로 전이된다.",
    "extensions": {
      "contractId": 239,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 239,
    "requirementIds": [
      "CUSTOMER_WORK_COORDINATION:CUSTOMER_WORK_DISCOVER:USER"
    ],
    "generationBatchId": 80,
    "designReadinessScore": 100,
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ]
  },
  "designCompleteness": {
    "score": 100,
    "checks": {
      "purpose": true,
      "actor": true,
      "entry": true,
      "exit": true,
      "sections": true,
      "fields": true,
      "actions": true,
      "api": true,
      "data": true,
      "permissions": true,
      "validations": true,
      "states": true,
      "errors": true,
      "responsive": true,
      "accessibility": true,
      "tests": true
    },
    "complete": true
  }
} as const satisfies GeneratedScreenDefinition;
