\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
\ir ../../../apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260728170000__create_integrated_design_document_registry.sql

CREATE TABLE framework_professional_screen_contract(
  contract_id bigint PRIMARY KEY,process_code text NOT NULL,step_code text NOT NULL,
  route_path text NOT NULL,audience text NOT NULL,actor_code text NOT NULL,
  business_purpose text NOT NULL,entry_condition text NOT NULL,exit_condition text NOT NULL,
  kpi_contract text NOT NULL,section_contract text NOT NULL,field_contract text NOT NULL,
  command_contract text NOT NULL,state_contract text NOT NULL,api_contract text NOT NULL,
  data_contract text NOT NULL,evidence_contract text NOT NULL,responsive_contract text NOT NULL,
  accessibility_contract text NOT NULL,security_contract text NOT NULL,permission_codes jsonb NOT NULL,
  api_verified boolean NOT NULL,database_verified boolean NOT NULL,authority_verified boolean NOT NULL,
  responsive_verified boolean NOT NULL,accessibility_verified boolean NOT NULL,
  exception_states_verified boolean NOT NULL,audit_evidence_ref text NOT NULL,updated_by text NOT NULL
);
CREATE TABLE framework_screen_blueprint(
  blueprint_id bigint PRIMARY KEY,process_code text NOT NULL,step_code text NOT NULL,
  audience text NOT NULL,route_path text NOT NULL,actor_code text NOT NULL,
  validation_status text NOT NULL,transition_status text NOT NULL,source_reference text NOT NULL,
  implementation_strategy text NOT NULL,specification_json text NOT NULL
);
CREATE INDEX ix_screen_blueprint_process
  ON framework_screen_blueprint(process_code,step_code,audience);
CREATE TABLE framework_development_job(job_id bigint PRIMARY KEY);
CREATE TABLE framework_process_definition(
  process_code text PRIMARY KEY,domain_code text NOT NULL,owner_actor_code text NOT NULL,
  process_version text NOT NULL
);
CREATE TABLE framework_process_step(
  process_code text NOT NULL,step_code text NOT NULL,step_order integer NOT NULL,
  actor_code text NOT NULL,command_code text NOT NULL,from_state text NOT NULL,to_state text NOT NULL,
  completion_rule text NOT NULL,requires_notification boolean NOT NULL,input_contract text NOT NULL,
  output_contract text NOT NULL,requires_user_page boolean NOT NULL,
  requires_admin_page boolean NOT NULL,user_path text,admin_path text,
  escalation_actor_code text,segregation_actor_codes text NOT NULL DEFAULT '',
  PRIMARY KEY(process_code,step_code)
);
CREATE TABLE framework_step_execution_spec(
  process_code text NOT NULL,step_code text NOT NULL,PRIMARY KEY(process_code,step_code));
CREATE TABLE framework_step_schema_set(
  process_code text NOT NULL,step_code text NOT NULL,PRIMARY KEY(process_code,step_code));
CREATE TABLE framework_permission_requirement_v1(
  process_code text NOT NULL,step_code text NOT NULL,permission_code text NOT NULL,
  scope_type text NOT NULL);
CREATE TABLE framework_permission_grant_v1(
  actor_code text NOT NULL,permission_code text NOT NULL,scope_type text NOT NULL,
  effect text NOT NULL);
CREATE TABLE framework_screen_resource(
  screen_resource_id bigint PRIMARY KEY,route_key text NOT NULL,layout_type text NOT NULL);
CREATE TABLE framework_process_step_screen_binding(
  process_code text NOT NULL,step_code text NOT NULL,screen_resource_id bigint NOT NULL,
  actor_code text NOT NULL,audience text NOT NULL,binding_status text NOT NULL);
CREATE TABLE comtnthemedefinition(
  theme_id text PRIMARY KEY,theme_nm text,theme_dc text,theme_type text,
  color_config text,typography_config text,spacing_config text,border_config text,
  shadow_config text,class_prefix text,is_default boolean,use_at char(1),is_active char(1));
CREATE TABLE ui_section_registry(
  section_id text PRIMARY KEY,section_name text,section_type text,layout_contract text,
  responsive_contract text,accessibility_contract text,design_reference text,
  asset_fingerprint text,active_yn char(1));
CREATE TABLE ui_component_registry(
  component_id text PRIMARY KEY,component_name text,component_type text NOT NULL,
  owner_domain text,props_schema_json text,design_reference text,default_props text,
  category text,asset_fingerprint text,active_yn char(1));
