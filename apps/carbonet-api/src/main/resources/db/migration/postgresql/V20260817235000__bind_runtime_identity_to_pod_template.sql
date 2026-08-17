-- Bind every promoted/current runtime identity to the immutable Kubernetes
-- PodTemplate digest. The audited legacy 76a runtime is the sole backfill:
-- unknown installations remain NULL and therefore fail closed until the
-- recorder publishes an externally checkpointed template digest.

ALTER TABLE framework_runtime_release_state
  ADD COLUMN IF NOT EXISTS pod_template_sha256 varchar(64);

UPDATE framework_runtime_release_state
   SET pod_template_sha256='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a'
 WHERE release_key='CARBONET_RUNTIME'
   AND source_commit='76a08e672ab7054914ec3b5aecb57bc8e7a298fa'
   AND deployment_namespace='carbonet-prod'
   AND deployment_name='carbonet-runtime'
   AND deployment_uid='5a9323d6-446c-49d2-ad3e-c300c18f5803'
   AND image_ref='localhost:5000/carbonet-runtime:2026.08.14-202346-gradle'
   AND image_id='sha256:48311ffbb0396684021efc84811c73432263850ce18c4d4412eb81151749e160'
   AND health_status='UP'
   AND pod_template_sha256 IS NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='framework_runtime_release_state'::regclass
       AND conname='ck_framework_runtime_release_state_pod_template_sha256'
  ) THEN
    ALTER TABLE framework_runtime_release_state
      ADD CONSTRAINT ck_framework_runtime_release_state_pod_template_sha256
      CHECK (
        pod_template_sha256 IS NULL
        OR pod_template_sha256 ~ '^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;
END
$migration$;

ALTER TABLE framework_runtime_release_state
  VALIDATE CONSTRAINT ck_framework_runtime_release_state_pod_template_sha256;

COMMENT ON COLUMN framework_runtime_release_state.pod_template_sha256 IS
  'Canonical jq -cS SHA-256 of the externally checkpointed Kubernetes Deployment spec.template.';

CREATE OR REPLACE FUNCTION framework_runtime_release_uses_legacy_identity_v1(
  p_runtime framework_runtime_release_state
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $function$
  SELECT (p_runtime).release_key='CARBONET_RUNTIME'
     AND (p_runtime).source_commit='76a08e672ab7054914ec3b5aecb57bc8e7a298fa'
     AND (p_runtime).deployment_namespace='carbonet-prod'
     AND (p_runtime).deployment_name='carbonet-runtime'
     AND (p_runtime).deployment_uid='5a9323d6-446c-49d2-ad3e-c300c18f5803'
     AND (p_runtime).image_ref='localhost:5000/carbonet-runtime:2026.08.14-202346-gradle'
     AND (p_runtime).image_id='sha256:48311ffbb0396684021efc84811c73432263850ce18c4d4412eb81151749e160'
     AND (p_runtime).health_status='UP'
     AND (p_runtime).pod_template_sha256='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a'
$function$;

COMMENT ON FUNCTION framework_runtime_release_uses_legacy_identity_v1(framework_runtime_release_state) IS
  'Exact audited 76a rolling-upgrade bridge; HPA coordinates are deliberately excluded.';

CREATE OR REPLACE FUNCTION framework_runtime_release_identity_hash(
  p_runtime framework_runtime_release_state
) RETURNS varchar(64)
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $function$
  SELECT CASE
    WHEN (p_runtime).release_key<>'CARBONET_RUNTIME' THEN NULL
    -- A rolling Flyway/build window can leave the audited 76a binary serving
    -- briefly against this schema. That binary still emits V1 hashes. Keep a
    -- bridge only for its exact independently audited immutable coordinates;
    -- generation and replicas remain values inside the V1 hash, not bridge
    -- eligibility, so HPA scaling does not revoke the rolling-upgrade bridge.
    WHEN framework_runtime_release_uses_legacy_identity_v1(p_runtime)
    THEN encode(sha256(convert_to(concat_ws('|',
      (p_runtime).source_commit,
      (p_runtime).deployment_namespace,
      (p_runtime).deployment_name,
      (p_runtime).deployment_uid,
      (p_runtime).deployment_generation,
      (p_runtime).observed_generation,
      (p_runtime).desired_replicas,
      (p_runtime).image_ref,
      (p_runtime).image_id,
      (p_runtime).health_status
    ),'UTF8')),'hex')::varchar(64)
    WHEN (p_runtime).pod_template_sha256 ~ '^[0-9a-f]{64}$' THEN
      encode(sha256(convert_to(jsonb_build_array(
        'CARBONET_RUNTIME_IDENTITY_V2',
        (p_runtime).source_commit,
        (p_runtime).deployment_namespace,
        (p_runtime).deployment_name,
        (p_runtime).deployment_uid,
        (p_runtime).deployment_generation,
        (p_runtime).observed_generation,
        (p_runtime).desired_replicas,
        (p_runtime).image_ref,
        (p_runtime).image_id,
        (p_runtime).health_status,
        (p_runtime).pod_template_sha256
      )::text,'UTF8')),'hex')::varchar(64)
    ELSE NULL
  END
$function$;

COMMENT ON FUNCTION framework_runtime_release_identity_hash(framework_runtime_release_state) IS
  'V2 runtime identity with one exact audited legacy-76a V1 rolling-upgrade bridge.';

-- A usage review can enqueue a CHANGE_REQUESTED development job. Keep the
-- historical review ledger nullable so pre-V2 rows remain readable but stale,
-- while a BEFORE INSERT guard makes every post-migration decision exact. This
-- also fails closed for an old binary during the Flyway-to-rollout overlap: its
-- source-only INSERT supplies NULL and cannot create either a review or job.
ALTER TABLE framework_system_usage_review
  ADD COLUMN IF NOT EXISTS runtime_identity_hash varchar(64);

DO $usage_review_identity_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='framework_system_usage_review'::regclass
       AND conname='ck_framework_system_usage_review_runtime_identity_hash'
  ) THEN
    ALTER TABLE framework_system_usage_review
      ADD CONSTRAINT ck_framework_system_usage_review_runtime_identity_hash
      CHECK (
        runtime_identity_hash IS NULL
        OR runtime_identity_hash~'^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;
END
$usage_review_identity_constraint$;

ALTER TABLE framework_system_usage_review
  VALIDATE CONSTRAINT ck_framework_system_usage_review_runtime_identity_hash;

CREATE OR REPLACE FUNCTION framework_validate_system_usage_review_runtime_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $usage_review_identity_trigger$
DECLARE
  runtime_state framework_runtime_release_state%ROWTYPE;
  canonical_runtime_hash varchar(64);
BEGIN
  SELECT * INTO runtime_state
    FROM framework_runtime_release_state
   WHERE release_key='CARBONET_RUNTIME' AND health_status='UP'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'system usage review requires one healthy current runtime identity'
      USING ERRCODE='23514';
  END IF;

  canonical_runtime_hash:=framework_runtime_release_identity_hash(runtime_state);
  IF canonical_runtime_hash IS NULL
     OR canonical_runtime_hash!~'^[0-9a-f]{64}$'
     OR NEW.source_commit IS DISTINCT FROM runtime_state.source_commit
     OR NEW.runtime_identity_hash IS DISTINCT FROM canonical_runtime_hash THEN
    RAISE EXCEPTION 'system usage review is not bound to the current runtime identity'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$usage_review_identity_trigger$;

DROP TRIGGER IF EXISTS trg_framework_system_usage_review_runtime_identity
  ON framework_system_usage_review;
CREATE TRIGGER trg_framework_system_usage_review_runtime_identity
BEFORE INSERT ON framework_system_usage_review
FOR EACH ROW EXECUTE FUNCTION framework_validate_system_usage_review_runtime_identity();

COMMENT ON COLUMN framework_system_usage_review.runtime_identity_hash IS
  'Canonical runtime identity captured under a shared runtime-row lock; historical NULL rows are stale.';
COMMENT ON FUNCTION framework_validate_system_usage_review_runtime_identity() IS
  'Rejects source-only, stale, or unbound usage-review writes before they can enqueue follow-on work.';

-- Candidate validation deliberately removes the current runtime singleton so
-- no pre-promotion evidence can appear current. Bind every immutable unit to
-- the externally checkpointed live runtime independently of that singleton.
ALTER TABLE framework_postdeploy_release_attempt
  ADD COLUMN IF NOT EXISTS candidate_runtime_identity_hash varchar(64);
ALTER TABLE framework_postdeploy_evidence_candidate
  ADD COLUMN IF NOT EXISTS candidate_runtime_identity_hash varchar(64);

DO $candidate_identity_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='framework_postdeploy_release_attempt'::regclass
       AND conname='ck_postdeploy_attempt_candidate_runtime_hash'
  ) THEN
    ALTER TABLE framework_postdeploy_release_attempt
      ADD CONSTRAINT ck_postdeploy_attempt_candidate_runtime_hash CHECK (
        candidate_runtime_identity_hash IS NULL
        OR candidate_runtime_identity_hash~'^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='framework_postdeploy_evidence_candidate'::regclass
       AND conname='ck_postdeploy_candidate_runtime_hash'
  ) THEN
    ALTER TABLE framework_postdeploy_evidence_candidate
      ADD CONSTRAINT ck_postdeploy_candidate_runtime_hash CHECK (
        candidate_runtime_identity_hash IS NULL
        OR candidate_runtime_identity_hash~'^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;
END
$candidate_identity_constraints$;

ALTER TABLE framework_postdeploy_release_attempt
  VALIDATE CONSTRAINT ck_postdeploy_attempt_candidate_runtime_hash;
ALTER TABLE framework_postdeploy_evidence_candidate
  VALIDATE CONSTRAINT ck_postdeploy_candidate_runtime_hash;

-- Historical terminal rows predate candidate-time runtime binding. Preserve
-- their already authoritative identity for idempotent recovery, but never
-- manufacture an identity for an abandoned STAGED candidate.
ALTER TABLE framework_postdeploy_release_attempt
  DISABLE TRIGGER trg_postdeploy_release_attempt_immutable;
UPDATE framework_postdeploy_release_attempt
   SET candidate_runtime_identity_hash=runtime_identity_hash
 WHERE attempt_status IN ('PROMOTED','ABORTED')
   AND runtime_identity_hash~'^[0-9a-f]{64}$'
   AND candidate_runtime_identity_hash IS NULL;
ALTER TABLE framework_postdeploy_release_attempt
  ENABLE TRIGGER trg_postdeploy_release_attempt_immutable;

ALTER TABLE framework_postdeploy_evidence_candidate
  DISABLE TRIGGER trg_postdeploy_candidate_immutable;
UPDATE framework_postdeploy_evidence_candidate candidate
   SET candidate_runtime_identity_hash=attempt.candidate_runtime_identity_hash
  FROM framework_postdeploy_release_attempt attempt
 WHERE attempt.candidate_id=candidate.candidate_id
   AND attempt.source_commit=candidate.source_commit
   AND attempt.candidate_runtime_identity_hash~'^[0-9a-f]{64}$'
   AND candidate.candidate_runtime_identity_hash IS NULL;
ALTER TABLE framework_postdeploy_evidence_candidate
  ENABLE TRIGGER trg_postdeploy_candidate_immutable;

CREATE OR REPLACE FUNCTION framework_candidate_runtime_identity_hash_v2(
  p_source_commit varchar,p_deployment_namespace varchar,p_deployment_name varchar,
  p_deployment_uid varchar,p_deployment_generation bigint,p_observed_generation bigint,
  p_desired_replicas integer,p_image_ref varchar,p_image_id varchar,
  p_pod_template_sha256 varchar
) RETURNS varchar(64)
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $candidate_hash$
  SELECT CASE
    WHEN p_source_commit~'^[0-9a-f]{40}$'
     AND nullif(p_deployment_namespace,'') IS NOT NULL
     AND nullif(p_deployment_name,'') IS NOT NULL
     AND nullif(p_deployment_uid,'') IS NOT NULL
     AND p_deployment_generation>0
     AND p_observed_generation>=p_deployment_generation
     AND p_desired_replicas>0
     AND nullif(p_image_ref,'') IS NOT NULL
     AND p_image_id~'sha256:[0-9a-f]{64}$'
     AND p_pod_template_sha256~'^[0-9a-f]{64}$'
    THEN encode(sha256(convert_to(jsonb_build_array(
      'CARBONET_RUNTIME_IDENTITY_V2',p_source_commit,p_deployment_namespace,
      p_deployment_name,p_deployment_uid,p_deployment_generation,
      p_observed_generation,p_desired_replicas,p_image_ref,p_image_id,'UP',
      p_pod_template_sha256
    )::text,'UTF8')),'hex')::varchar(64)
    ELSE NULL
  END
$candidate_hash$;

CREATE OR REPLACE FUNCTION framework_guard_postdeploy_release_attempt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $attempt_guard$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'postdeploy release attempt is immutable and cannot be deleted'
      USING ERRCODE='55000';
  END IF;
  IF OLD.candidate_id<>NEW.candidate_id OR OLD.source_commit<>NEW.source_commit
     OR OLD.staged_at<>NEW.staged_at THEN
    RAISE EXCEPTION 'postdeploy release attempt identity is immutable'
      USING ERRCODE='55000';
  END IF;
  IF OLD.attempt_status='STAGED' AND NEW.attempt_status='STAGED'
     AND OLD.candidate_runtime_identity_hash IS NULL
     AND NEW.candidate_runtime_identity_hash~'^[0-9a-f]{64}$'
     AND NEW.runtime_identity_hash IS NOT DISTINCT FROM OLD.runtime_identity_hash
     AND NEW.promotion_id IS NOT DISTINCT FROM OLD.promotion_id
     AND NEW.terminal_reason IS NOT DISTINCT FROM OLD.terminal_reason
     AND NEW.terminal_at IS NOT DISTINCT FROM OLD.terminal_at THEN
    RETURN NEW;
  END IF;
  IF OLD.attempt_status<>'STAGED'
     OR NEW.attempt_status NOT IN ('PROMOTED','ABORTED')
     OR NEW.candidate_runtime_identity_hash IS DISTINCT FROM OLD.candidate_runtime_identity_hash THEN
    RAISE EXCEPTION 'postdeploy release attempt permits one runtime bind then one STAGED terminal transition'
      USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END
$attempt_guard$;

CREATE OR REPLACE FUNCTION framework_bind_postdeploy_release_attempt_runtime(
  p_candidate_id varchar,p_source_commit varchar,p_candidate_runtime_identity_hash varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $bind_candidate_runtime$
DECLARE attempt framework_postdeploy_release_attempt%ROWTYPE; changed integer:=0;
BEGIN
  IF p_candidate_id IS NULL OR p_candidate_id!~'^[A-Za-z0-9._:-]{12,160}$'
     OR p_source_commit IS NULL OR p_source_commit!~'^[0-9a-f]{40}$'
     OR p_candidate_runtime_identity_hash IS NULL
     OR p_candidate_runtime_identity_hash!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'postdeploy candidate runtime binding is invalid' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('postdeploy-evidence-promotion:'||p_source_commit));
  UPDATE framework_postdeploy_release_attempt
     SET candidate_runtime_identity_hash=p_candidate_runtime_identity_hash
   WHERE candidate_id=p_candidate_id AND source_commit=p_source_commit
     AND attempt_status='STAGED' AND candidate_runtime_identity_hash IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  SELECT * INTO attempt FROM framework_postdeploy_release_attempt
   WHERE candidate_id=p_candidate_id FOR UPDATE;
  IF NOT FOUND OR attempt.source_commit<>p_source_commit
     OR attempt.attempt_status<>'STAGED'
     OR attempt.candidate_runtime_identity_hash<>p_candidate_runtime_identity_hash THEN
    RAISE EXCEPTION 'postdeploy candidate runtime binding exact CAS failed candidate=%',p_candidate_id
      USING ERRCODE=CASE WHEN changed=0 THEN '40001' ELSE '23514' END;
  END IF;
  RETURN jsonb_build_object(
    'status','STAGED_RUNTIME_BOUND','candidateId',attempt.candidate_id,
    'sourceCommit',attempt.source_commit,
    'candidateRuntimeIdentityHash',attempt.candidate_runtime_identity_hash
  );
END
$bind_candidate_runtime$;

CREATE OR REPLACE FUNCTION framework_validate_postdeploy_candidate_insert()
RETURNS trigger LANGUAGE plpgsql AS $candidate_trigger$
DECLARE calculated_hash varchar; attempt_hash varchar(64); attempt_status varchar(16);
BEGIN
  SELECT candidate_runtime_identity_hash,framework_postdeploy_release_attempt.attempt_status
    INTO attempt_hash,attempt_status
    FROM framework_postdeploy_release_attempt
   WHERE candidate_id=NEW.candidate_id AND source_commit=NEW.source_commit
   FOR SHARE;
  IF NOT FOUND OR attempt_status<>'STAGED'
     OR attempt_hash IS NULL
     OR NEW.candidate_runtime_identity_hash IS DISTINCT FROM attempt_hash
     OR NEW.evidence_json->>'runtimeIdentityHash' IS DISTINCT FROM attempt_hash
     OR NEW.evidence_json->>'status' IS DISTINCT FROM 'PASS'
     OR NEW.evidence_json->>'unitCode' IS DISTINCT FROM NEW.unit_code
     OR NEW.evidence_json->>'processCode' IS DISTINCT FROM NEW.process_code
     OR NEW.evidence_json->>'evidenceKind' IS DISTINCT FROM NEW.evidence_kind
     OR NEW.evidence_json->>'sourceCommit' IS DISTINCT FROM NEW.source_commit THEN
    RAISE EXCEPTION 'postdeploy candidate identity/runtime mismatch: %/%',NEW.candidate_id,NEW.unit_code
      USING ERRCODE='23514';
  END IF;
  calculated_hash:=encode(sha256(convert_to(concat_ws('|',
    NEW.unit_code,NEW.process_code,NEW.evidence_kind,NEW.source_commit,
    NEW.candidate_runtime_identity_hash,NEW.evidence_json::text
  ),'UTF8')),'hex');
  IF nullif(NEW.evidence_hash,'') IS NOT NULL AND NEW.evidence_hash<>calculated_hash THEN
    RAISE EXCEPTION 'postdeploy candidate evidence hash mismatch: %/%',NEW.candidate_id,NEW.unit_code
      USING ERRCODE='23514';
  END IF;
  NEW.evidence_hash:=calculated_hash;
  RETURN NEW;
END
$candidate_trigger$;

REVOKE ALL ON FUNCTION framework_bind_postdeploy_release_attempt_runtime(varchar,varchar,varchar) FROM PUBLIC;

COMMENT ON COLUMN framework_postdeploy_release_attempt.candidate_runtime_identity_hash IS
  'One-time exact-CAS V2 identity of the root-checkpointed live runtime validated by this attempt.';
COMMENT ON COLUMN framework_postdeploy_evidence_candidate.candidate_runtime_identity_hash IS
  'Immutable candidate-time V2 runtime identity included in every unit evidence hash.';
COMMENT ON FUNCTION framework_candidate_runtime_identity_hash_v2(varchar,varchar,varchar,varchar,bigint,bigint,integer,varchar,varchar,varchar) IS
  'Canonical V2 hash for a root-checkpointed live snapshot while the current runtime singleton is deliberately absent.';
COMMENT ON FUNCTION framework_bind_postdeploy_release_attempt_runtime(varchar,varchar,varchar) IS
  'One-time exact-CAS binding of a STAGED attempt to its candidate-time runtime identity.';

-- BUSINESS_E2E evidence is immutable and must never become current merely
-- because a later PodTemplate reuses the same source commit. Historical rows
-- remain NULL and therefore stale; only a freshly captured canonical runtime
-- identity can be inserted after this migration.
ALTER TABLE framework_process_qa_run
  ADD COLUMN IF NOT EXISTS runtime_identity_hash varchar(64);

DO $evidence_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='framework_process_qa_run'::regclass
       AND conname='ck_framework_process_qa_run_runtime_identity_hash'
  ) THEN
    ALTER TABLE framework_process_qa_run
      ADD CONSTRAINT ck_framework_process_qa_run_runtime_identity_hash
      CHECK (runtime_identity_hash IS NULL OR runtime_identity_hash~'^[0-9a-f]{64}$') NOT VALID;
  END IF;
END
$evidence_constraint$;

ALTER TABLE framework_process_qa_run
  VALIDATE CONSTRAINT ck_framework_process_qa_run_runtime_identity_hash;

DROP INDEX IF EXISTS uq_framework_process_qa_run_e2e_evidence;
CREATE UNIQUE INDEX uq_framework_process_qa_run_e2e_evidence
  ON framework_process_qa_run(
    process_code,step_code,process_version,contract_fingerprint,
    source_commit,runtime_identity_hash,evidence_hash
  ) WHERE evidence_type='BUSINESS_E2E';

CREATE OR REPLACE FUNCTION framework_validate_process_qa_evidence_insert()
RETURNS trigger LANGUAGE plpgsql AS $evidence_trigger$
DECLARE
  current_version varchar;
  current_fingerprint varchar;
  captured jsonb;
  runtime_state framework_runtime_release_state%ROWTYPE;
  canonical_runtime_hash varchar(64);
BEGIN
  IF NEW.evidence_type<>'BUSINESS_E2E' THEN
    NEW.runtime_identity_hash:=NULL;
    RETURN NEW;
  END IF;
  captured:=NEW.evidence_json->'contract';
  IF captured IS NULL THEN
    SELECT item INTO captured
      FROM jsonb_array_elements(coalesce(NEW.evidence_json->'contracts','[]'::jsonb)) item
     WHERE item->>'processCode'=NEW.process_code AND item->>'stepCode'=NEW.step_code
     LIMIT 1;
  END IF;
  SELECT * INTO STRICT runtime_state
    FROM framework_runtime_release_state
   WHERE release_key='CARBONET_RUNTIME'
   FOR SHARE;
  canonical_runtime_hash:=framework_runtime_release_identity_hash(runtime_state);
  SELECT process_version,framework_current_process_step_contract_fingerprint(process_code,NEW.step_code)
    INTO current_version,current_fingerprint
    FROM framework_process_definition WHERE process_code=NEW.process_code;
  IF captured IS NULL
     OR captured->>'processCode' IS DISTINCT FROM NEW.process_code
     OR captured->>'stepCode' IS DISTINCT FROM NEW.step_code
     OR captured->>'processVersion' IS DISTINCT FROM NEW.process_version
     OR captured->>'contractFingerprint' IS DISTINCT FROM NEW.contract_fingerprint
     OR captured->>'sourceCommit' IS DISTINCT FROM NEW.source_commit
     OR captured->>'runtimeIdentityHash' IS DISTINCT FROM canonical_runtime_hash
     OR captured->>'podTemplateSha256' IS DISTINCT FROM runtime_state.pod_template_sha256
     OR NEW.source_commit IS DISTINCT FROM runtime_state.source_commit
     OR canonical_runtime_hash IS NULL
     OR canonical_runtime_hash!~'^[0-9a-f]{64}$'
     OR NEW.process_version IS DISTINCT FROM current_version
     OR NEW.contract_fingerprint IS DISTINCT FROM current_fingerprint THEN
    RAISE EXCEPTION 'BUSINESS_E2E evidence is not bound to its pre-run current contract/runtime: %/%',
      NEW.process_code,NEW.step_code USING ERRCODE='23514';
  END IF;
  NEW.runtime_identity_hash:=canonical_runtime_hash;
  RETURN NEW;
END
$evidence_trigger$;

CREATE OR REPLACE VIEW framework_current_business_e2e_evidence AS
SELECT p.process_code,
       s.step_code,
       p.process_version AS current_process_version,
       fingerprint.contract_fingerprint AS current_contract_fingerprint,
       runtime.source_commit AS current_runtime_source_commit,
       latest.qa_run_id,
       CASE
         WHEN runtime.source_commit IS NULL OR runtime_hash.runtime_identity_hash IS NULL THEN 'NOT_RUN'
         WHEN fingerprint.contract_fingerprint IS NULL THEN 'NOT_RUN'
         WHEN latest.qa_run_id IS NULL THEN 'NOT_RUN'
         WHEN latest.result='PASSED' THEN 'PASSED'
         ELSE 'BLOCKED'
       END AS business_test_result,
       CASE
         WHEN runtime.source_commit IS NULL OR runtime_hash.runtime_identity_hash IS NULL THEN 'RUNTIME_IDENTITY_UNAVAILABLE'
         WHEN fingerprint.contract_fingerprint IS NULL THEN 'CONTRACT_FINGERPRINT_UNAVAILABLE'
         WHEN latest.qa_run_id IS NULL THEN 'NO_CURRENT_VERSION_EVIDENCE'
         WHEN latest.result='PASSED' THEN 'CURRENT_VERSION_PASS'
         ELSE 'CURRENT_VERSION_FAILED'
       END AS business_evidence_status,
       latest.result,latest.failure_reason,latest.evidence_json,latest.executed_by,latest.executed_at,
       latest.process_version AS evidence_process_version,latest.source_commit,
       latest.contract_fingerprint,latest.execution_environment,
       latest.evidence_uri,latest.evidence_hash,
       latest.qa_run_id IS NOT NULL AND runtime_hash.runtime_identity_hash IS NOT NULL AS current_version,
       runtime_hash.runtime_identity_hash AS current_runtime_identity_hash,
       latest.runtime_identity_hash
  FROM framework_process_definition p
  JOIN framework_process_step s ON s.process_code=p.process_code
  LEFT JOIN framework_runtime_release_state runtime ON runtime.release_key='CARBONET_RUNTIME'
  LEFT JOIN LATERAL (
    SELECT framework_runtime_release_identity_hash(runtime) runtime_identity_hash
  ) runtime_hash ON true
  LEFT JOIN LATERAL (
    SELECT framework_current_process_step_contract_fingerprint(p.process_code,s.step_code) contract_fingerprint
  ) fingerprint ON true
  LEFT JOIN LATERAL (
    SELECT evidence.* FROM framework_process_qa_run evidence
     WHERE evidence.evidence_type='BUSINESS_E2E'
       AND evidence.process_code=p.process_code AND evidence.step_code=s.step_code
       AND evidence.process_version=p.process_version
       AND evidence.contract_fingerprint=fingerprint.contract_fingerprint
       AND evidence.source_commit=runtime.source_commit
       AND evidence.runtime_identity_hash=runtime_hash.runtime_identity_hash
       AND runtime_hash.runtime_identity_hash IS NOT NULL
     ORDER BY evidence.executed_at DESC,evidence.qa_run_id DESC LIMIT 1
  ) latest ON true;

COMMENT ON COLUMN framework_process_qa_run.runtime_identity_hash IS
  'Canonical runtime identity captured and DB-validated when immutable BUSINESS_E2E evidence is inserted.';
COMMENT ON VIEW framework_current_business_e2e_evidence IS
  'Latest immutable BUSINESS_E2E evidence matching current source, PodTemplate-aware runtime identity, process version and compiled fingerprint.';


CREATE OR REPLACE FUNCTION framework_promote_postdeploy_evidence_candidate_v1(
  p_candidate_id varchar,
  p_source_commit varchar,
  p_runtime_identity_hash varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  expected_units constant text[]:=ARRAY[
    'ACTIVITY_DATA_RUNTIME','ACTIVITY_DATA_STATIC','ACTOR_ACCOUNT_CUSTOMER_JOURNEY',
    'CUSTOMER_WORK_COORDINATION_RUNTIME',
    'EMISSION_CALCULATION_RUNTIME','EMISSION_CALCULATION_STATIC','GOVERNANCE_CHANGE_RUNTIME',
    'OPERATIONAL_USAGE_LEDGER_GATE','ORGANIZATIONAL_BOUNDARY_RUNTIME',
    'REPORT_CERTIFICATION_RUNTIME','REPORT_CERTIFICATION_STATIC',
    'SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW'
  ];
  expected_processes constant text[]:=ARRAY[
    'ACTIVITY_DATA','CUSTOMER_WORK_COORDINATION','EMISSION_CALCULATION',
    'GOVERNANCE_CHANGE','ORGANIZATIONAL_BOUNDARY','REPORT_CERTIFICATION'
  ];
  observed_units text[];
  observed_processes text[];
  aggregate_hash varchar;
  runtime_state framework_runtime_release_state%ROWTYPE;
  runtime_identity_hash varchar;
  job_count integer:=0;
  artifact_count integer:=0;
  definition_count integer:=0;
  validation_count integer:=0;
  simulation_count integer:=0;
  event_count integer:=0;
  target_job_count integer:=0;
  job_process_count integer:=0;
  target_artifact_count integer:=0;
  artifact_process_count integer:=0;
  customer jsonb;
  activity jsonb;
  boundary jsonb;
  governance jsonb;
  actor_journey jsonb;
  screen_preview jsonb;
  usage_gate jsonb;
  existing framework_postdeploy_evidence_promotion%ROWTYPE;
  attempt framework_postdeploy_release_attempt%ROWTYPE;
BEGIN
  IF p_candidate_id IS NULL OR p_candidate_id !~ '^[A-Za-z0-9._:-]{12,160}$' THEN
    RAISE EXCEPTION 'postdeploy promotion candidate id is blank or invalid' USING ERRCODE='22023';
  END IF;
  IF p_source_commit IS NULL OR p_source_commit !~ '^[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'postdeploy promotion source commit is blank or invalid' USING ERRCODE='22023';
  END IF;
  IF p_runtime_identity_hash IS NULL OR p_runtime_identity_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'postdeploy runtime identity hash is blank or invalid' USING ERRCODE='22023';
  END IF;

  -- A commit may have many attempt-specific candidate ids, but exactly one of
  -- them may ever become current.  Serialize and reconcile by source commit,
  -- never by candidate id, so concurrent retries cannot append duplicate runs.
  PERFORM pg_advisory_xact_lock(hashtext('postdeploy-evidence-promotion:'||p_source_commit));

  -- Lock the singleton ledger row in the same transaction that promotes the
  -- business evidence.  The supplied hash binds this locked row to the exact
  -- Kubernetes deployment/pod snapshot checked by the promoter immediately
  -- before entering this transaction.
  SELECT * INTO runtime_state
  FROM framework_runtime_release_state
  WHERE release_key='CARBONET_RUNTIME'
  FOR SHARE;
  IF NOT FOUND OR runtime_state.source_commit<>p_source_commit
     OR runtime_state.health_status<>'UP' THEN
    RAISE EXCEPTION 'exact healthy runtime ledger is unavailable for commit %',p_source_commit;
  END IF;
  runtime_identity_hash:=framework_runtime_release_identity_hash(runtime_state);
  IF runtime_identity_hash IS NULL THEN
    RAISE EXCEPTION 'runtime ledger pod template identity is unavailable';
  END IF;
  IF runtime_identity_hash<>p_runtime_identity_hash THEN
    RAISE EXCEPTION 'runtime ledger identity changed before atomic promotion';
  END IF;

  -- The outer lifecycle wrapper already locks this row FOR UPDATE. Keep the
  -- internal primitive independently fail-closed: its one-time candidate hash
  -- must equal the final locked singleton before any reconciliation or write.
  SELECT * INTO attempt FROM framework_postdeploy_release_attempt
   WHERE candidate_id=p_candidate_id AND source_commit=p_source_commit
   FOR SHARE;
  IF NOT FOUND OR attempt.candidate_runtime_identity_hash IS NULL
     OR attempt.candidate_runtime_identity_hash<>p_runtime_identity_hash THEN
    RAISE EXCEPTION 'postdeploy attempt candidate runtime identity does not match final runtime';
  END IF;

  -- Reconcile only after the current K8s-bound runtime ledger has been locked
  -- and proven identical to the identity recorded by the original promotion.
  -- This prevents marker resurrection for an old image/UID after a rollback.
  SELECT * INTO existing FROM framework_postdeploy_evidence_promotion
   WHERE source_commit=p_source_commit;
  IF FOUND THEN
    IF existing.runtime_identity_hash<>runtime_identity_hash THEN
      RAISE EXCEPTION 'existing promotion runtime identity is no longer current';
    END IF;
    RETURN jsonb_build_object(
      'status','ALREADY_PROMOTED','candidateId',existing.candidate_id,
      'requestedCandidateId',p_candidate_id,
      'sourceCommit',existing.source_commit,
      'runtimeIdentityHash',existing.runtime_identity_hash,
      'evidenceHash',existing.evidence_hash,
      'processCount',existing.process_count,'unitCount',existing.unit_count
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM framework_postdeploy_evidence_promotion
    WHERE candidate_id=p_candidate_id AND source_commit<>p_source_commit
  ) THEN
    RAISE EXCEPTION 'candidate was already promoted for a different commit';
  END IF;

  SELECT array_agg(unit_code ORDER BY unit_code),
         array_agg(DISTINCT process_code ORDER BY process_code)
    INTO observed_units,observed_processes
  FROM framework_postdeploy_evidence_candidate
  WHERE candidate_id=p_candidate_id;
  IF observed_units IS DISTINCT FROM expected_units THEN
    RAISE EXCEPTION 'candidate exact unit set mismatch expected=% actual=%',expected_units,observed_units;
  END IF;
  observed_processes:=array_remove(observed_processes,'__RELEASE__');
  IF observed_processes IS DISTINCT FROM expected_processes THEN
    RAISE EXCEPTION 'candidate exact process set mismatch expected=% actual=%',expected_processes,observed_processes;
  END IF;
  IF EXISTS (
    WITH expected(unit_code,process_code,evidence_kind) AS (VALUES
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
      ('SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW','__RELEASE__','RELEASE_GATE')
    ), actual AS (
      SELECT unit_code,process_code,evidence_kind
      FROM framework_postdeploy_evidence_candidate
      WHERE candidate_id=p_candidate_id
    )
    SELECT 1
    FROM expected e FULL JOIN actual a USING(unit_code,process_code,evidence_kind)
    WHERE e.unit_code IS NULL OR a.unit_code IS NULL
  ) THEN
    RAISE EXCEPTION 'candidate exact unit/process/kind tuple contract mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM framework_postdeploy_evidence_candidate
    WHERE candidate_id=p_candidate_id AND (
      source_commit<>p_source_commit OR source_commit='' OR evidence_status<>'CANDIDATE_VERIFIED'
      OR evidence_hash !~ '^[0-9a-f]{64}$'
      OR candidate_runtime_identity_hash IS DISTINCT FROM p_runtime_identity_hash
      OR evidence_json->>'runtimeIdentityHash' IS DISTINCT FROM p_runtime_identity_hash
      OR evidence_json->>'sourceCommit'<>p_source_commit OR evidence_json->>'status'<>'PASS'
    )
  ) THEN
    RAISE EXCEPTION 'candidate contains stale, blank, failed, or unbound evidence';
  END IF;

  SELECT encode(sha256(convert_to(p_source_commit||'|'||p_runtime_identity_hash||'|'||
      string_agg(unit_code||':'||evidence_hash,'|' ORDER BY unit_code),'UTF8')),'hex')
    INTO aggregate_hash
  FROM framework_postdeploy_evidence_candidate
  WHERE candidate_id=p_candidate_id;

  SELECT evidence_json INTO customer FROM framework_postdeploy_evidence_candidate
   WHERE candidate_id=p_candidate_id AND unit_code='CUSTOMER_WORK_COORDINATION_RUNTIME';
  SELECT evidence_json INTO activity FROM framework_postdeploy_evidence_candidate
   WHERE candidate_id=p_candidate_id AND unit_code='ACTIVITY_DATA_RUNTIME';
  SELECT evidence_json INTO boundary FROM framework_postdeploy_evidence_candidate
   WHERE candidate_id=p_candidate_id AND unit_code='ORGANIZATIONAL_BOUNDARY_RUNTIME';
  SELECT evidence_json INTO governance FROM framework_postdeploy_evidence_candidate
   WHERE candidate_id=p_candidate_id AND unit_code='GOVERNANCE_CHANGE_RUNTIME';
  SELECT evidence_json INTO actor_journey FROM framework_postdeploy_evidence_candidate
   WHERE candidate_id=p_candidate_id AND unit_code='ACTOR_ACCOUNT_CUSTOMER_JOURNEY';
  SELECT evidence_json INTO screen_preview FROM framework_postdeploy_evidence_candidate
   WHERE candidate_id=p_candidate_id AND unit_code='SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW';
  SELECT evidence_json INTO usage_gate FROM framework_postdeploy_evidence_candidate
   WHERE candidate_id=p_candidate_id AND unit_code='OPERATIONAL_USAGE_LEDGER_GATE';
  IF coalesce(customer->>'projectId','')='' OR coalesce(activity->>'projectId','')=''
     OR coalesce(boundary->>'projectId','')='' OR coalesce(boundary->>'runtimeEvidence','')=''
     OR coalesce(governance->>'runtimeEvidence','')=''
     OR coalesce(boundary->>'runtimeEvidenceHash','') !~ '^[0-9a-f]{64}$'
     OR coalesce(governance->>'runtimeEvidenceHash','') !~ '^[0-9a-f]{64}$'
     OR boundary->>'freshRuntimeAssertions' IS DISTINCT FROM 'true'
     OR governance->>'freshRuntimeAssertions' IS DISTINCT FROM 'true'
     OR boundary->'runtimeCaseTypes' IS DISTINCT FROM '["HAPPY_PATH","AUTHORITY","ISOLATION","RECOVERY","EXCEPTION"]'::jsonb
     OR governance->'runtimeCaseTypes' IS DISTINCT FROM '["HAPPY_PATH","AUTHORITY","ISOLATION","RECOVERY","EXCEPTION"]'::jsonb THEN
    RAISE EXCEPTION 'candidate runtime evidence payload is incomplete';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      (customer,'actorCount',1::numeric,100::numeric),
      (customer,'taskCount',1::numeric,1000::numeric),
      (customer,'authenticatedApiCount',1::numeric,1000::numeric),
      (customer,'protectedApiCount',1::numeric,1000::numeric),
      (customer,'pageCount',1::numeric,1000::numeric),
      (customer,'p95Millis',0::numeric,60000::numeric),
      (customer,'readyReplicas',1::numeric,100::numeric),
      (activity,'authenticatedApiCount',1::numeric,1000::numeric),
      (activity,'protectedApiCount',1::numeric,1000::numeric),
      (activity,'pageCount',1::numeric,1000::numeric),
      (activity,'p95Millis',0::numeric,60000::numeric),
      (activity,'readyReplicas',1::numeric,100::numeric),
      (boundary,'authenticatedApiCount',1::numeric,1000::numeric),
      (boundary,'protectedApiCount',1::numeric,1000::numeric),
      (boundary,'pageCount',1::numeric,1000::numeric),
      (boundary,'p95Millis',0::numeric,60000::numeric),
      (boundary,'readyReplicas',1::numeric,100::numeric)
    ) required(document,key_name,min_value,max_value)
    WHERE jsonb_typeof(document->key_name) IS DISTINCT FROM 'number'
       OR NOT CASE WHEN document->>key_name ~ '^[0-9]+$'
                   THEN (document->>key_name)::numeric BETWEEN min_value AND max_value
                   ELSE false END
  ) THEN
    RAISE EXCEPTION 'candidate runtime numeric evidence is missing or out of range';
  END IF;

  IF actor_journey->>'mutableBusinessWrites' IS DISTINCT FROM '0'
     OR coalesce(actor_journey->>'mutableBusinessHashBefore','') !~ '^[0-9a-f]{64}$'
     OR actor_journey->>'mutableBusinessHashAfter' IS DISTINCT FROM actor_journey->>'mutableBusinessHashBefore'
     OR actor_journey->>'securityAuditAppendDelta' IS DISTINCT FROM '2'
     OR actor_journey->>'scopeAuditIdDelta' IS DISTINCT FROM '1'
     OR actor_journey->>'actorAuditIdDelta' IS DISTINCT FROM '1'
     OR actor_journey->'securityAuditTypes' IS DISTINCT FROM '["PROJECT_SCOPE_DENIED","ACTOR_ROLE_DENIED"]'::jsonb
     OR actor_journey->>'draftMutation' IS DISTINCT FROM 'SKIPPED_CANDIDATE_READ_ONLY'
     OR actor_journey->>'authTokenBaseline' IS DISTINCT FROM '0'
     OR actor_journey->>'authTokenAfter' IS DISTINCT FROM '0'
     OR actor_journey->>'authTokenCleanupVerified' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'actor-account candidate mutable/audit/auth evidence contract mismatch';
  END IF;
  IF jsonb_typeof(actor_journey->'securityAuditEvidence') IS DISTINCT FROM 'array'
     OR jsonb_array_length(actor_journey->'securityAuditEvidence')<>2
     OR (SELECT count(DISTINCT item->>'auditId') FROM jsonb_array_elements(actor_journey->'securityAuditEvidence') item)<>2
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(actor_journey->'securityAuditEvidence') WITH ORDINALITY evidence(item,position)
       WHERE jsonb_typeof(item->'schemaVersion') IS DISTINCT FROM 'number'
          OR item->>'schemaVersion' IS DISTINCT FROM '2'
          OR jsonb_typeof(item->'auditId') IS DISTINCT FROM 'number'
          OR coalesce(item->>'auditId','') !~ '^[1-9][0-9]*$'
          OR coalesce(item->>'rowHash','') !~ '^[0-9a-f]{64}$'
          OR item->>'decisionCode' IS DISTINCT FROM 'DENIED'
          OR item->>'outcomeCode' IS DISTINCT FROM 'ACCESS_DENIED'
          OR (position=1 AND (item->>'accountId' IS DISTINCT FROM 'qadata26'
              OR item->>'reasonCode' IS DISTINCT FROM 'PROJECT_TENANT_SCOPE_DENIED'
              OR item->>'actionCode' IS DISTINCT FROM 'PROJECT_PARTICIPANT_READ'
              OR item->>'resourceType' IS DISTINCT FROM 'EMISSION_PROJECT'))
          OR (position=2 AND (item->>'accountId' IS DISTINCT FROM 'qacalc26'
              OR item->>'reasonCode' IS DISTINCT FROM 'ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER'
              OR item->>'actionCode' IS DISTINCT FROM 'REGULATORY_SUBMISSION_TRANSITION'
              OR item->>'resourceType' IS DISTINCT FROM 'REGULATORY_SUBMISSION'))
     ) THEN
    RAISE EXCEPTION 'actor-account security audit append evidence is malformed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(actor_journey->'securityAuditEvidence') evidence(item)
    LEFT JOIN framework_scope_access_audit audit
      ON audit.audit_id=(evidence.item->>'auditId')::bigint
    WHERE audit.audit_id IS NULL
       OR audit.account_id<>evidence.item->>'accountId'
       OR audit.tenant_id<>evidence.item->>'tenantId'
       OR audit.project_id<>evidence.item->>'projectId'
       OR audit.decision_code<>evidence.item->>'decisionCode'
       OR audit.reason_code<>evidence.item->>'reasonCode'
       OR audit.action_code<>evidence.item->>'actionCode'
       OR audit.resource_type<>evidence.item->>'resourceType'
       OR audit.outcome_code<>evidence.item->>'outcomeCode'
       OR audit.schema_version::text<>evidence.item->>'schemaVersion'
       OR audit.row_hash<>evidence.item->>'rowHash'
  ) THEN
    RAISE EXCEPTION 'actor-account security audit row/hash no longer matches candidate evidence';
  END IF;

  IF screen_preview->>'previewCount' IS DISTINCT FROM '3'
     OR screen_preview->>'rolledBack' IS DISTINCT FROM 'true'
     OR screen_preview->>'canonicalStateUnchanged' IS DISTINCT FROM 'true'
     OR screen_preview->>'databaseCurrentWrites' IS DISTINCT FROM '0'
     OR coalesce(screen_preview->>'databaseStateHashBefore','') !~ '^[0-9a-f]{64}$'
     OR screen_preview->>'databaseStateHashAfter' IS DISTINCT FROM screen_preview->>'databaseStateHashBefore'
     OR coalesce(screen_preview->>'contractHashBefore','') !~ '^[0-9a-f]{64}$'
     OR screen_preview->>'contractHashAfter' IS DISTINCT FROM screen_preview->>'contractHashBefore'
     OR coalesce(screen_preview->>'runtimeHashBefore','') !~ '^[0-9a-f]{64}$'
     OR screen_preview->>'runtimeHashAfter' IS DISTINCT FROM screen_preview->>'runtimeHashBefore' THEN
    RAISE EXCEPTION 'screen preview rollback/current-write evidence contract mismatch';
  END IF;

  IF usage_gate->>'allowedRole' IS DISTINCT FROM 'SYSTEM_ADMIN_FAMILY'
     OR usage_gate->>'anonymousDenied' IS DISTINCT FROM '2'
     OR usage_gate->>'ordinaryDenied' IS DISTINCT FROM '7'
     OR usage_gate->>'browserViewports' IS DISTINCT FROM '2'
     OR usage_gate->>'persistentFixtures' IS DISTINCT FROM '0'
     OR usage_gate->>'reviewCreateReloadIdempotencyCleanup' IS DISTINCT FROM 'true'
     OR coalesce(usage_gate->>'totalSteps','') !~ '^[1-9][0-9]*$'
     OR coalesce(usage_gate->>'pages','') !~ '^[1-9][0-9]*$'
     OR coalesce(usage_gate->>'durationSeconds','') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'operational usage-ledger live gate evidence contract mismatch';
  END IF;

  SELECT count(*),count(DISTINCT process_code) INTO target_job_count,job_process_count
  FROM framework_development_job
  WHERE process_code='CUSTOMER_WORK_COORDINATION'
     OR (process_code IN ('ORGANIZATIONAL_BOUNDARY','GOVERNANCE_CHANGE') AND required)
     OR (process_code IN ('ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION') AND job_type IN (
       'DESIGN','DATABASE','API','BACKEND','API_QUALITY','DATABASE_QUALITY','FRONTEND_USER','FRONTEND_ADMIN',
       'DESIGN_PREFLIGHT','COMPONENT_COMMON','CLASS_PROPERTY_COMMON','UI_QUALITY','SEARCH',
       'ACTOR_TEST','DEPLOYMENT','INTEGRATION','PERFORMANCE','TEST'
     ));
  IF target_job_count<6 OR job_process_count<>6 THEN
    RAISE EXCEPTION 'job promotion target coverage mismatch rows=% processes=%',target_job_count,job_process_count;
  END IF;
  IF EXISTS (
    WITH target AS (
      SELECT process_code FROM framework_development_job
      WHERE process_code='CUSTOMER_WORK_COORDINATION'
         OR (process_code IN ('ORGANIZATIONAL_BOUNDARY','GOVERNANCE_CHANGE') AND required)
         OR (process_code IN ('ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION') AND job_type IN (
           'DESIGN','DATABASE','API','BACKEND','API_QUALITY','DATABASE_QUALITY','FRONTEND_USER','FRONTEND_ADMIN',
           'DESIGN_PREFLIGHT','COMPONENT_COMMON','CLASS_PROPERTY_COMMON','UI_QUALITY','SEARCH',
           'ACTOR_TEST','DEPLOYMENT','INTEGRATION','PERFORMANCE','TEST'
         ))
    )
    SELECT 1 FROM unnest(expected_processes) expected(process_code)
    WHERE NOT EXISTS (SELECT 1 FROM target WHERE target.process_code=expected.process_code)
  ) THEN
    RAISE EXCEPTION 'job promotion requires at least one exact target for every process';
  END IF;

  WITH target AS MATERIALIZED (
    SELECT job_id,job_status FROM framework_development_job
    WHERE process_code='CUSTOMER_WORK_COORDINATION'
       OR (process_code IN ('ORGANIZATIONAL_BOUNDARY','GOVERNANCE_CHANGE') AND required)
       OR (process_code IN ('ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION') AND job_type IN (
         'DESIGN','DATABASE','API','BACKEND','API_QUALITY','DATABASE_QUALITY','FRONTEND_USER','FRONTEND_ADMIN',
         'DESIGN_PREFLIGHT','COMPONENT_COMMON','CLASS_PROPERTY_COMMON','UI_QUALITY','SEARCH',
         'ACTOR_TEST','DEPLOYMENT','INTEGRATION','PERFORMANCE','TEST'
       ))
  ), updated AS (
    UPDATE framework_development_job job
       SET job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',
           evidence_ref='postdeploy:'||p_source_commit||':sha256:'||aggregate_hash,
           last_error=NULL,completed_at=current_timestamp,worker_id=NULL,lease_token=NULL,
           lease_until=NULL,updated_at=current_timestamp
      FROM target WHERE job.job_id=target.job_id
      RETURNING job.job_id
  ), events AS (
    INSERT INTO framework_development_job_event(
      job_id,event_type,from_status,to_status,worker_id,detail_json
    )
    SELECT target.job_id,'POSTDEPLOY_EVIDENCE_PROMOTED',target.job_status,'COMPLETED',
           'postdeploy-evidence-promoter',
           jsonb_build_object('candidateId',p_candidate_id,'commit',p_source_commit,'evidenceHash',aggregate_hash)
    FROM target RETURNING event_id
  )
  SELECT (SELECT count(*) FROM updated),(SELECT count(*) FROM events)
    INTO job_count,event_count;
  IF job_count<>target_job_count OR job_count<>event_count THEN
    RAISE EXCEPTION 'job promotion/event cardinality mismatch target=% jobs=% events=%',target_job_count,job_count,event_count;
  END IF;

  SELECT count(*),count(DISTINCT process_code) INTO target_artifact_count,artifact_process_count
  FROM framework_process_artifact WHERE process_code=ANY(expected_processes);
  IF target_artifact_count<6 OR artifact_process_count<>6 THEN
    RAISE EXCEPTION 'artifact promotion target coverage mismatch rows=% processes=%',target_artifact_count,artifact_process_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(expected_processes) expected(process_code)
    WHERE NOT EXISTS (
      SELECT 1 FROM framework_process_artifact artifact
      WHERE artifact.process_code=expected.process_code
    )
  ) THEN
    RAISE EXCEPTION 'artifact promotion requires at least one exact target for every process';
  END IF;
  UPDATE framework_process_artifact
     SET delivery_status='VERIFIED',
         evidence_ref='postdeploy:'||p_source_commit||':sha256:'||aggregate_hash,
         updated_at=current_timestamp
   WHERE process_code=ANY(expected_processes);
  GET DIAGNOSTICS artifact_count=ROW_COUNT;
  IF artifact_count<>target_artifact_count THEN
    RAISE EXCEPTION 'artifact promotion cardinality mismatch target=% updated=%',target_artifact_count,artifact_count;
  END IF;

  UPDATE framework_process_definition
     SET definition_locked=true,process_status='ACTIVE',updated_at=current_timestamp
   WHERE process_code IN ('ORGANIZATIONAL_BOUNDARY','GOVERNANCE_CHANGE');
  GET DIAGNOSTICS definition_count=ROW_COUNT;
  IF definition_count<>2 THEN
    RAISE EXCEPTION 'definition promotion count mismatch expected=2 actual=%',definition_count;
  END IF;

  INSERT INTO framework_customer_journey_validation_run(
    project_id,validation_status,actor_count,task_count,authenticated_api_count,
    protected_api_count,page_count,p95_millis,evidence_json,source_commit
  ) VALUES (
    customer->>'projectId','PASSED',(customer->>'actorCount')::integer,
    (customer->>'taskCount')::integer,(customer->>'authenticatedApiCount')::integer,
    (customer->>'protectedApiCount')::integer,(customer->>'pageCount')::integer,
    (customer->>'p95Millis')::integer,
    jsonb_build_object('candidateId',p_candidate_id,'candidateEvidence',customer,
      'promotionEvidenceHash',aggregate_hash)::text,p_source_commit
  );
  validation_count:=validation_count+1;

  INSERT INTO framework_activity_runtime_validation_run(
    process_code,validation_status,authenticated_api_count,protected_api_count,page_count,
    p95_millis,ready_replicas,evidence_json,source_commit,executed_by
  ) VALUES (
    'ACTIVITY_DATA','PASSED',(activity->>'authenticatedApiCount')::integer,
    (activity->>'protectedApiCount')::integer,(activity->>'pageCount')::integer,
    (activity->>'p95Millis')::integer,(activity->>'readyReplicas')::integer,
    jsonb_build_object('candidateId',p_candidate_id,'candidateEvidence',activity,
      'promotionEvidenceHash',aggregate_hash)::text,p_source_commit,'POSTDEPLOY_EVIDENCE_PROMOTER'
  );
  validation_count:=validation_count+1;

  INSERT INTO framework_organizational_boundary_runtime_validation_run(
    validation_status,project_id,authenticated_api_count,protected_api_count,page_count,
    p95_millis,ready_replicas,runtime_evidence_ref,source_commit,executed_by
  ) VALUES (
    'PASSED',boundary->>'projectId',(boundary->>'authenticatedApiCount')::integer,
    (boundary->>'protectedApiCount')::integer,(boundary->>'pageCount')::integer,
    (boundary->>'p95Millis')::integer,(boundary->>'readyReplicas')::integer,
    boundary->>'runtimeEvidence',p_source_commit,'POSTDEPLOY_EVIDENCE_PROMOTER'
  );
  validation_count:=validation_count+1;

  -- The generic runtime smoke proves five assertion classes, but it does not
  -- bind each assertion to an immutable case fingerprint. Never manufacture
  -- per-case PASSED rows from that aggregate proof.
  simulation_count:=0;
  IF simulation_count<>0 OR validation_count<>3 THEN
    RAISE EXCEPTION 'appended evidence count mismatch validation=% simulation=%',validation_count,simulation_count;
  END IF;

  INSERT INTO framework_postdeploy_evidence_promotion(
    candidate_id,source_commit,runtime_identity_hash,evidence_hash,process_count,unit_count,
    promoted_job_count,promoted_artifact_count,promoted_definition_count,
    appended_validation_count,appended_simulation_count
  ) VALUES (
    p_candidate_id,p_source_commit,runtime_identity_hash,aggregate_hash,6,12,
    job_count,artifact_count,definition_count,validation_count,simulation_count
  );

  RETURN jsonb_build_object(
    'status','PROMOTED','candidateId',p_candidate_id,'sourceCommit',p_source_commit,
    'runtimeIdentityHash',runtime_identity_hash,
    'evidenceHash',aggregate_hash,'processCount',6,'unitCount',12,
    'promotedJobCount',job_count,'promotedArtifactCount',artifact_count,
    'promotedDefinitionCount',definition_count,'appendedValidationCount',validation_count,
    'appendedSimulationCount',simulation_count,'markerContract','DB_AUTHORITATIVE_FILESYSTEM_DERIVED'
  );
