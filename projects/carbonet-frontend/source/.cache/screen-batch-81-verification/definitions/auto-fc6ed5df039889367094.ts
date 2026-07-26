import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_fc6ed5df039889367094 = {
  "id": "auto-fc6ed5df039889367094",
  "blueprintCode": "BP_AUTO_FC6ED5DF0398893670941F42",
  "processCode": "LEGAL_NOTIFICATION_DELIVERY",
  "stepCode": "LND_COMPOSE",
  "actorCode": "PLATFORM_OPERATOR",
  "audience": "ADMIN",
  "pageId": "AUTO_FC6ED5DF039889367094",
  "pageName": "통지 사건·템플릿·대상 확정 관리자 업무 화면",
  "routePath": "/admin/work/legal-notification-delivery",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "업무 사건과 법적 문구·언어·대상·동의·기한·우선채널을 확정한다.",
    "actorResponsibilities": [
      "PLATFORM_OPERATOR 액터가 권한·업무분리 정책에 따라 통지 사건·템플릿·대상 확정 관리자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 통지 사건·대상자·동의·템플릿·우선 채널·대체 채널 정책이 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "개인정보 최소화된 불변 통지 스냅샷이 생성됨"
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
        "label": "COMPOSE_LEGAL_NOTICE"
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
        "label": "/api/work/legal-notification-delivery/lnd_compose"
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
        "code": "PLATFORM_OPERATOR",
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
    "completionRule": "개인정보 최소화된 불변 통지 스냅샷이 생성됨",
    "extensions": {
      "contractId": 497,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 497,
    "requirementIds": [
      "LEGAL_NOTIFICATION_DELIVERY:LND_COMPOSE:ADMIN"
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
