import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_aaabdfa97be95e545cea = {
  "id": "auto-aaabdfa97be95e545cea",
  "blueprintCode": "BP_RECOVERED_0720",
  "processCode": "AUTO_AAABDFA97BE95E545CEA",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "USER",
  "audience": "USER",
  "pageId": "AUTO_AAABDFA97BE95E545CEA",
  "pageName": "환불 요청·처리 - 승인·확정·통지·후속업무 연결 사용자 업무 화면",
  "routePath": "/generated/refund-management/refund-management-s4",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_AAABDFA97BE95E545CEA",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "USER",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_AAABDFA97BE95E545CEA::RECOVERED_SCREEN_CONTRACT::READY::USER::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "환불 요청·처리 - 승인·확정·통지·후속업무 연결 사용자 업무 화면 화면의 생성 계약 복구",
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
