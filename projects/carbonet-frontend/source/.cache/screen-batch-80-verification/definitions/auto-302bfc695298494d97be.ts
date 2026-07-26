import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_302bfc695298494d97be = {
  "id": "auto-302bfc695298494d97be",
  "blueprintCode": "BP_AUTO_302BFC695298494D97BEE562",
  "processCode": "FACILITY_OPERATION_MONITORING",
  "stepCode": "FOM_PLAN",
  "actorCode": "FACILITY_OPERATOR",
  "audience": "USER",
  "pageId": "AUTO_302BFC695298494D97BE",
  "pageName": "운전계획·허용범위 설정 사용자 업무 화면",
  "routePath": "/ccus/facility/facility-operation-monitoring",
  "screenType": "DASHBOARD",
  "templateCode": "KRDS_DASHBOARD",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
    "actorResponsibilities": [
      "FACILITY_OPERATOR 액터가 권한·업무분리 정책에 따라 운전계획·허용범위 설정 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 운영 가능한 설비와 유효한 계측기가 등록되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "exitConditions": [
      "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다."
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
        "label": "PLAN_OPERATION"
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
        "label": "/api/ccus/facility/facility-operation-monitoring/fom_plan"
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
    "completionRule": "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
    "extensions": {
      "contractId": 310,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 310,
    "requirementIds": [
      "FACILITY_OPERATION_MONITORING:FOM_PLAN:USER"
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
