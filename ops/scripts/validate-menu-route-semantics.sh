#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DB="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"

leader="${POSTGRES_POD:-}"
if [[ -z "$leader" ]]; then
  while IFS= read -r pod; do
    [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
  done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
fi
[[ -n "$leader" ]] || { echo "writable PostgreSQL leader not found" >&2; exit 1; }
psqlq(){ kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -At "$@"; }

summary="$(psqlq -F '|' -c "select total_menu_routes,exact_step_routes,screen_contract_routes,review_routes,unresolved_routes from framework_menu_route_semantic_summary;")"
IFS='|' read -r total exact contract review unresolved <<<"$summary"
[[ "$total" -gt 0 && "$unresolved" == "0" ]] || { echo "semantic menu routes unresolved: $summary" >&2; exit 1; }

coverage="$(psqlq -F '|' -c "select navigable_menu_count,bound_menu_count,missing_menu_count from framework_actor_process_menu_summary;")"
IFS='|' read -r navigable bound missing <<<"$coverage"
[[ "$navigable" == "$bound" && "$missing" == "0" && "$total" == "$navigable" ]] || {
  echo "menu/process coverage mismatch: semantic=$summary coverage=$coverage" >&2; exit 1;
}

critical="$(psqlq -F '|' -c "
select
 (select user_path from framework_process_step where process_code='EMISSION_PROJECT' and step_code='EMISSION_PROJECT_CALCULATE'),
 (select user_path from framework_process_step where process_code='REDUCTION_EXECUTION' and step_code='REDUCTION_EXECUTION_02_WORK'),
 (select menu_url from comtnmenuinfo where menu_code='H1020301'),
 (select menu_url from comtnmenuinfo where menu_code='H1020408'),
 (select menu_url from comtnmenuinfo where menu_code='H1020106');")"
[[ "$critical" == "/emission/calculation|/emission/simulate|/emission/calculation|/emission/activity-data?tab=mapping|/emission/calculation" ]] || {
  echo "critical calculation/simulation route semantics are incorrect: $critical" >&2; exit 1;
}

stale_artifacts="$(psqlq -c "select count(*) from framework_process_artifact where process_code='EMISSION_PROJECT' and step_code='EMISSION_PROJECT_CALCULATE' and target_path like '/emission/simulate%';")"
[[ "$stale_artifacts" == "0" ]] || {
  echo "generated calculation artifacts still point to reduction simulation: $stale_artifacts" >&2; exit 1;
}

route_file="$ROOT_DIR/projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts"
grep -Fq 'koPath: "/emission/calculation"' "$route_file"
grep -Fq 'id: "emission-calculation", exportName: "EmissionProjectResultPage"' "$route_file"
grep -Fq 'id: "emission-simulate", label: "감축 전략 시뮬레이션"' "$route_file"

for route in /emission/calculation /emission/simulate /emission/validate /emission/report_submit; do
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$route")"
  [[ "$status" =~ ^(200|302)$ ]] || { echo "live route failed: $route HTTP $status" >&2; exit 1; }
done

printf '[menu-route-semantics] PASS total=%s exact=%s contract=%s review=%s unresolved=0 live=4\n' \
  "$total" "$exact" "$contract" "$review"
