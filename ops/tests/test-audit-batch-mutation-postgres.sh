#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
POD="${CARBONET_POSTGRES_POD:-postgres-patroni-0}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
DATABASE="${CARBONET_POSTGRES_DATABASE:-carbonet}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812031500__stage_hourly_screen_contract_audit_batches.sql"
MUTATION="$ROOT/ops/tests/audit-batch-mutation.sql"

command -v kubectl >/dev/null || { echo 'missing command: kubectl' >&2; exit 1; }
for file in "$MIGRATION" "$MUTATION"; do
  [[ -f "$file" ]] || { echo "missing ${file#$ROOT/}" >&2; exit 1; }
done

tmp_output="$(mktemp)"
trap 'rm -f "$tmp_output"' EXIT
if ! {
  printf '%s\n' '\set ON_ERROR_STOP on' 'BEGIN;'
  cat "$MIGRATION"
  cat "$MUTATION"
  printf '%s\n' 'ROLLBACK;'
} | kubectl exec -i -n "$NAMESPACE" "$POD" -c "$CONTAINER" -- \
      env PGOPTIONS='-c statement_timeout=90000 -c lock_timeout=5000' \
      psql -h 127.0.0.1 -X -U postgres -d "$DATABASE" >"$tmp_output" 2>&1; then
  cat "$tmp_output" >&2
  exit 1
fi

grep -Fq 'BATCH_MUTATION_PASS' "$tmp_output" || { cat "$tmp_output" >&2; exit 1; }
grep -Fxq 'ROLLBACK' "$tmp_output" || { cat "$tmp_output" >&2; echo 'rollback marker missing' >&2; exit 1; }
printf '[test-audit-batch-mutation-postgres] PASS targets=canonical exact-coverage=true failed-hidden=true incident=1750 immutable=true sequence=unchanged transaction=ROLLBACK\n'
