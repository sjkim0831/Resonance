import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_d26e4331c1bee0da5110 = {
  "id": "auto-d26e4331c1bee0da5110",
  "blueprintCode": "BP_AUTO_D26E4331C1BEE0DA5110C099",
  "processCode": "COMPANY_MANAGER_DELEGATION",
  "stepCode": "CMD_REQUEST",
  "actorCode": "COMPANY_ADMIN",
  "audience": "USER",
  "pageId": "AUTO_D26E4331C1BEE0DA5110",
  "pageName": "위임·승계 요청과 후보 검증 사용자 업무 화면",
  "routePath": "/work/company-manager-delegation",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "위임 범위·기간·사유·후임자 재직·미결업무를 확인한다.",
    "actorResponsibilities": [
      "COMPANY_ADMIN 액터가 권한·업무분리 정책에 따라 위임·승계 요청과 후보 검증 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 승인된 회원사와 유효한 기존·후임 담당자 후보가 존재한다.. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "유효 후보와 인계 대상 업무가 확정됨"
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "BLOCKED",
      "CONFLICT",
      "COMPLETED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "진행률"
      },
      {
        "code": "KPI_2",
        "label": "기한"
      },
      {
        "code": "KPI_3",
        "label": "차단건"
      },
      {
        "code": "KPI_4",
        "label": "미결 증적"
      },
      {
        "code": "KPI_5",
        "label": "후속업무"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "업무요약"
      },
      {
        "code": "SECTION_2",
        "label": "선행조건"
      },
      {
        "code": "SECTION_3",
        "label": "전문 데이터"
      },
      {
        "code": "SECTION_4",
        "label": "검증·증적"
      },
      {
        "code": "SECTION_5",
        "label": "결정·이력"
      },
      {
        "code": "SECTION_6",
        "label": "다음업무"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "tenantId"
      },
      {
        "code": "FIELD_2",
        "label": "projectId"
      },
      {
        "code": "FIELD_3",
        "label": "businessId"
      },
      {
        "code": "FIELD_4",
        "label": "referenceCode"
      },
      {
        "code": "FIELD_5",
        "label": "statusCode"
      },
      {
        "code": "FIELD_6",
        "label": "effectiveAt"
      },
      {
        "code": "FIELD_7",
        "label": "quantityValue"
      },
      {
        "code": "FIELD_8",
        "label": "unitCode"
      },
      {
        "code": "FIELD_9",
        "label": "qualityCode"
      },
      {
        "code": "FIELD_10",
        "label": "externalCheckStatus"
      },
      {
        "code": "FIELD_11",
        "label": "evidenceIds"
      },
      {
        "code": "FIELD_12",
        "label": "decisionCode"
      },
      {
        "code": "FIELD_13",
        "label": "decisionComment"
      },
      {
        "code": "FIELD_14",
        "label": "rowVersion"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "REQUEST_MANAGER_DELEGATION"
      },
      {
        "code": "ACTION_2",
        "label": "SAVE_DRAFT"
      },
      {
        "code": "ACTION_3",
        "label": "REQUEST_CORRECTION"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "/api/work/company-manager-delegation/cmd_request"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "tenantId"
      },
      {
        "code": "DATA_2",
        "label": "projectId"
      },
      {
        "code": "DATA_3",
        "label": "businessId"
      },
      {
        "code": "DATA_4",
        "label": "recordId"
      },
      {
        "code": "DATA_5",
        "label": "statusCode"
      },
      {
        "code": "DATA_6",
        "label": "rowVersion"
      },
      {
        "code": "DATA_7",
        "label": "evidenceHash"
      },
      {
        "code": "DATA_8",
        "label": "nextTaskId"
      }
    ],
    "permissions": [
      {
        "code": "COMPANY_ADMIN",
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
    "completionRule": "유효 후보와 인계 대상 업무가 확정됨",
    "extensions": {
      "contractId": 472,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 472,
    "requirementIds": [
      "COMPANY_MANAGER_DELEGATION:CMD_REQUEST:USER"
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
