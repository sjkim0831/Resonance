import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_facility_emergency_response_fer_declare_user = {
  "actorCode": "FACILITY_OPERATOR",
  "audience": "USER",
  "blueprintCode": "BP_FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
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
  "designHash": "439089f3c8a611f2c1e0621bde9af57c91cd59cec37abd90df4eee38e3e43346",
  "id": "facility-emergency-response-fer-declare-user",
  "pageId": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
  "pageName": "사고 탐지·비상 선언",
  "processCode": "FACILITY_EMERGENCY_RESPONSE",
  "routePath": "/ccus/facility/facility-emergency-response",
  "screenCoordinate": {
    "actor": "FACILITY_OPERATOR",
    "device": "ADAPTIVE",
    "domain": "FACILITY",
    "locale": "MULTI",
    "policy": "FACILITY_OPERATOR:DEFAULT",
    "process": "FACILITY_EMERGENCY_RESPONSE",
    "state": "LOADING",
    "step": "FER_DECLARE",
    "variant": "KRDS_CONTENT",
    "view": "CONTENT"
  },
  "screenCoordinateKey": "FACILITY::FACILITY_EMERGENCY_RESPONSE::FER_DECLARE::LOADING::FACILITY_OPERATOR::FACILITY_OPERATOR%3ADEFAULT::CONTENT::ADAPTIVE::MULTI::KRDS_CONTENT",
  "screenType": "CONTENT",
  "specification": {
    "accessibility": "WCAG 2.1 AA, 키보드 명령, 명시적 라벨·오류·상태 안내를 제공한다.",
    "actions": [
      {
        "code": "ACTION_1",
        "label": "DECLARE_INCIDENT"
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
        "label": "/api/ccus/facility/facility-emergency-response/fer_declare"
      }
    ],
    "businessPurpose": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
    "completionRule": "비상등급·위치·영향·초동조치가 등록됨",
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
        "label": "facilityId"
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
      }
    ],
    "designSystem": "KRDS_GOV",
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 비상대응 조직·연락망·대응계획과 훈련 이력이 유효하다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "errors": [],
    "exitConditions": [
      "비상등급·위치·영향·초동조치가 등록됨"
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
        "fieldGroup": "컨텍스트",
        "fieldName": "프로젝트",
        "fieldOrder": 10,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "apiProperty": "facilityId",
        "audience": "USER",
        "controlType": "FACILITY_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "facilityId",
        "fieldGroup": "설비",
        "fieldName": "설비 ID",
        "fieldOrder": 20,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "apiProperty": "assetTag",
        "audience": "USER",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "assetTag",
        "fieldGroup": "설비",
        "fieldName": "설비 태그",
        "fieldOrder": 30,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "apiProperty": "siteCode",
        "audience": "USER",
        "controlType": "SITE_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "siteCode",
        "fieldGroup": "설비",
        "fieldName": "사업장·저장소",
        "fieldOrder": 40,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "fieldGroup": "운영",
        "fieldName": "업무 상태",
        "fieldOrder": 50,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "fieldGroup": "운영",
        "fieldName": "발생·적용 일시",
        "fieldOrder": 60,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "nullable": false,
          "required": true,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "measurementValue",
        "audience": "USER",
        "controlType": "NUMBER_UNIT",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "measurementValue",
        "fieldGroup": "전문값",
        "fieldName": "측정·운영 값",
        "fieldOrder": 70,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "numeric": true,
          "unitRequired": true
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
        "fieldName": "단위",
        "fieldOrder": 80,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "apiProperty": "riskLevel",
        "audience": "USER",
        "controlType": "RISK_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "riskLevel",
        "fieldGroup": "위험·검토",
        "fieldName": "위험 등급",
        "fieldOrder": 90,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "apiProperty": "evidenceIds",
        "audience": "USER",
        "controlType": "FILE_UPLOAD",
        "dataType": "ARRAY",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "evidenceIds",
        "fieldGroup": "증빙",
        "fieldName": "원본 증빙",
        "fieldOrder": 100,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "hashRequired": true,
          "minItems": 1
        }
      },
      {
        "apiProperty": "approvalComment",
        "audience": "USER",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "approvalComment",
        "fieldGroup": "승인",
        "fieldName": "검토·승인 의견",
        "fieldOrder": 110,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
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
        "apiProperty": "rowVersion",
        "audience": "USER",
        "controlType": "VERSION",
        "dataType": "INTEGER",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "무결성",
        "fieldName": "데이터 버전",
        "fieldOrder": 120,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "permissionCode": "FACILITY_OPERATOR:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/facility-emergency-response?step=fer_declare",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "finite": true,
          "nullable": false,
          "required": true,
          "type": "number"
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
        "label": "이상·차단"
      },
      {
        "code": "KPI_4",
        "label": "증빙 완결성"
      }
    ],
    "permissions": [],
    "responsive": "KRDS 유동 그리드: 모바일 1열, 태블릿 2열, 데스크톱 업무표+상세패널. 텍스트 넘침 없이 줄바꿈한다.",
    "schemaVersion": "2.0.0",
    "sections": [
      {
        "code": "SECTION_1",
        "label": "업무요약"
      },
      {
        "code": "SECTION_2",
        "label": "검색·필터"
      },
      {
        "code": "SECTION_3",
        "label": "전문 데이터"
      },
      {
        "code": "SECTION_4",
        "label": "증빙·이력"
      },
      {
        "code": "SECTION_5",
        "label": "명령·다음업무"
      }
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "BLOCKED",
      "CONFLICT"
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
        }
      ],
      "designCard": {
        "actionCount": 3,
        "designSystem": "KRDS_GOV",
        "fieldCount": 12,
        "pageName": "사고 탐지·비상 선언",
        "screenType": "CONTENT",
        "sectionCount": 5,
        "summary": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
        "templateCode": "KRDS_CONTENT",
        "title": "사고 탐지·비상 선언"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-1\"]",
            "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무요약",
            "placement": "top",
            "title": "업무요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-2\"]",
            "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "검색·필터",
            "placement": "top",
            "title": "검색·필터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-3\"]",
            "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "전문 데이터",
            "placement": "top",
            "title": "전문 데이터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-4\"]",
            "body": "증빙·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "증빙·이력",
            "placement": "top",
            "title": "증빙·이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-5\"]",
            "body": "명령·다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "명령·다음업무",
            "placement": "top",
            "title": "명령·다음업무"
          }
        ],
        "pageId": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
        "summary": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
        "title": "사고 탐지·비상 선언 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "비상등급·위치·영향·초동조치가 등록됨"
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
        "title": "사고 탐지·비상 선언 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "DECLARE_INCIDENT"
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
          "completionRule": "비상등급·위치·영향·초동조치가 등록됨",
          "label": "다음 업무 진행",
          "routePath": "/ccus/facility/facility-emergency-response"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 비상대응 조직·연락망·대응계획과 훈련 이력이 유효하다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무요약 · 검색·필터 · 전문 데이터 · 증빙·이력 · 명령·다음업무",
            "label": "업무 정보 작성",
            "path": "/ccus/facility/facility-emergency-response"
          },
          {
            "code": "COMPLETE",
            "description": "비상등급·위치·영향·초동조치가 등록됨",
            "label": "검증 후 완료"
          }
        ],
        "summary": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
        "title": "사고 탐지·비상 선언 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "FER_DECLARE",
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
      }
    ],
    "designCard": {
      "actionCount": 3,
      "designSystem": "KRDS_GOV",
      "fieldCount": 12,
      "pageName": "사고 탐지·비상 선언",
      "screenType": "CONTENT",
      "sectionCount": 5,
      "summary": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
      "templateCode": "KRDS_CONTENT",
      "title": "사고 탐지·비상 선언"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-1\"]",
          "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무요약",
          "placement": "top",
          "title": "업무요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-2\"]",
          "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "검색·필터",
          "placement": "top",
          "title": "검색·필터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-3\"]",
          "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "전문 데이터",
          "placement": "top",
          "title": "전문 데이터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-4\"]",
          "body": "증빙·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "증빙·이력",
          "placement": "top",
          "title": "증빙·이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-facility-emergency-response-fer-declare-user-section-5\"]",
          "body": "명령·다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "명령·다음업무",
          "placement": "top",
          "title": "명령·다음업무"
        }
      ],
      "pageId": "FACILITY_EMERGENCY_RESPONSE_FER_DECLARE_USER",
      "summary": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
      "title": "사고 탐지·비상 선언 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "비상등급·위치·영향·초동조치가 등록됨"
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
      "title": "사고 탐지·비상 선언 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "DECLARE_INCIDENT"
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
        "completionRule": "비상등급·위치·영향·초동조치가 등록됨",
        "label": "다음 업무 진행",
        "routePath": "/ccus/facility/facility-emergency-response"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 비상대응 조직·연락망·대응계획과 훈련 이력이 유효하다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무요약 · 검색·필터 · 전문 데이터 · 증빙·이력 · 명령·다음업무",
          "label": "업무 정보 작성",
          "path": "/ccus/facility/facility-emergency-response"
        },
        {
          "code": "COMPLETE",
          "description": "비상등급·위치·영향·초동조치가 등록됨",
          "label": "검증 후 완료"
        }
      ],
      "summary": "누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.",
      "title": "사고 탐지·비상 선언 업무 길잡이"
    }
  },
  "templateCode": "KRDS_CONTENT",
  "traceability": {
    "caseTypeCount": 5,
    "designReadinessScore": 100,
    "evidenceContract": [
      "원본 운전·계측·정비 기록",
      "승인 이력",
      "무결성 해시"
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
