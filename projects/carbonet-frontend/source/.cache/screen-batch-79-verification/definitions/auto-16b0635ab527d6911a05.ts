import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_16b0635ab527d6911a05 = {
  "id": "auto-16b0635ab527d6911a05",
  "blueprintCode": "BP_ADOPT_16B0635AB52736919A05",
  "processCode": "ACTIVITY_DATA",
  "stepCode": "ACTIVITY_DATA_03_VERIFY",
  "actorCode": "VERIFIER",
  "audience": "USER",
  "pageId": "AUTO_16B0635AB527D6911A05",
  "pageName": "데이터·산정 결과 검증 사용자 업무 화면",
  "routePath": "/emission/validate",
  "screenType": "WORKFLOW",
  "templateCode": "KRDS_WORKFLOW",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "테넌트 범위의 제출 버전과 산정 결과를 독립 검증하고, 보완 요청 또는 통과 후 승인자가 결과 버전을 확정·잠금한다.",
    "actorResponsibilities": [
      "VERIFIER 액터가 권한·업무분리 정책에 따라 데이터·산정 결과 검증 사용자 업무 화면 업무를 수행한다."
    ],
    "entryConditions": [
      "제출본이 SUBMITTED 또는 IN_VERIFICATION 상태이고 프로젝트 VERIFIER 배정과 산정 결과가 존재한다."
    ],
    "exitConditions": [
      "검증 통과 또는 보완 요청, 오류 수, 의견, 검증자와 상태 이벤트가 하나의 트랜잭션으로 저장된다."
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "SUBMITTED",
      "IN_VERIFICATION",
      "VERIFIED",
      "CORRECTION_REQUIRED",
      "APPROVED",
      "SAVING",
      "SUCCESS",
      "CONFLICT",
      "ERROR",
      "FORBIDDEN",
      "SESSION_EXPIRED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "권한 없는 결정 0건"
      },
      {
        "code": "KPI_2",
        "label": "상태 전이 오류 0건"
      },
      {
        "code": "KPI_3",
        "label": "사유 없는 보완·반려 0건"
      },
      {
        "code": "KPI_4",
        "label": "승인 산정 버전 잠금률 100%"
      },
      {
        "code": "KPI_5",
        "label": "결정·이벤트 감사 일치율 100%"
      }
    ],
    "sections": [
      {
        "id": "project-context",
        "purpose": "프로젝트·사업장·액터 범위"
      },
      {
        "id": "submission-versions",
        "purpose": "제출 버전과 현재 상태 선택"
      },
      {
        "id": "decision-panel",
        "purpose": "상태·액터별 허용 명령과 필수 의견"
      },
      {
        "id": "calculation-evidence",
        "purpose": "총 배출량·입력 지문·산정 버전 검토"
      },
      {
        "id": "review-history",
        "purpose": "검증·승인 결정 이력"
      },
      {
        "id": "state-audit",
        "purpose": "이전·신규 상태와 수행자 감사"
      }
    ],
    "fields": [
      {
        "name": "프로젝트 ID",
        "source": "emission_project_registry.project_id",
        "required": true,
        "fieldCode": "projectId",
        "apiProperty": "project.id"
      },
      {
        "name": "프로젝트명",
        "source": "emission_project_registry.project_name",
        "required": true,
        "fieldCode": "projectName",
        "apiProperty": "project.name"
      },
      {
        "name": "사업장명",
        "source": "emission_project_registry.site_name",
        "required": true,
        "fieldCode": "siteName",
        "apiProperty": "project.site"
      },
      {
        "name": "제출본 ID",
        "source": "emission_activity_submission.submission_id",
        "required": true,
        "fieldCode": "submissionId",
        "apiProperty": "submissions[].id"
      },
      {
        "name": "제출 버전",
        "source": "emission_activity_submission.version_no",
        "required": true,
        "fieldCode": "submissionVersion",
        "apiProperty": "submissions[].version"
      },
      {
        "name": "제출 상태",
        "source": "emission_activity_submission.submission_state",
        "required": true,
        "fieldCode": "submissionState",
        "apiProperty": "submissions[].state"
      },
      {
        "name": "제출자",
        "source": "emission_activity_submission.submitted_actor",
        "required": true,
        "fieldCode": "submittedActor",
        "apiProperty": "submissions[].submittedActor"
      },
      {
        "name": "제출 일시",
        "source": "emission_activity_submission.submitted_at",
        "required": true,
        "fieldCode": "submittedAt",
        "apiProperty": "submissions[].submittedAt"
      },
      {
        "name": "결정",
        "source": "emission_submission_review.decision",
        "required": true,
        "fieldCode": "decision",
        "apiProperty": "command.decision"
      },
      {
        "name": "검토 의견",
        "source": "emission_submission_review.comment_text",
        "required": false,
        "fieldCode": "reviewComment",
        "apiProperty": "command.comment"
      },
      {
        "name": "오류 건수",
        "source": "emission_submission_review.issue_count",
        "required": true,
        "fieldCode": "issueCount",
        "apiProperty": "command.issueCount"
      },
      {
        "name": "검토 이력 ID",
        "source": "emission_submission_review.review_id",
        "required": true,
        "fieldCode": "reviewId",
        "apiProperty": "reviews[].id"
      },
      {
        "name": "검토 단계",
        "source": "emission_submission_review.review_stage",
        "required": true,
        "fieldCode": "reviewStage",
        "apiProperty": "reviews[].stage"
      },
      {
        "name": "검토자",
        "source": "emission_submission_review.reviewer_id",
        "required": true,
        "fieldCode": "reviewerId",
        "apiProperty": "reviews[].reviewer"
      },
      {
        "name": "결정 일시",
        "source": "emission_submission_review.created_at",
        "required": true,
        "fieldCode": "reviewCreatedAt",
        "apiProperty": "reviews[].createdAt"
      },
      {
        "name": "산정 버전 ID",
        "source": "emission_submission_review.calculation_id",
        "required": false,
        "fieldCode": "reviewCalculationId",
        "apiProperty": "reviews[].calculationId"
      },
      {
        "name": "배정 액터",
        "source": "framework_project_actor_assignment.actor_code",
        "required": true,
        "fieldCode": "actorCode",
        "apiProperty": "actors[].actorCode"
      },
      {
        "name": "배정 사용자",
        "source": "framework_project_actor_assignment.user_id",
        "required": true,
        "fieldCode": "actorUserId",
        "apiProperty": "actors[].userId"
      },
      {
        "name": "액터 활성 여부",
        "source": "framework_project_actor_assignment.active_yn",
        "required": true,
        "fieldCode": "actorActiveYn",
        "apiProperty": "actors[].activeYn"
      },
      {
        "name": "산정 실행 ID",
        "source": "emission_calculation_run.calculation_id",
        "required": true,
        "fieldCode": "calculationId",
        "apiProperty": "latestCalculation.id"
      },
      {
        "name": "산정 버전",
        "source": "emission_calculation_run.version_no",
        "required": true,
        "fieldCode": "calculationVersion",
        "apiProperty": "latestCalculation.version"
      },
      {
        "name": "총 배출량",
        "source": "emission_calculation_run.total_emission",
        "required": true,
        "fieldCode": "totalEmission",
        "apiProperty": "latestCalculation.totalEmission"
      },
      {
        "name": "입력 지문",
        "source": "emission_calculation_run.snapshot_hash",
        "required": true,
        "fieldCode": "snapshotHash",
        "apiProperty": "latestCalculation.snapshotHash"
      },
      {
        "name": "잠금 일시",
        "source": "emission_calculation_run.locked_at",
        "required": false,
        "fieldCode": "lockedAt",
        "apiProperty": "latestCalculation.lockedAt"
      },
      {
        "name": "잠금 수행자",
        "source": "emission_calculation_run.locked_by",
        "required": false,
        "fieldCode": "lockedBy",
        "apiProperty": "latestCalculation.lockedBy"
      },
      {
        "name": "상태 이벤트",
        "source": "emission_activity_submission_event.event_type",
        "required": true,
        "fieldCode": "eventType",
        "apiProperty": "events[].eventType"
      },
      {
        "name": "이전 상태",
        "source": "emission_activity_submission_event.previous_state",
        "required": true,
        "fieldCode": "previousState",
        "apiProperty": "events[].previousState"
      },
      {
        "name": "변경 상태",
        "source": "emission_activity_submission_event.new_state",
        "required": true,
        "fieldCode": "newState",
        "apiProperty": "events[].newState"
      },
      {
        "name": "상태 변경자",
        "source": "emission_activity_submission_event.event_actor",
        "required": true,
        "fieldCode": "eventActor",
        "apiProperty": "events[].eventActor"
      },
      {
        "name": "상태 변경 사유",
        "source": "emission_activity_submission_event.event_note",
        "required": false,
        "fieldCode": "eventNote",
        "apiProperty": "events[].eventNote"
      }
    ],
    "actions": [
      {
        "api": "POST /home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/start",
        "code": "START_VERIFICATION",
        "guard": "SUBMITTED + VERIFIER"
      },
      {
        "api": "POST .../verification/decision",
        "code": "PASS_VERIFICATION",
        "guard": "IN_VERIFICATION + VERIFIER",
        "payload": {
          "decision": "PASSED"
        }
      },
      {
        "api": "POST .../verification/decision",
        "code": "REQUEST_CORRECTION",
        "guard": "IN_VERIFICATION + VERIFIER + comment",
        "payload": {
          "decision": "CORRECTION_REQUESTED"
        }
      },
      {
        "api": "POST .../approval/decision",
        "code": "APPROVE",
        "guard": "VERIFIED + APPROVER",
        "payload": {
          "decision": "APPROVED"
        }
      },
      {
        "api": "POST .../approval/decision",
        "code": "REJECT",
        "guard": "VERIFIED + APPROVER + comment",
        "payload": {
          "decision": "REJECTED"
        }
      }
    ],
    "apiContracts": [
      {
        "path": "/home/api/emission-projects/{projectId}/review-workflow",
        "method": "GET"
      },
      {
        "path": "/home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/start",
        "method": "POST"
      },
      {
        "path": "/home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/decision",
        "method": "POST"
      },
      {
        "path": "/home/api/emission-projects/{projectId}/submissions/{submissionId}/approval/decision",
        "method": "POST"
      }
    ],
    "dataContracts": [
      {
        "lock": "FOR UPDATE",
        "entity": "emission_activity_submission",
        "version": "version_no",
        "tenantScope": "tenant_id + project_id"
      },
      {
        "mode": "append-only decision history",
        "entity": "emission_submission_review"
      },
      {
        "mode": "append-only state audit",
        "entity": "emission_activity_submission_event"
      },
      {
        "entity": "emission_calculation_run",
        "version": "version_no",
        "approvalEffect": "locked_at + locked_by"
      },
      {
        "entity": "framework_project_actor_assignment",
        "authority": "active VERIFIER or APPROVER"
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
    "completionRule": "검증 통과 또는 보완 요청, 오류 수, 의견, 검증자와 상태 이벤트가 하나의 트랜잭션으로 저장된다.",
    "extensions": {
      "contractId": 72,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 72,
    "requirementIds": [
      "ACTIVITY_DATA:ACTIVITY_DATA_03_VERIFY:USER"
    ],
    "generationBatchId": 79,
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
