#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811192500__canonicalize_account_recovery_self_service_relay.sql"

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

snapshot_sql="SELECT jsonb_build_object(
  'definition',(SELECT to_jsonb(d) FROM (
    SELECT process_code,process_version,owner_actor_code,goal,start_condition,completion_condition
    FROM framework_process_definition WHERE process_code='ACCOUNT_LOCK_RECOVERY'
  ) d),
  'steps',(SELECT jsonb_agg(to_jsonb(s) ORDER BY step_code) FROM (
    SELECT step_code,actor_code,user_path,admin_path,requires_user_page,requires_admin_page,
           requires_api,requires_database,requires_notification,from_state,command_code,to_state
    FROM framework_process_step WHERE process_code='ACCOUNT_LOCK_RECOVERY'
  ) s),
  'jobs',(SELECT jsonb_agg(to_jsonb(j) ORDER BY job_id) FROM (
    SELECT job_id,step_code,job_type,job_name,target_path,specification_json,
           job_status,approval_status,required,quality_status,result_json,search_context_ref
    FROM framework_development_job WHERE process_code='ACCOUNT_LOCK_RECOVERY'
  ) j),
  'jobGates',(SELECT jsonb_agg(to_jsonb(g) ORDER BY result_id) FROM (
    SELECT g.* FROM framework_development_job_gate_result g
    JOIN framework_development_job j ON j.job_id=g.job_id
    WHERE j.process_code='ACCOUNT_LOCK_RECOVERY'
  ) g),
  'artifacts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY artifact_id) FROM (
    SELECT * FROM framework_process_artifact
    WHERE process_code='ACCOUNT_LOCK_RECOVERY'
  ) a)
)::text;"

before="$(carbonet_postgres_query "$snapshot_sql")"

# V20260811192500 is an applied, deliberately non-idempotent canonicalization:
# its first execution retires exactly nine legacy jobs. Replaying it against
# the post-state would test an impossible pre-state and fail with updated=0.
# Validate the persisted post-state directly, then exercise evidence mutations
# only inside transactions that are always rolled back.
for token in \
  "retired_jobs<>9" "canonical_jobs<>43" "canonical artifact mismatch" \
  "ACCOUNT_LOCK_RECOVERY stale job gate evidence remains"; do
  grep -Fq "$token" "$MIGRATION" || {
    echo "[account-lock-recovery-relay] FAIL migration contract missing=$token" >&2
    exit 1
  }
done

result="$(carbonet_postgres_query "BEGIN;
SELECT jsonb_build_object(
  'definitionCount',(SELECT count(*) FROM framework_process_definition
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND owner_actor_code='MEMBER_USER'
      AND process_version='3.0.0'),
  'stepCount',(SELECT count(*) FROM framework_process_step WHERE process_code='ACCOUNT_LOCK_RECOVERY'),
  'alignedCount',(SELECT count(*) FROM framework_process_step
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND actor_code='MEMBER_USER'
      AND requires_user_page AND NOT requires_admin_page AND admin_path IS NULL),
  'adminCredentialRelayCount',(SELECT count(*) FROM framework_process_step
    WHERE process_code='ACCOUNT_LOCK_RECOVERY'
      AND (actor_code IN ('MEMBER_ADMIN','APPROVER') OR requires_admin_page OR admin_path IS NOT NULL)),
  'requiredJobs',(SELECT count(*) FROM framework_development_job
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required),
  'retiredJobs',(SELECT count(*) FROM framework_development_job
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND NOT required
      AND result_json::jsonb->>'reason'='RETIRED_DUPLICATE_ADMIN_FLOW'),
  'routeJobs',(SELECT count(*) FROM framework_development_job
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required AND job_type='FRONTEND_USER'
      AND target_path IN ('/signin/findPassword','/signin/findPassword/result')),
  'staleJobSpecs',(SELECT count(*) FROM framework_development_job
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required
      AND specification_json::jsonb->>'contractVersion' IS DISTINCT FROM 'ACCOUNT_LOCK_RECOVERY:3.0.0'),
  'staleJobEvidence',(SELECT count(*) FROM framework_development_job
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required
      AND (job_status<>'PLANNED' OR approval_status<>'DRAFT'
        OR quality_status<>'PENDING' OR evidence_ref IS NOT NULL)),
  'jobGateEvidence',(SELECT count(*) FROM framework_development_job_gate_result g
    JOIN framework_development_job j ON j.job_id=g.job_id
    WHERE j.process_code='ACCOUNT_LOCK_RECOVERY'),
  'requiredArtifacts',(SELECT count(*) FROM framework_process_artifact
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required),
  'alignedArtifacts',(SELECT count(*) FROM framework_process_artifact
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required
      AND artifact_type='PAGE' AND owner_actor_code='MEMBER_USER'
      AND target_path=CASE step_code
        WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END
      AND contract_ref='process://ACCOUNT_LOCK_RECOVERY/3.0.0/'||step_code
      AND delivery_status='PLANNED' AND evidence_ref IS NULL),
  'retiredArtifacts',(SELECT count(*) FROM framework_process_artifact
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND NOT required)
)::text;
ROLLBACK;")"

