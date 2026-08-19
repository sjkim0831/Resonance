#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812023000__stage_and_atomically_promote_postdeploy_evidence.sql"
SCOPE_AUDIT_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812033000__harden_scope_access_audit_append_only.sql"
LIFECYCLE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812080000__bind_postdeploy_attempt_lifecycle.sql"
RUNTIME_TEMPLATE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql"
HPA_STABLE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260818151500__make_runtime_identity_hpa_stable.sql"
DEPLOY_IDENTITY_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260819231000__allow_deploy_identity_only_operational_gate.sql"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
SOURCE_COMMIT="${POSTDEPLOY_CANDIDATE_TEST_COMMIT:-$(git -C "$ROOT" rev-parse HEAD)}"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]]
[[ -s "$MIGRATION" && -s "$SCOPE_AUDIT_MIGRATION" && -s "$LIFECYCLE_MIGRATION" && -s "$RUNTIME_TEMPLATE_MIGRATION" && -s "$HPA_STABLE_MIGRATION" && -s "$DEPLOY_IDENTITY_MIGRATION" ]]
leader="${RESONANCE_POSTGRES_LEADER_POD:-$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"
[[ -n "$leader" ]]

{
printf '%s\n' "BEGIN;" "SET LOCAL lock_timeout='5s';" "SET LOCAL statement_timeout='120s';"
cat "$MIGRATION"
cat "$SCOPE_AUDIT_MIGRATION"
cat "$LIFECYCLE_MIGRATION"
cat <<'SQL'
CREATE TEMP TABLE system_usage_review_identity_before ON COMMIT DROP AS
SELECT review_id,to_jsonb(review)->>'runtime_identity_hash' runtime_identity_hash
  FROM framework_system_usage_review review;

-- Make the audited backfill invariant repeatable after the additive migration
-- has already shipped. Dynamic SQL keeps the same harness valid before the
-- column exists; the surrounding transaction restores the live singleton.
DO $reset_runtime_template$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid='framework_runtime_release_state'::regclass
       AND attname='pod_template_sha256' AND NOT attisdropped
  ) THEN
    EXECUTE 'UPDATE framework_runtime_release_state SET pod_template_sha256=NULL WHERE release_key=''CARBONET_RUNTIME''';
  END IF;
END
$reset_runtime_template$;

-- Seed the exact audited pre-migration singleton. The additive migration must
-- bind only this legacy authority before any candidate row overwrites it.
INSERT INTO framework_runtime_release_state(
  release_key,source_commit,deployment_namespace,deployment_name,deployment_uid,
  deployment_generation,observed_generation,desired_replicas,image_ref,image_id,
  health_status,recorded_by
) VALUES (
  'CARBONET_RUNTIME','76a08e672ab7054914ec3b5aecb57bc8e7a298fa',
  'carbonet-prod','carbonet-runtime','5a9323d6-446c-49d2-ad3e-c300c18f5803',
  6767,6767,2,'localhost:5000/carbonet-runtime:2026.08.14-202346-gradle',
  'sha256:48311ffbb0396684021efc84811c73432263850ce18c4d4412eb81151749e160',
  'UP','CANDIDATE_PROMOTION_TEST_LEGACY'
)
ON CONFLICT (release_key) DO UPDATE SET
  source_commit=excluded.source_commit,deployment_namespace=excluded.deployment_namespace,
  deployment_name=excluded.deployment_name,deployment_uid=excluded.deployment_uid,
  deployment_generation=excluded.deployment_generation,observed_generation=excluded.observed_generation,
  desired_replicas=excluded.desired_replicas,image_ref=excluded.image_ref,image_id=excluded.image_id,
  health_status=excluded.health_status,recorded_by=excluded.recorded_by,recorded_at=current_timestamp;
SQL
cat "$RUNTIME_TEMPLATE_MIGRATION"
cat "$HPA_STABLE_MIGRATION"
cat "$DEPLOY_IDENTITY_MIGRATION"
cat <<'SQL'
SELECT set_config('resonance.postdeploy_test_commit',:'source_commit',false);

DO $$
DECLARE base_hash varchar(64); scaled_hash varchar(64); drift_hash varchar(64);
BEGIN
  base_hash:=framework_candidate_runtime_identity_hash_v2(
    current_setting('resonance.postdeploy_test_commit'),'carbonet-prod','carbonet-runtime',
    'hpa-stable-uid',7,7,1,'registry.invalid/runtime:target',
    'sha256:'||repeat('a',64),repeat('b',64));
  scaled_hash:=framework_candidate_runtime_identity_hash_v2(
    current_setting('resonance.postdeploy_test_commit'),'carbonet-prod','carbonet-runtime',
    'hpa-stable-uid',9,9,3,'registry.invalid/runtime:target',
    'sha256:'||repeat('a',64),repeat('b',64));
  drift_hash:=framework_candidate_runtime_identity_hash_v2(
    current_setting('resonance.postdeploy_test_commit'),'carbonet-prod','carbonet-runtime',
    'hpa-stable-uid',9,9,3,'registry.invalid/runtime:target',
    'sha256:'||repeat('a',64),repeat('c',64));
  IF base_hash IS NULL OR base_hash IS DISTINCT FROM scaled_hash THEN
    RAISE EXCEPTION 'HPA scale changed immutable candidate identity';
  END IF;
  IF drift_hash IS NULL OR drift_hash IS NOT DISTINCT FROM base_hash THEN
    RAISE EXCEPTION 'PodTemplate drift did not change immutable candidate identity';
  END IF;
END
$$;

