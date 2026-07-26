import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_33a9a63b147bc707370a = {
  "id": "auto-33a9a63b147bc707370a",
  "blueprintCode": "BP_AUTO_33A9A63B147BC707370AC825",
  "processCode": "SCHEDULED_STATISTICS_REPORTING",
  "stepCode": "SSR_DEFINE",
  "actorCode": "DATA_ANALYST",
  "audience": "USER",
  "pageId": "AUTO_33A9A63B147BC707370A",
  "pageName": "지표·주기·기준시점 확정 사용자 업무 화면",
  "routePath": "/work/scheduled-statistics-reporting",
  "screenType": "REPORT",
  "templateCode": "KRDS_REPORT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "설비·시장·배출·인증·수수료 지표와 집계식·일정·수신처를 정의한다.",
    "actorResponsibilities": [
      "DATA_ANALYST 액터가 권한·업무분리 정책에 따라 지표·주기·기준시점 확정 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 지표 정의·집계 기준·데이터 기준시점·수신기관·일정이 승인되어 있다.. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "버전 잠긴 지표·집계·배포 계약이 승인됨"
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
        "label": "DEFINE_STATISTICS_JOB"
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
        "label": "/api/work/scheduled-statistics-reporting/ssr_define"
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
        "code": "DATA_ANALYST",
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
    "completionRule": "버전 잠긴 지표·집계·배포 계약이 승인됨",
    "extensions": {
      "contractId": 484,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 484,
    "requirementIds": [
      "SCHEDULED_STATISTICS_REPORTING:SSR_DEFINE:USER"
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
