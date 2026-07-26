import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_f0b3945e4224a8a8c060 = {
  "id": "auto-f0b3945e4224a8a8c060",
  "blueprintCode": "BP_ADOPT_F0B3945E422438A88060",
  "processCode": "REGULATORY_SUBMISSION",
  "stepCode": "REGULATORY_SUBMISSION_S1",
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "pageId": "AUTO_F0B3945E4224A8A8C060",
  "pageName": "제출 범위·기한 확인",
  "routePath": "/emission/report-submission",
  "screenType": "REPORT",
  "templateCode": "KRDS_REPORT",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "확정된 배출량 보고서를 버전 고정 제출 패키지로 생성하고 규제기관 제출·접수·보완·재제출·수리까지 권한과 감사 증적으로 통제한다.",
    "actorResponsibilities": [
      "COMPANY_MANAGER 액터가 권한·업무분리 정책에 따라 제출 범위·기한 확인 업무를 수행한다."
    ],
    "entryConditions": [
      "인증 계정이 프로젝트에 배정되어 있고 역할에 맞는 명령 권한과 FINALIZED 보고서가 존재한다."
    ],
    "exitConditions": [
      "불변 패키지 해시, 접수번호, 보완 사유·기한, 상태 전이 이벤트와 최종 수리 결과가 보존된다."
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "PACKAGED",
      "SUBMITTED",
      "RECEIVED",
      "CORRECTION_REQUIRED",
      "RESUBMITTED",
      "ACCEPTED",
      "CANCELLED",
      "CONFLICT",
      "ERROR",
      "FORBIDDEN",
      "SESSION_EXPIRED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "기한 초과 제출 0건"
      },
      {
        "code": "KPI_2",
        "label": "권한 없는 상태 전이 0건"
      },
      {
        "code": "KPI_3",
        "label": "중복 패키지 0건"
      },
      {
        "code": "KPI_4",
        "label": "접수번호 없는 수리 0건"
      },
      {
        "code": "KPI_5",
        "label": "상태·감사 이벤트 일치율 100%"
      }
    ],
    "sections": [
      {
        "id": "project-context"
      },
      {
        "id": "final-report"
      },
      {
        "id": "package-create"
      },
      {
        "id": "submission-control"
      },
      {
        "id": "audit-timeline"
      }
    ],
    "fields": [
      {
        "source": "emission_project_registry.project_id",
        "required": true,
        "fieldCode": "projectId",
        "apiProperty": "project.id"
      },
      {
        "source": "emission_project_registry.project_name",
        "required": true,
        "fieldCode": "projectName",
        "apiProperty": "project.name"
      },
      {
        "source": "emission_project_registry.site_name",
        "required": true,
        "fieldCode": "siteName",
        "apiProperty": "project.site"
      },
      {
        "source": "emission_project_registry.calculation_period",
        "required": true,
        "fieldCode": "projectPeriod",
        "apiProperty": "project.period"
      },
      {
        "source": "emission_project_report.report_id",
        "required": true,
        "fieldCode": "reportId",
        "apiProperty": "eligibleReports[].id"
      },
      {
        "source": "emission_project_report.version_no",
        "required": true,
        "fieldCode": "reportVersion",
        "apiProperty": "eligibleReports[].version"
      },
      {
        "source": "emission_project_report.report_title",
        "required": true,
        "fieldCode": "reportTitle",
        "apiProperty": "eligibleReports[].title"
      },
      {
        "source": "emission_project_report.report_status",
        "required": true,
        "fieldCode": "reportStatus",
        "apiProperty": "eligibleReports[].status"
      },
      {
        "source": "emission_project_report.certificate_id",
        "required": false,
        "fieldCode": "certificateId",
        "apiProperty": "eligibleReports[].certificateId"
      },
      {
        "source": "emission_project_report.integrity_hash",
        "required": false,
        "fieldCode": "integrityHash",
        "apiProperty": "eligibleReports[].integrityHash"
      },
      {
        "source": "emission_project_report.finalized_at",
        "required": true,
        "fieldCode": "finalizedAt",
        "apiProperty": "eligibleReports[].finalizedAt"
      },
      {
        "source": "emission_regulatory_submission.regulatory_submission_id",
        "required": true,
        "fieldCode": "submissionId",
        "apiProperty": "items[].id"
      },
      {
        "source": "emission_regulatory_submission.submission_version",
        "required": true,
        "fieldCode": "submissionVersion",
        "apiProperty": "items[].version"
      },
      {
        "source": "emission_regulatory_submission.authority_code",
        "required": true,
        "fieldCode": "authorityCode",
        "apiProperty": "items[].authorityCode"
      },
      {
        "source": "emission_regulatory_submission.authority_name",
        "required": true,
        "fieldCode": "authorityName",
        "apiProperty": "items[].authorityName"
      },
      {
        "source": "emission_regulatory_submission.reporting_program",
        "required": true,
        "fieldCode": "reportingProgram",
        "apiProperty": "items[].reportingProgram"
      },
      {
        "source": "emission_regulatory_submission.reporting_period",
        "required": true,
        "fieldCode": "reportingPeriod",
        "apiProperty": "items[].reportingPeriod"
      },
      {
        "source": "emission_regulatory_submission.legal_basis",
        "required": true,
        "fieldCode": "legalBasis",
        "apiProperty": "items[].legalBasis"
      },
      {
        "source": "emission_regulatory_submission.submission_channel",
        "required": true,
        "fieldCode": "channel",
        "apiProperty": "items[].channel"
      },
      {
        "source": "emission_regulatory_submission.submission_deadline",
        "required": true,
        "fieldCode": "deadline",
        "apiProperty": "items[].deadline"
      },
      {
        "source": "emission_regulatory_submission.status",
        "required": true,
        "fieldCode": "status",
        "apiProperty": "items[].status"
      },
      {
        "source": "emission_regulatory_submission.package_hash",
        "required": true,
        "fieldCode": "packageHash",
        "apiProperty": "items[].packageHash"
      },
      {
        "source": "emission_regulatory_submission.external_receipt_no",
        "required": false,
        "fieldCode": "receiptNo",
        "apiProperty": "items[].receiptNo"
      },
      {
        "source": "emission_regulatory_submission.correction_reason",
        "required": false,
        "fieldCode": "correctionReason",
        "apiProperty": "items[].correctionReason"
      },
      {
        "source": "emission_regulatory_submission.correction_due_date",
        "required": false,
        "fieldCode": "correctionDueDate",
        "apiProperty": "items[].correctionDueDate"
      },
      {
        "source": "emission_regulatory_submission.note_text",
        "required": false,
        "fieldCode": "note",
        "apiProperty": "items[].note"
      },
      {
        "source": "emission_regulatory_submission.submitted_by",
        "required": false,
        "fieldCode": "submittedBy",
        "apiProperty": "items[].submittedBy"
      },
      {
        "source": "emission_regulatory_submission.submitted_at",
        "required": false,
        "fieldCode": "submittedAt",
        "apiProperty": "items[].submittedAt"
      },
      {
        "source": "emission_regulatory_submission.received_at",
        "required": false,
        "fieldCode": "receivedAt",
        "apiProperty": "items[].receivedAt"
      },
      {
        "source": "emission_regulatory_submission.accepted_at",
        "required": false,
        "fieldCode": "acceptedAt",
        "apiProperty": "items[].acceptedAt"
      },
      {
        "source": "emission_regulatory_submission.created_by",
        "required": true,
        "fieldCode": "createdBy",
        "apiProperty": "items[].createdBy"
      },
      {
        "source": "emission_regulatory_submission.updated_at",
        "required": true,
        "fieldCode": "updatedAt",
        "apiProperty": "items[].updatedAt"
      },
      {
        "source": "emission_regulatory_submission_event.event_id",
        "required": true,
        "fieldCode": "eventId",
        "apiProperty": "events[].id"
      },
      {
        "source": "emission_regulatory_submission_event.event_code",
        "required": true,
        "fieldCode": "eventCode",
        "apiProperty": "events[].code"
      },
      {
        "source": "emission_regulatory_submission_event.previous_status",
        "required": false,
        "fieldCode": "previousStatus",
        "apiProperty": "events[].previousStatus"
      },
      {
        "source": "emission_regulatory_submission_event.new_status",
        "required": true,
        "fieldCode": "newStatus",
        "apiProperty": "events[].newStatus"
      },
      {
        "source": "emission_regulatory_submission_event.actor_id",
        "required": true,
        "fieldCode": "eventActor",
        "apiProperty": "events[].actor"
      },
      {
        "source": "emission_regulatory_submission_event.event_note",
        "required": false,
        "fieldCode": "eventNote",
        "apiProperty": "events[].note"
      },
      {
        "source": "emission_regulatory_submission_event.created_at",
        "required": true,
        "fieldCode": "eventCreatedAt",
        "apiProperty": "events[].createdAt"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "CREATE_PACKAGE"
      },
      {
        "code": "ACTION_2",
        "label": "SUBMIT"
      },
      {
        "code": "ACTION_3",
        "label": "RECORD_RECEIPT"
      },
      {
        "code": "ACTION_4",
        "label": "REQUEST_CORRECTION"
      },
      {
        "code": "ACTION_5",
        "label": "RESUBMIT"
      },
      {
        "code": "ACTION_6",
        "label": "ACCEPT"
      },
      {
        "code": "ACTION_7",
        "label": "CANCEL"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects/{projectId}/regulatory-submissions"
      },
      {
        "code": "API_2",
        "label": "POST /home/api/emission-projects/{projectId}/regulatory-submissions"
      },
      {
        "code": "API_3",
        "label": "POST /home/api/emission-projects/{projectId}/regulatory-submissions/{submissionId}/transition"
      }
    ],
    "dataContracts": [
      {
        "entity": "emission_regulatory_submission",
        "version": "2.0.0",
        "fingerprint": "package_hash",
        "versionColumn": "submission_version"
      },
      {
        "mode": "append-only",
        "entity": "emission_regulatory_submission_event"
      },
      {
        "entity": "emission_project_report",
        "eligibility": "FINALIZED"
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
    "completionRule": "불변 패키지 해시, 접수번호, 보완 사유·기한, 상태 전이 이벤트와 최종 수리 결과가 보존된다.",
    "extensions": {
      "contractId": 260,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 260,
    "requirementIds": [
      "REGULATORY_SUBMISSION:REGULATORY_SUBMISSION_S1:USER"
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