DO $$
DECLARE nullable_column boolean; protected boolean;
BEGIN
  SELECT NOT attribute.attnotnull INTO nullable_column
    FROM pg_attribute attribute
   WHERE attribute.attrelid='framework_system_usage_review'::regclass
     AND attribute.attname='runtime_identity_hash' AND NOT attribute.attisdropped;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint constraint_row
     WHERE constraint_row.conrelid='framework_system_usage_review'::regclass
       AND constraint_row.contype='c'
       AND pg_get_expr(constraint_row.conbin,constraint_row.conrelid)
           LIKE '%runtime_identity_hash%^[0-9a-f]{64}$%'
  ) INTO protected;
  IF nullable_column IS DISTINCT FROM true OR protected IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'system usage review runtime identity nullable/lowerhex contract is missing';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM system_usage_review_identity_before before_identity
      JOIN framework_system_usage_review review USING(review_id)
     WHERE review.runtime_identity_hash IS DISTINCT FROM before_identity.runtime_identity_hash
  ) THEN
    RAISE EXCEPTION 'migration rewrote historical system usage review runtime identities';
  END IF;
END
$$;

DO $$
DECLARE
  test_process text;
  test_step text;
  test_version text;
  runtime_source text;
  captured_runtime_hash text;
  before_review_count bigint;
  before_job_count bigint;
  null_writer_rejected boolean:=false;
  template_drift_rejected boolean:=false;
BEGIN
  SELECT process.process_code,step.step_code,process.process_version
    INTO STRICT test_process,test_step,test_version
    FROM framework_process_definition process
    JOIN framework_process_step step USING(process_code)
   ORDER BY process.process_code,step.step_code
   LIMIT 1;
  SELECT runtime.source_commit,framework_runtime_release_identity_hash(runtime)
    INTO STRICT runtime_source,captured_runtime_hash
    FROM framework_runtime_release_state runtime
   WHERE runtime.release_key='CARBONET_RUNTIME';
  IF captured_runtime_hash IS NULL OR captured_runtime_hash!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'usage-review trigger test has no canonical runtime identity';
  END IF;

  SELECT count(*) INTO before_review_count FROM framework_system_usage_review;
  SELECT count(*) INTO before_job_count FROM framework_development_job;
  BEGIN
    INSERT INTO framework_system_usage_review(
      process_code,step_code,idempotency_key,review_status,review_note,
      process_version,contract_fingerprint,source_commit,runtime_identity_hash,reviewed_by
    ) VALUES (
      test_process,test_step,'runtime-identity-old-writer-null','CHANGE_REQUESTED','must be rejected',
      test_version,repeat('a',64),runtime_source,NULL,'runtime-identity-contract'
    );
  EXCEPTION WHEN check_violation THEN null_writer_rejected:=true;
  END;
  IF NOT null_writer_rejected
     OR (SELECT count(*) FROM framework_system_usage_review)<>before_review_count
     OR (SELECT count(*) FROM framework_development_job)<>before_job_count THEN
    RAISE EXCEPTION 'source-only old usage-review writer was not atomically rejected before job mutation';
  END IF;

  UPDATE framework_runtime_release_state SET pod_template_sha256=repeat('e',64)
   WHERE release_key='CARBONET_RUNTIME';
  BEGIN
    INSERT INTO framework_system_usage_review(
      process_code,step_code,idempotency_key,review_status,review_note,
      process_version,contract_fingerprint,source_commit,runtime_identity_hash,reviewed_by
    ) VALUES (
      test_process,test_step,'runtime-identity-template-drift','APPROVED','',
      test_version,repeat('b',64),runtime_source,captured_runtime_hash,'runtime-identity-contract'
    );
  EXCEPTION WHEN check_violation THEN template_drift_rejected:=true;
  END;
  IF NOT template_drift_rejected
     OR (SELECT count(*) FROM framework_system_usage_review)<>before_review_count THEN
    RAISE EXCEPTION 'template-only runtime identity drift was accepted by usage-review insert guard';
  END IF;

  UPDATE framework_runtime_release_state
     SET pod_template_sha256='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a'
   WHERE release_key='CARBONET_RUNTIME';
  SELECT framework_runtime_release_identity_hash(runtime) INTO captured_runtime_hash
    FROM framework_runtime_release_state runtime WHERE release_key='CARBONET_RUNTIME';
  INSERT INTO framework_system_usage_review(
    process_code,step_code,idempotency_key,review_status,review_note,
    process_version,contract_fingerprint,source_commit,runtime_identity_hash,reviewed_by
  ) VALUES (
    test_process,test_step,'runtime-identity-exact-bound','APPROVED','',
    test_version,repeat('c',64),runtime_source,captured_runtime_hash,'runtime-identity-contract'
  );
  IF (SELECT count(*) FROM framework_system_usage_review)<>before_review_count+1
     OR (SELECT count(*) FROM framework_development_job)<>before_job_count THEN
    RAISE EXCEPTION 'exact-bound usage review was not accepted without a follow-on job';
  END IF;
END
$$;

