-- Post-deploy validators must not make a failed release look current.  They
-- append immutable candidate facts here; one final, commit-bound transaction
-- is the only operation allowed to promote those facts into current evidence.

CREATE TABLE IF NOT EXISTS framework_postdeploy_evidence_candidate (
  candidate_id varchar(160) NOT NULL,
  unit_code varchar(80) NOT NULL,
  process_code varchar(80) NOT NULL,
  evidence_kind varchar(24) NOT NULL,
  source_commit varchar(40) NOT NULL,
  evidence_status varchar(32) NOT NULL DEFAULT 'CANDIDATE_VERIFIED',
  evidence_json jsonb NOT NULL,
  evidence_hash varchar(64) NOT NULL,
  staged_by varchar(100) NOT NULL DEFAULT 'AUTO_DEPLOY_CANDIDATE',
  staged_at timestamptz NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY (candidate_id,unit_code),
  CONSTRAINT ck_postdeploy_candidate_id CHECK (candidate_id ~ '^[A-Za-z0-9._:-]{12,160}$'),
  CONSTRAINT ck_postdeploy_candidate_unit CHECK (unit_code ~ '^[A-Z0-9_]{3,80}$'),
  CONSTRAINT ck_postdeploy_candidate_process CHECK (process_code ~ '^(__RELEASE__|[A-Z0-9_]{3,80})$'),
  CONSTRAINT ck_postdeploy_candidate_kind CHECK (evidence_kind IN ('STATIC','RUNTIME','RELEASE_GATE')),
  CONSTRAINT ck_postdeploy_candidate_commit CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  CONSTRAINT ck_postdeploy_candidate_status CHECK (evidence_status='CANDIDATE_VERIFIED'),
  CONSTRAINT ck_postdeploy_candidate_hash CHECK (evidence_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_postdeploy_candidate_commit
  ON framework_postdeploy_evidence_candidate(source_commit,candidate_id,unit_code);

CREATE TABLE IF NOT EXISTS framework_postdeploy_evidence_promotion (
  promotion_id bigserial PRIMARY KEY,
  candidate_id varchar(160) NOT NULL UNIQUE,
  source_commit varchar(40) NOT NULL,
  runtime_identity_hash varchar(64) NOT NULL,
  evidence_hash varchar(64) NOT NULL,
  process_count integer NOT NULL,
  unit_count integer NOT NULL,
  promoted_job_count integer NOT NULL,
  promoted_artifact_count integer NOT NULL,
  promoted_definition_count integer NOT NULL,
  appended_validation_count integer NOT NULL,
  appended_simulation_count integer NOT NULL,
  marker_contract varchar(64) NOT NULL DEFAULT 'DB_AUTHORITATIVE_FILESYSTEM_DERIVED',
  promoted_by varchar(100) NOT NULL DEFAULT 'POSTDEPLOY_EVIDENCE_PROMOTER',
  promoted_at timestamptz NOT NULL DEFAULT current_timestamp,
  CONSTRAINT uq_postdeploy_promotion_source_commit UNIQUE (source_commit),
  CONSTRAINT ck_postdeploy_promotion_commit CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  CONSTRAINT ck_postdeploy_promotion_runtime_hash CHECK (runtime_identity_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_postdeploy_promotion_hash CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_postdeploy_promotion_counts CHECK (
    process_count=6 AND unit_count=12 AND promoted_job_count>=0
    AND promoted_artifact_count>=0 AND promoted_definition_count=2
    AND appended_validation_count=3 AND appended_simulation_count=0
  ),
  CONSTRAINT ck_postdeploy_promotion_marker CHECK (marker_contract='DB_AUTHORITATIVE_FILESYSTEM_DERIVED')
);

CREATE OR REPLACE FUNCTION framework_validate_postdeploy_candidate_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE calculated_hash varchar;
BEGIN
  IF NEW.evidence_json->>'status' IS DISTINCT FROM 'PASS'
     OR NEW.evidence_json->>'unitCode' IS DISTINCT FROM NEW.unit_code
     OR NEW.evidence_json->>'processCode' IS DISTINCT FROM NEW.process_code
     OR NEW.evidence_json->>'evidenceKind' IS DISTINCT FROM NEW.evidence_kind
     OR NEW.evidence_json->>'sourceCommit' IS DISTINCT FROM NEW.source_commit THEN
    RAISE EXCEPTION 'postdeploy candidate identity mismatch: %/%',NEW.candidate_id,NEW.unit_code
      USING ERRCODE='23514';
  END IF;
  calculated_hash:=encode(sha256(convert_to(concat_ws('|',
    NEW.unit_code,NEW.process_code,NEW.evidence_kind,NEW.source_commit,NEW.evidence_json::text
  ),'UTF8')),'hex');
  IF nullif(NEW.evidence_hash,'') IS NOT NULL AND NEW.evidence_hash<>calculated_hash THEN
    RAISE EXCEPTION 'postdeploy candidate evidence hash mismatch: %/%',NEW.candidate_id,NEW.unit_code
      USING ERRCODE='23514';
  END IF;
  NEW.evidence_hash:=calculated_hash;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION framework_reject_postdeploy_candidate_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'postdeploy candidate evidence is immutable; use a new candidate id'
    USING ERRCODE='55000';
END
$$;

DROP TRIGGER IF EXISTS trg_postdeploy_candidate_validate_insert ON framework_postdeploy_evidence_candidate;
CREATE TRIGGER trg_postdeploy_candidate_validate_insert
  BEFORE INSERT ON framework_postdeploy_evidence_candidate
  FOR EACH ROW EXECUTE FUNCTION framework_validate_postdeploy_candidate_insert();

DROP TRIGGER IF EXISTS trg_postdeploy_candidate_immutable ON framework_postdeploy_evidence_candidate;
CREATE TRIGGER trg_postdeploy_candidate_immutable
  BEFORE UPDATE OR DELETE ON framework_postdeploy_evidence_candidate
  FOR EACH ROW EXECUTE FUNCTION framework_reject_postdeploy_candidate_mutation();

CREATE OR REPLACE FUNCTION framework_promote_postdeploy_evidence_candidate(
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
  runtime_identity_hash:=encode(sha256(convert_to(concat_ws('|',
    runtime_state.source_commit,runtime_state.deployment_namespace,runtime_state.deployment_name,
    runtime_state.deployment_uid,runtime_state.deployment_generation,
    runtime_state.observed_generation,runtime_state.desired_replicas,
    runtime_state.image_ref,runtime_state.image_id,runtime_state.health_status
  ),'UTF8')),'hex');
  IF runtime_identity_hash<>p_runtime_identity_hash THEN
    RAISE EXCEPTION 'runtime ledger identity changed before atomic promotion';
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
      OR evidence_json->>'sourceCommit'<>p_source_commit OR evidence_json->>'status'<>'PASS'
    )
  ) THEN
    RAISE EXCEPTION 'candidate contains stale, blank, failed, or unbound evidence';
  END IF;

  SELECT encode(sha256(convert_to(p_source_commit||'|'||
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

COMMENT ON FUNCTION framework_promote_postdeploy_evidence_candidate(varchar,varchar,varchar) IS
  'Final atomic postdeploy promotion. Call only after every gate and the operational usage-ledger live E2E pass.';
