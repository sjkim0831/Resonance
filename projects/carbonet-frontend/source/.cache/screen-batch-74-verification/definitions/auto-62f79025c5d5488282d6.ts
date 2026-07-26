import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_62f79025c5d5488282d6 = {
  "id": "auto-62f79025c5d5488282d6",
  "blueprintCode": "BP_AUTO_62F79025C5D5488282D67BF4",
  "processCode": "MEMBER_REGISTRATION",
  "stepCode": "MEMBER_REGISTRATION_S1",
  "actorCode": "PUBLIC_APPLICANT",
  "audience": "USER",
  "pageId": "AUTO_62F79025C5D5488282D6",
  "pageName": "Registration Step 1 - Membership Type",
  "routePath": "/join/en/step1",
  "screenType": "CONTENT",
  "templateCode": "KRDS_CONTENT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "가입 신청자가 소속과 수행 업무에 맞는 회원 유형을 선택하고, 이후 동의·본인확인·정보입력 단계에 일관된 가입 문맥을 전달한다.",
    "actorResponsibilities": [
      "PUBLIC_APPLICANT 액터가 권한·업무분리 정책에 따라 Registration Step 1 - Membership Type 업무를 수행한다."
    ],
    "entryConditions": [
      "비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다."
    ],
    "exitConditions": [
      "허용된 회원 유형 중 하나가 서버 세션에 저장되고 가입 단계 1 완료 상태와 다음 경로가 확정된다."
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "SUCCESS",
      "ERROR",
      "FORBIDDEN",
      "SESSION_EXPIRED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "단계 완료율"
      },
      {
        "code": "KPI_2",
        "label": "유형 선택 성공률"
      },
      {
        "code": "KPI_3",
        "label": "검증 오류율"
      },
      {
        "code": "KPI_4",
        "label": "다음 단계 이동률"
      }
    ],
    "sections": [
      {
        "id": "progress",
        "purpose": "5단계 진행 상태"
      },
      {
        "id": "type-selection",
        "purpose": "회원 유형 설명·선택"
      },
      {
        "id": "actions",
        "purpose": "취소·다음 단계"
      },
      {
        "id": "feedback",
        "purpose": "오류·복구 안내"
      }
    ],
    "fields": [
      {
        "code": "membershipType",
        "type": "enum",
        "values": [
          "EMITTER",
          "PERFORMER",
          "CENTER",
          "GOV"
        ],
        "required": true
      },
      {
        "code": "userType",
        "type": "server-assigned",
        "value": "USR02"
      },
      {
        "code": "joinStep",
        "type": "server-assigned",
        "value": 1
      }
    ],
    "actions": [
      {
        "code": "LOAD_JOIN_SESSION",
        "method": "GET"
      },
      {
        "code": "SELECT_MEMBER_TYPE",
        "method": "POST",
        "idempotent": true
      },
      {
        "code": "CONTINUE_TO_TERMS",
        "guard": "save-success"
      },
      {
        "code": "RESET_JOIN_AND_HOME",
        "confirmation": true
      }
    ],
    "apiContracts": [
      {
        "path": "/join/api/session",
        "method": "GET",
        "response": "JoinSession"
      },
      {
        "path": "/join/api/step1",
        "method": "POST",
        "request": {
          "membership_type": "MembershipType"
        },
        "response": {
          "step": 1,
          "version": "session-version",
          "membershipType": "MembershipType"
        }
      },
      {
        "path": "/join/api/reset",
        "method": "POST"
      }
    ],
    "dataContracts": [
      {
        "key": "sessionId",
        "entity": "JoinSession",
        "fields": [
          "ENTRPRS_SE_CODE",
          "USER_TY",
          "JOIN_STEP"
        ],
        "storage": "HTTP_SESSION_JOIN_VO",
        "version": "session-version",
        "transaction": "single-session-write"
      }
    ],
    "permissions": [
      {
        "code": "PUBLIC_APPLICANT",
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
    "completionRule": "허용된 회원 유형 중 하나가 서버 세션에 저장되고 가입 단계 1 완료 상태와 다음 경로가 확정된다.",
    "extensions": {
      "contractId": 553,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 553,
    "requirementIds": [
      "MEMBER_REGISTRATION:MEMBER_REGISTRATION_S1:USER"
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
