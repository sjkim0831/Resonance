import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_anomaly_alert_management_anomaly_alert_management_s4_user = {
  "actorCode": "APPROVER",
  "audience": "USER",
  "blueprintCode": "BP_AUTO_91ADE0F0415B3EEA52D47DB5",
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
  "designHash": "201b46a99939f12515db3a7732da5881d9c87a71a3c76fe9710c588631c77cc2",
  "id": "anomaly-alert-management-anomaly-alert-management-s4-user",
  "pageId": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
  "pageName": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결",
  "processCode": "ANOMALY_ALERT_MANAGEMENT",
  "routePath": "/generated/anomaly-alert-management/anomaly-alert-management-s4",
  "screenCoordinate": {
    "actor": "APPROVER",
    "device": "ADAPTIVE",
    "domain": "ANOMALY",
    "locale": "MULTI",
    "policy": "APPROVER:DEFAULT",
    "process": "ANOMALY_ALERT_MANAGEMENT",
    "state": "STEP_3_COMPLETED",
    "step": "ANOMALY_ALERT_MANAGEMENT_S4",
    "variant": "KRDS_WORKFLOW",
    "view": "WORKFLOW"
  },
  "screenCoordinateKey": "ANOMALY::ANOMALY_ALERT_MANAGEMENT::ANOMALY_ALERT_MANAGEMENT_S4::STEP_3_COMPLETED::APPROVER::APPROVER%3ADEFAULT::WORKFLOW::ADAPTIVE::MULTI::KRDS_WORKFLOW",
  "screenType": "WORKFLOW",
  "specification": {
    "accessibility": "KRDS와 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약·필드 연결, 비색상 상태 표현과 표 머리글 연결을 보장한다.",
    "actions": [
      {
        "code": "ANOMALY_ALERT_MANAGEMENT_COMPLETE",
        "idempotencyRequired": true,
        "label": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 실행",
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
        "code": "ANOMALY_ALERT_MANAGEMENT_COMPLETE",
        "method": "POST",
        "path": "/home/api/process-executions/{executionId}/commands",
        "purpose": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 상태 명령 실행"
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
    "businessPurpose": "이상치·경보 관리 프로세스의 이상치·경보 관리 - 승인·확정·통지·후속업무 연결 단계에서 APPROVER 액터가 ANOMALY_ALERT_MANAGEMENT_COMPLETE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
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
        "entity": "PROCESS_STEP",
        "keys": [
          "processCode",
          "stepCode"
        ],
        "stateTransition": {
          "from": "STEP_3_COMPLETED",
          "to": "STEP_4_COMPLETED"
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
      "다음 프로세스 시작 조건을 충족한다: 요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "errors": [],
    "exitConditions": [
      "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_4_COMPLETED 상태로 원자적으로 전이한다."
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
        "mappingStatus": "CONTEXT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
        "sourceColumn": null,
        "sourceTable": null,
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
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
        "sourceColumn": null,
        "sourceTable": null,
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
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
        "sourceColumn": null,
        "sourceTable": null,
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
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
        "sourceColumn": null,
        "sourceTable": null,
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
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "metricCode",
        "audience": "USER",
        "controlType": "METRIC_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "metricCode",
        "fieldGroup": "MONITORING",
        "fieldName": "지표",
        "fieldOrder": 200,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "apiProperty": "dimensionKey",
        "audience": "USER",
        "controlType": "DIMENSION_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "dimensionKey",
        "fieldGroup": "MONITORING",
        "fieldName": "분석 차원",
        "fieldOrder": 210,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "apiProperty": "observedAt",
        "audience": "USER",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "observedAt",
        "fieldGroup": "MONITORING",
        "fieldName": "관측 시각",
        "fieldOrder": 220,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "nullable": false,
          "required": true,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "observedValue",
        "audience": "USER",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "observedValue",
        "fieldGroup": "MONITORING",
        "fieldName": "관측값",
        "fieldOrder": 230,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "apiProperty": "thresholdValue",
        "audience": "USER",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "thresholdValue",
        "fieldGroup": "MONITORING",
        "fieldName": "임계값",
        "fieldOrder": 240,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "apiProperty": "anomalyStatus",
        "audience": "USER",
        "controlType": "ALERT_BADGE",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "anomalyStatus",
        "fieldGroup": "MONITORING",
        "fieldName": "이상치 상태",
        "fieldOrder": 250,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "apiProperty": "decisionCode",
        "audience": "USER",
        "controlType": "DECISION_RADIO",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "decisionCode",
        "fieldGroup": "업무 처리",
        "fieldName": "판정",
        "fieldOrder": 400,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "audience": "USER",
        "controlType": "TEXTAREA",
        "dataType": "TEXT",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "reviewComment",
        "fieldGroup": "업무 처리",
        "fieldName": "검토 의견",
        "fieldOrder": 410,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "audience": "USER",
        "controlType": "REASON_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "rejectionReasonCode",
        "fieldGroup": "업무 처리",
        "fieldName": "반려 사유",
        "fieldOrder": 420,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "audience": "USER",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "decidedAt",
        "fieldGroup": "업무 처리",
        "fieldName": "판정 일시",
        "fieldOrder": 430,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "permissionCode": "APPROVER:USER",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/planned/monitoring/anomaly-alert-management/anomaly-alert-management-s4",
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
        "label": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 완료율",
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
      "STEP_3_COMPLETED",
      "LOADING",
      "EMPTY",
      "READY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_4_COMPLETED"
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
        "pageName": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결",
        "screenType": "WORKFLOW",
        "sectionCount": 5,
        "summary": "이상치·경보 관리 프로세스의 이상치·경보 관리 - 승인·확정·통지·후속업무 연결 단계에서 APPROVER 액터가 ANOMALY_ALERT_MANAGEMENT_COMPLETE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "templateCode": "KRDS_WORKFLOW",
        "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-task-context\"]",
            "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "TASK_CONTEXT",
            "highlightStyle": "neutral",
            "id": "TASK_CONTEXT",
            "label": "업무 문맥·진행 상태",
            "placement": "top",
            "title": "업무 문맥·진행 상태"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-search-filter\"]",
            "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SEARCH_FILTER",
            "highlightStyle": "neutral",
            "id": "SEARCH_FILTER",
            "label": "검색·필터",
            "placement": "top",
            "title": "검색·필터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-workspace\"]",
            "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "WORKSPACE",
            "highlightStyle": "neutral",
            "id": "WORKSPACE",
            "label": "핵심 데이터 작업공간",
            "placement": "top",
            "title": "핵심 데이터 작업공간"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-evidence-history\"]",
            "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "EVIDENCE_HISTORY",
            "highlightStyle": "neutral",
            "id": "EVIDENCE_HISTORY",
            "label": "증적·변경 이력",
            "placement": "top",
            "title": "증적·변경 이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-next-task\"]",
            "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "NEXT_TASK",
            "highlightStyle": "neutral",
            "id": "NEXT_TASK",
            "label": "다음 업무",
            "placement": "top",
            "title": "다음 업무"
          }
        ],
        "pageId": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
        "summary": "이상치·경보 관리 프로세스의 이상치·경보 관리 - 승인·확정·통지·후속업무 연결 단계에서 APPROVER 액터가 ANOMALY_ALERT_MANAGEMENT_COMPLETE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_4_COMPLETED 상태로 원자적으로 전이한다."
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
        "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "ANOMALY_ALERT_MANAGEMENT_COMPLETE",
            "idempotencyRequired": true,
            "label": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 실행",
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
          "completionRule": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
          "label": "다음 업무 진행",
          "routePath": "/generated/anomaly-alert-management/anomaly-alert-management-s4"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
            "label": "업무 정보 작성",
            "path": "/generated/anomaly-alert-management/anomaly-alert-management-s4"
          },
          {
            "code": "COMPLETE",
            "description": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "이상치·경보 관리 프로세스의 이상치·경보 관리 - 승인·확정·통지·후속업무 연결 단계에서 APPROVER 액터가 ANOMALY_ALERT_MANAGEMENT_COMPLETE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "ANOMALY_ALERT_MANAGEMENT_S4",
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
      "pageName": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결",
      "screenType": "WORKFLOW",
      "sectionCount": 5,
      "summary": "이상치·경보 관리 프로세스의 이상치·경보 관리 - 승인·확정·통지·후속업무 연결 단계에서 APPROVER 액터가 ANOMALY_ALERT_MANAGEMENT_COMPLETE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
      "templateCode": "KRDS_WORKFLOW",
      "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-task-context\"]",
          "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "TASK_CONTEXT",
          "highlightStyle": "neutral",
          "id": "TASK_CONTEXT",
          "label": "업무 문맥·진행 상태",
          "placement": "top",
          "title": "업무 문맥·진행 상태"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-search-filter\"]",
          "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SEARCH_FILTER",
          "highlightStyle": "neutral",
          "id": "SEARCH_FILTER",
          "label": "검색·필터",
          "placement": "top",
          "title": "검색·필터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-workspace\"]",
          "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "WORKSPACE",
          "highlightStyle": "neutral",
          "id": "WORKSPACE",
          "label": "핵심 데이터 작업공간",
          "placement": "top",
          "title": "핵심 데이터 작업공간"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-evidence-history\"]",
          "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "EVIDENCE_HISTORY",
          "highlightStyle": "neutral",
          "id": "EVIDENCE_HISTORY",
          "label": "증적·변경 이력",
          "placement": "top",
          "title": "증적·변경 이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-anomaly-alert-management-anomaly-alert-management-s4-user-next-task\"]",
          "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "NEXT_TASK",
          "highlightStyle": "neutral",
          "id": "NEXT_TASK",
          "label": "다음 업무",
          "placement": "top",
          "title": "다음 업무"
        }
      ],
      "pageId": "ANOMALY_ALERT_MANAGEMENT_ANOMALY_ALERT_MANAGEMENT_S4_USER",
      "summary": "이상치·경보 관리 프로세스의 이상치·경보 관리 - 승인·확정·통지·후속업무 연결 단계에서 APPROVER 액터가 ANOMALY_ALERT_MANAGEMENT_COMPLETE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
      "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_4_COMPLETED 상태로 원자적으로 전이한다."
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
      "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "ANOMALY_ALERT_MANAGEMENT_COMPLETE",
          "idempotencyRequired": true,
          "label": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 실행",
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
        "completionRule": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "label": "다음 업무 진행",
        "routePath": "/generated/anomaly-alert-management/anomaly-alert-management-s4"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
          "label": "업무 정보 작성",
          "path": "/generated/anomaly-alert-management/anomaly-alert-management-s4"
        },
        {
          "code": "COMPLETE",
          "description": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "이상치·경보 관리 프로세스의 이상치·경보 관리 - 승인·확정·통지·후속업무 연결 단계에서 APPROVER 액터가 ANOMALY_ALERT_MANAGEMENT_COMPLETE 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
      "title": "이상치·경보 관리 - 승인·확정·통지·후속업무 연결 업무 길잡이"
    }
  },
  "templateCode": "KRDS_WORKFLOW",
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
