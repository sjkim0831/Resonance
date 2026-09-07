import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_data_quality_monitoring_data_quality_monitoring_s3_admin = {
  "actorCode": "VERIFIER",
  "audience": "ADMIN",
  "blueprintCode": "BP_AUTO_0B8920632E9F92F08E4FAFEE",
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
  "designHash": "8f19d7f230fc8a589005b3236ae898ece3dd899355f76adb19bff5aebff7887c",
  "id": "data-quality-monitoring-data-quality-monitoring-s3-admin",
  "pageId": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
  "pageName": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리",
  "processCode": "DATA_QUALITY_MONITORING",
  "routePath": "/admin/generated/data-quality-monitoring/data-quality-monitoring-s3",
  "screenCoordinate": {
    "actor": "VERIFIER",
    "device": "ADAPTIVE",
    "domain": "DATA",
    "locale": "MULTI",
    "policy": "VERIFIER:DEFAULT",
    "process": "DATA_QUALITY_MONITORING",
    "state": "STEP_2_COMPLETED",
    "step": "DATA_QUALITY_MONITORING_S3",
    "variant": "KRDS_ADMIN",
    "view": "ADMIN"
  },
  "screenCoordinateKey": "DATA::DATA_QUALITY_MONITORING::DATA_QUALITY_MONITORING_S3::STEP_2_COMPLETED::VERIFIER::VERIFIER%3ADEFAULT::ADMIN::ADAPTIVE::MULTI::KRDS_ADMIN",
  "screenType": "ADMIN",
  "specification": {
    "accessibility": "KRDS와 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약·필드 연결, 비색상 상태 표현과 표 머리글 연결을 보장한다.",
    "actions": [
      {
        "code": "DATA_QUALITY_MONITORING_REVIEW",
        "idempotencyRequired": true,
        "label": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 실행",
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
        "code": "DATA_QUALITY_MONITORING_REVIEW",
        "method": "POST",
        "path": "/home/api/process-executions/{executionId}/commands",
        "purpose": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 상태 명령 실행"
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
    "businessPurpose": "데이터 품질 모니터링 프로세스의 데이터 품질 모니터링 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 DATA_QUALITY_MONITORING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
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
          "from": "STEP_2_COMPLETED",
          "to": "STEP_3_COMPLETED"
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
      "다음 프로세스 시작 조건을 충족한다: 요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다. 현재 상태는 STEP_2_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다."
    ],
    "errors": [],
    "exitConditions": [
      "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_3_COMPLETED 상태로 원자적으로 전이한다."
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
        "fieldGroup": "공통",
        "fieldName": "테넌트",
        "fieldOrder": 10,
        "mappingStatus": "CONTEXT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
        "sourceColumn": null,
        "sourceTable": null,
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
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
        "sourceColumn": null,
        "sourceTable": null,
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
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "audience": "ADMIN",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": false,
        "evidenceRequired": false,
        "fieldCode": "updatedAt",
        "fieldGroup": "공통",
        "fieldName": "최종 수정 일시",
        "fieldOrder": 100,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "min": 0
        }
      },
      {
        "apiProperty": "metricCode",
        "audience": "ADMIN",
        "controlType": "METRIC_SELECT",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "metricCode",
        "fieldGroup": "MONITORING",
        "fieldName": "지표",
        "fieldOrder": 200,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "audience": "ADMIN",
        "controlType": "DIMENSION_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "dimensionKey",
        "fieldGroup": "MONITORING",
        "fieldName": "분석 차원",
        "fieldOrder": 210,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "audience": "ADMIN",
        "controlType": "DATETIME",
        "dataType": "DATETIME",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "observedAt",
        "fieldGroup": "MONITORING",
        "fieldName": "관측 시각",
        "fieldOrder": 220,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "audience": "ADMIN",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "observedValue",
        "fieldGroup": "MONITORING",
        "fieldName": "관측값",
        "fieldOrder": 230,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": true,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "audience": "ADMIN",
        "controlType": "NUMBER",
        "dataType": "DECIMAL",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "thresholdValue",
        "fieldGroup": "MONITORING",
        "fieldName": "임계값",
        "fieldOrder": 240,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "audience": "ADMIN",
        "controlType": "ALERT_BADGE",
        "dataType": "CODE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "anomalyStatus",
        "fieldGroup": "MONITORING",
        "fieldName": "이상치 상태",
        "fieldOrder": 250,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "apiProperty": "keyword",
        "audience": "ADMIN",
        "controlType": "SEARCH",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "keyword",
        "fieldGroup": "업무 처리",
        "fieldName": "검색어",
        "fieldOrder": 400,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "apiProperty": "statusFilter",
        "audience": "ADMIN",
        "controlType": "STATUS_MULTI_SELECT",
        "dataType": "ARRAY",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "statusFilter",
        "fieldGroup": "업무 처리",
        "fieldName": "상태 필터",
        "fieldOrder": 410,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "apiProperty": "dateFrom",
        "audience": "ADMIN",
        "controlType": "DATE",
        "dataType": "DATE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "dateFrom",
        "fieldGroup": "업무 처리",
        "fieldName": "조회 시작일",
        "fieldOrder": 420,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "dateTo",
        "audience": "ADMIN",
        "controlType": "DATE",
        "dataType": "DATE",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "dateTo",
        "fieldGroup": "업무 처리",
        "fieldName": "조회 종료일",
        "fieldOrder": 430,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
        "sourceColumn": null,
        "sourceTable": null,
        "validation": {
          "nullable": true,
          "required": false,
          "type": "date-time"
        }
      },
      {
        "apiProperty": "sortContract",
        "audience": "ADMIN",
        "controlType": "SORT_SELECT",
        "dataType": "STRING",
        "editable": true,
        "evidenceRequired": false,
        "fieldCode": "sortContract",
        "fieldGroup": "업무 처리",
        "fieldName": "정렬",
        "fieldOrder": 440,
        "mappingStatus": "LOGICAL_CONTRACT",
        "pageCode": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "permissionCode": "VERIFIER:ADMIN",
        "privacyClass": "INTERNAL",
        "required": false,
        "route": "/admin/planned/monitoring/data-quality-monitoring/data-quality-monitoring-s3",
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
        "label": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 완료율",
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
        "fieldCount": 22,
        "pageName": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리",
        "screenType": "ADMIN",
        "sectionCount": 5,
        "summary": "데이터 품질 모니터링 프로세스의 데이터 품질 모니터링 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 DATA_QUALITY_MONITORING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "templateCode": "KRDS_ADMIN",
        "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리"
      },
      "help": {
        "items": [
          {
            "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-task-context\"]",
            "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "TASK_CONTEXT",
            "highlightStyle": "neutral",
            "id": "TASK_CONTEXT",
            "label": "업무 문맥·진행 상태",
            "placement": "top",
            "title": "업무 문맥·진행 상태"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-search-filter\"]",
            "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "SEARCH_FILTER",
            "highlightStyle": "neutral",
            "id": "SEARCH_FILTER",
            "label": "검색·필터",
            "placement": "top",
            "title": "검색·필터"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-workspace\"]",
            "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "WORKSPACE",
            "highlightStyle": "neutral",
            "id": "WORKSPACE",
            "label": "핵심 데이터 작업공간",
            "placement": "top",
            "title": "핵심 데이터 작업공간"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-evidence-history\"]",
            "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "EVIDENCE_HISTORY",
            "highlightStyle": "neutral",
            "id": "EVIDENCE_HISTORY",
            "label": "증적·변경 이력",
            "placement": "top",
            "title": "증적·변경 이력"
          },
          {
            "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-next-task\"]",
            "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
            "code": "NEXT_TASK",
            "highlightStyle": "neutral",
            "id": "NEXT_TASK",
            "label": "다음 업무",
            "placement": "top",
            "title": "다음 업무"
          }
        ],
        "pageId": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
        "summary": "데이터 품질 모니터링 프로세스의 데이터 품질 모니터링 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 DATA_QUALITY_MONITORING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리 도움말"
      },
      "qa": {
        "acceptanceCriteria": [
          "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_3_COMPLETED 상태로 원자적으로 전이한다."
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
        "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리 QA"
      },
      "workGuide": {
        "commands": [
          {
            "code": "DATA_QUALITY_MONITORING_REVIEW",
            "idempotencyRequired": true,
            "label": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 실행",
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
          "routePath": "/admin/generated/data-quality-monitoring/data-quality-monitoring-s3"
        },
        "steps": [
          {
            "code": "ENTRY",
            "description": "다음 프로세스 시작 조건을 충족한다: 요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다. 현재 상태는 STEP_2_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
            "label": "진입 조건 확인"
          },
          {
            "code": "WORK",
            "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
            "label": "업무 정보 작성",
            "path": "/admin/generated/data-quality-monitoring/data-quality-monitoring-s3"
          },
          {
            "code": "COMPLETE",
            "description": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
            "label": "검증 후 완료"
          }
        ],
        "summary": "데이터 품질 모니터링 프로세스의 데이터 품질 모니터링 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 DATA_QUALITY_MONITORING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
        "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리 업무 길잡이"
      }
    },
    "validations": []
  },
  "stepCode": "DATA_QUALITY_MONITORING_S3",
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
      "pageName": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리",
      "screenType": "ADMIN",
      "sectionCount": 5,
      "summary": "데이터 품질 모니터링 프로세스의 데이터 품질 모니터링 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 DATA_QUALITY_MONITORING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
      "templateCode": "KRDS_ADMIN",
      "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리"
    },
    "help": {
      "items": [
        {
          "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-task-context\"]",
          "body": "업무 문맥·진행 상태 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "TASK_CONTEXT",
          "highlightStyle": "neutral",
          "id": "TASK_CONTEXT",
          "label": "업무 문맥·진행 상태",
          "placement": "top",
          "title": "업무 문맥·진행 상태"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-search-filter\"]",
          "body": "검색·필터 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "SEARCH_FILTER",
          "highlightStyle": "neutral",
          "id": "SEARCH_FILTER",
          "label": "검색·필터",
          "placement": "top",
          "title": "검색·필터"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-workspace\"]",
          "body": "핵심 데이터 작업공간 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "WORKSPACE",
          "highlightStyle": "neutral",
          "id": "WORKSPACE",
          "label": "핵심 데이터 작업공간",
          "placement": "top",
          "title": "핵심 데이터 작업공간"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-evidence-history\"]",
          "body": "증적·변경 이력 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "EVIDENCE_HISTORY",
          "highlightStyle": "neutral",
          "id": "EVIDENCE_HISTORY",
          "label": "증적·변경 이력",
          "placement": "top",
          "title": "증적·변경 이력"
        },
        {
          "anchorSelector": "[data-help-id=\"generated-data-quality-monitoring-data-quality-monitoring-s3-admin-next-task\"]",
          "body": "다음 업무 영역의 업무 정보와 처리 상태를 확인합니다.",
          "code": "NEXT_TASK",
          "highlightStyle": "neutral",
          "id": "NEXT_TASK",
          "label": "다음 업무",
          "placement": "top",
          "title": "다음 업무"
        }
      ],
      "pageId": "DATA_QUALITY_MONITORING_DATA_QUALITY_MONITORING_S3_ADMIN",
      "summary": "데이터 품질 모니터링 프로세스의 데이터 품질 모니터링 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 DATA_QUALITY_MONITORING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
      "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리 도움말"
    },
    "qa": {
      "acceptanceCriteria": [
        "다음 완료 기준을 검증한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다. 결과·버전·감사 증적을 저장한 뒤 STEP_3_COMPLETED 상태로 원자적으로 전이한다."
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
      "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리 QA"
    },
    "workGuide": {
      "commands": [
        {
          "code": "DATA_QUALITY_MONITORING_REVIEW",
          "idempotencyRequired": true,
          "label": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 실행",
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
        "routePath": "/admin/generated/data-quality-monitoring/data-quality-monitoring-s3"
      },
      "steps": [
        {
          "code": "ENTRY",
          "description": "다음 프로세스 시작 조건을 충족한다: 요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다. 현재 상태는 STEP_2_COMPLETED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.",
          "label": "진입 조건 확인"
        },
        {
          "code": "WORK",
          "description": "업무 문맥·진행 상태 · 검색·필터 · 핵심 데이터 작업공간 · 증적·변경 이력 · 다음 업무",
          "label": "업무 정보 작성",
          "path": "/admin/generated/data-quality-monitoring/data-quality-monitoring-s3"
        },
        {
          "code": "COMPLETE",
          "description": "필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
          "label": "검증 후 완료"
        }
      ],
      "summary": "데이터 품질 모니터링 프로세스의 데이터 품질 모니터링 - 독립 검토·보완·권한 검증 단계에서 VERIFIER 액터가 DATA_QUALITY_MONITORING_REVIEW 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: 필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.",
      "title": "데이터 품질 모니터링 - 독립 검토·보완·권한 검증 관리 업무 길잡이"
    }
  },
  "templateCode": "KRDS_ADMIN",
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
