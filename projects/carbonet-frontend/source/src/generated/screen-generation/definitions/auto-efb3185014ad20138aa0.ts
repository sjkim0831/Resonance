import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_efb3185014ad20138aa0 = {
  "actorCode": "PRIVACY_OFFICER",
  "audience": "USER",
  "blueprintCode": "BP_AUTO_EFB3185014AD20138AA044B8",
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
  "designHash": "cdc0a4a40b461a280d29b3b0203cdeea958ac3ea4e377e5740ff21e2610d846c",
  "id": "auto-efb3185014ad20138aa0",
  "pageId": "AUTO_EFB3185014AD20138AA0",
  "pageName": "추가인증·마스킹 해제 통제 사용자 업무 화면",
  "processCode": "PRIVACY_RETENTION_DESTRUCTION",
  "routePath": "/work/privacy-retention-destruction",
  "screenCoordinate": {
    "actor": "PRIVACY_OFFICER",
    "device": "ADAPTIVE",
    "domain": "PRIVACY",
    "locale": "MULTI",
    "policy": "PRIVACY_OFFICER:DEFAULT",
    "process": "PRIVACY_RETENTION_DESTRUCTION",
    "state": "LOADING",
    "step": "PRD_ACCESS",
    "variant": "KRDS_AUTH",
    "view": "AUTH"
  },
  "screenCoordinateKey": "PRIVACY::PRIVACY_RETENTION_DESTRUCTION::PRD_ACCESS::LOADING::PRIVACY_OFFICER::PRIVACY_OFFICER%3ADEFAULT::AUTH::ADAPTIVE::MULTI::KRDS_AUTH",
  "screenType": "AUTH",
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
        "label": "AUTHORIZE_PRIVACY_ACCESS"
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
      "PRIVACY_OFFICER 액터가 권한·업무분리 정책에 따라 추가인증·마스킹 해제 통제 사용자 업무 화면 업무를 수행한다."
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "/api/work/privacy-retention-destruction/prd_access"
      }
    ],
    "businessPurpose": "열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.",
    "completionRule": "최소 범위 열람과 접근 감사이력이 생성됨",
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
      "다음 프로세스 시작 조건을 충족한다: 개인정보 분류·처리목적·보존기간·법적 보류 정책이 승인되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
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
      "최소 범위 열람과 접근 감사이력이 생성됨"
    ],
    "extensions": {
      "contractId": 478,
      "sharedRuntime": true
    },
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "CONFIDENTIAL",
        "required": true,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "pageCode": "PRIVACY_RETENTION_DESTRUCTION_PRD_ACCESS_USER",
        "permissionCode": "PRIVACY_OFFICER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/work/privacy-retention-destruction?step=prd_access",
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
        "code": "PRIVACY_OFFICER",
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
        "pageName": "추가인증·마스킹 해제 통제 사용자 업무 화면",
        "screenType": "AUTH",
        "sectionCount": 6,
        "summary": "열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.",
        "templateCode": "KRDS_AUTH",
        "title": "추가인증·마스킹 해제 통제 사용자 업무 화면"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-1\"]",
            "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무요약",
            "placement": "top",
            "title": "업무요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-2\"]",
            "body": "선행조건 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "선행조건",
            "placement": "top",
            "title": "선행조건"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-3\"]",
            "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "전문 데이터",
            "placement": "top",
            "title": "전문 데이터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-4\"]",
            "body": "검증·증적 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "검증·증적",
            "placement": "top",
            "title": "검증·증적"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-5\"]",
            "body": "결정·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "결정·이력",
            "placement": "top",
            "title": "결정·이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-6\"]",
            "body": "다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_6",
            "highlightStyle": "neutral",
            "id": "SECTION_6",
            "label": "다음업무",
            "placement": "top",
            "title": "다음업무"
          }
        ],
        "pageId": "AUTO_EFB3185014AD20138AA0",
        "summary": "열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.",
        "title": "추가인증·마스킹 해제 통제 사용자 업무 화면 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "최소 범위 열람과 접근 감사이력이 생성됨"
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
        "title": "추가인증·마스킹 해제 통제 사용자 업무 화면 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "AUTHORIZE_PRIVACY_ACCESS"
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
          "completionRule": "최소 범위 열람과 접근 감사이력이 생성됨",
          "label": "다음 업무 진행",
          "routePath": "/work/privacy-retention-destruction"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 개인정보 분류·처리목적·보존기간·법적 보류 정책이 승인되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무요약 · 선행조건 · 전문 데이터 · 검증·증적 · 결정·이력 · 다음업무",
            "label": "업무 정보 작성",
            "path": "/work/privacy-retention-destruction"
          },
          {
            "code": "COMPLETE",
            "description": "최소 범위 열람과 접근 감사이력이 생성됨",
            "label": "검증 후 완료"
          }
        ],
        "summary": "열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.",
        "title": "추가인증·마스킹 해제 통제 사용자 업무 화면 업무 길잡이"
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
  "stepCode": "PRD_ACCESS",
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
      "pageName": "추가인증·마스킹 해제 통제 사용자 업무 화면",
      "screenType": "AUTH",
      "sectionCount": 6,
      "summary": "열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.",
      "templateCode": "KRDS_AUTH",
      "title": "추가인증·마스킹 해제 통제 사용자 업무 화면"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-1\"]",
          "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무요약",
          "placement": "top",
          "title": "업무요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-2\"]",
          "body": "선행조건 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "선행조건",
          "placement": "top",
          "title": "선행조건"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-3\"]",
          "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "전문 데이터",
          "placement": "top",
          "title": "전문 데이터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-4\"]",
          "body": "검증·증적 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "검증·증적",
          "placement": "top",
          "title": "검증·증적"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-5\"]",
          "body": "결정·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "결정·이력",
          "placement": "top",
          "title": "결정·이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-efb3185014ad20138aa0-section-6\"]",
          "body": "다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_6",
          "highlightStyle": "neutral",
          "id": "SECTION_6",
          "label": "다음업무",
          "placement": "top",
          "title": "다음업무"
        }
      ],
      "pageId": "AUTO_EFB3185014AD20138AA0",
      "summary": "열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.",
      "title": "추가인증·마스킹 해제 통제 사용자 업무 화면 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "최소 범위 열람과 접근 감사이력이 생성됨"
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
      "title": "추가인증·마스킹 해제 통제 사용자 업무 화면 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "AUTHORIZE_PRIVACY_ACCESS"
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
        "completionRule": "최소 범위 열람과 접근 감사이력이 생성됨",
        "label": "다음 업무 진행",
        "routePath": "/work/privacy-retention-destruction"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 개인정보 분류·처리목적·보존기간·법적 보류 정책이 승인되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무요약 · 선행조건 · 전문 데이터 · 검증·증적 · 결정·이력 · 다음업무",
          "label": "업무 정보 작성",
          "path": "/work/privacy-retention-destruction"
        },
        {
          "code": "COMPLETE",
          "description": "최소 범위 열람과 접근 감사이력이 생성됨",
          "label": "검증 후 완료"
        }
      ],
      "summary": "열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.",
      "title": "추가인증·마스킹 해제 통제 사용자 업무 화면 업무 길잡이"
    }
  },
  "templateCode": "KRDS_AUTH",
  "traceability": {
    "contractId": 478,
    "designReadinessScore": 100,
    "generationBatchId": 182,
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ],
    "requirementIds": [
      "PRIVACY_RETENTION_DESTRUCTION:PRD_ACCESS:USER"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
