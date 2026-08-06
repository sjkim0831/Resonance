-- Immutable QA/business-E2E evidence must describe the exact process contract
-- that was executed. Existing rows deliberately remain LEGACY_QA and cannot be
-- promoted to current business evidence by this migration.

ALTER TABLE framework_process_qa_run
  ADD COLUMN IF NOT EXISTS evidence_type varchar(24) NOT NULL DEFAULT 'LEGACY_QA',
  ADD COLUMN IF NOT EXISTS process_version varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_commit varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contract_fingerprint varchar(128) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS execution_environment varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_uri text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_hash varchar(128) NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='framework_process_qa_run'::regclass
      AND conname='ck_framework_process_qa_run_evidence_type'
  ) THEN
    ALTER TABLE framework_process_qa_run
      ADD CONSTRAINT ck_framework_process_qa_run_evidence_type
      CHECK (evidence_type IN ('LEGACY_QA','QA_RUNTIME','BUSINESS_E2E'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='framework_process_qa_run'::regclass
      AND conname='ck_framework_process_qa_run_business_provenance'
  ) THEN
    ALTER TABLE framework_process_qa_run
      ADD CONSTRAINT ck_framework_process_qa_run_business_provenance CHECK (
        evidence_type <> 'BUSINESS_E2E' OR (
          step_code <> ''
          AND process_version <> ''
          AND source_commit ~ '^[0-9a-fA-F]{7,80}$'
          AND contract_fingerprint ~ '^[0-9a-f]{32,128}$'
          AND execution_environment <> ''
          AND evidence_uri <> ''
          AND evidence_hash ~ '^[0-9a-f]{64}$'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_framework_process_qa_run_current_e2e
  ON framework_process_qa_run(process_code,step_code,process_version,contract_fingerprint,executed_at DESC,qa_run_id DESC)
  WHERE evidence_type='BUSINESS_E2E';

CREATE UNIQUE INDEX IF NOT EXISTS uq_framework_process_qa_run_e2e_evidence
  ON framework_process_qa_run(process_code,step_code,process_version,contract_fingerprint,source_commit,evidence_hash)
  WHERE evidence_type='BUSINESS_E2E';

-- This singleton is the authoritative identity of the release that is both
-- serving traffic and known healthy.  Git HEAD and the deploy success marker
-- are intentionally not used by the evidence view: either may advance or lag
-- independently while a rollout is being verified.
CREATE TABLE IF NOT EXISTS framework_runtime_release_state (
  release_key varchar(40) PRIMARY KEY,
  source_commit varchar(40) NOT NULL,
  deployment_namespace varchar(100) NOT NULL,
  deployment_name varchar(100) NOT NULL,
  deployment_uid varchar(120) NOT NULL,
  deployment_generation bigint NOT NULL,
  observed_generation bigint NOT NULL,
  desired_replicas integer NOT NULL,
  image_ref text NOT NULL,
  image_id text NOT NULL,
  health_status varchar(20) NOT NULL,
  recorded_by varchar(100) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT current_timestamp,
  CONSTRAINT ck_framework_runtime_release_state_singleton
    CHECK (release_key='CARBONET_RUNTIME'),
  CONSTRAINT ck_framework_runtime_release_state_source_commit
    CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  CONSTRAINT ck_framework_runtime_release_state_generation
    CHECK (deployment_generation>=0 AND observed_generation>=deployment_generation),
  CONSTRAINT ck_framework_runtime_release_state_replicas
    CHECK (desired_replicas>0),
  CONSTRAINT ck_framework_runtime_release_state_image_id
    CHECK (image_id ~ 'sha256:[0-9a-f]{64}$'),
  CONSTRAINT ck_framework_runtime_release_state_health
    CHECK (health_status='UP')
);

CREATE OR REPLACE FUNCTION framework_current_process_step_contract_fingerprint(
  p_process_code varchar,
  p_step_code varchar
) RETURNS varchar
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT md5(concat_ws('|',
    p.process_code,p.process_version,
    (to_jsonb(p)-'created_at'-'updated_at')::text,
    (to_jsonb(s)-'step_id'-'created_at'-'updated_at')::text,
    spec.spec_version,spec.source_hash,
    coalesce((
      SELECT jsonb_agg(to_jsonb(edge)-'edge_id'-'created_at'-'updated_at'
                       ORDER BY edge.from_step_code,edge.to_step_code,edge.edge_type,edge.condition_code)
      FROM framework_process_flow_edge edge
      WHERE edge.process_code=p.process_code AND edge.use_at='Y'
        AND (edge.from_step_code=s.step_code OR edge.to_step_code=s.step_code)
    ),'[]'::jsonb)::text,
    coalesce((
      SELECT jsonb_agg(to_jsonb(handoff)-'handoff_id'-'created_at'-'updated_at'
                       ORDER BY handoff.process_code,handoff.from_step_code,handoff.to_process_code,handoff.to_step_code,handoff.handoff_type)
      FROM framework_process_data_handoff handoff
      WHERE (handoff.process_code=p.process_code AND handoff.from_step_code=s.step_code)
         OR (handoff.to_process_code=p.process_code AND handoff.to_step_code=s.step_code)
    ),'[]'::jsonb)::text,
    coalesce((
      SELECT jsonb_agg(to_jsonb(dependency)-'created_at'-'updated_at'
                       ORDER BY dependency.parent_process_code,dependency.parent_step_code,dependency.child_process_code)
      FROM framework_process_dependency dependency
      WHERE dependency.use_at='Y' AND (
        (dependency.parent_process_code=p.process_code AND dependency.parent_step_code=s.step_code)
        OR dependency.child_process_code=p.process_code
      )
    ),'[]'::jsonb)::text
  ))
  FROM framework_process_definition p
  JOIN framework_process_step s ON s.process_code=p.process_code
  JOIN framework_step_execution_spec spec
    ON spec.process_code=s.process_code AND spec.step_code=s.step_code
  WHERE p.process_code=p_process_code AND s.step_code=p_step_code
    AND nullif(spec.source_hash,'') IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION framework_current_process_contract_fingerprint(
  p_process_code varchar
) RETURNS varchar
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  WITH current_steps AS (
    SELECT p.process_code,p.process_version,s.step_code,
           framework_current_process_step_contract_fingerprint(p.process_code,s.step_code) step_fingerprint
    FROM framework_process_definition p
    JOIN framework_process_step s ON s.process_code=p.process_code
    WHERE p.process_code=p_process_code
  )
  SELECT CASE
    WHEN count(*)=0 OR count(*) FILTER (WHERE step_fingerprint IS NULL)>0 THEN NULL
    ELSE md5(concat_ws('|',max(process_code),max(process_version),
      string_agg(step_code||':'||step_fingerprint,'|' ORDER BY step_code)))
  END
  FROM current_steps
$$;

CREATE OR REPLACE VIEW framework_current_business_e2e_evidence AS
SELECT p.process_code,
       s.step_code,
       p.process_version AS current_process_version,
       fingerprint.contract_fingerprint AS current_contract_fingerprint,
       runtime.source_commit AS current_runtime_source_commit,
       latest.qa_run_id,
       CASE
         WHEN runtime.source_commit IS NULL THEN 'NOT_RUN'
         WHEN fingerprint.contract_fingerprint IS NULL THEN 'NOT_RUN'
         WHEN latest.qa_run_id IS NULL THEN 'NOT_RUN'
         WHEN latest.result='PASSED' THEN 'PASSED'
         ELSE 'BLOCKED'
       END AS business_test_result,
       CASE
         WHEN runtime.source_commit IS NULL THEN 'RUNTIME_COMMIT_UNAVAILABLE'
         WHEN fingerprint.contract_fingerprint IS NULL THEN 'CONTRACT_FINGERPRINT_UNAVAILABLE'
         WHEN latest.qa_run_id IS NULL THEN 'NO_CURRENT_VERSION_EVIDENCE'
         WHEN latest.result='PASSED' THEN 'CURRENT_VERSION_PASS'
         ELSE 'CURRENT_VERSION_FAILED'
       END AS business_evidence_status,
       latest.result,
       latest.failure_reason,
       latest.evidence_json,
       latest.executed_by,
       latest.executed_at,
       latest.process_version AS evidence_process_version,
       latest.source_commit,
       latest.contract_fingerprint,
       latest.execution_environment,
       latest.evidence_uri,
       latest.evidence_hash,
       latest.qa_run_id IS NOT NULL AND runtime.source_commit IS NOT NULL AS current_version
FROM framework_process_definition p
JOIN framework_process_step s ON s.process_code=p.process_code
LEFT JOIN framework_runtime_release_state runtime
  ON runtime.release_key='CARBONET_RUNTIME'
LEFT JOIN LATERAL (
  SELECT framework_current_process_step_contract_fingerprint(p.process_code,s.step_code) contract_fingerprint
) fingerprint ON true
LEFT JOIN LATERAL (
  SELECT evidence.*
  FROM framework_process_qa_run evidence
  WHERE evidence.evidence_type='BUSINESS_E2E'
    AND evidence.process_code=p.process_code
    AND evidence.step_code=s.step_code
    AND evidence.process_version=p.process_version
    AND evidence.contract_fingerprint=fingerprint.contract_fingerprint
    AND evidence.source_commit=runtime.source_commit
  ORDER BY evidence.executed_at DESC,evidence.qa_run_id DESC
  LIMIT 1
) latest ON true;

CREATE OR REPLACE FUNCTION framework_reject_process_qa_run_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'framework_process_qa_run is immutable; append a new evidence row'
    USING ERRCODE='55000';
END
$$;

CREATE OR REPLACE FUNCTION framework_validate_process_qa_evidence_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_version varchar; current_fingerprint varchar; captured jsonb;
BEGIN
  IF NEW.evidence_type<>'BUSINESS_E2E' THEN RETURN NEW; END IF;
  captured:=NEW.evidence_json->'contract';
  IF captured IS NULL THEN
    SELECT item INTO captured
    FROM jsonb_array_elements(coalesce(NEW.evidence_json->'contracts','[]'::jsonb)) item
    WHERE item->>'processCode'=NEW.process_code AND item->>'stepCode'=NEW.step_code
    LIMIT 1;
  END IF;
  SELECT process_version,framework_current_process_step_contract_fingerprint(process_code,NEW.step_code)
    INTO current_version,current_fingerprint
  FROM framework_process_definition WHERE process_code=NEW.process_code;
  IF captured IS NULL
     OR captured->>'processCode' IS DISTINCT FROM NEW.process_code
     OR captured->>'stepCode' IS DISTINCT FROM NEW.step_code
     OR captured->>'processVersion' IS DISTINCT FROM NEW.process_version
     OR captured->>'contractFingerprint' IS DISTINCT FROM NEW.contract_fingerprint
     OR captured->>'sourceCommit' IS DISTINCT FROM NEW.source_commit
     OR NEW.process_version IS DISTINCT FROM current_version
     OR NEW.contract_fingerprint IS DISTINCT FROM current_fingerprint THEN
    RAISE EXCEPTION 'BUSINESS_E2E evidence is not bound to its pre-run current contract: %/%',NEW.process_code,NEW.step_code
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='framework_process_qa_run'::regclass
      AND tgname='trg_framework_process_qa_run_immutable'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_framework_process_qa_run_immutable
      BEFORE UPDATE OR DELETE ON framework_process_qa_run
      FOR EACH ROW EXECUTE FUNCTION framework_reject_process_qa_run_mutation();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='framework_process_qa_run'::regclass
      AND tgname='trg_framework_process_qa_run_validate_insert'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_framework_process_qa_run_validate_insert
      BEFORE INSERT ON framework_process_qa_run
      FOR EACH ROW EXECUTE FUNCTION framework_validate_process_qa_evidence_insert();
  END IF;
END
$$;

COMMENT ON VIEW framework_current_business_e2e_evidence IS
  'Latest immutable BUSINESS_E2E evidence matching current runtime source commit, process_version and compiled step fingerprint; missing runtime identity and stale evidence remain NOT_RUN.';
