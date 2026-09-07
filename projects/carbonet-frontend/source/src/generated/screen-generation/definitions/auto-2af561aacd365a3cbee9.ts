import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_2af561aacd365a3cbee9 = {
  "actorCode": "PLATFORM_OPERATOR",
  "audience": "ADMIN",
  "blueprintCode": "BP_AUTO_2AF561AACD365A3CBEE9CF5B",
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
  "designHash": "75768221f3d673c8076a919bfc12a3e7031c8cd825cc55f01f646625b3bf9fe8",
  "id": "auto-2af561aacd365a3cbee9",
  "pageId": "AUTO_2AF561AACD365A3CBEE9",
  "pageName": "적용·캐시 무효화·운영 확인 지원 화면",
  "processCode": "GOVERNANCE_CHANGE",
  "routePath": "/admin/system/build-studio",
  "screenCoordinate": {
    "actor": "PLATFORM_OPERATOR",
    "device": "ADAPTIVE",
    "domain": "GOVERNANCE",
    "locale": "MULTI",
    "policy": "PLATFORM_OPERATOR:DEFAULT",
    "process": "GOVERNANCE_CHANGE",
    "state": "LOADING",
    "step": "GOV_PUBLISH",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "GOVERNANCE::GOVERNANCE_CHANGE::GOV_PUBLISH::LOADING::PLATFORM_OPERATOR::PLATFORM_OPERATOR%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
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
        "label": "PUBLISH_CHANGE"
      },
      {
        "code": "ACTION_2",
        "label": "SAVE_DRAFT"
      },
      {
        "code": "ACTION_3",
        "label": "VALIDATE"
      },
      {
        "code": "ACTION_4",
        "label": "ATTACH_EVIDENCE"
      },
      {
        "code": "ACTION_5",
        "label": "OPEN_NEXT_TASK"
      }
    ],
    "actorResponsibilities": [
      "PLATFORM_OPERATOR 액터가 권한·업무분리 정책에 따라 적용·캐시 무효화·운영 확인 지원 화면 업무를 수행한다."
    ],
    "apiContracts": [
      {
        "method": "GET",
        "path": "/admin/api/system/actor-process"
      },
      {
        "method": "GET",
        "path": "/admin/api/system/actor-process/cases"
      }
    ],
    "businessPurpose": "운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.",
    "completionRule": "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다.",
    "dataContracts": [
      {
        "relation": "framework_process_step"
      },
      {
        "relation": "framework_step_execution_spec"
      },
      {
        "relation": "framework_process_execution"
      },
      {
        "relation": "framework_process_execution_event"
      }
    ],
    "designSystem": "KRDS_GOV",
    "entryConditions": [
      "로그인 계정이 대상 프로젝트와 단계 수행 액터에 배정되고 이전 단계 완료 조건을 충족해야 진입한다."
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
      "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다."
    ],
    "extensions": {
      "contractId": 25170,
      "sharedRuntime": true
    },
    "fields": [
      {
        "apiProperty": "processes[].processCode",
        "audience": "ADMIN",
        "controlType": "SELECT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processCode",
        "fieldGroup": "PROCESS",
        "fieldName": "프로세스 코드",
        "fieldOrder": 1,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "process_code",
        "sourceTable": "framework_process_definition",
        "validation": {
          "allowUnknown": false,
          "nullable": false,
          "required": true,
          "type": "code"
        }
      },
      {
        "apiProperty": "processes[].processName",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processName",
        "fieldGroup": "PROCESS",
        "fieldName": "프로세스명",
        "fieldOrder": 2,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "process_name",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].domainCode",
        "audience": "ADMIN",
        "controlType": "BADGE",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "domainCode",
        "fieldGroup": "PROCESS",
        "fieldName": "업무 종류",
        "fieldOrder": 3,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "domain_code",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].version",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "processVersion",
        "fieldGroup": "PROCESS",
        "fieldName": "프로세스 버전",
        "fieldOrder": 4,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "process_version",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].goal",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processGoal",
        "fieldGroup": "PROCESS",
        "fieldName": "업무 목표",
        "fieldOrder": 5,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "goal",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].startCondition",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "startCondition",
        "fieldGroup": "PROCESS",
        "fieldName": "시작 조건",
        "fieldOrder": 6,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "start_condition",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].completionCondition",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "completionCondition",
        "fieldGroup": "PROCESS",
        "fieldName": "완료 조건",
        "fieldOrder": 7,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "completion_condition",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].ownerActorCode",
        "audience": "ADMIN",
        "controlType": "BADGE",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "ownerActorCode",
        "fieldGroup": "PROCESS",
        "fieldName": "책임 액터",
        "fieldOrder": 8,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "owner_actor_code",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].riskLevel",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "riskLevel",
        "fieldGroup": "PROCESS",
        "fieldName": "위험도",
        "fieldOrder": 9,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "risk_level",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].slaHours",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "slaHours",
        "fieldGroup": "PROCESS",
        "fieldName": "업무 SLA",
        "fieldOrder": 10,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "sla_hours",
        "sourceTable": "framework_process_definition",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "processes[].reviewCycleDays",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "reviewCycleDays",
        "fieldGroup": "PROCESS",
        "fieldName": "검토 주기",
        "fieldOrder": 11,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "review_cycle_days",
        "sourceTable": "framework_process_definition",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "processes[].status",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processStatus",
        "fieldGroup": "PROCESS",
        "fieldName": "개발 상태",
        "fieldOrder": 12,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "process_status",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "processes[].lifecycleStatus",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "lifecycleStatus",
        "fieldGroup": "PROCESS",
        "fieldName": "생명주기 상태",
        "fieldOrder": 13,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "lifecycle_status",
        "sourceTable": "framework_process_definition",
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
        "apiProperty": "steps[].stepOrder",
        "audience": "ADMIN",
        "controlType": "SEQUENCE",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepOrder",
        "fieldGroup": "STEP",
        "fieldName": "단계 순서",
        "fieldOrder": 14,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "step_order",
        "sourceTable": "framework_process_step",
        "validation": {
          "minimum": 1
        }
      },
      {
        "apiProperty": "steps[].stepCode",
        "audience": "ADMIN",
        "controlType": "LINK",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepCode",
        "fieldGroup": "STEP",
        "fieldName": "단계 코드",
        "fieldOrder": 15,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "step_code",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].stepName",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepName",
        "fieldGroup": "STEP",
        "fieldName": "단계명",
        "fieldOrder": 16,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "step_name",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].actorCode",
        "audience": "ADMIN",
        "controlType": "BADGE",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepActorCode",
        "fieldGroup": "STEP",
        "fieldName": "수행 액터",
        "fieldOrder": 17,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "actor_code",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].fromState",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "fromState",
        "fieldGroup": "STEP",
        "fieldName": "진입 상태",
        "fieldOrder": 18,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "from_state",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].commandCode",
        "audience": "ADMIN",
        "controlType": "ACTION",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "commandCode",
        "fieldGroup": "STEP",
        "fieldName": "실행 명령",
        "fieldOrder": 19,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "command_code",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].toState",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "toState",
        "fieldGroup": "STEP",
        "fieldName": "완료 상태",
        "fieldOrder": 20,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "to_state",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].completionRule",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "completionRule",
        "fieldGroup": "STEP",
        "fieldName": "단계 완료 기준",
        "fieldOrder": 21,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "completion_rule",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].requirementText",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "requirementText",
        "fieldGroup": "STEP",
        "fieldName": "단계 요구사항",
        "fieldOrder": 22,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "requirement_text",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].inputContract",
        "audience": "ADMIN",
        "controlType": "JSON_VIEW",
        "dataType": "JSON",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "inputContract",
        "fieldGroup": "STEP",
        "fieldName": "입력 계약",
        "fieldOrder": 23,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "input_contract",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].outputContract",
        "audience": "ADMIN",
        "controlType": "JSON_VIEW",
        "dataType": "JSON",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "outputContract",
        "fieldGroup": "STEP",
        "fieldName": "출력 계약",
        "fieldOrder": 24,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "output_contract",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].userPath",
        "audience": "ADMIN",
        "controlType": "LINK",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "userPath",
        "fieldGroup": "STEP",
        "fieldName": "사용자 화면",
        "fieldOrder": 25,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "user_path",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].adminPath",
        "audience": "ADMIN",
        "controlType": "LINK",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "adminPath",
        "fieldGroup": "STEP",
        "fieldName": "관리자 화면",
        "fieldOrder": 26,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "admin_path",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].apiContract",
        "audience": "ADMIN",
        "controlType": "CODE_VIEW",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "apiContract",
        "fieldGroup": "STEP",
        "fieldName": "API 계약",
        "fieldOrder": 27,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "api_contract",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "steps[].automationStatus",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "automationStatus",
        "fieldGroup": "STEP",
        "fieldName": "자동화 상태",
        "fieldOrder": 28,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "automation_status",
        "sourceTable": "framework_process_step",
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
        "apiProperty": "cases[].caseCode",
        "audience": "ADMIN",
        "controlType": "LINK",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "caseCode",
        "fieldGroup": "TEST",
        "fieldName": "테스트 코드",
        "fieldOrder": 29,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "case_code",
        "sourceTable": "framework_simulation_case",
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
        "apiProperty": "cases[].caseName",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "caseName",
        "fieldGroup": "TEST",
        "fieldName": "테스트명",
        "fieldOrder": 30,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "case_name",
        "sourceTable": "framework_simulation_case",
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
        "apiProperty": "cases[].caseType",
        "audience": "ADMIN",
        "controlType": "BADGE",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "caseType",
        "fieldGroup": "TEST",
        "fieldName": "테스트 유형",
        "fieldOrder": 31,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "case_type",
        "sourceTable": "framework_simulation_case",
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
        "apiProperty": "cases[].status",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "caseStatus",
        "fieldGroup": "TEST",
        "fieldName": "테스트 상태",
        "fieldOrder": 32,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "case_status",
        "sourceTable": "framework_simulation_case",
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
        "apiProperty": "cases[].assertionsJson",
        "audience": "ADMIN",
        "controlType": "JSON_VIEW",
        "dataType": "JSON",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "caseAssertions",
        "fieldGroup": "TEST",
        "fieldName": "기대 결과",
        "fieldOrder": 33,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "assertions_json",
        "sourceTable": "framework_simulation_case",
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
        "apiProperty": "developmentJobs[].jobId",
        "audience": "ADMIN",
        "controlType": "LINK",
        "dataType": "LONG",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "jobId",
        "fieldGroup": "DEVELOPMENT",
        "fieldName": "개발 작업 ID",
        "fieldOrder": 34,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "job_id",
        "sourceTable": "framework_development_job",
        "validation": {
          "minimum": 1
        }
      },
      {
        "apiProperty": "developmentJobs[].jobType",
        "audience": "ADMIN",
        "controlType": "BADGE",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "jobType",
        "fieldGroup": "DEVELOPMENT",
        "fieldName": "개발 작업 유형",
        "fieldOrder": 35,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "job_type",
        "sourceTable": "framework_development_job",
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
        "apiProperty": "developmentJobs[].jobName",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "jobName",
        "fieldGroup": "DEVELOPMENT",
        "fieldName": "개발 작업명",
        "fieldOrder": 36,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "job_name",
        "sourceTable": "framework_development_job",
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
        "apiProperty": "developmentJobs[].targetPath",
        "audience": "ADMIN",
        "controlType": "LINK",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "targetPath",
        "fieldGroup": "DEVELOPMENT",
        "fieldName": "대상 경로",
        "fieldOrder": 37,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "target_path",
        "sourceTable": "framework_development_job",
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
        "apiProperty": "developmentJobs[].jobStatus",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "jobStatus",
        "fieldGroup": "DEVELOPMENT",
        "fieldName": "개발 진행 상태",
        "fieldOrder": 38,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "job_status",
        "sourceTable": "framework_development_job",
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
        "apiProperty": "developmentJobs[].qualityStatus",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "qualityStatus",
        "fieldGroup": "DEVELOPMENT",
        "fieldName": "품질 상태",
        "fieldOrder": 39,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "quality_status",
        "sourceTable": "framework_development_job",
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
        "apiProperty": "developmentJobs[].evidenceRef",
        "audience": "ADMIN",
        "controlType": "LINK",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": true,
        "fieldCode": "jobEvidenceRef",
        "fieldGroup": "DEVELOPMENT",
        "fieldName": "개발 증빙",
        "fieldOrder": 40,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "evidence_ref",
        "sourceTable": "framework_development_job",
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
        "apiProperty": "processDevelopmentProgress[].requiredJobs",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "requiredJobs",
        "fieldGroup": "PROGRESS",
        "fieldName": "필수 작업 수",
        "fieldOrder": 41,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "required_jobs",
        "sourceTable": "framework_process_development_progress",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "processDevelopmentProgress[].verifiedJobs",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "verifiedJobs",
        "fieldGroup": "PROGRESS",
        "fieldName": "검증 완료 작업 수",
        "fieldOrder": 42,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "verified_jobs",
        "sourceTable": "framework_process_development_progress",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "processDevelopmentProgress[].failedJobs",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "failedJobs",
        "fieldGroup": "PROGRESS",
        "fieldName": "실패 작업 수",
        "fieldOrder": 43,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "failed_jobs",
        "sourceTable": "framework_process_development_progress",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "processDevelopmentProgress[].completionPercent",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "DECIMAL",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "completionPercent",
        "fieldGroup": "PROGRESS",
        "fieldName": "개발 완료율",
        "fieldOrder": 44,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "completion_percent",
        "sourceTable": "framework_process_development_progress",
        "validation": {
          "maximum": 100,
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].assuranceStatus",
        "audience": "ADMIN",
        "controlType": "STATUS",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "assuranceStatus",
        "fieldGroup": "ASSURANCE",
        "fieldName": "설계 보증 상태",
        "fieldOrder": 45,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "assurance_status",
        "sourceTable": "framework_process_design_assurance_matrix",
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
        "apiProperty": "designAssurance[].designAccuracyScore",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "DECIMAL",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "designAccuracyScore",
        "fieldGroup": "ASSURANCE",
        "fieldName": "설계 정확도",
        "fieldOrder": 46,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "design_accuracy_score",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "maximum": 100,
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].designBlockerCount",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "designBlockerCount",
        "fieldGroup": "ASSURANCE",
        "fieldName": "설계 차단 수",
        "fieldOrder": 47,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "design_blocker_count",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].actorContractGaps",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "actorContractGaps",
        "fieldGroup": "ASSURANCE",
        "fieldName": "액터 계약 누락",
        "fieldOrder": 48,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "missing_actor_binding_count",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].stateFlowGaps",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stateFlowGaps",
        "fieldGroup": "ASSURANCE",
        "fieldName": "상태 전이 누락",
        "fieldOrder": 49,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "incomplete_transition_count",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].dataContractGaps",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "dataContractGaps",
        "fieldGroup": "ASSURANCE",
        "fieldName": "데이터 계약 누락",
        "fieldOrder": 50,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "incomplete_data_contract_count",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].routeGaps",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "routeGaps",
        "fieldGroup": "ASSURANCE",
        "fieldName": "화면 경로 누락",
        "fieldOrder": 51,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "missing_user_route_count",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].apiContractGaps",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "apiContractGaps",
        "fieldGroup": "ASSURANCE",
        "fieldName": "API 계약 누락",
        "fieldOrder": 52,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "missing_api_contract_count",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].approvedSafetyTestTypeCount",
        "audience": "ADMIN",
        "controlType": "METRIC",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "approvedSafetyTestTypeCount",
        "fieldGroup": "ASSURANCE",
        "fieldName": "안전 테스트 유형 수",
        "fieldOrder": 53,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "approved_safety_test_type_count",
        "sourceTable": "framework_process_design_assurance_matrix",
        "validation": {
          "minimum": 0
        }
      },
      {
        "apiProperty": "designAssurance[].nextAction",
        "audience": "ADMIN",
        "controlType": "TEXT",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "nextAction",
        "fieldGroup": "ASSURANCE",
        "fieldName": "다음 보완 작업",
        "fieldOrder": 54,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "GOV_PUBLISH_WORKSPACE_ADMIN",
        "permissionCode": "PERM_PROCESS_ORCHESTRATION_READ",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH",
        "sourceColumn": "next_action",
        "sourceTable": "framework_process_design_assurance_matrix",
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
        "label": "단계 완료율"
      },
      {
        "code": "KPI_2",
        "label": "차단 오류 수"
      },
      {
        "code": "KPI_3",
        "label": "승인 대기 시간"
      },
      {
        "code": "KPI_4",
        "label": "검증 증적 완전성"
      }
    ],
    "permissions": [
      {
        "code": "PLATFORM_OPERATOR",
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
        "label": "업무 요약"
      },
      {
        "code": "SECTION_2",
        "label": "진행 상태"
      },
      {
        "code": "SECTION_3",
        "label": "전문 입력 계약"
      },
      {
        "code": "SECTION_4",
        "label": "검증 결과"
      },
      {
        "code": "SECTION_5",
        "label": "증적·이력"
      },
      {
        "code": "SECTION_6",
        "label": "다음 업무"
      }
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "ERROR",
      "FORBIDDEN",
      "READY",
      "SAVING",
      "CONFLICT",
      "STALE_VERSION"
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
        "actionCount": 5,
        "designSystem": "KRDS_GOV",
        "fieldCount": 54,
        "pageName": "적용·캐시 무효화·운영 확인 지원 화면",
        "screenType": "ADMIN",
        "sectionCount": 6,
        "summary": "운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.",
        "templateCode": "KRDS_ADMIN",
        "title": "적용·캐시 무효화·운영 확인 지원 화면"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-1\"]",
            "body": "업무 요약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_1",
            "highlightStyle": "neutral",
            "id": "SECTION_1",
            "label": "업무 요약",
            "placement": "top",
            "title": "업무 요약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-2\"]",
            "body": "진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_2",
            "highlightStyle": "neutral",
            "id": "SECTION_2",
            "label": "진행 상태",
            "placement": "top",
            "title": "진행 상태"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-3\"]",
            "body": "전문 입력 계약 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_3",
            "highlightStyle": "neutral",
            "id": "SECTION_3",
            "label": "전문 입력 계약",
            "placement": "top",
            "title": "전문 입력 계약"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-4\"]",
            "body": "검증 결과 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_4",
            "highlightStyle": "neutral",
            "id": "SECTION_4",
            "label": "검증 결과",
            "placement": "top",
            "title": "검증 결과"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-5\"]",
            "body": "증적·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_5",
            "highlightStyle": "neutral",
            "id": "SECTION_5",
            "label": "증적·이력",
            "placement": "top",
            "title": "증적·이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-6\"]",
            "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SECTION_6",
            "highlightStyle": "neutral",
            "id": "SECTION_6",
            "label": "다음 업무",
            "placement": "top",
            "title": "다음 업무"
          }
        ],
        "pageId": "AUTO_2AF561AACD365A3CBEE9",
        "summary": "운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.",
        "title": "적용·캐시 무효화·운영 확인 지원 화면 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다."
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
        "title": "적용·캐시 무효화·운영 확인 지원 화면 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ACTION_1",
            "label": "PUBLISH_CHANGE"
          },
          {
            "code": "ACTION_2",
            "label": "SAVE_DRAFT"
          },
          {
            "code": "ACTION_3",
            "label": "VALIDATE"
          },
          {
            "code": "ACTION_4",
            "label": "ATTACH_EVIDENCE"
          },
          {
            "code": "ACTION_5",
            "label": "OPEN_NEXT_TASK"
          }
        ],
        "nextAction": {
          "completionRule": "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다.",
          "label": "다음 업무 진행",
          "routePath": "/admin/system/build-studio"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "로그인 계정이 대상 프로젝트와 단계 수행 액터에 배정되고 이전 단계 완료 조건을 충족해야 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무 요약 · 진행 상태 · 전문 입력 계약 · 검증 결과 · 증적·이력 · 다음 업무",
            "label": "업무 정보 작성",
            "path": "/admin/system/build-studio"
          },
          {
            "code": "COMPLETE",
            "description": "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.",
        "title": "적용·캐시 무효화·운영 확인 지원 화면 업무 길잡이"
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
  "stepCode": "GOV_PUBLISH",
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
      "actionCount": 5,
      "designSystem": "KRDS_GOV",
      "fieldCount": 54,
      "pageName": "적용·캐시 무효화·운영 확인 지원 화면",
      "screenType": "ADMIN",
      "sectionCount": 6,
      "summary": "운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.",
      "templateCode": "KRDS_ADMIN",
      "title": "적용·캐시 무효화·운영 확인 지원 화면"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-1\"]",
          "body": "업무 요약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_1",
          "highlightStyle": "neutral",
          "id": "SECTION_1",
          "label": "업무 요약",
          "placement": "top",
          "title": "업무 요약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-2\"]",
          "body": "진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_2",
          "highlightStyle": "neutral",
          "id": "SECTION_2",
          "label": "진행 상태",
          "placement": "top",
          "title": "진행 상태"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-3\"]",
          "body": "전문 입력 계약 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_3",
          "highlightStyle": "neutral",
          "id": "SECTION_3",
          "label": "전문 입력 계약",
          "placement": "top",
          "title": "전문 입력 계약"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-4\"]",
          "body": "검증 결과 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_4",
          "highlightStyle": "neutral",
          "id": "SECTION_4",
          "label": "검증 결과",
          "placement": "top",
          "title": "검증 결과"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-5\"]",
          "body": "증적·이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_5",
          "highlightStyle": "neutral",
          "id": "SECTION_5",
          "label": "증적·이력",
          "placement": "top",
          "title": "증적·이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-2af561aacd365a3cbee9-section-6\"]",
          "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SECTION_6",
          "highlightStyle": "neutral",
          "id": "SECTION_6",
          "label": "다음 업무",
          "placement": "top",
          "title": "다음 업무"
        }
      ],
      "pageId": "AUTO_2AF561AACD365A3CBEE9",
      "summary": "운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.",
      "title": "적용·캐시 무효화·운영 확인 지원 화면 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다."
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
      "title": "적용·캐시 무효화·운영 확인 지원 화면 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ACTION_1",
          "label": "PUBLISH_CHANGE"
        },
        {
          "code": "ACTION_2",
          "label": "SAVE_DRAFT"
        },
        {
          "code": "ACTION_3",
          "label": "VALIDATE"
        },
        {
          "code": "ACTION_4",
          "label": "ATTACH_EVIDENCE"
        },
        {
          "code": "ACTION_5",
          "label": "OPEN_NEXT_TASK"
        }
      ],
      "nextAction": {
        "completionRule": "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다.",
        "label": "다음 업무 진행",
        "routePath": "/admin/system/build-studio"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "로그인 계정이 대상 프로젝트와 단계 수행 액터에 배정되고 이전 단계 완료 조건을 충족해야 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무 요약 · 진행 상태 · 전문 입력 계약 · 검증 결과 · 증적·이력 · 다음 업무",
          "label": "업무 정보 작성",
          "path": "/admin/system/build-studio"
        },
        {
          "code": "COMPLETE",
          "description": "배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.",
      "title": "적용·캐시 무효화·운영 확인 지원 화면 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
  "traceability": {
    "contractId": 25170,
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
      "GOVERNANCE_CHANGE:GOV_PUBLISH:ADMIN"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