CREATE TABLE framework_process_execution(execution_id uuid PRIMARY KEY);
CREATE TABLE framework_process_execution_event(event_id bigint PRIMARY KEY);
CREATE TABLE framework_actor_definition(actor_code text PRIMARY KEY,use_at char(1) NOT NULL);
CREATE TABLE framework_account_actor_assignment(
  assignment_id bigint PRIMARY KEY,tenant_id text NOT NULL,project_id text NOT NULL,
  account_id text NOT NULL,actor_code text NOT NULL,assignment_status text NOT NULL,
  valid_from date,valid_until date);
CREATE TABLE framework_project_actor_assignment(
  project_id text NOT NULL,actor_code text NOT NULL,user_id text NOT NULL,active_yn char(1) NOT NULL);
CREATE TABLE comtnemplyrinfo(
  emplyr_id text PRIMARY KEY,esntl_id text NOT NULL,emplyr_sttus_code text NOT NULL);
CREATE TABLE comtnentrprsmber(
  entrprs_mber_id text PRIMARY KEY,esntl_id text NOT NULL,entrprs_mber_sttus text NOT NULL);
CREATE TABLE comtnemplyrscrtyestbs(scrty_dtrmn_trget_id text NOT NULL,author_code text NOT NULL);

CREATE TABLE framework_project_runtime_purge_receipt(
  process_code text NOT NULL,project_id text,receipt_status text NOT NULL);
CREATE TABLE framework_postdeploy_release_attempt(
  candidate_id text NOT NULL,source_commit text NOT NULL,
  UNIQUE(candidate_id,source_commit));
CREATE TABLE test_write_fence_invocation(
  invocation_id bigserial PRIMARY KEY,table_name text NOT NULL,operation text NOT NULL);

CREATE OR REPLACE FUNCTION framework_try_jsonb(source text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN source::jsonb; EXCEPTION WHEN others THEN RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN source::jsonb; EXCEPTION WHEN others THEN RETURN fallback; END $$;

CREATE OR REPLACE FUNCTION framework_guard_project_runtime_write_fence()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO test_write_fence_invocation(table_name,operation)
  VALUES(TG_TABLE_NAME,TG_OP);
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION framework_install_project_runtime_write_fences()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE table_row record; installed integer:=0;
BEGIN
  FOR table_row IN
    SELECT relation.oid,namespace.nspname,relation.relname
      FROM pg_class relation JOIN pg_namespace namespace
        ON namespace.oid=relation.relnamespace
     WHERE namespace.nspname=current_schema()
       AND relation.relkind IN('r','p') AND NOT relation.relispartition
       AND relation.relname LIKE 'integrated_design\_%' ESCAPE '\'
       AND EXISTS(SELECT 1 FROM pg_attribute attribute
          WHERE attribute.attrelid=relation.oid
            AND attribute.attname IN('project_id','process_code')
            AND attribute.attnum>0 AND NOT attribute.attisdropped)
     ORDER BY relation.relname COLLATE "C",relation.oid
  LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger trigger_row
       WHERE trigger_row.tgrelid=table_row.oid
         AND trigger_row.tgname='trg_project_runtime_write_fence'
         AND NOT trigger_row.tgisinternal) THEN
      EXECUTE format('create trigger trg_project_runtime_write_fence '
        'before insert or update on %I.%I for each row '
        'execute function framework_guard_project_runtime_write_fence()',
        table_row.nspname,table_row.relname);
      installed:=installed+1;
    END IF;
  END LOOP;
  RETURN installed;
END $$;

CREATE OR REPLACE FUNCTION test_unrelated_document_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER trg_test_unrelated_document
BEFORE UPDATE ON integrated_design_document
FOR EACH ROW EXECUTE FUNCTION test_unrelated_document_trigger();

CREATE OR REPLACE FUNCTION test_operational_payload(
  seed text,requested_bytes integer,entropy_bytes integer)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT left(string_agg(md5(seed||':'||chunk),'' ORDER BY chunk),entropy_bytes)||
         repeat('A',greatest(requested_bytes-entropy_bytes,0))
    FROM generate_series(1,(entropy_bytes+31)/32) chunk
$$;

CREATE OR REPLACE FUNCTION test_operational_process_code(process_index integer)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT CASE WHEN process_index=1 THEN 'PROC'
              ELSE 'PROC_'||lpad(process_index::text,3,'0') END
$$;

