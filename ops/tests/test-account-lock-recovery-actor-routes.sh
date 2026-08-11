#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811192500__canonicalize_account_recovery_self_service_relay.sql"

for contract in \
  "step_code='ACCOUNT_LOCK_RECOVERY_S1'" \
  "user_path='/signin/findPassword'" \
  "step_code='ACCOUNT_LOCK_RECOVERY_S4'" \
  "user_path='/signin/findPassword/result'" \
  "actor_code='MEMBER_USER'" \
  'requires_user_page=true' \
  'requires_admin_page=false' \
  "command_code='COMPLETE_ACCOUNT_RECOVERY'" \
  "command_code='NAVIGATE_TO_LOGIN'" \
  "to_state='PASSWORD_CHANGED'" \
  "from_state='PASSWORD_CHANGED'" \
  "process_version='3.0.0'" \
  "retired_jobs<>9" \
  "canonical_jobs<>43" \
  "'contractVersion','ACCOUNT_LOCK_RECOVERY:3.0.0'" \
  'step_total<>4 OR expected_step_total<>4' \
  'definition_total<>1' \
  'invalid<>0'; do
  grep -Fq "$contract" "$MIGRATION" || {
    echo "[account-lock-recovery-actor-routes] FAIL missing=$contract" >&2
    exit 1
  }
done

if grep -Eq "actor_code='(MEMBER_ADMIN|APPROVER)'|requires_admin_page=true|admin_path='/admin" "$MIGRATION"; then
  echo '[account-lock-recovery-actor-routes] FAIL administrative credential relay remains' >&2
  exit 1
fi

echo '[account-lock-recovery-actor-routes] PASS public=4 admin=0 requiredJobs=43 retiredJobs=9 credentialBypass=0 blockers=fail-closed'
