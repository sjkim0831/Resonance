#!/usr/bin/env bash
set -euo pipefail
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"; DB="${POSTGRES_DB:-carbonet}"; USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"; leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || exit 1
read -r invalid verified <<<"$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -At -F ' ' -c "select count(*) filter(where completed_tasks>required_tasks),coalesce(sum(completed_tasks),0) from framework_process_delivery_queue;")"
[[ "$invalid" == "0" ]] || { echo "[project-auto-completion] invalid completion counters: $invalid" >&2; exit 2; }
echo "[project-auto-completion] PASS verified-required-jobs=$verified invalid=0"
