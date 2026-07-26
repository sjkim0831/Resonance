import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_ec6d6f9f7fa725fe4aca = {
  "id": "auto-ec6d6f9f7fa725fe4aca",
  "blueprintCode": "BP_AUTO_EC6D6F9F7FA725FE4ACA9EE0",
  "processCode": "CCUS_LIFECYCLE_MRV",
  "stepCode": "CCUS_LIFECYCLE_MRV_S1",
  "actorCode": "CALCULATOR",
  "audience": "ADMIN",
  "pageId": "AUTO_EC6D6F9F7FA725FE4ACA",
  "pageName": "시설경계·기준선 확정 관리자 업무 화면",
  "routePath": "/admin/generated/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s1",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "CCUS 전과정 MRV 프로세스의 시설경계·기준선 확정 단계에서 CALCULATOR 액터가 CCUS_LIFECYCLE_MRV_EXECUTE_1 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 시설경계·기준선 확정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
    "actorResponsibilities": [
      "CALCULATOR 액터가 권한·업무분리 정책에 따라 시설경계·기준선 확정 관리자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 시설 경계, 측정 지점, 기준선과 모니터링 계획이 승인되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "다음 완료 기준을 검증한다: 시설경계·기준선 확정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_1_COMPLETED 상태로 원자적으로 전이한다."
    ],
    "states": [
      "READY",
      "LOADING",
      "EMPTY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_1_COMPLETED"
    ],
    "kpis": [
      {
        "code": "COMPLETION_RATE",
        "unit": "PERCENT",
        "label": "시설경계·기준선 확정 완료율"
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
          "actorCode": "CALCULATOR",
          "projectId": "required",
          "stepOrder": 1,
          "processCode": "CCUS_LIFECYCLE_MRV",
          "idempotencyKey": "required"
        },
        "required": true
      },
      {
        "code": "OUTPUT_CONTRACT",
        "label": "산출물 계약",
        "contract": {
          "state": "STEP_1_COMPLETED",
          "evidence": "required",
          "auditEvent": "required",
          "nextTaskCreated": true
        },
        "required": true
      }
    ],
    "actions": [
      {
        "code": "CCUS_LIFECYCLE_MRV_EXECUTE_1",
        "label": "시설경계·기준선 확정 실행",
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
        "code": "CCUS_LIFECYCLE_MRV_EXECUTE_1",
        "path": "/home/api/process-executions/{executionId}/commands",
        "method": "POST",
        "purpose": "시설경계·기준선 확정 상태 명령 실행"
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
          "to": "STEP_1_COMPLETED",
          "from": "READY"
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
        "code": "CALCULATOR",
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
    "completionRule": "다음 완료 기준을 검증한다: 시설경계·기준선 확정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_1_COMPLETED 상태로 원자적으로 전이한다.",
    "extensions": {
      "contractId": 3725,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 3725,
    "requirementIds": [
      "CCUS_LIFECYCLE_MRV:CCUS_LIFECYCLE_MRV_S1:ADMIN"
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