END
$$;

REVOKE ALL ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar) FROM PUBLIC;

-- CREATE OR REPLACE preserves the existing function ACL. Revoke any explicit
-- non-owner EXECUTE grant that may have drifted after the original lifecycle
-- migration, so callers cannot bypass its authoritative wrapper.
DO $acl$
DECLARE grantee_role name;
BEGIN
  FOR grantee_role IN
    SELECT pg_get_userbyid(acl.grantee)
      FROM pg_proc proc
      CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl,acldefault('f',proc.proowner))) acl
     WHERE proc.oid='framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar)'::regprocedure
       AND acl.grantee<>0 AND acl.grantee<>proc.proowner AND acl.privilege_type='EXECUTE'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar) FROM %I',
      grantee_role
    );
  END LOOP;
END
$acl$;

COMMENT ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar) IS
  'Internal atomic promoter bound to the V2 PodTemplate-aware runtime identity.';

CREATE OR REPLACE FUNCTION framework_screen_workflow_current_runtime_identity()
RETURNS TABLE(source_commit varchar(40),runtime_identity jsonb,runtime_identity_hash varchar(64))
LANGUAGE sql
STABLE
AS $function$
  SELECT runtime.source_commit,
         jsonb_build_object(
           'identityVersion',CASE
             WHEN framework_runtime_release_uses_legacy_identity_v1(runtime)
             THEN 'CARBONET_RUNTIME_IDENTITY_V1_LEGACY_76A'
             ELSE 'CARBONET_RUNTIME_IDENTITY_V2'
           END,
           'sourceCommit',runtime.source_commit,
           'deploymentNamespace',runtime.deployment_namespace,
           'deploymentName',runtime.deployment_name,
           'deploymentUid',runtime.deployment_uid,
           'deploymentGeneration',runtime.deployment_generation,
           'observedGeneration',runtime.observed_generation,
           'desiredReplicas',runtime.desired_replicas,
           'imageRef',runtime.image_ref,
           'imageId',runtime.image_id,
           'healthStatus',runtime.health_status,
           'podTemplateSha256',runtime.pod_template_sha256
         ),
         framework_runtime_release_identity_hash(runtime)
    FROM framework_runtime_release_state runtime
   WHERE runtime.release_key='CARBONET_RUNTIME'
     AND runtime.health_status='UP'
     AND runtime.pod_template_sha256 ~ '^[0-9a-f]{64}$';
