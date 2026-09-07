import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_3eb21e47be046c4ba7b1 = {
  "actorCode": "VERIFIER",
  "audience": "ADMIN",
  "blueprintCode": "BP_AUTO_3EB21E47BE046C4BA7B172CA",
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
  "designHash": "1d71c99fef7164f09d9ca198f2c72d2e99bc1f23777d663ed2d7c922d33ca001",
  "id": "auto-3eb21e47be046c4ba7b1",
  "pageId": "AUTO_3EB21E47BE046C4BA7B1",
  "pageName": "양측 인계확인·차이 조정 관리",
  "processCode": "CHAIN_OF_CUSTODY",
  "routePath": "/admin/planned/emission/chain-of-custody/chain-of-custody-s3",
  "screenCoordinate": {
    "actor": "VERIFIER",
    "device": "ADAPTIVE",
    "domain": "CHAIN",
    "locale": "MULTI",
    "policy": "VERIFIER:DEFAULT",
    "process": "CHAIN_OF_CUSTODY",
    "state": "STEP_2_COMPLETED",
    "step": "CHAIN_OF_CUSTODY_S3",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "CHAIN::CHAIN_OF_CUSTODY::CHAIN_OF_CUSTODY_S3::STEP_2_COMPLETED::VERIFIER::VERIFIER%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
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
        "code": "CHAIN_OF_CUSTODY_EXECUTE_3",
        "idempotencyRequired": true,
        "transactional": true
      },
      {
        "code": "SAVE_DRAFT",
        "transactional": true
      },
      {
        "auditRequired": true,
        "code": "ATTACH_EVIDENCE"
      },
      {
        "code": "CHAIN_OF_CUSTODY_ROLLBACK_3",
        "recovery": true
      }
    ],
    "actorResponsibilities": [
      "VERIFIER 액터가 권한·업무분리 정책에 따라 양측 인계확인·차이 조정 관리 업무를 수행한다."
    ],
    "apiContracts": [
      {
        "method": "GET",
        "path": "/home/api/process-executions"
      },
      {
        "method": "GET",
        "path": "/home/api/process-executions/screen-contract"
      },
      {
        "method": "POST",
        "path": "/home/api/process-executions/{executionId}/commands"
      },
      {
        "method": "GET",
        "path": "/home/api/process-executions/draft"
      },
      {
        "method": "PUT",
        "path": "/home/api/process-executions/draft"
      }
    ],
    "businessPurpose": "양측 인계확인·차이 조정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
    "completionRule": "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
    "dataContracts": [
      {
        "entity": "PROCESS_EXECUTION",
        "keys": [
          "tenantId",
          "projectId",
          "processCode"
        ],
        "tenantScoped": true,
        "versioned": true
      },
      {
        "entity": "emission_project_registry",
        "keys": [
          "tenantId",
          "projectId"
        ],
        "versioned": true
      },
      {
        "appendOnly": true,
        "entity": "AUDIT_EVENT"
      }
    ],
    "designSystem": "KRDS_GOV",
    "entryConditions": [
      "STEP_2_COMPLETED 상태이고 입력 계약과 액터 권한 검증을 통과해야 한다."
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
      "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다."
    ],
    "extensions": {
      "contractId": 37613,
      "sharedRuntime": true
    },
    "fields": [
      {
        "apiProperty": "tenantId",
        "code": "tenantId",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "name": "테넌트",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
        "validation": {
          "minLength": 1
        }
      },
      {
        "apiProperty": "projectId",
        "code": "projectId",
        "controlType": "PROJECT_SELECT",
        "dataType": "STRING",
        "editable": true,
        "name": "프로젝트",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
        "validation": {
          "minLength": 1
        }
      },
      {
        "apiProperty": "processCode",
        "code": "processCode",
        "controlType": "HIDDEN",
        "dataType": "CODE",
        "editable": false,
        "name": "프로세스 코드",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
        "validation": {
          "immutable": true,
          "required": true,
          "source": "SERVER_CONTEXT"
        }
      },
      {
        "apiProperty": "stepCode",
        "code": "stepCode",
        "controlType": "HIDDEN",
        "dataType": "CODE",
        "editable": false,
        "name": "단계 코드",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
        "validation": {
          "immutable": true,
          "required": true,
          "source": "SERVER_CONTEXT"
        }
      },
      {
        "apiProperty": "recordId",
        "code": "recordId",
        "controlType": "HIDDEN",
        "dataType": "UUID",
        "editable": false,
        "name": "업무 레코드 ID",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
        "validation": {
          "immutable": true,
          "required": false,
          "source": "SERVER_CONTEXT"
        }
      },
      {
        "apiProperty": "statusCode",
        "code": "statusCode",
        "controlType": "STATUS_BADGE",
        "dataType": "CODE",
        "editable": false,
        "name": "처리 상태",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
        "validation": {
          "codeGroup": "WORK_STATUS"
        }
      },
      {
        "apiProperty": "ownerActorCode",
        "code": "ownerActorCode",
        "controlType": "ACTOR_SELECT",
        "dataType": "CODE",
        "editable": true,
        "name": "담당 액터",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
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
        "apiProperty": "rowVersion",
        "code": "rowVersion",
        "controlType": "HIDDEN",
        "dataType": "INTEGER",
        "editable": false,
        "name": "데이터 버전",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "createdAt",
        "code": "createdAt",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": false,
        "name": "등록 일시",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "updatedAt",
        "code": "updatedAt",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": false,
        "name": "최종 수정 일시",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "evidenceCount",
        "code": "evidenceCount",
        "controlType": "EVIDENCE_LINK",
        "dataType": "INTEGER",
        "editable": false,
        "name": "증빙 수",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "reportingYear",
        "code": "reportingYear",
        "controlType": "YEAR",
        "dataType": "YEAR",
        "editable": true,
        "name": "보고연도",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
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
        "apiProperty": "organizationId",
        "code": "organizationId",
        "controlType": "ORGANIZATION_SELECT",
        "dataType": "STRING",
        "editable": true,
        "name": "조직",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
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
        "apiProperty": "siteId",
        "code": "siteId",
        "controlType": "SITE_SELECT",
        "dataType": "STRING",
        "editable": true,
        "name": "사업장",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
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
        "apiProperty": "facilityId",
        "code": "facilityId",
        "controlType": "FACILITY_SELECT",
        "dataType": "STRING",
        "editable": true,
        "name": "배출시설",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
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
        "apiProperty": "scopeCode",
        "code": "scopeCode",
        "controlType": "SCOPE_SELECT",
        "dataType": "CODE",
        "editable": true,
        "name": "Scope",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
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
        "apiProperty": "activityValue",
        "code": "activityValue",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "name": "활동량",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
        "validation": {
          "finite": true,
          "nullable": true,
          "required": false,
          "type": "number"
        }
      },
      {
        "apiProperty": "unitCode",
        "code": "unitCode",
        "controlType": "UNIT_SELECT",
        "dataType": "CODE",
        "editable": true,
        "name": "단위",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
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
        "apiProperty": "factorId",
        "code": "factorId",
        "controlType": "FACTOR_SEARCH",
        "dataType": "STRING",
        "editable": true,
        "name": "배출계수",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
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
        "apiProperty": "emissionValue",
        "code": "emissionValue",
        "controlType": "CALCULATED_NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "name": "배출량",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
        "validation": {
          "finite": true,
          "nullable": true,
          "required": false,
          "type": "number"
        }
      },
      {
        "apiProperty": "qualityStatus",
        "code": "qualityStatus",
        "controlType": "QUALITY_BADGE",
        "dataType": "CODE",
        "editable": true,
        "name": "데이터 품질",
        "permissionCode": "VERIFIER:ADMIN",
        "required": true,
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
        "apiProperty": "taskComment",
        "code": "taskComment",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "name": "업무 메모",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
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
        "apiProperty": "dueAt",
        "code": "dueAt",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "name": "마감 일시",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "nextActorCode",
        "code": "nextActorCode",
        "controlType": "ACTOR_VIEW",
        "dataType": "CODE",
        "editable": true,
        "name": "다음 담당 액터",
        "permissionCode": "VERIFIER:ADMIN",
        "required": false,
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
        "code": "COMPLETION_RATE",
        "unit": "PERCENT"
      },
      {
        "code": "BLOCKING_ERROR",
        "unit": "COUNT"
      },
      {
        "code": "SLA_REMAINING",
        "unit": "MINUTE"
      }
    ],
    "permissions": [
      {
        "code": "VERIFIER",
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
        "code": "TASK_CONTEXT"
      },
      {
        "code": "SEARCH_FILTER"
      },
      {
        "code": "WORKSPACE"
      },
      {
        "code": "EVIDENCE_HISTORY"
      },
      {
        "code": "NEXT_TASK"
      }
    ],
    "states": [
      "STEP_2_COMPLETED",
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_3_COMPLETED"
    ],
    "support": {
      "assetBindings": [
        {
          "assetCode": "TASK_CONTEXT",
          "assetType": "SECTION",
          "slot": "TASK_CONTEXT"
        },
        {
          "assetCode": "SEARCH_FILTER",
          "assetType": "SECTION",
          "slot": "SEARCH_FILTER"
        },
        {
          "assetCode": "WORKSPACE",
          "assetType": "SECTION",
          "slot": "WORKSPACE"
        },
        {
          "assetCode": "EVIDENCE_HISTORY",
          "assetType": "SECTION",
          "slot": "EVIDENCE_HISTORY"
        },
        {
          "assetCode": "NEXT_TASK",
          "assetType": "SECTION",
          "slot": "NEXT_TASK"
        }
      ],
      "designCard": {
        "actionCount": 4,
        "designSystem": "KRDS_GOV",
        "fieldCount": 24,
        "pageName": "양측 인계확인·차이 조정 관리",
        "screenType": "ADMIN",
        "sectionCount": 5,
        "summary": "양측 인계확인·차이 조정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
        "templateCode": "KRDS_ADMIN",
        "title": "양측 인계확인·차이 조정 관리"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-task-context\"]",
            "body": "TASK_CONTEXT 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "TASK_CONTEXT",
            "highlightStyle": "neutral",
            "id": "TASK_CONTEXT",
            "label": "TASK_CONTEXT",
            "placement": "top",
            "title": "TASK_CONTEXT"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-search-filter\"]",
            "body": "SEARCH_FILTER 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SEARCH_FILTER",
            "highlightStyle": "neutral",
            "id": "SEARCH_FILTER",
            "label": "SEARCH_FILTER",
            "placement": "top",
            "title": "SEARCH_FILTER"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-workspace\"]",
            "body": "WORKSPACE 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "WORKSPACE",
            "highlightStyle": "neutral",
            "id": "WORKSPACE",
            "label": "WORKSPACE",
            "placement": "top",
            "title": "WORKSPACE"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-evidence-history\"]",
            "body": "EVIDENCE_HISTORY 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "EVIDENCE_HISTORY",
            "highlightStyle": "neutral",
            "id": "EVIDENCE_HISTORY",
            "label": "EVIDENCE_HISTORY",
            "placement": "top",
            "title": "EVIDENCE_HISTORY"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-next-task\"]",
            "body": "NEXT_TASK 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "NEXT_TASK",
            "highlightStyle": "neutral",
            "id": "NEXT_TASK",
            "label": "NEXT_TASK",
            "placement": "top",
            "title": "NEXT_TASK"
          }
        ],
        "pageId": "AUTO_3EB21E47BE046C4BA7B1",
        "summary": "양측 인계확인·차이 조정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
        "title": "양측 인계확인·차이 조정 관리 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다."
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
        "title": "양측 인계확인·차이 조정 관리 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "CHAIN_OF_CUSTODY_EXECUTE_3",
            "idempotencyRequired": true,
            "label": "CHAIN_OF_CUSTODY_EXECUTE_3",
            "transactional": true
          },
          {
            "code": "SAVE_DRAFT",
            "label": "SAVE_DRAFT",
            "transactional": true
          },
          {
            "auditRequired": true,
            "code": "ATTACH_EVIDENCE",
            "label": "ATTACH_EVIDENCE"
          },
          {
            "code": "CHAIN_OF_CUSTODY_ROLLBACK_3",
            "label": "CHAIN_OF_CUSTODY_ROLLBACK_3",
            "recovery": true
          }
        ],
        "nextAction": {
          "completionRule": "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
          "label": "다음 업무 진행",
          "routePath": "/admin/planned/emission/chain-of-custody/chain-of-custody-s3"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "STEP_2_COMPLETED 상태이고 입력 계약과 액터 권한 검증을 통과해야 한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "TASK_CONTEXT · SEARCH_FILTER · WORKSPACE · EVIDENCE_HISTORY · NEXT_TASK",
            "label": "업무 정보 작성",
            "path": "/admin/planned/emission/chain-of-custody/chain-of-custody-s3"
          },
          {
            "code": "COMPLETE",
            "description": "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "양측 인계확인·차이 조정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
        "title": "양측 인계확인·차이 조정 관리 업무 길잡이"
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
  "stepCode": "CHAIN_OF_CUSTODY_S3",
  "support": {
    "assetBindings": [
      {
        "assetCode": "TASK_CONTEXT",
        "assetType": "SECTION",
        "slot": "TASK_CONTEXT"
      },
      {
        "assetCode": "SEARCH_FILTER",
        "assetType": "SECTION",
        "slot": "SEARCH_FILTER"
      },
      {
        "assetCode": "WORKSPACE",
        "assetType": "SECTION",
        "slot": "WORKSPACE"
      },
      {
        "assetCode": "EVIDENCE_HISTORY",
        "assetType": "SECTION",
        "slot": "EVIDENCE_HISTORY"
      },
      {
        "assetCode": "NEXT_TASK",
        "assetType": "SECTION",
        "slot": "NEXT_TASK"
      }
    ],
    "designCard": {
      "actionCount": 4,
      "designSystem": "KRDS_GOV",
      "fieldCount": 24,
      "pageName": "양측 인계확인·차이 조정 관리",
      "screenType": "ADMIN",
      "sectionCount": 5,
      "summary": "양측 인계확인·차이 조정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
      "templateCode": "KRDS_ADMIN",
      "title": "양측 인계확인·차이 조정 관리"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-task-context\"]",
          "body": "TASK_CONTEXT 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "TASK_CONTEXT",
          "highlightStyle": "neutral",
          "id": "TASK_CONTEXT",
          "label": "TASK_CONTEXT",
          "placement": "top",
          "title": "TASK_CONTEXT"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-search-filter\"]",
          "body": "SEARCH_FILTER 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SEARCH_FILTER",
          "highlightStyle": "neutral",
          "id": "SEARCH_FILTER",
          "label": "SEARCH_FILTER",
          "placement": "top",
          "title": "SEARCH_FILTER"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-workspace\"]",
          "body": "WORKSPACE 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "WORKSPACE",
          "highlightStyle": "neutral",
          "id": "WORKSPACE",
          "label": "WORKSPACE",
          "placement": "top",
          "title": "WORKSPACE"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-evidence-history\"]",
          "body": "EVIDENCE_HISTORY 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "EVIDENCE_HISTORY",
          "highlightStyle": "neutral",
          "id": "EVIDENCE_HISTORY",
          "label": "EVIDENCE_HISTORY",
          "placement": "top",
          "title": "EVIDENCE_HISTORY"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-3eb21e47be046c4ba7b1-next-task\"]",
          "body": "NEXT_TASK 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "NEXT_TASK",
          "highlightStyle": "neutral",
          "id": "NEXT_TASK",
          "label": "NEXT_TASK",
          "placement": "top",
          "title": "NEXT_TASK"
        }
      ],
      "pageId": "AUTO_3EB21E47BE046C4BA7B1",
      "summary": "양측 인계확인·차이 조정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
      "title": "양측 인계확인·차이 조정 관리 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다."
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
      "title": "양측 인계확인·차이 조정 관리 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "CHAIN_OF_CUSTODY_EXECUTE_3",
          "idempotencyRequired": true,
          "label": "CHAIN_OF_CUSTODY_EXECUTE_3",
          "transactional": true
        },
        {
          "code": "SAVE_DRAFT",
          "label": "SAVE_DRAFT",
          "transactional": true
        },
        {
          "auditRequired": true,
          "code": "ATTACH_EVIDENCE",
          "label": "ATTACH_EVIDENCE"
        },
        {
          "code": "CHAIN_OF_CUSTODY_ROLLBACK_3",
          "label": "CHAIN_OF_CUSTODY_ROLLBACK_3",
          "recovery": true
        }
      ],
      "nextAction": {
        "completionRule": "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
        "label": "다음 업무 진행",
        "routePath": "/admin/planned/emission/chain-of-custody/chain-of-custody-s3"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "STEP_2_COMPLETED 상태이고 입력 계약과 액터 권한 검증을 통과해야 한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "TASK_CONTEXT · SEARCH_FILTER · WORKSPACE · EVIDENCE_HISTORY · NEXT_TASK",
          "label": "업무 정보 작성",
          "path": "/admin/planned/emission/chain-of-custody/chain-of-custody-s3"
        },
        {
          "code": "COMPLETE",
          "description": "양측 인계확인·차이 조정의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "양측 인계확인·차이 조정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
      "title": "양측 인계확인·차이 조정 관리 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
  "traceability": {
    "contractId": 37613,
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
      "CHAIN_OF_CUSTODY:CHAIN_OF_CUSTODY_S3:ADMIN"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
