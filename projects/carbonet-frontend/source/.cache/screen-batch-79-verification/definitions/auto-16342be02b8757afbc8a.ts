import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_16342be02b8757afbc8a = {
  "id": "auto-16342be02b8757afbc8a",
  "blueprintCode": "BP_AUTO_16342BE02B8757AFBC8AD193",
  "processCode": "FACILITY_EMERGENCY_RESPONSE",
  "stepCode": "FER_DECLARE",
  "actorCode": "FACILITY_OPERATOR",
  "audience": "USER",
  "pageId": "AUTO_16342BE02B8757AFBC8A",
  "pageName": "사고 탐지·비상 선언 사용자 업무 화면",
  "routePath": "/ccus/facility/facility-emergency-response",
  "screenType": "CONTENT",
  "templateCode": "KRDS_CONTENT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
    "actorResponsibilities": [
      "FACILITY_OPERATOR 액터가 권한·업무분리 정책에 따라 사고 탐지·비상 선언 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 비상대응 조직·연락망·대응계획과 훈련 이력이 유효하다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "비상등급·위치·영향·초동조치가 등록됨"
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "BLOCKED",
      "CONFLICT"
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
        "label": "이상·차단"
      },
      {
        "code": "KPI_4",
        "label": "증빙 완결성"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "업무요약"
      },
      {
        "code": "SECTION_2",
        "label": "검색·필터"
      },
      {
        "code": "SECTION_3",
        "label": "전문 데이터"
      },
      {
        "code": "SECTION_4",
        "label": "증빙·이력"
      },
      {
        "code": "SECTION_5",
        "label": "명령·다음업무"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "projectId"
      },
      {
        "code": "FIELD_2",
        "label": "facilityId"
      },
      {
        "code": "FIELD_3",
        "label": "assetTag"
      },
      {
        "code": "FIELD_4",
        "label": "siteCode"
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
        "label": "measurementValue"
      },
      {
        "code": "FIELD_8",
        "label": "unitCode"
      },
      {
        "code": "FIELD_9",
        "label": "riskLevel"
      },
      {
        "code": "FIELD_10",
        "label": "evidenceIds"
      },
      {
        "code": "FIELD_11",
        "label": "approvalComment"
      },
      {
        "code": "FIELD_12",
        "label": "rowVersion"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "DECLARE_INCIDENT"
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
        "label": "/api/ccus/facility/facility-emergency-response/fer_declare"
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
        "label": "facilityId"
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
      }
    ],
    "permissions": [
      {
        "code": "FACILITY_OPERATOR",
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
    "completionRule": "비상등급·위치·영향·초동조치가 등록됨",
    "extensions": {
      "contractId": 334,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 334,
    "requirementIds": [
      "FACILITY_EMERGENCY_RESPONSE:FER_DECLARE:USER"
    ],
    "generationBatchId": 79,
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
