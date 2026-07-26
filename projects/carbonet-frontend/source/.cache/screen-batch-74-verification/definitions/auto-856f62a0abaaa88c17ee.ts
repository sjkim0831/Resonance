import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_856f62a0abaaa88c17ee = {
  "id": "auto-856f62a0abaaa88c17ee",
  "blueprintCode": "BP_ADOPT_856F62A0ABAA388C97EE",
  "processCode": "ACTIVITY_DATA",
  "stepCode": "ACTIVITY_DATA_02_WORK",
  "actorCode": "SITE_DATA_OWNER",
  "audience": "USER",
  "pageId": "AUTO_856F62A0ABAAA88C17EE",
  "pageName": "활동자료·증빙 수집 사용자 업무 화면",
  "routePath": "/emission/activity-data",
  "screenType": "UPLOAD",
  "templateCode": "KRDS_UPLOAD",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "사업장·배출원별 활동자료의 값, 단위, 기간, 출처와 원본 증빙을 수집하고 제출 품질을 관리한다.",
    "actorResponsibilities": [
      "SITE_DATA_OWNER 액터가 권한·업무분리 정책에 따라 활동자료·증빙 수집 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다."
    ],
    "exitConditions": [
      "필수 자료와 증빙이 품질검사를 통과하고 제출 스냅샷이 DATA_SUBMITTED 상태로 잠긴다."
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
        "label": "제출완료율"
      },
      {
        "code": "KPI_2",
        "label": "증빙연결률"
      },
      {
        "code": "KPI_3",
        "label": "기한초과 건수"
      },
      {
        "code": "KPI_4",
        "label": "품질오류 건수"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "수집 현황"
      },
      {
        "code": "SECTION_2",
        "label": "제출 요청"
      },
      {
        "code": "SECTION_3",
        "label": "엑셀·직접 입력"
      },
      {
        "code": "SECTION_4",
        "label": "증빙 연결"
      },
      {
        "code": "SECTION_5",
        "label": "품질검사"
      },
      {
        "code": "SECTION_6",
        "label": "제출 이력"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "사업장"
      },
      {
        "code": "FIELD_2",
        "label": "배출원"
      },
      {
        "code": "FIELD_3",
        "label": "활동자료"
      },
      {
        "code": "FIELD_4",
        "label": "값"
      },
      {
        "code": "FIELD_5",
        "label": "단위"
      },
      {
        "code": "FIELD_6",
        "label": "기간"
      },
      {
        "code": "FIELD_7",
        "label": "출처"
      },
      {
        "code": "FIELD_8",
        "label": "증빙"
      },
      {
        "code": "FIELD_9",
        "label": "담당자"
      },
      {
        "code": "FIELD_10",
        "label": "마감"
      },
      {
        "code": "FIELD_11",
        "label": "품질상태"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "자료 요청"
      },
      {
        "code": "ACTION_2",
        "label": "엑셀 업로드"
      },
      {
        "code": "ACTION_3",
        "label": "임시저장"
      },
      {
        "code": "ACTION_4",
        "label": "품질검사"
      },
      {
        "code": "ACTION_5",
        "label": "제출"
      },
      {
        "code": "ACTION_6",
        "label": "보완 요청"
      },
      {
        "code": "ACTION_7",
        "label": "다음 업무 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET|POST /home/api/emission-projects/{id}/activities; POST /home/api/emission-projects/{id}/activities/upload; GET|POST /home/api/emission-projects/{id}/quality; GET|POST /home/api/emission-projects/{id}/submissions; POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit"
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
    "completionRule": "필수 자료와 증빙이 품질검사를 통과하고 제출 스냅샷이 DATA_SUBMITTED 상태로 잠긴다.",
    "extensions": {
      "contractId": 69,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 69,
    "requirementIds": [
      "ACTIVITY_DATA:ACTIVITY_DATA_02_WORK:USER"
    ],
    "generationBatchId": 74,
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
