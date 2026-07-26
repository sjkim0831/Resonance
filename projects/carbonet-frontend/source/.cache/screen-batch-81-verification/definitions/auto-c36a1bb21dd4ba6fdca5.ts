import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_c36a1bb21dd4ba6fdca5 = {
  "id": "auto-c36a1bb21dd4ba6fdca5",
  "blueprintCode": "BP_AUTO_C36A1BB21DD4BA6FDCA5E60A",
  "processCode": "EMISSION_PROJECT",
  "stepCode": "EMISSION_PROJECT_COLLECT",
  "actorCode": "SITE_DATA_OWNER",
  "audience": "ADMIN",
  "pageId": "AUTO_C36A1BB21DD4BA6FDCA5",
  "pageName": "프로세스 단계 실행 작업공간",
  "routePath": "/admin/system/process-step-workspace",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "프로젝트 액터가 선택한 프로세스의 현재 단계를 실제 상태 전이 계약에 따라 처리하고 입력·증적·결과·감사 이력을 저장한 뒤 다음 액터 업무로 인계한다.",
    "actorResponsibilities": [
      "SITE_DATA_OWNER 액터가 권한·업무분리 정책에 따라 프로세스 단계 실행 작업공간 업무를 수행한다."
    ],
    "entryConditions": [
      "인증된 계정에 테넌트·프로젝트·단계 액터 배정이 활성이고 이전 단계의 상태와 데이터 계약이 충족되어야 한다."
    ],
    "exitConditions": [
      "서버 명령·현재 상태·멱등키·필수 처리 내용이 검증되고 실행 이벤트와 결과 스냅샷이 저장되며 다음 단계와 액터가 결정되어야 한다."
    ],
    "states": [
      "LOADING",
      "READY",
      "NOT_STARTED",
      "RUNNING",
      "COMPLETING",
      "COMPLETED",
      "VALIDATION_ERROR",
      "ERROR",
      "AUTHORITY_DENIED",
      "FORBIDDEN",
      "DEPENDENCY_BLOCKED",
      "CONFLICT",
      "SERVER_ERROR",
      "SESSION_EXPIRED",
      "EMPTY"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "권한 없는 실행 0건"
      },
      {
        "code": "KPI_2",
        "label": "중복 상태 전이 0건"
      },
      {
        "code": "KPI_3",
        "label": "완료 이벤트 저장률 100%"
      },
      {
        "code": "KPI_4",
        "label": "다음 액터 인계율 100%"
      },
      {
        "code": "KPI_5",
        "label": "감사 스냅샷 누락 0건"
      }
    ],
    "sections": [
      {
        "id": "process-context"
      },
      {
        "id": "execution-step-rail"
      },
      {
        "id": "step-contract"
      },
      {
        "id": "work-evidence-form"
      },
      {
        "id": "transition-actions"
      },
      {
        "id": "audit-history"
      }
    ],
    "fields": [
      {
        "source": "framework_account_actor_assignment.tenant_id",
        "editable": true,
        "required": true,
        "fieldCode": "tenantId",
        "apiProperty": "query.tenantId"
      },
      {
        "source": "framework_process_execution.project_id",
        "editable": true,
        "required": true,
        "fieldCode": "projectId",
        "apiProperty": "query.projectId"
      },
      {
        "source": "framework_process_definition.process_code",
        "editable": true,
        "required": true,
        "fieldCode": "processCode",
        "apiProperty": "query.processCode"
      },
      {
        "source": "framework_process_definition.process_name",
        "editable": false,
        "required": true,
        "fieldCode": "processName",
        "apiProperty": "processes[].processName"
      },
      {
        "source": "framework_process_definition.process_version",
        "editable": false,
        "required": true,
        "fieldCode": "processVersion",
        "apiProperty": "processes[].version"
      },
      {
        "source": "framework_process_execution.execution_id",
        "editable": false,
        "required": false,
        "fieldCode": "executionId",
        "apiProperty": "execution.executionId"
      },
      {
        "source": "framework_process_execution.execution_status",
        "editable": false,
        "required": false,
        "fieldCode": "executionStatus",
        "apiProperty": "execution.executionStatus"
      },
      {
        "source": "framework_process_execution.current_state",
        "editable": false,
        "required": false,
        "fieldCode": "currentState",
        "apiProperty": "execution.currentState"
      },
      {
        "source": "framework_process_execution.current_step_code",
        "editable": false,
        "required": false,
        "fieldCode": "currentStepCode",
        "apiProperty": "execution.currentStepCode"
      },
      {
        "source": "framework_process_step.step_order",
        "editable": false,
        "required": true,
        "fieldCode": "stepOrder",
        "apiProperty": "steps[].stepOrder"
      },
      {
        "source": "framework_process_step.step_code",
        "editable": true,
        "required": true,
        "fieldCode": "stepCode",
        "apiProperty": "steps[].stepCode"
      },
      {
        "source": "framework_process_step.step_name",
        "editable": false,
        "required": true,
        "fieldCode": "stepName",
        "apiProperty": "steps[].stepName"
      },
      {
        "source": "framework_process_step.actor_code",
        "editable": false,
        "required": true,
        "fieldCode": "actorCode",
        "apiProperty": "steps[].actorCode"
      },
      {
        "source": "framework_process_step.from_state",
        "editable": false,
        "required": true,
        "fieldCode": "fromState",
        "apiProperty": "steps[].fromState"
      },
      {
        "source": "framework_process_step.command_code",
        "editable": false,
        "required": true,
        "fieldCode": "commandCode",
        "apiProperty": "steps[].commandCode"
      },
      {
        "source": "framework_process_step.to_state",
        "editable": false,
        "required": true,
        "fieldCode": "toState",
        "apiProperty": "steps[].toState"
      },
      {
        "source": "framework_process_step.requirement_text",
        "editable": false,
        "required": true,
        "fieldCode": "requirementText",
        "apiProperty": "steps[].requirementText"
      },
      {
        "source": "framework_process_step.completion_rule",
        "editable": false,
        "required": true,
        "fieldCode": "completionRule",
        "apiProperty": "steps[].completionRule"
      },
      {
        "source": "framework_process_step.input_contract",
        "editable": false,
        "required": true,
        "fieldCode": "inputContract",
        "apiProperty": "steps[].inputContract"
      },
      {
        "source": "framework_process_step.output_contract",
        "editable": false,
        "required": true,
        "fieldCode": "outputContract",
        "apiProperty": "steps[].outputContract"
      },
      {
        "source": "framework_process_step.api_contract",
        "editable": false,
        "required": false,
        "fieldCode": "apiContract",
        "apiProperty": "steps[].apiContract"
      },
      {
        "source": "framework_process_step.user_path",
        "editable": false,
        "required": false,
        "fieldCode": "userPath",
        "apiProperty": "steps[].userPath"
      },
      {
        "source": "framework_process_step.admin_path",
        "editable": false,
        "required": false,
        "fieldCode": "adminPath",
        "apiProperty": "steps[].adminPath"
      },
      {
        "source": "framework_process_execution_event.request_json",
        "editable": true,
        "required": true,
        "fieldCode": "workNote",
        "apiProperty": "command.requestJson.workNote"
      },
      {
        "source": "framework_process_execution_event.request_json",
        "editable": true,
        "required": false,
        "fieldCode": "evidenceRef",
        "apiProperty": "command.requestJson.evidenceRef"
      },
      {
        "source": "framework_process_execution_event.idempotency_key",
        "editable": false,
        "required": true,
        "fieldCode": "idempotencyKey",
        "apiProperty": "command.idempotencyKey"
      },
      {
        "source": "framework_process_execution_event.request_json",
        "editable": false,
        "required": true,
        "fieldCode": "requestJson",
        "apiProperty": "command.requestJson"
      },
      {
        "source": "framework_process_execution_event.result_json",
        "editable": false,
        "required": true,
        "fieldCode": "resultJson",
        "apiProperty": "command.resultJson"
      },
      {
        "source": "framework_process_execution_event.event_id",
        "editable": false,
        "required": false,
        "fieldCode": "eventId",
        "apiProperty": "events[].eventId"
      },
      {
        "source": "framework_process_execution_event.actor_code",
        "editable": false,
        "required": false,
        "fieldCode": "eventActor",
        "apiProperty": "events[].actorCode"
      },
      {
        "source": "framework_process_execution_event.command_code",
        "editable": false,
        "required": false,
        "fieldCode": "eventCommand",
        "apiProperty": "events[].commandCode"
      },
      {
        "source": "framework_process_execution_event.from_state",
        "editable": false,
        "required": false,
        "fieldCode": "eventFromState",
        "apiProperty": "events[].fromState"
      },
      {
        "source": "framework_process_execution_event.to_state",
        "editable": false,
        "required": false,
        "fieldCode": "eventToState",
        "apiProperty": "events[].toState"
      },
      {
        "source": "framework_process_execution_event.executed_at",
        "editable": false,
        "required": false,
        "fieldCode": "eventAt",
        "apiProperty": "events[].executedAt"
      }
    ],
    "actions": [
      {
        "code": "LOAD_EXECUTION",
        "method": "GET"
      },
      {
        "code": "START_EXECUTION",
        "guard": "first step actor",
        "method": "POST"
      },
      {
        "code": "SELECT_STEP",
        "guard": "process step"
      },
      {
        "code": "COMPLETE_STEP",
        "guard": "current step + actor + state + evidence",
        "method": "POST",
        "idempotent": true
      },
      {
        "code": "CONTINUE_NEXT",
        "effect": "next step and actor handoff"
      }
    ],
    "apiContracts": [
      {
        "path": "/admin/api/system/actor-process",
        "method": "GET"
      },
      {
        "path": "/home/api/process-executions",
        "scope": "account actor + tenant + project + process",
        "method": "GET"
      },
      {
        "path": "/home/api/process-executions/start",
        "method": "POST"
      },
      {
        "path": "/home/api/process-executions/{executionId}/commands",
        "method": "POST",
        "idempotency": "required"
      }
    ],
    "dataContracts": [
      {
        "entity": "framework_process_definition",
        "version": "2.0.0"
      },
      {
        "entity": "framework_process_step",
        "relation": "state transition contract"
      },
      {
        "scope": "active account actor",
        "entity": "framework_account_actor_assignment"
      },
      {
        "lock": "running execution",
        "entity": "framework_process_execution"
      },
      {
        "entity": "framework_process_execution_event",
        "unique": "execution + idempotency key"
      }
    ],
    "permissions": [
      {
        "code": "SITE_DATA_OWNER",
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
    "completionRule": "서버 명령·현재 상태·멱등키·필수 처리 내용이 검증되고 실행 이벤트와 결과 스냅샷이 저장되며 다음 단계와 액터가 결정되어야 한다.",
    "extensions": {
      "contractId": 742,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 742,
    "requirementIds": [
      "EMISSION_PROJECT:EMISSION_PROJECT_COLLECT:ADMIN"
    ],
    "generationBatchId": 81,
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