DO $$
DECLARE canonical_hash text; legacy_hash text;
BEGIN
  SELECT framework_runtime_release_identity_hash(runtime),
         encode(sha256(convert_to(concat_ws('|',
           source_commit,deployment_namespace,deployment_name,deployment_uid,
           deployment_generation,observed_generation,desired_replicas,
           image_ref,image_id,health_status
         ),'UTF8')),'hex')
    INTO canonical_hash,legacy_hash
    FROM framework_runtime_release_state runtime
   WHERE release_key='CARBONET_RUNTIME';
  IF (SELECT pod_template_sha256 FROM framework_runtime_release_state
       WHERE release_key='CARBONET_RUNTIME')
       <>'3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a' THEN
    RAISE EXCEPTION 'exact audited legacy row was not backfilled';
  END IF;
  IF canonical_hash IS DISTINCT FROM legacy_hash THEN
    RAISE EXCEPTION 'exact legacy rolling-upgrade bridge does not equal V1';
  END IF;

  -- HPA coordinates remain payload fields, but do not revoke the exact
  -- immutable-coordinate bridge.
  UPDATE framework_runtime_release_state
     SET deployment_generation=6769,observed_generation=6769,desired_replicas=3
   WHERE release_key='CARBONET_RUNTIME';
  SELECT framework_runtime_release_identity_hash(runtime),
         encode(sha256(convert_to(concat_ws('|',
           source_commit,deployment_namespace,deployment_name,deployment_uid,
           deployment_generation,observed_generation,desired_replicas,
           image_ref,image_id,health_status
         ),'UTF8')),'hex')
    INTO canonical_hash,legacy_hash
    FROM framework_runtime_release_state runtime
   WHERE release_key='CARBONET_RUNTIME';
  IF canonical_hash IS DISTINCT FROM legacy_hash THEN
    RAISE EXCEPTION 'legacy bridge broke on HPA coordinate change';
  END IF;

  -- The audited Deployment UID is immutable bridge authority. A recreated
  -- object must use V2 and cannot inherit the legacy exception.
  UPDATE framework_runtime_release_state SET deployment_uid='recreated-runtime-uid'
   WHERE release_key='CARBONET_RUNTIME';
  SELECT framework_runtime_release_identity_hash(runtime),
         encode(sha256(convert_to(concat_ws('|',
           source_commit,deployment_namespace,deployment_name,deployment_uid,
           deployment_generation,observed_generation,desired_replicas,
           image_ref,image_id,health_status
         ),'UTF8')),'hex')
    INTO canonical_hash,legacy_hash
    FROM framework_runtime_release_state runtime
   WHERE release_key='CARBONET_RUNTIME';
  IF canonical_hash IS NULL OR canonical_hash=legacy_hash THEN
    RAISE EXCEPTION 'unaudited Deployment UID inherited legacy V1 identity';
  END IF;

  -- No compatibility bridge exists for an unknown installation with an
  -- unbound template, even if it reuses the legacy source string.
  UPDATE framework_runtime_release_state
     SET image_id='sha256:'||repeat('9',64),pod_template_sha256=NULL
   WHERE release_key='CARBONET_RUNTIME';
  IF (SELECT framework_runtime_release_identity_hash(runtime)
        FROM framework_runtime_release_state runtime
       WHERE release_key='CARBONET_RUNTIME') IS NOT NULL THEN
    RAISE EXCEPTION 'unknown unbound legacy-like row did not fail closed';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc proc
    CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl,acldefault('f',proc.proowner))) acl
    WHERE proc.oid='framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar)'::regprocedure
      AND acl.privilege_type='EXECUTE' AND acl.grantee<>proc.proowner
  ) THEN
    RAISE EXCEPTION 'internal v1 promoter remains executable outside its owner';
  END IF;
END
$$;

INSERT INTO framework_runtime_release_state(
  release_key,source_commit,deployment_namespace,deployment_name,deployment_uid,
  deployment_generation,observed_generation,desired_replicas,image_ref,image_id,pod_template_sha256,
  health_status,recorded_by
) VALUES (
  'CARBONET_RUNTIME',:'source_commit','carbonet-prod','carbonet-runtime','candidate-test',
  1,1,1,'candidate-test','sha256:'||repeat('0',64),repeat('a',64),'UP','CANDIDATE_PROMOTION_TEST'
)
ON CONFLICT (release_key) DO UPDATE SET
  source_commit=excluded.source_commit,deployment_namespace=excluded.deployment_namespace,
  deployment_name=excluded.deployment_name,deployment_uid=excluded.deployment_uid,
  deployment_generation=excluded.deployment_generation,observed_generation=excluded.observed_generation,
  desired_replicas=excluded.desired_replicas,image_ref=excluded.image_ref,image_id=excluded.image_id,
  pod_template_sha256=excluded.pod_template_sha256,
  health_status=excluded.health_status,recorded_by=excluded.recorded_by,recorded_at=current_timestamp;

CREATE OR REPLACE FUNCTION pg_temp.postdeploy_runtime_identity_hash() RETURNS text
LANGUAGE sql AS $$
SELECT framework_runtime_release_identity_hash(runtime)
FROM framework_runtime_release_state runtime
WHERE release_key='CARBONET_RUNTIME'
$$;

CREATE OR REPLACE FUNCTION pg_temp.postdeploy_runtime_identity_hash_v1() RETURNS text
LANGUAGE sql AS $$
SELECT encode(sha256(convert_to(concat_ws('|',
  source_commit,deployment_namespace,deployment_name,deployment_uid,
  deployment_generation,observed_generation,desired_replicas,
  image_ref,image_id,health_status
),'UTF8')),'hex')
FROM framework_runtime_release_state
WHERE release_key='CARBONET_RUNTIME'
$$;

DO $$
DECLARE
  original_hash text;
  shell_v2_hash text;
  template_changed_hash text;
  rejected boolean:=false;
