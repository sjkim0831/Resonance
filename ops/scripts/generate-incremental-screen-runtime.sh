#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS_CODE="${2:-}"
LIMIT="${SCREEN_GENERATION_LIMIT:-1000}"
WORKERS="${SCREEN_GENERATION_WORKERS:-16}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
OUT="${SCREEN_RUNTIME_OUT:-$ROOT/projects/carbonet-backend-metadata/screen-runtime/generated}"
LOCK_FILE="${SCREEN_GENERATION_LOCK:-/tmp/resonance-incremental-screen-generation.lock}"

[[ "$LIMIT" =~ ^[0-9]+$ ]] && (( LIMIT >= 1 && LIMIT <= 1000 )) || {
  echo '[incremental-screen-generator] limit must be between 1 and 1000' >&2; exit 2;
}
[[ "$WORKERS" =~ ^[0-9]+$ ]] && (( WORKERS >= 1 && WORKERS <= 32 )) || {
  echo '[incremental-screen-generator] workers must be between 1 and 32' >&2; exit 2;
}
[[ -z "$PROCESS_CODE" || "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ ]] || {
  echo '[incremental-screen-generator] invalid process code' >&2; exit 2;
}

exec 9>"$LOCK_FILE"
flock -n 9 || { echo '{"success":true,"status":"ALREADY_RUNNING"}'; exit 0; }

snapshot="$(mktemp)"; result="$(mktemp)"
trap 'rm -f "$snapshot" "$result"' EXIT

leader=""
while IFS= read -r candidate; do
  [[ -n "$candidate" ]] || continue
  if [[ "$(kubectl -n "$NAMESPACE" exec "$candidate" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
    leader="$candidate"; break
  fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo '[incremental-screen-generator] writable PostgreSQL leader not found' >&2; exit 1; }

selector="null"
[[ -n "$PROCESS_CODE" ]] && selector="'$PROCESS_CODE'"
kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 -At \
  -c "select framework_incremental_screen_generation_snapshot($LIMIT,$selector);" >"$snapshot"

screen_count="$(jq -r '.screenCount // 0' "$snapshot")"
if (( screen_count == 0 )); then
  jq -cn --arg process "$PROCESS_CODE" '{success:true,status:"UNCHANGED",requested:0,generated:0,unchanged:0,manual:0,failed:0,elapsedMillis:0,processCode:$process}'
  exit 0
fi

run_code="SCREEN_INC_$(date -u +%Y%m%d%H%M%S)_$RANDOM"
kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 \
  -c "insert into framework_incremental_generation_run(run_code,requested_limit,requested_process,dirty_count) values('$run_code',$LIMIT,$selector,$screen_count);" >/dev/null

set +e
python3 "$ROOT/ops/scripts/generate-incremental-screen-runtime.py" "$snapshot" \
  --out "$OUT" --workers "$WORKERS" --max-millis 180000 >"$result"
generator_rc=$?
set -e
if (( generator_rc != 0 )); then
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q \
    -c "update framework_incremental_generation_run set run_status='FAILED',failed_count=dirty_count,completed_at=current_timestamp where run_code='$run_code';" >/dev/null || true
  exit "$generator_rc"
fi

jq -e '.success==true and .failed==0 and .elapsedMillis<=180000' "$result" >/dev/null
result_base64="$(base64 -w0 "$result")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 -At <<SQL >/dev/null
select framework_complete_incremental_screen_generation(
  '$run_code',convert_from(decode('$result_base64','base64'),'UTF8')::jsonb);
SQL

jq --arg runCode "$run_code" --arg processCode "$PROCESS_CODE" \
  '. + {runCode:$runCode,processCode:$processCode,status:"GENERATED"}' "$result"
