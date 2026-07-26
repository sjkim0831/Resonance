import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_94656d24984d8f6fa173 = {
  "id": "auto-94656d24984d8f6fa173",
  "blueprintCode": "BP_ADOPT_94656D24984D3F6FA173",
  "processCode": "EMISSION_CALCULATION",
  "stepCode": "EMISSION_CALCULATION_02_WORK",
  "actorCode": "CALCULATOR",
  "audience": "ADMIN",
  "pageId": "AUTO_94656D24984D8F6FA173",
  "pageName": "배출계수 매핑·배출량 산정",
  "routePath": "/admin/emission/calculation-rule",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "승인된 배출계수와 단위환산 정책으로 Scope별 배출량을 재현 가능하게 산정하고 계산 근거를 보존한다.",
    "actorResponsibilities": [
      "CALCULATOR 액터가 권한·업무분리 정책에 따라 배출계수 매핑·배출량 산정 업무를 수행한다."
    ],
    "entryConditions": [
      "기업 담당자가 활동자료 요청을 접수 완료했고 산정 담당자에게 CALCULATION 태스크가 배정되어 있다."
    ],
    "exitConditions": [
      "접수 제출본의 모든 행에 단위가 일치하는 배출계수 결정이 존재하고 불변 산정 버전·항목 합계·입력 지문이 생성된다."
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
        "label": "계수매핑률"
      },
      {
        "code": "KPI_2",
        "label": "산정완료율"
      },
      {
        "code": "KPI_3",
        "label": "미매핑 건수"
      },
      {
        "code": "KPI_4",
        "label": "Scope별 배출량"
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
        "label": "활동자료"
      },
      {
        "code": "FIELD_2",
        "label": "사용량"
      },
      {
        "code": "FIELD_3",
        "label": "원단위"
      },
      {
        "code": "FIELD_4",
        "label": "배출계수"
      },
      {
        "code": "FIELD_5",
        "label": "계수 출처·버전"
      },
      {
        "code": "FIELD_6",
        "label": "환산식"
      },
      {
        "code": "FIELD_7",
        "label": "GWP"
      },
      {
        "code": "FIELD_8",
        "label": "배출량"
      },
      {
        "code": "FIELD_9",
        "label": "Scope"
      },
      {
        "code": "FIELD_10",
        "label": "계산 버전"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "AI 매핑"
      },
      {
        "code": "ACTION_2",
        "label": "매핑 확정"
      },
      {
        "code": "ACTION_3",
        "label": "일괄 단위 적용"
      },
      {
        "code": "ACTION_4",
        "label": "산정 실행"
      },
      {
        "code": "ACTION_5",
        "label": "재산정"
      },
      {
        "code": "ACTION_6",
        "label": "계산근거 보기"
      },
      {
        "code": "ACTION_7",
        "label": "검증 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{id}/calculation"
      },
      {
        "code": "API_2",
        "label": "POST /home/api/emission-projects/{id}/activities/{activityId}/factor"
      },
      {
        "code": "API_3",
        "label": "POST /home/api/emission-projects/{id}/activities/auto-map"
      },
      {
        "code": "API_4",
        "label": "POST /home/api/emission-projects/{id}/calculation"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "emission_activity_request"
      },
      {
        "code": "DATA_2",
        "label": "emission_activity_submission_item"
      },
      {
        "code": "DATA_3",
        "label": "emission_factor_reference"
      },
      {
        "code": "DATA_4",
        "label": "emission_factor_mapping_decision"
      },
      {
        "code": "DATA_5",
        "label": "emission_calculation_run"
      },
      {
        "code": "DATA_6",
        "label": "emission_calculation_item"
      }
    ],
    "permissions": [
      {
        "code": "CALCULATOR",
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
    "completionRule": "접수 제출본의 모든 행에 단위가 일치하는 배출계수 결정이 존재하고 불변 산정 버전·항목 합계·입력 지문이 생성된다.",
    "extensions": {
      "contractId": 123,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 123,
    "requirementIds": [
      "EMISSION_CALCULATION:EMISSION_CALCULATION_02_WORK:ADMIN"
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
