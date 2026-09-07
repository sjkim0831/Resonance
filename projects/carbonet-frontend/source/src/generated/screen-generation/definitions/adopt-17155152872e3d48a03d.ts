import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_adopt_17155152872e3d48a03d = {
  "id": "adopt-17155152872e3d48a03d",
  "blueprintCode": "BP_RECOVERED_0018",
  "processCode": "ADOPT_17155152872E3D48A03D",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "USER",
  "audience": "USER",
  "pageId": "ADOPT_17155152872E3D48A03D",
  "pageName": "adopt 17155152872e3d48a03d",
  "routePath": "/generated/adopt-17155152872e3d48a03d",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "ADOPT_17155152872E3D48A03D",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "USER",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::ADOPT_17155152872E3D48A03D::RECOVERED_SCREEN_CONTRACT::READY::USER::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "adopt 17155152872e3d48a03d 화면의 생성 계약 복구",
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
