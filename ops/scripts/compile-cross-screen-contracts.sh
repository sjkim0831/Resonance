#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
snapshot="$(mktemp)"; result="$(mktemp)"; trap 'rm -f "$snapshot" "$result"' EXIT
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || exit 1
kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 -c 'select framework_contract_compiler_snapshot()' >"$snapshot"
python3 "$ROOT/ops/scripts/compile-cross-screen-contracts.py" "$snapshot" >"$result"
encoded="$(base64 -w0 "$result")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
select framework_import_contract_compilation(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb);
SQL
jq 'del(.canonicalFields,.bindings,.lineage,.issues)' "$result"
