#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
JOB_TYPE="${4:?job type is required}"
[[ "$PROCESS" == "EMISSION_PROJECT" ]] || exit 3
[[ "$JOB_TYPE" =~ ^(TEST|ACTOR_TEST|INTEGRATION)$ ]] || exit 3

case "$STEP" in
  EMISSION_PROJECT_SETUP|EMISSION_PROJECT_COLLECT|EMISSION_PROJECT_VALIDATE|EMISSION_PROJECT_CORRECT)
    validator="$ROOT/ops/scripts/validate-activity-data-runtime.sh"
    tests=(verify-emission-actor-process-task-orchestration.sql verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_CALCULATE)
    validator="$ROOT/ops/scripts/validate-emission-calculation-runtime.sh"
    tests=(verify-emission-tenant-isolation.sql)
    ;;
  EMISSION_PROJECT_APPROVE|EMISSION_PROJECT_REPORT)
    validator="$ROOT/ops/scripts/validate-report-certification-runtime.sh"
    tests=(verify-emission-review-workflow.sql verify-emission-tenant-isolation.sql)
    ;;
  *) exit 3 ;;
esac

for test in "${tests[@]}"; do
  [[ -s "$ROOT/ops/tests/$test" ]] || { echo "missing executable journey test: $test" >&2; exit 1; }
done
[[ -s "$ROOT/ops/scripts/validate-customer-work-journey.sh" ]] || exit 1

runtime="$(bash "$validator")"
workflow="$(bash "$ROOT/ops/scripts/validate-emission-project-workflow.sh")"
customer="$(bash "$ROOT/ops/scripts/validate-customer-work-journey.sh")"

jq -cn --arg process "$PROCESS" --arg step "$STEP" --arg type "$JOB_TYPE" \
  --arg runtime "$runtime" --arg workflow "$workflow" --arg customer "$customer" --argjson tests "${#tests[@]}" \
  '{handled:true,strategy:"EXACT_ACTOR_JOURNEY_ADOPTION",process:$process,step:$step,jobType:$type,executableTests:$tests,runtime:$runtime,workflow:$workflow,customerJourney:$customer}'
