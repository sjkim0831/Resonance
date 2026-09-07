import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_042a2c3d5b6c480f5557 = {
  "id": "auto-042a2c3d5b6c480f5557",
  "blueprintCode": "BP_RECOVERED_0228",
  "processCode": "AUTO_042A2C3D5B6C480F5557",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "USER",
  "audience": "USER",
  "pageId": "AUTO_042A2C3D5B6C480F5557",
  "pageName": "문의 접수·답변 - 업무 실행·중간 결과 저장 사용자 업무 화면",
  "routePath": "/generated/customer-inquiry/customer-inquiry-s2",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_042A2C3D5B6C480F5557",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "USER",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_042A2C3D5B6C480F5557::RECOVERED_SCREEN_CONTRACT::READY::USER::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "문의 접수·답변 - 업무 실행·중간 결과 저장 사용자 업무 화면 화면의 생성 계약 복구",
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
