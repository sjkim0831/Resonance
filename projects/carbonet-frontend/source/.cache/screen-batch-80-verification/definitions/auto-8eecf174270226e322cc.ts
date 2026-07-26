import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_8eecf174270226e322cc = {
  "id": "auto-8eecf174270226e322cc",
  "blueprintCode": "BP_ADOPT_8EECF174270236E3A2CC",
  "processCode": "REPORT_CERTIFICATION",
  "stepCode": "REPORT_CERTIFICATION_03_VERIFY",
  "actorCode": "VERIFIER",
  "audience": "USER",
  "pageId": "AUTO_8EECF174270226E322CC",
  "pageName": "데이터셋·OCR·시각지문 진위 확인",
  "routePath": "/home/certificate-verify",
  "screenType": "REPORT",
  "templateCode": "KRDS_REPORT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "확정 산정 결과로 다국어 보고서를 생성·검토·제출하고 정규화 데이터셋과 지문으로 진위를 검증한다.",
    "actorResponsibilities": [
      "VERIFIER 액터가 권한·업무분리 정책에 따라 데이터셋·OCR·시각지문 진위 확인 업무를 수행한다."
    ],
    "entryConditions": [
      "프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다."
    ],
    "exitConditions": [
      "PDF와 정규화 데이터셋이 동일 버전에 묶여 발급·제출되고 OCR·시각지문·데이터 비교 검증이 가능하다."
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
        "label": "보고서 발급상태"
      },
      {
        "code": "KPI_2",
        "label": "제출상태"
      },
      {
        "code": "KPI_3",
        "label": "진위검증 성공률"
      },
      {
        "code": "KPI_4",
        "label": "재발급 건수"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "보고 요약"
      },
      {
        "code": "SECTION_2",
        "label": "양식·언어"
      },
      {
        "code": "SECTION_3",
        "label": "미리보기"
      },
      {
        "code": "SECTION_4",
        "label": "수치 대조"
      },
      {
        "code": "SECTION_5",
        "label": "발급·제출"
      },
      {
        "code": "SECTION_6",
        "label": "진위·다운로드 이력"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "보고서 버전"
      },
      {
        "code": "FIELD_2",
        "label": "산정 버전"
      },
      {
        "code": "FIELD_3",
        "label": "언어"
      },
      {
        "code": "FIELD_4",
        "label": "제출처"
      },
      {
        "code": "FIELD_5",
        "label": "총 배출량"
      },
      {
        "code": "FIELD_6",
        "label": "Scope 결과"
      },
      {
        "code": "FIELD_7",
        "label": "제품·부산물"
      },
      {
        "code": "FIELD_8",
        "label": "정규화 데이터셋"
      },
      {
        "code": "FIELD_9",
        "label": "OCR"
      },
      {
        "code": "FIELD_10",
        "label": "시각지문"
      },
      {
        "code": "FIELD_11",
        "label": "발급상태"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "미리보기"
      },
      {
        "code": "ACTION_2",
        "label": "PDF 생성"
      },
      {
        "code": "ACTION_3",
        "label": "수치 검증"
      },
      {
        "code": "ACTION_4",
        "label": "발급"
      },
      {
        "code": "ACTION_5",
        "label": "제출"
      },
      {
        "code": "ACTION_6",
        "label": "다운로드"
      },
      {
        "code": "ACTION_7",
        "label": "진위확인 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /api/public/report-certificates/{certificateId}"
      },
      {
        "code": "API_2",
        "label": "POST /api/home/certificate-verify/verify"
      },
      {
        "code": "API_3",
        "label": "POST /api/home/certificate-verify/verify-ocr"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "emission_project_report"
      },
      {
        "code": "DATA_2",
        "label": "emission_report_certificate_audit"
      },
      {
        "code": "DATA_3",
        "label": "emission_report_access_ledger"
      },
      {
        "code": "DATA_4",
        "label": "emission_calculation_run"
      },
      {
        "code": "DATA_5",
        "label": "emission_activity_submission"
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
    "completionRule": "PDF와 정규화 데이터셋이 동일 버전에 묶여 발급·제출되고 OCR·시각지문·데이터 비교 검증이 가능하다.",
    "extensions": {
      "contractId": 131,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 131,
    "requirementIds": [
      "REPORT_CERTIFICATION:REPORT_CERTIFICATION_03_VERIFY:USER"
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
