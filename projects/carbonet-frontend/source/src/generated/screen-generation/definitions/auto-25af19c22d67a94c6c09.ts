import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_25af19c22d67a94c6c09 = {
  "id": "auto-25af19c22d67a94c6c09",
  "blueprintCode": "BP_RECOVERED_0325",
  "processCode": "AUTO_25AF19C22D67A94C6C09",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_25AF19C22D67A94C6C09",
  "pageName": "보안 정책·접근 통제 - 승인·확정·통지·후속업무 연결 관리자 업무 화면",
  "routePath": "/admin/generated/security-policy-operation/security-policy-operation-s4",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_25AF19C22D67A94C6C09",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_25AF19C22D67A94C6C09::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "보안 정책·접근 통제 - 승인·확정·통지·후속업무 연결 관리자 업무 화면 화면의 생성 계약 복구",
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
