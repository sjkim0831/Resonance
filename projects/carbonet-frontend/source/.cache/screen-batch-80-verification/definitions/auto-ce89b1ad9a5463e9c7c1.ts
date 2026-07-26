import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_ce89b1ad9a5463e9c7c1 = {
  "id": "auto-ce89b1ad9a5463e9c7c1",
  "blueprintCode": "BP_AUTO_CE89B1AD9A5463E9C7C134CA",
  "processCode": "REGULATORY_SUBMISSION",
  "stepCode": "REGULATORY_SUBMISSION_S1",
  "actorCode": "COMPANY_MANAGER",
  "audience": "ADMIN",
  "pageId": "AUTO_CE89B1AD9A5463E9C7C1",
  "pageName": "규제 제출 현황 관리",
  "routePath": "/admin/emission/regulatory-submissions",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "확정 보고서로 제출 패키지를 만들고 제출·접수·보완·재제출·수리를 상태머신과 증적으로 통제한다.",
    "actorResponsibilities": [
      "COMPANY_MANAGER 액터가 권한·업무분리 정책에 따라 규제 제출 현황 관리 업무를 수행한다."
    ],
    "entryConditions": [
      "프로젝트 접근 권한과 단계별 액터 권한이 있으며 확정 보고서가 존재한다."
    ],
    "exitConditions": [
      "패키지 해시, 접수번호, 보완 사유·기한, 상태 전이와 행위자 감사 이력이 저장된다."
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "PACKAGED",
      "SUBMITTED",
      "RECEIVED",
      "CORRECTION_REQUIRED",
      "RESUBMITTED",
      "ACCEPTED",
      "CANCELLED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "제출기한 잔여일"
      },
      {
        "code": "KPI_2",
        "label": "접수대기 건수"
      },
      {
        "code": "KPI_3",
        "label": "보완기한 초과"
      },
      {
        "code": "KPI_4",
        "label": "수리완료율"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "프로젝트 선택"
      },
      {
        "code": "SECTION_2",
        "label": "제출 패키지 생성"
      },
      {
        "code": "SECTION_3",
        "label": "제출·접수·보완 처리"
      },
      {
        "code": "SECTION_4",
        "label": "감사 이력"
      }
    ],
    "fields": [
      {
        "code": "FIELD_1",
        "label": "확정 보고서"
      },
      {
        "code": "FIELD_2",
        "label": "기관 코드·명"
      },
      {
        "code": "FIELD_3",
        "label": "제출 제도"
      },
      {
        "code": "FIELD_4",
        "label": "보고 기간"
      },
      {
        "code": "FIELD_5",
        "label": "법적 근거"
      },
      {
        "code": "FIELD_6",
        "label": "제출 채널·기한"
      },
      {
        "code": "FIELD_7",
        "label": "접수번호"
      },
      {
        "code": "FIELD_8",
        "label": "패키지 해시"
      },
      {
        "code": "FIELD_9",
        "label": "보완 사유·기한"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "패키지 생성"
      },
      {
        "code": "ACTION_2",
        "label": "기관 제출"
      },
      {
        "code": "ACTION_3",
        "label": "접수번호 등록"
      },
      {
        "code": "ACTION_4",
        "label": "보완 요구"
      },
      {
        "code": "ACTION_5",
        "label": "보완 재제출"
      },
      {
        "code": "ACTION_6",
        "label": "최종 수리"
      },
      {
        "code": "ACTION_7",
        "label": "취소"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{id}/regulatory-submissions"
      },
      {
        "code": "API_2",
        "label": "POST /home/api/emission-projects/{id}/regulatory-submissions"
      },
      {
        "code": "API_3",
        "label": "POST /home/api/emission-projects/{id}/regulatory-submissions/{submissionId}/transition"
      }
    ],
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "emission_regulatory_submission"
      },
      {
        "code": "DATA_2",
        "label": "emission_regulatory_submission_event"
      },
      {
        "code": "DATA_3",
        "label": "emission_project_report"
      },
      {
        "code": "DATA_4",
        "label": "emission_project_task"
      },
      {
        "code": "DATA_5",
        "label": "framework_project_actor_assignment"
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
    "completionRule": "패키지 해시, 접수번호, 보완 사유·기한, 상태 전이와 행위자 감사 이력이 저장된다.",
    "extensions": {
      "contractId": 261,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 261,
    "requirementIds": [
      "REGULATORY_SUBMISSION:REGULATORY_SUBMISSION_S1:ADMIN"
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