BEGIN
  original_hash:=pg_temp.postdeploy_runtime_identity_hash();
  IF original_hash IS NULL OR original_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'V2 runtime identity hash was not produced';
  END IF;
  SELECT encode(sha256(convert_to(jsonb_build_array(
      'CARBONET_RUNTIME_IDENTITY_V3_HPA_STABLE',source_commit,deployment_namespace,
      deployment_name,deployment_uid,image_ref,image_id,health_status,
      to_jsonb(runtime)->>'pod_template_sha256'
    )::text,'UTF8')),'hex')
    INTO shell_v2_hash
    FROM framework_runtime_release_state runtime WHERE release_key='CARBONET_RUNTIME';
  IF original_hash IS DISTINCT FROM shell_v2_hash THEN
    RAISE EXCEPTION 'canonical helper and shell V2 expression diverged';
  END IF;
  UPDATE framework_runtime_release_state SET pod_template_sha256=NULL
   WHERE release_key='CARBONET_RUNTIME';
  IF pg_temp.postdeploy_runtime_identity_hash() IS NOT NULL THEN
    RAISE EXCEPTION 'post-migration NULL template identity did not fail closed';
  END IF;
  UPDATE framework_runtime_release_state SET pod_template_sha256=repeat('b',64)
   WHERE release_key='CARBONET_RUNTIME';
  template_changed_hash:=pg_temp.postdeploy_runtime_identity_hash();
  IF template_changed_hash IS NULL OR template_changed_hash=original_hash THEN
    RAISE EXCEPTION 'template-only change did not alter V2 runtime identity';
  END IF;
  BEGIN
    UPDATE framework_runtime_release_state SET pod_template_sha256='not-a-sha256'
     WHERE release_key='CARBONET_RUNTIME';
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'malformed PodTemplate SHA-256 was accepted'; END IF;
  UPDATE framework_runtime_release_state SET pod_template_sha256=repeat('a',64)
   WHERE release_key='CARBONET_RUNTIME';
END
$$;

-- BUSINESS_E2E evidence must be current only for the exact canonical runtime
-- identity. This exercises the new trigger and view against a real PostgreSQL
-- transaction while leaving every production row unchanged on ROLLBACK.
DO $$
DECLARE
  test_process varchar;
  test_step varchar;
  test_version varchar;
  test_fingerprint varchar;
  runtime_hash varchar(64);
  template_hash varchar(64);
  rejected boolean:=false;
BEGIN
  SELECT evidence.process_code,evidence.step_code,evidence.current_process_version,
         evidence.current_contract_fingerprint
    INTO test_process,test_step,test_version,test_fingerprint
    FROM framework_current_business_e2e_evidence evidence
   WHERE evidence.current_contract_fingerprint IS NOT NULL
   ORDER BY evidence.process_code,evidence.step_code
   LIMIT 1;
  IF test_process IS NULL THEN
    RAISE EXCEPTION 'no compiled process/step contract exists for BUSINESS_E2E runtime binding test';
  END IF;
  SELECT framework_runtime_release_identity_hash(runtime),runtime.pod_template_sha256
    INTO runtime_hash,template_hash
    FROM framework_runtime_release_state runtime
   WHERE release_key='CARBONET_RUNTIME';

  INSERT INTO framework_process_qa_run(
    qa_run_id,process_code,step_code,result,evidence_json,executed_by,
    evidence_type,process_version,source_commit,contract_fingerprint,
    execution_environment,evidence_uri,evidence_hash
  ) VALUES (
    -900000000000000001,test_process,test_step,'PASSED',
    jsonb_build_object('contract',jsonb_build_object(
      'processCode',test_process,'stepCode',test_step,'processVersion',test_version,
      'contractFingerprint',test_fingerprint,
      'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
      'runtimeIdentityHash',runtime_hash,'podTemplateSha256',template_hash)),
    'RUNTIME_TEMPLATE_POSTGRES_TEST','BUSINESS_E2E',test_version,
    current_setting('resonance.postdeploy_test_commit'),test_fingerprint,
    'ROLLBACK_ONLY','inline://runtime-template-postgres-test',repeat('6',64)
  );
  IF NOT EXISTS (
    SELECT 1 FROM framework_current_business_e2e_evidence
     WHERE process_code=test_process AND step_code=test_step
       AND qa_run_id=-900000000000000001
       AND business_test_result='PASSED'
       AND current_runtime_identity_hash=runtime_hash
       AND runtime_identity_hash=runtime_hash
  ) THEN
    RAISE EXCEPTION 'V2-bound BUSINESS_E2E evidence was not current';
  END IF;

  UPDATE framework_runtime_release_state SET pod_template_sha256=repeat('b',64)
   WHERE release_key='CARBONET_RUNTIME';
  IF EXISTS (
    SELECT 1 FROM framework_current_business_e2e_evidence
     WHERE process_code=test_process AND step_code=test_step
       AND qa_run_id=-900000000000000001
  ) THEN
    RAISE EXCEPTION 'template-only runtime drift kept old BUSINESS_E2E evidence current';
  END IF;
  BEGIN
    INSERT INTO framework_process_qa_run(
      qa_run_id,process_code,step_code,result,evidence_json,executed_by,
      evidence_type,process_version,source_commit,contract_fingerprint,
      execution_environment,evidence_uri,evidence_hash
    ) VALUES (
      -900000000000000002,test_process,test_step,'PASSED',
      jsonb_build_object('contract',jsonb_build_object(
        'processCode',test_process,'stepCode',test_step,'processVersion',test_version,
        'contractFingerprint',test_fingerprint,
        'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
        'runtimeIdentityHash',runtime_hash,'podTemplateSha256',template_hash)),
      'RUNTIME_TEMPLATE_POSTGRES_TEST','BUSINESS_E2E',test_version,
      current_setting('resonance.postdeploy_test_commit'),test_fingerprint,
      'ROLLBACK_ONLY','inline://runtime-template-postgres-test-stale',repeat('7',64)
    );
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'stale BUSINESS_E2E runtime identity insert was accepted';
  END IF;
  UPDATE framework_runtime_release_state SET pod_template_sha256=template_hash
   WHERE release_key='CARBONET_RUNTIME';
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.postdeploy_current_digest() RETURNS text
LANGUAGE sql AS $$
SELECT encode(sha256(convert_to(concat_ws('|',
  coalesce((SELECT jsonb_agg(jsonb_build_array(job_id,job_status,approval_status,quality_status,evidence_ref,updated_at)
                    ORDER BY job_id)::text FROM framework_development_job
            WHERE process_code IN ('ACTIVITY_DATA','CUSTOMER_WORK_COORDINATION','EMISSION_CALCULATION','GOVERNANCE_CHANGE','ORGANIZATIONAL_BOUNDARY','REPORT_CERTIFICATION')),''),
  coalesce((SELECT jsonb_agg(jsonb_build_array(artifact_id,delivery_status,evidence_ref,updated_at)
                    ORDER BY artifact_id)::text FROM framework_process_artifact
            WHERE process_code IN ('ACTIVITY_DATA','CUSTOMER_WORK_COORDINATION','EMISSION_CALCULATION','GOVERNANCE_CHANGE','ORGANIZATIONAL_BOUNDARY','REPORT_CERTIFICATION')),''),
  coalesce((SELECT jsonb_agg(jsonb_build_array(process_code,definition_locked,process_status,updated_at)
                    ORDER BY process_code)::text FROM framework_process_definition
            WHERE process_code IN ('GOVERNANCE_CHANGE','ORGANIZATIONAL_BOUNDARY')),''),
  (SELECT count(*)::text FROM framework_customer_journey_validation_run),
  (SELECT count(*)::text FROM framework_activity_runtime_validation_run),
  (SELECT count(*)::text FROM framework_organizational_boundary_runtime_validation_run),
  (SELECT count(*)::text FROM framework_simulation_run),
  (SELECT count(*)::text FROM framework_postdeploy_evidence_promotion)
),'UTF8')),'hex')
$$;