payload="$(printf '%s\n' "$result" | grep -E '^\{' | tail -n 1)"
jq -e '
  .definitionCount==1 and .stepCount==4 and .alignedCount==4
  and .adminCredentialRelayCount==0 and .requiredJobs==43 and .retiredJobs==9
  and .routeJobs==4 and .staleJobSpecs==0 and .staleJobEvidence==0
  and .jobGateEvidence==0 and .requiredArtifacts==4 and .alignedArtifacts==4
' <<<"$payload" >/dev/null

after="$(carbonet_postgres_query "$snapshot_sql")"
[[ "$before" == "$after" ]] || {
  echo '[account-lock-recovery-relay] FAIL rollback changed persistent data' >&2
  exit 1
}

binding_result="$(carbonet_postgres_query "BEGIN;
DO \$\$
DECLARE
  job_value bigint;
  gate_value text;
  process_version_value text;
  source_commit_value text;
  runtime_identity_hash_value text;
  pod_template_sha256_value text;
  evidence_hash_value text := repeat('a',64);
  nonexistent_hash_value text := repeat('b',64);
  strong_ref text;
  nonexistent_ref text;
  ready_count integer;
BEGIN
  SELECT process_version INTO STRICT process_version_value
  FROM framework_process_definition WHERE process_code='ACCOUNT_LOCK_RECOVERY';
  SELECT source_commit,framework_runtime_release_identity_hash(runtime),pod_template_sha256
  INTO STRICT source_commit_value,runtime_identity_hash_value,pod_template_sha256_value
  FROM framework_runtime_release_state runtime WHERE release_key='CARBONET_RUNTIME';
  SELECT job_id INTO STRICT job_value FROM framework_development_job
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND step_code='ACCOUNT_LOCK_RECOVERY_S1' AND required
  ORDER BY job_id LIMIT 1;
  SELECT gate_code INTO STRICT gate_value FROM framework_quality_gate ORDER BY gate_code LIMIT 1;

  INSERT INTO framework_process_qa_run(
    process_code,step_code,result,evidence_json,executed_by,evidence_type,
    process_version,source_commit,contract_fingerprint,execution_environment,
    evidence_uri,evidence_hash,executed_at
  ) VALUES (
    'ACCOUNT_LOCK_RECOVERY','ACCOUNT_LOCK_RECOVERY_S1','PASSED',jsonb_build_object(
      'contract',jsonb_build_object(
        'processCode','ACCOUNT_LOCK_RECOVERY',
        'stepCode','ACCOUNT_LOCK_RECOVERY_S1',
        'processVersion',process_version_value,
        'contractFingerprint',framework_current_process_step_contract_fingerprint(
          'ACCOUNT_LOCK_RECOVERY','ACCOUNT_LOCK_RECOVERY_S1'),
        'sourceCommit',source_commit_value,
        'runtimeIdentityHash',runtime_identity_hash_value,
        'podTemplateSha256',pod_template_sha256_value
      )
    ),
    'ACCOUNT_RECOVERY_CONTRACT_TEST','BUSINESS_E2E',process_version_value,source_commit_value,
    framework_current_process_step_contract_fingerprint('ACCOUNT_LOCK_RECOVERY','ACCOUNT_LOCK_RECOVERY_S1'),
    'POSTGRES_ROLLBACK','inline://account-recovery-contract-test',evidence_hash_value,
    current_timestamp + interval '1 second'
  );

  strong_ref := 'qa-run:ACCOUNT_LOCK_RECOVERY:'||process_version_value||':'||
    source_commit_value||':sha256:'||evidence_hash_value;
  nonexistent_ref := 'qa-run:ACCOUNT_LOCK_RECOVERY:'||process_version_value||':'||
    source_commit_value||':sha256:'||nonexistent_hash_value;

  UPDATE framework_development_job SET job_status='COMPLETED',approval_status='APPROVED',
    quality_status='PASSED',evidence_ref=nonexistent_ref WHERE job_id=job_value;
  INSERT INTO framework_development_job_gate_result(job_id,gate_code,result,evidence_ref)
  VALUES (job_value,gate_value,'PASSED',nonexistent_ref);

  SELECT count(*) INTO ready_count FROM framework_development_job j
  WHERE j.job_id=job_value
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=j.process_code AND e.step_code=j.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND j.evidence_ref='qa-run:'||j.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash)
    AND EXISTS (SELECT 1 FROM framework_development_job_gate_result g
      WHERE g.job_id=j.job_id AND g.result='PASSED' AND g.evidence_ref=j.evidence_ref);
  IF ready_count<>0 THEN RAISE EXCEPTION 'well-formed nonexistent job evidence was accepted'; END IF;

  UPDATE framework_development_job SET evidence_ref=strong_ref WHERE job_id=job_value;
  SELECT count(*) INTO ready_count FROM framework_development_job j
  WHERE j.job_id=job_value
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=j.process_code AND e.step_code=j.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND j.evidence_ref='qa-run:'||j.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash)
    AND EXISTS (SELECT 1 FROM framework_development_job_gate_result g
      WHERE g.job_id=j.job_id AND g.result='PASSED' AND g.evidence_ref=j.evidence_ref);
  IF ready_count<>0 THEN RAISE EXCEPTION 'mismatched gate evidence was accepted'; END IF;

  UPDATE framework_development_job_gate_result SET evidence_ref=strong_ref WHERE job_id=job_value;
  SELECT count(*) INTO ready_count FROM framework_development_job j
  WHERE j.job_id=job_value
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=j.process_code AND e.step_code=j.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND j.evidence_ref='qa-run:'||j.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash)
    AND EXISTS (SELECT 1 FROM framework_development_job_gate_result g
      WHERE g.job_id=j.job_id AND g.result='PASSED' AND g.evidence_ref=j.evidence_ref);
  IF ready_count<>1 THEN RAISE EXCEPTION 'matching current job evidence was rejected'; END IF;

  UPDATE framework_process_artifact SET delivery_status='COMPLETED',evidence_ref=nonexistent_ref
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND step_code='ACCOUNT_LOCK_RECOVERY_S1' AND required;
  SELECT count(*) INTO ready_count FROM framework_process_artifact a
  WHERE a.process_code='ACCOUNT_LOCK_RECOVERY' AND a.step_code='ACCOUNT_LOCK_RECOVERY_S1' AND a.required
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=a.process_code AND e.step_code=a.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND a.evidence_ref='qa-run:'||a.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash);
  IF ready_count<>0 THEN RAISE EXCEPTION 'well-formed nonexistent artifact evidence was accepted'; END IF;

  UPDATE framework_process_artifact SET evidence_ref=strong_ref
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND step_code='ACCOUNT_LOCK_RECOVERY_S1' AND required;
  SELECT count(*) INTO ready_count FROM framework_process_artifact a
  WHERE a.process_code='ACCOUNT_LOCK_RECOVERY' AND a.step_code='ACCOUNT_LOCK_RECOVERY_S1' AND a.required
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=a.process_code AND e.step_code=a.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND a.evidence_ref='qa-run:'||a.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash);
  IF ready_count<>1 THEN RAISE EXCEPTION 'matching current artifact evidence was rejected'; END IF;
