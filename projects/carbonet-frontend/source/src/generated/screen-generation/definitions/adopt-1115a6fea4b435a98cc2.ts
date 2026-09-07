import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_adopt_1115a6fea4b435a98cc2 = {
  "actorCode": "PLATFORM_OPERATOR",
  "audience": "ADMIN",
  "blueprintCode": "BP_ADOPT_1115A6FEA4B435A98CC2",
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
  "designHash": "878ac005d7cd2891cd0f8e6d750e8e22d0813690cf67fad79c0070be33c1ccc4",
  "id": "adopt-1115a6fea4b435a98cc2",
  "pageId": "ADOPT_1115A6FEA4B435A98CC2",
  "pageName": "Codex 실행 관리",
  "processCode": "GOVERNANCE_CHANGE",
  "routePath": "/admin/system/codex-provision",
  "screenCoordinate": {
    "actor": "PLATFORM_OPERATOR",
    "device": "ADAPTIVE",
    "domain": "GOVERNANCE",
    "locale": "MULTI",
    "policy": "PLATFORM_OPERATOR:DEFAULT",
    "process": "GOVERNANCE_CHANGE",
    "state": "READY",
    "step": "GOV_REQUEST",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "GOVERNANCE::GOVERNANCE_CHANGE::GOV_REQUEST::READY::PLATFORM_OPERATOR::PLATFORM_OPERATOR%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
  "screenType": "ADMIN",
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
    "businessPurpose": "Codex 실행 관리",
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
        "pageName": "Codex 실행 관리",
        "screenType": "ADMIN",
        "sectionCount": 0,
        "summary": "Codex 실행 관리",
        "templateCode": "KRDS_ADMIN",
        "title": "Codex 실행 관리"
      },
      "help": {
        "items": [],
        "pageId": "ADOPT_1115A6FEA4B435A98CC2",
        "summary": "Codex 실행 관리",
        "title": "Codex 실행 관리 도움말"
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
        "title": "Codex 실행 관리 QA"
      },
      "workGuide": {
        "commands": [],
        "nextAction": {
          "completionRule": "Required validation passes and the process transition is persisted.",
          "label": "다음 업무 진행",
          "routePath": "/admin/system/codex-provision"
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
            "path": "/admin/system/codex-provision"
          },
          {
            "code": "COMPLETE",
            "description": "Required validation passes and the process transition is persisted.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "Codex 실행 관리",
        "title": "Codex 실행 관리 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "GOV_REQUEST",
  "support": {
    "assetBindings": [],
    "designCard": {
      "actionCount": 0,
      "designSystem": "KRDS_GOV",
      "fieldCount": 0,
      "pageName": "Codex 실행 관리",
      "screenType": "ADMIN",
      "sectionCount": 0,
      "summary": "Codex 실행 관리",
      "templateCode": "KRDS_ADMIN",
      "title": "Codex 실행 관리"
    },
    "help": {
      "items": [],
      "pageId": "ADOPT_1115A6FEA4B435A98CC2",
      "summary": "Codex 실행 관리",
      "title": "Codex 실행 관리 도움말"
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
      "title": "Codex 실행 관리 QA"
    },
    "workGuide": {
      "commands": [],
      "nextAction": {
        "completionRule": "Required validation passes and the process transition is persisted.",
        "label": "다음 업무 진행",
        "routePath": "/admin/system/codex-provision"
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
          "path": "/admin/system/codex-provision"
        },
        {
          "code": "COMPLETE",
          "description": "Required validation passes and the process transition is persisted.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "Codex 실행 관리",
      "title": "Codex 실행 관리 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
  "traceability": {
    "caseTypeCount": 5,
    "menuCode": "A1120161",
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
