import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_6ac9689eee8aa585aa07 = {
  "actorCode": "STORAGE_SITE_MANAGER",
  "audience": "USER",
  "blueprintCode": "BP_AUTO_6AC9689EEE8AA585AA0702F3",
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
  "designHash": "c9eeca94b00aa75c50847133049d6898f861a78689b45e54f9ebc285fe1f9e15",
  "id": "auto-6ac9689eee8aa585aa07",
  "pageId": "AUTO_6AC9689EEE8AA585AA07",
  "pageName": "주입계획·허용한계 설정 사용자 업무 화면",
  "processCode": "CO2_INJECTION_STORAGE_OPERATION",
  "routePath": "/ccus/facility/co2-injection-storage-operation",
  "screenCoordinate": {
    "actor": "STORAGE_SITE_MANAGER",
    "device": "ADAPTIVE",
    "domain": "CO2",
    "locale": "MULTI",
    "policy": "STORAGE_SITE_MANAGER:DEFAULT",
    "process": "CO2_INJECTION_STORAGE_OPERATION",
    "state": "LOADING",
    "step": "CISO_PLAN",
    "variant": "KRDS_FORM",
    "view": "FORM"
  },
  "screenCoordinateKey": "CO2::CO2_INJECTION_STORAGE_OPERATION::CISO_PLAN::LOADING::STORAGE_SITE_MANAGER::STORAGE_SITE_MANAGER%3ADEFAULT::FORM::ADAPTIVE::MULTI::KRDS_FORM",
  "screenType": "FORM",
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
        "label": "PLAN_INJECTION"
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
      "STORAGE_SITE_MANAGER 액터가 권한·업무분리 정책에 따라 주입계획·허용한계 설정 사용자 업무 화면 업무를 수행한다."
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "/api/ccus/facility/co2-injection-storage-operation/ciso_plan"
      }
    ],
    "businessPurpose": "주입량·압력·온도·정지조건·저장용량을 계획한다.",
    "completionRule": "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
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
      "다음 프로세스 시작 조건을 충족한다: 승인된 저장소·주입정·운영계획과 유효 계측기가 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
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
      "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다."
    ],
    "extensions": {
      "contractId": 328,
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
        "fieldGroup": "컨텍스트",
        "fieldName": "프로젝트",
        "fieldOrder": 10,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
        "pageCode": "CO2_INJECTION_STORAGE_OPERATION_CISO_PLAN_USER",
        "permissionCode": "STORAGE_SITE_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/ccus/facility/co2-injection-storage-operation?step=ciso_plan",
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
    "permissions": [
      {
        "code": "STORAGE_SITE_MANAGER",
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
        "pageName": "주입계획·허용한계 설정 사용자 업무 화면",
        "screenType": "FORM",
        "sectionCount": 5,
        "summary": "주입량·압력·온도·정지조건·저장용량을 계획한다.",
        "templateCode": "KRDS_FORM",
        "title": "주입계획·허용한계 설정 사용자 업무 화면"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-1\"]",
            "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무요약",
            "placement": "top",
            "title": "업무요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-2\"]",
            "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "검색·필터",
            "placement": "top",
            "title": "검색·필터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-3\"]",
            "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "전문 데이터",
            "placement": "top",
            "title": "전문 데이터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-4\"]",
            "body": "증빙·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "증빙·이력",
            "placement": "top",
            "title": "증빙·이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-5\"]",
            "body": "명령·다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "명령·다음업무",
            "placement": "top",
            "title": "명령·다음업무"
          }
        ],
        "pageId": "AUTO_6AC9689EEE8AA585AA07",
        "summary": "주입량·압력·온도·정지조건·저장용량을 계획한다.",
        "title": "주입계획·허용한계 설정 사용자 업무 화면 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다."
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
        "title": "주입계획·허용한계 설정 사용자 업무 화면 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "PLAN_INJECTION"
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
          "completionRule": "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
          "label": "다음 업무 진행",
          "routePath": "/ccus/facility/co2-injection-storage-operation"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 승인된 저장소·주입정·운영계획과 유효 계측기가 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무요약 · 검색·필터 · 전문 데이터 · 증빙·이력 · 명령·다음업무",
            "label": "업무 정보 작성",
            "path": "/ccus/facility/co2-injection-storage-operation"
          },
          {
            "code": "COMPLETE",
            "description": "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "주입량·압력·온도·정지조건·저장용량을 계획한다.",
        "title": "주입계획·허용한계 설정 사용자 업무 화면 업무 길잡이"
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
  "stepCode": "CISO_PLAN",
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
      "pageName": "주입계획·허용한계 설정 사용자 업무 화면",
      "screenType": "FORM",
      "sectionCount": 5,
      "summary": "주입량·압력·온도·정지조건·저장용량을 계획한다.",
      "templateCode": "KRDS_FORM",
      "title": "주입계획·허용한계 설정 사용자 업무 화면"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-1\"]",
          "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무요약",
          "placement": "top",
          "title": "업무요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-2\"]",
          "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "검색·필터",
          "placement": "top",
          "title": "검색·필터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-3\"]",
          "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "전문 데이터",
          "placement": "top",
          "title": "전문 데이터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-4\"]",
          "body": "증빙·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "증빙·이력",
          "placement": "top",
          "title": "증빙·이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-6ac9689eee8aa585aa07-section-5\"]",
          "body": "명령·다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "명령·다음업무",
          "placement": "top",
          "title": "명령·다음업무"
        }
      ],
      "pageId": "AUTO_6AC9689EEE8AA585AA07",
      "summary": "주입량·압력·온도·정지조건·저장용량을 계획한다.",
      "title": "주입계획·허용한계 설정 사용자 업무 화면 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다."
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
      "title": "주입계획·허용한계 설정 사용자 업무 화면 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "PLAN_INJECTION"
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
        "completionRule": "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
        "label": "다음 업무 진행",
        "routePath": "/ccus/facility/co2-injection-storage-operation"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 승인된 저장소·주입정·운영계획과 유효 계측기가 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무요약 · 검색·필터 · 전문 데이터 · 증빙·이력 · 명령·다음업무",
          "label": "업무 정보 작성",
          "path": "/ccus/facility/co2-injection-storage-operation"
        },
        {
          "code": "COMPLETE",
          "description": "다음 완료 기준을 검증한다: 허가조건 내 주입계획이 승인됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "주입량·압력·온도·정지조건·저장용량을 계획한다.",
      "title": "주입계획·허용한계 설정 사용자 업무 화면 업무 길잡이"
    }
  },
  "templateCode": "KRDS_FORM",
  "traceability": {
    "contractId": 328,
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
      "CO2_INJECTION_STORAGE_OPERATION:CISO_PLAN:USER"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
