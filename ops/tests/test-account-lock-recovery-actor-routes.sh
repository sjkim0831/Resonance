#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811152000__align_account_lock_recovery_actor_routes.sql"

for contract in \
  "step_code = 'ACCOUNT_LOCK_RECOVERY_S1'" \
  "user_path = '/signin/findPassword'" \
  "step_code IN ('ACCOUNT_LOCK_RECOVERY_S3', 'ACCOUNT_LOCK_RECOVERY_S4')" \
  'requires_user_page = false' \
  'user_path = NULL' \
  'requires_admin_page = true' \
  'invalid_actor_route_count <> 0 OR blocker_count <> 0'; do
  grep -Fq "$contract" "$MIGRATION" || {
    echo "[account-lock-recovery-actor-routes] FAIL missing=$contract" >&2
    exit 1
  }
done

if grep -Eq "ACCOUNT_LOCK_RECOVERY_S3.*requires_user_page[[:space:]]*=[[:space:]]*true|ACCOUNT_LOCK_RECOVERY_S4.*requires_user_page[[:space:]]*=[[:space:]]*true" "$MIGRATION"; then
  echo '[account-lock-recovery-actor-routes] FAIL admin step requires a user page' >&2
  exit 1
fi

echo '[account-lock-recovery-actor-routes] PASS public=2 admin-only=2 blockers=fail-closed'
