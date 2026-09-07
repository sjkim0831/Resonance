import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_0a9ba2ed0bdb4603001d = {
  "id": "auto-0a9ba2ed0bdb4603001d",
  "blueprintCode": "BP_RECOVERED_0255",
  "processCode": "AUTO_0A9BA2ED0BDB4603001D",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "USER",
  "audience": "USER",
  "pageId": "AUTO_0A9BA2ED0BDB4603001D",
  "pageName": "탄소크레딧 발급·보유·소각 - 업무 실행·중간 결과 저장 사용자 업무 화면",
  "routePath": "/generated/carbon-credit-management/carbon-credit-management-s2",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_0A9BA2ED0BDB4603001D",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "USER",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_0A9BA2ED0BDB4603001D::RECOVERED_SCREEN_CONTRACT::READY::USER::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "탄소크레딧 발급·보유·소각 - 업무 실행·중간 결과 저장 사용자 업무 화면 화면의 생성 계약 복구",
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
