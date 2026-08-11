CREATE TABLE IF NOT EXISTS framework_screen_workflow_audit_batch (
  audit_batch_id uuid PRIMARY KEY,
  audit_type varchar(40) NOT NULL DEFAULT 'HOURLY_ALL_PROCESS',
  batch_status varchar(16) NOT NULL DEFAULT 'RUNNING',
  source_commit varchar(40) NOT NULL,
  runtime_identity jsonb NOT NULL,
  runtime_identity_hash varchar(64) NOT NULL,
  catalog_fingerprint varchar(64) NOT NULL,
  target_inventory_fingerprint varchar(64) NOT NULL,
  page_size integer NOT NULL,
  expected_page_count integer,
  expected_target_count bigint,
  staged_page_count integer NOT NULL DEFAULT 0,
  staged_target_count bigint NOT NULL DEFAULT 0,
  result_fingerprint varchar(64),
  failure_code varchar(120),
  failure_detail varchar(500),
  requested_by varchar(100) NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp with time zone,
  CONSTRAINT ck_screen_workflow_audit_batch_type
    CHECK (audit_type IN ('HOURLY_ALL_PROCESS')),
  CONSTRAINT ck_screen_workflow_audit_batch_status
    CHECK (batch_status IN ('RUNNING','COMPLETE','FAILED')),
  CONSTRAINT ck_screen_workflow_audit_batch_source_commit
    CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  CONSTRAINT ck_screen_workflow_audit_batch_runtime_hash
    CHECK (runtime_identity_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_screen_workflow_audit_batch_catalog_hash
    CHECK (catalog_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_screen_workflow_audit_batch_target_inventory_hash
    CHECK (target_inventory_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_screen_workflow_audit_batch_result_hash
    CHECK (result_fingerprint IS NULL OR result_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_screen_workflow_audit_batch_page_size
    CHECK (page_size BETWEEN 1 AND 500),
  CONSTRAINT ck_screen_workflow_audit_batch_expected_counts
    CHECK ((expected_page_count IS NULL AND expected_target_count IS NULL)
        OR (expected_page_count > 0 AND expected_target_count > 0)),
  CONSTRAINT ck_screen_workflow_audit_batch_staged_counts
    CHECK (staged_page_count >= 0 AND staged_target_count >= 0),
  CONSTRAINT ck_screen_workflow_audit_batch_terminal
    CHECK ((batch_status = 'RUNNING' AND completed_at IS NULL AND result_fingerprint IS NULL)
        OR (batch_status = 'COMPLETE' AND completed_at IS NOT NULL AND result_fingerprint IS NOT NULL
            AND expected_page_count IS NOT NULL AND expected_target_count IS NOT NULL
            AND staged_page_count = expected_page_count
            AND staged_target_count = expected_target_count
            AND failure_code IS NULL AND failure_detail IS NULL)
        OR (batch_status = 'FAILED' AND completed_at IS NOT NULL AND failure_code IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS framework_screen_workflow_audit_batch_page (
  audit_batch_id uuid NOT NULL REFERENCES framework_screen_workflow_audit_batch(audit_batch_id) ON DELETE RESTRICT,
  page_number integer NOT NULL,
  target_offset integer NOT NULL,
  target_count integer NOT NULL,
  total_eligible_target_count bigint NOT NULL,
  passed_count integer NOT NULL,
  blocked_count integer NOT NULL,
  error_count integer NOT NULL,
  has_more boolean NOT NULL,
  page_fingerprint varchar(64) NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_batch_id,page_number),
  CONSTRAINT uq_screen_workflow_audit_batch_page_offset UNIQUE (audit_batch_id,target_offset),
  CONSTRAINT ck_screen_workflow_audit_batch_page_number CHECK (page_number >= 0),
  CONSTRAINT ck_screen_workflow_audit_batch_page_offset CHECK (target_offset >= 0),
  CONSTRAINT ck_screen_workflow_audit_batch_page_counts
    CHECK (target_count > 0 AND total_eligible_target_count > 0
       AND passed_count >= 0 AND blocked_count >= 0 AND error_count >= 0
       AND passed_count + blocked_count + error_count = target_count),
  CONSTRAINT ck_screen_workflow_audit_batch_page_hash
    CHECK (page_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS framework_screen_workflow_audit_batch_target (
  audit_batch_id uuid NOT NULL REFERENCES framework_screen_workflow_audit_batch(audit_batch_id) ON DELETE RESTRICT,
  target_ordinal bigint NOT NULL,
  target_key varchar(64) NOT NULL,
  screen_resource_id bigint,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  binding_id bigint,
  audience varchar(40),
  route_key varchar(500),
  capability_code varchar(160) NOT NULL,
  PRIMARY KEY (audit_batch_id,target_ordinal),
  CONSTRAINT uq_screen_workflow_audit_batch_target_key UNIQUE(audit_batch_id,target_key),
  CONSTRAINT ck_screen_workflow_audit_batch_target_ordinal CHECK(target_ordinal>=0),
  CONSTRAINT ck_screen_workflow_audit_batch_target_key CHECK(target_key ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS framework_screen_workflow_audit_incident (
  incident_id varchar(120) PRIMARY KEY,
  incident_status varchar(24) NOT NULL DEFAULT 'FAILED_UNBOUND',
  audit_type varchar(40) NOT NULL,
  first_run_id bigint NOT NULL,
  last_run_id bigint NOT NULL,
  run_count bigint NOT NULL,
  first_executed_at timestamp NOT NULL,
  last_executed_at timestamp NOT NULL,
  source_commit varchar(40),
  runtime_identity_hash varchar(64),
  failure_code varchar(120) NOT NULL,
  failure_detail varchar(500) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT current_timestamp,
  CONSTRAINT ck_screen_workflow_audit_incident_status CHECK (incident_status='FAILED_UNBOUND'),
  CONSTRAINT ck_screen_workflow_audit_incident_range
    CHECK (first_run_id>0 AND last_run_id>=first_run_id AND run_count=last_run_id-first_run_id+1),
  CONSTRAINT ck_screen_workflow_audit_incident_commit
    CHECK (source_commit IS NULL OR source_commit ~ '^[0-9a-f]{40}$'),
  CONSTRAINT ck_screen_workflow_audit_incident_runtime
    CHECK (runtime_identity_hash IS NULL OR runtime_identity_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS framework_screen_workflow_audit_incident_run (
  incident_id varchar(120) NOT NULL REFERENCES framework_screen_workflow_audit_incident(incident_id) ON DELETE RESTRICT,
  run_id bigint NOT NULL REFERENCES framework_screen_workflow_test_run(run_id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY (incident_id,run_id),
  CONSTRAINT uq_screen_workflow_audit_incident_run UNIQUE (run_id)
);

ALTER TABLE framework_screen_workflow_test_run
  ADD COLUMN IF NOT EXISTS audit_batch_id uuid,
  ADD COLUMN IF NOT EXISTS audit_source_commit varchar(40),
  ADD COLUMN IF NOT EXISTS audit_runtime_identity_hash varchar(64),
  ADD COLUMN IF NOT EXISTS audit_page_number integer,
  ADD COLUMN IF NOT EXISTS audit_target_ordinal bigint,
  ADD COLUMN IF NOT EXISTS audit_target_key varchar(64);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='fk_screen_workflow_test_run_audit_batch'
       AND conrelid='framework_screen_workflow_test_run'::regclass
  ) THEN
    ALTER TABLE framework_screen_workflow_test_run
      ADD CONSTRAINT fk_screen_workflow_test_run_audit_batch
      FOREIGN KEY (audit_batch_id)
      REFERENCES framework_screen_workflow_audit_batch(audit_batch_id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='ck_screen_workflow_test_run_audit_scope'
       AND conrelid='framework_screen_workflow_test_run'::regclass
  ) THEN
    ALTER TABLE framework_screen_workflow_test_run
      ADD CONSTRAINT ck_screen_workflow_test_run_audit_scope CHECK (
        (audit_batch_id IS NULL
          AND audit_source_commit IS NULL
          AND audit_runtime_identity_hash IS NULL
          AND audit_page_number IS NULL
          AND audit_target_ordinal IS NULL
          AND audit_target_key IS NULL)
        OR
        (audit_batch_id IS NOT NULL
          AND audit_source_commit ~ '^[0-9a-f]{40}$'
          AND audit_runtime_identity_hash ~ '^[0-9a-f]{64}$'
          AND audit_page_number >= 0
          AND audit_target_ordinal >= 0
          AND audit_target_key ~ '^[0-9a-f]{64}$')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='ck_screen_workflow_test_run_audit_evidence'
       AND conrelid='framework_screen_workflow_test_run'::regclass
  ) THEN
    ALTER TABLE framework_screen_workflow_test_run
      ADD CONSTRAINT ck_screen_workflow_test_run_audit_evidence CHECK (
        audit_batch_id IS NULL OR (
          coalesce(evidence_json->>'audience','')<>''
          AND coalesce(evidence_json->>'contractFingerprint','') ~ '^[0-9a-f]{32,64}$'
          AND evidence_json->>'screenResourceId'=screen_resource_id::text
          AND evidence_json->>'processCode'=process_code
          AND evidence_json->>'stepCode'=step_code
          AND evidence_json->>'capabilityCode'=capability_code
        )
      );
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_screen_workflow_test_run_batch_ordinal
  ON framework_screen_workflow_test_run(audit_batch_id,audit_target_ordinal)
  WHERE audit_batch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_screen_workflow_test_run_batch_target
  ON framework_screen_workflow_test_run(audit_batch_id,audit_target_key)
  WHERE audit_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_screen_workflow_audit_batch_status_started
  ON framework_screen_workflow_audit_batch(batch_status,started_at DESC,audit_batch_id);

CREATE OR REPLACE FUNCTION framework_screen_workflow_catalog_fingerprint()
RETURNS varchar(64)
LANGUAGE sql
STABLE
AS $function$
  SELECT encode(sha256(convert_to(concat_ws('|',
    'process_definition:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                               FROM framework_process_definition row_value),
    'process_step:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                         FROM framework_process_step row_value),
    'step_screen_binding:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                                FROM framework_process_step_screen_binding row_value),
    'screen_resource:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                            FROM framework_screen_resource row_value),
    'screen_capability:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                              FROM framework_screen_capability row_value),
    'screen_data_binding:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                                FROM framework_screen_data_binding row_value),
    'step_test_binding:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                              FROM framework_step_test_binding row_value),
    'simulation_case:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                            FROM framework_simulation_case row_value),
    'step_execution_spec:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                                FROM framework_step_execution_spec row_value),
    'professional_screen_contract:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                                          FROM framework_professional_screen_contract row_value),
    'screen_workflow_test_case:' || (SELECT md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' ORDER BY md5(to_jsonb(row_value)::text)),''))
                                      FROM framework_screen_workflow_test_case row_value)
  ),'UTF8')),'hex')::varchar(64);
$function$;

CREATE OR REPLACE FUNCTION framework_screen_workflow_canonical_audit_targets()
RETURNS TABLE(
  target_ordinal bigint,target_key varchar(64),screen_resource_id bigint,process_code text,
  step_code text,binding_id bigint,audience text,route_key text,capability_code text
)
LANGUAGE sql
STABLE
AS $function$
  WITH eligible AS MATERIALIZED (
    SELECT process.development_order,step.step_order,step.process_code,step.step_code,
           binding.binding_id,binding.audience,binding.entry_mode,screen.screen_resource_id,
           screen.route_key,coalesce(capability.capability_code,'ALL') capability_code
      FROM framework_process_step step
      JOIN framework_process_definition process ON process.process_code=step.process_code
      LEFT JOIN framework_process_step_screen_binding binding
        ON binding.process_code=step.process_code AND binding.step_code=step.step_code
       AND binding.binding_status='ACTIVE'
      LEFT JOIN framework_screen_resource screen USING(screen_resource_id)
      LEFT JOIN framework_screen_capability capability USING(screen_resource_id)
  ), ordered AS (
    SELECT eligible.*,row_number() over(order by development_order,process_code,step_order,step_code,
             case entry_mode when 'PRIMARY' then 0 else 1 end,
             case audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end,
             route_key,binding_id,capability_code)::bigint-1 ordinal
      FROM eligible
  )
  SELECT ordinal,
         encode(sha256(convert_to(concat_ws(E'\x1f',coalesce(screen_resource_id::text,'#'),
           process_code,step_code,coalesce(binding_id::text,'#'),coalesce(audience,'#'),
           coalesce(route_key,'#'),capability_code),'UTF8')),'hex')::varchar(64),
         screen_resource_id::bigint,process_code::text,step_code::text,binding_id::bigint,audience::text,
         route_key::text,capability_code::text
    FROM ordered ORDER BY ordinal;
$function$;

CREATE OR REPLACE FUNCTION framework_screen_workflow_target_inventory()
RETURNS TABLE(target_count bigint,target_inventory_fingerprint varchar(64))
LANGUAGE sql
STABLE
AS $function$
  SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(
           target_ordinal||':'||target_key,E'\n' ORDER BY target_ordinal),''),'UTF8')),'hex')::varchar(64)
    FROM framework_screen_workflow_canonical_audit_targets();
$function$;

CREATE OR REPLACE FUNCTION framework_screen_workflow_current_runtime_identity()
RETURNS TABLE(source_commit varchar(40),runtime_identity jsonb,runtime_identity_hash varchar(64))
LANGUAGE sql
STABLE
AS $function$
  SELECT runtime.source_commit,
         jsonb_build_object(
           'sourceCommit',runtime.source_commit,
           'deploymentNamespace',runtime.deployment_namespace,
           'deploymentName',runtime.deployment_name,
           'deploymentUid',runtime.deployment_uid,
           'deploymentGeneration',runtime.deployment_generation,
           'observedGeneration',runtime.observed_generation,
           'desiredReplicas',runtime.desired_replicas,
           'imageRef',runtime.image_ref,
           'imageId',runtime.image_id,
           'healthStatus',runtime.health_status
         ),
         encode(sha256(convert_to(concat_ws('|',
           runtime.source_commit,runtime.deployment_namespace,runtime.deployment_name,
           runtime.deployment_uid,runtime.deployment_generation,runtime.observed_generation,
           runtime.desired_replicas,runtime.image_ref,runtime.image_id,runtime.health_status
         ),'UTF8')),'hex')::varchar(64)
    FROM framework_runtime_release_state runtime
   WHERE runtime.release_key='CARBONET_RUNTIME' AND runtime.health_status='UP';
$function$;

CREATE OR REPLACE FUNCTION framework_screen_workflow_page_fingerprint(
  p_audit_batch_id uuid,
  p_page_number integer
) RETURNS varchar(64)
LANGUAGE sql
STABLE
AS $function$
  SELECT encode(sha256(convert_to(coalesce(string_agg(concat_ws('|',
           run.audit_target_ordinal,run.audit_target_key,run.run_id,run.screen_resource_id,run.process_code,
           run.step_code,run.capability_code,run.evidence_json->>'audience',
           run.evidence_json->>'contractFingerprint',run.route_key,run.result,
           run.passed_check_count,run.total_check_count,array_to_string(run.blocker_codes,',')
         ),E'\n' ORDER BY run.audit_target_ordinal),''),'UTF8')),'hex')::varchar(64)
    FROM framework_screen_workflow_test_run run
   WHERE run.audit_batch_id=p_audit_batch_id AND run.audit_page_number=p_page_number;
$function$;

CREATE OR REPLACE FUNCTION framework_validate_screen_workflow_audit_batch_complete(
  p_audit_batch_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  batch framework_screen_workflow_audit_batch%ROWTYPE;
  current_runtime record;
  catalog_now varchar(64);
  observed_page_count bigint;
  observed_target_count bigint;
  total_min bigint;
  total_max bigint;
  expected_pages integer;
  observed_run_count bigint;
  distinct_ordinal_count bigint;
  distinct_target_count bigint;
  minimum_ordinal bigint;
  maximum_ordinal bigint;
  result_hash varchar(64);
  inventory_now record;
  staged_inventory_hash varchar(64);
BEGIN
  SELECT * INTO batch FROM framework_screen_workflow_audit_batch
   WHERE audit_batch_id=p_audit_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_BATCH_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF batch.batch_status<>'RUNNING' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_BATCH_NOT_RUNNING: %',batch.batch_status USING ERRCODE='55000';
  END IF;

  SELECT * INTO current_runtime FROM framework_screen_workflow_current_runtime_identity();
  IF NOT FOUND OR current_runtime.source_commit<>batch.source_commit
     OR current_runtime.runtime_identity_hash<>batch.runtime_identity_hash
     OR current_runtime.runtime_identity<>batch.runtime_identity THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_RUNTIME_IDENTITY_DRIFT' USING ERRCODE='55000';
  END IF;
  catalog_now:=framework_screen_workflow_catalog_fingerprint();
  IF catalog_now<>batch.catalog_fingerprint THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_CATALOG_DRIFT' USING ERRCODE='55000';
  END IF;
  SELECT * INTO inventory_now FROM framework_screen_workflow_target_inventory();
  IF inventory_now.target_count<>batch.expected_target_count
     OR inventory_now.target_inventory_fingerprint<>batch.target_inventory_fingerprint THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_TARGET_INVENTORY_DRIFT' USING ERRCODE='55000';
  END IF;

  SELECT count(*),coalesce(sum(target_count),0),min(total_eligible_target_count),max(total_eligible_target_count)
    INTO observed_page_count,observed_target_count,total_min,total_max
    FROM framework_screen_workflow_audit_batch_page
   WHERE audit_batch_id=p_audit_batch_id;
  IF observed_page_count=0 OR total_min IS NULL OR total_min<>total_max OR total_min<=0
     OR total_min<>batch.expected_target_count THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_TOTAL_MISSING_OR_DRIFTED' USING ERRCODE='23514';
  END IF;
  expected_pages:=batch.expected_page_count;
  IF expected_pages<>((total_min+batch.page_size-1)/batch.page_size)::integer THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_EXPECTED_PAGE_COUNT_DRIFT' USING ERRCODE='23514';
  END IF;
  IF observed_page_count<>expected_pages OR observed_target_count<>total_min THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_COVERAGE_MISMATCH expected_pages=% pages=% expected_targets=% targets=%',
      expected_pages,observed_page_count,total_min,observed_target_count USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM framework_screen_workflow_audit_batch_page page
     WHERE page.audit_batch_id=p_audit_batch_id AND (
       page.page_number>=expected_pages
       OR page.target_offset<>page.page_number*batch.page_size
       OR page.target_count<>least(batch.page_size,(total_min-page.target_offset)::integer)
       OR page.error_count<>0
       OR page.has_more<>(page.page_number<expected_pages-1)
       OR page.page_fingerprint<>framework_screen_workflow_page_fingerprint(p_audit_batch_id,page.page_number)
     )
  ) OR EXISTS (
    SELECT 1 FROM generate_series(0,expected_pages-1) page_number
     WHERE NOT EXISTS (
       SELECT 1 FROM framework_screen_workflow_audit_batch_page page
        WHERE page.audit_batch_id=p_audit_batch_id AND page.page_number=page_number
     )
  ) THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_SEQUENCE_OR_FINGERPRINT_MISMATCH' USING ERRCODE='23514';
  END IF;
  SELECT encode(sha256(convert_to(coalesce(string_agg(
           run.audit_target_ordinal||':'||run.audit_target_key,E'\n' ORDER BY run.audit_target_ordinal),''),'UTF8')),'hex')
    INTO staged_inventory_hash
    FROM framework_screen_workflow_test_run run WHERE run.audit_batch_id=p_audit_batch_id;
  IF staged_inventory_hash<>batch.target_inventory_fingerprint THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_STAGED_TARGET_SET_MISMATCH' USING ERRCODE='23514';
  END IF;

  SELECT count(*),count(DISTINCT audit_target_ordinal),
         count(DISTINCT (screen_resource_id,process_code,step_code,capability_code,
                         evidence_json->>'audience',evidence_json->>'contractFingerprint')),
         min(audit_target_ordinal),max(audit_target_ordinal)
    INTO observed_run_count,distinct_ordinal_count,distinct_target_count,minimum_ordinal,maximum_ordinal
    FROM framework_screen_workflow_test_run
   WHERE audit_batch_id=p_audit_batch_id;
  IF observed_run_count<>total_min OR distinct_ordinal_count<>total_min
     OR distinct_target_count<>total_min OR minimum_ordinal<>0 OR maximum_ordinal<>total_min-1 THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_RUN_COVERAGE_MISMATCH expected=% runs=% ordinals=% targets=% range=%..%',
      total_min,observed_run_count,distinct_ordinal_count,distinct_target_count,minimum_ordinal,maximum_ordinal
      USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM framework_screen_workflow_test_run run
     WHERE run.audit_batch_id=p_audit_batch_id AND (
       run.audit_source_commit<>batch.source_commit
       OR run.audit_runtime_identity_hash<>batch.runtime_identity_hash
       OR run.audit_page_number<>(run.audit_target_ordinal/batch.page_size)::integer
       OR run.executed_by<>batch.requested_by
       OR coalesce(run.evidence_json->>'audience','')=''
       OR coalesce(run.evidence_json->>'contractFingerprint','') !~ '^[0-9a-f]{32,64}$'
     )
  ) THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_RUN_PROVENANCE_MISMATCH' USING ERRCODE='23514';
  END IF;

  SELECT encode(sha256(convert_to(string_agg(page.page_number||':'||page.page_fingerprint,E'\n'
           ORDER BY page.page_number),'UTF8')),'hex')
    INTO result_hash
    FROM framework_screen_workflow_audit_batch_page page
   WHERE page.audit_batch_id=p_audit_batch_id;
  RETURN jsonb_build_object(
    'auditBatchId',batch.audit_batch_id,'status','COMPLETE',
    'sourceCommit',batch.source_commit,'runtimeIdentityHash',batch.runtime_identity_hash,
    'catalogFingerprint',batch.catalog_fingerprint,'pageCount',expected_pages,
    'targetCount',total_min,'targetInventoryFingerprint',batch.target_inventory_fingerprint,
    'resultFingerprint',result_hash
  );
END
$function$;

CREATE OR REPLACE FUNCTION framework_validate_screen_workflow_audit_batch_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE current_runtime record; catalog_now varchar(64); inventory_now record; expected_pages integer; runtime_found boolean;
BEGIN
  IF NEW.batch_status<>'RUNNING' OR NEW.completed_at IS NOT NULL OR NEW.result_fingerprint IS NOT NULL
     OR NEW.failure_code IS NOT NULL OR NEW.failure_detail IS NOT NULL
     OR NEW.staged_page_count<>0 OR NEW.staged_target_count<>0 OR trim(NEW.requested_by)='' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_BATCH_INSERT_MUST_BE_FRESH_RUNNING' USING ERRCODE='23514';
  END IF;
  SELECT * INTO current_runtime FROM framework_screen_workflow_current_runtime_identity();
  runtime_found:=FOUND;
  catalog_now:=framework_screen_workflow_catalog_fingerprint();
  SELECT * INTO inventory_now FROM framework_screen_workflow_target_inventory();
  expected_pages:=((inventory_now.target_count+NEW.page_size-1)/NEW.page_size)::integer;
  IF NOT runtime_found OR NEW.source_commit<>current_runtime.source_commit
     OR NEW.runtime_identity<>current_runtime.runtime_identity
     OR NEW.runtime_identity_hash<>current_runtime.runtime_identity_hash
     OR NEW.catalog_fingerprint<>catalog_now
     OR NEW.expected_target_count<>inventory_now.target_count
     OR NEW.expected_page_count<>expected_pages
     OR NEW.target_inventory_fingerprint<>inventory_now.target_inventory_fingerprint THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_BATCH_IDENTITY_IS_NOT_CURRENT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION framework_guard_screen_workflow_audit_batch_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE receipt jsonb;
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_BATCH_IS_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF OLD.batch_status<>'RUNNING' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_TERMINAL_STATE_IS_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF NEW.batch_status NOT IN ('COMPLETE','FAILED') THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_ONLY_TERMINAL_TRANSITION_ALLOWED' USING ERRCODE='55000';
  END IF;
  IF NEW.audit_batch_id<>OLD.audit_batch_id OR NEW.audit_type<>OLD.audit_type
     OR NEW.source_commit<>OLD.source_commit OR NEW.runtime_identity<>OLD.runtime_identity
     OR NEW.runtime_identity_hash<>OLD.runtime_identity_hash OR NEW.catalog_fingerprint<>OLD.catalog_fingerprint
     OR NEW.target_inventory_fingerprint<>OLD.target_inventory_fingerprint
     OR NEW.expected_page_count<>OLD.expected_page_count OR NEW.expected_target_count<>OLD.expected_target_count
     OR NEW.page_size<>OLD.page_size OR NEW.requested_by<>OLD.requested_by OR NEW.started_at<>OLD.started_at THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_BATCH_IDENTITY_IS_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF NEW.batch_status='COMPLETE' THEN
    receipt:=framework_validate_screen_workflow_audit_batch_complete(OLD.audit_batch_id);
    IF NEW.expected_page_count<>(receipt->>'pageCount')::integer
       OR NEW.expected_target_count<>(receipt->>'targetCount')::bigint
       OR NEW.staged_page_count<>(receipt->>'pageCount')::integer
       OR NEW.staged_target_count<>(receipt->>'targetCount')::bigint
       OR NEW.result_fingerprint<>receipt->>'resultFingerprint'
       OR NEW.completed_at IS NULL OR NEW.failure_code IS NOT NULL OR NEW.failure_detail IS NOT NULL THEN
      RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_COMPLETE_RECEIPT_MISMATCH' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.completed_at IS NULL OR coalesce(trim(NEW.failure_code),'')='' OR NEW.result_fingerprint IS NOT NULL THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_FAILED_RECEIPT_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION framework_guard_screen_workflow_audit_page_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE batch framework_screen_workflow_audit_batch%ROWTYPE; expected_pages integer;
BEGIN
  SELECT * INTO batch FROM framework_screen_workflow_audit_batch
   WHERE audit_batch_id=NEW.audit_batch_id FOR SHARE;
  IF NOT FOUND OR batch.batch_status<>'RUNNING' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_REQUIRES_RUNNING_BATCH' USING ERRCODE='55000';
  END IF;
  expected_pages:=((NEW.total_eligible_target_count+batch.page_size-1)/batch.page_size)::integer;
  IF NEW.total_eligible_target_count<>batch.expected_target_count OR expected_pages<>batch.expected_page_count
     OR NEW.page_number>=expected_pages OR NEW.target_offset<>NEW.page_number*batch.page_size
     OR NEW.target_count<>least(batch.page_size,(NEW.total_eligible_target_count-NEW.target_offset)::integer)
     OR NEW.error_count<>0 OR NEW.has_more<>(NEW.page_number<expected_pages-1)
     OR NEW.page_fingerprint<>framework_screen_workflow_page_fingerprint(NEW.audit_batch_id,NEW.page_number) THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_CONTRACT_MISMATCH' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION framework_guard_screen_workflow_audit_run_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE batch framework_screen_workflow_audit_batch%ROWTYPE; canonical_target record;
BEGIN
  IF TG_OP<>'INSERT' THEN
    IF OLD.audit_batch_id IS NOT NULL
       OR EXISTS (
         SELECT 1 FROM framework_screen_workflow_audit_incident_run incident_run
          WHERE incident_run.run_id=OLD.run_id
       )
       OR (TG_OP='UPDATE' AND NEW.audit_batch_id IS NOT NULL) THEN
      RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_RUN_IS_IMMUTABLE' USING ERRCODE='55000';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF NEW.audit_batch_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO batch FROM framework_screen_workflow_audit_batch
   WHERE audit_batch_id=NEW.audit_batch_id FOR SHARE;
  IF NOT FOUND OR batch.batch_status<>'RUNNING' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_RUN_REQUIRES_RUNNING_BATCH' USING ERRCODE='55000';
  END IF;
  SELECT * INTO canonical_target FROM framework_screen_workflow_audit_batch_target
   WHERE audit_batch_id=NEW.audit_batch_id AND target_ordinal=NEW.audit_target_ordinal;
  IF NOT FOUND OR NEW.audit_target_key IS DISTINCT FROM canonical_target.target_key
     OR NEW.screen_resource_id IS DISTINCT FROM canonical_target.screen_resource_id
     OR NEW.process_code IS DISTINCT FROM canonical_target.process_code
     OR NEW.step_code IS DISTINCT FROM canonical_target.step_code
     OR NEW.capability_code IS DISTINCT FROM canonical_target.capability_code
     OR NEW.route_key IS DISTINCT FROM canonical_target.route_key
     OR nullif(NEW.evidence_json->>'audience','') IS DISTINCT FROM canonical_target.audience THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_RUN_CANONICAL_TARGET_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF NEW.audit_source_commit<>batch.source_commit
     OR NEW.audit_runtime_identity_hash<>batch.runtime_identity_hash
     OR NEW.audit_page_number<>(NEW.audit_target_ordinal/batch.page_size)::integer
     OR NEW.executed_by<>batch.requested_by
     OR coalesce(NEW.evidence_json->>'audience','')=''
     OR coalesce(NEW.evidence_json->>'contractFingerprint','') !~ '^[0-9a-f]{32,64}$' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_RUN_PROVENANCE_MISMATCH' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION framework_reject_screen_workflow_audit_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_LEDGER_IS_IMMUTABLE' USING ERRCODE='55000';
END
$function$;

CREATE OR REPLACE FUNCTION framework_validate_screen_workflow_audit_incident_insert()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.incident_id<>'UNBOUND-HOURLY-20260811-700681-702430'
     OR NEW.incident_status<>'FAILED_UNBOUND'
     OR NEW.audit_type<>'HOURLY_ALL_PROCESS'
     OR NEW.first_run_id<>700681 OR NEW.last_run_id<>702430 OR NEW.run_count<>1750
     OR NEW.first_executed_at<>timestamp '2026-08-11 16:03:46.100822'
     OR NEW.last_executed_at<>timestamp '2026-08-11 16:04:31.292558'
     OR NEW.source_commit IS NOT NULL OR NEW.runtime_identity_hash IS NOT NULL
     OR NEW.failure_code<>'AUTH_SESSION_EXPIRED_PAGE_8'
     OR NEW.failure_detail<>'Legacy hourly attempt committed 7 pages of 250 before HTTP 401; provenance was not recorded, so source commit and runtime identity remain intentionally unknown.' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_INCIDENT_INSERT_NOT_ALLOWLISTED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION framework_validate_screen_workflow_audit_incident_run_insert()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.incident_id<>'UNBOUND-HOURLY-20260811-700681-702430'
     OR NEW.run_id NOT BETWEEN 700681 AND 702430 THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_INCIDENT_RUN_INSERT_NOT_ALLOWLISTED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_screen_workflow_audit_batch_validate_insert ON framework_screen_workflow_audit_batch;
CREATE TRIGGER trg_screen_workflow_audit_batch_validate_insert
  BEFORE INSERT ON framework_screen_workflow_audit_batch
  FOR EACH ROW EXECUTE FUNCTION framework_validate_screen_workflow_audit_batch_insert();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_batch_guard_mutation ON framework_screen_workflow_audit_batch;
CREATE TRIGGER trg_screen_workflow_audit_batch_guard_mutation
  BEFORE UPDATE OR DELETE ON framework_screen_workflow_audit_batch
  FOR EACH ROW EXECUTE FUNCTION framework_guard_screen_workflow_audit_batch_mutation();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_page_validate_insert ON framework_screen_workflow_audit_batch_page;
CREATE TRIGGER trg_screen_workflow_audit_page_validate_insert
  BEFORE INSERT ON framework_screen_workflow_audit_batch_page
  FOR EACH ROW EXECUTE FUNCTION framework_guard_screen_workflow_audit_page_insert();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_page_immutable ON framework_screen_workflow_audit_batch_page;
CREATE TRIGGER trg_screen_workflow_audit_page_immutable
  BEFORE UPDATE OR DELETE ON framework_screen_workflow_audit_batch_page
  FOR EACH ROW EXECUTE FUNCTION framework_reject_screen_workflow_audit_immutable_mutation();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_batch_target_immutable ON framework_screen_workflow_audit_batch_target;
CREATE TRIGGER trg_screen_workflow_audit_batch_target_immutable
  BEFORE UPDATE OR DELETE ON framework_screen_workflow_audit_batch_target
  FOR EACH ROW EXECUTE FUNCTION framework_reject_screen_workflow_audit_immutable_mutation();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_run_guard ON framework_screen_workflow_test_run;
CREATE TRIGGER trg_screen_workflow_audit_run_guard
  BEFORE INSERT OR UPDATE OR DELETE ON framework_screen_workflow_test_run
  FOR EACH ROW EXECUTE FUNCTION framework_guard_screen_workflow_audit_run_mutation();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_incident_immutable ON framework_screen_workflow_audit_incident;
CREATE TRIGGER trg_screen_workflow_audit_incident_immutable
  BEFORE UPDATE OR DELETE ON framework_screen_workflow_audit_incident
  FOR EACH ROW EXECUTE FUNCTION framework_reject_screen_workflow_audit_immutable_mutation();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_incident_validate_insert ON framework_screen_workflow_audit_incident;
CREATE TRIGGER trg_screen_workflow_audit_incident_validate_insert
  BEFORE INSERT ON framework_screen_workflow_audit_incident
  FOR EACH ROW EXECUTE FUNCTION framework_validate_screen_workflow_audit_incident_insert();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_incident_run_immutable ON framework_screen_workflow_audit_incident_run;
CREATE TRIGGER trg_screen_workflow_audit_incident_run_immutable
  BEFORE UPDATE OR DELETE ON framework_screen_workflow_audit_incident_run
  FOR EACH ROW EXECUTE FUNCTION framework_reject_screen_workflow_audit_immutable_mutation();
DROP TRIGGER IF EXISTS trg_screen_workflow_audit_incident_run_validate_insert ON framework_screen_workflow_audit_incident_run;
CREATE TRIGGER trg_screen_workflow_audit_incident_run_validate_insert
  BEFORE INSERT ON framework_screen_workflow_audit_incident_run
  FOR EACH ROW EXECUTE FUNCTION framework_validate_screen_workflow_audit_incident_run_insert();

CREATE OR REPLACE FUNCTION framework_start_screen_workflow_audit_batch(
  p_requested_by varchar,
  p_page_size integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE new_batch_id uuid:=gen_random_uuid(); current_runtime record; catalog_hash varchar(64);
        inventory record; expected_pages integer; snapshot_count bigint; snapshot_hash varchar(64);
BEGIN
  IF coalesce(trim(p_requested_by),'')='' OR p_page_size NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_START_ARGUMENT_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO current_runtime FROM framework_screen_workflow_current_runtime_identity();
  IF NOT FOUND THEN RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_HEALTHY_RUNTIME_REQUIRED' USING ERRCODE='55000'; END IF;
  catalog_hash:=framework_screen_workflow_catalog_fingerprint();
  SELECT * INTO inventory FROM framework_screen_workflow_target_inventory();
  IF inventory.target_count<=0 THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_TARGET_INVENTORY_EMPTY' USING ERRCODE='55000';
  END IF;
  expected_pages:=((inventory.target_count+p_page_size-1)/p_page_size)::integer;
  INSERT INTO framework_screen_workflow_audit_batch(
    audit_batch_id,source_commit,runtime_identity,runtime_identity_hash,catalog_fingerprint,
    target_inventory_fingerprint,page_size,expected_page_count,expected_target_count,requested_by
  ) VALUES (
    new_batch_id,current_runtime.source_commit,current_runtime.runtime_identity,current_runtime.runtime_identity_hash,
    catalog_hash,inventory.target_inventory_fingerprint,p_page_size,expected_pages,inventory.target_count,trim(p_requested_by)
  );
  INSERT INTO framework_screen_workflow_audit_batch_target(
    audit_batch_id,target_ordinal,target_key,screen_resource_id,process_code,step_code,
    binding_id,audience,route_key,capability_code
  )
  SELECT new_batch_id,target_ordinal,target_key,screen_resource_id,process_code,step_code,
         binding_id,audience,route_key,capability_code
    FROM framework_screen_workflow_canonical_audit_targets();
  SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(
           target_ordinal||':'||target_key,E'\n' ORDER BY target_ordinal),''),'UTF8')),'hex')
    INTO snapshot_count,snapshot_hash
    FROM framework_screen_workflow_audit_batch_target WHERE audit_batch_id=new_batch_id;
  IF snapshot_count<>inventory.target_count OR snapshot_hash<>inventory.target_inventory_fingerprint THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_TARGET_SNAPSHOT_DRIFT' USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object(
    'auditBatchId',new_batch_id,'status','RUNNING','sourceCommit',current_runtime.source_commit,
    'runtimeIdentity',current_runtime.runtime_identity,'runtimeIdentityHash',current_runtime.runtime_identity_hash,
    'catalogFingerprint',catalog_hash,'targetInventoryFingerprint',inventory.target_inventory_fingerprint,
    'pageSize',p_page_size,'expectedPageCount',expected_pages,'expectedTargetCount',inventory.target_count
  );
END
$function$;

CREATE OR REPLACE FUNCTION framework_record_screen_workflow_audit_page(
  p_audit_batch_id uuid,p_requested_by varchar,p_page_number integer,p_target_offset integer,
  p_total_eligible_target_count bigint,p_passed_count integer,p_blocked_count integer,
  p_error_count integer,p_has_more boolean
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE batch framework_screen_workflow_audit_batch%ROWTYPE; target_count integer; observed_count integer;
        observed_passed integer; observed_blocked integer; page_hash varchar(64);
BEGIN
  SELECT * INTO batch FROM framework_screen_workflow_audit_batch
   WHERE audit_batch_id=p_audit_batch_id FOR UPDATE;
  IF NOT FOUND OR batch.batch_status<>'RUNNING' OR batch.requested_by<>p_requested_by THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_BATCH_OR_ACTOR_MISMATCH' USING ERRCODE='55000';
  END IF;
  target_count:=p_passed_count+p_blocked_count+p_error_count;
  IF p_error_count<>0 THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_HAS_ERRORS' USING ERRCODE='23514';
  END IF;
  SELECT count(*),count(*) filter(where result='PASSED'),count(*) filter(where result='BLOCKED')
    INTO observed_count,observed_passed,observed_blocked
    FROM framework_screen_workflow_test_run
   WHERE audit_batch_id=p_audit_batch_id AND audit_page_number=p_page_number
     AND audit_target_ordinal>=p_target_offset AND audit_target_ordinal<p_target_offset+target_count;
  IF observed_count<>target_count OR observed_passed<>p_passed_count OR observed_blocked<>p_blocked_count THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_PAGE_RUN_COUNT_MISMATCH' USING ERRCODE='23514';
  END IF;
  page_hash:=framework_screen_workflow_page_fingerprint(p_audit_batch_id,p_page_number);
  INSERT INTO framework_screen_workflow_audit_batch_page(
    audit_batch_id,page_number,target_offset,target_count,total_eligible_target_count,
    passed_count,blocked_count,error_count,has_more,page_fingerprint
  ) VALUES (
    p_audit_batch_id,p_page_number,p_target_offset,target_count,p_total_eligible_target_count,
    p_passed_count,p_blocked_count,p_error_count,p_has_more,page_hash
  );
  RETURN jsonb_build_object(
    'auditBatchId',p_audit_batch_id,'status','RUNNING','pageNumber',p_page_number,
    'targetOffset',p_target_offset,'targetCount',target_count,
    'totalEligibleTargetCount',p_total_eligible_target_count,'pageFingerprint',page_hash
  );
END
$function$;

CREATE OR REPLACE FUNCTION framework_complete_screen_workflow_audit_batch(
  p_audit_batch_id uuid,
  p_requested_by varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE batch framework_screen_workflow_audit_batch%ROWTYPE; receipt jsonb;
BEGIN
  SELECT * INTO batch FROM framework_screen_workflow_audit_batch
   WHERE audit_batch_id=p_audit_batch_id FOR UPDATE;
  IF NOT FOUND OR batch.requested_by<>p_requested_by THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_COMPLETE_BATCH_OR_ACTOR_MISMATCH' USING ERRCODE='55000';
  END IF;
  IF batch.batch_status='COMPLETE' THEN
    RETURN jsonb_build_object(
      'auditBatchId',batch.audit_batch_id,'status','COMPLETE','sourceCommit',batch.source_commit,
      'runtimeIdentityHash',batch.runtime_identity_hash,'catalogFingerprint',batch.catalog_fingerprint,
      'pageCount',batch.staged_page_count,'targetCount',batch.staged_target_count,
      'targetInventoryFingerprint',batch.target_inventory_fingerprint,
      'resultFingerprint',batch.result_fingerprint,'idempotent',true
    );
  END IF;
  IF batch.batch_status<>'RUNNING' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_COMPLETE_BATCH_OR_ACTOR_MISMATCH' USING ERRCODE='55000';
  END IF;
  receipt:=framework_validate_screen_workflow_audit_batch_complete(p_audit_batch_id);
  UPDATE framework_screen_workflow_audit_batch SET
    batch_status='COMPLETE',expected_page_count=(receipt->>'pageCount')::integer,
    expected_target_count=(receipt->>'targetCount')::bigint,
    staged_page_count=(receipt->>'pageCount')::integer,
    staged_target_count=(receipt->>'targetCount')::bigint,
    result_fingerprint=receipt->>'resultFingerprint',completed_at=current_timestamp
  WHERE audit_batch_id=p_audit_batch_id;
  RETURN receipt;
END
$function$;

CREATE OR REPLACE FUNCTION framework_fail_screen_workflow_audit_batch(
  p_audit_batch_id uuid,p_requested_by varchar,p_failure_code varchar,p_failure_detail varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE batch framework_screen_workflow_audit_batch%ROWTYPE; page_count integer; target_count bigint;
BEGIN
  SELECT * INTO batch FROM framework_screen_workflow_audit_batch
   WHERE audit_batch_id=p_audit_batch_id FOR UPDATE;
  IF NOT FOUND OR batch.requested_by<>p_requested_by THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_FAIL_BATCH_OR_ACTOR_MISMATCH' USING ERRCODE='55000';
  END IF;
  IF batch.batch_status='COMPLETE' THEN
    RAISE EXCEPTION 'SCREEN_WORKFLOW_AUDIT_COMPLETE_BATCH_IS_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF batch.batch_status='FAILED' THEN
    RETURN jsonb_build_object('auditBatchId',batch.audit_batch_id,'status','FAILED','idempotent',true);
  END IF;
  SELECT count(*),coalesce(sum(page.target_count),0) INTO page_count,target_count
    FROM framework_screen_workflow_audit_batch_page page WHERE page.audit_batch_id=p_audit_batch_id;
  UPDATE framework_screen_workflow_audit_batch SET
    batch_status='FAILED',staged_page_count=page_count,staged_target_count=target_count,
    failure_code=left(coalesce(nullif(trim(p_failure_code),''),'AUDIT_EXECUTION_FAILED'),120),
    failure_detail=left(coalesce(p_failure_detail,''),500),completed_at=current_timestamp
  WHERE audit_batch_id=p_audit_batch_id;
  RETURN jsonb_build_object('auditBatchId',p_audit_batch_id,'status','FAILED',
    'stagedPageCount',page_count,'stagedTargetCount',target_count,'idempotent',false);
END
$function$;

WITH candidate AS MATERIALIZED (
  SELECT count(*) run_count,min(run_id) first_run_id,max(run_id) last_run_id,
         min(executed_at) first_executed_at,max(executed_at) last_executed_at,
         bool_and(executed_by='webmaster' AND result='BLOCKED' AND total_check_count=18
           AND evidence_json->>'evidenceType'='CONTRACT_SIMULATION'
           AND evidence_json->>'businessFunctionsExecuted'='false'
           AND coalesce(evidence_json->>'sourceCommit','')='') signature_matches,
         encode(sha256(convert_to(string_agg(md5(jsonb_build_array(
           run_id,screen_resource_id,process_code,step_code,capability_code,route_key,result,
           passed_check_count,total_check_count,to_jsonb(blocker_codes),evidence_json,executed_by,
           to_char(executed_at,'YYYY-MM-DD"T"HH24:MI:SS.US'),test_case_id
         )::text),'' ORDER BY run_id),'UTF8')),'hex') aggregate_hash
    FROM framework_screen_workflow_test_run
   WHERE run_id BETWEEN 700681 AND 702430 AND audit_batch_id IS NULL
)
INSERT INTO framework_screen_workflow_audit_incident(
  incident_id,audit_type,first_run_id,last_run_id,run_count,first_executed_at,last_executed_at,
  source_commit,runtime_identity_hash,failure_code,failure_detail
)
SELECT 'UNBOUND-HOURLY-20260811-700681-702430','HOURLY_ALL_PROCESS',first_run_id,last_run_id,run_count,
       first_executed_at,last_executed_at,NULL,NULL,'AUTH_SESSION_EXPIRED_PAGE_8',
       'Legacy hourly attempt committed 7 pages of 250 before HTTP 401; provenance was not recorded, so source commit and runtime identity remain intentionally unknown.'
  FROM candidate
 WHERE run_count=1750 AND first_run_id=700681 AND last_run_id=702430 AND signature_matches
   AND first_executed_at=timestamp '2026-08-11 16:03:46.100822'
   AND last_executed_at=timestamp '2026-08-11 16:04:31.292558'
   AND aggregate_hash='c2e3cb12c3ea814ce44ad9fb7d8954320890c5f31525f86f9f61872708cbd243'
ON CONFLICT (incident_id) DO NOTHING;

INSERT INTO framework_screen_workflow_audit_incident_run(incident_id,run_id)
SELECT incident.incident_id,run.run_id
  FROM framework_screen_workflow_audit_incident incident
  JOIN framework_screen_workflow_test_run run
    ON run.run_id BETWEEN incident.first_run_id AND incident.last_run_id
 WHERE incident.incident_id='UNBOUND-HOURLY-20260811-700681-702430'
   AND run.audit_batch_id IS NULL
ON CONFLICT (run_id) DO NOTHING;

DO $incident_postcondition$
DECLARE range_count bigint; linked_count bigint; foreign_link_count bigint; incident_count bigint;
BEGIN
  SELECT count(*) INTO range_count FROM framework_screen_workflow_test_run
   WHERE run_id BETWEEN 700681 AND 702430;
  SELECT count(*) INTO incident_count FROM framework_screen_workflow_audit_incident
   WHERE incident_id='UNBOUND-HOURLY-20260811-700681-702430'
     AND incident_status='FAILED_UNBOUND' AND audit_type='HOURLY_ALL_PROCESS'
     AND first_run_id=700681 AND last_run_id=702430 AND run_count=1750
     AND first_executed_at=timestamp '2026-08-11 16:03:46.100822'
     AND last_executed_at=timestamp '2026-08-11 16:04:31.292558'
     AND source_commit IS NULL AND runtime_identity_hash IS NULL
     AND failure_code='AUTH_SESSION_EXPIRED_PAGE_8'
     AND failure_detail='Legacy hourly attempt committed 7 pages of 250 before HTTP 401; provenance was not recorded, so source commit and runtime identity remain intentionally unknown.';
  SELECT count(*) INTO linked_count FROM framework_screen_workflow_audit_incident_run
   WHERE incident_id='UNBOUND-HOURLY-20260811-700681-702430';
  SELECT count(*) INTO foreign_link_count FROM framework_screen_workflow_audit_incident_run
   WHERE run_id BETWEEN 700681 AND 702430
     AND incident_id<>'UNBOUND-HOURLY-20260811-700681-702430';
  IF range_count>0 AND (range_count<>1750 OR incident_count<>1 OR linked_count<>1750 OR foreign_link_count<>0) THEN
    RAISE EXCEPTION 'FAILED_UNBOUND incident postcondition mismatch range=% incident=% linked=% foreign=%',
      range_count,incident_count,linked_count,foreign_link_count USING ERRCODE='23514';
  END IF;
  IF range_count=0 AND (incident_count<>0 OR linked_count<>0) THEN
    RAISE EXCEPTION 'FAILED_UNBOUND incident unexpectedly exists without source rows' USING ERRCODE='23514';
  END IF;
END
$incident_postcondition$;

CREATE OR REPLACE VIEW framework_current_screen_workflow_test_run AS
SELECT run.*
  FROM framework_screen_workflow_test_run run
 WHERE run.audit_batch_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM framework_screen_workflow_audit_incident_run incident_run
      WHERE incident_run.run_id=run.run_id
   )
UNION ALL
SELECT run.*
  FROM framework_screen_workflow_test_run run
  JOIN framework_screen_workflow_audit_batch batch
    ON batch.audit_batch_id=run.audit_batch_id AND batch.batch_status='COMPLETE'
 WHERE run.audit_batch_id IS NOT NULL;

COMMENT ON TABLE framework_screen_workflow_audit_batch IS
  'Attempt-unique provenance and atomic visibility ledger for the paged hourly screen contract audit.';
COMMENT ON TABLE framework_screen_workflow_audit_batch_page IS
  'Exact ordered page receipts used to reject partial, duplicate, drifting, or incomplete hourly audits.';
COMMENT ON TABLE framework_screen_workflow_audit_incident IS
  'Immutable FAILED_UNBOUND provenance for historical audit attempts whose source commit cannot be reconstructed.';
COMMENT ON TABLE framework_screen_workflow_audit_incident_run IS
  'Exact immutable run membership excluded from current/latest evidence without rewriting legacy evidence rows.';
COMMENT ON COLUMN framework_screen_workflow_test_run.audit_batch_id IS
  'Nullable for legacy/interactive evidence; hourly evidence is visible as current only after its batch is COMPLETE.';
COMMENT ON FUNCTION framework_screen_workflow_catalog_fingerprint() IS
  'Exact digest of every metadata table that contributes to deterministic screen workflow contract fingerprints.';
COMMENT ON VIEW framework_current_screen_workflow_test_run IS
  'Legacy/interactive evidence plus atomically promoted COMPLETE hourly audit batches; RUNNING and FAILED batches are invisible.';
