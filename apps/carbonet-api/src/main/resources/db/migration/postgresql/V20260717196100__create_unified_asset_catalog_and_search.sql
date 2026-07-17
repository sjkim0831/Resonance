CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS framework_unified_asset (
  asset_id varchar(180) PRIMARY KEY,
  asset_type varchar(40) NOT NULL,
  asset_code varchar(180) NOT NULL,
  asset_name varchar(300) NOT NULL,
  asset_path varchar(600),
  domain_code varchar(80),
  description text NOT NULL DEFAULT '',
  search_document text NOT NULL DEFAULT '',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_system varchar(40) NOT NULL,
  content_hash varchar(64),
  active_yn char(1) NOT NULL DEFAULT 'Y',
  first_seen_at timestamp NOT NULL DEFAULT current_timestamp,
  last_seen_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(asset_type,asset_code)
);

ALTER TABLE framework_unified_asset
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple',coalesce(search_document,''))) STORED;

CREATE TABLE IF NOT EXISTS framework_unified_asset_relation (
  source_asset_id varchar(180) NOT NULL REFERENCES framework_unified_asset(asset_id) ON DELETE CASCADE,
  relation_type varchar(50) NOT NULL,
  target_asset_id varchar(180) NOT NULL REFERENCES framework_unified_asset(asset_id) ON DELETE CASCADE,
  evidence_text text NOT NULL DEFAULT '',
  active_yn char(1) NOT NULL DEFAULT 'Y',
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(source_asset_id,relation_type,target_asset_id)
);

