#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/postgres-isolated-restore-drill.sh"

bash -n "$script"
grep -q 'namespace.*carbonet-restore-drill' <(tr '[:upper:]' '[:lower:]' <"$script")
grep -q 'pg_restore -U postgres --exit-on-error' "$script"
grep -q 'exec -i "$POD" -- psql' "$script"
grep -q 'readOnly: true' "$script"
grep -q 'invalid_indexes' "$script"
grep -q 'unvalidated_constraints' "$script"
grep -q 'failed_migrations' "$script"
grep -q 'carbonet_flyway_schema_history' "$script"
grep -q 'sudo -n rm -rf -- "$WORK_DIR"' "$script"
grep -q 'chmod 0777 "$WORK_DIR/data"' "$script"
grep -q 'OnCalendar=Sun' \
  "$root/ops/systemd/carbonet-postgres-restore-drill.timer"
grep -q 'IOSchedulingPriority=7' \
  "$root/ops/systemd/carbonet-postgres-restore-drill.service"
if grep -Eq 'createdb.*carbonet[^_]|dropdb.*carbonet[^_]' "$script"; then
  echo "production database mutation detected" >&2
  exit 1
fi
echo "POSTGRES_ISOLATED_RESTORE_DRILL_CONTRACT_PASS"
