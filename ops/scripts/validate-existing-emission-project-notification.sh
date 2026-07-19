#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
[[ "$PROCESS" == "EMISSION_PROJECT" ]] || exit 3

service="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
controller="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
[[ -s "$service" && -s "$controller" ]] || exit 1

case "$STEP" in
  EMISSION_PROJECT_CALCULATE)
    events=(CALCULATED)
    readers=(detail calculationResult)
    tests=(verify-emission-tenant-isolation.sql)
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
