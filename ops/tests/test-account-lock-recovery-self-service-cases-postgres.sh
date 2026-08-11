#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811201000__canonicalize_account_recovery_self_service_cases.sql"

for token in \
  GENERIC_HTTP_202 APPLICATION_LEVEL_FAIL FIVE_ATTEMPT_LOCK \
  SINGLE_USE_PROOF SESSION_REVOCATION ONE_SHOT_RESULT \
  OLD_ACCESS_JWT_REJECTED SAFE_RETRY_RESEND \
  AMBIGUOUS_SUBJECT_SUPPRESSION EXACTLY_ONCE_IDEMPOTENCY \
  ASYNC_TIMING_SAFE_DELIVERY PRESERVE_VALID_PROOF_ON_DUPLICATE_VERIFY \
  ATOMIC_RATE_LIMITS TRUSTED_PROXY_IDENTITY RESEND_INVALIDATES_PREVIOUS \
  ACCOUNT_LOCK_RECOVERY_HAPPY ACCOUNT_LOCK_RECOVERY_EXCEPTION \
  ACCOUNT_LOCK_RECOVERY_AUTHORITY ACCOUNT_LOCK_RECOVERY_ISOLATION \
  ACCOUNT_LOCK_RECOVERY_RECOVERY ACCOUNT_LOCK_RECOVERY_ENUMERATION \
  ACCOUNT_LOCK_RECOVERY_REPLAY ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE \
  "process_status='IN_DEVELOPMENT'" "definition_locked" \
  "DELETE FROM framework_simulation_run" "automated=false" \
  "jsonb_typeof(steps_json::jsonb)<>'array'" \
  'jsonb_array_length(steps_json::jsonb)=0' \
  "jsonb_typeof(assertions_json::jsonb)<>'array'" \
  'jsonb_array_length(assertions_json::jsonb)=0'; do
  grep -Fq "$token" "$MIGRATION" || {
    echo "[account-recovery-self-service-cases] FAIL static token missing=$token" >&2
    exit 1
  }
done

for obsolete in MEMBER_ADMIN APPROVER /admin/api/member-recovery "관리자 위험 검토" "분리 승인"; do
  if grep -F "$obsolete" "$MIGRATION" | grep -v "(MEMBER_ADMIN|APPROVER|/admin/api/member-recovery|관리자 위험 검토|분리 승인)" >/dev/null; then
    echo "[account-recovery-self-service-cases] FAIL obsolete relay remains=$obsolete" >&2
    exit 1
  fi
done

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init
migration_sql="$(<"$MIGRATION")"

snapshot_sql="SELECT jsonb_build_object(
  'cases',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY case_code),'[]'::jsonb)
    FROM framework_simulation_case c WHERE process_code='ACCOUNT_LOCK_RECOVERY'),
  'runs',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY run_id),'[]'::jsonb)
    FROM framework_simulation_run r JOIN framework_simulation_case c USING(case_code)
    WHERE c.process_code='ACCOUNT_LOCK_RECOVERY'))::text;"
before="$(carbonet_postgres_query "$snapshot_sql")"

