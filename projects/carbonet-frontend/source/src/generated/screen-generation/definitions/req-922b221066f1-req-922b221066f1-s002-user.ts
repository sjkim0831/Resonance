import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_req_922b221066f1_req_922b221066f1_s002_user = {
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "blueprintCode": "BP_REQ_922B221066F1_REQ_922B221066F1_S002_USER",
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
  "designHash": "4c3cea076e6938e1d02fb9f62ccc9468897237c2df760ffd58f5a99b7e085d2e",
  "id": "req-922b221066f1-req-922b221066f1-s002-user",
  "pageId": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
  "pageName": "자료 담당자는 활동자료와 증빙 파일을 제출한다.",
  "processCode": "REQ_922B221066F1",
  "routePath": "/generated/ccus-platform/req_922b221066f1/s002",
  "screenCoordinate": {
    "actor": "COMPANY_MANAGER",
    "device": "ADAPTIVE",
    "domain": "REQ",
    "locale": "MULTI",
    "policy": "COMPANY_MANAGER:DEFAULT",
    "process": "REQ_922B221066F1",
    "state": "LOADING",
    "step": "REQ_922B221066F1_S002",
    "variant": "KRDS_CONTENT",
    "view": "CONTENT"
  },
  "screenCoordinateKey": "REQ::REQ_922B221066F1::REQ_922B221066F1_S002::LOADING::COMPANY_MANAGER::COMPANY_MANAGER%3ADEFAULT::CONTENT::ADAPTIVE::MULTI::KRDS_CONTENT",
  "screenType": "CONTENT",
  "specification": {
    "accessibility": "KRDS and WCAG 2.1 AA keyboard, focus, label, contrast, and error-message contract.",
    "actions": [
      {
        "code": "ACTION_1",
        "label": "EXECUTE_REQ_922B221066F1_S002"
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
        "label": "ROLLBACK_REQ_922B221066F1_S002"
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
    "businessPurpose": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무를 추적 가능한 방식으로 완료한다.",
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
              "type": "POST"
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
          "processCode": "REQ_922B221066F1",
          "projectId": "string",
          "rowVersion": "integer",
          "statusCode": "STEP_2_COMPLETED",
          "stepCode": "REQ_922B221066F1_S002",
          "toState": "STEP_2_COMPLETED"
        }
      }
    ],
    "designSystem": "KRDS_GOV",
    "entryConditions": [
      "STEP_1_COMPLETED 상태이며 COMPANY_MANAGER 액터가 프로젝트에 배정되어 있다."
    ],
    "errors": [],
    "exitConditions": [
      "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다. 완료 증적과 감사 이력이 저장된다."
    ],
    "extensions": {},
    "fields": [
      {
        "apiProperty": "tenantId",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "tenantId",
        "fieldGroup": "COMMON",
        "fieldName": "테넌트",
        "fieldOrder": 1,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "projectId",
        "audience": "USER",
        "controlType": "PROJECT_SELECTOR",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "projectId",
        "fieldGroup": "COMMON",
        "fieldName": "프로젝트",
        "fieldOrder": 2,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "processCode",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processCode",
        "fieldGroup": "COMMON",
        "fieldName": "프로세스",
        "fieldOrder": 3,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "stepCode",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepCode",
        "fieldGroup": "COMMON",
        "fieldName": "업무 단계",
        "fieldOrder": 4,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "actorCode",
        "audience": "USER",
        "controlType": "ACTOR_SELECTOR",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "actorCode",
        "fieldGroup": "COMMON",
        "fieldName": "담당 액터",
        "fieldOrder": 5,
        "mappingStatus": "CONTEXT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "statusCode",
        "audience": "USER",
        "controlType": "STATUS",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "statusCode",
        "fieldGroup": "COMMON",
        "fieldName": "처리 상태",
        "fieldOrder": 6,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "rowVersion",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "COMMON",
        "fieldName": "데이터 버전",
        "fieldOrder": 7,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "businessData",
        "audience": "USER",
        "controlType": "DYNAMIC_FORM",
        "dataType": "JSON",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "businessData",
        "fieldGroup": "COMMON",
        "fieldName": "업무 입력",
        "fieldOrder": 8,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "evidenceFiles",
        "audience": "USER",
        "controlType": "FILE_UPLOAD",
        "dataType": "FILE_LIST",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "evidenceFiles",
        "fieldGroup": "COMMON",
        "fieldName": "증적 파일",
        "fieldOrder": 9,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {}
      },
      {
        "apiProperty": "auditHistory",
        "audience": "USER",
        "controlType": "AUDIT_TIMELINE",
        "dataType": "JSON",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "auditHistory",
        "fieldGroup": "COMMON",
        "fieldName": "변경 이력",
        "fieldOrder": 10,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/generated/ccus-platform/req_922b221066f1/s002",
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
        "pageName": "자료 담당자는 활동자료와 증빙 파일을 제출한다.",
        "screenType": "CONTENT",
        "sectionCount": 5,
        "summary": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무를 추적 가능한 방식으로 완료한다.",
        "templateCode": "KRDS_CONTENT",
        "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다."
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-1\"]",
            "body": "업무 요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무 요약",
            "placement": "top",
            "title": "업무 요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-2\"]",
            "body": "입력 및 검증 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "입력 및 검증",
            "placement": "top",
            "title": "입력 및 검증"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-3\"]",
            "body": "처리 결과 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "처리 결과",
            "placement": "top",
            "title": "처리 결과"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-4\"]",
            "body": "증적 및 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "증적 및 이력",
            "placement": "top",
            "title": "증적 및 이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-5\"]",
            "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "다음 업무",
            "placement": "top",
            "title": "다음 업무"
          }
        ],
        "pageId": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
        "summary": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무를 추적 가능한 방식으로 완료한다.",
        "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 도움말"
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
        "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다. QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "EXECUTE_REQ_922B221066F1_S002"
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
            "label": "ROLLBACK_REQ_922B221066F1_S002"
          }
        ],
        "nextAction": {
          "completionRule": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
          "label": "다음 업무 진행",
          "routePath": "/generated/ccus-platform/req_922b221066f1/s002"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "STEP_1_COMPLETED 상태이며 COMPANY_MANAGER 액터가 프로젝트에 배정되어 있다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무 요약 · 입력 및 검증 · 처리 결과 · 증적 및 이력 · 다음 업무",
            "label": "업무 정보 작성",
            "path": "/generated/ccus-platform/req_922b221066f1/s002"
          },
          {
            "code": "COMPLETE",
            "description": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무를 추적 가능한 방식으로 완료한다.",
        "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "REQ_922B221066F1_S002",
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
      "pageName": "자료 담당자는 활동자료와 증빙 파일을 제출한다.",
      "screenType": "CONTENT",
      "sectionCount": 5,
      "summary": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무를 추적 가능한 방식으로 완료한다.",
      "templateCode": "KRDS_CONTENT",
      "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다."
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-1\"]",
          "body": "업무 요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무 요약",
          "placement": "top",
          "title": "업무 요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-2\"]",
          "body": "입력 및 검증 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "입력 및 검증",
          "placement": "top",
          "title": "입력 및 검증"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-3\"]",
          "body": "처리 결과 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "처리 결과",
          "placement": "top",
          "title": "처리 결과"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-4\"]",
          "body": "증적 및 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "증적 및 이력",
          "placement": "top",
          "title": "증적 및 이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-req-922b221066f1-req-922b221066f1-s002-user-section-5\"]",
          "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "다음 업무",
          "placement": "top",
          "title": "다음 업무"
        }
      ],
      "pageId": "REQ_922B221066F1_REQ_922B221066F1_S002_USER",
      "summary": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무를 추적 가능한 방식으로 완료한다.",
      "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 도움말"
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
      "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다. QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "EXECUTE_REQ_922B221066F1_S002"
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
          "label": "ROLLBACK_REQ_922B221066F1_S002"
        }
      ],
      "nextAction": {
        "completionRule": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
        "label": "다음 업무 진행",
        "routePath": "/generated/ccus-platform/req_922b221066f1/s002"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "STEP_1_COMPLETED 상태이며 COMPANY_MANAGER 액터가 프로젝트에 배정되어 있다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무 요약 · 입력 및 검증 · 처리 결과 · 증적 및 이력 · 다음 업무",
          "label": "업무 정보 작성",
          "path": "/generated/ccus-platform/req_922b221066f1/s002"
        },
        {
          "code": "COMPLETE",
          "description": "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무를 추적 가능한 방식으로 완료한다.",
      "title": "자료 담당자는 활동자료와 증빙 파일을 제출한다. 업무 길잡이"
    }
  },
  "templateCode": "KRDS_CONTENT",
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