$function$;

CREATE OR REPLACE FUNCTION framework_composite_verified_canary_dispatch_exact(
  p_process_code varchar,p_job_id bigint,p_receipt jsonb)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(
    SELECT 1
      FROM integrated_design_live_smoke_dispatch dispatch
      JOIN framework_development_job job ON job.job_id=dispatch.job_id
       AND job.process_code=dispatch.process_code
      JOIN framework_runtime_release_state runtime
        ON runtime.release_key='CARBONET_RUNTIME' AND runtime.health_status='UP'
       AND runtime.source_commit=dispatch.runtime_commit
       AND dispatch.runtime_identity_hash=framework_runtime_release_identity_hash(runtime)
     WHERE dispatch.dispatch_id=CASE WHEN p_receipt->>'liveSmokeDispatchId'~'^[0-9]+$'
       THEN (p_receipt->>'liveSmokeDispatchId')::bigint END
       AND dispatch.job_id=p_job_id AND dispatch.process_code=p_process_code
       AND dispatch.status='COMPLETED'
       AND dispatch.runtime_commit=p_receipt#>>'{canary,runtimeCommit}'
       AND dispatch.runtime_identity_hash=p_receipt#>>'{canary,requestedRuntimeIdentityHash}'
       AND dispatch.canary_attempt=CASE WHEN p_receipt#>>'{canary,attemptNumber}'~'^[1-3]$'
         THEN (p_receipt#>>'{canary,attemptNumber}')::integer END
       AND dispatch.authority_revision_set_hash=
         framework_composite_authority_revision_set_hash(dispatch.job_id)
       AND dispatch.artifact_manifest_hash=framework_try_jsonb(job.result_json)#>>
         '{canonicalGeneration,compositeArtifactManifestHash}'
       AND dispatch.process_source_hash=framework_try_jsonb(job.specification_json)->>
         'processInputHash'
       AND job.job_type='FULL_STACK_GENERATION'
       AND job.job_group_code=p_process_code||'_CANONICAL_PUBLICATION'
       AND job.job_status IN('VERIFIED','COMPLETED') AND job.quality_status='VERIFIED'
       AND dispatch.submitted_evidence_count=dispatch.expected_evidence_count
       AND (SELECT count(*) FROM integrated_design_live_smoke_evidence evidence
             WHERE evidence.dispatch_id=dispatch.dispatch_id)=dispatch.expected_evidence_count
       AND p_receipt->>'liveSmokeEvidenceCount'~'^[0-9]+$'
       AND (p_receipt->>'liveSmokeEvidenceCount')::integer=dispatch.expected_evidence_count
       AND NOT EXISTS(SELECT 1 FROM integrated_design_live_smoke_evidence evidence
         WHERE evidence.dispatch_id=dispatch.dispatch_id AND(
           dispatch.started_at IS NULL OR evidence.observed_at<dispatch.started_at
           OR evidence.observed_at>evidence.recorded_at
           OR evidence.recorded_at>dispatch.completed_at))
       AND p_receipt->>'liveSmokeEvidenceSetHash'=(SELECT
         framework_composite_live_smoke_hash(coalesce(jsonb_agg(evidence.evidence_hash
           ORDER BY evidence.authority_id,evidence.authority_revision,
             evidence.command_code COLLATE "C",evidence.scenario_code COLLATE "C",
             evidence.status_case COLLATE "C",evidence.lane COLLATE "C"),'[]'::jsonb))
         FROM integrated_design_live_smoke_evidence evidence
        WHERE evidence.dispatch_id=dispatch.dispatch_id)
  )
$$;
