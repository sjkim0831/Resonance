#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/ops/scripts/apply-backup-cronjobs.sh"

[[ -f "$SCRIPT" ]]
bash -n "$SCRIPT"

dump_count="$(grep -c '^[[:space:]]*pg_dump -h postgres-haproxy\.carbonet-prod\.svc\.cluster\.local -p 5433' "$SCRIPT")"
[[ "$dump_count" -eq 2 ]] || {
  echo "[backup-cronjobs-replica-test] FAIL: hourly and daily pg_dump must use HAProxy replica port 5433" >&2
  exit 1
}

[[ "$(grep -c "PGCONNECT_TIMEOUT=10 PGOPTIONS='-c statement_timeout=" "$SCRIPT")" -eq 2 ]]
[[ "$(grep -c -- "-c lock_timeout=10000 -c work_mem=16MB" "$SCRIPT")" -eq 2 ]]
! grep -Eq 'pg_dump -h postgres-haproxy\.carbonet-prod\.svc\.cluster\.local([^\n]* )?-p 5432' "$SCRIPT"

echo '[backup-cronjobs-replica-test] PASS: logical backups use bounded read-replica connections'
