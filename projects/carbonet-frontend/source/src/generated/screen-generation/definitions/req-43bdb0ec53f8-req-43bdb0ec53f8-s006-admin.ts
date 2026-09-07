import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_req_43bdb0ec53f8_req_43bdb0ec53f8_s006_admin = {
  "actorCode": "PLATFORM_ADMIN",
  "audience": "ADMIN",
  "blueprintCode": "BP_REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
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
  "designHash": "cd2f82bc14dd06a3303d50b9a627e9f6933387241fa825654a4f428c2e19fd97",
  "id": "req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin",
  "pageId": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
  "pageName": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리",
  "processCode": "REQ_43BDB0EC53F8",
  "routePath": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
  "screenCoordinate": {
    "actor": "PLATFORM_ADMIN",
    "device": "ADAPTIVE",
    "domain": "REQ",
    "locale": "MULTI",
    "policy": "PLATFORM_ADMIN:DEFAULT",
    "process": "REQ_43BDB0EC53F8",
    "state": "LOADING",
    "step": "REQ_43BDB0EC53F8_S006",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "REQ::REQ_43BDB0EC53F8::REQ_43BDB0EC53F8_S006::LOADING::PLATFORM_ADMIN::PLATFORM_ADMIN%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
  "screenType": "ADMIN",
  "specification": {
    "accessibility": "KRDS and WCAG 2.1 AA keyboard, focus, label, contrast, and error-message contract.",
    "actions": [
      {
        "code": "ACTION_1",
        "label": "EXECUTE_REQ_43BDB0EC53F8_S006"
      },
      {
        "code": "ACTION_2",
        "label": "SAVE_DRAFT"
      },
      {
        "code": "ACTION_3",
        "label": "ATTACH_EVIDENCE"
      },
      {
        "code": "ACTION_4",
        "label": "ROLLBACK_REQ_43BDB0EC53F8_S006"
      }
    ],
    "actorResponsibilities": [],
    "apiContracts": [
      {
        "contract": {
          "method": "POST",
          "path": "/admin/api/system/actor-process/executions/{executionId}/commands"
        }
      }
    ],
    "businessPurpose": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 업무를 추적 가능한 방식으로 완료한다.",
    "completionRule": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
    "dataContracts": [
      {
        "entity": "framework_process_execution"
      },
      {
        "entity": "framework_process_execution_event"
      },
      {
        "contextFields": [
          "tenantId",
          "projectId",
          "processCode",
          "stepCode",
          "actorCode",
          "statusCode",
          "rowVersion",
          "createdAt",
          "updatedAt"
        ]
      },
      {
        "input": {
          "fields": [
            {
              "fieldCode": "projectId",
              "label": "프로젝트 ID",
              "required": true,
              "type": "string"
            },
            {
              "fieldCode": "actorCode",
              "label": "수행 액터",
              "required": true,
              "type": "string"
            },
            {
              "fieldCode": "statusCode",
              "label": "업무 상태",
              "required": true,
              "type": "string"
            },
            {
              "fieldCode": "commandCode",
              "label": "업무 명령",
              "required": true,
              "type": "PATCH"
            },
            {
              "fieldCode": "payload",
              "label": "업무 입력 데이터",
              "required": true,
              "type": "object"
            },
            {
              "fieldCode": "rowVersion",
              "label": "동시성 버전",
              "required": true,
              "type": "integer"
            }
          ]
        }
      },
      {
        "output": {
          "processCode": "REQ_43BDB0EC53F8",
          "projectId": "string",
          "rowVersion": "integer",
          "statusCode": "STEP_6_COMPLETED",
          "stepCode": "REQ_43BDB0EC53F8_S006",
          "toState": "STEP_6_COMPLETED"
        }
      }
    ],
    "designSystem": "KRDS_GOV",
    "entryConditions": [
      "STEP_5_COMPLETED 상태이며 PLATFORM_ADMIN 액터가 프로젝트에 배정되어 있다."
    ],
    "errors": [],
    "exitConditions": [
      "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다. 완료 증적과 감사 이력이 저장된다."
    ],
    "extensions": {},
    "fields": [
      {
        "apiProperty": "tenantId",
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "tenantId",
        "fieldGroup": "COMMON",
        "fieldName": "테넌트",
        "fieldOrder": 1,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "projectId",
        "audience": "ADMIN",
        "controlType": "PROJECT_SELECTOR",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "projectId",
        "fieldGroup": "COMMON",
        "fieldName": "프로젝트",
        "fieldOrder": 2,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "processCode",
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processCode",
        "fieldGroup": "COMMON",
        "fieldName": "프로세스",
        "fieldOrder": 3,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "stepCode",
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepCode",
        "fieldGroup": "COMMON",
        "fieldName": "업무 단계",
        "fieldOrder": 4,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "actorCode",
        "audience": "ADMIN",
        "controlType": "ACTOR_SELECTOR",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "actorCode",
        "fieldGroup": "COMMON",
        "fieldName": "담당 액터",
        "fieldOrder": 5,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "statusCode",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "statusCode",
        "fieldGroup": "COMMON",
        "fieldName": "처리 상태",
        "fieldOrder": 6,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "rowVersion",
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "COMMON",
        "fieldName": "데이터 버전",
        "fieldOrder": 7,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "businessData",
        "audience": "ADMIN",
        "controlType": "DYNAMIC_FORM",
        "dataType": "JSON",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "businessData",
        "fieldGroup": "COMMON",
        "fieldName": "업무 입력",
        "fieldOrder": 8,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "evidenceFiles",
        "audience": "ADMIN",
        "controlType": "FILE_UPLOAD",
        "dataType": "FILE_LIST",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "evidenceFiles",
        "fieldGroup": "COMMON",
        "fieldName": "증적 파일",
        "fieldOrder": 9,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "auditHistory",
        "audience": "ADMIN",
        "controlType": "AUDIT_TIMELINE",
        "dataType": "JSON",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "auditHistory",
        "fieldGroup": "COMMON",
        "fieldName": "변경 이력",
        "fieldOrder": 10,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "permissionCode": "PLATFORM_ADMIN:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_43bdb0ec53f8/s006",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      }
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "처리 건수"
      },
      {
        "code": "KPI_2",
        "label": "완료율"
      },
      {
        "code": "KPI_3",
        "label": "기한 준수율"
      },
      {
        "code": "KPI_4",
        "label": "오류 건수"
      }
    ],
    "permissions": [],
    "responsive": "KRDS responsive contract for mobile 360px, tablet 768px, and desktop 1280px.",
    "schemaVersion": "2.0.0",
    "sections": [
      {
        "code": "SECTION_1",
        "label": "업무 요약"
      },
      {
        "code": "SECTION_2",
        "label": "입력 및 검증"
      },
      {
        "code": "SECTION_3",
        "label": "처리 결과"
      },
      {
        "code": "SECTION_4",
        "label": "증적 및 이력"
      },
      {
        "code": "SECTION_5",
        "label": "다음 업무"
      }
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "PROCESSING",
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
        }
      ],
      "designCard": {
        "actionCount": 4,
        "designSystem": "KRDS_GOV",
        "fieldCount": 10,
        "pageName": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리",
        "screenType": "ADMIN",
        "sectionCount": 5,
        "summary": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 업무를 추적 가능한 방식으로 완료한다.",
        "templateCode": "KRDS_ADMIN",
        "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-1\"]",
            "body": "업무 요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무 요약",
            "placement": "top",
            "title": "업무 요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-2\"]",
            "body": "입력 및 검증 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "입력 및 검증",
            "placement": "top",
            "title": "입력 및 검증"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-3\"]",
            "body": "처리 결과 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "처리 결과",
            "placement": "top",
            "title": "처리 결과"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-4\"]",
            "body": "증적 및 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "증적 및 이력",
            "placement": "top",
            "title": "증적 및 이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-5\"]",
            "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "다음 업무",
            "placement": "top",
            "title": "다음 업무"
          }
        ],
        "pageId": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
        "summary": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 업무를 추적 가능한 방식으로 완료한다.",
        "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다. 완료 증적과 감사 이력이 저장된다."
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
        "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "EXECUTE_REQ_43BDB0EC53F8_S006"
          },
          {
            "code": "ACTION_2",
            "label": "SAVE_DRAFT"
          },
          {
            "code": "ACTION_3",
            "label": "ATTACH_EVIDENCE"
          },
          {
            "code": "ACTION_4",
            "label": "ROLLBACK_REQ_43BDB0EC53F8_S006"
          }
        ],
        "nextAction": {
          "completionRule": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
          "label": "다음 업무 진행",
          "routePath": "/generated/ccus-platform/req_43bdb0ec53f8/s006"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "STEP_5_COMPLETED 상태이며 PLATFORM_ADMIN 액터가 프로젝트에 배정되어 있다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무 요약 · 입력 및 검증 · 처리 결과 · 증적 및 이력 · 다음 업무",
            "label": "업무 정보 작성",
            "path": "/generated/ccus-platform/req_43bdb0ec53f8/s006"
          },
          {
            "code": "COMPLETE",
            "description": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 업무를 추적 가능한 방식으로 완료한다.",
        "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "REQ_43BDB0EC53F8_S006",
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
      "actionCount": 4,
      "designSystem": "KRDS_GOV",
      "fieldCount": 10,
      "pageName": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리",
      "screenType": "ADMIN",
      "sectionCount": 5,
      "summary": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 업무를 추적 가능한 방식으로 완료한다.",
      "templateCode": "KRDS_ADMIN",
      "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-1\"]",
          "body": "업무 요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무 요약",
          "placement": "top",
          "title": "업무 요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-2\"]",
          "body": "입력 및 검증 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "입력 및 검증",
          "placement": "top",
          "title": "입력 및 검증"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-3\"]",
          "body": "처리 결과 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "처리 결과",
          "placement": "top",
          "title": "처리 결과"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-4\"]",
          "body": "증적 및 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "증적 및 이력",
          "placement": "top",
          "title": "증적 및 이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-43bdb0ec53f8-req-43bdb0ec53f8-s006-admin-section-5\"]",
          "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "다음 업무",
          "placement": "top",
          "title": "다음 업무"
        }
      ],
      "pageId": "REQ_43BDB0EC53F8_REQ_43BDB0EC53F8_S006_ADMIN",
      "summary": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 업무를 추적 가능한 방식으로 완료한다.",
      "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다. 완료 증적과 감사 이력이 저장된다."
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
      "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "EXECUTE_REQ_43BDB0EC53F8_S006"
        },
        {
          "code": "ACTION_2",
          "label": "SAVE_DRAFT"
        },
        {
          "code": "ACTION_3",
          "label": "ATTACH_EVIDENCE"
        },
        {
          "code": "ACTION_4",
          "label": "ROLLBACK_REQ_43BDB0EC53F8_S006"
        }
      ],
      "nextAction": {
        "completionRule": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
        "label": "다음 업무 진행",
        "routePath": "/generated/ccus-platform/req_43bdb0ec53f8/s006"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "STEP_5_COMPLETED 상태이며 PLATFORM_ADMIN 액터가 프로젝트에 배정되어 있다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무 요약 · 입력 및 검증 · 처리 결과 · 증적 및 이력 · 다음 업무",
          "label": "업무 정보 작성",
          "path": "/generated/ccus-platform/req_43bdb0ec53f8/s006"
        },
        {
          "code": "COMPLETE",
          "description": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 업무를 추적 가능한 방식으로 완료한다.",
      "title": "승인자는 결과를 승인하고 보고서 발급을 허가한다. 관리 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
  "traceability": {
    "caseTypeCount": 5,
    "designReadinessScore": 100,
    "evidenceContract": [
      "REQUEST",
      "RESPONSE",
      "DB_REREAD",
      "AUTHORITY",
      "E2E",
      "ROLLBACK"
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