CREATE TEMP TABLE postdeploy_units(unit_code text,process_code text,evidence_kind text);
INSERT INTO postdeploy_units VALUES
 ('ACTIVITY_DATA_RUNTIME','ACTIVITY_DATA','RUNTIME'),
 ('ACTIVITY_DATA_STATIC','ACTIVITY_DATA','STATIC'),
 ('ACTOR_ACCOUNT_CUSTOMER_JOURNEY','CUSTOMER_WORK_COORDINATION','RUNTIME'),
 ('CUSTOMER_WORK_COORDINATION_RUNTIME','CUSTOMER_WORK_COORDINATION','RUNTIME'),
 ('EMISSION_CALCULATION_RUNTIME','EMISSION_CALCULATION','RUNTIME'),
 ('EMISSION_CALCULATION_STATIC','EMISSION_CALCULATION','STATIC'),
 ('GOVERNANCE_CHANGE_RUNTIME','GOVERNANCE_CHANGE','RUNTIME'),
 ('OPERATIONAL_USAGE_LEDGER_GATE','__RELEASE__','RELEASE_GATE'),
 ('ORGANIZATIONAL_BOUNDARY_RUNTIME','ORGANIZATIONAL_BOUNDARY','RUNTIME'),
 ('REPORT_CERTIFICATION_RUNTIME','REPORT_CERTIFICATION','RUNTIME'),
 ('REPORT_CERTIFICATION_STATIC','REPORT_CERTIFICATION','STATIC'),
 ('SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW','__RELEASE__','RELEASE_GATE');

SELECT framework_stage_postdeploy_release_attempt(candidate_id,current_setting('resonance.postdeploy_test_commit'))
FROM (VALUES
  ('candidate-test-split-a'),('candidate-test-split-b'),('candidate-test-complete'),
  ('candidate-test-retry-complete'),('candidate-test-reduced-hash'),
  ('candidate-test-runtime-mismatch')
) attempt(candidate_id);
SELECT framework_bind_postdeploy_release_attempt_runtime(
  candidate_id,current_setting('resonance.postdeploy_test_commit'),
  pg_temp.postdeploy_runtime_identity_hash())
FROM (VALUES
  ('candidate-test-split-a'),('candidate-test-split-b'),('candidate-test-complete'),
  ('candidate-test-retry-complete'),('candidate-test-reduced-hash'),
  ('candidate-test-runtime-mismatch')
) attempt(candidate_id);

DO $$
DECLARE runtime framework_runtime_release_state%ROWTYPE;
        calculated varchar(64); rejected boolean:=false;
BEGIN
  SELECT * INTO STRICT runtime FROM framework_runtime_release_state
   WHERE release_key='CARBONET_RUNTIME';
  calculated:=framework_candidate_runtime_identity_hash_v2(
    runtime.source_commit,runtime.deployment_namespace,runtime.deployment_name,
    runtime.deployment_uid,runtime.deployment_generation,runtime.observed_generation,
    runtime.desired_replicas,runtime.image_ref,runtime.image_id,runtime.pod_template_sha256);
  IF calculated IS DISTINCT FROM pg_temp.postdeploy_runtime_identity_hash() THEN
    RAISE EXCEPTION 'candidate snapshot V2 helper diverged from runtime singleton helper';
  END IF;
  BEGIN
    PERFORM framework_bind_postdeploy_release_attempt_runtime(
      'candidate-test-runtime-mismatch',current_setting('resonance.postdeploy_test_commit'),repeat('e',64));
  EXCEPTION WHEN serialization_failure OR check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'candidate attempt runtime identity was rebound'; END IF;
  rejected:=false;
  BEGIN
    INSERT INTO framework_postdeploy_evidence_candidate(
      candidate_id,unit_code,process_code,evidence_kind,source_commit,
      candidate_runtime_identity_hash,evidence_json,evidence_hash
    ) VALUES (
      'candidate-test-runtime-mismatch','ACTIVITY_DATA_STATIC','ACTIVITY_DATA','STATIC',
      current_setting('resonance.postdeploy_test_commit'),repeat('e',64),
      jsonb_build_object('status','PASS','unitCode','ACTIVITY_DATA_STATIC',
        'processCode','ACTIVITY_DATA','evidenceKind','STATIC',
        'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
        'runtimeIdentityHash',repeat('e',64)),''
    );
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'unit runtime identity diverged from bound attempt'; END IF;
  IF EXISTS (SELECT 1 FROM framework_postdeploy_evidence_candidate
             WHERE candidate_id='candidate-test-runtime-mismatch') THEN
    RAISE EXCEPTION 'rejected runtime mismatch left candidate evidence behind';
  END IF;
