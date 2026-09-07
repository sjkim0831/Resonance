import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_6dc44ebd69c6d473e539 = {
  "id": "auto-6dc44ebd69c6d473e539",
  "blueprintCode": "BP_RECOVERED_0548",
  "processCode": "AUTO_6DC44EBD69C6D473E539",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_6DC44EBD69C6D473E539",
  "pageName": "시스템·DB 모니터링·자가복구 - 독립 검토·보완·권한 검증 관리자 업무 화면",
  "routePath": "/admin/generated/system-monitoring-recovery/system-monitoring-recovery-s3",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_6DC44EBD69C6D473E539",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_6DC44EBD69C6D473E539::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "시스템·DB 모니터링·자가복구 - 독립 검토·보완·권한 검증 관리자 업무 화면 화면의 생성 계약 복구",
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
