#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
if [[ "$PROCESS" == "ORGANIZATIONAL_BOUNDARY" ]]; then
  [[ "$STEP" =~ ^ORGANIZATIONAL_BOUNDARY_S[1-4]$ ]] || exit 3
  runtime_result="$(CARBONET_ORG_BOUNDARY_PROMOTE_JOBS=false bash "$ROOT/ops/scripts/validate-organizational-boundary-runtime.sh")"
  jq -cn --arg process "$PROCESS" --arg step "$STEP" --arg runtime "$runtime_result" \
    '{handled:true,strategy:"EXACT_ORGANIZATIONAL_BOUNDARY_PERFORMANCE",process:$process,step:$step,runtime:$runtime}'
  exit 0
fi
[[ "$PROCESS" == "EMISSION_PROJECT" ]] || exit 3

grep -Eq '^org\.gradle\.(caching|parallel)=true' "$ROOT/gradle.properties"
grep -Eq '^org\.gradle\.configuration-cache=true' "$ROOT/gradle.properties"

case "$STEP" in
  EMISSION_PROJECT_SETUP|EMISSION_PROJECT_COLLECT|EMISSION_PROJECT_VALIDATE|EMISSION_PROJECT_CORRECT)
    runtime_validator="$ROOT/ops/scripts/validate-activity-data-runtime.sh" ;;
  EMISSION_PROJECT_CALCULATE)
    runtime_validator="$ROOT/ops/scripts/validate-emission-calculation-runtime.sh" ;;
  EMISSION_PROJECT_APPROVE|EMISSION_PROJECT_REPORT)
    runtime_validator="$ROOT/ops/scripts/validate-report-certification-runtime.sh" ;;
  *) exit 3 ;;
esac
[[ -x "$runtime_validator" || -s "$runtime_validator" ]] || exit 1
runtime_result="$(bash "$runtime_validator")"

BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
timings="$(mktemp)"
trap 'rm -f "$timings"' EXIT
for _ in $(seq 1 20); do
  curl -fsS -L -o /dev/null -w '%{time_total}\n' "$BASE_URL/home/search?q=carbon" >>"$timings"
done
search_p95_ms="$(sort -n "$timings" | awk 'NR==19 {printf "%d",$1*1000}')"
[[ -n "$search_p95_ms" && "$search_p95_ms" -le 2500 ]] || {
  echo "integrated search p95=${search_p95_ms:-unknown}ms" >&2
  exit 1
}

read -r desired ready available <<<"$(kubectl -n "${CARBONET_K8S_NAMESPACE:-carbonet-prod}" get deploy carbonet-runtime -o jsonpath='{.spec.replicas} {.status.readyReplicas} {.status.availableReplicas}')"
[[ "$desired" == "2" && "$ready" == "2" && "$available" == "2" ]] || exit 1

# The deployment pipeline must have completed successfully recently. This is
# evidence that the incremental build path still produces a deployable image.
deploy_log="$(journalctl -u carbonet-auto-deploy.service --since '24 hours ago' --no-pager 2>/dev/null)"
grep -Eq '\[auto-deploy\] deployed [0-9a-f]{40}|BUILD-DEPLOY (SUCCESS|COMPLETED SUCCESSFULLY)' <<<"$deploy_log"

jq -cn --arg process "$PROCESS" --arg step "$STEP" --arg runtime "$runtime_result" --argjson p95 "$search_p95_ms" \
  '{handled:true,strategy:"EXACT_RUNTIME_PERFORMANCE_ADOPTION",process:$process,step:$step,incrementalBuild:true,searchP95Millis:$p95,readyReplicas:2,runtime:$runtime}'
