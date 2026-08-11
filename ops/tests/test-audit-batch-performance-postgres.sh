#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
POD="${CARBONET_POSTGRES_POD:-postgres-patroni-0}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
DATABASE="${CARBONET_POSTGRES_DATABASE:-carbonet}"
REPORT_REFERENCE_MS="${AUDIT_REPORT_PAGE50_REFERENCE_MS:-500}"
REPORT_BUDGET_MS="${AUDIT_REPORT_PAGE50_BUDGET_MS:-3000}"
AUDIT_BUDGET_MS="${AUDIT_TARGET_PAGE250_BUDGET_MS:-20}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812031500__stage_hourly_screen_contract_audit_batches.sql"
BACKEND="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
GENERATOR="$ROOT/ops/tests/generate-audit-batch-performance-sql.py"

for command in kubectl python3 awk; do
  command -v "$command" >/dev/null || { echo "missing command: $command" >&2; exit 1; }
done
for file in "$MIGRATION" "$BACKEND" "$GENERATOR"; do
  [[ -f "$file" ]] || { echo "missing ${file#$ROOT/}" >&2; exit 1; }
done
[[ "$REPORT_BUDGET_MS" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo "invalid report budget: $REPORT_BUDGET_MS" >&2; exit 1; }
[[ "$AUDIT_BUDGET_MS" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo "invalid audit budget: $AUDIT_BUDGET_MS" >&2; exit 1; }

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
query_sql="$tmp_dir/performance.sql"
output="$tmp_dir/psql.out"
python3 "$GENERATOR" "$BACKEND" >"$query_sql"

if ! {
  printf '%s\n' '\set ON_ERROR_STOP on' 'BEGIN;'
  cat "$MIGRATION"
  cat "$query_sql"
  printf '%s\n' 'ROLLBACK;'
} | kubectl exec -i -n "$NAMESPACE" "$POD" -c "$CONTAINER" -- \
      env PGOPTIONS='-c statement_timeout=30000 -c lock_timeout=5000' \
      psql -h 127.0.0.1 -X -U postgres -d "$DATABASE" >"$output" 2>&1; then
  cat "$output" >&2
  exit 1
fi

grep -Fxq 'ROLLBACK' "$output" || { cat "$output" >&2; echo 'rollback marker missing' >&2; exit 1; }
report_ms="$(awk '
  $0=="REPORT_LATE_PAGE_50" { section="report"; next }
  $0=="AUDIT_LATE_PAGE_250" { section="audit"; next }
  section=="report" && /Execution Time:/ { print $(NF-1); exit }
' "$output")"
audit_ms="$(awk '
  $0=="AUDIT_LATE_PAGE_250" { section="audit"; next }
  section=="audit" && /Execution Time:/ { print $(NF-1); exit }
' "$output")"
[[ "$report_ms" =~ ^[0-9]+([.][0-9]+)?$ && "$audit_ms" =~ ^[0-9]+([.][0-9]+)?$ ]] || {
  cat "$output" >&2
  echo "performance timing parse failed: report=$report_ms audit=$audit_ms" >&2
  exit 1
}
awk -v actual="$report_ms" -v budget="$REPORT_BUDGET_MS" 'BEGIN { exit !(actual<=budget) }' || {
  echo "report page50 budget exceeded: actual=${report_ms}ms budget=${REPORT_BUDGET_MS}ms" >&2
  exit 1
}
awk -v actual="$audit_ms" -v budget="$AUDIT_BUDGET_MS" 'BEGIN { exit !(actual<=budget) }' || {
  echo "audit page250 budget exceeded: actual=${audit_ms}ms budget=${AUDIT_BUDGET_MS}ms" >&2
  exit 1
}
printf '[test-audit-batch-performance-postgres] PASS report_page50_ms=%s reference_ms=%s hard_budget_ms=%s audit_page250_ms=%s hard_budget_ms=%s transaction=ROLLBACK\n' \
  "$report_ms" "$REPORT_REFERENCE_MS" "$REPORT_BUDGET_MS" "$audit_ms" "$AUDIT_BUDGET_MS"
