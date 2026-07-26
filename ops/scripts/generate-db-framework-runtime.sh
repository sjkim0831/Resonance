#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LIMIT="${FRAMEWORK_RUNTIME_GENERATION_LIMIT:-5000}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
OUT="${FRAMEWORK_RUNTIME_OUT:-$ROOT/projects/carbonet-backend-metadata/framework-runtime/generated}"
LOCK="${FRAMEWORK_RUNTIME_LOCK:-/tmp/resonance-db-framework-runtime.lock}"
exec 9>"$LOCK"
flock -n 9 || { echo '{"success":true,"status":"ALREADY_RUNNING"}'; exit 0; }
snapshot="$(mktemp)"; result="$(mktemp)"
trap 'rm -f "$snapshot" "$result"' EXIT
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 \
    -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo "writable PostgreSQL leader not found" >&2; exit 1; }
kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 \
  -c "select framework_runtime_generation_snapshot($LIMIT)" >"$snapshot"
count="$(jq -r '.resourceCount // 0' "$snapshot")"
(( count > 0 )) || { echo '{"success":true,"status":"UNCHANGED","requested":0}'; exit 0; }
python3 "$ROOT/ops/scripts/generate-db-framework-runtime.py" "$snapshot" --out "$OUT" >"$result"
jq -e '.success==true and .failed==0' "$result" >/dev/null
encoded="$(base64 -w0 "$result")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
select framework_complete_runtime_generation(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb);
SQL
jq 'del(.artifacts) + {status:"GENERATED"}' "$result"
