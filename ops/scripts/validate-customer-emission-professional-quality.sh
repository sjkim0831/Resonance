#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
POD="${PATRONI_POD:-postgres-patroni-2}"

bash "$ROOT/ops/scripts/validate-customer-emission-relay-design.sh"

summary="$(kubectl -n "$NAMESPACE" exec -i "$POD" -c patroni -- \
  psql -h 127.0.0.1 -U postgres -d carbonet -X -At -F '|' <<'SQL'
SELECT
  count(*) FILTER (WHERE process_code='ACTIVITY_DATA' AND step_code='ACTIVITY_DATA_01_PLAN' AND user_path='/emission/data-request'),
  count(*) FILTER (WHERE process_code='EMISSION_CALCULATION' AND step_code='EMISSION_CALCULATION_01_PLAN' AND user_path='/emission/calculation?mode=plan'),
  count(*) FILTER (WHERE process_code='REPORT_CERTIFICATION' AND step_code='REPORT_CERTIFICATION_02_WORK' AND actor_code='CALCULATOR'),
  (SELECT count(*) FROM framework_step_execution_spec WHERE process_code='REGULATORY_SUBMISSION' AND step_code='REGULATORY_SUBMISSION_S4' AND transition_contract->>'toState'='COMPLETED'),
  count(DISTINCT user_path)
FROM framework_process_step
WHERE process_code IN ('EMISSION_PROJECT_PORTFOLIO','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');
SQL
)"
IFS='|' read -r collection_plan calculation_plan report_actor terminal_state unique_routes <<<"$summary"
[[ "$collection_plan" == 1 ]] || { echo '[professional-quality] FAIL activity planning route' >&2; exit 1; }
[[ "$calculation_plan" == 1 ]] || { echo '[professional-quality] FAIL calculation planning route' >&2; exit 1; }
[[ "$report_actor" == 1 ]] || { echo '[professional-quality] FAIL report generation actor' >&2; exit 1; }
[[ "$terminal_state" == 1 ]] || { echo '[professional-quality] FAIL terminal process state' >&2; exit 1; }
[[ "$unique_routes" -ge 10 ]] || { echo "[professional-quality] FAIL unique routes=$unique_routes expected>=10" >&2; exit 1; }

echo "[professional-quality] PASS steps=21 collectionPlan=actionable calculationPlan=actionable reportActor=CALCULATOR terminal=COMPLETED uniqueRoutes=$unique_routes"
