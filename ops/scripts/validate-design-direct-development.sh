#!/usr/bin/env bash
set -euo pipefail
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"; DB="${POSTGRES_DB:-carbonet}"; USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"; leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[design-direct] writable PostgreSQL leader not found" >&2; exit 1; }
read -r revisions invalid <<<"$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -At -F ' ' -c "select count(*),count(*) filter(where design_hash='' or step_count<=0 or development_job_count<=0) from framework_design_delivery_revision;")"
[[ "$invalid" == "0" ]] || { echo "[design-direct] invalid design revisions: $invalid" >&2; exit 2; }
echo "[design-direct] PASS revisions=$revisions invalid=0"
