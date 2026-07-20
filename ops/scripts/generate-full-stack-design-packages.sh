#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS_CODE="${2:-}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
OUT="${FULL_STACK_PACKAGE_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/generated}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

leader="${POSTGRES_POD:-}"
if [[ -z "$leader" ]]; then
  leader="$(kubectl -n "$NAMESPACE" get pods -o name | sed -n 's#pod/\(postgres-patroni-[0-9]*\)#\1#p' | head -n 1)"
fi
[[ -n "$leader" ]] || { echo '[full-stack-generator] PostgreSQL pod not found' >&2; exit 1; }
[[ -z "$PROCESS_CODE" || "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ ]] || {
  echo '[full-stack-generator] invalid process code' >&2; exit 1;
}

if [[ -n "$PROCESS_CODE" ]]; then
  selector="'$PROCESS_CODE'"
  OUT="$OUT/$PROCESS_CODE"
else
  selector="null"
fi

kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 -At \
  -c "select framework_process_generation_snapshot($selector);" >"$TMP"

python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$OUT"
python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$TMP" --out "$OUT" --check
jq -e '.packageCount>0' "$OUT/index.json" >/dev/null || {
  echo "[full-stack-generator] no approved generation-ready package for ${PROCESS_CODE:-all processes}" >&2
  exit 1
}
