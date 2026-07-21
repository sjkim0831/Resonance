#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"

controller="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
service="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
[[ -s "$controller" && -s "$service" ]] || exit 1

service_methods=()
controller_methods=()
routes=()
tests=()
runtime_evidence=""

case "$PROCESS:$STEP" in
  ORGANIZATIONAL_BOUNDARY:ORGANIZATIONAL_BOUNDARY_S1)
    service_methods=(organizationalBoundary saveOrganizationalBoundary)
    controller_methods=(organizationalBoundary saveOrganizationalBoundary)
    routes=(organizational-boundary)
    ;;
  ORGANIZATIONAL_BOUNDARY:ORGANIZATIONAL_BOUNDARY_S2)
    service_methods=(organizationalBoundary saveOrganizationalBoundary markOrganizationalBoundaryReviewReady)
    controller_methods=(organizationalBoundary saveOrganizationalBoundary boundaryReviewReady)
    routes=(organizational-boundary review-ready)
    ;;
  ORGANIZATIONAL_BOUNDARY:ORGANIZATIONAL_BOUNDARY_S3)
    service_methods=(organizationalBoundary consolidateOrganizationalBoundary)
    controller_methods=(organizationalBoundary consolidateBoundary)
    routes=(organizational-boundary consolidate)
    ;;
  ORGANIZATIONAL_BOUNDARY:ORGANIZATIONAL_BOUNDARY_S4)
    service_methods=(organizationalBoundary decideOrganizationalBoundary)
    controller_methods=(organizationalBoundary decideBoundary)
    routes=(organizational-boundary decision)
    ;;
  EMISSION_PROJECT:EMISSION_PROJECT_SETUP)
    service_methods=(listForActor detail create copy delete assertProjectParticipant)
    controller_methods=(listForActor detail create copy delete assertProjectParticipant)
    routes=(emission-projects name-availability options)
    tests=(verify-emission-tenant-isolation.sql verify-emission-actor-process-task-orchestration.sql)
    ;;
  EMISSION_PROJECT:EMISSION_PROJECT_COLLECT)
    service_methods=(activities saveActivity uploadActivities saveSubmission submitActivities activityRequests)
    controller_methods=(activities saveActivity uploadActivities saveSubmission submitActivities activityRequests)
    routes=(activities submissions activity-requests)
    tests=(verify-emission-activity-submission.sql verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT:EMISSION_PROJECT_VALIDATE)
    service_methods=(latestQuality runQuality submissions)
    controller_methods=(latestQuality runQuality submissions)
    routes=(quality submissions)
    tests=(verify-emission-activity-quality.sql verify-emission-activity-submission.sql)
    ;;
  EMISSION_PROJECT:EMISSION_PROJECT_CORRECT)
    service_methods=(mapFactor autoMap runQuality saveSubmission)
    controller_methods=(mapFactor autoMap runQuality saveSubmission)
    routes=(factor auto-map quality submissions)
    tests=(verify-emission-activity-quality.sql verify-emission-activity-submission.sql)
    ;;
  EMISSION_PROJECT:EMISSION_PROJECT_CALCULATE)
    service_methods=(calculationResult calculate)
    controller_methods=(calculationResult calculate)
    routes=(calculation)
    tests=(verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT:EMISSION_PROJECT_APPROVE)
    service_methods=(reviewWorkflow startVerification decideVerification decideApproval)
    controller_methods=(reviewWorkflow startVerification decideVerification decideApproval)
    routes=(review-workflow verification approval)
    tests=(verify-emission-review-workflow.sql verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT:EMISSION_PROJECT_REPORT)
    service_methods=(reportWorkflow createReport finalizeReport issueReportCertificate recordReportDownload)
    controller_methods=(reportWorkflow createReport finalizeReport issueReportCertificate recordReportDownload)
    routes=(reports finalize issue download)
    tests=(verify-emission-review-workflow.sql verify-emission-tenant-isolation.sql)
    ;;
  *) exit 3 ;;
esac

for method in "${service_methods[@]}"; do
  grep -Eq "[[:space:]]${method}\\(" "$service" || { echo "missing service method: $method" >&2; exit 1; }
done
for method in "${controller_methods[@]}"; do grep -Fq "$method(" "$controller" || { echo "missing controller delegation: $method" >&2; exit 1; }; done
for route in "${routes[@]}"; do grep -Fq "$route" "$controller" || { echo "missing controller route: $route" >&2; exit 1; }; done
for test in "${tests[@]}"; do [[ -s "$ROOT/ops/tests/$test" ]] || { echo "missing executable SQL test: $test" >&2; exit 1; }; done

if [[ "$PROCESS" == "ORGANIZATIONAL_BOUNDARY" ]]; then
  evidence_dir="${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-$ROOT/var/test-evidence/process-runtime-smoke}"
  runtime_evidence="$(python3 - "$evidence_dir" <<'PY'
import glob,json,os,sys
for path in sorted(glob.glob(os.path.join(sys.argv[1],'*.json')),key=os.path.getmtime,reverse=True):
    try:
        if json.load(open(path,encoding='utf-8')).get('processCode') == 'ORGANIZATIONAL_BOUNDARY':
            print(os.path.realpath(path)); break
    except Exception: pass
PY
)"
  [[ -n "$runtime_evidence" && -s "$runtime_evidence" ]] || { echo "missing organizational-boundary runtime evidence" >&2; exit 1; }
  python3 - "$runtime_evidence" <<'PY'
import json,sys
p=json.load(open(sys.argv[1],encoding='utf-8'))
required=('success','rolledBack','idempotencyVerified','recoveryVerified','tenantIsolationVerified','authorityVerified','exceptionVerified','workflowCompleted')
if p.get('processCode') != 'ORGANIZATIONAL_BOUNDARY' or not all(p.get(k) is True for k in required):
    raise SystemExit('organizational-boundary runtime evidence is incomplete')
if p.get('stepCount',0) < 4 or len(p.get('transitions',[])) != p.get('stepCount'):
    raise SystemExit('organizational-boundary transition evidence is incomplete')
PY
  workflow_result="runtime-evidence:${runtime_evidence}"
else
  workflow_result="$(bash "$ROOT/ops/scripts/validate-emission-project-workflow.sh")"
fi
printf '{"handled":true,"strategy":"EXACT_API_ADOPTION","process":"%s","step":"%s","serviceMethods":%s,"controllerMethods":%s,"routes":%s,"tests":%s,"workflow":"%s"}\n' \
  "$PROCESS" "$STEP" "${#service_methods[@]}" "${#controller_methods[@]}" "${#routes[@]}" "${#tests[@]}" "${workflow_result//\"/\\\"}"
