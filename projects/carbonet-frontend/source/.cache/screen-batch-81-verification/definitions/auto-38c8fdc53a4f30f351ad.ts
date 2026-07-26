import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_38c8fdc53a4f30f351ad = {
  "id": "auto-38c8fdc53a4f30f351ad",
  "blueprintCode": "BP_AUTO_38C8FDC53A4F30F351AD57F4",
  "processCode": "EMISSION_PROJECT",
  "stepCode": "EMISSION_PROJECT_COLLECT",
  "actorCode": "SITE_DATA_OWNER",
  "audience": "USER",
  "pageId": "AUTO_38C8FDC53A4F30F351AD",
  "pageName": "전문 업무 실행",
  "routePath": "/work/execution",
  "screenType": "CONTENT",
  "templateCode": "KRDS_CONTENT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "프로젝트 액터가 배정된 업무의 입력, 판단 근거, 정량 결과, 증빙과 예외를 버전 관리로 저장하고 서버 상태 전이 규칙에 따라 완료하여 다음 액터에게 인계한다.",
    "actorResponsibilities": [
      "SITE_DATA_OWNER 액터가 권한·업무분리 정책에 따라 전문 업무 실행 업무를 수행한다."
    ],
    "entryConditions": [
      "인증된 계정에 테넌트와 프로젝트의 유효한 액터 배정이 있고 선택 단계가 서버의 현재 실행 단계와 일치해야 한다."
    ],
    "exitConditions": [
      "필수 결과와 판단 근거 및 증빙이 저장되고 멱등 완료 명령과 감사 이벤트가 생성되며 다음 단계와 담당 액터가 결정되어야 한다."
    ],
    "states": [
      "LOADING",
      "NOT_SAVED",
      "DRAFT",
      "READY",
      "SAVING",
      "VALIDATING",
      "COMPLETING",
      "SUBMITTED",
      "COMPLETED",
      "VERSION_CONFLICT",
      "VALIDATION_ERROR",
      "ERROR",
      "FORBIDDEN",
      "SESSION_EXPIRED",
      "EMPTY"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "권한 없는 접근 0건"
      },
      {
        "code": "KPI_2",
        "label": "임시저장 충돌 유실 0건"
      },
      {
        "code": "KPI_3",
        "label": "필수 입력·증빙 충족률 100%"
      },
      {
        "code": "KPI_4",
        "label": "중복 완료 0건"
      },
      {
        "code": "KPI_5",
        "label": "다음 액터 인계율 100%"
      }
    ],
    "sections": [
      {
        "id": "work-context"
      },
      {
        "id": "step-contract"
      },
      {
        "id": "work-result"
      },
      {
        "id": "evidence-lineage"
      },
      {
        "id": "completion-checks"
      },
      {
        "id": "work-actions"
      },
      {
        "id": "audit-history"
      },
      {
        "id": "next-handoff"
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
        "source": "framework_process_step.step_code",
        "editable": true,
        "required": true,
        "fieldCode": "stepCode",
        "apiProperty": "query.stepCode"
      },
      {
        "source": "framework_process_step.step_name",
        "editable": false,
        "required": true,
        "fieldCode": "stepName",
        "apiProperty": "contract.stepName"
      },
      {
        "source": "framework_process_step.actor_code",
        "editable": false,
        "required": true,
        "fieldCode": "actorCode",
        "apiProperty": "contract.actorCode"
      },
      {
        "source": "framework_process_step.command_code",
        "editable": false,
        "required": true,
        "fieldCode": "commandCode",
        "apiProperty": "contract.commandCode"
      },
      {
        "source": "framework_process_step.from_state",
        "editable": false,
        "required": true,
        "fieldCode": "fromState",
        "apiProperty": "contract.fromState"
      },
      {
        "source": "framework_process_step.to_state",
        "editable": false,
        "required": true,
        "fieldCode": "toState",
        "apiProperty": "contract.toState"
      },
      {
        "source": "framework_process_step.requirement_text",
        "editable": false,
        "required": true,
        "fieldCode": "requirementText",
        "apiProperty": "contract.requirementText"
      },
      {
        "source": "framework_process_step.completion_rule",
        "editable": false,
        "required": true,
        "fieldCode": "completionRule",
        "apiProperty": "contract.completionRule"
      },
      {
        "source": "framework_process_step.input_contract",
        "editable": false,
        "required": true,
        "fieldCode": "inputContract",
        "apiProperty": "contract.inputContract"
      },
      {
        "source": "framework_process_step.output_contract",
        "editable": false,
        "required": true,
        "fieldCode": "outputContract",
        "apiProperty": "contract.outputContract"
      },
      {
        "source": "framework_process_work_draft.draft_id",
        "editable": false,
        "required": false,
        "fieldCode": "draftId",
        "apiProperty": "draft.draftId"
      },
      {
        "source": "framework_process_work_draft.draft_version",
        "editable": false,
        "required": true,
        "fieldCode": "draftVersion",
        "apiProperty": "draft.draftVersion"
      },
      {
        "source": "framework_process_work_draft.draft_status",
        "editable": false,
        "required": true,
        "fieldCode": "draftStatus",
        "apiProperty": "draft.draftStatus"
      },
      {
        "source": "framework_process_work_draft.payload_json",
        "editable": true,
        "required": true,
        "fieldCode": "workSummary",
        "apiProperty": "draft.payloadJson.workSummary"
      },
      {
        "source": "framework_process_work_draft.payload_json",
        "editable": true,
        "required": true,
        "fieldCode": "decisionBasis",
        "apiProperty": "draft.payloadJson.decisionBasis"
      },
      {
        "source": "framework_process_work_draft.payload_json",
        "editable": true,
        "required": false,
        "fieldCode": "resultValue",
        "apiProperty": "draft.payloadJson.resultValue"
      },
      {
        "source": "framework_process_work_draft.payload_json",
        "editable": true,
        "required": false,
        "fieldCode": "resultUnit",
        "apiProperty": "draft.payloadJson.resultUnit"
      },
      {
        "source": "framework_process_work_draft.payload_json",
        "editable": true,
        "required": false,
        "fieldCode": "exceptionReason",
        "apiProperty": "draft.payloadJson.exceptionReason"
      },
      {
        "source": "framework_process_work_draft.evidence_json",
        "editable": true,
        "required": true,
        "fieldCode": "documentId",
        "apiProperty": "draft.evidenceJson.documentId"
      },
      {
        "source": "framework_process_work_draft.evidence_json",
        "editable": true,
        "required": false,
        "fieldCode": "sourceUrl",
        "apiProperty": "draft.evidenceJson.sourceUrl"
      },
      {
        "source": "framework_process_work_draft.evidence_json",
        "editable": true,
        "required": false,
        "fieldCode": "checksum",
        "apiProperty": "draft.evidenceJson.checksum"
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
        "source": "framework_process_execution.current_step_code",
        "editable": false,
        "required": false,
        "fieldCode": "currentStepCode",
        "apiProperty": "execution.currentStepCode"
      },
      {
        "source": "framework_process_execution.current_state",
        "editable": false,
        "required": false,
        "fieldCode": "currentState",
        "apiProperty": "execution.currentState"
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
        "source": "framework_process_execution_event.to_state",
        "editable": false,
        "required": false,
        "fieldCode": "eventTransition",
        "apiProperty": "events[].fromState+toState"
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
        "code": "LOAD_WORK",
        "method": "GET"
      },
      {
        "code": "SAVE_DRAFT",
        "method": "PUT",
        "optimisticVersion": true
      },
      {
        "code": "START_PROCESS",
        "guard": "first step actor",
        "method": "POST"
      },
      {
        "code": "VALIDATE_COMPLETE",
        "guard": "required fields + evidence + current actor/state",
        "method": "POST",
        "idempotent": true
      },
      {
        "code": "CONTINUE_NEXT",
        "effect": "next actor handoff"
      }
    ],
    "apiContracts": [
      {
        "path": "/home/api/process-executions/draft",
        "method": "GET"
      },
      {
        "path": "/home/api/process-executions/draft",
        "method": "PUT",
        "version": "expectedVersion"
      },
      {
        "path": "/home/api/process-executions",
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
        "entity": "framework_process_work_draft",
        "unique": "tenant+project+process+step+account",
        "version": "2.0.0",
        "optimistic": "draft_version"
      },
      {
        "scope": "active and date-valid",
        "entity": "framework_account_actor_assignment"
      },
      {
        "state": "server authoritative",
        "entity": "framework_process_execution"
      },
      {
        "audit": "immutable transition",
        "entity": "framework_process_execution_event"
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
    "completionRule": "필수 결과와 판단 근거 및 증빙이 저장되고 멱등 완료 명령과 감사 이벤트가 생성되며 다음 단계와 담당 액터가 결정되어야 한다.",
    "extensions": {
      "contractId": 744,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 744,
    "requirementIds": [
      "EMISSION_PROJECT:EMISSION_PROJECT_COLLECT:USER"
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
