import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_3d38341c35fd46d6bccd = {
  "id": "auto-3d38341c35fd46d6bccd",
  "blueprintCode": "BP_AUTO_3D38341C35FD46D6BCCD9528",
  "processCode": "GOVERNANCE_CHANGE",
  "stepCode": "GOV_REQUEST",
  "actorCode": "PLATFORM_OPERATOR",
  "audience": "ADMIN",
  "pageId": "AUTO_3D38341C35FD46D6BCCD",
  "pageName": "콘텐츠·교육·지원 운영 통합 작업공간",
  "routePath": "/admin/system/process-workspace",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "선택한 업무 프로세스의 목표, 액터, 상태 전이, 연결 화면, 테스트, 개발 작업과 설계 차단을 하나의 관제 화면에서 추적한다.",
    "actorResponsibilities": [
      "PLATFORM_OPERATOR 액터가 권한·업무분리 정책에 따라 콘텐츠·교육·지원 운영 통합 작업공간 업무를 수행한다."
    ],
    "entryConditions": [
      "관리자 인증과 프로세스 조회 권한이 있고 process 파라미터가 유효한 활성 프로세스를 가리킨다."
    ],
    "exitConditions": [
      "각 단계의 실제 업무 화면·완료 기준·독립 테스트·개발 증빙을 확인하고 차단 항목의 다음 작업을 결정한다."
    ],
    "states": [
      "LOADING",
      "READY",
      "EMPTY",
      "DESIGN_BLOCKED",
      "IMPLEMENTATION_PENDING",
      "IMPLEMENTATION_VERIFIED",
      "ERROR",
      "FORBIDDEN",
      "SESSION_EXPIRED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "프로세스 단계 연결률 100%"
      },
      {
        "code": "KPI_2",
        "label": "필수 액터 연결률 100%"
      },
      {
        "code": "KPI_3",
        "label": "안전 테스트 유형 5종 이상"
      },
      {
        "code": "KPI_4",
        "label": "설계 차단 0건"
      },
      {
        "code": "KPI_5",
        "label": "필수 개발 작업 검증률 100%"
      }
    ],
    "sections": [
      {
        "id": "process-context",
        "purpose": "목표·버전·책임 액터·SLA"
      },
      {
        "id": "control-summary",
        "purpose": "시작·완료·위험·검토 기준"
      },
      {
        "id": "step-flow",
        "purpose": "상태 전이와 실제 업무 화면"
      },
      {
        "id": "test-cases",
        "purpose": "독립 테스트와 기대 결과"
      },
      {
        "id": "development-jobs",
        "purpose": "프론트·백엔드·DB·테스트 구현 현황"
      },
      {
        "id": "assurance",
        "purpose": "누락·차단·다음 작업"
      }
    ],
    "fields": [
      {
        "source": "framework_process_definition.process_code",
        "required": true,
        "fieldCode": "processCode",
        "apiProperty": "processes[].processCode"
      },
      {
        "source": "framework_process_definition.process_name",
        "required": true,
        "fieldCode": "processName",
        "apiProperty": "processes[].processName"
      },
      {
        "source": "framework_process_definition.domain_code",
        "required": true,
        "fieldCode": "domainCode",
        "apiProperty": "processes[].domainCode"
      },
      {
        "source": "framework_process_definition.process_version",
        "required": true,
        "fieldCode": "processVersion",
        "apiProperty": "processes[].version"
      },
      {
        "source": "framework_process_definition.goal",
        "required": true,
        "fieldCode": "processGoal",
        "apiProperty": "processes[].goal"
      },
      {
        "source": "framework_process_definition.start_condition",
        "required": true,
        "fieldCode": "startCondition",
        "apiProperty": "processes[].startCondition"
      },
      {
        "source": "framework_process_definition.completion_condition",
        "required": true,
        "fieldCode": "completionCondition",
        "apiProperty": "processes[].completionCondition"
      },
      {
        "source": "framework_process_definition.owner_actor_code",
        "required": true,
        "fieldCode": "ownerActorCode",
        "apiProperty": "processes[].ownerActorCode"
      },
      {
        "source": "framework_process_definition.risk_level",
        "required": true,
        "fieldCode": "riskLevel",
        "apiProperty": "processes[].riskLevel"
      },
      {
        "source": "framework_process_definition.sla_hours",
        "required": false,
        "fieldCode": "slaHours",
        "apiProperty": "processes[].slaHours"
      },
      {
        "source": "framework_process_definition.review_cycle_days",
        "required": false,
        "fieldCode": "reviewCycleDays",
        "apiProperty": "processes[].reviewCycleDays"
      },
      {
        "source": "framework_process_definition.process_status",
        "required": true,
        "fieldCode": "processStatus",
        "apiProperty": "processes[].status"
      },
      {
        "source": "framework_process_definition.lifecycle_status",
        "required": true,
        "fieldCode": "lifecycleStatus",
        "apiProperty": "processes[].lifecycleStatus"
      },
      {
        "source": "framework_process_step.step_order",
        "required": true,
        "fieldCode": "stepOrder",
        "apiProperty": "steps[].stepOrder"
      },
      {
        "source": "framework_process_step.step_code",
        "required": true,
        "fieldCode": "stepCode",
        "apiProperty": "steps[].stepCode"
      },
      {
        "source": "framework_process_step.step_name",
        "required": true,
        "fieldCode": "stepName",
        "apiProperty": "steps[].stepName"
      },
      {
        "source": "framework_process_step.actor_code",
        "required": true,
        "fieldCode": "stepActorCode",
        "apiProperty": "steps[].actorCode"
      },
      {
        "source": "framework_process_step.from_state",
        "required": true,
        "fieldCode": "fromState",
        "apiProperty": "steps[].fromState"
      },
      {
        "source": "framework_process_step.command_code",
        "required": true,
        "fieldCode": "commandCode",
        "apiProperty": "steps[].commandCode"
      },
      {
        "source": "framework_process_step.to_state",
        "required": true,
        "fieldCode": "toState",
        "apiProperty": "steps[].toState"
      },
      {
        "source": "framework_process_step.completion_rule",
        "required": true,
        "fieldCode": "completionRule",
        "apiProperty": "steps[].completionRule"
      },
      {
        "source": "framework_process_step.requirement_text",
        "required": true,
        "fieldCode": "requirementText",
        "apiProperty": "steps[].requirementText"
      },
      {
        "source": "framework_process_step.input_contract",
        "required": true,
        "fieldCode": "inputContract",
        "apiProperty": "steps[].inputContract"
      },
      {
        "source": "framework_process_step.output_contract",
        "required": true,
        "fieldCode": "outputContract",
        "apiProperty": "steps[].outputContract"
      },
      {
        "source": "framework_process_step.user_path",
        "required": false,
        "fieldCode": "userPath",
        "apiProperty": "steps[].userPath"
      },
      {
        "source": "framework_process_step.admin_path",
        "required": false,
        "fieldCode": "adminPath",
        "apiProperty": "steps[].adminPath"
      },
      {
        "source": "framework_process_step.api_contract",
        "required": false,
        "fieldCode": "apiContract",
        "apiProperty": "steps[].apiContract"
      },
      {
        "source": "framework_process_step.automation_status",
        "required": true,
        "fieldCode": "automationStatus",
        "apiProperty": "steps[].automationStatus"
      },
      {
        "source": "framework_simulation_case.case_code",
        "required": true,
        "fieldCode": "caseCode",
        "apiProperty": "cases[].caseCode"
      },
      {
        "source": "framework_simulation_case.case_name",
        "required": true,
        "fieldCode": "caseName",
        "apiProperty": "cases[].caseName"
      },
      {
        "source": "framework_simulation_case.case_type",
        "required": true,
        "fieldCode": "caseType",
        "apiProperty": "cases[].caseType"
      },
      {
        "source": "framework_simulation_case.case_status",
        "required": true,
        "fieldCode": "caseStatus",
        "apiProperty": "cases[].status"
      },
      {
        "source": "framework_simulation_case.assertions_json",
        "required": true,
        "fieldCode": "caseAssertions",
        "apiProperty": "cases[].assertionsJson"
      },
      {
        "source": "framework_development_job.job_id",
        "required": true,
        "fieldCode": "jobId",
        "apiProperty": "developmentJobs[].jobId"
      },
      {
        "source": "framework_development_job.job_type",
        "required": true,
        "fieldCode": "jobType",
        "apiProperty": "developmentJobs[].jobType"
      },
      {
        "source": "framework_development_job.job_name",
        "required": true,
        "fieldCode": "jobName",
        "apiProperty": "developmentJobs[].jobName"
      },
      {
        "source": "framework_development_job.target_path",
        "required": false,
        "fieldCode": "targetPath",
        "apiProperty": "developmentJobs[].targetPath"
      },
      {
        "source": "framework_development_job.job_status",
        "required": true,
        "fieldCode": "jobStatus",
        "apiProperty": "developmentJobs[].jobStatus"
      },
      {
        "source": "framework_development_job.quality_status",
        "required": true,
        "fieldCode": "qualityStatus",
        "apiProperty": "developmentJobs[].qualityStatus"
      },
      {
        "source": "framework_development_job.evidence_ref",
        "required": false,
        "fieldCode": "jobEvidenceRef",
        "apiProperty": "developmentJobs[].evidenceRef"
      },
      {
        "source": "framework_process_development_progress.required_jobs",
        "required": true,
        "fieldCode": "requiredJobs",
        "apiProperty": "processDevelopmentProgress[].requiredJobs"
      },
      {
        "source": "framework_process_development_progress.verified_jobs",
        "required": true,
        "fieldCode": "verifiedJobs",
        "apiProperty": "processDevelopmentProgress[].verifiedJobs"
      },
      {
        "source": "framework_process_development_progress.failed_jobs",
        "required": true,
        "fieldCode": "failedJobs",
        "apiProperty": "processDevelopmentProgress[].failedJobs"
      },
      {
        "source": "framework_process_development_progress.completion_percent",
        "required": true,
        "fieldCode": "completionPercent",
        "apiProperty": "processDevelopmentProgress[].completionPercent"
      },
      {
        "source": "framework_process_design_assurance_matrix.assurance_status",
        "required": true,
        "fieldCode": "assuranceStatus",
        "apiProperty": "designAssurance[].assuranceStatus"
      },
      {
        "source": "framework_process_design_assurance_matrix.design_accuracy_score",
        "required": true,
        "fieldCode": "designAccuracyScore",
        "apiProperty": "designAssurance[].designAccuracyScore"
      },
      {
        "source": "framework_process_design_assurance_matrix.design_blocker_count",
        "required": true,
        "fieldCode": "designBlockerCount",
        "apiProperty": "designAssurance[].designBlockerCount"
      },
      {
        "source": "framework_process_design_assurance_matrix.missing_actor_binding_count",
        "required": true,
        "fieldCode": "actorContractGaps",
        "apiProperty": "designAssurance[].actorContractGaps"
      },
      {
        "source": "framework_process_design_assurance_matrix.incomplete_transition_count",
        "required": true,
        "fieldCode": "stateFlowGaps",
        "apiProperty": "designAssurance[].stateFlowGaps"
      },
      {
        "source": "framework_process_design_assurance_matrix.incomplete_data_contract_count",
        "required": true,
        "fieldCode": "dataContractGaps",
        "apiProperty": "designAssurance[].dataContractGaps"
      },
      {
        "source": "framework_process_design_assurance_matrix.missing_user_route_count",
        "required": true,
        "fieldCode": "routeGaps",
        "apiProperty": "designAssurance[].routeGaps"
      },
      {
        "source": "framework_process_design_assurance_matrix.missing_api_contract_count",
        "required": true,
        "fieldCode": "apiContractGaps",
        "apiProperty": "designAssurance[].apiContractGaps"
      },
      {
        "source": "framework_process_design_assurance_matrix.approved_safety_test_type_count",
        "required": true,
        "fieldCode": "approvedSafetyTestTypeCount",
        "apiProperty": "designAssurance[].approvedSafetyTestTypeCount"
      },
      {
        "source": "framework_process_design_assurance_matrix.next_action",
        "required": false,
        "fieldCode": "nextAction",
        "apiProperty": "designAssurance[].nextAction"
      }
    ],
    "actions": [
      {
        "code": "SELECT_PROCESS",
        "effect": "query-scoped orchestration view"
      },
      {
        "code": "OPEN_STEP_SCREEN",
        "guard": "active route + actor binding"
      },
      {
        "code": "OPEN_DESIGN_TEST_DETAIL",
        "target": "/admin/system/actor-process"
      },
      {
        "code": "REMEDIATE_BLOCKER",
        "guard": "design assurance nextAction"
      }
    ],
    "apiContracts": [
      {
        "path": "/admin/api/system/actor-process",
        "method": "GET",
        "response": "actors + processes + steps + cases + jobs + progress + assurance"
      }
    ],
    "dataContracts": [
      {
        "entity": "framework_process_definition",
        "version": "2.0.0",
        "versionColumn": "process_version"
      },
      {
        "entity": "framework_process_step",
        "relation": "ordered state machine"
      },
      {
        "entity": "framework_simulation_case",
        "relation": "independent expectations"
      },
      {
        "entity": "framework_development_job",
        "relation": "implementation evidence"
      },
      {
        "view": "framework_process_development_progress"
      },
      {
        "view": "framework_process_design_assurance_matrix"
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
    "completionRule": "각 단계의 실제 업무 화면·완료 기준·독립 테스트·개발 증빙을 확인하고 차단 항목의 다음 작업을 결정한다.",
    "extensions": {
      "contractId": 682,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 682,
    "requirementIds": [
      "GOVERNANCE_CHANGE:GOV_REQUEST:ADMIN"
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
