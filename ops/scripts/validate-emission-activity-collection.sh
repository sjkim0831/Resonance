#!/usr/bin/env bash
set -euo pipefail
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"; DB="${POSTGRES_DB:-carbonet}"; USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"; leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[activity-collection] writable PostgreSQL leader not found" >&2; exit 1; }
read -r submitted unsealed transition_errors <<<"$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -At -F ' ' -c "SELECT
 (SELECT count(*) FROM emission_activity_submission WHERE submission_state<>'DRAFT'),
 (SELECT count(*) FROM emission_activity_submission WHERE submission_state<>'DRAFT' AND (submitted_item_count=0 OR snapshot_hash IS NULL)),
 (SELECT count(*) FROM emission_project_task activity JOIN emission_project_task calculation ON calculation.project_id=activity.project_id AND calculation.task_code='CALCULATION' WHERE activity.task_code='ACTIVITY_DATA' AND activity.task_status='DONE' AND calculation.task_status NOT IN ('READY','IN_PROGRESS','DONE'));" )"
[[ "$unsealed" == "0" ]] || { echo "[activity-collection] unsealed submissions: $unsealed" >&2; exit 2; }
[[ "$transition_errors" == "0" ]] || { echo "[activity-collection] invalid task transitions: $transition_errors" >&2; exit 3; }
echo "[activity-collection] PASS submitted=$submitted unsealed=0 transition-errors=0"