-- Production has 144 target processes.  Of those, 136 own the 968 canonical
-- contexts and eight are target-only processes without a selected contract.
-- Persist the deterministic distribution so every fixture relation uses the
-- same process/step/route identity.
CREATE TABLE test_operational_context(
  context_id integer PRIMARY KEY,process_index integer NOT NULL,
  process_code text NOT NULL,local_context integer NOT NULL,
  step_code text NOT NULL,route_path text NOT NULL);
INSERT INTO test_operational_context
WITH assigned AS (
  SELECT context_id,((context_id-1)%:context_process_count)+1 process_index
    FROM generate_series(1,:context_count) context_id
), numbered AS (
  SELECT context_id,process_index,row_number() OVER(
           PARTITION BY process_index ORDER BY context_id)::integer local_context
    FROM assigned
)
SELECT context_id,process_index,test_operational_process_code(process_index),local_context,
       'STEP'||lpad(local_context::text,4,'0'),
       '/work/'||lower(test_operational_process_code(process_index))||'/'||
         lpad(local_context::text,4,'0')
  FROM numbered;

INSERT INTO framework_process_definition
SELECT test_operational_process_code(value),'WORK','ACTOR','1.0.0'
  FROM generate_series(1,:target_process_count) value;
INSERT INTO comtnthemedefinition(theme_id,use_at,is_active)
VALUES('KRDS_GOV_DEFAULT','Y','Y');
INSERT INTO ui_section_registry(section_id,active_yn) VALUES('MAIN','Y');
INSERT INTO ui_component_registry(component_id,component_type,active_yn)
VALUES('JSON_FORM','JSON_FORM','Y');

INSERT INTO framework_process_step
SELECT process_code,step_code,local_context,'ACTOR','SAVE','DRAFT','DONE',
       'record saved',false,'{"name":"string"}','{"id":"integer"}',true,false,
       route_path,NULL,NULL,''
  FROM test_operational_context;
INSERT INTO framework_process_step
SELECT test_operational_process_code(value),'TARGET_ONLY',1,'ACTOR','SAVE','DRAFT','DONE',
       'target only',false,'{}','{}',true,false,
       '/target-only/'||lower(test_operational_process_code(value)),NULL,NULL,''
  FROM generate_series(:context_process_count+1,:target_process_count) value;
INSERT INTO framework_screen_resource
SELECT context_id,route_path,'KRDS_WORKSPACE' FROM test_operational_context;
INSERT INTO framework_professional_screen_contract
SELECT context_id,process_code,step_code,route_path,'USER','ACTOR',
       'Complete governed work','A valid draft exists','The record is returned',
       '[{"kpiCode":"DONE","description":"Completed"}]',
       '[{"sectionId":"MAIN","componentCodes":["JSON_FORM"]}]',
       '[{"fieldCode":"name","direction":"INPUT","dataSource":"ITEM"},'
         '{"fieldCode":"id","direction":"OUTPUT","dataSource":"ITEM"}]',
       '[{"commandCode":"SAVE","actorCode":"ACTOR","primary":true}]',
       '[{"fromState":"DRAFT","commandCode":"SAVE","toState":"DONE"}]',
       '[{"method":"POST","path":"/api/items","commandCode":"SAVE",'
         '"requestFields":["name"],"responseFields":["id"],'
         '"permissionCodes":["PERM_SAVE"]}]',
       '[{"entity":"ITEM","fields":["name","id"]}]',
       '[{"evidenceType":"E2E","reference":"evidence://save"}]',
       '360 768 1280','KRDS WCAG AA','server actor scope','["PERM_SAVE"]'::jsonb,
       true,true,true,true,true,true,'audit://save','LIVE_CONTRACT_BACKFILL'
  FROM test_operational_context;

-- Match the selected production contract material exactly.  Padding one plain
-- text field changes to_jsonb(contract)::text by one byte per ASCII byte and
-- leaves every executable JSON contract unchanged.
WITH measured AS MATERIALIZED (
  SELECT contract.contract_id,
         (:contract_payload_total/:context_count)+CASE WHEN row_number() OVER(
           ORDER BY contract.contract_id)<=(:contract_payload_total%:context_count)
           THEN 1 ELSE 0 END target_bytes,
         octet_length(to_jsonb(contract)::text) current_bytes
    FROM framework_professional_screen_contract contract
)
UPDATE framework_professional_screen_contract contract
   SET business_purpose=contract.business_purpose||
       repeat('P',greatest(measured.target_bytes-measured.current_bytes,0)::integer)
  FROM measured WHERE measured.contract_id=contract.contract_id;
