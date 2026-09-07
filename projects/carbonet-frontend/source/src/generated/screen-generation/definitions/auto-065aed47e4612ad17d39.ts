import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_065aed47e4612ad17d39 = {
  "actorCode": "FACILITY_OPERATOR",
  "audience": "ADMIN",
  "blueprintCode": "BP_AUTO_065AED47E4612AD17D3964D3",
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
  "designHash": "bfe756c67745571bcaed0a8da5ca0c70d3c62be06a520f33792904167e3d430c",
  "id": "auto-065aed47e4612ad17d39",
  "pageId": "AUTO_065AED47E4612AD17D39",
  "pageName": "운전계획·허용범위 설정 관리자 업무 화면",
  "processCode": "FACILITY_OPERATION_MONITORING",
  "routePath": "/admin/ccus/facility/facility-operation-monitoring",
  "screenCoordinate": {
    "actor": "FACILITY_OPERATOR",
    "device": "ADAPTIVE",
    "domain": "FACILITY",
    "locale": "MULTI",
    "policy": "FACILITY_OPERATOR:DEFAULT",
    "process": "FACILITY_OPERATION_MONITORING",
    "state": "LOADING",
    "step": "FOM_PLAN",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "FACILITY::FACILITY_OPERATION_MONITORING::FOM_PLAN::LOADING::FACILITY_OPERATOR::FACILITY_OPERATOR%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
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
        "label": "PLAN_OPERATION"
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
      "FACILITY_OPERATOR 액터가 권한·업무분리 정책에 따라 운전계획·허용범위 설정 관리자 업무 화면 업무를 수행한다."
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "/api/ccus/facility/facility-operation-monitoring/fom_plan"
      }
    ],
    "businessPurpose": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
    "completionRule": "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
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
      "다음 프로세스 시작 조건을 충족한다: 운영 가능한 설비와 유효한 계측기가 등록되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
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
      "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다."
    ],
    "extensions": {
      "contractId": 311,
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
        "fieldGroup": "컨텍스트",
        "fieldName": "프로젝트",
        "fieldOrder": 10,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "audience": "ADMIN",
        "controlType": "FACILITY_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "facilityId",
        "fieldGroup": "설비",
        "fieldName": "설비 ID",
        "fieldOrder": 20,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "assetTag",
        "fieldGroup": "설비",
        "fieldName": "설비 태그",
        "fieldOrder": 30,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "audience": "ADMIN",
        "controlType": "SITE_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "siteCode",
        "fieldGroup": "설비",
        "fieldName": "사업장·저장소",
        "fieldOrder": 40,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "fieldGroup": "운영",
        "fieldName": "업무 상태",
        "fieldOrder": 50,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "fieldGroup": "운영",
        "fieldName": "발생·적용 일시",
        "fieldOrder": 60,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "audience": "ADMIN",
        "controlType": "NUMBER_UNIT",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "measurementValue",
        "fieldGroup": "전문값",
        "fieldName": "측정·운영 값",
        "fieldOrder": 70,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "numeric": true,
          "unitRequired": true
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
        "fieldName": "단위",
        "fieldOrder": 80,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "audience": "ADMIN",
        "controlType": "RISK_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "riskLevel",
        "fieldGroup": "위험·검토",
        "fieldName": "위험 등급",
        "fieldOrder": 90,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "audience": "ADMIN",
        "controlType": "FILE_UPLOAD",
        "dataType": "ARRAY",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "evidenceIds",
        "fieldGroup": "증빙",
        "fieldName": "원본 증빙",
        "fieldOrder": 100,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "hashRequired": true,
          "minItems": 1
        }
      },
      {
        "apiProperty": "approvalComment",
        "audience": "ADMIN",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "approvalComment",
        "fieldGroup": "승인",
        "fieldName": "검토·승인 의견",
        "fieldOrder": 110,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "audience": "ADMIN",
        "controlType": "VERSION",
        "dataType": "INTEGER",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "무결성",
        "fieldName": "데이터 버전",
        "fieldOrder": 120,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "FACILITY_OPERATION_MONITORING_FOM_PLAN_ADMIN",
        "permissionCode": "FACILITY_OPERATOR:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/ccus/facility/facility-operation-monitoring?step=fom_plan",
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
        "code": "FACILITY_OPERATOR",
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
        "pageName": "운전계획·허용범위 설정 관리자 업무 화면",
        "screenType": "ADMIN",
        "sectionCount": 5,
        "summary": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
        "templateCode": "KRDS_ADMIN",
        "title": "운전계획·허용범위 설정 관리자 업무 화면"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-1\"]",
            "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무요약",
            "placement": "top",
            "title": "업무요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-2\"]",
            "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "검색·필터",
            "placement": "top",
            "title": "검색·필터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-3\"]",
            "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "전문 데이터",
            "placement": "top",
            "title": "전문 데이터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-4\"]",
            "body": "증빙·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "증빙·이력",
            "placement": "top",
            "title": "증빙·이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-5\"]",
            "body": "명령·다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "명령·다음업무",
            "placement": "top",
            "title": "명령·다음업무"
          }
        ],
        "pageId": "AUTO_065AED47E4612AD17D39",
        "summary": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
        "title": "운전계획·허용범위 설정 관리자 업무 화면 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다."
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
        "title": "운전계획·허용범위 설정 관리자 업무 화면 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "PLAN_OPERATION"
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
          "completionRule": "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
          "label": "다음 업무 진행",
          "routePath": "/admin/ccus/facility/facility-operation-monitoring"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 운영 가능한 설비와 유효한 계측기가 등록되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무요약 · 검색·필터 · 전문 데이터 · 증빙·이력 · 명령·다음업무",
            "label": "업무 정보 작성",
            "path": "/admin/ccus/facility/facility-operation-monitoring"
          },
          {
            "code": "COMPLETE",
            "description": "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
        "title": "운전계획·허용범위 설정 관리자 업무 화면 업무 길잡이"
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
  "stepCode": "FOM_PLAN",
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
      "pageName": "운전계획·허용범위 설정 관리자 업무 화면",
      "screenType": "ADMIN",
      "sectionCount": 5,
      "summary": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
      "templateCode": "KRDS_ADMIN",
      "title": "운전계획·허용범위 설정 관리자 업무 화면"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-1\"]",
          "body": "업무요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무요약",
          "placement": "top",
          "title": "업무요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-2\"]",
          "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "검색·필터",
          "placement": "top",
          "title": "검색·필터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-3\"]",
          "body": "전문 데이터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "전문 데이터",
          "placement": "top",
          "title": "전문 데이터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-4\"]",
          "body": "증빙·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "증빙·이력",
          "placement": "top",
          "title": "증빙·이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-065aed47e4612ad17d39-section-5\"]",
          "body": "명령·다음업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "명령·다음업무",
          "placement": "top",
          "title": "명령·다음업무"
        }
      ],
      "pageId": "AUTO_065AED47E4612AD17D39",
      "summary": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
      "title": "운전계획·허용범위 설정 관리자 업무 화면 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다."
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
      "title": "운전계획·허용범위 설정 관리자 업무 화면 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "PLAN_OPERATION"
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
        "completionRule": "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
        "label": "다음 업무 진행",
        "routePath": "/admin/ccus/facility/facility-operation-monitoring"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 운영 가능한 설비와 유효한 계측기가 등록되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무요약 · 검색·필터 · 전문 데이터 · 증빙·이력 · 명령·다음업무",
          "label": "업무 정보 작성",
          "path": "/admin/ccus/facility/facility-operation-monitoring"
        },
        {
          "code": "COMPLETE",
          "description": "다음 완료 기준을 검증한다: 승인 운전창과 알람 기준이 확정됨. 결과·버전·감사 증적을 저장한 뒤 PLANNED 상태로 원자적으로 전이한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "처리량·압력·온도·에너지 목표와 허용범위를 설정한다.",
      "title": "운전계획·허용범위 설정 관리자 업무 화면 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
  "traceability": {
    "contractId": 311,
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
      "FACILITY_OPERATION_MONITORING:FOM_PLAN:ADMIN"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
