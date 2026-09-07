import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_project_lifecycle_control_project_lifecycle_control_s2_user = {
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "blueprintCode": "BP_AUTO_0C208995597295F00177AF94",
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
  "designHash": "6f0df7163870363c699e4ae2fc6b275e47c70fee206aad2238a138a149ec40d2",
  "id": "project-lifecycle-control-project-lifecycle-control-s2-user",
  "pageId": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
  "pageName": "보존·잠금·영향평가",
  "processCode": "PROJECT_LIFECYCLE_CONTROL",
  "routePath": "/generated/project-lifecycle-control/project-lifecycle-control-s2",
  "screenCoordinate": {
    "actor": "COMPANY_MANAGER",
    "device": "ADAPTIVE",
    "domain": "PROJECT",
    "locale": "MULTI",
    "policy": "COMPANY_MANAGER:DEFAULT",
    "process": "PROJECT_LIFECYCLE_CONTROL",
    "state": "STEP_1_COMPLETED",
    "step": "PROJECT_LIFECYCLE_CONTROL_S2",
    "variant": "KRDS_CONTENT",
    "view": "CONTENT"
  },
  "screenCoordinateKey": "PROJECT::PROJECT_LIFECYCLE_CONTROL::PROJECT_LIFECYCLE_CONTROL_S2::STEP_1_COMPLETED::COMPANY_MANAGER::COMPANY_MANAGER%3ADEFAULT::CONTENT::ADAPTIVE::MULTI::KRDS_CONTENT",
  "screenType": "CONTENT",
  "specification": {
    "accessibility": "KRDS와 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약·필드 연결, 비색상 상태 표현과 표 머리글 연결을 보장한다.",
    "actions": [
      {
        "code": "PROJECT_LIFECYCLE_CONTROL_EXECUTE_2",
        "idempotencyRequired": true,
        "label": "보존·잠금·영향평가 실행",
        "transactional": true
      },
      {
        "code": "SAVE_DRAFT",
        "label": "임시저장",
        "transactional": true
      },
      {
        "auditRequired": true,
        "code": "ATTACH_EVIDENCE",
        "label": "증적 연결"
      },
      {
        "code": "MOVE_NEXT_TASK",
        "completionRequired": true,
        "label": "다음 업무 이동"
      }
    ],
    "actorResponsibilities": [],
    "apiContracts": [
      {
        "code": "SCREEN_CONTRACT",
        "method": "GET",
        "path": "/home/api/process-executions/screen-contract",
        "purpose": "라우트별 실행 계약 조회"
      },
      {
        "code": "LOAD_EXECUTION",
        "method": "GET",
        "path": "/home/api/process-executions",
        "purpose": "프로세스 실행 문맥 조회"
      },
      {
        "code": "PROJECT_LIFECYCLE_CONTROL_EXECUTE_2",
        "method": "POST",
        "path": "/home/api/process-executions/{executionId}/commands",
        "purpose": "보존·잠금·영향평가 상태 명령 실행"
      },
      {
        "code": "LOAD_DRAFT",
        "method": "GET",
        "path": "/home/api/process-executions/draft",
        "purpose": "업무 임시저장 조회"
      },
      {
        "code": "SAVE_DRAFT",
        "method": "PUT",
        "path": "/home/api/process-executions/draft",
        "purpose": "업무 임시저장"
      }
    ],
    "businessPurpose": "프로젝트 종료·보관·재개·취소 프로세스의 보존·잠금·영향평가 단계에서 COMPANY_MANAGER 액터가 PROJECT_LIFECYCLE_CONTROL_EXECUTE_2 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
    "completionRule": "보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
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
        "entity": "PROCESS_STEP",
        "keys": [
          "processCode",
          "stepCode"
        ],
        "stateTransition": {
          "from": "STEP_1_COMPLETED",
          "to": "STEP_2_COMPLETED"
        }
      },
      {
        "entity": "WORK_DRAFT",
        "keys": [
          "tenantId",
          "projectId",
          "processCode",
          "stepCode",
          "actorCode"
        ],
        "versioned": true
      },
      {
        "appendOnly": true,
        "beforeAfterRequired": true,
        "entity": "AUDIT_EVENT"
      }
    ],
    "designSystem": "KRDS_GOV",
    "entryConditions": [
      "다음 프로세스 시작 조건을 충족한다: 전환 요청자와 사유, 미결 태스크, 보존 정책이 확인된다. 현재 상태는 STEP_1_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "errors": [],
    "exitConditions": [
      "다음 완료 기준을 검증한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_2_COMPLETED 상태로 원자적으로 전이한다."
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
        "fieldGroup": "공통",
        "fieldName": "테넌트",
        "fieldOrder": 10,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": "tenant_id",
        "sourceTable": "emission_project_registry",
        "validation": {
          "minLength": 1
        }
      },
      {
        "apiProperty": "projectId",
        "audience": "USER",
        "controlType": "PROJECT_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "projectId",
        "fieldGroup": "공통",
        "fieldName": "프로젝트",
        "fieldOrder": 20,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": "project_id",
        "sourceTable": "emission_project_registry",
        "validation": {
          "minLength": 1
        }
      },
      {
        "apiProperty": "processCode",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processCode",
        "fieldGroup": "공통",
        "fieldName": "프로세스 코드",
        "fieldOrder": 30,
        "mappingStatus": "CONTEXT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": "process_code",
        "sourceTable": "framework_process_definition",
        "validation": {
          "immutable": true,
          "required": true,
          "source": "SERVER_CONTEXT"
        }
      },
      {
        "apiProperty": "stepCode",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepCode",
        "fieldGroup": "공통",
        "fieldName": "단계 코드",
        "fieldOrder": 40,
        "mappingStatus": "CONTEXT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": "step_code",
        "sourceTable": "framework_process_step",
        "validation": {
          "immutable": true,
          "required": true,
          "source": "SERVER_CONTEXT"
        }
      },
      {
        "apiProperty": "recordId",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "UUID",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "recordId",
        "fieldGroup": "공통",
        "fieldName": "업무 레코드 ID",
        "fieldOrder": 50,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "immutable": true,
          "required": false,
          "source": "SERVER_CONTEXT"
        }
      },
      {
        "apiProperty": "statusCode",
        "audience": "USER",
        "controlType": "STATUS_BADGE",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "statusCode",
        "fieldGroup": "공통",
        "fieldName": "처리 상태",
        "fieldOrder": 60,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "codeGroup": "WORK_STATUS"
        }
      },
      {
        "apiProperty": "ownerActorCode",
        "audience": "USER",
        "controlType": "ACTOR_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "ownerActorCode",
        "fieldGroup": "공통",
        "fieldName": "담당 액터",
        "fieldOrder": 70,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "rowVersion",
        "audience": "USER",
        "controlType": "HIDDEN",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "공통",
        "fieldName": "데이터 버전",
        "fieldOrder": 80,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "createdAt",
        "audience": "USER",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "createdAt",
        "fieldGroup": "공통",
        "fieldName": "등록 일시",
        "fieldOrder": 90,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": "created_at",
        "sourceTable": "emission_project_registry",
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "updatedAt",
        "audience": "USER",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "updatedAt",
        "fieldGroup": "공통",
        "fieldName": "최종 수정 일시",
        "fieldOrder": 100,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": "updated_at",
        "sourceTable": "emission_project_registry",
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "evidenceCount",
        "audience": "USER",
        "controlType": "EVIDENCE_LINK",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "evidenceCount",
        "fieldGroup": "공통",
        "fieldName": "증빙 수",
        "fieldOrder": 110,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "reportingYear",
        "audience": "USER",
        "controlType": "YEAR",
        "dataType": "YEAR",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "reportingYear",
        "fieldGroup": "EMISSION",
        "fieldName": "보고연도",
        "fieldOrder": 200,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": "reporting_year",
        "sourceTable": "emission_project_registry",
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
        "audience": "USER",
        "controlType": "ORGANIZATION_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "organizationId",
        "fieldGroup": "EMISSION",
        "fieldName": "조직",
        "fieldOrder": 210,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "siteId",
        "audience": "USER",
        "controlType": "SITE_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "siteId",
        "fieldGroup": "EMISSION",
        "fieldName": "사업장",
        "fieldOrder": 220,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "facilityId",
        "audience": "USER",
        "controlType": "FACILITY_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "facilityId",
        "fieldGroup": "EMISSION",
        "fieldName": "배출시설",
        "fieldOrder": 230,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "scopeCode",
        "audience": "USER",
        "controlType": "SCOPE_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "scopeCode",
        "fieldGroup": "EMISSION",
        "fieldName": "Scope",
        "fieldOrder": 240,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "activityValue",
        "audience": "USER",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "activityValue",
        "fieldGroup": "EMISSION",
        "fieldName": "활동량",
        "fieldOrder": 250,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "finite": true,
          "nullable": true,
          "required": false,
          "type": "number"
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
        "fieldGroup": "EMISSION",
        "fieldName": "단위",
        "fieldOrder": 260,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "factorId",
        "audience": "USER",
        "controlType": "FACTOR_SEARCH",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "factorId",
        "fieldGroup": "EMISSION",
        "fieldName": "배출계수",
        "fieldOrder": 270,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "emissionValue",
        "audience": "USER",
        "controlType": "CALCULATED_NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "emissionValue",
        "fieldGroup": "EMISSION",
        "fieldName": "배출량",
        "fieldOrder": 280,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "finite": true,
          "nullable": true,
          "required": false,
          "type": "number"
        }
      },
      {
        "apiProperty": "qualityStatus",
        "audience": "USER",
        "controlType": "QUALITY_BADGE",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "qualityStatus",
        "fieldGroup": "EMISSION",
        "fieldName": "데이터 품질",
        "fieldOrder": 290,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "taskComment",
        "audience": "USER",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "taskComment",
        "fieldGroup": "업무 처리",
        "fieldName": "업무 메모",
        "fieldOrder": 400,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "apiProperty": "dueAt",
        "audience": "USER",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "dueAt",
        "fieldGroup": "업무 처리",
        "fieldName": "마감 일시",
        "fieldOrder": 410,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "nextActorCode",
        "audience": "USER",
        "controlType": "ACTOR_VIEW",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "nextActorCode",
        "fieldGroup": "업무 처리",
        "fieldName": "다음 담당 액터",
        "fieldOrder": 420,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "permissionCode": "COMPANY_MANAGER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/emission/project-lifecycle-control/project-lifecycle-control-s2",
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
        "code": "COMPLETION_RATE",
        "label": "보존·잠금·영향평가 완료율",
        "unit": "PERCENT"
      },
      {
        "code": "SLA_REMAINING",
        "label": "처리 기한 잔여시간",
        "unit": "MINUTE"
      },
      {
        "code": "BLOCKING_ERROR",
        "label": "차단 오류 수",
        "unit": "COUNT"
      },
      {
        "code": "RECOVERY_RATE",
        "label": "오류 복구 성공률",
        "unit": "PERCENT"
      }
    ],
    "permissions": [],
    "responsive": "360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약·작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하고 표는 열 우선순위와 가로 스크롤을 적용한다.",
    "schemaVersion": "2.0.0",
    "sections": [
      {
        "code": "TASK_CONTEXT",
        "label": "업무 문맥·진행 상태"
      },
      {
        "code": "SEARCH_FILTER",
        "label": "검색·필터"
      },
      {
        "code": "WORKSPACE",
        "label": "핵심 데이터 작업공간"
      },
      {
        "code": "EVIDENCE_HISTORY",
        "label": "증적·변경 이력"
      },
      {
        "code": "NEXT_TASK",
        "label": "다음 업무"
      }
    ],
    "states": [
      "STEP_1_COMPLETED",
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_2_COMPLETED"
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
        "pageName": "보존·잠금·영향평가",
        "screenType": "CONTENT",
        "sectionCount": 5,
        "summary": "프로젝트 종료·보관·재개·취소 프로세스의 보존·잠금·영향평가 단계에서 COMPANY_MANAGER 액터가 PROJECT_LIFECYCLE_CONTROL_EXECUTE_2 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
        "templateCode": "KRDS_CONTENT",
        "title": "보존·잠금·영향평가"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-task-context\"]",
            "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "TASK_CONTEXT",
            "highlightStyle": "neutral",
            "id": "TASK_CONTEXT",
            "label": "업무 문맥·진행 상태",
            "placement": "top",
            "title": "업무 문맥·진행 상태"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-search-filter\"]",
            "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SEARCH_FILTER",
            "highlightStyle": "neutral",
            "id": "SEARCH_FILTER",
            "label": "검색·필터",
            "placement": "top",
            "title": "검색·필터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-workspace\"]",
            "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "WORKSPACE",
            "highlightStyle": "neutral",
            "id": "WORKSPACE",
            "label": "핵심 데이터 작업공간",
            "placement": "top",
            "title": "핵심 데이터 작업공간"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-evidence-history\"]",
            "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "EVIDENCE_HISTORY",
            "highlightStyle": "neutral",
            "id": "EVIDENCE_HISTORY",
            "label": "증적·변경 이력",
            "placement": "top",
            "title": "증적·변경 이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-next-task\"]",
            "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "NEXT_TASK",
            "highlightStyle": "neutral",
            "id": "NEXT_TASK",
            "label": "다음 업무",
            "placement": "top",
            "title": "다음 업무"
          }
        ],
        "pageId": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
        "summary": "프로젝트 종료·보관·재개·취소 프로세스의 보존·잠금·영향평가 단계에서 COMPANY_MANAGER 액터가 PROJECT_LIFECYCLE_CONTROL_EXECUTE_2 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
        "title": "보존·잠금·영향평가 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "다음 완료 기준을 검증한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_2_COMPLETED 상태로 원자적으로 전이한다."
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
        "title": "보존·잠금·영향평가 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "PROJECT_LIFECYCLE_CONTROL_EXECUTE_2",
            "idempotencyRequired": true,
            "label": "보존·잠금·영향평가 실행",
            "transactional": true
          },
          {
            "code": "SAVE_DRAFT",
            "label": "임시저장",
            "transactional": true
          },
          {
            "auditRequired": true,
            "code": "ATTACH_EVIDENCE",
            "label": "증적 연결"
          },
          {
            "code": "MOVE_NEXT_TASK",
            "completionRequired": true,
            "label": "다음 업무 이동"
          }
        ],
        "nextAction": {
          "completionRule": "보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
          "label": "다음 업무 진행",
          "routePath": "/generated/project-lifecycle-control/project-lifecycle-control-s2"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 전환 요청자와 사유, 미결 태스크, 보존 정책이 확인된다. 현재 상태는 STEP_1_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
            "label": "업무 정보 작성",
            "path": "/generated/project-lifecycle-control/project-lifecycle-control-s2"
          },
          {
            "code": "COMPLETE",
            "description": "보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "프로젝트 종료·보관·재개·취소 프로세스의 보존·잠금·영향평가 단계에서 COMPANY_MANAGER 액터가 PROJECT_LIFECYCLE_CONTROL_EXECUTE_2 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
        "title": "보존·잠금·영향평가 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "PROJECT_LIFECYCLE_CONTROL_S2",
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
      "pageName": "보존·잠금·영향평가",
      "screenType": "CONTENT",
      "sectionCount": 5,
      "summary": "프로젝트 종료·보관·재개·취소 프로세스의 보존·잠금·영향평가 단계에서 COMPANY_MANAGER 액터가 PROJECT_LIFECYCLE_CONTROL_EXECUTE_2 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
      "templateCode": "KRDS_CONTENT",
      "title": "보존·잠금·영향평가"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-task-context\"]",
          "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "TASK_CONTEXT",
          "highlightStyle": "neutral",
          "id": "TASK_CONTEXT",
          "label": "업무 문맥·진행 상태",
          "placement": "top",
          "title": "업무 문맥·진행 상태"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-search-filter\"]",
          "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SEARCH_FILTER",
          "highlightStyle": "neutral",
          "id": "SEARCH_FILTER",
          "label": "검색·필터",
          "placement": "top",
          "title": "검색·필터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-workspace\"]",
          "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "WORKSPACE",
          "highlightStyle": "neutral",
          "id": "WORKSPACE",
          "label": "핵심 데이터 작업공간",
          "placement": "top",
          "title": "핵심 데이터 작업공간"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-evidence-history\"]",
          "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "EVIDENCE_HISTORY",
          "highlightStyle": "neutral",
          "id": "EVIDENCE_HISTORY",
          "label": "증적·변경 이력",
          "placement": "top",
          "title": "증적·변경 이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-project-lifecycle-control-project-lifecycle-control-s2-user-next-task\"]",
          "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "NEXT_TASK",
          "highlightStyle": "neutral",
          "id": "NEXT_TASK",
          "label": "다음 업무",
          "placement": "top",
          "title": "다음 업무"
        }
      ],
      "pageId": "PROJECT_LIFECYCLE_CONTROL_PROJECT_LIFECYCLE_CONTROL_S2_USER",
      "summary": "프로젝트 종료·보관·재개·취소 프로세스의 보존·잠금·영향평가 단계에서 COMPANY_MANAGER 액터가 PROJECT_LIFECYCLE_CONTROL_EXECUTE_2 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
      "title": "보존·잠금·영향평가 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "다음 완료 기준을 검증한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_2_COMPLETED 상태로 원자적으로 전이한다."
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
      "title": "보존·잠금·영향평가 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "PROJECT_LIFECYCLE_CONTROL_EXECUTE_2",
          "idempotencyRequired": true,
          "label": "보존·잠금·영향평가 실행",
          "transactional": true
        },
        {
          "code": "SAVE_DRAFT",
          "label": "임시저장",
          "transactional": true
        },
        {
          "auditRequired": true,
          "code": "ATTACH_EVIDENCE",
          "label": "증적 연결"
        },
        {
          "code": "MOVE_NEXT_TASK",
          "completionRequired": true,
          "label": "다음 업무 이동"
        }
      ],
      "nextAction": {
        "completionRule": "보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
        "label": "다음 업무 진행",
        "routePath": "/generated/project-lifecycle-control/project-lifecycle-control-s2"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 전환 요청자와 사유, 미결 태스크, 보존 정책이 확인된다. 현재 상태는 STEP_1_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
          "label": "업무 정보 작성",
          "path": "/generated/project-lifecycle-control/project-lifecycle-control-s2"
        },
        {
          "code": "COMPLETE",
          "description": "보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "프로젝트 종료·보관·재개·취소 프로세스의 보존·잠금·영향평가 단계에서 COMPANY_MANAGER 액터가 PROJECT_LIFECYCLE_CONTROL_EXECUTE_2 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 보존·잠금·영향평가의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
      "title": "보존·잠금·영향평가 업무 길잡이"
    }
  },
  "templateCode": "KRDS_CONTENT",
  "traceability": {
    "caseTypeCount": 5,
    "designReadinessScore": 100,
    "evidenceContract": [
      {
        "evidence": [
          "request",
          "response",
          "stateTransition"
        ],
        "required": true,
        "scenarioType": "HAPPY_PATH"
      },
      {
        "evidence": [
          "actorDecision",
          "forbiddenResponse"
        ],
        "required": true,
        "scenarioType": "AUTHORITY"
      },
      {
        "evidence": [
          "tenantBoundary",
          "projectBoundary"
        ],
        "required": true,
        "scenarioType": "ISOLATION"
      },
      {
        "evidence": [
          "validationError",
          "rollbackState"
        ],
        "required": true,
        "scenarioType": "EXCEPTION"
      },
      {
        "evidence": [
          "retry",
          "idempotency",
          "auditEvent"
        ],
        "required": true,
        "scenarioType": "RECOVERY"
      }
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
