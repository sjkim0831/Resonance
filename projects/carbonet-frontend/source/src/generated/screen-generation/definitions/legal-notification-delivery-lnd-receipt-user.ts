import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_legal_notification_delivery_lnd_receipt_user = {
  "actorCode": "AUDITOR",
  "audience": "USER",
  "blueprintCode": "BP_LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
  "designCompleteness": {
    "checks": {
      "accessibility": true,
      "actions": true,
      "actor": false,
      "api": true,
      "assetBindings": true,
      "data": true,
      "designCard": true,
      "entry": true,
      "errors": false,
      "exit": true,
      "fields": true,
      "help": true,
      "permissions": false,
      "purpose": true,
      "qa": false,
      "responsive": true,
      "sections": true,
      "states": true,
      "tests": true,
      "validations": false,
      "workGuide": true
    },
    "complete": false,
    "score": 76
  },
  "designHash": "381ae082a8c0a6433a57efb7f4cce90b7f495ba41c91871b90b223ea93d96407",
  "id": "legal-notification-delivery-lnd-receipt-user",
  "pageId": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
  "pageName": "도달·열람·수신증 확정",
  "processCode": "LEGAL_NOTIFICATION_DELIVERY",
  "routePath": "/work/legal-notification-delivery",
  "screenCoordinate": {
    "actor": "AUDITOR",
    "device": "ADAPTIVE",
    "domain": "LEGAL",
    "locale": "MULTI",
    "policy": "AUDITOR:DEFAULT",
    "process": "LEGAL_NOTIFICATION_DELIVERY",
    "state": "LOADING",
    "step": "LND_RECEIPT",
    "variant": "KRDS_CONTENT",
    "view": "CONTENT"
  },
  "screenCoordinateKey": "LEGAL::LEGAL_NOTIFICATION_DELIVERY::LND_RECEIPT::LOADING::AUDITOR::AUDITOR%3ADEFAULT::CONTENT::ADAPTIVE::MULTI::KRDS_CONTENT",
  "screenType": "CONTENT",
  "specification": {
    "accessibility": "WCAG 2.1 AA, 키보드 순서, 명시적 라벨, 비색상 판정, 오류 요약과 포커스 이동을 제공한다.",
    "actions": [
      {
        "code": "ACTION_1",
        "label": "CONFIRM_NOTICE_RECEIPT"
      },
      {
        "code": "ACTION_2",
        "label": "SAVE_DRAFT"
      },
      {
        "code": "ACTION_3",
        "label": "REQUEST_CORRECTION"
      }
    ],
    "actorResponsibilities": [],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "/api/work/legal-notification-delivery/lnd_receipt"
      }
    ],
    "businessPurpose": "도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.",
    "completionRule": "통지 완료 또는 담당자 에스컬레이션이 확정됨",
    "dataContracts": [
      {
        "code": "DATA_1",
        "label": "tenantId"
      },
      {
        "code": "DATA_2",
        "label": "projectId"
      },
      {
        "code": "DATA_3",
        "label": "businessId"
      },
      {
        "code": "DATA_4",
        "label": "recordId"
      },
      {
        "code": "DATA_5",
        "label": "statusCode"
      },
      {
        "code": "DATA_6",
        "label": "rowVersion"
      },
      {
        "code": "DATA_7",
        "label": "evidenceHash"
      },
      {
        "code": "DATA_8",
        "label": "nextTaskId"
      }
    ],
    "designSystem": "KRDS_GOV",
    "entryConditions": [
      "REVIEW_READY"
    ],
    "errors": [],
    "exitConditions": [
      "통지 완료 또는 담당자 에스컬레이션이 확정됨"
    ],
    "extensions": {},
    "fields": [
      {
        "apiProperty": "projectId",
        "audience": "USER",
        "controlType": "PROJECT_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "projectId",
        "fieldGroup": "업무 범위",
        "fieldName": "프로젝트",
        "fieldOrder": 10,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "allowUnknown": false,
          "nullable": false,
          "required": true,
          "type": "code"
        }
      },
      {
        "apiProperty": "businessId",
        "audience": "USER",
        "controlType": "ENTITY_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "businessId",
        "fieldGroup": "업무 범위",
        "fieldName": "업무 대상 ID",
        "fieldOrder": 20,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "CONFIDENTIAL",
        "required": true,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 1,
          "nullable": false,
          "required": true,
          "trim": true,
          "type": "string"
        }
      },
      {
        "apiProperty": "referenceCode",
        "audience": "USER",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "referenceCode",
        "fieldGroup": "업무 범위",
        "fieldName": "참조·로트·신청 번호",
        "fieldOrder": 30,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 1,
          "nullable": false,
          "required": true,
          "trim": true,
          "type": "string"
        }
      },
      {
        "apiProperty": "statusCode",
        "audience": "USER",
        "controlType": "STATUS_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "statusCode",
        "fieldGroup": "상태",
        "fieldName": "업무 상태",
        "fieldOrder": 40,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 1,
          "nullable": false,
          "required": true,
          "trim": true,
          "type": "string"
        }
      },
      {
        "apiProperty": "effectiveAt",
        "audience": "USER",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "effectiveAt",
        "fieldGroup": "기준",
        "fieldName": "발생·적용 일시",
        "fieldOrder": 50,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "nullable": false,
          "required": true,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "quantityValue",
        "audience": "USER",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "quantityValue",
        "fieldGroup": "전문값",
        "fieldName": "수량·측정·금액 값",
        "fieldOrder": 60,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "numeric": true,
          "unitRequiredWhenPresent": true
        }
      },
      {
        "apiProperty": "unitCode",
        "audience": "USER",
        "controlType": "UNIT_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "unitCode",
        "fieldGroup": "전문값",
        "fieldName": "단위·통화",
        "fieldOrder": 70,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 0,
          "nullable": true,
          "required": false,
          "trim": true,
          "type": "string"
        }
      },
      {
        "apiProperty": "qualityCode",
        "audience": "USER",
        "controlType": "QUALITY_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "qualityCode",
        "fieldGroup": "품질·외부검증",
        "fieldName": "품질·적합 등급",
        "fieldOrder": 80,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 0,
          "nullable": true,
          "required": false,
          "trim": true,
          "type": "string"
        }
      },
      {
        "apiProperty": "externalCheckStatus",
        "audience": "USER",
        "controlType": "STATUS_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "externalCheckStatus",
        "fieldGroup": "품질·외부검증",
        "fieldName": "외부검증 상태",
        "fieldOrder": 90,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 0,
          "nullable": true,
          "required": false,
          "trim": true,
          "type": "string"
        }
      },
      {
        "apiProperty": "evidenceIds",
        "audience": "USER",
        "controlType": "FILE_UPLOAD",
        "dataType": "ARRAY",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "evidenceIds",
        "fieldGroup": "증적",
        "fieldName": "원본·결정 증빙",
        "fieldOrder": 100,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "hashRequired": true,
          "minItems": 1
        }
      },
      {
        "apiProperty": "decisionCode",
        "audience": "USER",
        "controlType": "DECISION_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "decisionCode",
        "fieldGroup": "결정",
        "fieldName": "판정·승인 결과",
        "fieldOrder": 110,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 0,
          "nullable": true,
          "required": false,
          "trim": true,
          "type": "string"
        }
      },
      {
        "apiProperty": "decisionComment",
        "audience": "USER",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "decisionComment",
        "fieldGroup": "결정",
        "fieldName": "판정·보완·반려 사유",
        "fieldOrder": 120,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "requiredWhen": [
            "CORRECTION",
            "REJECTED"
          ]
        }
      },
      {
        "apiProperty": "rowVersion",
        "audience": "USER",
        "controlType": "VERSION",
        "dataType": "INTEGER",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "무결성",
        "fieldName": "데이터 버전",
        "fieldOrder": 130,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "finite": true,
          "nullable": false,
          "required": true,
          "type": "number"
        }
      },
      {
        "apiProperty": "nextTaskId",
        "audience": "USER",
        "controlType": "TASK_LINK",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "nextTaskId",
        "fieldGroup": "후속업무",
        "fieldName": "다음 업무",
        "fieldOrder": 140,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "permissionCode": "AUDITOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/legal-notification-delivery?step=lnd_receipt",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "maxLength": 4000,
          "minLength": 0,
          "nullable": true,
          "required": false,
          "trim": true,
          "type": "string"
        }
      }
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "진행률"
      },
      {
        "code": "KPI_2",
        "label": "기한"
      },
      {
        "code": "KPI_3",
        "label": "차단건"
      },
      {
        "code": "KPI_4",
        "label": "미결 증적"
      },
      {
        "code": "KPI_5",
        "label": "후속업무"
      }
    ],
    "permissions": [],
    "responsive": "KRDS 유동 그리드. 모바일 1열, 태블릿 2열, 데스크톱 목록·상세 패널. 텍스트는 줄바꿈하고 수평 스크롤은 표 내부로 제한한다.",
    "schemaVersion": "2.0.0",
    "sections": [
      {
        "code": "SECTION_1",
        "label": "업무요약"
      },
      {
        "code": "SECTION_2",
        "label": "선행조건"
      },
      {
        "code": "SECTION_3",
        "label": "전문 데이터"
      },
      {
        "code": "SECTION_4",
        "label": "검증·증적"
      },
      {
        "code": "SECTION_5",
        "label": "결정·이력"
      },
      {
        "code": "SECTION_6",
        "label": "다음업무"
      }
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "BLOCKED",
      "CONFLICT",
      "COMPLETED"
    ],
    "support": {
      "assetBindings": [
        {
          "assetCode": "SECTION_1",
          "assetType": "SECTION",
          "slot": "SECTION_1"
        },
        {
          "assetCode": "SECTION_2",
          "assetType": "SECTION",
          "slot": "SECTION_2"
        },
        {
          "assetCode": "SECTION_3",
          "assetType": "SECTION",
          "slot": "SECTION_3"
        },
        {
          "assetCode": "SECTION_4",
          "assetType": "SECTION",
          "slot": "SECTION_4"
        },
        {
          "assetCode": "SECTION_5",
          "assetType": "SECTION",
          "slot": "SECTION_5"
        },
        {
          "assetCode": "SECTION_6",
          "assetType": "SECTION",
          "slot": "SECTION_6"
        }
      ],
      "designCard": {
        "actionCount": 3,
        "designSystem": "KRDS_GOV",
        "fieldCount": 14,
        "pageName": "도달·열람·수신증 확정",
        "screenType": "CONTENT",
        "sectionCount": 6,
        "summary": "도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.",
        "templateCode": "KRDS_CONTENT",
        "title": "도달·열람·수신증 확정"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-1\"]",
            "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무요약",
            "placement": "top",
            "title": "업무요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-2\"]",
            "body": "선행조건 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "선행조건",
            "placement": "top",
            "title": "선행조건"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-3\"]",
            "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "전문 데이터",
            "placement": "top",
            "title": "전문 데이터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-4\"]",
            "body": "검증·증적 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "검증·증적",
            "placement": "top",
            "title": "검증·증적"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-5\"]",
            "body": "결정·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "결정·이력",
            "placement": "top",
            "title": "결정·이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-6\"]",
            "body": "다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_6",
            "highlightStyle": "neutral",
            "id": "SECTION_6",
            "label": "다음업무",
            "placement": "top",
            "title": "다음업무"
          }
        ],
        "pageId": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
        "summary": "도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.",
        "title": "도달·열람·수신증 확정 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "통지 완료 또는 담당자 에스컬레이션이 확정됨"
        ],
        "checks": [],
        "requiredScenarioTypes": [
          "HAPPY_PATH",
          "AUTHORITY",
          "ISOLATION",
          "EXCEPTION",
          "RECOVERY"
        ],
        "summary": "페이지와 프로세스 계약의 자동 검증 기준입니다.",
        "title": "도달·열람·수신증 확정 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "CONFIRM_NOTICE_RECEIPT"
          },
          {
            "code": "ACTION_2",
            "label": "SAVE_DRAFT"
          },
          {
            "code": "ACTION_3",
            "label": "REQUEST_CORRECTION"
          }
        ],
        "nextAction": {
          "completionRule": "통지 완료 또는 담당자 에스컬레이션이 확정됨",
          "label": "다음 업무 진행",
          "routePath": "/work/legal-notification-delivery"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "REVIEW_READY",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무요약 · 선행조건 · 전문 데이터 · 검증·증적 · 결정·이력 · 다음업무",
            "label": "업무 정보 작성",
            "path": "/work/legal-notification-delivery"
          },
          {
            "code": "COMPLETE",
            "description": "통지 완료 또는 담당자 에스컬레이션이 확정됨",
            "label": "검증 후 완료"
          }
        ],
        "summary": "도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.",
        "title": "도달·열람·수신증 확정 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "LND_RECEIPT",
  "support": {
    "assetBindings": [
      {
        "assetCode": "SECTION_1",
        "assetType": "SECTION",
        "slot": "SECTION_1"
      },
      {
        "assetCode": "SECTION_2",
        "assetType": "SECTION",
        "slot": "SECTION_2"
      },
      {
        "assetCode": "SECTION_3",
        "assetType": "SECTION",
        "slot": "SECTION_3"
      },
      {
        "assetCode": "SECTION_4",
        "assetType": "SECTION",
        "slot": "SECTION_4"
      },
      {
        "assetCode": "SECTION_5",
        "assetType": "SECTION",
        "slot": "SECTION_5"
      },
      {
        "assetCode": "SECTION_6",
        "assetType": "SECTION",
        "slot": "SECTION_6"
      }
    ],
    "designCard": {
      "actionCount": 3,
      "designSystem": "KRDS_GOV",
      "fieldCount": 14,
      "pageName": "도달·열람·수신증 확정",
      "screenType": "CONTENT",
      "sectionCount": 6,
      "summary": "도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.",
      "templateCode": "KRDS_CONTENT",
      "title": "도달·열람·수신증 확정"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-1\"]",
          "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무요약",
          "placement": "top",
          "title": "업무요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-2\"]",
          "body": "선행조건 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "선행조건",
          "placement": "top",
          "title": "선행조건"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-3\"]",
          "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "전문 데이터",
          "placement": "top",
          "title": "전문 데이터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-4\"]",
          "body": "검증·증적 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "검증·증적",
          "placement": "top",
          "title": "검증·증적"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-5\"]",
          "body": "결정·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "결정·이력",
          "placement": "top",
          "title": "결정·이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-legal-notification-delivery-lnd-receipt-user-section-6\"]",
          "body": "다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_6",
          "highlightStyle": "neutral",
          "id": "SECTION_6",
          "label": "다음업무",
          "placement": "top",
          "title": "다음업무"
        }
      ],
      "pageId": "LEGAL_NOTIFICATION_DELIVERY_LND_RECEIPT_USER",
      "summary": "도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.",
      "title": "도달·열람·수신증 확정 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "통지 완료 또는 담당자 에스컬레이션이 확정됨"
      ],
      "checks": [],
      "requiredScenarioTypes": [
        "HAPPY_PATH",
        "AUTHORITY",
        "ISOLATION",
        "EXCEPTION",
        "RECOVERY"
      ],
      "summary": "페이지와 프로세스 계약의 자동 검증 기준입니다.",
      "title": "도달·열람·수신증 확정 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "CONFIRM_NOTICE_RECEIPT"
        },
        {
          "code": "ACTION_2",
          "label": "SAVE_DRAFT"
        },
        {
          "code": "ACTION_3",
          "label": "REQUEST_CORRECTION"
        }
      ],
      "nextAction": {
        "completionRule": "통지 완료 또는 담당자 에스컬레이션이 확정됨",
        "label": "다음 업무 진행",
        "routePath": "/work/legal-notification-delivery"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "REVIEW_READY",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무요약 · 선행조건 · 전문 데이터 · 검증·증적 · 결정·이력 · 다음업무",
          "label": "업무 정보 작성",
          "path": "/work/legal-notification-delivery"
        },
        {
          "code": "COMPLETE",
          "description": "통지 완료 또는 담당자 에스컬레이션이 확정됨",
          "label": "검증 후 완료"
        }
      ],
      "summary": "도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.",
      "title": "도달·열람·수신증 확정 업무 길잡이"
    }
  },
  "templateCode": "KRDS_CONTENT",
  "traceability": {
    "caseTypeCount": 5,
    "designReadinessScore": 100,
    "evidenceContract": [
      "원본 스냅샷",
      "외부응답",
      "검토·결정",
      "감사이벤트",
      "무결성해시"
    ],
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
