import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_2bcf8dc66cfd5b6cecca = {
  "id": "auto-2bcf8dc66cfd5b6cecca",
  "blueprintCode": "BP_ADOPT_2BCF8DC66CFD3B6CACCA",
  "processCode": "ACTIVITY_DATA",
  "stepCode": "ACTIVITY_DATA_03_VERIFY",
  "actorCode": "VERIFIER",
  "audience": "ADMIN",
  "pageId": "AUTO_2BCF8DC66CFD5B6CECCA",
  "pageName": "데이터·산정 결과 검증 관리자 업무 화면",
  "routePath": "/admin/emission/validate",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "활동자료, 증빙, 계수와 산정 결과의 완전성·정확성·일관성을 규칙 기반으로 독립 검증한다.",
    "actorResponsibilities": [
      "VERIFIER 액터가 권한·업무분리 정책에 따라 데이터·산정 결과 검증 관리자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다."
    ],
    "exitConditions": [
      "차단 오류가 0건이면 VERIFIED, 오류가 있으면 근거·담당자·기한을 포함하여 CORRECTION_REQUIRED로 전이된다."
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
        "label": "검증진행률"
      },
      {
        "code": "KPI_2",
        "label": "차단오류 수"
      },
      {
        "code": "KPI_3",
        "label": "경고 수"
      },
      {
        "code": "KPI_4",
        "label": "재검증 대기 수"
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
        "label": "규칙"
      },
      {
        "code": "FIELD_2",
        "label": "대상 위치"
      },
      {
        "code": "FIELD_3",
        "label": "심각도"
      },
      {
        "code": "FIELD_4",
        "label": "기대값"
      },
      {
        "code": "FIELD_5",
        "label": "실제값"
      },
      {
        "code": "FIELD_6",
        "label": "근거"
      },
      {
        "code": "FIELD_7",
        "label": "담당자"
      },
      {
        "code": "FIELD_8",
        "label": "기한"
      },
      {
        "code": "FIELD_9",
        "label": "조치상태"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "검증 실행"
      },
      {
        "code": "ACTION_2",
        "label": "오류 확인"
      },
      {
        "code": "ACTION_3",
        "label": "보완 요청"
      },
      {
        "code": "ACTION_4",
        "label": "검증 통과"
      },
      {
        "code": "ACTION_5",
        "label": "재검증"
      },
      {
        "code": "ACTION_6",
        "label": "산정근거 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{id}/review-workflow; POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/start; POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "emission_activity_request; emission_activity_data; emission_activity_quality_run; emission_activity_submission; emission_activity_submission_item; emission_activity_submission_evidence; emission_activity_submission_event; emission_submission_review"
      }
    ],
    "permissions": [
      {
        "code": "VERIFIER",
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
    "completionRule": "차단 오류가 0건이면 VERIFIED, 오류가 있으면 근거·담당자·기한을 포함하여 CORRECTION_REQUIRED로 전이된다.",
    "extensions": {
      "contractId": 70,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 70,
    "requirementIds": [
      "ACTIVITY_DATA:ACTIVITY_DATA_03_VERIFY:ADMIN"
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
