import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_7f255169f9a6c6d44ffd = {
  "id": "auto-7f255169f9a6c6d44ffd",
  "blueprintCode": "BP_AUTO_7F255169F9A6C6D44FFD86D3",
  "processCode": "FACILITY_ASSET_REGISTRY",
  "stepCode": "FAR_REGISTER",
  "actorCode": "FACILITY_OPERATOR",
  "audience": "ADMIN",
  "pageId": "AUTO_7F255169F9A6C6D44FFD",
  "pageName": "설비·태그·위치 등록 관리자 업무 화면",
  "routePath": "/admin/ccus/facility/facility-asset-registry",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "설비 식별자·공정·위치·사양·용량·위험등급을 등록한다.",
    "actorResponsibilities": [
      "FACILITY_OPERATOR 액터가 권한·업무분리 정책에 따라 설비·태그·위치 등록 관리자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 승인된 사업장과 설비 도입 근거가 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "필수 기준정보와 중복 태그 검사가 완료됨"
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
        "label": "REGISTER_FACILITY"
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
        "label": "/api/ccus/facility/facility-asset-registry/far_register"
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
    "completionRule": "필수 기준정보와 중복 태그 검사가 완료됨",
    "extensions": {
      "contractId": 305,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 305,
    "requirementIds": [
      "FACILITY_ASSET_REGISTRY:FAR_REGISTER:ADMIN"
    ],
    "generationBatchId": 80,
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
