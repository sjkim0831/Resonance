import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_67217d6ee881a44d41f1 = {
  "actorCode": "TRADE_OPERATOR",
  "audience": "ADMIN",
  "blueprintCode": "BP_AUTO_67217D6EE881A44D41F141B3",
  "designCompleteness": {
    "checks": {
      "accessibility": true,
      "actions": true,
      "actor": true,
      "api": true,
      "assetBindings": true,
      "data": true,
      "designCard": true,
      "entry": true,
      "errors": true,
      "exit": true,
      "fields": true,
      "help": true,
      "permissions": true,
      "purpose": true,
      "qa": true,
      "responsive": true,
      "sections": true,
      "states": true,
      "tests": true,
      "validations": true,
      "workGuide": true
    },
    "complete": true,
    "score": 100
  },
  "designHash": "6af33a08ccc35786e06b998d9eac004773bd1f40028c4c972636a8b9ee1acbf7",
  "id": "auto-67217d6ee881a44d41f1",
  "pageId": "AUTO_67217D6EE881A44D41F1",
  "pageName": "로트 생성·원본 태그 확정 관리자 업무 화면",
  "processCode": "CO2_LOT_TAG_MANAGEMENT",
  "routePath": "/admin/work/co2-lot-tag-management",
  "screenCoordinate": {
    "actor": "TRADE_OPERATOR",
    "device": "ADAPTIVE",
    "domain": "CO2",
    "locale": "MULTI",
    "policy": "TRADE_OPERATOR:DEFAULT",
    "process": "CO2_LOT_TAG_MANAGEMENT",
    "state": "LOADING",
    "step": "CLT_CREATE",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "CO2::CO2_LOT_TAG_MANAGEMENT::CLT_CREATE::LOADING::TRADE_OPERATOR::TRADE_OPERATOR%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
  "screenType": "ADMIN",
  "specification": {
    "accessibility": {
      "focusManagement": true,
      "keyboard": true,
      "labels": true,
      "nonColorStatus": true,
      "standard": "WCAG_2_1_AA"
    },
    "actions": [
      {
        "code": "ACTION_1",
        "label": "CREATE_CO2_LOT"
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
    "actorResponsibilities": [
      "TRADE_OPERATOR 액터가 권한·업무분리 정책에 따라 로트 생성·원본 태그 확정 관리자 업무 화면 업무를 수행한다."
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "/api/work/co2-lot-tag-management/clt_create"
      }
    ],
    "businessPurpose": "포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.",
    "completionRule": "고유 로트와 불변 원본 해시가 생성됨",
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
      "다음 프로세스 시작 조건을 충족한다: 승인된 포집 기업·설비·계측기와 생산 실적이 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "errors": [
      {
        "code": "FORBIDDEN",
        "recovery": "권한·업무분리 확인"
      },
      {
        "code": "CONFLICT",
        "recovery": "최신 버전 재조회"
      },
      {
        "code": "DEPENDENCY_FAILURE",
        "recovery": "멱등키로 안전 재시도"
      }
    ],
    "exitConditions": [
      "고유 로트와 불변 원본 해시가 생성됨"
    ],
    "extensions": {
      "contractId": 449,
      "sharedRuntime": true
    },
    "fields": [
      {
        "apiProperty": "projectId",
        "audience": "ADMIN",
        "controlType": "PROJECT_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "projectId",
        "fieldGroup": "업무 범위",
        "fieldName": "프로젝트",
        "fieldOrder": 10,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "ENTITY_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "businessId",
        "fieldGroup": "업무 범위",
        "fieldName": "업무 대상 ID",
        "fieldOrder": 20,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "CONFIDENTIAL",
        "required": true,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "referenceCode",
        "fieldGroup": "업무 범위",
        "fieldName": "참조·로트·신청 번호",
        "fieldOrder": 30,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "STATUS_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "statusCode",
        "fieldGroup": "상태",
        "fieldName": "업무 상태",
        "fieldOrder": 40,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "effectiveAt",
        "fieldGroup": "기준",
        "fieldName": "발생·적용 일시",
        "fieldOrder": 50,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "quantityValue",
        "fieldGroup": "전문값",
        "fieldName": "수량·측정·금액 값",
        "fieldOrder": 60,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "numeric": true,
          "unitRequiredWhenPresent": true
        }
      },
      {
        "apiProperty": "unitCode",
        "audience": "ADMIN",
        "controlType": "UNIT_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "unitCode",
        "fieldGroup": "전문값",
        "fieldName": "단위·통화",
        "fieldOrder": 70,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "QUALITY_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "qualityCode",
        "fieldGroup": "품질·외부검증",
        "fieldName": "품질·적합 등급",
        "fieldOrder": 80,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "STATUS_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "externalCheckStatus",
        "fieldGroup": "품질·외부검증",
        "fieldName": "외부검증 상태",
        "fieldOrder": 90,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "FILE_UPLOAD",
        "dataType": "ARRAY",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "evidenceIds",
        "fieldGroup": "증적",
        "fieldName": "원본·결정 증빙",
        "fieldOrder": 100,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "hashRequired": true,
          "minItems": 1
        }
      },
      {
        "apiProperty": "decisionCode",
        "audience": "ADMIN",
        "controlType": "DECISION_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "decisionCode",
        "fieldGroup": "결정",
        "fieldName": "판정·승인 결과",
        "fieldOrder": 110,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "decisionComment",
        "fieldGroup": "결정",
        "fieldName": "판정·보완·반려 사유",
        "fieldOrder": 120,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "VERSION",
        "dataType": "INTEGER",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "무결성",
        "fieldName": "데이터 버전",
        "fieldOrder": 130,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
        "audience": "ADMIN",
        "controlType": "TASK_LINK",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "nextTaskId",
        "fieldGroup": "후속업무",
        "fieldName": "다음 업무",
        "fieldOrder": 140,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_LOT_TAG_MANAGEMENT_CLT_CREATE_ADMIN",
        "permissionCode": "TRADE_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/work/co2-lot-tag-management?step=clt_create",
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
    "permissions": [
      {
        "code": "TRADE_OPERATOR",
        "scope": "TENANT_PROJECT",
        "segregationOfDuties": true,
        "serverAuthorization": true
      }
    ],
    "responsive": {
      "desktop": "list-detail-workspace",
      "mobile": "single-column-actions-bottom",
      "tablet": "adaptive-grid"
    },
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
        "pageName": "로트 생성·원본 태그 확정 관리자 업무 화면",
        "screenType": "ADMIN",
        "sectionCount": 6,
        "summary": "포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.",
        "templateCode": "KRDS_ADMIN",
        "title": "로트 생성·원본 태그 확정 관리자 업무 화면"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-1\"]",
            "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무요약",
            "placement": "top",
            "title": "업무요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-2\"]",
            "body": "선행조건 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "선행조건",
            "placement": "top",
            "title": "선행조건"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-3\"]",
            "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "전문 데이터",
            "placement": "top",
            "title": "전문 데이터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-4\"]",
            "body": "검증·증적 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "검증·증적",
            "placement": "top",
            "title": "검증·증적"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-5\"]",
            "body": "결정·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "결정·이력",
            "placement": "top",
            "title": "결정·이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-6\"]",
            "body": "다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_6",
            "highlightStyle": "neutral",
            "id": "SECTION_6",
            "label": "다음업무",
            "placement": "top",
            "title": "다음업무"
          }
        ],
        "pageId": "AUTO_67217D6EE881A44D41F1",
        "summary": "포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.",
        "title": "로트 생성·원본 태그 확정 관리자 업무 화면 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "고유 로트와 불변 원본 해시가 생성됨"
        ],
        "checks": [
          {
            "code": "ENTRY_AND_REQUIRED_FIELDS",
            "label": "ENTRY_AND_REQUIRED_FIELDS",
            "type": "CONTRACT"
          },
          {
            "code": "STATE_AND_VERSION",
            "label": "STATE_AND_VERSION",
            "type": "CONCURRENCY"
          },
          {
            "code": "FORBIDDEN",
            "label": "FORBIDDEN",
            "recovery": "권한·업무분리 확인"
          },
          {
            "code": "CONFLICT",
            "label": "CONFLICT",
            "recovery": "최신 버전 재조회"
          },
          {
            "code": "DEPENDENCY_FAILURE",
            "label": "DEPENDENCY_FAILURE",
            "recovery": "멱등키로 안전 재시도"
          }
        ],
        "requiredScenarioTypes": [
          "HAPPY_PATH",
          "AUTHORITY",
          "ISOLATION",
          "EXCEPTION",
          "RECOVERY"
        ],
        "summary": "페이지와 프로세스 계약의 자동 검증 기준입니다.",
        "title": "로트 생성·원본 태그 확정 관리자 업무 화면 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "CREATE_CO2_LOT"
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
          "completionRule": "고유 로트와 불변 원본 해시가 생성됨",
          "label": "다음 업무 진행",
          "routePath": "/admin/work/co2-lot-tag-management"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 승인된 포집 기업·설비·계측기와 생산 실적이 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무요약 · 선행조건 · 전문 데이터 · 검증·증적 · 결정·이력 · 다음업무",
            "label": "업무 정보 작성",
            "path": "/admin/work/co2-lot-tag-management"
          },
          {
            "code": "COMPLETE",
            "description": "고유 로트와 불변 원본 해시가 생성됨",
            "label": "검증 후 완료"
          }
        ],
        "summary": "포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.",
        "title": "로트 생성·원본 태그 확정 관리자 업무 화면 업무 길잡이"
      }
    },
    "validations": [
      {
        "code": "ENTRY_AND_REQUIRED_FIELDS",
        "type": "CONTRACT"
      },
      {
        "code": "STATE_AND_VERSION",
        "type": "CONCURRENCY"
      }
    ]
  },
  "stepCode": "CLT_CREATE",
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
      "pageName": "로트 생성·원본 태그 확정 관리자 업무 화면",
      "screenType": "ADMIN",
      "sectionCount": 6,
      "summary": "포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.",
      "templateCode": "KRDS_ADMIN",
      "title": "로트 생성·원본 태그 확정 관리자 업무 화면"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-1\"]",
          "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무요약",
          "placement": "top",
          "title": "업무요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-2\"]",
          "body": "선행조건 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "선행조건",
          "placement": "top",
          "title": "선행조건"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-3\"]",
          "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "전문 데이터",
          "placement": "top",
          "title": "전문 데이터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-4\"]",
          "body": "검증·증적 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "검증·증적",
          "placement": "top",
          "title": "검증·증적"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-5\"]",
          "body": "결정·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "결정·이력",
          "placement": "top",
          "title": "결정·이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-67217d6ee881a44d41f1-section-6\"]",
          "body": "다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_6",
          "highlightStyle": "neutral",
          "id": "SECTION_6",
          "label": "다음업무",
          "placement": "top",
          "title": "다음업무"
        }
      ],
      "pageId": "AUTO_67217D6EE881A44D41F1",
      "summary": "포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.",
      "title": "로트 생성·원본 태그 확정 관리자 업무 화면 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "고유 로트와 불변 원본 해시가 생성됨"
      ],
      "checks": [
        {
          "code": "ENTRY_AND_REQUIRED_FIELDS",
          "label": "ENTRY_AND_REQUIRED_FIELDS",
          "type": "CONTRACT"
        },
        {
          "code": "STATE_AND_VERSION",
          "label": "STATE_AND_VERSION",
          "type": "CONCURRENCY"
        },
        {
          "code": "FORBIDDEN",
          "label": "FORBIDDEN",
          "recovery": "권한·업무분리 확인"
        },
        {
          "code": "CONFLICT",
          "label": "CONFLICT",
          "recovery": "최신 버전 재조회"
        },
        {
          "code": "DEPENDENCY_FAILURE",
          "label": "DEPENDENCY_FAILURE",
          "recovery": "멱등키로 안전 재시도"
        }
      ],
      "requiredScenarioTypes": [
        "HAPPY_PATH",
        "AUTHORITY",
        "ISOLATION",
        "EXCEPTION",
        "RECOVERY"
      ],
      "summary": "페이지와 프로세스 계약의 자동 검증 기준입니다.",
      "title": "로트 생성·원본 태그 확정 관리자 업무 화면 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "CREATE_CO2_LOT"
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
        "completionRule": "고유 로트와 불변 원본 해시가 생성됨",
        "label": "다음 업무 진행",
        "routePath": "/admin/work/co2-lot-tag-management"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 승인된 포집 기업·설비·계측기와 생산 실적이 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무요약 · 선행조건 · 전문 데이터 · 검증·증적 · 결정·이력 · 다음업무",
          "label": "업무 정보 작성",
          "path": "/admin/work/co2-lot-tag-management"
        },
        {
          "code": "COMPLETE",
          "description": "고유 로트와 불변 원본 해시가 생성됨",
          "label": "검증 후 완료"
        }
      ],
      "summary": "포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.",
      "title": "로트 생성·원본 태그 확정 관리자 업무 화면 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
  "traceability": {
    "contractId": 449,
    "designReadinessScore": 100,
    "generationBatchId": 183,
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ],
    "requirementIds": [
      "CO2_LOT_TAG_MANAGEMENT:CLT_CREATE:ADMIN"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
