import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_e711e357fdbaddea7553 = {
  "id": "auto-e711e357fdbaddea7553",
  "blueprintCode": "BP_RECOVERED_0901",
  "processCode": "AUTO_E711E357FDBADDEA7553",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "USER",
  "audience": "USER",
  "pageId": "AUTO_E711E357FDBADDEA7553",
  "pageName": "연속성·중복사용 검증 사용자 업무 화면",
  "routePath": "/generated/chain-of-custody/chain-of-custody-s4",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_E711E357FDBADDEA7553",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "USER",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_E711E357FDBADDEA7553::RECOVERED_SCREEN_CONTRACT::READY::USER::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "연속성·중복사용 검증 사용자 업무 화면 화면의 생성 계약 복구",
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
