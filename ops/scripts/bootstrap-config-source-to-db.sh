#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || exit 1
count="$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 \
  -U postgres -d carbonet -X -Atqc "select count(*) from framework_source_artifact where artifact_kind='CONFIG_SOURCE'")"
if (( count > 0 )); then
  jq -cn --argjson count "$count" '{success:true,status:"ALREADY_BOOTSTRAPPED",configSourceCount:$count}'
  exit 0
fi
payload="$(mktemp)"; trap 'rm -f "$payload"' EXIT
python3 "$ROOT/ops/scripts/bootstrap-config-source-to-db.py" "$ROOT" >"$payload"
encoded="$(base64 -w0 "$payload")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 \
  -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL
select framework_import_source_artifacts(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb,'CONFIG_BOOTSTRAP');
SQL
