import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_82bd5896134907cecd99 = {
  "id": "auto-82bd5896134907cecd99",
  "blueprintCode": "BP_ADOPT_82BD5896134937CE8D99",
  "processCode": "EMISSION_PROJECT",
  "stepCode": "EMISSION_PROJECT_SETUP",
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "pageId": "AUTO_82BD5896134907CECD99",
  "pageName": "프로젝트 기본정보 및 책임 확정 사용자 업무 화면",
  "routePath": "/emission/project/create",
  "screenType": "FORM",
  "templateCode": "KRDS_FORM",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "조직경계, 산정기간, Scope, 적용 기준, 책임 액터와 단계별 마감을 확정하여 자료 수집을 시작한다.",
    "actorResponsibilities": [
      "COMPANY_MANAGER 액터가 권한·업무분리 정책에 따라 프로젝트 기본정보 및 책임 확정 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다."
    ],
    "exitConditions": [
      "필수 설정이 버전으로 저장되고 업무분리가 검증되며 프로젝트가 PLANNED 상태로 전이된다."
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
        "label": "설정완료율"
      },
      {
        "code": "KPI_2",
        "label": "미배정 액터 수"
      },
      {
        "code": "KPI_3",
        "label": "기한 미설정 수"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "업무 요약"
      },
      {
        "code": "SECTION_2",
        "label": "기본정보"
      },
      {
        "code": "SECTION_3",
        "label": "조직·운영경계"
      },
      {
        "code": "SECTION_4",
        "label": "Scope·방법론"
      },
      {
        "code": "SECTION_5",
        "label": "액터·마감"
      },
      {
        "code": "SECTION_6",
        "label": "검토·시작"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "프로젝트명"
      },
      {
        "code": "FIELD_2",
        "label": "보고목적"
      },
      {
        "code": "FIELD_3",
        "label": "산정기간"
      },
      {
        "code": "FIELD_4",
        "label": "조직·사업장"
      },
      {
        "code": "FIELD_5",
        "label": "경계방법"
      },
      {
        "code": "FIELD_6",
        "label": "Scope 1·2·3"
      },
      {
        "code": "FIELD_7",
        "label": "Scope 2 방식"
      },
      {
        "code": "FIELD_8",
        "label": "GWP 버전"
      },
      {
        "code": "FIELD_9",
        "label": "배출계수 버전"
      },
      {
        "code": "FIELD_10",
        "label": "책임자"
      },
      {
        "code": "FIELD_11",
        "label": "단계별 마감"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "임시저장"
      },
      {
        "code": "ACTION_2",
        "label": "설정 검증"
      },
      {
        "code": "ACTION_3",
        "label": "프로젝트 시작"
      },
      {
        "code": "ACTION_4",
        "label": "사업장 관리"
      },
      {
        "code": "ACTION_5",
        "label": "권한 관리"
      },
      {
        "code": "ACTION_6",
        "label": "다음 업무 이동"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{id}"
      },
      {
        "code": "API_2",
        "label": "POST /home/api/emission-projects"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "emission_project_registry"
      },
      {
        "code": "DATA_2",
        "label": "emission_project_member"
      },
      {
        "code": "DATA_3",
        "label": "emission_project_task"
      },
      {
        "code": "DATA_4",
        "label": "framework_account_actor_assignment"
      },
      {
        "code": "DATA_5",
        "label": "framework_process_execution_event"
      }
    ],
    "permissions": [
      {
        "code": "COMPANY_MANAGER",
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
    "completionRule": "필수 설정이 버전으로 저장되고 업무분리가 검증되며 프로젝트가 PLANNED 상태로 전이된다.",
    "extensions": {
      "contractId": 1,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 1,
    "requirementIds": [
      "EMISSION_PROJECT:EMISSION_PROJECT_SETUP:USER"
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