CREATE TABLE IF NOT EXISTS framework_asset_catalog_sync_run (
  sync_run_id bigserial PRIMARY KEY,
  sync_scope varchar(40) NOT NULL,
  discovered_count integer NOT NULL,
  relation_count integer NOT NULL,
  changed_count integer NOT NULL,
  duration_ms bigint NOT NULL,
  result varchar(20) NOT NULL,
  executed_by varchar(100) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_unified_asset_type_active ON framework_unified_asset(asset_type,active_yn);
CREATE INDEX IF NOT EXISTS idx_unified_asset_path ON framework_unified_asset(asset_path) WHERE active_yn='Y';
CREATE INDEX IF NOT EXISTS idx_unified_asset_search_vector ON framework_unified_asset USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_unified_asset_name_trgm ON framework_unified_asset USING gin(asset_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_unified_asset_path_trgm ON framework_unified_asset USING gin(asset_path gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_unified_relation_target ON framework_unified_asset_relation(target_asset_id,relation_type) WHERE active_yn='Y';

CREATE OR REPLACE FUNCTION framework_refresh_unified_asset_catalog(p_actor varchar DEFAULT 'SYSTEM')
RETURNS TABLE(discovered_count integer,relation_count integer,changed_count integer) LANGUAGE plpgsql AS $$
DECLARE started_at timestamptz:=clock_timestamp(); before_count integer; after_count integer; rel_count integer;
BEGIN
  SELECT count(*) INTO before_count FROM framework_unified_asset WHERE active_yn='Y';

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,asset_path,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'MENU:'||menu_code,'MENU',menu_code,coalesce(menu_nm,menu_code),menu_url,
         CASE WHEN menu_code LIKE 'A%' THEN 'ADMIN' ELSE 'USER' END,coalesce(menu_nm_en,''),
         concat_ws(' ',menu_code,menu_nm,menu_nm_en,menu_url,menu_icon),
         jsonb_build_object('icon',menu_icon,'visible',expsr_at,'enabled',use_at),'MENU_DB',md5(concat_ws('|',menu_nm,menu_nm_en,menu_url,menu_icon,use_at,expsr_at))
  FROM comtnmenuinfo WHERE use_at='Y'
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,asset_path=excluded.asset_path,domain_code=excluded.domain_code,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,asset_path,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'PAGE:'||page_id,'PAGE',page_id,coalesce(page_title,page_name,page_id),route_path,domain_code,coalesce(page_title_en,''),
         concat_ws(' ',page_id,page_name,page_title,page_title_en,route_path,domain_code,component_schema),
         jsonb_build_object('status',version_status,'theme',design_token_version),'PAGE_DB',md5(concat_ws('|',page_name,route_path,component_schema,version_status))
  FROM ui_page_manifest WHERE active_yn='Y'
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,asset_path=excluded.asset_path,domain_code=excluded.domain_code,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'COMPONENT:'||component_id,'COMPONENT',component_id,component_name,owner_domain,component_type,
         concat_ws(' ',component_id,component_name,component_type,owner_domain,props_schema_json,design_reference),
         jsonb_build_object('type',component_type,'designReference',design_reference,'propsSchema',props_schema_json),'DESIGN_DB',coalesce(asset_fingerprint,md5(concat_ws('|',component_type,component_name,props_schema_json)))
  FROM ui_component_registry WHERE active_yn='Y'
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,domain_code=excluded.domain_code,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'SECTION:'||section_id,'SECTION',section_id,section_name,section_type,
         concat_ws(' ',section_id,section_name,section_type,layout_contract,responsive_contract,accessibility_contract),
         jsonb_build_object('layout',layout_contract,'responsive',responsive_contract,'accessibility',accessibility_contract),'DESIGN_DB',coalesce(asset_fingerprint,md5(concat_ws('|',section_name,layout_contract)))
  FROM ui_section_registry WHERE active_yn='Y'
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'PROPERTY:'||property_id,'PROPERTY',property_id,property_name,data_type,
         concat_ws(' ',property_id,property_name,data_type,schema_json::text),schema_json,'DESIGN_DB',asset_fingerprint
  FROM ui_common_property_registry WHERE active_yn='Y'
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'ACTOR:'||actor_code,'ACTOR',actor_code,actor_name,actor_type,purpose,
         concat_ws(' ',actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes),jsonb_build_object('capabilities',capability_codes),'PROCESS_DB',md5(concat_ws('|',actor_name,actor_type,purpose,capability_codes))
  FROM framework_actor_definition WHERE use_at='Y'
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,domain_code=excluded.domain_code,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'PROCESS:'||process_code,'PROCESS',process_code,process_name,domain_code,goal,
         concat_ws(' ',process_code,process_name,domain_code,goal,start_condition,completion_condition),jsonb_build_object('status',process_status,'version',process_version),'PROCESS_DB',md5(concat_ws('|',process_name,goal,start_condition,completion_condition,process_version))
  FROM framework_process_definition
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,domain_code=excluded.domain_code,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'TEST:'||case_code,'TEST',case_code,case_name,p.domain_code,preconditions,
         concat_ws(' ',c.case_code,c.case_name,c.case_type,c.preconditions,c.steps_json,c.assertions_json),jsonb_build_object('processCode',c.process_code,'status',c.case_status,'type',c.case_type),'TEST_DB',md5(concat_ws('|',c.case_name,c.preconditions,c.steps_json,c.assertions_json))
  FROM framework_simulation_case c JOIN framework_process_definition p ON p.process_code=c.process_code
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,domain_code=excluded.domain_code,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,asset_path,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'API:'||process_code||':'||step_code,'API',process_code||':'||step_code,step_name,api_contract,p.domain_code,requirement_text,
         concat_ws(' ',process_code,step_code,step_name,command_code,api_contract,input_contract,output_contract),jsonb_build_object('processCode',s.process_code,'stepCode',s.step_code,'actorCode',actor_code),'PROCESS_DB',md5(concat_ws('|',api_contract,input_contract,output_contract))
  FROM framework_process_step s JOIN framework_process_definition p USING(process_code) WHERE requires_api=true AND nullif(api_contract,'') IS NOT NULL
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,asset_path=excluded.asset_path,domain_code=excluded.domain_code,description=excluded.description,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,asset_path,domain_code,description,search_document,metadata_json,source_system,content_hash)
  SELECT 'DB_TABLE:'||table_schema||'.'||table_name,'DB_TABLE',table_schema||'.'||table_name,table_name,null,null,'Database table',concat_ws(' ',table_schema,table_name),'{}','POSTGRES',md5(table_schema||'.'||table_name)
  FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'
  ON CONFLICT(asset_id) DO UPDATE SET asset_name=excluded.asset_name,search_document=excluded.search_document,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

  INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
  SELECT 'MENU:'||m.menu_code,'ROUTES_TO','PAGE:'||p.page_id,m.menu_url FROM comtnmenuinfo m JOIN ui_page_manifest p ON lower(split_part(m.menu_url,'?',1))=lower(split_part(p.route_path,'?',1)) WHERE m.use_at='Y' AND p.active_yn='Y'
  ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;
  INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
  SELECT 'PAGE:'||m.page_id,'USES_COMPONENT','COMPONENT:'||m.component_id,min(m.layout_zone) FROM ui_page_component_map m JOIN ui_page_manifest p ON p.page_id=m.page_id JOIN ui_component_registry c ON c.component_id=m.component_id WHERE p.active_yn='Y' AND c.active_yn='Y' GROUP BY m.page_id,m.component_id
  ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;
  INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
  SELECT 'COMPONENT:'||component_id,'USES_PROPERTY','PROPERTY:'||property_id,'property schema' FROM ui_component_property_map
  ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET active_yn='Y',updated_at=current_timestamp;
  INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
  SELECT 'PROCESS:'||process_code,'PERFORMED_BY','ACTOR:'||actor_code,string_agg(step_code,',' ORDER BY step_order) FROM framework_process_step GROUP BY process_code,actor_code
  ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;
  INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
  SELECT 'PROCESS:'||process_code,'VERIFIED_BY','TEST:'||case_code,case_type FROM framework_simulation_case
  ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;
  INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
  SELECT 'PROCESS:'||s.process_code,'IMPLEMENTS_API','API:'||s.process_code||':'||s.step_code,s.api_contract FROM framework_process_step s WHERE s.requires_api=true AND nullif(s.api_contract,'') IS NOT NULL
  ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;

  SELECT count(*) INTO after_count FROM framework_unified_asset WHERE active_yn='Y';
  SELECT count(*) INTO rel_count FROM framework_unified_asset_relation WHERE active_yn='Y';
  INSERT INTO framework_asset_catalog_sync_run(sync_scope,discovered_count,relation_count,changed_count,duration_ms,result,executed_by)
  VALUES('DB_ASSETS',after_count,rel_count,greatest(after_count-before_count,0),(extract(epoch from clock_timestamp()-started_at)*1000)::bigint,'COMPLETED',p_actor);
  RETURN QUERY SELECT after_count,rel_count,greatest(after_count-before_count,0);
END $$;

SELECT * FROM framework_refresh_unified_asset_catalog('FLYWAY');
