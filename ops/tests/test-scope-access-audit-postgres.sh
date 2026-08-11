#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812033000__harden_scope_access_audit_append_only.sql"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"

[[ -f "$MIGRATION" ]]
leader="${RESONANCE_POSTGRES_LEADER_POD:-$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"
[[ -n "$leader" ]]

db_scalar() {
  kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -Atqc "$1"
}

baseline_digest="$(db_scalar "SELECT count(*)::text||'|'||coalesce(min(audit_id),0)::text||'|'||coalesce(max(audit_id),0)::text||'|'||coalesce(md5(string_agg(md5(concat_ws('|',audit_id,account_id,tenant_id,project_id,decision_code,reason_code,created_at::text)),'' ORDER BY audit_id)),'') FROM framework_scope_access_audit")"
baseline_sequence="$(db_scalar "SELECT last_value::text||'|'||is_called::text FROM framework_scope_access_audit_audit_id_seq")"

{
  printf '%s\n' "BEGIN;" "SET LOCAL lock_timeout='5s';" "SET LOCAL statement_timeout='60s';"
  cat "$MIGRATION"
  # The second execution in the same transaction proves repair/rehearsal
  # idempotence while the first execution's append-only triggers already exist.
  cat "$MIGRATION"
  cat <<'SQL'

DO $$
DECLARE
  column_count integer;
  constraint_count integer;
  trigger_count integer;
  function_count integer;
BEGIN
  SELECT count(*) INTO column_count
    FROM pg_attribute
   WHERE attrelid='framework_scope_access_audit'::regclass
     AND attname IN ('action_code','resource_type','outcome_code','schema_version','row_hash')
     AND attnotnull AND NOT attisdropped;
  IF column_count<>5 THEN RAISE EXCEPTION 'required audit columns not-null mismatch: %/5',column_count; END IF;
  IF (SELECT attgenerated FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='outcome_code')<>'s' THEN
    RAISE EXCEPTION 'outcome_code is not database-generated';
  END IF;
  SELECT count(*) INTO constraint_count
    FROM pg_constraint
   WHERE conrelid='framework_scope_access_audit'::regclass
     AND conname IN ('chk_scope_access_audit_action','chk_scope_access_audit_resource','chk_scope_access_audit_schema_version','chk_scope_access_audit_row_hash')
     AND convalidated;
  IF constraint_count<>4 THEN RAISE EXCEPTION 'audit constraint mismatch: %/4',constraint_count; END IF;
  SELECT count(*) INTO trigger_count
    FROM pg_trigger
   WHERE tgrelid='framework_scope_access_audit'::regclass
     AND tgname IN ('trg_scope_access_audit_prepare_insert','trg_scope_access_audit_reject_row_mutation','trg_scope_access_audit_reject_truncate')
     AND tgenabled='O' AND NOT tgisinternal;
  IF trigger_count<>3 THEN RAISE EXCEPTION 'audit trigger mismatch: %/3',trigger_count; END IF;
  SELECT count(*) INTO function_count FROM pg_proc WHERE proname IN ('framework_scope_access_audit_hash','framework_prepare_scope_access_audit_insert','framework_reject_scope_access_audit_mutation');
  IF function_count<>3 THEN RAISE EXCEPTION 'audit function mismatch: %/3',function_count; END IF;
  IF EXISTS (
    SELECT 1 FROM framework_scope_access_audit
     WHERE row_hash<>framework_scope_access_audit_hash(
       audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
       action_code,resource_type,outcome_code,schema_version,created_at)
  ) THEN RAISE EXCEPTION 'legacy audit row hash drift'; END IF;
END
$$;

INSERT INTO framework_scope_access_audit(
  audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
  action_code,resource_type,schema_version,row_hash,created_at
) VALUES (
  -9000000000000000001,'wrong.actor','TENANT-TEST','PRJ-TEST','DENIED',
  'ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER','regulatory_submission_transition',
  'regulatory_submission',99,repeat('0',64),timestamp '2026-08-12 03:30:00'
);

INSERT INTO framework_scope_access_audit(
  audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
  action_code,resource_type,created_at
) VALUES (
  -9000000000000000002,'wrong.actor','TENANT-TEST','PRJ-TEST','DENIED',
  'ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER','REGULATORY_SUBMISSION_TRANSITION',
  'REGULATORY_SUBMISSION',timestamp '2026-08-12 03:30:00.000001'
);

DO $$
DECLARE
  first_hash text;
  second_hash text;
  update_blocked boolean:=false;
  delete_blocked boolean:=false;
  truncate_blocked boolean:=false;
  invalid_action_blocked boolean:=false;
BEGIN
  SELECT row_hash INTO first_hash FROM framework_scope_access_audit WHERE audit_id=-9000000000000000001;
  SELECT row_hash INTO second_hash FROM framework_scope_access_audit WHERE audit_id=-9000000000000000002;
  IF first_hash !~ '^[0-9a-f]{64}$' OR second_hash !~ '^[0-9a-f]{64}$' OR first_hash=second_hash THEN
    RAISE EXCEPTION 'retry integrity binding mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM framework_scope_access_audit
     WHERE audit_id=-9000000000000000001
       AND (action_code<>'REGULATORY_SUBMISSION_TRANSITION'
         OR resource_type<>'REGULATORY_SUBMISSION'
         OR outcome_code<>'ACCESS_DENIED' OR schema_version<>2 OR row_hash=repeat('0',64))
  ) THEN RAISE EXCEPTION 'server/DB derived audit fields mismatch'; END IF;
  IF (SELECT count(*) FROM framework_scope_access_audit WHERE audit_id IN (-9000000000000000001,-9000000000000000002))<>2 THEN
    RAISE EXCEPTION 'one-row-per-attempt cardinality mismatch';
  END IF;

  BEGIN
    UPDATE framework_scope_access_audit SET reason_code='tampered' WHERE audit_id=-9000000000000000001;
  EXCEPTION WHEN SQLSTATE '55000' THEN update_blocked:=true;
  END;
  BEGIN
    DELETE FROM framework_scope_access_audit WHERE audit_id=-9000000000000000001;
  EXCEPTION WHEN SQLSTATE '55000' THEN delete_blocked:=true;
  END;
  BEGIN
    TRUNCATE framework_scope_access_audit;
  EXCEPTION WHEN SQLSTATE '55000' THEN truncate_blocked:=true;
  END;
  BEGIN
    INSERT INTO framework_scope_access_audit(
      audit_id,account_id,tenant_id,project_id,decision_code,reason_code,action_code,resource_type
    ) VALUES (-9000000000000000003,'x','T','P','DENIED','X','CLIENT_SUPPLIED_ACTION','EMISSION_PROJECT');
  EXCEPTION WHEN check_violation THEN invalid_action_blocked:=true;
  END;
  IF NOT update_blocked OR NOT delete_blocked OR NOT truncate_blocked OR NOT invalid_action_blocked THEN
    RAISE EXCEPTION 'append-only/drift rejection mismatch: update %, delete %, truncate %, invalid action %',
      update_blocked,delete_blocked,truncate_blocked,invalid_action_blocked;
  END IF;
END
$$;

ROLLBACK;
\echo SCOPE_ACCESS_AUDIT_POSTGRES_TRANSACTION_PASS
SQL
} | kubectl -n "$NAMESPACE" exec -i "$leader" -c "$CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -v ON_ERROR_STOP=1

after_digest="$(db_scalar "SELECT count(*)::text||'|'||coalesce(min(audit_id),0)::text||'|'||coalesce(max(audit_id),0)::text||'|'||coalesce(md5(string_agg(md5(concat_ws('|',audit_id,account_id,tenant_id,project_id,decision_code,reason_code,created_at::text)),'' ORDER BY audit_id)),'') FROM framework_scope_access_audit")"
after_sequence="$(db_scalar "SELECT last_value::text||'|'||is_called::text FROM framework_scope_access_audit_audit_id_seq")"

[[ "$after_digest" == "$baseline_digest" ]]
[[ "$after_sequence" == "$baseline_sequence" ]]
printf 'SCOPE_ACCESS_AUDIT_POSTGRES_PASS rows_unchanged=1 sequence_unchanged=1 migration_replay=1 exact_catalog=1 update_delete_truncate_blocked=1 retries_distinct=1\n'
