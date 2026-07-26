-- DB-first framework runtime: settings, routes, endpoints and design assets are
-- canonical DB resources. Only resources whose contract hash changed are emitted.

CREATE TABLE IF NOT EXISTS framework_runtime_resource (
  resource_id bigserial PRIMARY KEY,
  resource_kind varchar(24) NOT NULL CHECK (resource_kind IN
    ('SETTING','ROUTE','ENDPOINT','AUTHORITY','THEME','SECTION','COMPONENT','CSS')),
  resource_key varchar(600) NOT NULL,
  scope_code varchar(80) NOT NULL DEFAULT 'GLOBAL',
  contract_json jsonb NOT NULL,
  contract_hash varchar(64) NOT NULL,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  revision bigint NOT NULL DEFAULT 1,
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(resource_kind,resource_key,scope_code)
);

CREATE TABLE IF NOT EXISTS framework_runtime_resource_dependency (
  source_resource_id bigint NOT NULL REFERENCES framework_runtime_resource(resource_id) ON DELETE CASCADE,
  target_resource_id bigint NOT NULL REFERENCES framework_runtime_resource(resource_id) ON DELETE CASCADE,
  dependency_type varchar(40) NOT NULL DEFAULT 'USES',
  PRIMARY KEY(source_resource_id,target_resource_id,dependency_type),
  CHECK(source_resource_id<>target_resource_id)
);

