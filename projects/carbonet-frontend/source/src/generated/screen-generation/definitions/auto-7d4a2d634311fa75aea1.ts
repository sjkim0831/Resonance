import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_7d4a2d634311fa75aea1 = {
  "id": "auto-7d4a2d634311fa75aea1",
  "blueprintCode": "BP_RECOVERED_0588",
  "processCode": "AUTO_7D4A2D634311FA75AEA1",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_7D4A2D634311FA75AEA1",
  "pageName": "이해관계자 공유 - 업무 실행·중간 결과 저장 관리자 업무 화면",
  "routePath": "/admin/generated/stakeholder-sharing/stakeholder-sharing-s2",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_7D4A2D634311FA75AEA1",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_7D4A2D634311FA75AEA1::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "이해관계자 공유 - 업무 실행·중간 결과 저장 관리자 업무 화면 화면의 생성 계약 복구",
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
