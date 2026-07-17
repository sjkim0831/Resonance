#!/usr/bin/env bash
set -euo pipefail
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"; DB="${POSTGRES_DB:-carbonet}"; USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"; leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[emission-workflow] writable PostgreSQL leader not found" >&2; exit 1; }
read -r total ready broken <<<"$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -At -F ' ' -c "SELECT count(*),count(*) FILTER(WHERE workflow_health='READY'),count(*) FILTER(WHERE workflow_health<>'READY') FROM emission_project_workflow_health")"
[[ "$broken" == "0" ]] || {
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -P pager=off -c "SELECT project_id,workflow_health,task_count,actor_assignment_count,missing_actor_count,missing_route_count,missing_rule_count,missing_predecessor_count,deadlines_valid FROM emission_project_workflow_health WHERE workflow_health<>'READY' ORDER BY project_id"
  echo "[emission-workflow] invalid projects: $broken" >&2; exit 2;
}
echo "[emission-workflow] PASS projects=$total ready=$ready invalid=0"
