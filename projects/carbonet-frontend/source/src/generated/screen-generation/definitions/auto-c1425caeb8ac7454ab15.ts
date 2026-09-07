import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_c1425caeb8ac7454ab15 = {
  "id": "auto-c1425caeb8ac7454ab15",
  "blueprintCode": "BP_RECOVERED_0799",
  "processCode": "AUTO_C1425CAEB8AC7454AB15",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "USER",
  "audience": "USER",
  "pageId": "AUTO_C1425CAEB8AC7454AB15",
  "pageName": "승인 워크플로 관리 - 요청·범위·필수정보 확인 사용자 업무 화면",
  "routePath": "/generated/approval-workflow-management/approval-workflow-management-s1",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_C1425CAEB8AC7454AB15",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "USER",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_C1425CAEB8AC7454AB15::RECOVERED_SCREEN_CONTRACT::READY::USER::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "승인 워크플로 관리 - 요청·범위·필수정보 확인 사용자 업무 화면 화면의 생성 계약 복구",
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
