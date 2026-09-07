import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_560d999616f119ca0306 = {
  "actorCode": "APPROVER",
  "audience": "ADMIN",
  "blueprintCode": "BP_AUTO_560D999616F119CA03063603",
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
  "designHash": "778ade4c603078f97c5839d01e706863939f0de873d2d608ea8f6b2d9214e2b2",
  "id": "auto-560d999616f119ca0306",
  "pageId": "AUTO_560D999616F119CA0306",
  "pageName": "폐기·재발급·감사 확정 관리자 업무 화면",
  "processCode": "CERTIFICATE_ISSUANCE",
  "routePath": "/admin/emission/certificates",
  "screenCoordinate": {
    "actor": "APPROVER",
    "device": "ADAPTIVE",
    "domain": "CERTIFICATE",
    "locale": "MULTI",
    "policy": "APPROVER:DEFAULT",
    "process": "CERTIFICATE_ISSUANCE",
    "state": "VERIFIED",
    "step": "CERTIFICATE_ISSUANCE_04_APPROVE",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "CERTIFICATE::CERTIFICATE_ISSUANCE::CERTIFICATE_ISSUANCE_04_APPROVE::VERIFIED::APPROVER::APPROVER%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
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
        "code": "CLOSE_CERTIFICATE_LIFECYCLE",
        "idempotencyRequired": true,
        "label": "폐기·재발급·감사 확정 실행",
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
    "actorResponsibilities": [
      "APPROVER 액터가 권한·업무분리 정책에 따라 폐기·재발급·감사 확정 관리자 업무 화면 업무를 수행한다."
    ],
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
        "code": "CLOSE_CERTIFICATE_LIFECYCLE",
        "method": "POST",
        "path": "/home/api/process-executions/{executionId}/commands",
        "purpose": "폐기·재발급·감사 확정 상태 명령 실행"
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
    "businessPurpose": "인증서 신청·발급·검증 프로세스의 폐기·재발급·감사 확정 단계에서 APPROVER 액터가 CLOSE_CERTIFICATE_LIFECYCLE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.",
    "completionRule": "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다.",
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
          "from": "VERIFIED",
          "to": "COMPLETED"
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
      "다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 VERIFIED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
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
      "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다."
    ],
    "extensions": {
      "contractId": 2826,
      "sharedRuntime": true
    },
    "fields": [
      {
        "apiProperty": "tenantId",
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "STRING",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "tenantId",
        "fieldGroup": "공통",
        "fieldName": "테넌트",
        "fieldOrder": 10,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
        "sourceColumn": "tenant_id",
        "sourceTable": "emission_project_report",
        "validation": {
          "minLength": 1
        }
      },
      {
        "apiProperty": "projectId",
        "audience": "ADMIN",
        "controlType": "PROJECT_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "projectId",
        "fieldGroup": "공통",
        "fieldName": "프로젝트",
        "fieldOrder": 20,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
        "sourceColumn": "project_id",
        "sourceTable": "emission_project_report",
        "validation": {
          "minLength": 1
        }
      },
      {
        "apiProperty": "processCode",
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "processCode",
        "fieldGroup": "공통",
        "fieldName": "프로세스 코드",
        "fieldOrder": 30,
        "mappingStatus": "CONTEXT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
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
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "stepCode",
        "fieldGroup": "공통",
        "fieldName": "단계 코드",
        "fieldOrder": 40,
        "mappingStatus": "CONTEXT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
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
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "UUID",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "recordId",
        "fieldGroup": "공통",
        "fieldName": "업무 레코드 ID",
        "fieldOrder": 50,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
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
        "audience": "ADMIN",
        "controlType": "STATUS_BADGE",
        "dataType": "CODE",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "statusCode",
        "fieldGroup": "공통",
        "fieldName": "처리 상태",
        "fieldOrder": 60,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "codeGroup": "WORK_STATUS"
        }
      },
      {
        "apiProperty": "ownerActorCode",
        "audience": "ADMIN",
        "controlType": "ACTOR_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "ownerActorCode",
        "fieldGroup": "공통",
        "fieldName": "담당 액터",
        "fieldOrder": 70,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
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
        "audience": "ADMIN",
        "controlType": "HIDDEN",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "rowVersion",
        "fieldGroup": "공통",
        "fieldName": "데이터 버전",
        "fieldOrder": 80,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "createdAt",
        "audience": "ADMIN",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "createdAt",
        "fieldGroup": "공통",
        "fieldName": "등록 일시",
        "fieldOrder": 90,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
        "sourceColumn": "created_at",
        "sourceTable": "emission_project_report",
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "updatedAt",
        "audience": "ADMIN",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "updatedAt",
        "fieldGroup": "공통",
        "fieldName": "최종 수정 일시",
        "fieldOrder": 100,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
        "sourceColumn": "updated_at",
        "sourceTable": "emission_project_report",
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "evidenceCount",
        "audience": "ADMIN",
        "controlType": "EVIDENCE_LINK",
        "dataType": "INTEGER",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "evidenceCount",
        "fieldGroup": "공통",
        "fieldName": "증빙 수",
        "fieldOrder": 110,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "reportId",
        "audience": "ADMIN",
        "controlType": "REPORT_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "reportId",
        "fieldGroup": "CERTIFICATE",
        "fieldName": "보고서",
        "fieldOrder": 200,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
        "sourceColumn": "report_id",
        "sourceTable": "emission_project_report",
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
        "apiProperty": "certificateId",
        "audience": "ADMIN",
        "controlType": "CERTIFICATE_LINK",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "certificateId",
        "fieldGroup": "CERTIFICATE",
        "fieldName": "인증서",
        "fieldOrder": 210,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
        "sourceColumn": "certificate_id",
        "sourceTable": "emission_project_report",
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
        "apiProperty": "reportVersion",
        "audience": "ADMIN",
        "controlType": "VERSION",
        "dataType": "INTEGER",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "reportVersion",
        "fieldGroup": "CERTIFICATE",
        "fieldName": "보고서 버전",
        "fieldOrder": 220,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
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
        "apiProperty": "integrityHash",
        "audience": "ADMIN",
        "controlType": "HASH_VIEW",
        "dataType": "HASH",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "integrityHash",
        "fieldGroup": "CERTIFICATE",
        "fieldName": "무결성 해시",
        "fieldOrder": 230,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
        "sourceColumn": "integrity_hash",
        "sourceTable": "emission_project_report",
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
        "apiProperty": "datasetHash",
        "audience": "ADMIN",
        "controlType": "HASH_VIEW",
        "dataType": "HASH",
        "editable": true,
        "evidenceRequired": true,
        "fieldCode": "datasetHash",
        "fieldGroup": "CERTIFICATE",
        "fieldName": "데이터셋 해시",
        "fieldOrder": 240,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
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
        "apiProperty": "certificateStatus",
        "audience": "ADMIN",
        "controlType": "STATUS_BADGE",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "certificateStatus",
        "fieldGroup": "CERTIFICATE",
        "fieldName": "인증 상태",
        "fieldOrder": 250,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
        "sourceColumn": "certificate_status",
        "sourceTable": "emission_project_report",
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
        "apiProperty": "issuedAt",
        "audience": "ADMIN",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "issuedAt",
        "fieldGroup": "CERTIFICATE",
        "fieldName": "발급 일시",
        "fieldOrder": 260,
        "mappingStatus": "DB_RESOLVED",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
        "sourceColumn": "issued_at",
        "sourceTable": "emission_project_report",
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "decisionCode",
        "audience": "ADMIN",
        "controlType": "DECISION_RADIO",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "decisionCode",
        "fieldGroup": "업무 처리",
        "fieldName": "판정",
        "fieldOrder": 400,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
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
        "apiProperty": "reviewComment",
        "audience": "ADMIN",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "reviewComment",
        "fieldGroup": "업무 처리",
        "fieldName": "검토 의견",
        "fieldOrder": 410,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/emission/certificates",
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
        "apiProperty": "rejectionReasonCode",
        "audience": "ADMIN",
        "controlType": "REASON_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "rejectionReasonCode",
        "fieldGroup": "업무 처리",
        "fieldName": "반려 사유",
        "fieldOrder": 420,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
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
        "apiProperty": "decidedAt",
        "audience": "ADMIN",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "decidedAt",
        "fieldGroup": "업무 처리",
        "fieldName": "판정 일시",
        "fieldOrder": 430,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "CERTIFICATE_ISSUANCE_CERTIFICATE_ISSUANCE_04_APPROVE_ADMIN",
        "permissionCode": "APPROVER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/emission/certificates",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      }
    ],
    "kpis": [
      {
        "code": "COMPLETION_RATE",
        "label": "폐기·재발급·감사 확정 완료율",
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
    "permissions": [
      {
        "code": "APPROVER",
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
      "VERIFIED",
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "COMPLETED"
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
        "fieldCount": 22,
        "pageName": "폐기·재발급·감사 확정 관리자 업무 화면",
        "screenType": "ADMIN",
        "sectionCount": 5,
        "summary": "인증서 신청·발급·검증 프로세스의 폐기·재발급·감사 확정 단계에서 APPROVER 액터가 CLOSE_CERTIFICATE_LIFECYCLE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.",
        "templateCode": "KRDS_ADMIN",
        "title": "폐기·재발급·감사 확정 관리자 업무 화면"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-task-context\"]",
            "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "TASK_CONTEXT",
            "highlightStyle": "neutral",
            "id": "TASK_CONTEXT",
            "label": "업무 문맥·진행 상태",
            "placement": "top",
            "title": "업무 문맥·진행 상태"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-search-filter\"]",
            "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SEARCH_FILTER",
            "highlightStyle": "neutral",
            "id": "SEARCH_FILTER",
            "label": "검색·필터",
            "placement": "top",
            "title": "검색·필터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-workspace\"]",
            "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "WORKSPACE",
            "highlightStyle": "neutral",
            "id": "WORKSPACE",
            "label": "핵심 데이터 작업공간",
            "placement": "top",
            "title": "핵심 데이터 작업공간"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-evidence-history\"]",
            "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "EVIDENCE_HISTORY",
            "highlightStyle": "neutral",
            "id": "EVIDENCE_HISTORY",
            "label": "증적·변경 이력",
            "placement": "top",
            "title": "증적·변경 이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-next-task\"]",
            "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "NEXT_TASK",
            "highlightStyle": "neutral",
            "id": "NEXT_TASK",
            "label": "다음 업무",
            "placement": "top",
            "title": "다음 업무"
          }
        ],
        "pageId": "AUTO_560D999616F119CA0306",
        "summary": "인증서 신청·발급·검증 프로세스의 폐기·재발급·감사 확정 단계에서 APPROVER 액터가 CLOSE_CERTIFICATE_LIFECYCLE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.",
        "title": "폐기·재발급·감사 확정 관리자 업무 화면 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다."
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
        "title": "폐기·재발급·감사 확정 관리자 업무 화면 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "CLOSE_CERTIFICATE_LIFECYCLE",
            "idempotencyRequired": true,
            "label": "폐기·재발급·감사 확정 실행",
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
          "completionRule": "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다.",
          "label": "다음 업무 진행",
          "routePath": "/admin/emission/certificates"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 VERIFIED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
            "label": "업무 정보 작성",
            "path": "/admin/emission/certificates"
          },
          {
            "code": "COMPLETE",
            "description": "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "인증서 신청·발급·검증 프로세스의 폐기·재발급·감사 확정 단계에서 APPROVER 액터가 CLOSE_CERTIFICATE_LIFECYCLE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.",
        "title": "폐기·재발급·감사 확정 관리자 업무 화면 업무 길잡이"
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
  "stepCode": "CERTIFICATE_ISSUANCE_04_APPROVE",
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
      "fieldCount": 22,
      "pageName": "폐기·재발급·감사 확정 관리자 업무 화면",
      "screenType": "ADMIN",
      "sectionCount": 5,
      "summary": "인증서 신청·발급·검증 프로세스의 폐기·재발급·감사 확정 단계에서 APPROVER 액터가 CLOSE_CERTIFICATE_LIFECYCLE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.",
      "templateCode": "KRDS_ADMIN",
      "title": "폐기·재발급·감사 확정 관리자 업무 화면"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-task-context\"]",
          "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "TASK_CONTEXT",
          "highlightStyle": "neutral",
          "id": "TASK_CONTEXT",
          "label": "업무 문맥·진행 상태",
          "placement": "top",
          "title": "업무 문맥·진행 상태"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-search-filter\"]",
          "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SEARCH_FILTER",
          "highlightStyle": "neutral",
          "id": "SEARCH_FILTER",
          "label": "검색·필터",
          "placement": "top",
          "title": "검색·필터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-workspace\"]",
          "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "WORKSPACE",
          "highlightStyle": "neutral",
          "id": "WORKSPACE",
          "label": "핵심 데이터 작업공간",
          "placement": "top",
          "title": "핵심 데이터 작업공간"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-evidence-history\"]",
          "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "EVIDENCE_HISTORY",
          "highlightStyle": "neutral",
          "id": "EVIDENCE_HISTORY",
          "label": "증적·변경 이력",
          "placement": "top",
          "title": "증적·변경 이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-auto-560d999616f119ca0306-next-task\"]",
          "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "NEXT_TASK",
          "highlightStyle": "neutral",
          "id": "NEXT_TASK",
          "label": "다음 업무",
          "placement": "top",
          "title": "다음 업무"
        }
      ],
      "pageId": "AUTO_560D999616F119CA0306",
      "summary": "인증서 신청·발급·검증 프로세스의 폐기·재발급·감사 확정 단계에서 APPROVER 액터가 CLOSE_CERTIFICATE_LIFECYCLE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.",
      "title": "폐기·재발급·감사 확정 관리자 업무 화면 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다."
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
      "title": "폐기·재발급·감사 확정 관리자 업무 화면 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "CLOSE_CERTIFICATE_LIFECYCLE",
          "idempotencyRequired": true,
          "label": "폐기·재발급·감사 확정 실행",
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
        "completionRule": "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다.",
        "label": "다음 업무 진행",
        "routePath": "/admin/emission/certificates"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 VERIFIED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
          "label": "업무 정보 작성",
          "path": "/admin/emission/certificates"
        },
        {
          "code": "COMPLETE",
          "description": "다음 완료 기준을 검증한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다. 결과·버전·감사 증적을 저장한 뒤 COMPLETED 상태로 원자적으로 전이한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "인증서 신청·발급·검증 프로세스의 폐기·재발급·감사 확정 단계에서 APPROVER 액터가 CLOSE_CERTIFICATE_LIFECYCLE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.",
      "title": "폐기·재발급·감사 확정 관리자 업무 화면 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
  "traceability": {
    "contractId": 2826,
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
      "CERTIFICATE_ISSUANCE:CERTIFICATE_ISSUANCE_04_APPROVE:ADMIN"
    ]
  }
} as const satisfies GeneratedScreenDefinition;
