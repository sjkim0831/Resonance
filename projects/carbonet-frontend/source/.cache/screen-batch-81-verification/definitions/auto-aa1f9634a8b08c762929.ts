import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_aa1f9634a8b08c762929 = {
  "id": "auto-aa1f9634a8b08c762929",
  "blueprintCode": "BP_AUTO_AA1F9634A8B08C7629299CEC",
  "processCode": "LCA_ALLOCATION_SENSITIVITY",
  "stepCode": "LCA_ALLOCATION_SENSITIVITY_S4",
  "actorCode": "APPROVER",
  "audience": "ADMIN",
  "pageId": "AUTO_AA1F9634A8B08C762929",
  "pageName": "규칙 정당성·결론 승인 관리자 업무 화면",
  "routePath": "/admin/generated/lca-allocation-sensitivity/lca-allocation-sensitivity-s4",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "할당·민감도 분석 프로세스의 규칙 정당성·결론 승인 단계에서 APPROVER 액터가 LCA_ALLOCATION_SENSITIVITY_EXECUTE_4 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 규칙 정당성·결론 승인의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
    "actorResponsibilities": [
      "APPROVER 액터가 권한·업무분리 정책에 따라 규칙 정당성·결론 승인 관리자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 공정 산출물, 질량·경제가치·물리관계 자료가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "다음 완료 기준을 검증한다: 규칙 정당성·결론 승인의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_4_COMPLETED 상태로 원자적으로 전이한다."
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
        "label": "규칙 정당성·결론 승인 완료율"
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
          "actorCode": "APPROVER",
          "projectId": "required",
          "stepOrder": 4,
          "processCode": "LCA_ALLOCATION_SENSITIVITY",
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
        "code": "LCA_ALLOCATION_SENSITIVITY_EXECUTE_4",
        "label": "규칙 정당성·결론 승인 실행",
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
        "code": "LCA_ALLOCATION_SENSITIVITY_EXECUTE_4",
        "path": "/home/api/process-executions/{executionId}/commands",
        "method": "POST",
        "purpose": "규칙 정당성·결론 승인 상태 명령 실행"
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
        "code": "APPROVER",
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
    "completionRule": "다음 완료 기준을 검증한다: 규칙 정당성·결론 승인의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_4_COMPLETED 상태로 원자적으로 전이한다.",
    "extensions": {
      "contractId": 3755,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 3755,
    "requirementIds": [
      "LCA_ALLOCATION_SENSITIVITY:LCA_ALLOCATION_SENSITIVITY_S4:ADMIN"
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