END
$$;

-- Candidate audit evidence is bound to the V330 authoritative row. Explicit
-- ids avoid advancing the non-transactional production sequence in this
-- rollback-only contract test.
INSERT INTO framework_scope_access_audit(
  audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
  action_code,resource_type,created_at
) VALUES
 (9000000000000000101,'qadata26','TENANT-CANDIDATE','PRJ-CANDIDATE-DENIED','DENIED',
  'PROJECT_TENANT_SCOPE_DENIED','PROJECT_PARTICIPANT_READ','EMISSION_PROJECT',timestamp '2026-08-12 02:30:00.000001'),
 (9000000000000000102,'qacalc26','TENANT-CANDIDATE','PRJ-CANDIDATE-TEST','DENIED',
  'ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER','REGULATORY_SUBMISSION_TRANSITION','REGULATORY_SUBMISSION',timestamp '2026-08-12 02:30:00.000002');

CREATE OR REPLACE FUNCTION pg_temp.postdeploy_unit_evidence(
  p_unit text,p_process text,p_kind text,p_variant integer,p_reduced_hash boolean
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
SELECT jsonb_build_object(
    'status','PASS','unitCode',p_unit,'processCode',p_process,'evidenceKind',p_kind,
    'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
    'runtimeIdentityHash',pg_temp.postdeploy_runtime_identity_hash(),
    'projectId','PRJ-CANDIDATE-TEST',
    'runtimeEvidence',CASE
      WHEN p_unit='GOVERNANCE_CHANGE_RUNTIME' THEN format('/tmp/candidate-%s-governance.json',p_variant)
      WHEN p_unit='ORGANIZATIONAL_BOUNDARY_RUNTIME' THEN format('/tmp/candidate-%s-boundary.json',p_variant)
      ELSE format('/tmp/candidate-%s.json',p_variant)
    END,
    'runtimeEvidenceHash',repeat(CASE WHEN p_variant=1 THEN '1' ELSE '2' END,64),
    'actorCount',6,'taskCount',7,
    'authenticatedApiCount',1,'protectedApiCount',1,'pageCount',1,'p95Millis',p_variant,'readyReplicas',1,
    'freshRuntimeAssertions',true,
    'runtimeCaseTypes',jsonb_build_array('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY','EXCEPTION')
  ) || CASE p_unit
    WHEN 'ACTOR_ACCOUNT_CUSTOMER_JOURNEY' THEN jsonb_build_object(
      'mutableBusinessWrites',0,'mutableBusinessHashBefore',repeat('a',64),'mutableBusinessHashAfter',repeat('a',64),
      'securityAuditAppendDelta',2,'scopeAuditIdDelta',1,'actorAuditIdDelta',1,
      'securityAuditTypes',jsonb_build_array('PROJECT_SCOPE_DENIED','ACTOR_ROLE_DENIED'),
      'draftMutation','SKIPPED_CANDIDATE_READ_ONLY','authTokenBaseline',0,'authTokenAfter',0,
      'authTokenCleanupVerified',true,
      'securityAuditEvidence',(
        SELECT jsonb_agg(jsonb_build_object(
          'schemaVersion',audit.schema_version,'auditId',audit.audit_id,
          'rowHash',CASE WHEN p_reduced_hash THEN encode(sha256(convert_to(concat_ws('|',
            audit.audit_id,lower(audit.account_id),audit.tenant_id,audit.project_id,
            audit.decision_code,audit.reason_code),'UTF8')),'hex') ELSE audit.row_hash END,
          'accountId',audit.account_id,'tenantId',audit.tenant_id,'projectId',audit.project_id,
          'decisionCode',audit.decision_code,'reasonCode',audit.reason_code,
          'actionCode',audit.action_code,'resourceType',audit.resource_type,'outcomeCode',audit.outcome_code
        ) ORDER BY audit.audit_id)
        FROM framework_scope_access_audit audit
        WHERE audit.audit_id IN (9000000000000000101,9000000000000000102)
      )
    )
    WHEN 'SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW' THEN jsonb_build_object(
      'previewCount',3,'rolledBack',true,'canonicalStateUnchanged',true,'databaseCurrentWrites',0,
      'databaseStateHashBefore',repeat('3',64),'databaseStateHashAfter',repeat('3',64),
      'contractHashBefore',repeat('4',64),'contractHashAfter',repeat('4',64),
      'runtimeHashBefore',repeat('5',64),'runtimeHashAfter',repeat('5',64)
    )
    WHEN 'OPERATIONAL_USAGE_LEDGER_GATE' THEN jsonb_build_object(
      'scope','DEPLOY_RUNTIME_IDENTITY_ONLY','runtimeIdentityExact',true,
      'fullProcessAuthorizationE2e','DEFERRED_TO_DESIGN_QA','persistentFixtures',0
    )
    ELSE '{}'::jsonb
  END
$$;

-- Two incomplete attempt ids prove that rows from concurrent/retried attempts
-- can never be combined into one promotable 12-unit candidate.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,
  candidate_runtime_identity_hash,evidence_json,evidence_hash
)
SELECT 'candidate-test-split-a',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_runtime_identity_hash(),
       jsonb_build_object('status','PASS','unitCode',unit_code,'processCode',process_code,
          'evidenceKind',evidence_kind,'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
          'runtimeIdentityHash',pg_temp.postdeploy_runtime_identity_hash(),
         'projectId','PRJ-CANDIDATE-TEST','runtimeEvidence','/tmp/candidate-test.json',
         'authenticatedApiCount',1,'protectedApiCount',1,'pageCount',1,'p95Millis',1,'readyReplicas',1),''
