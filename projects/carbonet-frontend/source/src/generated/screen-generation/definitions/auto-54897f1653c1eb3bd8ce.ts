import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_54897f1653c1eb3bd8ce = {
  "id": "auto-54897f1653c1eb3bd8ce",
  "blueprintCode": "BP_RECOVERED_0474",
  "processCode": "AUTO_54897F1653C1EB3BD8CE",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_54897F1653C1EB3BD8CE",
  "pageName": "출석·진도 관리 - 업무 실행·중간 결과 저장 관리자 업무 화면",
  "routePath": "/admin/generated/attendance-progress/attendance-progress-s2",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_54897F1653C1EB3BD8CE",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_54897F1653C1EB3BD8CE::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "출석·진도 관리 - 업무 실행·중간 결과 저장 관리자 업무 화면 화면의 생성 계약 복구",
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
