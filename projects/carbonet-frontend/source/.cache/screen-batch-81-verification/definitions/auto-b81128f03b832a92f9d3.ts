import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_b81128f03b832a92f9d3 = {
  "id": "auto-b81128f03b832a92f9d3",
  "blueprintCode": "BP_EMISSION_PROJECT_EMISSION_PROJECT_CALCULATE_USER",
  "processCode": "REDUCTION_EXECUTION",
  "stepCode": "REDUCTION_EXECUTION_02_WORK",
  "actorCode": "REDUCTION_MANAGER",
  "audience": "USER",
  "pageId": "AUTO_B81128F03B832A92F9D3",
  "pageName": "감축 전략 시나리오",
  "routePath": "/emission/simulate",
  "screenType": "CONTENT",
  "templateCode": "KRDS_CONTENT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "기술 투자, 공정 효율, 재생에너지 및 CCUS 변수를 비교하여 실행 가능한 감축 경로를 수립한다.",
    "actorResponsibilities": [
      "REDUCTION_MANAGER 액터가 권한·업무분리 정책에 따라 감축 전략 시나리오 업무를 수행한다."
    ],
    "entryConditions": [
      "감축 기준연도와 목표 및 비교 가능한 배출량 기준선이 존재한다."
    ],
    "exitConditions": [
      "선택한 시나리오의 감축량, 비용, 목표 격차와 저장 버전이 기록된다."
    ],
    "states": [
      "LOADING",
      "READY",
      "EMPTY",
      "SIMULATED",
      "SAVED",
      "SUBMITTED",
      "ERROR",
      "FORBIDDEN"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "예상 감축량; 목표 격차; 투자 대비 효과"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "전략 제언; 배출 추세; 시나리오 빌더; 예상 효과; 저장 이력"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "기술 투자; 효율 개선률; 재생에너지 비율; CCUS 적용률"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "시나리오 계산; 저장; 비교; 검증 요청"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "reduction-scenario-workflow"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "reduction scenario; emission baseline; reduction target"
      }
    ],
    "permissions": [
      {
        "code": "REDUCTION_MANAGER",
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
    "completionRule": "선택한 시나리오의 감축량, 비용, 목표 격차와 저장 버전이 기록된다.",
    "extensions": {
      "contractId": 251,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 251,
    "requirementIds": [
      "REDUCTION_EXECUTION:REDUCTION_EXECUTION_02_WORK:USER"
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
