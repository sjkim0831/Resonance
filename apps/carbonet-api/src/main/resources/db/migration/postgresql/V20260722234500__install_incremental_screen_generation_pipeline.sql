-- Design is the single source of truth, but registered source screens must not
-- be overwritten. Track the generated portion separately and invalidate only
-- screens whose complete actor/process/design contract changed.

CREATE TABLE IF NOT EXISTS framework_screen_generation_state (
  blueprint_id bigint PRIMARY KEY REFERENCES framework_screen_blueprint(blueprint_id) ON DELETE CASCADE,
  ownership_mode varchar(12) NOT NULL CHECK (ownership_mode IN ('GENERATED','MANUAL','HYBRID')),
  design_hash varchar(64) NOT NULL,
  generated_hash varchar(64),
  sync_status varchar(16) NOT NULL CHECK (sync_status IN ('DIRTY','GENERATED','MANUAL','FAILED')),
  last_run_code varchar(80),
  last_error text,
  generated_at timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS ix_screen_generation_state_dirty
  ON framework_screen_generation_state(sync_status,ownership_mode,updated_at,blueprint_id);

CREATE TABLE IF NOT EXISTS framework_incremental_generation_run (
  run_id bigserial PRIMARY KEY,
  run_code varchar(80) NOT NULL UNIQUE,
  requested_limit integer NOT NULL CHECK (requested_limit BETWEEN 1 AND 1000),
  requested_process varchar(80),
  dirty_count integer NOT NULL DEFAULT 0,
  generated_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  manual_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  elapsed_millis bigint,
  run_status varchar(20) NOT NULL DEFAULT 'RUNNING'
    CHECK (run_status IN ('RUNNING','GENERATED','FAILED')),
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp
);

CREATE OR REPLACE FUNCTION framework_screen_ownership(requested_blueprint_id bigint)
RETURNS varchar
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN b.implementation_strategy='GENERATED_RUNTIME' THEN 'GENERATED'
    WHEN b.implementation_strategy='ADOPT_EXISTING' AND EXISTS (
      SELECT 1 FROM framework_professional_screen_contract c
      WHERE c.process_code=b.process_code AND c.step_code=b.step_code
        AND c.audience=b.audience
        AND lower(split_part(c.route_path,'?',1))=lower(split_part(b.route_path,'?',1))
    ) THEN 'HYBRID'
    ELSE 'MANUAL'
  END::varchar
  FROM framework_screen_blueprint b WHERE b.blueprint_id=requested_blueprint_id;
$$;

CREATE OR REPLACE FUNCTION framework_screen_design_hash(requested_blueprint_id bigint)
RETURNS varchar
LANGUAGE sql STABLE AS $$
  WITH source AS (
    SELECT concat_ws('|',
      b.blueprint_code,b.process_code,b.step_code,b.actor_code,b.audience,
      lower(split_part(b.route_path,'?',1)),b.screen_type,b.template_code,
      b.specification_json,b.traceability_json,b.validation_status,
      coalesce(p.process_version,''),coalesce(p.goal,''),
      coalesce(s.command_code,''),coalesce(s.from_state,''),coalesce(s.to_state,''),
      coalesce(s.completion_rule,''),
      coalesce((SELECT string_agg(concat_ws('|',c.contract_id::text,c.contract_status,
        c.business_purpose,c.entry_condition,c.exit_condition,c.kpi_contract,
        c.section_contract,c.field_contract,c.command_contract,c.state_contract,
        c.api_contract,c.data_contract,c.evidence_contract,c.responsive_contract,
        c.accessibility_contract,c.security_contract),E'\n' ORDER BY c.contract_id)
        FROM framework_professional_screen_contract c
        WHERE c.process_code=b.process_code AND c.step_code=b.step_code
          AND c.audience=b.audience
          AND lower(split_part(c.route_path,'?',1))=lower(split_part(b.route_path,'?',1))),'')
    ) AS payload
    FROM framework_screen_blueprint b
    JOIN framework_process_definition p ON p.process_code=b.process_code
    JOIN framework_process_step s ON s.process_code=b.process_code AND s.step_code=b.step_code
    WHERE b.blueprint_id=requested_blueprint_id
  )
  SELECT (md5(payload)||md5('SCREEN_CONTRACT_V1|'||payload))::varchar FROM source;
$$;

CREATE OR REPLACE FUNCTION framework_refresh_screen_generation_impact(
  requested_limit integer DEFAULT 1000,
  requested_process varchar DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  effective_limit integer := greatest(1,least(coalesce(requested_limit,1000),1000));
  inspected integer := 0;
  changed integer := 0;
  dirty integer := 0;
  generated integer := 0;
  manual integer := 0;
BEGIN
  WITH candidates AS (
    SELECT b.blueprint_id,framework_screen_ownership(b.blueprint_id) ownership_mode,
      framework_screen_design_hash(b.blueprint_id) design_hash
    FROM framework_screen_blueprint b
    JOIN framework_process_definition p ON p.process_code=b.process_code
    JOIN framework_process_step s ON s.process_code=b.process_code AND s.step_code=b.step_code
    WHERE b.validation_status='VALID'
      AND (requested_process IS NULL OR b.process_code=requested_process)
    ORDER BY p.development_order,b.process_code,s.step_order,b.audience,b.blueprint_id
    LIMIT effective_limit
  ), upserted AS (
    INSERT INTO framework_screen_generation_state(
      blueprint_id,ownership_mode,design_hash,sync_status,updated_at)
    SELECT blueprint_id,ownership_mode,design_hash,
      CASE WHEN ownership_mode='MANUAL' THEN 'MANUAL' ELSE 'DIRTY' END,current_timestamp
    FROM candidates
    ON CONFLICT(blueprint_id) DO UPDATE SET
      ownership_mode=excluded.ownership_mode,
      design_hash=excluded.design_hash,
      sync_status=CASE
        WHEN excluded.ownership_mode='MANUAL' THEN 'MANUAL'
        WHEN framework_screen_generation_state.design_hash IS DISTINCT FROM excluded.design_hash THEN 'DIRTY'
        WHEN framework_screen_generation_state.generated_hash IS NULL THEN 'DIRTY'
        ELSE framework_screen_generation_state.sync_status END,
      last_error=CASE
        WHEN framework_screen_generation_state.design_hash IS DISTINCT FROM excluded.design_hash THEN NULL
        ELSE framework_screen_generation_state.last_error END,
      updated_at=CASE
        WHEN framework_screen_generation_state.design_hash IS DISTINCT FROM excluded.design_hash
          OR framework_screen_generation_state.ownership_mode IS DISTINCT FROM excluded.ownership_mode
        THEN current_timestamp ELSE framework_screen_generation_state.updated_at END
    WHERE framework_screen_generation_state.design_hash IS DISTINCT FROM excluded.design_hash
       OR framework_screen_generation_state.ownership_mode IS DISTINCT FROM excluded.ownership_mode
       OR framework_screen_generation_state.generated_hash IS NULL
    RETURNING 1
  ) SELECT count(*) INTO changed FROM upserted;

  SELECT count(*),count(*) FILTER(WHERE state.sync_status='DIRTY'),
    count(*) FILTER(WHERE state.sync_status='GENERATED'),
    count(*) FILTER(WHERE state.ownership_mode='MANUAL')
  INTO inspected,dirty,generated,manual
  FROM framework_screen_generation_state state
  JOIN framework_screen_blueprint b USING(blueprint_id)
  WHERE requested_process IS NULL OR b.process_code=requested_process;

  RETURN jsonb_build_object('success',true,'inspected',inspected,'changed',changed,
    'dirty',dirty,'generated',generated,'manual',manual,'limit',effective_limit);
END $$;

CREATE OR REPLACE FUNCTION framework_incremental_screen_generation_snapshot(
  requested_limit integer DEFAULT 1000,
  requested_process varchar DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  refreshed jsonb;
  payload jsonb;
BEGIN
  refreshed := framework_refresh_screen_generation_impact(requested_limit,requested_process);
  SELECT jsonb_build_object(
    'schemaVersion','3.0.0','generatedAt',current_timestamp,'impact',refreshed,
    'screenCount',count(*),'screens',coalesce(jsonb_agg(jsonb_build_object(
      'blueprintId',b.blueprint_id,'blueprintCode',b.blueprint_code,
      'processCode',b.process_code,'stepCode',b.step_code,'actorCode',b.actor_code,
      'audience',b.audience,'pageId',b.page_id,'pageName',b.page_name,
      'routePath',lower(split_part(b.route_path,'?',1)),'screenType',b.screen_type,
      'templateCode',b.template_code,'ownershipMode',state.ownership_mode,
      'designHash',state.design_hash,
      'specification',coalesce(framework_try_jsonb(b.specification_json),'{}'::jsonb),
      'traceability',coalesce(framework_try_jsonb(b.traceability_json),'{}'::jsonb)
    ) ORDER BY p.development_order,b.process_code,s.step_order,b.audience,b.blueprint_id),'[]'::jsonb))
  INTO payload
  FROM framework_screen_generation_state state
  JOIN framework_screen_blueprint b USING(blueprint_id)
  JOIN framework_process_definition p ON p.process_code=b.process_code
  JOIN framework_process_step s ON s.process_code=b.process_code AND s.step_code=b.step_code
  WHERE state.sync_status='DIRTY' AND state.ownership_mode IN ('GENERATED','HYBRID')
    AND b.validation_status='VALID'
    AND (requested_process IS NULL OR b.process_code=requested_process)
    AND b.blueprint_id IN (
      SELECT state2.blueprint_id FROM framework_screen_generation_state state2
      JOIN framework_screen_blueprint b2 USING(blueprint_id)
      JOIN framework_process_definition p2 ON p2.process_code=b2.process_code
      JOIN framework_process_step s2 ON s2.process_code=b2.process_code AND s2.step_code=b2.step_code
      WHERE state2.sync_status='DIRTY' AND state2.ownership_mode IN ('GENERATED','HYBRID')
        AND b2.validation_status='VALID'
        AND (requested_process IS NULL OR b2.process_code=requested_process)
      ORDER BY p2.development_order,b2.process_code,s2.step_order,b2.audience,b2.blueprint_id
      LIMIT greatest(1,least(coalesce(requested_limit,1000),1000))
    );
  RETURN payload;
END $$;

CREATE OR REPLACE FUNCTION framework_complete_incremental_screen_generation(
  requested_run_code varchar,
  requested_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  completed integer := 0;
BEGIN
  WITH artifacts AS (
    SELECT * FROM jsonb_to_recordset(coalesce(requested_result->'artifacts','[]'::jsonb))
      AS x("blueprintId" bigint,"designHash" text,status text)
    WHERE status IN ('GENERATED','UNCHANGED')
  ), updated AS (
    UPDATE framework_screen_generation_state state SET
      generated_hash=artifact."designHash",sync_status='GENERATED',
      last_run_code=requested_run_code,last_error=NULL,
      generated_at=current_timestamp,updated_at=current_timestamp
    FROM artifacts artifact
    WHERE state.blueprint_id=artifact."blueprintId"
      AND state.design_hash=artifact."designHash"
    RETURNING 1
  ) SELECT count(*) INTO completed FROM updated;

  UPDATE framework_incremental_generation_run SET
    generated_count=coalesce((requested_result->>'generated')::integer,0),
    unchanged_count=coalesce((requested_result->>'unchanged')::integer,0),
    manual_count=coalesce((requested_result->>'manual')::integer,0),
    failed_count=coalesce((requested_result->>'failed')::integer,0),
    elapsed_millis=coalesce((requested_result->>'elapsedMillis')::bigint,0),
    run_status=CASE WHEN coalesce((requested_result->>'failed')::integer,0)=0 THEN 'GENERATED' ELSE 'FAILED' END,
    result_json=requested_result,completed_at=current_timestamp
  WHERE run_code=requested_run_code;

  RETURN jsonb_build_object('success',true,'completed',completed,'runCode',requested_run_code);
END $$;

CREATE OR REPLACE FUNCTION framework_mark_blueprint_generation_dirty()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ownership varchar;
  next_hash varchar;
BEGIN
  ownership := framework_screen_ownership(NEW.blueprint_id);
  next_hash := framework_screen_design_hash(NEW.blueprint_id);
  INSERT INTO framework_screen_generation_state(
    blueprint_id,ownership_mode,design_hash,sync_status,updated_at)
  VALUES(NEW.blueprint_id,ownership,next_hash,
    CASE WHEN ownership='MANUAL' THEN 'MANUAL' ELSE 'DIRTY' END,current_timestamp)
  ON CONFLICT(blueprint_id) DO UPDATE SET
    ownership_mode=excluded.ownership_mode,design_hash=excluded.design_hash,
    sync_status=CASE WHEN excluded.ownership_mode='MANUAL' THEN 'MANUAL'
      WHEN framework_screen_generation_state.design_hash IS DISTINCT FROM excluded.design_hash THEN 'DIRTY'
      ELSE framework_screen_generation_state.sync_status END,
    last_error=NULL,updated_at=current_timestamp;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_blueprint_generation_dirty ON framework_screen_blueprint;
CREATE TRIGGER trg_blueprint_generation_dirty
AFTER INSERT OR UPDATE OF process_code,step_code,actor_code,audience,page_id,page_name,
  route_path,screen_type,template_code,specification_json,traceability_json,validation_status,
  implementation_strategy,source_reference
ON framework_screen_blueprint FOR EACH ROW
EXECUTE FUNCTION framework_mark_blueprint_generation_dirty();

CREATE OR REPLACE FUNCTION framework_mark_contract_generation_dirty()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  changed_process varchar;
  changed_step varchar;
BEGIN
  IF TG_OP='DELETE' THEN
    changed_process := OLD.process_code; changed_step := OLD.step_code;
  ELSE
    changed_process := NEW.process_code; changed_step := NEW.step_code;
  END IF;
  UPDATE framework_screen_generation_state state SET
    sync_status=CASE WHEN state.ownership_mode='MANUAL' THEN 'MANUAL' ELSE 'DIRTY' END,
    last_error=NULL,updated_at=current_timestamp
  FROM framework_screen_blueprint b
  WHERE state.blueprint_id=b.blueprint_id
    AND b.process_code=changed_process AND b.step_code=changed_step;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contract_generation_dirty ON framework_professional_screen_contract;
CREATE TRIGGER trg_contract_generation_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_professional_screen_contract
FOR EACH ROW EXECUTE FUNCTION framework_mark_contract_generation_dirty();

CREATE OR REPLACE VIEW framework_incremental_screen_generation_status AS
SELECT b.blueprint_id,b.blueprint_code,b.process_code,b.step_code,b.audience,
  b.page_name,b.route_path,b.implementation_strategy,state.ownership_mode,
  state.sync_status,state.design_hash,state.generated_hash,
  state.last_run_code,state.last_error,state.generated_at,state.updated_at
FROM framework_screen_blueprint b
JOIN framework_screen_generation_state state USING(blueprint_id);

SELECT framework_refresh_screen_generation_impact(1000,NULL);
