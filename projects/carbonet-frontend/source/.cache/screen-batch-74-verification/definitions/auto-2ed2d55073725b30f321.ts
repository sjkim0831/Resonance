import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_2ed2d55073725b30f321 = {
  "id": "auto-2ed2d55073725b30f321",
  "blueprintCode": "BP_AUTO_2ED2D55073725B30F321B613",
  "processCode": "LEAKAGE_INCIDENT_RESPONSE",
  "stepCode": "LEAKAGE_INCIDENT_RESPONSE_S4",
  "actorCode": "COMPANY_MANAGER",
  "audience": "ADMIN",
  "pageId": "AUTO_2ED2D55073725B30F321",
  "pageName": "원인분석·시정·재가동 승인 관리자 업무 화면",
  "routePath": "/admin/generated/leakage-incident-response/leakage-incident-response-s4",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "누출·사고·비상대응 프로세스의 원인분석·시정·재가동 승인 단계에서 COMPANY_MANAGER 액터가 LEAKAGE_INCIDENT_RESPONSE_EXECUTE_4 명령을 안전하게 수행하고 원인분석·시정·재가동 승인의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.를 완료한다.",
    "actorResponsibilities": [
      "COMPANY_MANAGER 액터가 권한·업무분리 정책에 따라 원인분석·시정·재가동 승인 관리자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "비상연락망, 경보 임계치, 대응 절차와 책임자가 승인되어 있다.을 충족하고 현재 상태가 STEP_3_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우 진입한다."
    ],
    "exitConditions": [
      "원인분석·시정·재가동 승인의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.을 검증하고 결과·버전·감사 증적을 저장한 뒤 STEP_4_COMPLETED 상태로 원자적으로 전이한다."
    ],
    "states": [
      "STEP_3_COMPLETED",
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_4_COMPLETED"
    ],
    "kpis": [
      {
        "code": "COMPLETION_RATE",
        "unit": "PERCENT",
        "label": "원인분석·시정·재가동 승인 완료율"
      },
      {
        "code": "SLA_REMAINING",
        "unit": "MINUTE",
        "label": "처리 기한 잔여시간"
      },
      {
        "code": "BLOCKING_ERROR",
        "unit": "COUNT",
        "label": "차단 오류 수"
      },
      {
        "code": "RECOVERY_RATE",
        "unit": "PERCENT",
        "label": "오류 복구 성공률"
      }
    ],
    "sections": [
      {
        "code": "TASK_CONTEXT",
        "label": "업무 문맥·진행 상태"
      },
      {
        "code": "SEARCH_FILTER",
        "label": "검색·필터"
      },
      {
        "code": "WORKSPACE",
        "label": "핵심 데이터 작업공간"
      },
      {
        "code": "EVIDENCE_HISTORY",
        "label": "증적·변경 이력"
      },
      {
        "code": "NEXT_TASK",
        "label": "다음 업무"
      }
    ],
    "fields": [
      {
        "code": "TENANT_ID",
        "label": "테넌트",
        "editable": false,
        "required": true
      },
      {
        "code": "PROJECT_ID",
        "label": "프로젝트",
        "editable": false,
        "required": true
      },
      {
        "code": "PROCESS_CODE",
        "label": "프로세스",
        "editable": false,
        "required": true
      },
      {
        "code": "STEP_CODE",
        "label": "업무 단계",
        "editable": false,
        "required": true
      },
      {
        "code": "ACTOR_CODE",
        "label": "담당 액터",
        "editable": false,
        "required": true
      },
      {
        "code": "ROW_VERSION",
        "label": "버전",
        "editable": false,
        "required": true
      },
      {
        "code": "INPUT_CONTRACT",
        "label": "입력 계약",
        "contract": {
          "tenantId": "required",
          "actorCode": "COMPANY_MANAGER",
          "projectId": "required",
          "stepOrder": 4,
          "processCode": "LEAKAGE_INCIDENT_RESPONSE",
          "idempotencyKey": "required"
        },
        "required": true
      },
      {
        "code": "OUTPUT_CONTRACT",
        "label": "산출물 계약",
        "contract": {
          "state": "STEP_4_COMPLETED",
          "evidence": "required",
          "auditEvent": "required",
          "nextTaskCreated": false
        },
        "required": true
      }
    ],
    "actions": [
      {
        "code": "LEAKAGE_INCIDENT_RESPONSE_EXECUTE_4",
        "label": "원인분석·시정·재가동 승인 실행",
        "transactional": true,
        "idempotencyRequired": true
      },
      {
        "code": "SAVE_DRAFT",
        "label": "임시저장",
        "transactional": true
      },
      {
        "code": "ATTACH_EVIDENCE",
        "label": "증적 연결",
        "auditRequired": true
      },
      {
        "code": "MOVE_NEXT_TASK",
        "label": "다음 업무 이동",
        "completionRequired": true
      }
    ],
    "apiContracts": [
      {
        "code": "SCREEN_CONTRACT",
        "path": "/home/api/process-executions/screen-contract",
        "method": "GET",
        "purpose": "라우트별 실행 계약 조회"
      },
      {
        "code": "LOAD_EXECUTION",
        "path": "/home/api/process-executions",
        "method": "GET",
        "purpose": "프로세스 실행 문맥 조회"
      },
      {
        "code": "LEAKAGE_INCIDENT_RESPONSE_EXECUTE_4",
        "path": "/home/api/process-executions/{executionId}/commands",
        "method": "POST",
        "purpose": "원인분석·시정·재가동 승인 상태 명령 실행"
      },
      {
        "code": "LOAD_DRAFT",
        "path": "/home/api/process-executions/draft",
        "method": "GET",
        "purpose": "업무 임시저장 조회"
      },
      {
        "code": "SAVE_DRAFT",
        "path": "/home/api/process-executions/draft",
        "method": "PUT",
        "purpose": "업무 임시저장"
      }
    ],
    "dataContracts": [
      {
        "keys": [
          "tenantId",
          "projectId",
          "processCode"
        ],
        "entity": "PROCESS_EXECUTION",
        "versioned": true,
        "tenantScoped": true
      },
      {
        "keys": [
          "processCode",
          "stepCode"
        ],
        "entity": "PROCESS_STEP",
        "stateTransition": {
          "to": "STEP_4_COMPLETED",
          "from": "STEP_3_COMPLETED"
        }
      },
      {
        "keys": [
          "tenantId",
          "projectId",
          "processCode",
          "stepCode",
          "actorCode"
        ],
        "entity": "WORK_DRAFT",
        "versioned": true
      },
      {
        "entity": "AUDIT_EVENT",
        "appendOnly": true,
        "beforeAfterRequired": true
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
    "completionRule": "원인분석·시정·재가동 승인의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.을 검증하고 결과·버전·감사 증적을 저장한 뒤 STEP_4_COMPLETED 상태로 원자적으로 전이한다.",
    "extensions": {
      "contractId": 3771,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 3771,
    "requirementIds": [
      "LEAKAGE_INCIDENT_RESPONSE:LEAKAGE_INCIDENT_RESPONSE_S4:ADMIN"
    ],
    "generationBatchId": 74,
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