result="$(carbonet_postgres_query "BEGIN;
$migration_sql
SELECT jsonb_build_object(
  'caseCount',(SELECT count(*) FROM framework_simulation_case WHERE process_code='ACCOUNT_LOCK_RECOVERY'),
  'typeCount',(SELECT count(DISTINCT case_type) FROM framework_simulation_case WHERE process_code='ACCOUNT_LOCK_RECOVERY'),
  'approvedCount',(SELECT count(*) FROM framework_simulation_case
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND case_status='APPROVED'),
  'automatedCount',(SELECT count(*) FROM framework_simulation_case
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND automated),
  'staleRunCount',(SELECT count(*) FROM framework_simulation_run r
    JOIN framework_simulation_case c USING(case_code)
    WHERE c.process_code='ACCOUNT_LOCK_RECOVERY'),
  'professionalTargetCount',(SELECT count(*) FROM framework_simulation_case
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND CASE case_code
      WHEN 'ACCOUNT_LOCK_RECOVERY_HAPPY' THEN
        (preconditions||assertions_json||required_evidence) LIKE '%OLD_ACCESS_JWT_REJECTED%'
      WHEN 'ACCOUNT_LOCK_RECOVERY_EXCEPTION' THEN
        (preconditions||steps_json||assertions_json||required_evidence) LIKE '%SAFE_RETRY_RESEND%'
      WHEN 'ACCOUNT_LOCK_RECOVERY_AUTHORITY' THEN
        (steps_json||assertions_json||required_evidence) LIKE '%client userId%API 필수값도 아님%'
      WHEN 'ACCOUNT_LOCK_RECOVERY_ISOLATION' THEN
        (preconditions||assertions_json||required_evidence) LIKE '%AMBIGUOUS_SUBJECT_SUPPRESSION%'
      WHEN 'ACCOUNT_LOCK_RECOVERY_RECOVERY' THEN
        (preconditions||assertions_json||required_evidence) LIKE '%EXACTLY_ONCE_IDEMPOTENCY%'
      WHEN 'ACCOUNT_LOCK_RECOVERY_ENUMERATION' THEN
        (preconditions||steps_json||assertions_json||required_evidence) LIKE '%ASYNC_TIMING_SAFE_DELIVERY%'
      WHEN 'ACCOUNT_LOCK_RECOVERY_REPLAY' THEN
        (preconditions||steps_json||assertions_json||required_evidence) LIKE '%PRESERVE_VALID_PROOF_ON_DUPLICATE_VERIFY%'
      WHEN 'ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE' THEN
        (preconditions||steps_json||assertions_json||required_evidence)
          LIKE '%ATOMIC_RATE_LIMITS%TRUSTED_PROXY_IDENTITY%RESEND_INVALIDATES_PREVIOUS%'
      ELSE false END),
  'types',(SELECT jsonb_object_agg(case_type,type_count) FROM (
    SELECT case_type,count(*) AS type_count FROM framework_simulation_case
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' GROUP BY case_type ORDER BY case_type) t)
)::text;
ROLLBACK;")"

payload="$(printf '%s\n' "$result" | grep -E '^\{' | tail -n 1)"
jq -e '
  .caseCount==8 and .typeCount==6 and .approvedCount==8
  and .automatedCount==0 and .staleRunCount==0 and .professionalTargetCount==8
  and .types=={
    AUTHORITY:1,EXCEPTION:1,HAPPY_PATH:1,ISOLATION:1,RECOVERY:1,VALIDATION:3
  }
' <<<"$payload" >/dev/null

after="$(carbonet_postgres_query "$snapshot_sql")"
[[ "$before" == "$after" ]] || {
  echo '[account-recovery-self-service-cases] FAIL positive rollback changed persistent data' >&2
  exit 1
}

assert_pre_state_rejected() {
  local label="$1"
  local mutation_sql="$2"
  local expected_message="$3"
  local output status after_negative

  set +e
  output="$(carbonet_postgres_query "BEGIN;
$mutation_sql
$migration_sql
ROLLBACK;" 2>&1)"
  status=$?
  set -e
  if [[ $status -eq 0 ]]; then
    echo "[account-recovery-self-service-cases] FAIL $label was accepted" >&2
    exit 1
  fi
  grep -Fq "$expected_message" <<<"$output" || {
    echo "[account-recovery-self-service-cases] FAIL $label missed fail-closed guard" >&2
    exit 1
  }
  after_negative="$(carbonet_postgres_query "$snapshot_sql")"
  [[ "$before" == "$after_negative" ]] || {
    echo "[account-recovery-self-service-cases] FAIL $label rollback changed persistent data" >&2
    exit 1
  }
}

assert_pre_state_rejected unexpected-version \
  "ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
   UPDATE framework_process_definition SET process_version='9.9.9-UNEXPECTED'
   WHERE process_code='ACCOUNT_LOCK_RECOVERY';
   ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;" \
  'ACCOUNT_LOCK_RECOVERY case definition/version/status/lock mismatch'

assert_pre_state_rejected draft-status \
  "ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
   UPDATE framework_process_definition SET process_status='DRAFT'
   WHERE process_code='ACCOUNT_LOCK_RECOVERY';
   ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;" \
  'ACCOUNT_LOCK_RECOVERY case definition/version/status/lock mismatch'

assert_pre_state_rejected unlocked-definition \
  "ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
   UPDATE framework_process_definition SET definition_locked=false
   WHERE process_code='ACCOUNT_LOCK_RECOVERY';
   ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;" \
  'ACCOUNT_LOCK_RECOVERY case definition/version/status/lock mismatch'

assert_pre_state_rejected missing-case \
  "ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;
   DELETE FROM framework_simulation_case WHERE case_code='ACCOUNT_LOCK_RECOVERY_REPLAY';
   ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;" \
  'ACCOUNT_LOCK_RECOVERY exact approved case set mismatch'

# Exercise the same cast/type/length predicates used by the migration's final
# guard after deliberately corrupting one post-migration row. The enclosing
# transaction must abort and restore the already-applied truth exactly.
set +e
malformed_output="$(carbonet_postgres_query "BEGIN;
$migration_sql
ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;
UPDATE framework_simulation_case SET steps_json='not-json'
WHERE case_code='ACCOUNT_LOCK_RECOVERY_HAPPY';
ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;
SELECT count(*) FROM framework_simulation_case
WHERE process_code='ACCOUNT_LOCK_RECOVERY'
  AND (jsonb_typeof(steps_json::jsonb)<>'array'
    OR jsonb_array_length(steps_json::jsonb)=0
    OR jsonb_typeof(assertions_json::jsonb)<>'array'
    OR jsonb_array_length(assertions_json::jsonb)=0);
ROLLBACK;" 2>&1)"
malformed_status=$?
set -e
if [[ $malformed_status -eq 0 ]]; then
  echo '[account-recovery-self-service-cases] FAIL malformed JSON was accepted' >&2
  exit 1
fi
grep -Fq 'invalid input syntax for type json' <<<"$malformed_output" || {
  echo '[account-recovery-self-service-cases] FAIL malformed JSON missed JSON guard' >&2
  exit 1
}
after_malformed="$(carbonet_postgres_query "$snapshot_sql")"
[[ "$before" == "$after_malformed" ]] || {
  echo '[account-recovery-self-service-cases] FAIL malformed JSON rollback changed persistent data' >&2
  exit 1
}

echo '[account-recovery-self-service-cases] POSTGRES_ROLLBACK_PASS cases=8 types=6 professionalTargets=8 approved=8 automated=0 staleRuns=0 jsonArrays=validNonempty malformedJson=blocked version3=1 status=IN_DEVELOPMENT locked=true corruptVersion=blocked draft=blocked unlocked=blocked missingCase=blocked persistentWrites=0'
