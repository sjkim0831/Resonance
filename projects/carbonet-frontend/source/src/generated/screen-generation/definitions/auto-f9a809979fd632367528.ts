import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_f9a809979fd632367528 = {
  "actorCode": "CONTENT_MANAGER",
  "audience": "USER",
  "blueprintCode": "BP_AUTO_F9A809979FD632367528DF41",
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
  "designHash": "9855ddabe59c64d6c596a1a70bac0501311165732d07d457aead594fb4af89a7",
  "id": "auto-f9a809979fd632367528",
  "pageId": "AUTO_F9A809979FD632367528",
  "pageName": "공지사항 게시 - 요청·범위·필수정보 확인",
  "processCode": "NOTICE_PUBLICATION",
  "routePath": "/planned/education/notice-publication/notice-publication-s1",
  "screenCoordinate": {
    "actor": "CONTENT_MANAGER",
    "device": "ADAPTIVE",
    "domain": "NOTICE",
    "locale": "MULTI",
    "policy": "CONTENT_MANAGER:DEFAULT",
    "process": "NOTICE_PUBLICATION",
    "state": "READY",
    "step": "NOTICE_PUBLICATION_S1",
    "variant": "KRDS_DETAIL",
    "view": "DETAIL"
  },
  "screenCoordinateKey": "NOTICE::NOTICE_PUBLICATION::NOTICE_PUBLICATION_S1::READY::CONTENT_MANAGER::CONTENT_MANAGER%3ADEFAULT::DETAIL::ADAPTIVE::MULTI::KRDS_DETAIL",
  "screenType": "DETAIL",
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
        "code": "NOTICE_PUBLICATION_REQUEST",
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
        "code": "NOTICE_PUBLICATION_ROLLBACK_1",
        "recovery": true
      }
    ],
    "actorResponsibilities": [
      "CONTENT_MANAGER 액터가 권한·업무분리 정책에 따라 공지사항 게시 - 요청·범위·필수정보 확인 업무를 수행한다."
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
    "businessPurpose": "공지사항 게시의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.",
    "completionRule": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
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
        "entity": "education_enrollment",
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
      "READY 상태이고 입력 계약과 액터 권한 검증을 통과해야 한다."
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
      "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다."
    ],
    "extensions": {
      "contractId": 37438,
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
        "required": false,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "courseId",
        "code": "courseId",
        "controlType": "COURSE_SELECT",
        "dataType": "STRING",
        "editable": true,
        "name": "교육 과정",
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "apiProperty": "scheduleId",
        "code": "scheduleId",
        "controlType": "SCHEDULE_SELECT",
        "dataType": "STRING",
        "editable": true,
        "name": "교육 일정",
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "apiProperty": "learnerId",
        "code": "learnerId",
        "controlType": "USER_SELECT",
        "dataType": "STRING",
        "editable": true,
        "name": "학습자",
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "apiProperty": "enrollmentStatus",
        "code": "enrollmentStatus",
        "controlType": "STATUS_BADGE",
        "dataType": "CODE",
        "editable": true,
        "name": "신청 상태",
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "apiProperty": "progressRate",
        "code": "progressRate",
        "controlType": "PERCENT",
        "dataType": "DECIMAL",
        "editable": true,
        "name": "진도율",
        "permissionCode": "CONTENT_MANAGER:USER",
        "required": false,
        "validation": {
          "finite": true,
          "nullable": true,
          "required": false,
          "type": "number"
        }
      },
      {
        "apiProperty": "attendanceStatus",
        "code": "attendanceStatus",
        "controlType": "STATUS_BADGE",
        "dataType": "CODE",
        "editable": true,
        "name": "출석 상태",
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "apiProperty": "evaluationScore",
        "code": "evaluationScore",
        "controlType": "SCORE",
        "dataType": "DECIMAL",
        "editable": true,
        "name": "평가 점수",
        "permissionCode": "CONTENT_MANAGER:USER",
        "required": false,
        "validation": {
          "finite": true,
          "nullable": true,
          "required": false,
          "type": "number"
        }
      },
      {
        "apiProperty": "taskComment",
        "code": "taskComment",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "name": "업무 메모",
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "permissionCode": "CONTENT_MANAGER:USER",
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
        "code": "CONTENT_MANAGER",
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
      "READY",
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_1_COMPLETED"
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
        "fieldCount": 21,
        "pageName": "공지사항 게시 - 요청·범위·필수정보 확인",
        "screenType": "DETAIL",
        "sectionCount": 5,
        "summary": "공지사항 게시의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.",
        "templateCode": "KRDS_DETAIL",
        "title": "공지사항 게시 - 요청·범위·필수정보 확인"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-task-context\"]",
            "body": "TASK_CONTEXT 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "TASK_CONTEXT",
            "highlightStyle": "neutral",
            "id": "TASK_CONTEXT",
            "label": "TASK_CONTEXT",
            "placement": "top",
            "title": "TASK_CONTEXT"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-search-filter\"]",
            "body": "SEARCH_FILTER 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SEARCH_FILTER",
            "highlightStyle": "neutral",
            "id": "SEARCH_FILTER",
            "label": "SEARCH_FILTER",
            "placement": "top",
            "title": "SEARCH_FILTER"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-workspace\"]",
            "body": "WORKSPACE 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "WORKSPACE",
            "highlightStyle": "neutral",
            "id": "WORKSPACE",
            "label": "WORKSPACE",
            "placement": "top",
            "title": "WORKSPACE"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-evidence-history\"]",
            "body": "EVIDENCE_HISTORY 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "EVIDENCE_HISTORY",
            "highlightStyle": "neutral",
            "id": "EVIDENCE_HISTORY",
            "label": "EVIDENCE_HISTORY",
            "placement": "top",
            "title": "EVIDENCE_HISTORY"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-next-task\"]",
            "body": "NEXT_TASK 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "NEXT_TASK",
            "highlightStyle": "neutral",
            "id": "NEXT_TASK",
            "label": "NEXT_TASK",
            "placement": "top",
            "title": "NEXT_TASK"
          }
        ],
        "pageId": "AUTO_F9A809979FD632367528",
        "summary": "공지사항 게시의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.",
        "title": "공지사항 게시 - 요청·범위·필수정보 확인 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다."
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
        "title": "공지사항 게시 - 요청·범위·필수정보 확인 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "NOTICE_PUBLICATION_REQUEST",
            "idempotencyRequired": true,
            "label": "NOTICE_PUBLICATION_REQUEST",
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
            "code": "NOTICE_PUBLICATION_ROLLBACK_1",
            "label": "NOTICE_PUBLICATION_ROLLBACK_1",
            "recovery": true
          }
        ],
        "nextAction": {
          "completionRule": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
          "label": "다음 업무 진행",
          "routePath": "/planned/education/notice-publication/notice-publication-s1"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "READY 상태이고 입력 계약과 액터 권한 검증을 통과해야 한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "TASK_CONTEXT · SEARCH_FILTER · WORKSPACE · EVIDENCE_HISTORY · NEXT_TASK",
            "label": "업무 정보 작성",
            "path": "/planned/education/notice-publication/notice-publication-s1"
          },
          {
            "code": "COMPLETE",
            "description": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "공지사항 게시의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.",
        "title": "공지사항 게시 - 요청·범위·필수정보 확인 업무 길잡이"
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
  "stepCode": "NOTICE_PUBLICATION_S1",
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
      "fieldCount": 21,
      "pageName": "공지사항 게시 - 요청·범위·필수정보 확인",
      "screenType": "DETAIL",
      "sectionCount": 5,
      "summary": "공지사항 게시의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.",
      "templateCode": "KRDS_DETAIL",
      "title": "공지사항 게시 - 요청·범위·필수정보 확인"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-task-context\"]",
          "body": "TASK_CONTEXT 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "TASK_CONTEXT",
          "highlightStyle": "neutral",
          "id": "TASK_CONTEXT",
          "label": "TASK_CONTEXT",
          "placement": "top",
          "title": "TASK_CONTEXT"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-search-filter\"]",
          "body": "SEARCH_FILTER 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SEARCH_FILTER",
          "highlightStyle": "neutral",
          "id": "SEARCH_FILTER",
          "label": "SEARCH_FILTER",
          "placement": "top",
          "title": "SEARCH_FILTER"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-workspace\"]",
          "body": "WORKSPACE 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "WORKSPACE",
          "highlightStyle": "neutral",
          "id": "WORKSPACE",
          "label": "WORKSPACE",
          "placement": "top",
          "title": "WORKSPACE"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-evidence-history\"]",
          "body": "EVIDENCE_HISTORY 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "EVIDENCE_HISTORY",
          "highlightStyle": "neutral",
          "id": "EVIDENCE_HISTORY",
          "label": "EVIDENCE_HISTORY",
          "placement": "top",
          "title": "EVIDENCE_HISTORY"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-f9a809979fd632367528-next-task\"]",
          "body": "NEXT_TASK 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "NEXT_TASK",
          "highlightStyle": "neutral",
          "id": "NEXT_TASK",
          "label": "NEXT_TASK",
          "placement": "top",
          "title": "NEXT_TASK"
        }
      ],
      "pageId": "AUTO_F9A809979FD632367528",
      "summary": "공지사항 게시의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.",
      "title": "공지사항 게시 - 요청·범위·필수정보 확인 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다."
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
      "title": "공지사항 게시 - 요청·범위·필수정보 확인 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "NOTICE_PUBLICATION_REQUEST",
          "idempotencyRequired": true,
          "label": "NOTICE_PUBLICATION_REQUEST",
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
          "code": "NOTICE_PUBLICATION_ROLLBACK_1",
          "label": "NOTICE_PUBLICATION_ROLLBACK_1",
          "recovery": true
        }
      ],
      "nextAction": {
        "completionRule": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "label": "다음 업무 진행",
        "routePath": "/planned/education/notice-publication/notice-publication-s1"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "READY 상태이고 입력 계약과 액터 권한 검증을 통과해야 한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "TASK_CONTEXT · SEARCH_FILTER · WORKSPACE · EVIDENCE_HISTORY · NEXT_TASK",
          "label": "업무 정보 작성",
          "path": "/planned/education/notice-publication/notice-publication-s1"
        },
        {
          "code": "COMPLETE",
          "description": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "공지사항 게시의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.",
      "title": "공지사항 게시 - 요청·범위·필수정보 확인 업무 길잡이"
    }
  },
  "templateCode": "KRDS_DETAIL",
  "traceability": {
    "contractId": 37438,
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
      "NOTICE_PUBLICATION:NOTICE_PUBLICATION_S1:USER"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
