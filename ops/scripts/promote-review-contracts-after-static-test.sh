#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

leader=""
while IFS= read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
    leader="$pod"
    break
  fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo '[review-static-gate] PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -v ON_ERROR_STOP=1 -At \
  -c 'select framework_process_generation_snapshot(null);' >"$WORK/snapshot.json"
summary="$(python3 "$ROOT/ops/scripts/prepare-review-static-gate.py" "$WORK/snapshot.json" \
  --candidate "$WORK/candidate.json" --sql "$WORK/promote.sql")"
count="$(jq -r '.candidateCount' <<<"$summary")"
if [[ "$count" == "0" ]]; then
  echo '{"candidateCount":0,"promoted":0,"status":"NOOP"}'
  exit 0
fi

python3 "$ROOT/ops/scripts/generate-full-stack-design-packages.py" "$WORK/candidate.json" --out "$WORK/packages" >/dev/null
python3 "$ROOT/ops/scripts/fast-process-package-test.py" "$WORK/packages/index.json" \
  --evidence "$WORK/evidence.json" --cache-dir "$WORK/cache" >"$WORK/result.json"
jq -e --argjson expected "$count" '.status=="PASSED" and .packageCount>=($expected)' "$WORK/result.json" >/dev/null
promoted="$(kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -At <"$WORK/promote.sql" | tail -1)"
[[ "$promoted" == "$count" ]] || { echo "[review-static-gate] promotion mismatch expected=$count actual=$promoted" >&2; exit 1; }
jq -nc --argjson candidateCount "$count" --argjson promoted "$promoted" \
  --argjson durationMs "$(jq '.durationMs' "$WORK/result.json")" \
  '{candidateCount:$candidateCount,promoted:$promoted,durationMs:$durationMs,status:"PASSED"}'
