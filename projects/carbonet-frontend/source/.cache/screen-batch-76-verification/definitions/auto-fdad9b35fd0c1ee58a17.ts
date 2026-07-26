import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_fdad9b35fd0c1ee58a17 = {
  "id": "auto-fdad9b35fd0c1ee58a17",
  "blueprintCode": "BP_AUTO_FDAD9B35FD0C1EE58A17F9B9",
  "processCode": "TRADE_EXECUTION_TRACKING",
  "stepCode": "TRADE_EXECUTION_TRACKING_S3",
  "actorCode": "VERIFIER",
  "audience": "ADMIN",
  "pageId": "AUTO_FDAD9B35FD0C1EE58A17",
  "pageName": "거래 이행·인수인계 - 독립 검토·보완·권한 검증 관리자 업무 화면",
  "routePath": "/admin/generated/trade-execution-tracking/trade-execution-tracking-s3",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "거래 이행·인수인계 프로세스의 거래 이행·인수인계 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 TRADE_EXECUTION_TRACKING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
    "actorResponsibilities": [
      "VERIFIER 액터가 권한·업무분리 정책에 따라 거래 이행·인수인계 - 독립 검토·보완·권한 검증 관리자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다.. 현재 상태는 STEP_2_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.. 결과·버전·감사 증적을 저장한 뒤 STEP_3_COMPLETED 상태로 원자적으로 전이한다."
    ],
    "states": [
      "STEP_2_COMPLETED",
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_3_COMPLETED"
    ],
    "kpis": [
      {
        "code": "COMPLETION_RATE",
        "unit": "PERCENT",
        "label": "거래 이행·인수인계 - 독립 검토·보완·권한 검증 완료율"
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
          "actorCode": "required",
          "projectId": "contextual",
          "idempotencyKey": "required",
          "businessPayload": "required"
        },
        "required": true
      },
      {
        "code": "OUTPUT_CONTRACT",
        "label": "산출물 계약",
        "contract": {
          "state": "STEP_3_COMPLETED",
          "evidence": "required",
          "auditEvent": "required",
          "nextTaskCreated": true
        },
        "required": true
      }
    ],
    "actions": [
      {
        "code": "TRADE_EXECUTION_TRACKING_REVIEW",
        "label": "거래 이행·인수인계 - 독립 검토·보완·권한 검증 실행",
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
        "code": "TRADE_EXECUTION_TRACKING_REVIEW",
        "path": "/home/api/process-executions/{executionId}/commands",
        "method": "POST",
        "purpose": "거래 이행·인수인계 - 독립 검토·보완·권한 검증 상태 명령 실행"
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
          "to": "STEP_3_COMPLETED",
          "from": "STEP_2_COMPLETED"
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
        "code": "VERIFIER",
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
    "completionRule": "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.. 결과·버전·감사 증적을 저장한 뒤 STEP_3_COMPLETED 상태로 원자적으로 전이한다.",
    "extensions": {
      "contractId": 3295,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 3295,
    "requirementIds": [
      "TRADE_EXECUTION_TRACKING:TRADE_EXECUTION_TRACKING_S3:ADMIN"
    ],
    "generationBatchId": 76,
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