END \$\$;
SELECT 'EVIDENCE_BINDING_OK';
ROLLBACK;")"
grep -qx 'EVIDENCE_BINDING_OK' <<<"$binding_result"

lock_result="$(carbonet_postgres_query "BEGIN ISOLATION LEVEL SERIALIZABLE;
DO \$\$
DECLARE
  process_version_value text;
  source_commit_value text;
  runtime_identity_hash_value text;
  pod_template_sha256_value text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ACCOUNT_LOCK_RECOVERY:ASSURANCE'));
  SELECT process_version INTO STRICT process_version_value
  FROM framework_process_definition WHERE process_code='ACCOUNT_LOCK_RECOVERY' FOR SHARE;
  SELECT source_commit,framework_runtime_release_identity_hash(runtime),pod_template_sha256
  INTO STRICT source_commit_value,runtime_identity_hash_value,pod_template_sha256_value
  FROM framework_runtime_release_state runtime WHERE release_key='CARBONET_RUNTIME' FOR SHARE;
  PERFORM q.qa_run_id FROM framework_process_qa_run q
  WHERE q.process_code='ACCOUNT_LOCK_RECOVERY' AND q.evidence_type='BUSINESS_E2E'
    AND q.process_version=process_version_value AND q.source_commit=source_commit_value
  FOR SHARE OF q;
  PERFORM r.run_id FROM framework_simulation_run r
  JOIN framework_simulation_case c ON c.case_code=r.case_code
  WHERE c.process_code='ACCOUNT_LOCK_RECOVERY' AND r.process_version=process_version_value
    AND r.source_commit=source_commit_value
    AND r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value
    AND r.evidence_json::jsonb->>'podTemplateSha256'=pod_template_sha256_value
  FOR SHARE OF r;
  PERFORM g.result_id FROM framework_development_job_gate_result g
  JOIN framework_development_job j ON j.job_id=g.job_id
  WHERE j.process_code='ACCOUNT_LOCK_RECOVERY' AND j.required
  FOR SHARE OF g;
END \$\$;
SELECT 'EVIDENCE_LOCKS_OK';
ROLLBACK;")"
grep -qx 'EVIDENCE_LOCKS_OK' <<<"$lock_result"

final_state="$(carbonet_postgres_query "$snapshot_sql")"
[[ "$before" == "$final_state" ]] || {
  echo '[account-lock-recovery-relay] FAIL evidence rollback changed persistent data' >&2
  exit 1
}

echo '[account-lock-recovery-relay] POSTGRES_POST_STATE_PASS appliedMigrationReplay=0 steps=4 routes=4 requiredJobs=43 retiredJobs=9 artifacts=4 gateEvidence=0 evidenceBinding=currentBusinessE2E evidenceLocks=serializable owner=MEMBER_USER persistentWrites=0'
