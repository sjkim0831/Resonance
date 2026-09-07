import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_d6d2c0cbdfaeef9ed272 = {
  "id": "auto-d6d2c0cbdfaeef9ed272",
  "blueprintCode": "BP_RECOVERED_0858",
  "processCode": "AUTO_D6D2C0CBDFAEEF9ED272",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_D6D2C0CBDFAEEF9ED272",
  "pageName": "메뉴·페이지·화면 연결 관리 - 독립 검토·보완·권한 검증 관리자 업무 화면",
  "routePath": "/admin/generated/menu-screen-governance/menu-screen-governance-s3",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_D6D2C0CBDFAEEF9ED272",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_D6D2C0CBDFAEEF9ED272::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "메뉴·페이지·화면 연결 관리 - 독립 검토·보완·권한 검증 관리자 업무 화면 화면의 생성 계약 복구",
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
