#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811194000__fail_close_account_recovery_until_assured.sql"

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

migration_sql="$(<"$MIGRATION")"
snapshot_sql="SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY process_code)::text,'[]')
FROM framework_process_definition d WHERE process_code='ACCOUNT_LOCK_RECOVERY';"
before="$(carbonet_postgres_query "$snapshot_sql")"

result="$(carbonet_postgres_query "BEGIN;
$migration_sql
SELECT jsonb_build_object(
  'definitionCount',(SELECT count(*) FROM framework_process_definition
    WHERE process_code='ACCOUNT_LOCK_RECOVERY'),
  'versionCount',(SELECT count(*) FROM framework_process_definition
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND process_version='3.0.0'),
  'gatedCount',(SELECT count(*) FROM framework_process_definition
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND process_version='3.0.0'
      AND process_status='IN_DEVELOPMENT' AND definition_locked),
  'processStatus',(SELECT process_status FROM framework_process_definition
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND process_version='3.0.0'),
  'definitionLocked',(SELECT definition_locked FROM framework_process_definition
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND process_version='3.0.0')
)::text;
ROLLBACK;")"

payload="$(printf '%s\n' "$result" | grep -E '^\{' | tail -n 1)"
jq -e '
  .definitionCount==1 and .versionCount==1 and .gatedCount==1
  and .processStatus=="IN_DEVELOPMENT" and .definitionLocked==true
' <<<"$payload" >/dev/null

after="$(carbonet_postgres_query "$snapshot_sql")"
[[ "$before" == "$after" ]] || {
  echo '[account-lock-recovery-status-gate] FAIL positive rollback changed persistent data' >&2
  exit 1
}

# The migration must refuse unexpected version, lifecycle status, or lock state
# instead of silently repairing corrupt design truth. Each failing database
# session closes its transaction, so the mutation is rolled back.
assert_pre_state_rejected() {
  local label="$1"
  local mutation_sql="$2"
  local negative_output negative_status after_negative

  set +e
  negative_output="$(carbonet_postgres_query "BEGIN;
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
$mutation_sql
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;
$migration_sql
ROLLBACK;" 2>&1)"
  negative_status=$?
  set -e
  if [[ $negative_status -eq 0 ]]; then
    echo "[account-lock-recovery-status-gate] FAIL $label was accepted" >&2
    exit 1
  fi
  grep -Fq 'ACCOUNT_LOCK_RECOVERY definition/version/pre-state mismatch' <<<"$negative_output" || {
    echo "[account-lock-recovery-status-gate] FAIL $label did not hit exact pre-state guard" >&2
    exit 1
  }

  after_negative="$(carbonet_postgres_query "$snapshot_sql")"
  [[ "$before" == "$after_negative" ]] || {
    echo "[account-lock-recovery-status-gate] FAIL $label rollback changed persistent data" >&2
    exit 1
  }
}

assert_pre_state_rejected unexpected-version \
  "UPDATE framework_process_definition SET process_version='9.9.9-UNEXPECTED' WHERE process_code='ACCOUNT_LOCK_RECOVERY';"
assert_pre_state_rejected draft-status \
  "UPDATE framework_process_definition SET process_status='DRAFT' WHERE process_code='ACCOUNT_LOCK_RECOVERY';"
assert_pre_state_rejected unlocked-definition \
  "UPDATE framework_process_definition SET definition_locked=false WHERE process_code='ACCOUNT_LOCK_RECOVERY';"

echo '[account-lock-recovery-status-gate] POSTGRES_ROLLBACK_PASS definitions=1 version3=1 status=IN_DEVELOPMENT locked=true unexpectedVersion=blocked draft=blocked unlocked=blocked persistentWrites=0'
