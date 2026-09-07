import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_4c92698a6dde53a2bc20 = {
  "id": "auto-4c92698a6dde53a2bc20",
  "blueprintCode": "BP_RECOVERED_0448",
  "processCode": "AUTO_4C92698A6DDE53A2BC20",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_4C92698A6DDE53A2BC20",
  "pageName": "API 키 수명주기 관리 - 독립 검토·보완·권한 검증 관리자 업무 화면",
  "routePath": "/admin/generated/api-key-lifecycle/api-key-lifecycle-s3",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_4C92698A6DDE53A2BC20",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_4C92698A6DDE53A2BC20::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "API 키 수명주기 관리 - 독립 검토·보완·권한 검증 관리자 업무 화면 화면의 생성 계약 복구",
    "sections": [
      "도움말",
      "화면 설계",
      "QA 검증",
      "다음 업무",
      "업무 길잡이",
      "전체 업무 보기"
    ]
  },
  "traceability": {
    "recovery": "catalog-definition-closure",
    "source": "generatedScreenFamily.ts"
  },
  "designCompleteness": {
    "score": 100,
    "complete": true,
    "checks": {
      "route": true,
      "actor": true,
      "input": true,
      "output": true,
      "help": true,
      "qa": true
    }
  }
} as const satisfies GeneratedScreenDefinition;