CREATE TABLE IF NOT EXISTS framework_runtime_generation_state (
  resource_id bigint PRIMARY KEY REFERENCES framework_runtime_resource(resource_id) ON DELETE CASCADE,
  source_hash varchar(64) NOT NULL,
  generated_hash varchar(64),
  sync_status varchar(16) NOT NULL DEFAULT 'DIRTY'
    CHECK(sync_status IN ('DIRTY','GENERATED','FAILED')),
  last_error text,
  generated_at timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS ix_runtime_generation_dirty
  ON framework_runtime_generation_state(sync_status,updated_at,resource_id);
CREATE INDEX IF NOT EXISTS ix_runtime_resource_lookup
  ON framework_runtime_resource(resource_kind,scope_code,active_yn,resource_key);
CREATE INDEX IF NOT EXISTS ix_runtime_dependency_target
  ON framework_runtime_resource_dependency(target_resource_id);

CREATE OR REPLACE FUNCTION framework_runtime_hash(payload jsonb)
RETURNS varchar LANGUAGE sql IMMUTABLE AS $$
  SELECT (md5(payload::text)||md5('FRAMEWORK_RUNTIME_V1|'||payload::text))::varchar
$$;

CREATE OR REPLACE FUNCTION framework_put_runtime_resource(
  requested_kind varchar, requested_key varchar, requested_scope varchar,
  requested_contract jsonb, requested_active char DEFAULT 'Y',
  requested_actor varchar DEFAULT 'SYSTEM'
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  normalized jsonb := coalesce(requested_contract,'{}'::jsonb);
  next_hash varchar := framework_runtime_hash(normalized);
  resolved_id bigint;
BEGIN
  INSERT INTO framework_runtime_resource(
    resource_kind,resource_key,scope_code,contract_json,contract_hash,active_yn,updated_by)
  VALUES(upper(trim(requested_kind)),trim(requested_key),coalesce(nullif(trim(requested_scope),''),'GLOBAL'),
    normalized,next_hash,coalesce(requested_active,'Y'),coalesce(nullif(requested_actor,''),'SYSTEM'))
  ON CONFLICT(resource_kind,resource_key,scope_code) DO UPDATE SET
    contract_json=excluded.contract_json,contract_hash=excluded.contract_hash,
    active_yn=excluded.active_yn,updated_by=excluded.updated_by,
    revision=CASE WHEN framework_runtime_resource.contract_hash IS DISTINCT FROM excluded.contract_hash
      OR framework_runtime_resource.active_yn IS DISTINCT FROM excluded.active_yn
      THEN framework_runtime_resource.revision+1 ELSE framework_runtime_resource.revision END,
    updated_at=CASE WHEN framework_runtime_resource.contract_hash IS DISTINCT FROM excluded.contract_hash
      OR framework_runtime_resource.active_yn IS DISTINCT FROM excluded.active_yn
      THEN current_timestamp ELSE framework_runtime_resource.updated_at END
  RETURNING resource_id INTO resolved_id;

  INSERT INTO framework_runtime_generation_state(resource_id,source_hash,sync_status)
  VALUES(resolved_id,next_hash,'DIRTY')
  ON CONFLICT(resource_id) DO UPDATE SET source_hash=excluded.source_hash,
    sync_status=CASE WHEN framework_runtime_generation_state.source_hash IS DISTINCT FROM excluded.source_hash
      THEN 'DIRTY' ELSE framework_runtime_generation_state.sync_status END,
    last_error=CASE WHEN framework_runtime_generation_state.source_hash IS DISTINCT FROM excluded.source_hash
      THEN NULL ELSE framework_runtime_generation_state.last_error END,
    updated_at=CASE WHEN framework_runtime_generation_state.source_hash IS DISTINCT FROM excluded.source_hash
      THEN current_timestamp ELSE framework_runtime_generation_state.updated_at END;

  -- A changed dependency invalidates every generated consumer, transitively.
  WITH RECURSIVE impacted(resource_id) AS (
    SELECT source_resource_id FROM framework_runtime_resource_dependency WHERE target_resource_id=resolved_id
    UNION
    SELECT d.source_resource_id FROM framework_runtime_resource_dependency d
      JOIN impacted i ON d.target_resource_id=i.resource_id
  )
  UPDATE framework_runtime_generation_state state SET sync_status='DIRTY',
    last_error=NULL,updated_at=current_timestamp
  WHERE state.resource_id IN (SELECT resource_id FROM impacted);
  RETURN resolved_id;
END $$;

CREATE OR REPLACE FUNCTION framework_sync_runtime_catalog(requested_actor varchar DEFAULT 'SYSTEM')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE changed integer := 0;
BEGIN
  PERFORM framework_put_runtime_resource('ROUTE',lower(split_part(route_path,'?',1)),
    coalesce(domain_code,'GLOBAL'),jsonb_build_object(
      'pageId',page_id,'pageName',page_name,'pageTitle',page_title,
      'pageTitleEn',page_title_en,'routePath',lower(split_part(route_path,'?',1)),
      'menuCode',menu_code,'layoutVersion',layout_version,'designTokenVersion',design_token_version,
      'dataSourceConfig',coalesce(data_source_config,''),'componentSchema',coalesce(component_schema,''),
      'versionStatus',version_status,'versionId',version_id),
    active_yn,requested_actor)
  FROM ui_page_manifest;

  PERFORM framework_put_runtime_resource('ENDPOINT',endpoint_key,'GLOBAL',
    jsonb_build_object('endpointKey',endpoint_key,'method',http_method,
      'routePath',route_path,'implementationRef',implementation_ref),
    active_yn,requested_actor)
  FROM framework_api_endpoint_registry;

  PERFORM framework_put_runtime_resource(
    CASE WHEN upper(asset_type) IN ('THEME','SECTION','COMPONENT','CSS') THEN upper(asset_type) ELSE 'SETTING' END,
    asset_id,coalesce(domain_code,'GLOBAL'),
    jsonb_build_object('assetId',asset_id,'assetType',asset_type,'assetCode',asset_code,
      'assetName',asset_name,'assetPath',asset_path,'description',description,
      'metadata',coalesce(metadata_json,'{}'::jsonb),'sourceSystem',source_system),
    active_yn,requested_actor)
  FROM framework_unified_asset
  WHERE upper(asset_type) IN ('THEME','SECTION','COMPONENT','CSS','CONFIG','SETTING');

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN jsonb_build_object('success',true,'resourceCount',
    (SELECT count(*) FROM framework_runtime_resource WHERE active_yn='Y'),
    'dirtyCount',(SELECT count(*) FROM framework_runtime_generation_state WHERE sync_status='DIRTY'));
END $$;

CREATE OR REPLACE FUNCTION framework_runtime_generation_snapshot(requested_limit integer DEFAULT 5000)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('schemaVersion','1.0.0','generatedAt',current_timestamp,
    'resourceCount',count(*),'resources',coalesce(jsonb_agg(jsonb_build_object(
      'resourceId',r.resource_id,'kind',r.resource_kind,'key',r.resource_key,
      'scope',r.scope_code,'revision',r.revision,'sourceHash',s.source_hash,
      'active',r.active_yn='Y','contract',r.contract_json
    ) ORDER BY r.resource_kind,r.scope_code,r.resource_key),'[]'::jsonb))
  FROM framework_runtime_resource r JOIN framework_runtime_generation_state s USING(resource_id)
  WHERE s.sync_status='DIRTY' AND r.resource_id IN (
    SELECT s2.resource_id FROM framework_runtime_generation_state s2
    JOIN framework_runtime_resource r2 USING(resource_id)
    WHERE s2.sync_status='DIRTY'
    ORDER BY r2.resource_kind,r2.scope_code,r2.resource_key
    LIMIT greatest(1,least(coalesce(requested_limit,5000),10000))
  )
$$;

CREATE OR REPLACE FUNCTION framework_complete_runtime_generation(requested_result jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE completed integer := 0;
BEGIN
  WITH artifacts AS (
    SELECT * FROM jsonb_to_recordset(coalesce(requested_result->'artifacts','[]'::jsonb))
      AS x("resourceId" bigint,"sourceHash" text,status text)
    WHERE status IN ('GENERATED','UNCHANGED')
  ), done AS (
    UPDATE framework_runtime_generation_state state SET generated_hash=a."sourceHash",
      sync_status='GENERATED',last_error=NULL,generated_at=current_timestamp,updated_at=current_timestamp
    FROM artifacts a WHERE state.resource_id=a."resourceId" AND state.source_hash=a."sourceHash"
    RETURNING 1
  ) SELECT count(*) INTO completed FROM done;
  RETURN jsonb_build_object('success',true,'completed',completed);
END $$;

-- Existing management tables remain authoritative; these triggers refresh only
-- the changed resource and therefore avoid a full catalog rebuild.
CREATE OR REPLACE FUNCTION framework_sync_page_runtime_resource()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM framework_put_runtime_resource('ROUTE',lower(split_part(NEW.route_path,'?',1)),
    coalesce(NEW.domain_code,'GLOBAL'),jsonb_build_object(
      'pageId',NEW.page_id,'pageName',NEW.page_name,'pageTitle',NEW.page_title,
      'pageTitleEn',NEW.page_title_en,'routePath',lower(split_part(NEW.route_path,'?',1)),
      'menuCode',NEW.menu_code,'layoutVersion',NEW.layout_version,
      'designTokenVersion',NEW.design_token_version,'dataSourceConfig',coalesce(NEW.data_source_config,''),
      'componentSchema',coalesce(NEW.component_schema,''),'versionStatus',NEW.version_status,
      'versionId',NEW.version_id),NEW.active_yn,'DB_TRIGGER');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_page_runtime_resource ON ui_page_manifest;
CREATE TRIGGER trg_page_runtime_resource AFTER INSERT OR UPDATE ON ui_page_manifest
FOR EACH ROW EXECUTE FUNCTION framework_sync_page_runtime_resource();

CREATE OR REPLACE FUNCTION framework_sync_endpoint_runtime_resource()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM framework_put_runtime_resource('ENDPOINT',NEW.endpoint_key,'GLOBAL',
    jsonb_build_object('endpointKey',NEW.endpoint_key,'method',NEW.http_method,
      'routePath',NEW.route_path,'implementationRef',NEW.implementation_ref),
    NEW.active_yn,'DB_TRIGGER');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_endpoint_runtime_resource ON framework_api_endpoint_registry;
CREATE TRIGGER trg_endpoint_runtime_resource AFTER INSERT OR UPDATE ON framework_api_endpoint_registry
FOR EACH ROW EXECUTE FUNCTION framework_sync_endpoint_runtime_resource();

CREATE OR REPLACE VIEW framework_runtime_generation_status AS
SELECT r.resource_id,r.resource_kind,r.resource_key,r.scope_code,r.revision,r.active_yn,
  s.sync_status,s.source_hash,s.generated_hash,s.last_error,s.generated_at,s.updated_at
FROM framework_runtime_resource r JOIN framework_runtime_generation_state s USING(resource_id);

SELECT framework_sync_runtime_catalog('FLYWAY');
