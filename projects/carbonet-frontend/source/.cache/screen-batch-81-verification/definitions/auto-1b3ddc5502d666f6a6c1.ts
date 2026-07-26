import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_1b3ddc5502d666f6a6c1 = {
  "id": "auto-1b3ddc5502d666f6a6c1",
  "blueprintCode": "BP_ADOPT_1B3DDC5502D636F6A6C1",
  "processCode": "EMISSION_PROJECT",
  "stepCode": "EMISSION_PROJECT_CORRECT",
  "actorCode": "SITE_DATA_OWNER",
  "audience": "USER",
  "pageId": "AUTO_1B3DDC5502D666F6A6C1",
  "pageName": "보완·재산정 사용자 업무 화면",
  "routePath": "/emission/data_input",
  "screenType": "CONTENT",
  "templateCode": "KRDS_CONTENT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "검증 오류별 원인과 영향 범위를 확인하고 자료 수정, 재산정, 재검증을 통해 보완을 종결한다.",
    "actorResponsibilities": [
      "SITE_DATA_OWNER 액터가 권한·업무분리 정책에 따라 보완·재산정 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다."
    ],
    "exitConditions": [
      "모든 보완 요청에 전후 값·사유·증빙이 보존되고 영향 범위 재산정 후 재검증 단계로 복귀한다."
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "SAVING",
      "CONFLICT",
      "STALE_VERSION"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "보완완료율"
      },
      {
        "code": "KPI_2",
        "label": "기한초과 보완 수"
      },
      {
        "code": "KPI_3",
        "label": "재발 오류 수"
      },
      {
        "code": "KPI_4",
        "label": "영향 배출량"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "보완 요약"
      },
      {
        "code": "SECTION_2",
        "label": "검증 의견"
      },
      {
        "code": "SECTION_3",
        "label": "원자료 수정"
      },
      {
        "code": "SECTION_4",
        "label": "영향 범위"
      },
      {
        "code": "SECTION_5",
        "label": "재산정 결과"
      },
      {
        "code": "SECTION_6",
        "label": "재제출 이력"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "오류번호"
      },
      {
        "code": "FIELD_2",
        "label": "검증의견"
      },
      {
        "code": "FIELD_3",
        "label": "수정 전 값"
      },
      {
        "code": "FIELD_4",
        "label": "수정 후 값"
      },
      {
        "code": "FIELD_5",
        "label": "변경사유"
      },
      {
        "code": "FIELD_6",
        "label": "대체 증빙"
      },
      {
        "code": "FIELD_7",
        "label": "영향 항목"
      },
      {
        "code": "FIELD_8",
        "label": "재산정 버전"
      },
      {
        "code": "FIELD_9",
        "label": "재검증 상태"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "수정 저장"
      },
      {
        "code": "ACTION_2",
        "label": "증빙 교체"
      },
      {
        "code": "ACTION_3",
        "label": "영향 분석"
      },
      {
        "code": "ACTION_4",
        "label": "재산정"
      },
      {
        "code": "ACTION_5",
        "label": "재제출"
      },
      {
        "code": "ACTION_6",
        "label": "검증 화면 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{id}/activities"
      },
      {
        "code": "API_2",
        "label": "POST /home/api/emission-projects/{id}/activities"
      },
      {
        "code": "API_3",
        "label": "GET /home/api/emission-projects/{id}/quality"
      },
      {
        "code": "API_4",
        "label": "POST /home/api/emission-projects/{id}/calculation"
      },
      {
        "code": "API_5",
        "label": "POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "emission_activity_data"
      },
      {
        "code": "DATA_2",
        "label": "emission_activity_quality_issue"
      },
      {
        "code": "DATA_3",
        "label": "emission_calculation_run"
      },
      {
        "code": "DATA_4",
        "label": "emission_activity_submission"
      },
      {
        "code": "DATA_5",
        "label": "emission_activity_submission_event"
      }
    ],
    "permissions": [
      {
        "code": "SITE_DATA_OWNER",
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
    "completionRule": "모든 보완 요청에 전후 값·사유·증빙이 보존되고 영향 범위 재산정 후 재검증 단계로 복귀한다.",
    "extensions": {
      "contractId": 13,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 13,
    "requirementIds": [
      "EMISSION_PROJECT:EMISSION_PROJECT_CORRECT:USER"
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
