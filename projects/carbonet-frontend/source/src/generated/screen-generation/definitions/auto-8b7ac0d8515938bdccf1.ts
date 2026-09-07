import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_8b7ac0d8515938bdccf1 = {
  "id": "auto-8b7ac0d8515938bdccf1",
  "blueprintCode": "BP_RECOVERED_0622",
  "processCode": "AUTO_8B7AC0D8515938BDCCF1",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_8B7AC0D8515938BDCCF1",
  "pageName": "탄소크레딧 발급·보유·소각 - 승인·확정·통지·후속업무 연결 관리자 업무 화면",
  "routePath": "/admin/generated/carbon-credit-management/carbon-credit-management-s4",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_8B7AC0D8515938BDCCF1",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_8B7AC0D8515938BDCCF1::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "탄소크레딧 발급·보유·소각 - 승인·확정·통지·후속업무 연결 관리자 업무 화면 화면의 생성 계약 복구",
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
