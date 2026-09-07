import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_2389c252d99eaf1d5750 = {
  "id": "auto-2389c252d99eaf1d5750",
  "blueprintCode": "BP_RECOVERED_0318",
  "processCode": "AUTO_2389C252D99EAF1D5750",
  "stepCode": "RECOVERED_SCREEN_CONTRACT",
  "actorCode": "ADMIN",
  "audience": "ADMIN",
  "pageId": "AUTO_2389C252D99EAF1D5750",
  "pageName": "공지사항 게시 - 독립 검토·보완·권한 검증 관리자 업무 화면",
  "routePath": "/admin/generated/notice-publication/notice-publication-s3",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "screenCoordinate": {
    "domain": "SYSTEM",
    "process": "AUTO_2389C252D99EAF1D5750",
    "step": "RECOVERED_SCREEN_CONTRACT",
    "state": "READY",
    "actor": "ADMIN",
    "policy": "DEFAULT",
    "view": "WORKFLOW",
    "device": "ADAPTIVE",
    "locale": "MULTI",
    "variant": "KRDS_WORKFLOW"
  },
  "screenCoordinateKey": "SYSTEM::AUTO_2389C252D99EAF1D5750::RECOVERED_SCREEN_CONTRACT::READY::ADMIN::DEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "공지사항 게시 - 독립 검토·보완·권한 검증 관리자 업무 화면 화면의 생성 계약 복구",
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
