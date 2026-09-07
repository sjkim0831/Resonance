import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_activity_data_activity_data_01_plan_user = {
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "blueprintCode": "BP_ACTIVITY_DATA_ACTIVITY_DATA_01_PLAN_USER",
  "designCompleteness": {
    "checks": {
      "accessibility": true,
      "actions": false,
      "actor": false,
      "api": false,
      "assetBindings": false,
      "data": false,
      "designCard": true,
      "entry": false,
      "errors": false,
      "exit": false,
      "fields": false,
      "help": false,
      "permissions": false,
      "purpose": true,
      "qa": false,
      "responsive": true,
      "sections": false,
      "states": false,
      "tests": true,
      "validations": false,
      "workGuide": true
    },
    "complete": false,
    "score": 29
  },
  "designHash": "189793c4653aed7b9819d660e4c5c91939e336900cadac98d1159b364db8c637",
  "id": "activity-data-activity-data-01-plan-user",
  "pageId": "ACTIVITY_DATA_ACTIVITY_DATA_01_PLAN_USER",
  "pageName": "계획·범위 확정",
  "processCode": "ACTIVITY_DATA",
  "routePath": "/emission/project/settings",
  "screenCoordinate": {
    "actor": "COMPANY_MANAGER",
    "device": "ADAPTIVE",
    "domain": "ACTIVITY",
    "locale": "MULTI",
    "policy": "COMPANY_MANAGER:DEFAULT",
    "process": "ACTIVITY_DATA",
    "state": "READY",
    "step": "ACTIVITY_DATA_01_PLAN",
    "variant": "KRDS_CONTENT",
    "view": "CONTENT"
  },
  "screenCoordinateKey": "ACTIVITY::ACTIVITY_DATA::ACTIVITY_DATA_01_PLAN::READY::COMPANY_MANAGER::COMPANY_MANAGER%3ADEFAULT::CONTENT::ADAPTIVE::MULTI::KRDS_CONTENT",
  "screenType": "CONTENT",
  "specification": {
    "accessibility": {
      "focusManagement": true,
      "keyboard": true,
      "labels": true,
      "standard": "WCAG_2_1_AA"
    },
    "actions": [],
    "actorResponsibilities": [],
    "apiContracts": [],
    "businessPurpose": "계획·범위 확정",
    "completionRule": "Required validation passes and the process transition is persisted.",
    "dataContracts": [],
    "designSystem": "KRDS_GOV",
    "entryConditions": [],
    "errors": [],
    "exitConditions": [],
    "extensions": {},
    "fields": [],
    "kpis": [],
    "permissions": [],
    "responsive": {
      "desktop": "task-and-context",
      "mobile": "single-column",
      "tablet": "adaptive-grid"
    },
    "schemaVersion": "2.0.0",
    "sections": [],
    "states": [],
    "support": {
      "assetBindings": [],
      "designCard": {
        "actionCount": 0,
        "designSystem": "KRDS_GOV",
        "fieldCount": 0,
        "pageName": "계획·범위 확정",
        "screenType": "CONTENT",
        "sectionCount": 0,
        "summary": "계획·범위 확정",
        "templateCode": "KRDS_CONTENT",
        "title": "계획·범위 확정"
      },
      "help": {
        "items": [],
        "pageId": "ACTIVITY_DATA_ACTIVITY_DATA_01_PLAN_USER",
        "summary": "계획·범위 확정",
        "title": "계획·범위 확정 도움말"
      },
      "qa": {
        "acceptanceCriteria": [],
        "checks": [],
        "requiredScenarioTypes": [
          "HAPPY_PATH",
          "AUTHORITY",
          "ISOLATION",
          "EXCEPTION",
          "RECOVERY"
        ],
        "summary": "페이지와 프로세스 계약의 자동 검증 기준입니다.",
        "title": "계획·범위 확정 QA"
      },
      "workGuide": {
        "commands": [],
        "nextAction": {
          "completionRule": "Required validation passes and the process transition is persisted.",
          "label": "다음 업무 진행",
          "routePath": "/emission/project/settings"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "",
            "label": "업무 정보 작성",
            "path": "/emission/project/settings"
          },
          {
            "code": "COMPLETE",
            "description": "Required validation passes and the process transition is persisted.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "계획·범위 확정",
        "title": "계획·범위 확정 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "ACTIVITY_DATA_01_PLAN",
  "support": {
    "assetBindings": [],
    "designCard": {
      "actionCount": 0,
      "designSystem": "KRDS_GOV",
      "fieldCount": 0,
      "pageName": "계획·범위 확정",
      "screenType": "CONTENT",
      "sectionCount": 0,
      "summary": "계획·범위 확정",
      "templateCode": "KRDS_CONTENT",
      "title": "계획·범위 확정"
    },
    "help": {
      "items": [],
      "pageId": "ACTIVITY_DATA_ACTIVITY_DATA_01_PLAN_USER",
      "summary": "계획·범위 확정",
      "title": "계획·범위 확정 도움말"
    },
    "qa": {
      "acceptanceCriteria": [],
      "checks": [],
      "requiredScenarioTypes": [
        "HAPPY_PATH",
        "AUTHORITY",
        "ISOLATION",
        "EXCEPTION",
        "RECOVERY"
      ],
      "summary": "페이지와 프로세스 계약의 자동 검증 기준입니다.",
      "title": "계획·범위 확정 QA"
    },
    "workGuide": {
      "commands": [],
      "nextAction": {
        "completionRule": "Required validation passes and the process transition is persisted.",
        "label": "다음 업무 진행",
        "routePath": "/emission/project/settings"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "",
          "label": "업무 정보 작성",
          "path": "/emission/project/settings"
        },
        {
          "code": "COMPLETE",
          "description": "Required validation passes and the process transition is persisted.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "계획·범위 확정",
      "title": "계획·범위 확정 업무 길잡이"
    }
  },
  "templateCode": "KRDS_CONTENT",
  "traceability": {
    "caseTypeCount": 5,
    "designReadinessScore": 0,
    "evidenceContract": [],
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
