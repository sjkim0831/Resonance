-- Generated source is versioned in PostgreSQL so a design change can be
-- regenerated without rediscovering the framework and a known failure can be
-- traced to the smallest affected contract.

CREATE TABLE IF NOT EXISTS framework_source_artifact (
  source_artifact_id bigserial PRIMARY KEY,
  source_path varchar(1000) NOT NULL UNIQUE,
  artifact_kind varchar(30) NOT NULL,
  language_code varchar(20) NOT NULL,
  ownership_mode varchar(16) NOT NULL DEFAULT 'GENERATED'
    CHECK(ownership_mode IN ('GENERATED','MANUAL','HYBRID')),
  source_content text NOT NULL,
  source_hash varchar(64) NOT NULL,
  design_hash varchar(64),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  revision bigint NOT NULL DEFAULT 1,
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_source_artifact_version (
  source_artifact_id bigint NOT NULL REFERENCES framework_source_artifact(source_artifact_id) ON DELETE CASCADE,
  revision bigint NOT NULL,
  source_content text NOT NULL,
  source_hash varchar(64) NOT NULL,
  design_hash varchar(64),
  metadata_json jsonb NOT NULL,
  archived_at timestamp NOT NULL DEFAULT current_timestamp,
  archived_by varchar(100) NOT NULL,
  PRIMARY KEY(source_artifact_id,revision)
);

CREATE TABLE IF NOT EXISTS framework_source_materialization_state (
  source_artifact_id bigint PRIMARY KEY REFERENCES framework_source_artifact(source_artifact_id) ON DELETE CASCADE,
  source_hash varchar(64) NOT NULL,
  materialized_hash varchar(64),
  sync_status varchar(16) NOT NULL DEFAULT 'DIRTY'
    CHECK(sync_status IN ('DIRTY','MATERIALIZED','FAILED')),
  last_error text,
  materialized_at timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_diagnostic_signature (
  diagnostic_id bigserial PRIMARY KEY,
  fingerprint varchar(64) NOT NULL UNIQUE,
  error_type varchar(80) NOT NULL,
  normalized_message text NOT NULL,
  affected_resource_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  affected_source_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  prevention_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count bigint NOT NULL DEFAULT 1,
  resolution_status varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK(resolution_status IN ('OPEN','RESOLVED','IGNORED')),
  first_seen_at timestamp NOT NULL DEFAULT current_timestamp,
  last_seen_at timestamp NOT NULL DEFAULT current_timestamp,
  resolved_at timestamp
);

CREATE INDEX IF NOT EXISTS ix_source_materialization_dirty
  ON framework_source_materialization_state(sync_status,updated_at,source_artifact_id);
CREATE INDEX IF NOT EXISTS ix_source_artifact_design_hash
  ON framework_source_artifact(design_hash,active_yn);
CREATE INDEX IF NOT EXISTS ix_diagnostic_status_seen
  ON framework_diagnostic_signature(resolution_status,last_seen_at DESC);

CREATE OR REPLACE FUNCTION framework_archive_source_artifact()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_hash IS DISTINCT FROM NEW.source_hash THEN
    INSERT INTO framework_source_artifact_version(
      source_artifact_id,revision,source_content,source_hash,design_hash,
      metadata_json,archived_by)
    VALUES(OLD.source_artifact_id,OLD.revision,OLD.source_content,OLD.source_hash,
      OLD.design_hash,OLD.metadata_json,coalesce(NEW.updated_by,'SYSTEM'))
    ON CONFLICT DO NOTHING;
    NEW.revision := OLD.revision+1;
    NEW.updated_at := current_timestamp;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_archive_source_artifact ON framework_source_artifact;
CREATE TRIGGER trg_archive_source_artifact BEFORE UPDATE ON framework_source_artifact
FOR EACH ROW EXECUTE FUNCTION framework_archive_source_artifact();

CREATE OR REPLACE FUNCTION framework_put_source_artifact(
  requested_path varchar, requested_kind varchar, requested_language varchar,
  requested_content text, requested_design_hash varchar DEFAULT NULL,
  requested_metadata jsonb DEFAULT '{}'::jsonb, requested_actor varchar DEFAULT 'GENERATOR'
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE next_hash varchar; resolved_id bigint;
BEGIN
  next_hash := (md5(coalesce(requested_content,''))||
    md5('FRAMEWORK_SOURCE_V1|'||coalesce(requested_content,'')))::varchar;
  INSERT INTO framework_source_artifact(
    source_path,artifact_kind,language_code,source_content,source_hash,
    design_hash,metadata_json,updated_by)
  VALUES(trim(requested_path),upper(trim(requested_kind)),lower(trim(requested_language)),
    coalesce(requested_content,''),next_hash,requested_design_hash,
    coalesce(requested_metadata,'{}'::jsonb),coalesce(requested_actor,'GENERATOR'))
  ON CONFLICT(source_path) DO UPDATE SET
    artifact_kind=excluded.artifact_kind,language_code=excluded.language_code,
    source_content=excluded.source_content,source_hash=excluded.source_hash,
    design_hash=excluded.design_hash,metadata_json=excluded.metadata_json,
    active_yn='Y',updated_by=excluded.updated_by
  WHERE framework_source_artifact.source_hash IS DISTINCT FROM excluded.source_hash
     OR framework_source_artifact.design_hash IS DISTINCT FROM excluded.design_hash
     OR framework_source_artifact.metadata_json IS DISTINCT FROM excluded.metadata_json
  RETURNING source_artifact_id INTO resolved_id;
  IF resolved_id IS NULL THEN
    SELECT source_artifact_id INTO resolved_id FROM framework_source_artifact
    WHERE source_path=trim(requested_path);
  END IF;
  INSERT INTO framework_source_materialization_state(source_artifact_id,source_hash,sync_status)
  SELECT resolved_id,source_hash,'DIRTY' FROM framework_source_artifact WHERE source_artifact_id=resolved_id
  ON CONFLICT(source_artifact_id) DO UPDATE SET source_hash=excluded.source_hash,
    sync_status=CASE WHEN framework_source_materialization_state.source_hash IS DISTINCT FROM excluded.source_hash
      THEN 'DIRTY' ELSE framework_source_materialization_state.sync_status END,
    last_error=CASE WHEN framework_source_materialization_state.source_hash IS DISTINCT FROM excluded.source_hash
      THEN NULL ELSE framework_source_materialization_state.last_error END,
    updated_at=CASE WHEN framework_source_materialization_state.source_hash IS DISTINCT FROM excluded.source_hash
      THEN current_timestamp ELSE framework_source_materialization_state.updated_at END;
  RETURN resolved_id;
END $$;

CREATE OR REPLACE FUNCTION framework_import_source_artifacts(
  requested_artifacts jsonb, requested_actor varchar DEFAULT 'GENERATOR'
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE item jsonb; imported integer := 0;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(coalesce(requested_artifacts,'[]'::jsonb))
  LOOP
    PERFORM framework_put_source_artifact(item->>'sourcePath',item->>'artifactKind',
      item->>'languageCode',item->>'sourceContent',item->>'designHash',
      coalesce(item->'metadata','{}'::jsonb),requested_actor);
    imported := imported+1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'imported',imported);
END $$;

CREATE OR REPLACE FUNCTION framework_source_materialization_snapshot(requested_limit integer DEFAULT 5000)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('schemaVersion','1.0.0','artifactCount',count(*),
    'artifacts',coalesce(jsonb_agg(jsonb_build_object(
      'sourceArtifactId',a.source_artifact_id,'sourcePath',a.source_path,
      'artifactKind',a.artifact_kind,'languageCode',a.language_code,
      'sourceContent',a.source_content,'sourceHash',s.source_hash,
      'designHash',a.design_hash,'revision',a.revision,'metadata',a.metadata_json
    ) ORDER BY a.source_path),'[]'::jsonb))
  FROM framework_source_artifact a JOIN framework_source_materialization_state s USING(source_artifact_id)
  WHERE a.active_yn='Y' AND s.sync_status='DIRTY' AND a.source_artifact_id IN (
    SELECT s2.source_artifact_id FROM framework_source_materialization_state s2
    JOIN framework_source_artifact a2 USING(source_artifact_id)
    WHERE a2.active_yn='Y' AND s2.sync_status='DIRTY'
    ORDER BY a2.source_path LIMIT greatest(1,least(coalesce(requested_limit,5000),10000)))
$$;

CREATE OR REPLACE FUNCTION framework_complete_source_materialization(requested_result jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE completed integer := 0;
BEGIN
  WITH artifacts AS (
    SELECT * FROM jsonb_to_recordset(coalesce(requested_result->'artifacts','[]'::jsonb))
      AS x("sourceArtifactId" bigint,"sourceHash" text,status text)
    WHERE status IN ('GENERATED','UNCHANGED')
  ), done AS (
    UPDATE framework_source_materialization_state s SET materialized_hash=a."sourceHash",
      sync_status='MATERIALIZED',last_error=NULL,materialized_at=current_timestamp,
      updated_at=current_timestamp
    FROM artifacts a WHERE s.source_artifact_id=a."sourceArtifactId"
      AND s.source_hash=a."sourceHash" RETURNING 1
  ) SELECT count(*) INTO completed FROM done;
  RETURN jsonb_build_object('success',true,'completed',completed);
END $$;

CREATE OR REPLACE FUNCTION framework_screen_blueprint_export(requested_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('schemaVersion','2.0.0',
    'batch',jsonb_build_object('code','DB_LIVE','source','POSTGRESQL',
      'exportedAt',current_timestamp),'blueprints',coalesce(jsonb_agg(jsonb_build_object(
      'blueprintCode',b.blueprint_code,'processCode',b.process_code,'stepCode',b.step_code,
      'actorCode',b.actor_code,'audience',b.audience,'pageId',b.page_id,
      'pageName',b.page_name,'routePath',lower(split_part(b.route_path,'?',1)),
      'screenType',b.screen_type,'templateCode',b.template_code,
      'specificationJson',b.specification_json,'traceabilityJson',b.traceability_json,
      'validationStatus',b.validation_status
    ) ORDER BY p.development_order,b.process_code,s.step_order,b.audience,b.blueprint_id),'[]'::jsonb))
  FROM framework_screen_blueprint b
  JOIN framework_process_definition p USING(process_code)
  JOIN framework_process_step s ON s.process_code=b.process_code AND s.step_code=b.step_code
  WHERE b.validation_status='VALID' AND b.blueprint_id IN (
    SELECT b2.blueprint_id FROM framework_screen_blueprint b2
    JOIN framework_process_definition p2 USING(process_code)
    JOIN framework_process_step s2 ON s2.process_code=b2.process_code AND s2.step_code=b2.step_code
    WHERE b2.validation_status='VALID'
    ORDER BY p2.development_order,b2.process_code,s2.step_order,b2.audience,b2.blueprint_id
    LIMIT greatest(1,least(coalesce(requested_limit,1000),1000)))
$$;

CREATE OR REPLACE VIEW framework_source_generation_status AS
SELECT a.source_artifact_id,a.source_path,a.artifact_kind,a.language_code,
  a.ownership_mode,a.revision,a.design_hash,s.sync_status,s.source_hash,
  s.materialized_hash,s.last_error,s.materialized_at,s.updated_at
FROM framework_source_artifact a JOIN framework_source_materialization_state s USING(source_artifact_id);