FROM postdeploy_units ORDER BY unit_code LIMIT 6;
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,
  candidate_runtime_identity_hash,evidence_json,evidence_hash
)
SELECT 'candidate-test-split-b',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_runtime_identity_hash(),
       jsonb_build_object('status','PASS','unitCode',unit_code,'processCode',process_code,
          'evidenceKind',evidence_kind,'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
          'runtimeIdentityHash',pg_temp.postdeploy_runtime_identity_hash(),
         'projectId','PRJ-CANDIDATE-TEST','runtimeEvidence','/tmp/candidate-test.json',
         'authenticatedApiCount',1,'protectedApiCount',1,'pageCount',1,'p95Millis',1,'readyReplicas',1),''
FROM postdeploy_units ORDER BY unit_code OFFSET 6;

CREATE TEMP TABLE failed_before AS SELECT pg_temp.postdeploy_current_digest() digest;
DO $$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-split-a',current_setting('resonance.postdeploy_test_commit'),
      pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'incomplete candidate unexpectedly promoted'; END IF;
  rejected:=false;
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-split-b',current_setting('resonance.postdeploy_test_commit'),
      pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'second incomplete candidate unexpectedly promoted'; END IF;
END
$$;
DO $$
BEGIN
  IF (SELECT digest FROM failed_before)<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'failed candidate changed current evidence';
  END IF;
END
$$;

-- A complete attempt promotes exactly 12 units and 6 processes.  Every
-- business row written below remains inside this transaction and is rolled
-- back at the end of the executable PostgreSQL contract test.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,
  candidate_runtime_identity_hash,evidence_json,evidence_hash
)
SELECT 'candidate-test-complete',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_runtime_identity_hash(),
       pg_temp.postdeploy_unit_evidence(unit_code,process_code,evidence_kind,1,false),''
FROM postdeploy_units;

-- A second complete attempt for the same source commit must remain a valid
-- immutable candidate, but it must reconcile to the first promotion rather
-- than appending a second set of current validation/simulation evidence.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,
  candidate_runtime_identity_hash,evidence_json,evidence_hash
)
SELECT 'candidate-test-retry-complete',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_runtime_identity_hash(),
       pg_temp.postdeploy_unit_evidence(unit_code,process_code,evidence_kind,2,false),''
FROM postdeploy_units;

-- Mutation proof: a 64-character hash recomputed from the old reduced six
-- fields looks plausible but is not the database-authored V330 row_hash.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,
  candidate_runtime_identity_hash,evidence_json,evidence_hash
)
SELECT 'candidate-test-reduced-hash',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_runtime_identity_hash(),
       pg_temp.postdeploy_unit_evidence(unit_code,process_code,evidence_kind,3,true),''
FROM postdeploy_units;

DO $$
DECLARE rejected boolean:=false; rejection_message text:=''; before_digest text:=pg_temp.postdeploy_current_digest();
BEGIN
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-reduced-hash',current_setting('resonance.postdeploy_test_commit'),
      pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN
    rejected:=true;
    rejection_message:=SQLERRM;
  END;
  IF NOT rejected OR position('actor-account security audit row/hash no longer matches candidate evidence' in rejection_message)=0 THEN
    RAISE EXCEPTION 'reduced/stale row hash mutation was not rejected by authoritative DB comparison: %',rejection_message;
  END IF;
  IF before_digest<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'reduced row hash rejection changed current evidence';
  END IF;
END
$$;

DO $$
DECLARE rejected boolean:=false; before_digest text:=pg_temp.postdeploy_current_digest();
BEGIN
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-complete',current_setting('resonance.postdeploy_test_commit'),
      pg_temp.postdeploy_runtime_identity_hash_v1());
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'legacy V1 runtime identity hash was accepted'; END IF;
  IF before_digest<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'runtime identity rejection changed current evidence';
  END IF;
END
$$;

CREATE TEMP TABLE evidence_counts_before AS
SELECT
 (SELECT count(*) FROM framework_customer_journey_validation_run) customer_count,
 (SELECT count(*) FROM framework_activity_runtime_validation_run) activity_count,
 (SELECT count(*) FROM framework_organizational_boundary_runtime_validation_run) boundary_count,
 (SELECT count(*) FROM framework_simulation_run) simulation_count,
 (SELECT count(*) FROM framework_postdeploy_evidence_promotion) promotion_count;

CREATE TEMP TABLE promotion_result AS
SELECT framework_promote_postdeploy_evidence_candidate(
  'candidate-test-complete',current_setting('resonance.postdeploy_test_commit'),
  pg_temp.postdeploy_runtime_identity_hash()) result;

DO $$
DECLARE before_row evidence_counts_before%ROWTYPE; promoted jsonb;
BEGIN
  SELECT * INTO before_row FROM evidence_counts_before;
  SELECT result INTO promoted FROM promotion_result;
  IF promoted->>'status'<>'PROMOTED' OR (promoted->>'processCount')::integer<>6
     OR (promoted->>'unitCount')::integer<>12
     OR (promoted->>'promotedDefinitionCount')::integer<>2
     OR (promoted->>'appendedValidationCount')::integer<>3
     OR (promoted->>'appendedSimulationCount')::integer<>0 THEN
    RAISE EXCEPTION 'exact promotion result mismatch: %',promoted;
  END IF;
  IF (SELECT count(*) FROM framework_customer_journey_validation_run)<>before_row.customer_count+1
     OR (SELECT count(*) FROM framework_activity_runtime_validation_run)<>before_row.activity_count+1
     OR (SELECT count(*) FROM framework_organizational_boundary_runtime_validation_run)<>before_row.boundary_count+1
     OR (SELECT count(*) FROM framework_simulation_run)<>before_row.simulation_count
     OR (SELECT count(*) FROM framework_postdeploy_evidence_promotion)<>before_row.promotion_count+1 THEN
    RAISE EXCEPTION 'promotion append cardinality mismatch';
  END IF;
