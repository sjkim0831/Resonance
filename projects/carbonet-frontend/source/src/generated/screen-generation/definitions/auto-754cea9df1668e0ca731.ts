import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_754cea9df1668e0ca731 = {
  "id": "auto-754cea9df1668e0ca731",
  "blueprintCode": "BP_RECOVERED_0563",
  "processCode": "AUTO_754CEA9DF1668E0CA731",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "USER",
  "audience": "USER",
  "pageId": "AUTO_754CEA9DF1668E0CA731",
  "pageName": "탄소크레딧 발급·보유·소각 - 요청·범위·필수정보 확인 사용자 업무 화면",
  "routePath": "/generated/carbon-credit-management/carbon-credit-management-s1",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_754CEA9DF1668E0CA731",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "USER",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_754CEA9DF1668E0CA731::RECOVERED_SCREEN_CONTRACT::READY::USER::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "탄소크레딧 발급·보유·소각 - 요청·범위·필수정보 확인 사용자 업무 화면 화면의 생성 계약 복구",
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
