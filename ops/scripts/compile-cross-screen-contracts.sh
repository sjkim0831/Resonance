#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
snapshot="$(mktemp)"; enriched="$(mktemp)"; result="$(mktemp)"; trap 'rm -f "$snapshot" "$enriched" "$result"' EXIT
MARKER="$ROOT/projects/carbonet-backend-metadata/screen-runtime/contract-compiler-source.hash"
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || exit 1
source_hash="$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 \
  -U postgres -d carbonet -X -Atqc "select md5(concat_ws('|',
    (select count(*) from framework_professional_screen_contract),
    (select max(updated_at) from framework_professional_screen_contract),
    (select count(*) from framework_api_endpoint_registry where active_yn='Y'),
    (select max(verified_at) from framework_api_endpoint_registry),
    (select md5(string_agg(concat_ws('.',table_name,column_name,data_type,is_nullable),'|' order by table_name,ordinal_position))
       from information_schema.columns where table_schema='public')))")"
compiler_hash="$(sha256sum "$ROOT/ops/scripts/compile-cross-screen-contracts.py" | awk '{print $1}')"
source_hash="$(printf '%s|%s' "$source_hash" "$compiler_hash" | sha256sum | awk '{print $1}')"
if [[ -f "$MARKER" && "$(cat "$MARKER")" == "$source_hash" ]]; then
  jq -cn --arg sourceHash "$source_hash" \
    '{success:true,status:"UNCHANGED",sourceHash:$sourceHash,compilerSkipped:true}'
  exit 0
fi
kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 -c 'select framework_contract_compiler_snapshot()' >"$snapshot"
contract_statuses="$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 \
  -U postgres -d carbonet -X -Atqc "select coalesce(jsonb_object_agg(contract_id::text,contract_status),'{}'::jsonb) from framework_professional_screen_contract")"
jq --argjson statuses "$contract_statuses" \
  '(.contracts[] | .contractStatus) = ($statuses[(.contractId|tostring)] // "REVIEW_REQUIRED")' \
  "$snapshot" >"$enriched"
python3 "$ROOT/ops/scripts/compile-cross-screen-contracts.py" "$enriched" >"$result"
next_hash="$(jq -r '.contractHash' "$result")"
latest_hash="$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 \
  -U postgres -d carbonet -X -Atqc 'select contract_hash from framework_contract_compilation_run order by compilation_id desc limit 1')"
if [[ -n "$latest_hash" && "$latest_hash" == "$next_hash" ]]; then
  mkdir -p "$(dirname "$MARKER")"; printf '%s\n' "$source_hash" >"$MARKER"
  jq '{success:true,status:"UNCHANGED",contractHash,screenCount,fieldCount,
    lineageCount,blockingCount,warningCount,elapsedMillis}' "$result"
  exit 0
fi
encoded="$(base64 -w0 "$result")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
select framework_import_contract_compilation(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb);
SQL
mkdir -p "$(dirname "$MARKER")"; printf '%s\n' "$source_hash" >"$MARKER"
jq 'del(.canonicalFields,.bindings,.lineage,.issues)' "$result"
