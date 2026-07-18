#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
[[ "$PROCESS" == "EMISSION_PROJECT" ]] || exit 3

controller="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
service="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
[[ -s "$controller" && -s "$service" ]] || exit 1

case "$STEP" in
  EMISSION_PROJECT_SETUP)
    methods=(listForActor detail create copy delete assertProjectParticipant)
    routes=(emission-projects name-availability options)
    tests=(verify-emission-tenant-isolation.sql verify-emission-actor-process-task-orchestration.sql)
    ;;
  EMISSION_PROJECT_COLLECT)
    methods=(activities saveActivity uploadActivities saveSubmission submitActivities activityRequests)
    routes=(activities submissions activity-requests)
    tests=(verify-emission-activity-submission.sql verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_VALIDATE)
    methods=(latestQuality runQuality submissions)
    routes=(quality submissions)
    tests=(verify-emission-activity-quality.sql verify-emission-activity-submission.sql)
    ;;
  EMISSION_PROJECT_CORRECT)
    methods=(mapFactor autoMap runQuality saveSubmission)
    routes=(factor auto-map quality submissions)
    tests=(verify-emission-activity-quality.sql verify-emission-activity-submission.sql)
    ;;
  EMISSION_PROJECT_CALCULATE)
    methods=(calculationResult calculate)
    routes=(calculation)
    tests=(verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_APPROVE)
    methods=(reviewWorkflow startVerification decideVerification decideApproval)
    routes=(review-workflow verification approval)
    tests=(verify-emission-review-workflow.sql verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_REPORT)
    methods=(reportWorkflow createReport finalizeReport issueReportCertificate recordReportDownload)
    routes=(reports finalize issue download)
    tests=(verify-emission-review-workflow.sql verify-emission-tenant-isolation.sql)
    ;;
  *) exit 3 ;;
esac

for method in "${methods[@]}"; do
  grep -Eq "[[:space:]]${method}\\(" "$service" || { echo "missing service method: $method" >&2; exit 1; }
  grep -Fq "$method(" "$controller" || { echo "missing controller delegation: $method" >&2; exit 1; }
done
for route in "${routes[@]}"; do grep -Fq "$route" "$controller" || { echo "missing controller route: $route" >&2; exit 1; }; done
for test in "${tests[@]}"; do [[ -s "$ROOT/ops/tests/$test" ]] || { echo "missing executable SQL test: $test" >&2; exit 1; }; done

workflow_result="$(bash "$ROOT/ops/scripts/validate-emission-project-workflow.sh")"
printf '{"handled":true,"strategy":"EXACT_API_ADOPTION","process":"%s","step":"%s","methods":%s,"routes":%s,"tests":%s,"workflow":"%s"}\n' \
  "$PROCESS" "$STEP" "${#methods[@]}" "${#routes[@]}" "${#tests[@]}" "${workflow_result//\"/\\\"}"
