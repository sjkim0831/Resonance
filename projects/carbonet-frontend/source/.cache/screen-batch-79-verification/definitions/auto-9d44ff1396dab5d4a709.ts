import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_9d44ff1396dab5d4a709 = {
  "id": "auto-9d44ff1396dab5d4a709",
  "blueprintCode": "BP_ADOPT_9D44FF1396DA35D4A709",
  "processCode": "EMISSION_CALCULATION",
  "stepCode": "EMISSION_CALCULATION_04_APPROVE",
  "actorCode": "APPROVER",
  "audience": "ADMIN",
  "pageId": "AUTO_9D44FF1396DAB5D4A709",
  "pageName": "산정 결과 승인·확정",
  "routePath": "/admin/emission/result_list",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "검증 완료 결과를 업무분리 원칙에 따라 검토·승인 또는 반려하고 확정 산정 버전을 잠근다.",
    "actorResponsibilities": [
      "APPROVER 액터가 권한·업무분리 정책에 따라 산정 결과 승인·확정 업무를 수행한다."
    ],
    "entryConditions": [
      "프로젝트가 VERIFIED이고 승인선, 승인권자, 검토 대상 버전과 검증 증적이 존재한다."
    ],
    "exitConditions": [
      "권한 있는 승인자의 전자결정과 의견이 저장되고 승인 시 APPROVED 버전이 변경 불가로 확정된다."
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
        "label": "승인대기 건수"
      },
      {
        "code": "KPI_2",
        "label": "평균 처리시간"
      },
      {
        "code": "KPI_3",
        "label": "반려 건수"
      },
      {
        "code": "KPI_4",
        "label": "기한초과 건수"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "운영 현황"
      },
      {
        "code": "SECTION_2",
        "label": "검색·필터"
      },
      {
        "code": "SECTION_3",
        "label": "대상 목록"
      },
      {
        "code": "SECTION_4",
        "label": "상세 작업공간"
      },
      {
        "code": "SECTION_5",
        "label": "정책·이력"
      },
      {
        "code": "SECTION_6",
        "label": "사용자 화면 연결"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "확정 후보 버전"
      },
      {
        "code": "FIELD_2",
        "label": "총 배출량"
      },
      {
        "code": "FIELD_3",
        "label": "Scope별 결과"
      },
      {
        "code": "FIELD_4",
        "label": "검증 결과"
      },
      {
        "code": "FIELD_5",
        "label": "검토 의견"
      },
      {
        "code": "FIELD_6",
        "label": "승인자"
      },
      {
        "code": "FIELD_7",
        "label": "결정일시"
      },
      {
        "code": "FIELD_8",
        "label": "반려사유"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "검토 완료"
      },
      {
        "code": "ACTION_2",
        "label": "승인"
      },
      {
        "code": "ACTION_3",
        "label": "반려"
      },
      {
        "code": "ACTION_4",
        "label": "추가자료 요청"
      },
      {
        "code": "ACTION_5",
        "label": "결과 비교"
      },
      {
        "code": "ACTION_6",
        "label": "보고 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{id}/review-workflow"
      },
      {
        "code": "API_2",
        "label": "POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "emission_project_registry"
      },
      {
        "code": "DATA_2",
        "label": "emission_activity_data"
      },
      {
        "code": "DATA_3",
        "label": "emission_factor_reference"
      },
      {
        "code": "DATA_4",
        "label": "emission_calculation_run"
      },
      {
        "code": "DATA_5",
        "label": "emission_calculation_item"
      },
      {
        "code": "DATA_6",
        "label": "emission_activity_quality_run"
      },
      {
        "code": "DATA_7",
        "label": "emission_submission_review"
      }
    ],
    "permissions": [
      {
        "code": "APPROVER",
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
    "completionRule": "권한 있는 승인자의 전자결정과 의견이 저장되고 승인 시 APPROVED 버전이 변경 불가로 확정된다.",
    "extensions": {
      "contractId": 127,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 127,
    "requirementIds": [
      "EMISSION_CALCULATION:EMISSION_CALCULATION_04_APPROVE:ADMIN"
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
