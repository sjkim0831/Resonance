import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_ba38af707f870bf8576f = {
  "id": "auto-ba38af707f870bf8576f",
  "blueprintCode": "BP_ORGANIZATIONAL_BOUNDARY_ORGANIZATIONAL_BOUNDARY_S1_USER",
  "processCode": "ORGANIZATIONAL_BOUNDARY",
  "stepCode": "ORGANIZATIONAL_BOUNDARY_S1",
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "pageId": "AUTO_BA38AF707F870BF8576F",
  "pageName": "법인·사업장·소유구조 수집 사용자 업무 화면",
  "routePath": "/emission/organizational-boundary",
  "screenType": "UPLOAD",
  "templateCode": "KRDS_UPLOAD",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "법인·사업장·소유구조 수집 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.",
    "actorResponsibilities": [
      "COMPANY_MANAGER 액터가 권한·업무분리 정책에 따라 법인·사업장·소유구조 수집 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "READY 상태이며 회사 담당자가 해당 테넌트와 프로젝트에 배정되어 있다."
    ],
    "exitConditions": [
      "법인·사업장·소유구조 수집의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다."
    ],
    "states": [
      "READY",
      "LOADING",
      "EMPTY",
      "SAVING",
      "ERROR",
      "FORBIDDEN",
      "CONFLICT",
      "RECOVERY",
      "STEP_1_COMPLETED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "includedEntityCount"
      },
      {
        "code": "KPI_2",
        "label": "excludedEntityCount"
      },
      {
        "code": "KPI_3",
        "label": "grossEmission"
      },
      {
        "code": "KPI_4",
        "label": "eliminatedEmission"
      },
      {
        "code": "KPI_5",
        "label": "netEmission"
      },
      {
        "code": "KPI_6",
        "label": "reconciliationDifference"
      }
    ],
    "sections": [
      {
        "code": "SECTION_1",
        "label": "processStage"
      },
      {
        "code": "SECTION_2",
        "label": "boundaryPolicy"
      },
      {
        "code": "SECTION_3",
        "label": "entityRegister"
      },
      {
        "code": "SECTION_4",
        "label": "inclusionDecision"
      },
      {
        "code": "SECTION_5",
        "label": "eliminationLedger"
      },
      {
        "code": "SECTION_6",
        "label": "consolidationResult"
      },
      {
        "code": "SECTION_7",
        "label": "approvalAndVersion"
      },
      {
        "code": "SECTION_8",
        "label": "auditAndHandoff"
      }
    ],
    "fields": [
      {
        "name": "테넌트 ID",
        "source": "emission_organizational_boundary.tenant_id",
        "editable": false,
        "required": true,
        "fieldCode": "tenantId",
        "apiProperty": "tenantId"
      },
      {
        "name": "프로젝트 ID",
        "source": "emission_organizational_boundary.project_id",
        "editable": false,
        "required": true,
        "fieldCode": "projectId",
        "apiProperty": "project.id"
      },
      {
        "name": "경계 버전",
        "source": "emission_organizational_boundary.version_no",
        "editable": false,
        "required": true,
        "fieldCode": "version",
        "apiProperty": "versions[].version"
      },
      {
        "name": "연결 접근법",
        "source": "emission_organizational_boundary.boundary_method",
        "editable": true,
        "required": true,
        "fieldCode": "boundaryMethod",
        "apiProperty": "versions[].boundaryMethod"
      },
      {
        "name": "보고 기준",
        "source": "emission_organizational_boundary.reporting_basis",
        "editable": true,
        "required": true,
        "fieldCode": "reportingBasis",
        "apiProperty": "versions[].reportingBasis"
      },
      {
        "name": "선정 근거",
        "source": "emission_organizational_boundary.rationale",
        "editable": true,
        "required": true,
        "fieldCode": "rationale",
        "apiProperty": "versions[].rationale"
      },
      {
        "name": "적용 시작일",
        "source": "emission_organizational_boundary.effective_from",
        "editable": true,
        "required": true,
        "fieldCode": "effectiveFrom",
        "apiProperty": "versions[].effectiveFrom"
      },
      {
        "name": "적용 종료일",
        "source": "emission_organizational_boundary.effective_until",
        "editable": true,
        "required": false,
        "fieldCode": "effectiveUntil",
        "apiProperty": "versions[].effectiveUntil"
      },
      {
        "name": "경계 상태",
        "source": "emission_organizational_boundary.boundary_status",
        "editable": false,
        "required": true,
        "fieldCode": "status",
        "apiProperty": "versions[].status"
      },
      {
        "name": "동시성 버전",
        "source": "emission_organizational_boundary.row_version",
        "editable": false,
        "required": true,
        "fieldCode": "rowVersion",
        "apiProperty": "versions[].rowVersion"
      },
      {
        "name": "법인·사업장 코드",
        "source": "emission_organizational_boundary_member.entity_code",
        "editable": true,
        "required": true,
        "fieldCode": "entityCode",
        "apiProperty": "members[].entityCode"
      },
      {
        "name": "법인·사업장명",
        "source": "emission_organizational_boundary_member.entity_name",
        "editable": true,
        "required": true,
        "fieldCode": "entityName",
        "apiProperty": "members[].entityName"
      },
      {
        "name": "조직 유형",
        "source": "emission_organizational_boundary_member.entity_type",
        "editable": true,
        "required": true,
        "fieldCode": "entityType",
        "apiProperty": "members[].entityType"
      },
      {
        "name": "국가 코드",
        "source": "emission_organizational_boundary_member.country_code",
        "editable": true,
        "required": true,
        "fieldCode": "countryCode",
        "apiProperty": "members[].countryCode"
      },
      {
        "name": "지분율",
        "source": "emission_organizational_boundary_member.ownership_percent",
        "editable": true,
        "required": true,
        "fieldCode": "ownershipPercent",
        "apiProperty": "members[].ownershipPercent"
      },
      {
        "name": "통제 유형",
        "source": "emission_organizational_boundary_member.control_type",
        "editable": true,
        "required": true,
        "fieldCode": "controlType",
        "apiProperty": "members[].controlType"
      },
      {
        "name": "경계 포함 여부",
        "source": "emission_organizational_boundary_member.included_yn",
        "editable": true,
        "required": true,
        "fieldCode": "includedYn",
        "apiProperty": "members[].includedYn"
      },
      {
        "name": "제외 사유",
        "source": "emission_organizational_boundary_member.exclusion_reason",
        "editable": true,
        "required": false,
        "fieldCode": "exclusionReason",
        "apiProperty": "members[].exclusionReason"
      },
      {
        "name": "경계 판정 증빙",
        "source": "emission_organizational_boundary_member.evidence_ref",
        "editable": true,
        "required": false,
        "fieldCode": "memberEvidenceRef",
        "apiProperty": "members[].evidenceRef"
      },
      {
        "name": "발생 법인",
        "source": "emission_organizational_boundary_elimination.source_entity_code",
        "editable": true,
        "required": true,
        "fieldCode": "sourceEntityCode",
        "apiProperty": "eliminations[].sourceEntityCode"
      },
      {
        "name": "상대 법인",
        "source": "emission_organizational_boundary_elimination.counterparty_entity_code",
        "editable": true,
        "required": true,
        "fieldCode": "counterpartyEntityCode",
        "apiProperty": "eliminations[].counterpartyEntityCode"
      },
      {
        "name": "활동 구분",
        "source": "emission_organizational_boundary_elimination.activity_category",
        "editable": true,
        "required": true,
        "fieldCode": "activityCategory",
        "apiProperty": "eliminations[].activityCategory"
      },
      {
        "name": "거래 총 배출량",
        "source": "emission_organizational_boundary_elimination.gross_emission",
        "editable": true,
        "required": true,
        "fieldCode": "grossEmission",
        "apiProperty": "eliminations[].grossEmission"
      },
      {
        "name": "제거 배출량",
        "source": "emission_organizational_boundary_elimination.eliminated_emission",
        "editable": true,
        "required": true,
        "fieldCode": "eliminatedEmission",
        "apiProperty": "eliminations[].eliminatedEmission"
      },
      {
        "name": "배출량 단위",
        "source": "emission_organizational_boundary_elimination.unit",
        "editable": true,
        "required": true,
        "fieldCode": "unit",
        "apiProperty": "eliminations[].unit"
      },
      {
        "name": "내부거래 증빙",
        "source": "emission_organizational_boundary_elimination.evidence_ref",
        "editable": true,
        "required": true,
        "fieldCode": "eliminationEvidenceRef",
        "apiProperty": "eliminations[].evidenceRef"
      },
      {
        "name": "총 배출량",
        "source": "emission_organizational_boundary_consolidation.gross_emission",
        "editable": true,
        "required": true,
        "fieldCode": "totalGrossEmission",
        "apiProperty": "consolidations[].grossEmission"
      },
      {
        "name": "총 제거량",
        "source": "emission_organizational_boundary_consolidation.eliminated_emission",
        "editable": false,
        "required": true,
        "fieldCode": "totalEliminatedEmission",
        "apiProperty": "consolidations[].eliminatedEmission"
      },
      {
        "name": "순 배출량",
        "source": "emission_organizational_boundary_consolidation.net_emission",
        "editable": false,
        "required": true,
        "fieldCode": "netEmission",
        "apiProperty": "consolidations[].netEmission"
      },
      {
        "name": "조정 차이",
        "source": "emission_organizational_boundary_consolidation.reconciliation_difference",
        "editable": false,
        "required": true,
        "fieldCode": "reconciliationDifference",
        "apiProperty": "consolidations[].reconciliationDifference"
      },
      {
        "name": "계산 해시",
        "source": "emission_organizational_boundary_consolidation.calculation_hash",
        "editable": false,
        "required": true,
        "fieldCode": "calculationHash",
        "apiProperty": "consolidations[].calculationHash"
      },
      {
        "name": "승인자",
        "source": "emission_organizational_boundary.approved_by",
        "editable": false,
        "required": false,
        "fieldCode": "approvedBy",
        "apiProperty": "versions[].approvedBy"
      },
      {
        "name": "승인 시각",
        "source": "emission_organizational_boundary.approved_at",
        "editable": false,
        "required": false,
        "fieldCode": "approvedAt",
        "apiProperty": "versions[].approvedAt"
      },
      {
        "name": "프로세스 실행 ID",
        "source": "framework_process_execution.execution_id",
        "editable": false,
        "required": false,
        "fieldCode": "executionId",
        "apiProperty": "execution.executionId"
      },
      {
        "name": "현재 업무 단계",
        "source": "framework_process_execution.current_step_code",
        "editable": false,
        "required": false,
        "fieldCode": "currentStepCode",
        "apiProperty": "execution.currentStepCode"
      },
      {
        "name": "현재 업무 상태",
        "source": "framework_process_execution.current_state",
        "editable": false,
        "required": false,
        "fieldCode": "currentState",
        "apiProperty": "execution.currentState"
      },
      {
        "name": "감사 이벤트 ID",
        "source": "framework_process_execution_event.event_id",
        "editable": false,
        "required": false,
        "fieldCode": "eventId",
        "apiProperty": "events[].eventId"
      },
      {
        "name": "업무 명령",
        "source": "framework_process_execution_event.command_code",
        "editable": false,
        "required": false,
        "fieldCode": "eventCommand",
        "apiProperty": "events[].commandCode"
      },
      {
        "name": "인계 알림 ID",
        "source": "emission_workflow_notification.notification_id",
        "editable": false,
        "required": false,
        "fieldCode": "notificationId",
        "apiProperty": "notifications[].id"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "saveVersionedDraft"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{id}/organizational-boundary"
      },
      {
        "code": "API_2",
        "label": "PUT /home/api/emission-projects/{id}/organizational-boundary"
      }
    ],
    "dataContracts": [
      {
        "entities": [
          "emission_organizational_boundary",
          "emission_organizational_boundary_member",
          "emission_organizational_boundary_elimination",
          "emission_organizational_boundary_consolidation",
          "framework_process_execution",
          "framework_process_execution_event",
          "emission_workflow_notification"
        ],
        "tenantScoped": true,
        "projectScoped": true,
        "optimisticVersion": "row_version"
      }
    ],
    "permissions": [
      {
        "code": "COMPANY_MANAGER",
        "scope": "TENANT_PROJECT",
        "segregationOfDuties": true,
        "serverAuthorization": true
      }
    ],
    "validations": [
      {
        "code": "ENTRY_AND_REQUIRED_FIELDS",
        "type": "CONTRACT"
      },
      {
        "code": "STATE_AND_VERSION",
        "type": "CONCURRENCY"
      }
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
    "responsive": {
      "mobile": "single-column-actions-bottom",
      "tablet": "adaptive-grid",
      "desktop": "list-detail-workspace"
    },
    "accessibility": {
      "labels": true,
      "keyboard": true,
      "standard": "WCAG_2_1_AA",
      "nonColorStatus": true,
      "focusManagement": true
    },
    "completionRule": "법인·사업장·소유구조 수집의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.",
    "extensions": {
      "contractId": 511,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 511,
    "requirementIds": [
      "ORGANIZATIONAL_BOUNDARY:ORGANIZATIONAL_BOUNDARY_S1:USER"
    ],
    "generationBatchId": 80,
    "designReadinessScore": 100,
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ]
  },
  "designCompleteness": {
    "score": 100,
    "checks": {
      "purpose": true,
      "actor": true,
      "entry": true,
      "exit": true,
      "sections": true,
      "fields": true,
      "actions": true,
      "api": true,
      "data": true,
      "permissions": true,
      "validations": true,
      "states": true,
      "errors": true,
      "responsive": true,
      "accessibility": true,
      "tests": true
    },
    "complete": true
  }
} as const satisfies GeneratedScreenDefinition;
