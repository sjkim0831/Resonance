#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
service="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
controller="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
[[ -s "$service" && -s "$controller" ]] || exit 1

if [[ "$PROCESS" == "ORGANIZATIONAL_BOUNDARY" ]]; then
  [[ "$STEP" =~ ^ORGANIZATIONAL_BOUNDARY_S[1-4]$ ]] || exit 3
  grep -Fq 'notifyOrganizationalBoundaryHandoff(' "$service"
  grep -Fq 'emission_workflow_notification' "$service"
  grep -Fq 'readWorkflowNotification(' "$service"
  grep -Fq 'readTaskNotification(' "$controller"
  case "$STEP" in
    ORGANIZATIONAL_BOUNDARY_S1) events=(BOUNDARY_DRAFT_SAVED) ;;
    ORGANIZATIONAL_BOUNDARY_S2) events=(BOUNDARY_REVIEW_READY) ;;
    ORGANIZATIONAL_BOUNDARY_S3) events=(BOUNDARY_CONSOLIDATED) ;;
    ORGANIZATIONAL_BOUNDARY_S4) events=(BOUNDARY_APPROVED BOUNDARY_REJECTED) ;;
  esac
  for event in "${events[@]}"; do grep -Fq "\"$event\"" "$service" || { echo "missing organizational-boundary event: $event" >&2; exit 1; }; done
  runtime="$(CARBONET_ORG_BOUNDARY_PROMOTE_JOBS=false bash "$ROOT/ops/scripts/validate-organizational-boundary-runtime.sh")"
  jq -cn --arg process "$PROCESS" --arg step "$STEP" --arg runtime "$runtime" --argjson events "${#events[@]}" \
    '{handled:true,strategy:"EXACT_ORGANIZATIONAL_BOUNDARY_NOTIFICATION",process:$process,step:$step,events:$events,runtime:$runtime}'
  exit 0
fi
[[ "$PROCESS" == "EMISSION_PROJECT" ]] || exit 3

case "$STEP" in
  EMISSION_PROJECT_SETUP)
    events=(CREATED)
    readers=(listForActor detail)
    tests=(verify-emission-tenant-isolation.sql verify-emission-actor-process-task-orchestration.sql)
    ;;
  EMISSION_PROJECT_COLLECT)
    events=(ACTIVITY_ADDED EXCEL_UPLOADED SUBMITTED)
    readers=(activities submissions)
    tests=(verify-emission-activity-submission.sql verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_VALIDATE)
    events=(VERIFIED CORRECTION_REQUESTED)
    readers=(latestQuality submissions)
    tests=(verify-emission-activity-quality.sql verify-emission-review-workflow.sql)
    ;;
  EMISSION_PROJECT_CALCULATE)
    events=(CALCULATED)
    readers=(detail calculationResult)
    tests=(verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_VALIDATE)
    events=(VERIFICATION_STARTED VERIFIED CORRECTION_REQUESTED)
    readers=(submissions reviewWorkflow)
    tests=(verify-emission-activity-quality.sql verify-emission-review-workflow.sql)
    ;;
  EMISSION_PROJECT_CORRECT)
    events=(CORRECTION_REQUESTED)
    readers=(detail reviewWorkflow)
    tests=(verify-emission-activity-quality.sql verify-emission-review-workflow.sql)
    ;;
  EMISSION_PROJECT_APPROVE)
    events=(VERIFIED APPROVED REJECTED)
    readers=(submissions reviewWorkflow)
    tests=(verify-emission-review-workflow.sql verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_REPORT)
    events=(REPORT_DRAFT_CREATED REPORT_FINALIZED REPORT_CERTIFICATE_ISSUED)
    readers=(reportWorkflow reportAccessHistory)
    tests=(verify-emission-review-workflow.sql verify-emission-tenant-isolation.sql)
    ;;
  *) exit 3 ;;
esac

for event in "${events[@]}"; do grep -Eq "['\"]${event}['\"]" "$service" || { echo "missing persisted workflow event: $event" >&2; exit 1; }; done
for reader in "${readers[@]}"; do
  grep -Eq "[[:space:]]${reader}\\(" "$service" || { echo "missing notification reader: $reader" >&2; exit 1; }
  grep -Fq "$reader(" "$controller" || { echo "missing notification API delegation: $reader" >&2; exit 1; }
done
grep -Fq 'emission_project_history' "$service" || exit 1
grep -Fq 'emission_activity_submission_event' "$service" || exit 1
for test in "${tests[@]}"; do [[ -s "$ROOT/ops/tests/$test" ]] || { echo "missing notification workflow test: $test" >&2; exit 1; }; done

workflow_result="$(bash "$ROOT/ops/scripts/validate-emission-project-workflow.sh")"
printf '{"handled":true,"strategy":"EXACT_IN_APP_NOTIFICATION_ADOPTION","process":"%s","step":"%s","events":%s,"readers":%s,"tests":%s,"workflow":"%s"}\n' \
  "$PROCESS" "$STEP" "${#events[@]}" "${#readers[@]}" "${#tests[@]}" "${workflow_result//\"/\\\"}"