CREATE TEMP TABLE test_contract_payload_assertion(
  actual_bytes bigint CHECK(actual_bytes=:contract_payload_total));
INSERT INTO test_contract_payload_assertion
SELECT sum(octet_length(to_jsonb(contract)::text))
  FROM framework_professional_screen_contract contract;

INSERT INTO framework_screen_blueprint
SELECT context_id,process_code,step_code,'USER',route_path,
       'ACTOR','VALID','GENERATED','',
       'GENERATED_RUNTIME',
       jsonb_build_object('layout','KRDS_WORKSPACE','theme','KRDS_GOV_DEFAULT',
         'assetBindings',jsonb_build_array(
           jsonb_build_object('assetType','THEME','assetCode','KRDS_GOV_DEFAULT'),
           jsonb_build_object('assetType','SECTION','assetCode','MAIN'),
           jsonb_build_object('assetType','COMPONENT','assetCode','JSON_FORM')),
         'fixturePadding','')::text
  FROM test_operational_context;
WITH measured AS MATERIALIZED (
  SELECT blueprint.blueprint_id,
         (:blueprint_spec_total/:context_count)+CASE WHEN row_number() OVER(
           ORDER BY blueprint.blueprint_id)<=(:blueprint_spec_total%:context_count)
           THEN 1 ELSE 0 END target_bytes,
         octet_length(blueprint.specification_json) current_bytes
    FROM framework_screen_blueprint blueprint
)
UPDATE framework_screen_blueprint blueprint
   SET specification_json=jsonb_set(blueprint.specification_json::jsonb,
       '{fixturePadding}',to_jsonb(repeat('B',greatest(
         measured.target_bytes-measured.current_bytes,0)::integer)))::text
  FROM measured WHERE measured.blueprint_id=blueprint.blueprint_id;
CREATE TEMP TABLE test_blueprint_spec_assertion(
  actual_bytes bigint CHECK(actual_bytes=:blueprint_spec_total));
INSERT INTO test_blueprint_spec_assertion
SELECT sum(octet_length(specification_json)) FROM framework_screen_blueprint;

WITH document_types(document_type) AS (
  VALUES ('REQUIREMENT'),('ACTOR_RACI'),('AUTHORITY'),('PROCESS'),('STATE'),
    ('NAVIGATION'),('ACTIVE_UI'),('DESIGN_ASSET'),('FIELD_DICTIONARY'),
    ('DATA_HANDOFF'),('DATABASE'),('API'),('BUSINESS_RULE'),('VALIDATION'),
    ('NOTIFICATION'),('TEST'),('TASK_EVIDENCE'),('RELEASE_AUDIT')
)
INSERT INTO integrated_design_document(
  process_code,step_code,route_path,document_type,title,content,status,updated_by)
SELECT context.process_code,context.step_code,context.route_path,
       document_type,document_type,
       jsonb_build_object('legacy',test_operational_payload(
         context.context_id::text||':'||document_type,
         :legacy_bytes,:legacy_entropy_bytes))::text,
       'IN_REVIEW','LIVE_CONTRACT_BACKFILL'
  FROM test_operational_context context CROSS JOIN document_types;

-- Production has 18,702 target-matched legacy heads for 968 canonical
-- contexts (17,424 generated axes).  Model the 1,278 additional historical
-- document types without changing the canonical 18-axis projection.
WITH supplemental AS (
  SELECT value,((value-1)%:context_count)+1 context_id,
         ((value-1)/:context_count)+1 type_ordinal
    FROM generate_series(1,greatest(
      :legacy_document_count-(:context_count*18),0)) value
)
INSERT INTO integrated_design_document(
  process_code,step_code,route_path,document_type,title,content,status,updated_by)
SELECT context.process_code,context.step_code,context.route_path,
       'LEGACY_SUPPLEMENT_'||type_ordinal,'LEGACY_SUPPLEMENT_'||type_ordinal,
       jsonb_build_object('legacy',test_operational_payload(
         'supplement:'||value,:legacy_bytes,:legacy_entropy_bytes))::text,
       'IN_REVIEW','LIVE_CONTRACT_BACKFILL'
  FROM supplemental JOIN test_operational_context context USING(context_id);

SELECT framework_install_project_runtime_write_fences();
TRUNCATE test_write_fence_invocation;