END
$$;

CREATE TEMP TABLE promoted_once_digest AS SELECT pg_temp.postdeploy_current_digest() digest;

DO $$
DECLARE canonical framework_postdeploy_release_attempt%ROWTYPE;
BEGIN
  SELECT * INTO canonical FROM framework_postdeploy_release_attempt
   WHERE candidate_id='candidate-test-complete';
  IF canonical.attempt_status<>'PROMOTED'
     OR canonical.runtime_identity_hash<>pg_temp.postdeploy_runtime_identity_hash()
     OR canonical.candidate_runtime_identity_hash<>pg_temp.postdeploy_runtime_identity_hash()
     OR canonical.promotion_id IS NULL OR canonical.terminal_reason<>'PROMOTION_COMMITTED' THEN
    RAISE EXCEPTION 'canonical attempt lifecycle was not atomically promoted';
  END IF;
END
$$;

-- The same candidate and a different attempt id for the same commit are both
-- idempotent.  The canonical first candidate remains authoritative and no
-- second validation, simulation, event, or promotion row can be appended.
DO $$
DECLARE replay jsonb; retry_replay jsonb; stale_rejected boolean:=false;
        stale_runtime_rejected boolean:=false;
BEGIN
  replay:=framework_promote_postdeploy_evidence_candidate(
    'candidate-test-complete',current_setting('resonance.postdeploy_test_commit'),
    pg_temp.postdeploy_runtime_identity_hash());
  IF replay->>'status'<>'ALREADY_PROMOTED' THEN RAISE EXCEPTION 'promotion replay is not idempotent'; END IF;
  retry_replay:=framework_promote_postdeploy_evidence_candidate(
    'candidate-test-retry-complete',current_setting('resonance.postdeploy_test_commit'),
    pg_temp.postdeploy_runtime_identity_hash());
  IF retry_replay->>'status'<>'ALREADY_PROMOTED'
     OR retry_replay->>'candidateId'<>'candidate-test-complete'
     OR retry_replay->>'requestedCandidateId'<>'candidate-test-retry-complete' THEN
    RAISE EXCEPTION 'different candidate retry did not reconcile to canonical promotion: %',retry_replay;
  END IF;
  IF (SELECT attempt_status FROM framework_postdeploy_release_attempt
      WHERE candidate_id='candidate-test-retry-complete')<>'ABORTED'
     OR (SELECT terminal_reason FROM framework_postdeploy_release_attempt
         WHERE candidate_id='candidate-test-retry-complete')<>'RECONCILED_TO_EXISTING_SOURCE_PROMOTION' THEN
    RAISE EXCEPTION 'same-source retry attempt was not terminally reconciled';
  END IF;
  IF (SELECT digest FROM promoted_once_digest)<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'same-commit retry appended duplicate current evidence';
  END IF;
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-retry-complete',current_setting('resonance.postdeploy_test_commit'),repeat('e',64));
  EXCEPTION WHEN OTHERS THEN stale_runtime_rejected:=true;
  END;
  IF NOT stale_runtime_rejected THEN
    RAISE EXCEPTION 'existing promotion bypassed current runtime identity verification';
  END IF;
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-complete',repeat('1',40),pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN stale_rejected:=true;
  END;
  IF NOT stale_rejected THEN RAISE EXCEPTION 'stale commit replay was accepted'; END IF;
END
$$;

DO $$
DECLARE aborted jsonb; replay jsonb; rejected boolean:=false;
BEGIN
  PERFORM framework_stage_postdeploy_release_attempt('candidate-test-abort-cas',repeat('9',40));
  aborted:=framework_abort_postdeploy_release_attempt(
    'candidate-test-abort-cas',repeat('9',40),NULL,'VALIDATION_FAILED');
  replay:=framework_abort_postdeploy_release_attempt(
    'candidate-test-abort-cas',repeat('9',40),NULL,'VALIDATION_FAILED');
  IF aborted->>'status'<>'ABORTED' OR replay<>aborted THEN
    RAISE EXCEPTION 'attempt abort exact replay mismatch';
  END IF;
  BEGIN
    PERFORM framework_abort_postdeploy_release_attempt(
      'candidate-test-abort-cas',repeat('9',40),NULL,'OTHER_FAILURE');
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'divergent abort CAS unexpectedly succeeded'; END IF;
  rejected:=false;
  BEGIN
    UPDATE framework_postdeploy_release_attempt SET terminal_reason='MUTATED'
    WHERE candidate_id='candidate-test-complete';
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'terminal attempt mutation unexpectedly succeeded'; END IF;
END
$$;

ROLLBACK;
\echo POSTDEPLOY_CANDIDATE_POSTGRES_PASS units=12 processes=6 failedCandidates=4 reducedRowHashRejected=1 currentMutation=rollback-only simulationsFabricated=0 staleRejected=1 retryDifferentCandidate=1 candidateUnitRuntimeIdentity=attempt+12rows+payload+hash+aggregate runtimeIdentityBound=V2+podTemplate legacy76Backfill=exact legacy76Bridge=V1 unknownNull=fail-closed legacyV1Rejected=1 nullTemplateRejected=1 shellParity=exact businessE2E=exact+template-drift-stale usageReviewGuard=null-old-writer+template-drift-reject+exact-accept lifecycleCAS=STAGED_BOUND_PROMOTED_ABORTED internalV1Execute=ownerOnly
SQL
} | kubectl -n "$NAMESPACE" exec -i "$leader" -c "$CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -v ON_ERROR_STOP=1 \
    -v source_commit="$SOURCE_COMMIT"
