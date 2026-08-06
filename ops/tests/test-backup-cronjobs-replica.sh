#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/ops/scripts/apply-backup-cronjobs.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"

[[ -f "$SCRIPT" ]]
bash -n "$SCRIPT"
bash -n "$AUTO_DEPLOY"

dump_count="$(grep -c '^[[:space:]]*pg_dump -h postgres-haproxy\.carbonet-prod\.svc\.cluster\.local -p 5433' "$SCRIPT")"
[[ "$dump_count" -eq 2 ]] || {
  echo "[backup-cronjobs-replica-test] FAIL: hourly and daily pg_dump must use HAProxy replica port 5433" >&2
  exit 1
}

[[ "$(grep -c "PGCONNECT_TIMEOUT=10 PGOPTIONS='-c statement_timeout=" "$SCRIPT")" -eq 2 ]]
[[ "$(grep -c -- "-c lock_timeout=10000 -c work_mem=16MB" "$SCRIPT")" -eq 2 ]]
! grep -Eq 'pg_dump -h postgres-haproxy\.carbonet-prod\.svc\.cluster\.local([^\n]* )?-p 5432' "$SCRIPT"

grep -Fq 'read_cronjob_suspend_state "$HOURLY_CRONJOB"' "$SCRIPT"
grep -Fq "trap 'restore_captured_suspend_states' EXIT" "$SCRIPT"
grep -Fq 'restore_captured_suspend_states' "$SCRIPT"
grep -Fq 'validate_backup_cronjob_contract' "$SCRIPT"
grep -Fq 'bash ops/scripts/apply-backup-cronjobs.sh --check' "$AUTO_DEPLOY"
grep -Fq '"${PLAN_RUNTIME_REQUIRED:-false}" == "true"' "$AUTO_DEPLOY"

echo '[backup-cronjobs-replica-test] PASS: replica port, suspend preservation and runtime drift gates are wired'
