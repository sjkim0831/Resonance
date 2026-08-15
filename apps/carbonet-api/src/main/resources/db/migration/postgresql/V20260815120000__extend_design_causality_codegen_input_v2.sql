-- Milestone 1.1: bind the inputs consumed by full-stack generation into the
-- immutable global design-causality root. Existing v1 heads/events remain
-- byte-for-byte valid; the post-commit compiler emits the first v2 event from
-- the single bit-63 (all v2 leaf summaries + codegen input) dirty signal
-- appended at the end of this transaction.

DO $$
DECLARE
  object_name text;
  object_owner name;
  missing_contract text;
BEGIN
  IF current_user='carbonet_app' THEN
    RAISE EXCEPTION 'codegen-input causality migration must run as object owner'
      USING ERRCODE='42501';
  END IF;
  FOREACH object_name IN ARRAY ARRAY[
    'framework_design_change_signal','framework_design_causality_head',
    'framework_design_causality_event','framework_process_definition',
    'framework_process_step','framework_actor_definition',
    'framework_account_actor_assignment','framework_screen_blueprint',
    'framework_professional_screen_contract','framework_step_execution_spec',
    'framework_permission_requirement_v1','framework_permission_grant_v1',
    'framework_permission_mapping_control_v1',
    'framework_page_design','framework_page_field_definition','comtnmenufunctioninfo',
    'comtnauthorfunctionrelate','comtnuserfeatureoverride','comtnemplyrscrtyestbs',
    'framework_canonical_endpoint_upgrade_activation_event'
  ] LOOP
    SELECT pg_get_userbyid(c.relowner) INTO object_owner
      FROM pg_class c WHERE c.oid=to_regclass('public.'||object_name);
    IF object_owner IS NULL OR object_owner<>current_user THEN
      RAISE EXCEPTION 'migration role % does not own public.% (owner=%)',
        current_user,object_name,coalesce(object_owner::text,'MISSING')
        USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF to_regprocedure('public.framework_screen_blueprint_export(integer)') IS NULL
     OR to_regprocedure('public.framework_strict_jsonb_array(text)') IS NULL
     OR to_regprocedure('public.framework_try_jsonb(text,jsonb)') IS NULL
     OR to_regprocedure(
       'public.framework_canonical_endpoint_effective_binding(character varying)'
     ) IS NULL THEN
    RAISE EXCEPTION 'codegen-input source function preflight failed'
      USING ERRCODE='55000';
  END IF;

  WITH expected(table_name,column_name,udt_name) AS (VALUES
    ('framework_screen_blueprint','blueprint_id','int8'),
    ('framework_screen_blueprint','blueprint_code','varchar'),
    ('framework_screen_blueprint','process_code','varchar'),
    ('framework_screen_blueprint','step_code','varchar'),
    ('framework_screen_blueprint','actor_code','varchar'),
    ('framework_screen_blueprint','audience','varchar'),
    ('framework_screen_blueprint','page_id','varchar'),
    ('framework_screen_blueprint','page_name','varchar'),
    ('framework_screen_blueprint','route_path','varchar'),
    ('framework_screen_blueprint','screen_type','varchar'),
    ('framework_screen_blueprint','template_code','varchar'),
    ('framework_screen_blueprint','specification_json','text'),
    ('framework_screen_blueprint','traceability_json','text'),
    ('framework_screen_blueprint','validation_status','varchar'),
    ('framework_screen_blueprint','implementation_strategy','varchar'),
    ('framework_professional_screen_contract','contract_id','int8'),
    ('framework_professional_screen_contract','process_code','varchar'),
    ('framework_professional_screen_contract','step_code','varchar'),
    ('framework_professional_screen_contract','audience','varchar'),
    ('framework_professional_screen_contract','route_path','varchar'),
    ('framework_professional_screen_contract','screen_name','varchar'),
    ('framework_professional_screen_contract','actor_code','varchar'),
    ('framework_professional_screen_contract','permission_codes','jsonb'),
    ('framework_professional_screen_contract','contract_status','varchar'),
    ('framework_professional_screen_contract','business_purpose','text'),
    ('framework_professional_screen_contract','entry_condition','text'),
    ('framework_professional_screen_contract','exit_condition','text'),
    ('framework_professional_screen_contract','kpi_contract','text'),
    ('framework_professional_screen_contract','section_contract','text'),
    ('framework_professional_screen_contract','field_contract','text'),
    ('framework_professional_screen_contract','command_contract','text'),
    ('framework_professional_screen_contract','state_contract','text'),
    ('framework_professional_screen_contract','api_contract','text'),
    ('framework_professional_screen_contract','data_contract','text'),
    ('framework_professional_screen_contract','evidence_contract','text'),
    ('framework_professional_screen_contract','responsive_contract','text'),
    ('framework_professional_screen_contract','accessibility_contract','text'),
    ('framework_professional_screen_contract','security_contract','text'),
    ('framework_professional_screen_contract','api_verified','bool'),
    ('framework_professional_screen_contract','database_verified','bool'),
    ('framework_professional_screen_contract','authority_verified','bool'),
    ('framework_professional_screen_contract','responsive_verified','bool'),
    ('framework_professional_screen_contract','accessibility_verified','bool'),
    ('framework_professional_screen_contract','exception_states_verified','bool'),
    ('framework_professional_screen_contract','audit_evidence_ref','text'),
    ('framework_step_execution_spec','process_code','varchar'),
    ('framework_step_execution_spec','step_code','varchar'),
    ('framework_step_execution_spec','spec_version','int4'),
    ('framework_step_execution_spec','actor_contract','jsonb'),
    ('framework_step_execution_spec','business_contract','jsonb'),
    ('framework_step_execution_spec','transition_contract','jsonb'),
    ('framework_step_execution_spec','input_contract','jsonb'),
    ('framework_step_execution_spec','output_contract','jsonb'),
    ('framework_step_execution_spec','screen_contract','jsonb'),
    ('framework_step_execution_spec','field_contract','jsonb'),
    ('framework_step_execution_spec','command_contract','jsonb'),
    ('framework_step_execution_spec','api_contract','jsonb'),
    ('framework_step_execution_spec','persistence_contract','jsonb'),
    ('framework_step_execution_spec','handoff_contract','jsonb'),
    ('framework_step_execution_spec','test_contract','jsonb'),
    ('framework_step_execution_spec','guide_contract','jsonb'),
    ('framework_step_execution_spec','nonfunctional_contract','jsonb'),
    ('framework_step_execution_spec','design_status','varchar'),
    ('framework_step_execution_spec','approval_status','varchar'),
    ('framework_step_execution_spec','blocker_codes','jsonb'),
    ('framework_step_execution_spec','source_hash','varchar')
    ,('framework_permission_requirement_v1','process_code','varchar')
    ,('framework_permission_requirement_v1','step_code','varchar')
    ,('framework_permission_requirement_v1','permission_code','varchar')
    ,('framework_permission_requirement_v1','scope_type','varchar')
    ,('framework_permission_requirement_v1','resource_contract','jsonb')
    ,('framework_permission_requirement_v1','guard_contract','jsonb')
    ,('framework_permission_requirement_v1','use_at','bpchar')
    ,('framework_permission_mapping_control_v1','control_id','int2')
    ,('framework_permission_mapping_control_v1','requirement_mapping_complete','bool')
    ,('framework_permission_mapping_control_v1','mapping_note','text')
    ,('framework_page_design','page_design_id','int8')
    ,('framework_page_design','process_code','varchar')
    ,('framework_page_design','step_code','varchar')
    ,('framework_page_design','audience','varchar')
    ,('framework_page_design','page_code','varchar')
    ,('framework_page_design','planned_route_path','varchar')
    ,('framework_page_design','actual_route_path','varchar')
    ,('framework_page_design','actor_code','varchar')
    ,('framework_page_design','security_contract','jsonb')
    ,('framework_page_design','design_status','varchar')
    ,('framework_page_field_definition','page_field_id','int8')
    ,('framework_page_field_definition','page_design_id','int8')
    ,('framework_page_field_definition','field_order','int4')
    ,('framework_page_field_definition','field_code','varchar')
    ,('framework_page_field_definition','api_property','varchar')
    ,('framework_page_field_definition','permission_code','varchar')
    ,('framework_page_field_definition','privacy_class','varchar')
    ,('framework_page_field_definition','validation_contract','jsonb')
    ,('framework_page_field_definition','required','bool')
    ,('framework_page_field_definition','editable','bool')
    ,('framework_page_field_definition','mapping_status','varchar')
    ,('comtnmenufunctioninfo','feature_code','varchar')
    ,('comtnmenufunctioninfo','menu_code','varchar')
    ,('comtnmenufunctioninfo','feature_nm','varchar')
    ,('comtnmenufunctioninfo','feature_nm_en','varchar')
    ,('comtnmenufunctioninfo','feature_dc','varchar')
    ,('comtnmenufunctioninfo','use_at','bpchar')
    ,('framework_canonical_endpoint_upgrade_activation_event','scope_process','varchar')
  ), missing AS (
    SELECT string_agg(e.table_name||'.'||e.column_name||':'||e.udt_name,
                      ',' ORDER BY e.table_name COLLATE "C",e.column_name COLLATE "C") value
      FROM expected e
      LEFT JOIN information_schema.columns c
        ON c.table_schema='public' AND c.table_name=e.table_name
       AND c.column_name=e.column_name AND c.udt_name=e.udt_name
     WHERE c.column_name IS NULL
  ) SELECT value INTO missing_contract FROM missing;
  IF missing_contract IS NOT NULL THEN
    RAISE EXCEPTION 'codegen-input source column preflight failed: %',missing_contract
      USING ERRCODE='55000';
  END IF;
  IF NOT EXISTS(
       SELECT 1 FROM pg_index i
       JOIN pg_attribute a ON a.attrelid=i.indrelid
        AND a.attnum=ANY(i.indkey::smallint[])
       WHERE i.indrelid='public.comtnmenufunctioninfo'::regclass
         AND i.indisunique AND i.indnkeyatts=1 AND a.attname='feature_code'
     ) THEN
    RAISE EXCEPTION 'comtnmenufunctioninfo.feature_code must be uniquely indexed'
      USING ERRCODE='55000';
  END IF;
END
$$;

-- Flyway runs PostgreSQL migrations transactionally. These locks close the
-- source-commit window through trigger installation and the bit-63 seed.
-- Serialize first with the already-installed M2 compiler so an old worker
-- cannot advance the v1 head between the compatibility snapshot and ALTERs.
SELECT pg_advisory_xact_lock(1128354388,1380271955);
LOCK TABLE framework_screen_blueprint,framework_professional_screen_contract,
  framework_step_execution_spec,framework_permission_requirement_v1,
  framework_permission_mapping_control_v1,framework_page_design,
  framework_page_field_definition,comtnmenufunctioninfo,
  framework_process_definition,framework_process_step,
  framework_actor_definition,framework_account_actor_assignment,
  framework_permission_grant_v1,comtnauthorfunctionrelate,
  comtnuserfeatureoverride,comtnemplyrscrtyestbs
  IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE framework_design_causality_v1_install_guard
ON COMMIT DROP AS
SELECT to_jsonb(h) head_row,
       (SELECT count(*) FROM public.framework_design_causality_event) event_count,
       (SELECT coalesce(public.framework_design_causality_sha256(
         jsonb_agg(to_jsonb(e) ORDER BY e.event_id)
       ),repeat('0',64)) FROM public.framework_design_causality_event e) event_set_hash
  FROM public.framework_design_causality_head h WHERE h.scope_key='GLOBAL';

ALTER TABLE framework_design_change_signal
  DROP CONSTRAINT framework_design_change_signal_change_mask_check,
  ADD CONSTRAINT framework_design_change_signal_change_mask_check
    CHECK(change_mask BETWEEN 1 AND 63);
ALTER TABLE framework_design_causality_head
  DROP CONSTRAINT framework_design_causality_head_canonical_schema_version_check,
  ADD COLUMN codegen_input_hash varchar(64),
  ADD CONSTRAINT framework_design_causality_head_canonical_schema_version_check
    CHECK(canonical_schema_version IN (1,2)),
  ADD CONSTRAINT framework_design_causality_head_codegen_input_hash_check CHECK(
    (canonical_schema_version=1 AND codegen_input_hash IS NULL) OR
    (canonical_schema_version=2 AND codegen_input_hash ~ '^[0-9a-f]{64}$')
  );
ALTER TABLE framework_design_causality_event
  DROP CONSTRAINT framework_design_causality_event_canonical_schema_version_check,
  DROP CONSTRAINT framework_design_causality_event_change_mask_check,
  DROP CONSTRAINT framework_design_causality_event_check,
  ADD COLUMN codegen_input_hash varchar(64),
  ADD CONSTRAINT framework_design_causality_event_canonical_schema_version_check
    CHECK(canonical_schema_version IN (1,2)),
  ADD CONSTRAINT framework_design_causality_event_change_mask_check
    CHECK(change_mask BETWEEN 1 AND 63),
  ADD CONSTRAINT framework_design_causality_event_codegen_input_hash_check CHECK(
    (canonical_schema_version=1 AND codegen_input_hash IS NULL) OR
    (canonical_schema_version=2 AND codegen_input_hash ~ '^[0-9a-f]{64}$')
  );

-- Remaining v2 component/compiler/trigger/API definitions are deliberately
-- installed below this compatibility boundary in the same Flyway transaction.

CREATE OR REPLACE FUNCTION framework_design_causality_event_hash_v2(
  requested_revision bigint,requested_previous_hash text,requested_canonical_hash text,
  requested_process_hash text,requested_actor_hash text,requested_account_hash text,
  requested_requirement_hash text,requested_grant_hash text,
  requested_codegen_input_hash text,requested_counts jsonb,
  requested_change_mask integer
) RETURNS varchar(64)
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_design_causality_sha256(jsonb_build_object(
    'schema','carbonet.design-causality-event/v2','scope','GLOBAL',
    'revision',requested_revision,'previousHash',requested_previous_hash,
    'canonicalHash',requested_canonical_hash,
    'processHash',requested_process_hash,'actorHash',requested_actor_hash,
    'accountAssignmentHash',requested_account_hash,
    'permissionRequirementHash',requested_requirement_hash,
    'permissionGrantHash',requested_grant_hash,
    'codegenInputHash',requested_codegen_input_hash,
    'rowCounts',requested_counts,'changeMask',requested_change_mask
  ))
$$;

ALTER TABLE framework_design_causality_event
  ADD CONSTRAINT framework_design_causality_event_hash_contract_check CHECK(
    (canonical_schema_version=1 AND event_hash=
      public.framework_design_causality_event_hash(
        revision,previous_hash,canonical_hash,process_hash,actor_hash,
        account_assignment_hash,permission_requirement_hash,
        permission_grant_hash,row_counts,change_mask
      )) OR
    (canonical_schema_version=2 AND event_hash=
      public.framework_design_causality_event_hash_v2(
        revision,previous_hash,canonical_hash,process_hash,actor_hash,
        account_assignment_hash,permission_requirement_hash,
        permission_grant_hash,codegen_input_hash,row_counts,change_mask
      ))
  );

CREATE OR REPLACE FUNCTION framework_design_causality_codegen_step_row(source_row jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'processCode',source_row->>'process_code',
    'stepCode',source_row->>'step_code',
    'specVersion',(source_row->>'spec_version')::integer,
    'actorContract',source_row->'actor_contract',
    'businessContract',source_row->'business_contract',
    'transitionContract',source_row->'transition_contract',
    'inputContract',source_row->'input_contract',
    'outputContract',source_row->'output_contract',
    'screenContract',source_row->'screen_contract',
    'fieldContract',source_row->'field_contract',
    'commandContract',source_row->'command_contract',
    'apiContract',source_row->'api_contract',
    'persistenceContract',source_row->'persistence_contract',
    'handoffContract',source_row->'handoff_contract',
    'testContract',source_row->'test_contract',
    'guideContract',source_row->'guide_contract',
    'nonfunctionalContract',source_row->'nonfunctional_contract',
    'designStatus',source_row->>'design_status',
    'approvalStatus',source_row->>'approval_status',
    'blockerCodes',public.framework_design_causality_json_set(
      source_row->'blocker_codes'
    ),
    'sourceHash',source_row->>'source_hash'
  )
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_valid_inventory_item(item jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(item->>'blueprintCode','') ~ '[^[:space:]]'
     AND coalesce(item->>'processCode','') ~ '[^[:space:]]'
     AND item->>'processCode'=btrim(item->>'processCode')
     AND coalesce(item->>'stepCode','') ~ '[^[:space:]]'
     AND item->>'stepCode'=btrim(item->>'stepCode')
     AND coalesce(item->>'actorCode','') ~ '[^[:space:]]'
     AND coalesce(item->>'audience','') ~ '[^[:space:]]'
     AND item->>'audience'=btrim(item->>'audience')
     AND coalesce(item->>'pageId','') ~ '[^[:space:]]'
     AND coalesce(item->>'pageName','') ~ '[^[:space:]]'
     AND coalesce(item->>'routePath','') ~ '^/'
     AND item->>'routePath'=btrim(item->>'routePath')
     AND coalesce(item->>'screenType','') ~ '[^[:space:]]'
     AND coalesce(item->>'templateCode','') ~ '[^[:space:]]'
     AND item->>'validationStatus'='VALID'
     AND item->>'ownershipMode' IN ('GENERATED','MANUAL','HYBRID')
     AND jsonb_typeof(item->'specification')='object'
     AND jsonb_typeof(item->'traceability')='object'
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_valid_incremental_item(item jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_design_causality_valid_inventory_item(item)
     AND item->>'ownershipMode' IN ('GENERATED','HYBRID')
     AND coalesce(item->>'blueprintId','') ~ '^[1-9][0-9]*$'
     AND coalesce(item->>'incrementalDesignHash','') ~ '^[0-9a-f]{64}$'
$$;

-- Source-row leaf caches keep the synchronous post-commit compiler bounded.
-- They contain business keys, boolean validation facts and SHA-256 leaves only;
-- no design payload, account identifier or raw contract text is persisted.
CREATE TABLE framework_design_codegen_blueprint_leaf_cache(
  blueprint_id bigint PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL,
  normalized_route varchar(300) NOT NULL,
  implementation_strategy varchar(30) NOT NULL,
  validation_status varchar(20) NOT NULL,
  page_slug varchar(200) NOT NULL,
  inventory_valid boolean NOT NULL,
  incremental_shape_valid boolean NOT NULL,
  inventory_base_hash varchar(64) NOT NULL CHECK(inventory_base_hash~'^[0-9a-f]{64}$'),
  specification_raw_hash varchar(64) NOT NULL CHECK(specification_raw_hash~'^[0-9a-f]{64}$'),
  traceability_raw_hash varchar(64) NOT NULL CHECK(traceability_raw_hash~'^[0-9a-f]{64}$')
);
CREATE INDEX framework_design_codegen_blueprint_leaf_exact_idx
  ON framework_design_codegen_blueprint_leaf_cache(
    process_code,step_code,audience,normalized_route
  );
CREATE INDEX framework_design_codegen_blueprint_leaf_normalized_idx
  ON framework_design_codegen_blueprint_leaf_cache(
    upper(process_code),upper(step_code),upper(audience),normalized_route
  );

CREATE TABLE framework_design_codegen_contract_leaf_cache(
  contract_id bigint PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL,
  route_path varchar(400) NOT NULL,
  normalized_process varchar(80) NOT NULL,
  normalized_step varchar(100) NOT NULL,
  normalized_audience varchar(20) NOT NULL,
  complete_lane boolean NOT NULL,
  legacy_leaf_hash varchar(64) NOT NULL CHECK(legacy_leaf_hash~'^[0-9a-f]{64}$'),
  canonical_leaf_hash varchar(64) NOT NULL CHECK(canonical_leaf_hash~'^[0-9a-f]{64}$'),
  permission_guard_leaf_hash varchar(64) NOT NULL
    CHECK(permission_guard_leaf_hash~'^[0-9a-f]{64}$')
);
CREATE INDEX framework_design_codegen_contract_leaf_exact_idx
  ON framework_design_codegen_contract_leaf_cache(
    process_code,step_code,audience,route_path
  );
CREATE INDEX framework_design_codegen_contract_leaf_normalized_idx
  ON framework_design_codegen_contract_leaf_cache(
    normalized_process,normalized_step,normalized_audience,route_path
  );

CREATE TABLE framework_design_codegen_step_leaf_cache(
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  design_status varchar(32),
  approval_status varchar(24),
  blocker_free boolean NOT NULL,
  leaf_hash varchar(64) NOT NULL CHECK(leaf_hash~'^[0-9a-f]{64}$'),
  PRIMARY KEY(process_code,step_code)
);

CREATE TABLE framework_design_permission_requirement_leaf_cache(
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  permission_code varchar(120) NOT NULL,
  scope_type varchar(20) NOT NULL,
  leaf_hash varchar(64) NOT NULL CHECK(leaf_hash~'^[0-9a-f]{64}$'),
  PRIMARY KEY(process_code,step_code,permission_code,scope_type)
);

CREATE TABLE framework_design_permission_feature_leaf_cache(
  feature_code varchar(100) PRIMARY KEY,
  leaf_hash varchar(64) NOT NULL CHECK(leaf_hash~'^[0-9a-f]{64}$')
);

CREATE TABLE framework_design_permission_field_leaf_cache(
  page_field_id bigint PRIMARY KEY,
  page_design_id bigint NOT NULL,
  leaf_hash varchar(64) NOT NULL CHECK(leaf_hash~'^[0-9a-f]{64}$')
);
CREATE INDEX framework_design_permission_field_leaf_page_idx
  ON framework_design_permission_field_leaf_cache(page_design_id);

CREATE OR REPLACE FUNCTION framework_refresh_design_codegen_blueprint_leaf(
  requested_blueprint_id bigint
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_blueprint_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.framework_design_codegen_blueprint_leaf_cache
   WHERE blueprint_id=requested_blueprint_id;
  INSERT INTO public.framework_design_codegen_blueprint_leaf_cache(
    blueprint_id,process_code,step_code,audience,normalized_route,
    implementation_strategy,validation_status,page_slug,inventory_valid,
    incremental_shape_valid,inventory_base_hash,
    specification_raw_hash,traceability_raw_hash
  )
  SELECT b.blueprint_id,b.process_code,b.step_code,b.audience,
         lower(split_part(b.route_path,'?',1)),b.implementation_strategy,
         b.validation_status,
         regexp_replace(regexp_replace(lower(coalesce(b.page_id,'')),
           '[^a-z0-9]+','-','g'),'(^-|-$)','','g'),
         coalesce(b.blueprint_code,'')~'[^[:space:]]'
           AND coalesce(b.process_code,'')~'[^[:space:]]'
           AND b.process_code=btrim(b.process_code)
           AND coalesce(b.step_code,'')~'[^[:space:]]'
           AND b.step_code=btrim(b.step_code)
           AND coalesce(b.actor_code,'')~'[^[:space:]]'
           AND coalesce(b.audience,'')~'[^[:space:]]'
           AND b.audience=btrim(b.audience)
           AND coalesce(b.page_id,'')~'[^[:space:]]'
           AND regexp_replace(regexp_replace(lower(coalesce(b.page_id,'')),
                 '[^a-z0-9]+','-','g'),'(^-|-$)','','g')<>''
           AND coalesce(b.page_name,'')~'[^[:space:]]'
           AND lower(split_part(b.route_path,'?',1))~'^/'
           AND lower(split_part(b.route_path,'?',1))=
               btrim(lower(split_part(b.route_path,'?',1)))
           AND coalesce(b.screen_type,'')~'[^[:space:]]'
           AND coalesce(b.template_code,'')~'[^[:space:]]'
           AND b.implementation_strategy IN (
             'GENERATED_RUNTIME','ADOPT_EXISTING','GENERATE_NEW',
             'STANDARDIZE_RUNTIME','DESIGN_REQUIRED'
           )
           AND jsonb_typeof(public.framework_try_jsonb(
                 b.specification_json,'{}'::jsonb))='object'
           AND jsonb_typeof(public.framework_try_jsonb(
                 b.traceability_json,'{}'::jsonb))='object',
         jsonb_typeof(public.framework_try_jsonb(
           b.specification_json,'[]'::jsonb))='object'
           AND jsonb_typeof(public.framework_try_jsonb(
             b.traceability_json,'[]'::jsonb))='object',
         public.framework_design_causality_sha256(jsonb_build_object(
           'blueprintCode',b.blueprint_code,'processCode',b.process_code,
           'stepCode',b.step_code,'actorCode',b.actor_code,'audience',b.audience,
           'pageId',b.page_id,'pageName',b.page_name,
           'routePath',lower(split_part(b.route_path,'?',1)),
           'screenType',b.screen_type,'templateCode',b.template_code,
           'specification',public.framework_try_jsonb(
             b.specification_json,'{}'::jsonb),
           'traceability',public.framework_try_jsonb(
             b.traceability_json,'{}'::jsonb),
           'validationStatus',b.validation_status
         )),
         public.framework_design_causality_sha256(
           to_jsonb(coalesce(b.specification_json,''))),
         public.framework_design_causality_sha256(
           to_jsonb(coalesce(b.traceability_json,'')))
    FROM public.framework_screen_blueprint b
   WHERE b.blueprint_id=requested_blueprint_id;
END
$$;

CREATE OR REPLACE FUNCTION framework_refresh_design_codegen_contract_leaf(
  requested_contract_id bigint
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_contract_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.framework_design_codegen_contract_leaf_cache
   WHERE contract_id=requested_contract_id;
  INSERT INTO public.framework_design_codegen_contract_leaf_cache(
    contract_id,process_code,step_code,audience,route_path,
    normalized_process,normalized_step,normalized_audience,complete_lane,
    legacy_leaf_hash,canonical_leaf_hash,permission_guard_leaf_hash
  )
  SELECT c.contract_id,c.process_code,c.step_code,c.audience,
         lower(split_part(c.route_path,'?',1)),upper(c.process_code),
         upper(c.step_code),upper(c.audience),
         CASE WHEN c.api_contract IS JSON ARRAY
           THEN jsonb_array_length(c.api_contract::jsonb)>0 ELSE false END
           AND CASE WHEN c.data_contract IS JSON ARRAY
             THEN jsonb_array_length(c.data_contract::jsonb)>0 ELSE false END
           AND CASE WHEN c.section_contract IS JSON ARRAY
             THEN jsonb_array_length(c.section_contract::jsonb)>0 ELSE false END
           AND CASE WHEN c.field_contract IS JSON ARRAY
             THEN jsonb_array_length(c.field_contract::jsonb)>0 ELSE false END,
         public.framework_design_causality_sha256(jsonb_build_object(
           'contractId',c.contract_id,'contractStatus',c.contract_status,
           'businessPurpose',c.business_purpose,'entryCondition',c.entry_condition,
           'exitCondition',c.exit_condition,'kpiContract',c.kpi_contract,
           'sectionContract',c.section_contract,'fieldContract',c.field_contract,
           'commandContract',c.command_contract,'stateContract',c.state_contract,
           'apiContract',c.api_contract,'dataContract',c.data_contract,
           'evidenceContract',c.evidence_contract,
           'responsiveContract',c.responsive_contract,
           'accessibilityContract',c.accessibility_contract,
           'securityContract',c.security_contract
         )),
         public.framework_design_causality_sha256(jsonb_build_object(
           'processCode',upper(c.process_code),'stepCode',upper(c.step_code),
           'audience',upper(c.audience),
           'routePath',lower(split_part(c.route_path,'?',1)),
           'screenName',c.screen_name,'contractStatus',c.contract_status,
           'businessPurpose',c.business_purpose,'entryCondition',c.entry_condition,
           'exitCondition',c.exit_condition,
           'sectionContract',CASE WHEN c.section_contract IS JSON ARRAY
             THEN c.section_contract::jsonb END,
           'fieldContract',CASE WHEN c.field_contract IS JSON ARRAY
             THEN c.field_contract::jsonb END,
           'commandContract',CASE
             WHEN c.command_contract IS NULL OR btrim(c.command_contract)='' THEN '[]'::jsonb
             WHEN c.command_contract IS JSON THEN c.command_contract::jsonb
             ELSE jsonb_build_array(c.command_contract) END,
           'stateContract',CASE
             WHEN c.state_contract IS NULL OR btrim(c.state_contract)='' THEN '[]'::jsonb
             WHEN c.state_contract IS JSON THEN c.state_contract::jsonb
             ELSE jsonb_build_array(c.state_contract) END,
           'apiContract',CASE WHEN c.api_contract IS JSON ARRAY
             THEN c.api_contract::jsonb END,
           'dataContract',CASE WHEN c.data_contract IS JSON ARRAY
             THEN c.data_contract::jsonb END,
           'evidenceContract',CASE
             WHEN c.evidence_contract IS NULL OR btrim(c.evidence_contract)='' THEN '[]'::jsonb
             WHEN c.evidence_contract IS JSON THEN c.evidence_contract::jsonb
             ELSE jsonb_build_array(c.evidence_contract) END,
           'responsiveContract',c.responsive_contract,
           'accessibilityContract',c.accessibility_contract,
           'securityContract',c.security_contract,
           'apiVerified',c.api_verified,'databaseVerified',c.database_verified,
           'authorityVerified',c.authority_verified,
           'responsiveVerified',c.responsive_verified,
           'accessibilityVerified',c.accessibility_verified,
           'exceptionStatesVerified',c.exception_states_verified,
            'auditEvidenceRef',c.audit_evidence_ref
          )),
          public.framework_design_causality_sha256(jsonb_build_object(
            'processCode',c.process_code,'stepCode',c.step_code,
            'audience',c.audience,
            'routePath',lower(split_part(c.route_path,'?',1)),
            'actorCode',c.actor_code,
            'permissionCodes',public.framework_design_causality_json_set(
              c.permission_codes),
            'apiContract',public.framework_design_causality_text_json(
              c.api_contract),
            'securityContract',public.framework_design_causality_text_json(
              c.security_contract),
            'authorityVerified',c.authority_verified,
            'contractStatus',c.contract_status
          ))
    FROM public.framework_professional_screen_contract c
   WHERE c.contract_id=requested_contract_id;
END
$$;

CREATE OR REPLACE FUNCTION framework_refresh_design_permission_requirement_leaf(
  requested_process_code text,requested_step_code text,
  requested_permission_code text,requested_scope_type text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_process_code IS NULL OR requested_step_code IS NULL OR
     requested_permission_code IS NULL OR requested_scope_type IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.framework_design_permission_requirement_leaf_cache
   WHERE process_code=requested_process_code AND step_code=requested_step_code
     AND permission_code=requested_permission_code AND scope_type=requested_scope_type;
  INSERT INTO public.framework_design_permission_requirement_leaf_cache(
    process_code,step_code,permission_code,scope_type,leaf_hash
  )
  SELECT r.process_code,r.step_code,r.permission_code,r.scope_type,
         public.framework_design_causality_sha256(
           to_jsonb(r)-ARRAY['created_at','updated_at'])
    FROM public.framework_permission_requirement_v1 r
   WHERE r.process_code=requested_process_code
     AND r.step_code=requested_step_code
     AND r.permission_code=requested_permission_code
     AND r.scope_type=requested_scope_type;
END
$$;

CREATE OR REPLACE FUNCTION framework_refresh_design_permission_feature_leaf(
  requested_feature_code text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_feature_code IS NULL THEN RETURN; END IF;
  DELETE FROM public.framework_design_permission_feature_leaf_cache
   WHERE feature_code=requested_feature_code;
  INSERT INTO public.framework_design_permission_feature_leaf_cache(
    feature_code,leaf_hash
  )
  SELECT f.feature_code,public.framework_design_causality_sha256(
           to_jsonb(f)-ARRAY['frst_regist_pnttm','last_updt_pnttm'])
    FROM public.comtnmenufunctioninfo f
   WHERE f.feature_code=requested_feature_code;
END
$$;

CREATE OR REPLACE FUNCTION framework_refresh_design_permission_field_leaf(
  requested_page_field_id bigint
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_page_field_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.framework_design_permission_field_leaf_cache
   WHERE page_field_id=requested_page_field_id;
  INSERT INTO public.framework_design_permission_field_leaf_cache(
    page_field_id,page_design_id,leaf_hash
  )
  SELECT f.page_field_id,f.page_design_id,
         public.framework_design_causality_sha256(jsonb_build_object(
           'processCode',d.process_code,'stepCode',d.step_code,
           'audience',d.audience,'pageCode',d.page_code,
           'plannedRoute',d.planned_route_path,'actualRoute',d.actual_route_path,
           'actorCode',d.actor_code,'pageSecurityContract',d.security_contract,
           'fieldOrder',f.field_order,'fieldCode',f.field_code,
           'apiProperty',f.api_property,'permissionCode',f.permission_code,
           'privacyClass',f.privacy_class,
           'validationContract',f.validation_contract,'required',f.required,
           'editable',f.editable,'mappingStatus',f.mapping_status,
           'useAt',d.design_status
         ))
    FROM public.framework_page_field_definition f
    JOIN public.framework_page_design d USING(page_design_id)
   WHERE f.page_field_id=requested_page_field_id;
END
$$;

CREATE OR REPLACE FUNCTION framework_refresh_design_permission_page_leafs(
  requested_page_design_id bigint
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE requested_page_field_id bigint;
BEGIN
  IF requested_page_design_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.framework_design_permission_field_leaf_cache
   WHERE page_design_id=requested_page_design_id;
  FOR requested_page_field_id IN
    SELECT f.page_field_id FROM public.framework_page_field_definition f
     WHERE f.page_design_id=requested_page_design_id
     ORDER BY f.page_field_id
  LOOP
    PERFORM public.framework_refresh_design_permission_field_leaf(
      requested_page_field_id);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION framework_refresh_design_codegen_step_leaf(
  requested_process_code text,requested_step_code text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_process_code IS NULL OR requested_step_code IS NULL THEN RETURN; END IF;
  DELETE FROM public.framework_design_codegen_step_leaf_cache
   WHERE process_code=requested_process_code AND step_code=requested_step_code;
  INSERT INTO public.framework_design_codegen_step_leaf_cache(
    process_code,step_code,design_status,approval_status,blocker_free,leaf_hash
  )
  SELECT spec.process_code,spec.step_code,spec.design_status,spec.approval_status,
         jsonb_array_length(public.framework_design_causality_json_set(
           spec.blocker_codes))=0,
         public.framework_design_causality_sha256(
           public.framework_design_causality_codegen_step_row(to_jsonb(spec))
         )
    FROM public.framework_step_execution_spec spec
   WHERE spec.process_code=requested_process_code
     AND spec.step_code=requested_step_code;
END
$$;

DO $$
DECLARE row_id bigint; row_key record;
BEGIN
  FOR row_id IN SELECT blueprint_id FROM public.framework_screen_blueprint LOOP
    PERFORM public.framework_refresh_design_codegen_blueprint_leaf(row_id);
  END LOOP;
  FOR row_id IN
    SELECT contract_id FROM public.framework_professional_screen_contract
  LOOP
    PERFORM public.framework_refresh_design_codegen_contract_leaf(row_id);
  END LOOP;
  FOR row_key IN
    SELECT process_code,step_code FROM public.framework_step_execution_spec
  LOOP
    PERFORM public.framework_refresh_design_codegen_step_leaf(
      row_key.process_code,row_key.step_code
    );
  END LOOP;
  FOR row_key IN SELECT process_code,step_code,permission_code,scope_type
                   FROM public.framework_permission_requirement_v1
  LOOP
    PERFORM public.framework_refresh_design_permission_requirement_leaf(
      row_key.process_code,row_key.step_code,row_key.permission_code,row_key.scope_type
    );
  END LOOP;
  FOR row_key IN SELECT feature_code FROM public.comtnmenufunctioninfo LOOP
    PERFORM public.framework_refresh_design_permission_feature_leaf(
      row_key.feature_code);
  END LOOP;
  FOR row_id IN SELECT page_field_id FROM public.framework_page_field_definition LOOP
    PERFORM public.framework_refresh_design_permission_field_leaf(row_id);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_permission_requirement_component()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  normalized_count integer; feature_count integer;
  field_binding_count integer; screen_guard_count integer;
  normalized_hash varchar(64); feature_hash varchar(64);
  field_hash varchar(64); screen_guard_hash varchar(64);
  req_mapping_complete boolean; req_mapping_note text;
BEGIN
  IF EXISTS(
       SELECT 1 FROM public.framework_permission_requirement_v1 s
       FULL JOIN public.framework_design_permission_requirement_leaf_cache c
         ON c.process_code=s.process_code AND c.step_code=s.step_code
        AND c.permission_code=s.permission_code AND c.scope_type=s.scope_type
       WHERE s.process_code IS NULL OR c.process_code IS NULL
     ) OR EXISTS(
       SELECT 1 FROM public.comtnmenufunctioninfo s
       FULL JOIN public.framework_design_permission_feature_leaf_cache c
         ON c.feature_code=s.feature_code
       WHERE s.feature_code IS NULL OR c.feature_code IS NULL
     ) OR EXISTS(
       SELECT 1
         FROM (SELECT f.page_field_id FROM public.framework_page_field_definition f
                JOIN public.framework_page_design d USING(page_design_id)) s
         FULL JOIN public.framework_design_permission_field_leaf_cache c
           ON c.page_field_id=s.page_field_id
        WHERE s.page_field_id IS NULL OR c.page_field_id IS NULL
     ) OR EXISTS(
       SELECT 1 FROM public.framework_professional_screen_contract s
       FULL JOIN public.framework_design_codegen_contract_leaf_cache c
         ON c.contract_id=s.contract_id
       WHERE s.contract_id IS NULL OR c.contract_id IS NULL
     ) THEN
    RAISE EXCEPTION 'permission requirement source/cache key drift'
      USING ERRCODE='55000';
  END IF;

  SELECT count(*)::integer,
         public.framework_design_causality_sha256(jsonb_build_object(
           'schema','framework-permission-requirement/v1','count',count(*),
           'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
             string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C"),''),
             'UTF8')),'hex')
         ))
    INTO normalized_count,normalized_hash
    FROM public.framework_design_permission_requirement_leaf_cache;
  SELECT count(*)::integer,
         public.framework_design_causality_sha256(jsonb_build_object(
           'schema','comtnmenufunctioninfo/v1','count',count(*),
           'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
             string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C"),''),
             'UTF8')),'hex')
         ))
    INTO feature_count,feature_hash
    FROM public.framework_design_permission_feature_leaf_cache;
  SELECT count(*)::integer,
         public.framework_design_causality_sha256(jsonb_build_object(
           'schema','framework-page-field-permission/v1','count',count(*),
           'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
             string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C"),''),
             'UTF8')),'hex')
         ))
    INTO field_binding_count,field_hash
    FROM public.framework_design_permission_field_leaf_cache;
  SELECT count(*)::integer,
         public.framework_design_causality_sha256(jsonb_build_object(
           'schema','framework-professional-screen-permission/v1','count',count(*),
           'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
             string_agg(permission_guard_leaf_hash,E'\n' ORDER BY
               permission_guard_leaf_hash COLLATE "C"),''),'UTF8')),'hex')
         ))
    INTO screen_guard_count,screen_guard_hash
    FROM public.framework_design_codegen_contract_leaf_cache;
  SELECT m.requirement_mapping_complete,m.mapping_note
    INTO req_mapping_complete,req_mapping_note
    FROM public.framework_permission_mapping_control_v1 m WHERE m.control_id=1;

  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-permission-requirement/v2',
    'sourceSchema','normalized-v1+legacy-leaf-summary/v2',
    'mappingComplete',coalesce(req_mapping_complete,false),
    'mappingNote',coalesce(req_mapping_note,'mapping control missing'),
    'normalizedCount',normalized_count,'featureCount',feature_count,
    'fieldBindingCount',field_binding_count,'screenGuardCount',screen_guard_count,
    'normalizedAggregateHash',normalized_hash,
    'featureAggregateHash',feature_hash,'fieldBindingAggregateHash',field_hash,
    'screenGuardAggregateHash',screen_guard_hash,
    'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
  );
END
$$;

-- V2 summaries retain the exact v1 canonical row semantics but collapse raw
-- arrays immediately into count-bound SHA-256 multisets. This keeps the
-- synchronous mask-63 bootstrap under the worker timeout without persisting
-- source documents or account identifiers.
CREATE OR REPLACE FUNCTION framework_design_causality_process_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH step_leaf AS MATERIALIZED (
    SELECT s.process_code,public.framework_design_causality_sha256(
      (to_jsonb(s)-ARRAY[
        'step_id','evidence_types','segregation_actor_codes',
        'api_contract','input_contract','output_contract'
      ])||jsonb_build_object(
        'evidence_types',public.framework_design_causality_csv_set(s.evidence_types),
        'segregation_actor_codes',public.framework_design_causality_csv_set(
          s.segregation_actor_codes),
        'evidence_types_raw_hash',public.framework_design_causality_sha256(
          jsonb_build_object('value',s.evidence_types)),
        'segregation_actor_codes_raw_hash',public.framework_design_causality_sha256(
          jsonb_build_object('value',s.segregation_actor_codes)),
        'api_contract',public.framework_design_causality_text_json(s.api_contract),
        'input_contract',public.framework_try_jsonb(s.input_contract,'{}'::jsonb),
        'output_contract',public.framework_try_jsonb(s.output_contract,'{}'::jsonb)
      )) leaf_hash
      FROM public.framework_process_step s
  ), step_rollup AS MATERIALIZED (
    SELECT process_code,count(*)::integer step_count,
      public.framework_design_causality_sha256(jsonb_build_object(
        'schema','framework-process-step/v1','count',count(*),
        'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
          string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C"),''),
          'UTF8')),'hex')
      )) aggregate_hash
      FROM step_leaf GROUP BY process_code
  ), process_leaf AS MATERIALIZED (
    SELECT public.framework_design_causality_sha256(
      (to_jsonb(p)-ARRAY[
        'created_at','updated_at','last_reviewed_at','next_review_at',
        'prerequisite_codes','regulation_refs'
      ])||jsonb_build_object(
        'prerequisite_codes',public.framework_design_causality_csv_set(
          p.prerequisite_codes),
        'regulation_refs',public.framework_design_causality_csv_set(p.regulation_refs),
        'stepCount',coalesce(r.step_count,0),
        'stepAggregateHash',coalesce(r.aggregate_hash,
          public.framework_design_causality_sha256(jsonb_build_object(
            'schema','framework-process-step/v1','count',0,
            'orderedLeafDigest',encode(pg_catalog.sha256(convert_to('','UTF8')),'hex')
          )))
      )) leaf_hash
      FROM public.framework_process_definition p
      LEFT JOIN step_rollup r ON r.process_code=p.process_code
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-process/v2',
    'sourceSchema','framework-process+step-leaf-summary/v2',
    'processCount',(SELECT count(*) FROM process_leaf),
    'stepCount',(SELECT count(*) FROM step_leaf),
    'aggregateHash',public.framework_design_causality_sha256(jsonb_build_object(
      'schema','carbonet.design-causality-process/v2',
      'count',(SELECT count(*) FROM process_leaf),
      'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce((
        SELECT string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C")
          FROM process_leaf),''),'UTF8')),'hex')
    )),
    'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
  )
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_actor_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH leaf AS MATERIALIZED (
    SELECT public.framework_design_causality_sha256(
      (to_jsonb(a)-ARRAY[
        'created_at','updated_at','capability_codes','conflict_actor_codes'
      ])||jsonb_build_object(
        'capability_codes',public.framework_design_causality_csv_set(a.capability_codes),
        'conflict_actor_codes',public.framework_design_causality_csv_set(
          a.conflict_actor_codes)
      )) leaf_hash FROM public.framework_actor_definition a
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-actor/v2',
    'sourceSchema','framework-actor-leaf-summary/v2','actorCount',count(*),
    'aggregateHash',public.framework_design_causality_sha256(jsonb_build_object(
      'schema','carbonet.design-causality-actor/v2','count',count(*),
      'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
        string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C"),''),
        'UTF8')),'hex')
    )),
    'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
  ) FROM leaf
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_account_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH leaf AS MATERIALIZED (
    SELECT public.framework_design_causality_sha256(jsonb_build_object(
      'account',a.account_id,'tenant',a.tenant_id,'project',a.project_id,
      'actor',a.actor_code,'dataScope',a.data_scope,'validFrom',a.valid_from,
      'validUntil',a.valid_until,'status',a.assignment_status
    )) leaf_hash FROM public.framework_account_actor_assignment a
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-account-assignment/v2',
    'sourceSchema','framework-account-assignment-leaf-summary/v2',
    'sourceMutationExpected',false,'assignmentCount',count(*),
    'aggregateHash',public.framework_design_causality_sha256(jsonb_build_object(
      'schema','carbonet.design-causality-account-assignment/v2','count',count(*),
      'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
        string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C"),''),
        'UTF8')),'hex')
    )),
    'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
  ) FROM leaf
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_permission_grant_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH normalized AS MATERIALIZED (
    SELECT public.framework_design_causality_sha256(
      to_jsonb(g)-ARRAY['created_at','updated_at']) leaf_hash
      FROM public.framework_permission_grant_v1 g
  ), role_grant AS MATERIALIZED (
    SELECT public.framework_design_causality_sha256(to_jsonb(g)-'creat_dt') leaf_hash
      FROM public.comtnauthorfunctionrelate g
  ), user_override AS MATERIALIZED (
    SELECT public.framework_design_causality_sha256(jsonb_build_object(
      'principal',scrty_dtrmn_trget_id,'memberType',mber_ty_code,
      'featureCode',feature_code,'overrideType',override_type,'useAt',use_at
    )) leaf_hash FROM public.comtnuserfeatureoverride
  ), account_role AS MATERIALIZED (
    SELECT public.framework_design_causality_sha256(jsonb_build_object(
      'principal',scrty_dtrmn_trget_id,'memberType',mber_ty_code,'role',author_code
    )) leaf_hash FROM public.comtnemplyrscrtyestbs
  ), lane AS (
    SELECT 'normalized' lane,(SELECT count(*) FROM normalized) row_count,
      (SELECT string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C") FROM normalized) leaves
    UNION ALL SELECT 'roleGrant',(SELECT count(*) FROM role_grant),
      (SELECT string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C") FROM role_grant)
    UNION ALL SELECT 'userOverride',(SELECT count(*) FROM user_override),
      (SELECT string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C") FROM user_override)
    UNION ALL SELECT 'accountRole',(SELECT count(*) FROM account_role),
      (SELECT string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C") FROM account_role)
  ), lane_hash AS (
    SELECT lane,row_count,public.framework_design_causality_sha256(jsonb_build_object(
      'schema','carbonet.permission-grant-'||lane||'/v2','count',row_count,
      'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(leaves,''),
        'UTF8')),'hex')
    )) aggregate_hash FROM lane
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-permission-grant/v2',
    'sourceSchema','normalized+legacy-leaf-summary/v2',
    'sourceMutationExpected',false,
    'mappingComplete',coalesce((SELECT grant_mapping_complete
      FROM public.framework_permission_mapping_control_v1 WHERE control_id=1),false),
    'mappingNote',coalesce((SELECT mapping_note
      FROM public.framework_permission_mapping_control_v1 WHERE control_id=1),
      'mapping control missing'),
    'normalizedCount',(SELECT row_count FROM lane_hash WHERE lane='normalized'),
    'legacyRoleGrantCount',(SELECT row_count FROM lane_hash WHERE lane='roleGrant'),
    'legacyUserOverrideCount',(SELECT row_count FROM lane_hash WHERE lane='userOverride'),
    'legacyAccountRoleCount',(SELECT row_count FROM lane_hash WHERE lane='accountRole'),
    'laneHashes',(SELECT jsonb_object_agg(lane,aggregate_hash ORDER BY lane COLLATE "C")
      FROM lane_hash),
    'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
  )
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_codegen_input_component()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inventory_aggregate_hash varchar(64);
  emitted_aggregate_hash varchar(64);
  professional_aggregate_hash varchar(64);
  step_aggregate_hash varchar(64);
  inventory_count integer;
  inventory_generated_count integer;
  inventory_manual_count integer;
  inventory_hybrid_count integer;
  invalid_inventory_count integer;
  invalid_page_slug_count integer;
  duplicate_page_slug_group_count integer;
  orphan_inventory_count integer;
  inventory_overflow_count integer;
  emitted_count integer;
  invalid_emitted_count integer;
  incremental_pagination_required_count integer;
  normalized_identity_duplicate_group_count integer;
  normalized_identity_duplicate_row_count integer;
  professional_count integer;
  canonical_compilable_count integer;
  canonical_missing_count integer;
  canonical_duplicate_count integer;
  canonical_incomplete_count integer;
  step_count integer;
  approved_count integer;
  design_complete_count integer;
  eligible_count integer;
  step_blocker_count integer;
BEGIN
  IF EXISTS(
       SELECT 1 FROM public.framework_screen_blueprint s
        FULL JOIN public.framework_design_codegen_blueprint_leaf_cache c
          ON c.blueprint_id=s.blueprint_id
       WHERE s.blueprint_id IS NULL OR c.blueprint_id IS NULL
     ) OR EXISTS(
       SELECT 1 FROM public.framework_professional_screen_contract s
        FULL JOIN public.framework_design_codegen_contract_leaf_cache c
          ON c.contract_id=s.contract_id
       WHERE s.contract_id IS NULL OR c.contract_id IS NULL
     ) OR EXISTS(
       SELECT 1 FROM public.framework_step_execution_spec s
        FULL JOIN public.framework_design_codegen_step_leaf_cache c
          ON c.process_code=s.process_code AND c.step_code=s.step_code
       WHERE s.process_code IS NULL OR c.process_code IS NULL
     ) THEN
    RAISE EXCEPTION 'design codegen leaf cache cardinality/key mismatch'
      USING ERRCODE='55000';
  END IF;
  -- Collapse every wide source row to a 64-hex leaf immediately. Only narrow
  -- hashes/counts cross a MATERIALIZED boundary, keeping the 1,732-screen gate
  -- below its two-second transaction budget without weakening change capture.
  WITH valid_identity AS MATERIALIZED (
    SELECT DISTINCT upper(b.process_code) process_code,
           upper(b.step_code) step_code,upper(b.audience) audience,
           b.normalized_route route_path
      FROM public.framework_design_codegen_blueprint_leaf_cache b
      JOIN public.framework_process_definition p ON p.process_code=b.process_code
      JOIN public.framework_process_step s
        ON s.process_code=b.process_code AND s.step_code=b.step_code
     WHERE b.validation_status='VALID'
  ), contract_leaf AS MATERIALIZED (
    SELECT process_code,step_code,audience,route_path,normalized_process,
           normalized_step,normalized_audience,complete_lane,
           legacy_leaf_hash,canonical_leaf_hash
      FROM public.framework_design_codegen_contract_leaf_cache
  ), legacy_contract_rollup AS MATERIALIZED (
    SELECT process_code,step_code,audience,route_path,count(*)::integer contract_count,
           count(*) FILTER(WHERE complete_lane)::integer complete_lane_count,
           encode(pg_catalog.sha256(convert_to(string_agg(legacy_leaf_hash,E'\n'
             ORDER BY legacy_leaf_hash COLLATE "C"),'UTF8')),'hex')::varchar(64)
             contract_aggregate_hash
      FROM contract_leaf
     GROUP BY process_code,step_code,audience,route_path
  ), canonical_contract_rollup AS MATERIALIZED (
    SELECT normalized_process process_code,normalized_step step_code,
           normalized_audience audience,route_path,count(*)::integer contract_count,
           count(*) FILTER(WHERE complete_lane)::integer complete_lane_count
      FROM contract_leaf
     GROUP BY normalized_process,normalized_step,normalized_audience,route_path
  ), attached_contract AS MATERIALIZED (
    SELECT c.canonical_leaf_hash
      FROM contract_leaf c
      JOIN valid_identity i
        ON i.process_code=c.normalized_process
       AND i.step_code=c.normalized_step
       AND i.audience=c.normalized_audience
       AND i.route_path=c.route_path
  ), source AS (
    SELECT b.*,
           coalesce(lr.contract_count,0) exact_contract_count,
           coalesce(lr.complete_lane_count,0) exact_complete_lane_count,
           coalesce(cr.contract_count,0) normalized_contract_count,
           coalesce(cr.complete_lane_count,0) normalized_complete_lane_count,
           coalesce(lr.contract_aggregate_hash,
             encode(pg_catalog.sha256(convert_to('','UTF8')),'hex'))
             contract_aggregate_hash,
           count(*) OVER(PARTITION BY upper(b.process_code),upper(b.step_code),
             upper(b.audience),b.normalized_route)
             blueprint_identity_count,
           CASE
             WHEN b.implementation_strategy='GENERATED_RUNTIME' THEN 'GENERATED'
             WHEN b.implementation_strategy='ADOPT_EXISTING'
                  AND coalesce(lr.contract_count,0)>0 THEN 'HYBRID'
             ELSE 'MANUAL'
           END ownership_mode
      FROM public.framework_design_codegen_blueprint_leaf_cache b
      JOIN public.framework_process_definition p ON p.process_code=b.process_code
      JOIN public.framework_process_step s
        ON s.process_code=b.process_code AND s.step_code=b.step_code
      LEFT JOIN legacy_contract_rollup lr
       ON lr.process_code=b.process_code AND lr.step_code=b.step_code
       AND lr.audience=b.audience
       AND lr.route_path=b.normalized_route
      LEFT JOIN canonical_contract_rollup cr
       ON cr.process_code=upper(b.process_code) AND cr.step_code=upper(b.step_code)
       AND cr.audience=upper(b.audience)
       AND cr.route_path=b.normalized_route
     WHERE b.validation_status='VALID'
  ), inventory_hashed AS MATERIALIZED (
    SELECT blueprint_id,exact_contract_count,exact_complete_lane_count,
           normalized_contract_count,normalized_complete_lane_count,
           blueprint_identity_count,
           ownership_mode,contract_aggregate_hash,
           page_slug,specification_raw_hash,traceability_raw_hash,
           inventory_valid,incremental_shape_valid,
           public.framework_design_causality_sha256(jsonb_build_object(
             'inventoryBaseHash',inventory_base_hash,
             'ownershipMode',ownership_mode
           )) inventory_leaf_hash
      FROM source
  ), page_slug_duplicate AS MATERIALIZED (
    SELECT page_slug,count(*)::integer row_count
      FROM inventory_hashed
     WHERE page_slug<>''
     GROUP BY page_slug
    HAVING count(*)>1
  ), hashed AS MATERIALIZED (
    SELECT blueprint_id,exact_contract_count,exact_complete_lane_count,
           normalized_contract_count,normalized_complete_lane_count,
           blueprint_identity_count,
           ownership_mode,page_slug,inventory_valid,
           ownership_mode IN ('GENERATED','HYBRID') emitted,
           inventory_valid AND incremental_shape_valid AND blueprint_id>0 emitted_valid,
           inventory_leaf_hash,
           CASE WHEN ownership_mode IN ('GENERATED','HYBRID') THEN
             public.framework_design_causality_sha256(jsonb_build_object(
               'blueprintId',blueprint_id,'ownershipMode',ownership_mode,
               'inventoryLeafHash',inventory_leaf_hash,
               'incrementalContractAggregateHash',contract_aggregate_hash,
               'specificationRawHash',specification_raw_hash,
               'traceabilityRawHash',traceability_raw_hash
             )) END emitted_leaf_hash
      FROM inventory_hashed
  )
  SELECT count(*)::integer,
         count(*) FILTER(WHERE ownership_mode='GENERATED')::integer,
         count(*) FILTER(WHERE ownership_mode='MANUAL')::integer,
         count(*) FILTER(WHERE ownership_mode='HYBRID')::integer,
         count(*) FILTER(WHERE NOT inventory_valid)::integer,
         count(*) FILTER(WHERE page_slug='')::integer,
         (SELECT count(*)::integer FROM page_slug_duplicate),
         count(*) FILTER(WHERE emitted)::integer,
         count(*) FILTER(WHERE emitted AND NOT emitted_valid)::integer,
         0::integer,
         public.framework_design_causality_sha256(jsonb_build_object(
           'schema','framework-screen-blueprint-export/v2','count',count(*),
           'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(string_agg(
             inventory_leaf_hash,E'\n' ORDER BY inventory_leaf_hash COLLATE "C"),''),
             'UTF8')),'hex')
         )),
         public.framework_design_causality_sha256(jsonb_build_object(
           'schema','carbonet.incremental-screen-generation/v3',
           'count',count(*) FILTER(WHERE emitted_leaf_hash IS NOT NULL),
           'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(string_agg(
             emitted_leaf_hash,E'\n' ORDER BY emitted_leaf_hash COLLATE "C")
             FILTER(WHERE emitted_leaf_hash IS NOT NULL),''),'UTF8')),'hex')
         )),
         count(*) FILTER(WHERE exact_contract_count=1
                           AND exact_complete_lane_count=1
                           AND normalized_contract_count=1
                           AND blueprint_identity_count=1)::integer,
         count(*) FILTER(WHERE exact_contract_count=0)::integer,
         count(*) FILTER(WHERE exact_contract_count>1
                           OR normalized_contract_count>1
                           OR blueprint_identity_count>1)::integer,
         count(*) FILTER(WHERE exact_contract_count=1
                           AND exact_complete_lane_count<>1)::integer,
         (SELECT count(*)::integer FROM attached_contract),
         (SELECT public.framework_design_causality_sha256(jsonb_build_object(
                   'schema','carbonet.canonical-design-source/v1','count',count(*),
                   'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
                     string_agg(canonical_leaf_hash,E'\n' ORDER BY
                       canonical_leaf_hash COLLATE "C"),''),'UTF8')),'hex')
                 ))
            FROM attached_contract)
    INTO inventory_count,inventory_generated_count,inventory_manual_count,
         inventory_hybrid_count,invalid_inventory_count,
         invalid_page_slug_count,duplicate_page_slug_group_count,emitted_count,
         invalid_emitted_count,incremental_pagination_required_count,
         inventory_aggregate_hash,emitted_aggregate_hash,
         canonical_compilable_count,canonical_missing_count,
         canonical_duplicate_count,canonical_incomplete_count,
         professional_count,professional_aggregate_hash
    FROM hashed;
  inventory_overflow_count:=greatest(inventory_count-5000,0);
  -- Legacy discovery capacity is an execution capability fact. Keep it
  -- independent of surrogate blueprint ordering so MANUAL id churn remains a
  -- Semantic NOOP; canonical generator receipts carry exact pagination evidence.
  incremental_pagination_required_count:=greatest(inventory_count-1000,0);
  SELECT count(*)::integer INTO orphan_inventory_count
    FROM public.framework_design_codegen_blueprint_leaf_cache b
   WHERE b.validation_status='VALID' AND (
     NOT EXISTS(SELECT 1 FROM public.framework_process_definition p
                 WHERE p.process_code=b.process_code)
     OR NOT EXISTS(SELECT 1 FROM public.framework_process_step s
                    WHERE s.process_code=b.process_code
                      AND s.step_code=b.step_code)
   );

  WITH duplicate_identities AS (
    SELECT upper(b.process_code),upper(b.step_code),upper(b.audience),
           b.normalized_route,count(*) row_count
      FROM public.framework_design_codegen_blueprint_leaf_cache b
      JOIN public.framework_process_definition p ON p.process_code=b.process_code
      JOIN public.framework_process_step s
        ON s.process_code=b.process_code AND s.step_code=b.step_code
     WHERE b.validation_status='VALID'
     GROUP BY upper(b.process_code),upper(b.step_code),upper(b.audience),
              b.normalized_route
    HAVING count(*)>1
  )
  SELECT count(*)::integer,coalesce(sum(row_count),0)::integer
    INTO normalized_identity_duplicate_group_count,
         normalized_identity_duplicate_row_count
    FROM duplicate_identities;

  WITH hashed AS MATERIALIZED (
    SELECT leaf_hash,design_status,approval_status,blocker_free
      FROM public.framework_design_codegen_step_leaf_cache
  )
  SELECT count(*)::integer,
         count(*) FILTER(WHERE approval_status='APPROVED')::integer,
         count(*) FILTER(WHERE design_status='DESIGN_COMPLETE')::integer,
         count(*) FILTER(WHERE design_status='DESIGN_COMPLETE'
                           AND approval_status='APPROVED')::integer,
         count(*) FILTER(WHERE NOT blocker_free)::integer,
         public.framework_design_causality_sha256(jsonb_build_object(
           'schema','framework-step-execution-spec/v1','count',count(*),
           'orderedLeafDigest',encode(pg_catalog.sha256(convert_to(coalesce(
             string_agg(leaf_hash,E'\n' ORDER BY leaf_hash COLLATE "C"),''),
             'UTF8')),'hex')
         ))
    INTO step_count,approved_count,design_complete_count,eligible_count,
         step_blocker_count,step_aggregate_hash
    FROM hashed;

  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-codegen-input/v2',
    'designInventory',jsonb_build_object(
      'sourceSchema','framework-screen-blueprint-export/v2',
      'screenCount',inventory_count,
      'generatedCount',inventory_generated_count,
      'manualCount',inventory_manual_count,
      'hybridCount',inventory_hybrid_count,
      'invalidCount',invalid_inventory_count,
      'invalidPageSlugCount',invalid_page_slug_count,
      'duplicatePageSlugGroupCount',duplicate_page_slug_group_count,
      'orphanCount',orphan_inventory_count,
      'overflowCount',inventory_overflow_count,
      'aggregateHash',inventory_aggregate_hash,
      'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
    ),
    'incrementalEmitted',jsonb_build_object(
      'sourceSchema','carbonet.incremental-screen-generation/v3',
      'screenCount',emitted_count,
      'invalidCount',invalid_emitted_count,
      'discoveryCapacity',1000,
      'paginationRequiredCount',incremental_pagination_required_count,
      'aggregateHash',emitted_aggregate_hash,
      'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
    ),
    'canonicalSource',jsonb_build_object(
      'sourceSchema','carbonet.canonical-design-source/v1',
      'professionalContractCount',professional_count,
      'compilableCount',canonical_compilable_count,
      'missingCount',canonical_missing_count,
      'duplicateCount',canonical_duplicate_count,
      'incompleteLaneCount',canonical_incomplete_count,
      'normalizedIdentityDuplicateGroupCount',
        normalized_identity_duplicate_group_count,
      'normalizedIdentityDuplicateRowCount',
        normalized_identity_duplicate_row_count,
      'aggregateHash',professional_aggregate_hash,
      'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
    ),
    'stepExecution',jsonb_build_object(
      'sourceSchema','framework-step-execution-spec/v1',
      'stepCount',step_count,'approvedCount',approved_count,
      'designCompleteCount',design_complete_count,
      'eligibleCount',eligible_count,'blockerCount',step_blocker_count,
      'packageShapeAttestationCoverage',0,
      'aggregateHash',step_aggregate_hash,
      'aggregateHashContract','count+schema+ordered-leaf-digest/v1'
    )
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_codegen_readiness()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  head_schema_version integer;
  counts jsonb;
  active_binding_count integer;
  generated_count integer;
  manual_count integer;
  hybrid_count integer;
  inventory_count integer;
  emitted_count integer;
  incremental_pagination_required_count integer;
  invalid_inventory_count integer;
  invalid_page_slug_count integer;
  duplicate_page_slug_group_count integer;
  orphan_inventory_count integer;
  inventory_overflow_count integer;
  invalid_emitted_count integer;
  canonical_compilable_count integer;
  canonical_missing_count integer;
  canonical_duplicate_count integer;
  canonical_incomplete_count integer;
  normalized_identity_duplicate_group_count integer;
  step_count integer;
  step_eligible_count integer;
  step_blocker_count integer;
  package_shape_attestation_coverage integer;
  reasons jsonb:='[]'::jsonb;
BEGIN
  SELECT canonical_schema_version,row_counts INTO STRICT head_schema_version,counts
    FROM public.framework_design_causality_head WHERE scope_key='GLOBAL';
  generated_count:=(counts#>>'{codegenInput,generatedCount}')::integer;
  manual_count:=(counts#>>'{codegenInput,manualCount}')::integer;
  hybrid_count:=(counts#>>'{codegenInput,hybridCount}')::integer;
  inventory_count:=(counts#>>'{codegenInput,inventoryScreenCount}')::integer;
  emitted_count:=(counts#>>'{codegenInput,emittedScreenCount}')::integer;
  incremental_pagination_required_count:=
    (counts#>>'{codegenInput,incrementalPaginationRequiredCount}')::integer;
  invalid_inventory_count:=
    (counts#>>'{codegenInput,invalidInventoryCount}')::integer;
  invalid_page_slug_count:=
    (counts#>>'{codegenInput,invalidPageSlugCount}')::integer;
  duplicate_page_slug_group_count:=
    (counts#>>'{codegenInput,duplicatePageSlugGroupCount}')::integer;
  orphan_inventory_count:=
    (counts#>>'{codegenInput,orphanInventoryCount}')::integer;
  inventory_overflow_count:=
    (counts#>>'{codegenInput,inventoryOverflowCount}')::integer;
  invalid_emitted_count:=
    (counts#>>'{codegenInput,invalidEmittedCount}')::integer;
  canonical_compilable_count:=
    (counts#>>'{codegenInput,canonicalCompilableCount}')::integer;
  canonical_missing_count:=
    (counts#>>'{codegenInput,canonicalMissingCount}')::integer;
  canonical_duplicate_count:=
    (counts#>>'{codegenInput,canonicalDuplicateCount}')::integer;
  canonical_incomplete_count:=
    (counts#>>'{codegenInput,canonicalIncompleteCount}')::integer;
  normalized_identity_duplicate_group_count:=
    (counts#>>'{codegenInput,normalizedIdentityDuplicateGroupCount}')::integer;
  step_count:=(counts#>>'{codegenInput,stepCount}')::integer;
  step_eligible_count:=(counts#>>'{codegenInput,eligibleCount}')::integer;
  step_blocker_count:=(counts#>>'{codegenInput,stepBlockerCount}')::integer;
  package_shape_attestation_coverage:=
    (counts#>>'{codegenInput,packageShapeAttestationCoverage}')::integer;
  SELECT count(*)::integer INTO active_binding_count
    FROM (
      SELECT DISTINCT upper(process_code) process_code FROM (
        SELECT process_code FROM public.framework_process_definition
        UNION
        SELECT scope_process process_code
          FROM public.framework_canonical_endpoint_upgrade_activation_event
      ) authoritative_scopes
    ) source
   WHERE public.framework_canonical_endpoint_effective_binding(source.process_code)
           ->>'status'='ACTIVE';
  -- Legacy ACTIVE bindings are telemetry only. SOURCE is authoritative for
  -- SOURCE_IMMEDIATE_V1 generation and must not be blocked by an older head.
  IF head_schema_version<>2 THEN
    reasons:=reasons||jsonb_build_array('CANONICAL_SCHEMA_V2_REQUIRED');
  END IF;
  IF generated_count IS NULL OR manual_count IS NULL OR hybrid_count IS NULL
     OR inventory_count IS NULL OR emitted_count IS NULL
     OR incremental_pagination_required_count IS NULL
     OR invalid_inventory_count IS NULL OR invalid_page_slug_count IS NULL
     OR duplicate_page_slug_group_count IS NULL OR orphan_inventory_count IS NULL
     OR inventory_overflow_count IS NULL OR invalid_emitted_count IS NULL
     OR canonical_compilable_count IS NULL OR canonical_missing_count IS NULL
     OR canonical_duplicate_count IS NULL OR canonical_incomplete_count IS NULL
     OR normalized_identity_duplicate_group_count IS NULL OR step_count IS NULL
     OR step_eligible_count IS NULL OR step_blocker_count IS NULL
     OR package_shape_attestation_coverage IS NULL THEN
    reasons:=reasons||jsonb_build_array('CODEGEN_COUNTS_INVALID');
  END IF;
  IF inventory_count=0 THEN
    reasons:=reasons||jsonb_build_array('NO_VALID_DESIGN_INVENTORY');
  ELSIF inventory_overflow_count>0 THEN
    reasons:=reasons||jsonb_build_array('DESIGN_INVENTORY_LIMIT_EXCEEDED');
  END IF;
  IF orphan_inventory_count>0 THEN
    reasons:=reasons||jsonb_build_array('DESIGN_INVENTORY_ORPHANED');
  END IF;
  IF step_count=0 THEN
    reasons:=reasons||jsonb_build_array('NO_STEP_EXECUTION_SPEC');
  END IF;
  IF step_blocker_count>0 OR step_eligible_count<>step_count THEN
    reasons:=reasons||jsonb_build_array('STEP_EXECUTION_NOT_ELIGIBLE');
  END IF;
  IF package_shape_attestation_coverage<>step_count THEN
    reasons:=reasons||jsonb_build_array('STEP_PACKAGE_SHAPE_ATTESTATION_PENDING');
  END IF;
  IF invalid_inventory_count>0 THEN
    reasons:=reasons||jsonb_build_array('DESIGN_INVENTORY_INVALID');
  END IF;
  IF invalid_page_slug_count>0 THEN
    reasons:=reasons||jsonb_build_array('DESIGN_PAGE_ID_INVALID');
  END IF;
  IF duplicate_page_slug_group_count>0 THEN
    reasons:=reasons||jsonb_build_array('DESIGN_PAGE_ID_DUPLICATE');
  END IF;
  IF invalid_emitted_count>0 THEN
    reasons:=reasons||jsonb_build_array('INCREMENTAL_EMITTED_INVALID');
  END IF;
  IF incremental_pagination_required_count>0 THEN
    reasons:=reasons||jsonb_build_array('INCREMENTAL_PAGINATION_REQUIRED');
  END IF;
  IF normalized_identity_duplicate_group_count>0 THEN
    reasons:=reasons||jsonb_build_array('CANONICAL_BLUEPRINT_IDENTITY_DUPLICATE');
  END IF;
  IF canonical_missing_count>0 THEN
    reasons:=reasons||jsonb_build_array('PROFESSIONAL_CONTRACT_MISSING');
  END IF;
  IF canonical_duplicate_count>0 THEN
    reasons:=reasons||jsonb_build_array('PROFESSIONAL_CONTRACT_DUPLICATE');
  END IF;
  IF canonical_incomplete_count>0 THEN
    reasons:=reasons||jsonb_build_array('PROFESSIONAL_CONTRACT_INCOMPLETE');
  END IF;
  IF canonical_compilable_count=0 THEN
    reasons:=reasons||jsonb_build_array('NO_CANONICAL_COMPILABLE_SCREEN');
  END IF;
  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-codegen-readiness/v1',
    'activationPolicy','SOURCE_IMMEDIATE_V1',
    'generationEnforcement',true,'deploymentWiring',1,
    'status',CASE WHEN jsonb_array_length(reasons)=0 THEN 'READY' ELSE 'BLOCKED' END,
    'reasons',reasons,'activeBindingCount',active_binding_count,
    'inventoryScreenCount',inventory_count,
    'emittedScreenCount',emitted_count,
    'incrementalDiscoveryCapacity',1000,
    'incrementalPaginationRequiredCount',incremental_pagination_required_count,
    'orphanInventoryCount',orphan_inventory_count,
    'invalidPageSlugCount',invalid_page_slug_count,
    'duplicatePageSlugGroupCount',duplicate_page_slug_group_count,
    'inventoryOverflowCount',inventory_overflow_count,
    'stepCount',step_count,
    'stepEligibleCount',step_eligible_count,
    'stepBlockerCount',step_blocker_count,
    'packageShapeAttestationCoverage',package_shape_attestation_coverage,
    'canonicalSource',jsonb_build_object(
      'compilableCount',canonical_compilable_count,
      'missingCount',canonical_missing_count,
      'duplicateCount',canonical_duplicate_count,
      'incompleteCount',canonical_incomplete_count,
      'normalizedIdentityDuplicateGroupCount',
        normalized_identity_duplicate_group_count
    ),
    'ownership',jsonb_build_object(
      'generated',generated_count,'manual',manual_count,'hybrid',hybrid_count
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-codegen-readiness/v1',
    'activationPolicy','SOURCE_IMMEDIATE_V1',
    'generationEnforcement',true,'deploymentWiring',1,
    'status','BLOCKED','reasons',jsonb_build_array('SOURCE_CONTRACT_INVALID'),
    'activeBindingCount',NULL,'inventoryScreenCount',NULL,'emittedScreenCount',NULL,
    'incrementalDiscoveryCapacity',1000,
    'incrementalPaginationRequiredCount',NULL,
    'orphanInventoryCount',NULL,'inventoryOverflowCount',NULL,
    'invalidPageSlugCount',NULL,'duplicatePageSlugGroupCount',NULL,
    'stepCount',NULL,
    'stepEligibleCount',NULL,'stepBlockerCount',NULL,
    'packageShapeAttestationCoverage',0,
    'canonicalSource',jsonb_build_object(
      'compilableCount',NULL,'missingCount',NULL,'duplicateCount',NULL,
      'incompleteCount',NULL,'normalizedIdentityDuplicateGroupCount',NULL
    ),
    'ownership',jsonb_build_object('generated',NULL,'manual',NULL,'hybrid',NULL)
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_snapshot()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  process_doc jsonb; actor_doc jsonb; account_doc jsonb;
  requirement_doc jsonb; grant_doc jsonb; codegen_doc jsonb;
BEGIN
  process_doc:=public.framework_design_causality_process_component();
  actor_doc:=public.framework_design_causality_actor_component();
  account_doc:=public.framework_design_causality_account_component();
  requirement_doc:=public.framework_design_causality_permission_requirement_component();
  grant_doc:=public.framework_design_causality_permission_grant_component();
  codegen_doc:=public.framework_design_causality_codegen_input_component();
  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-root/v2',
    'process',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(process_doc),
      'processCount',(process_doc->>'processCount')::bigint,
      'stepCount',(process_doc->>'stepCount')::bigint
    ),
    'actor',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(actor_doc),
      'actorCount',(actor_doc->>'actorCount')::bigint
    ),
    'accountAssignment',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(account_doc),
      'assignmentCount',(account_doc->>'assignmentCount')::bigint
    ),
    'permissionRequirement',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(requirement_doc),
      'normalizedCount',(requirement_doc->>'normalizedCount')::bigint,
      'featureCount',(requirement_doc->>'featureCount')::bigint,
      'fieldBindingCount',(requirement_doc->>'fieldBindingCount')::bigint,
      'screenGuardCount',(requirement_doc->>'screenGuardCount')::bigint,
      'mappingComplete',(requirement_doc->>'mappingComplete')::boolean
    ),
    'permissionGrant',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(grant_doc),
      'normalizedCount',(grant_doc->>'normalizedCount')::bigint,
      'legacyRoleGrantCount',(grant_doc->>'legacyRoleGrantCount')::bigint,
      'legacyUserOverrideCount',(grant_doc->>'legacyUserOverrideCount')::bigint,
      'legacyAccountRoleCount',(grant_doc->>'legacyAccountRoleCount')::bigint,
      'mappingComplete',(grant_doc->>'mappingComplete')::boolean
    ),
    'codegenInput',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(codegen_doc),
      'inventoryScreenCount',
        (codegen_doc#>>'{designInventory,screenCount}')::bigint,
      'emittedScreenCount',
        (codegen_doc#>>'{incrementalEmitted,screenCount}')::bigint,
      'incrementalDiscoveryCapacity',
        (codegen_doc#>>'{incrementalEmitted,discoveryCapacity}')::bigint,
      'incrementalPaginationRequiredCount',
        (codegen_doc#>>'{incrementalEmitted,paginationRequiredCount}')::bigint,
      'generatedCount',(codegen_doc#>>'{designInventory,generatedCount}')::bigint,
      'manualCount',(codegen_doc#>>'{designInventory,manualCount}')::bigint,
      'hybridCount',(codegen_doc#>>'{designInventory,hybridCount}')::bigint,
      'invalidInventoryCount',
        (codegen_doc#>>'{designInventory,invalidCount}')::bigint,
      'invalidPageSlugCount',
        (codegen_doc#>>'{designInventory,invalidPageSlugCount}')::bigint,
      'duplicatePageSlugGroupCount',
        (codegen_doc#>>'{designInventory,duplicatePageSlugGroupCount}')::bigint,
      'orphanInventoryCount',
        (codegen_doc#>>'{designInventory,orphanCount}')::bigint,
      'inventoryOverflowCount',
        (codegen_doc#>>'{designInventory,overflowCount}')::bigint,
      'invalidEmittedCount',
        (codegen_doc#>>'{incrementalEmitted,invalidCount}')::bigint,
      'canonicalCompilableCount',
        (codegen_doc#>>'{canonicalSource,compilableCount}')::bigint,
      'canonicalMissingCount',
        (codegen_doc#>>'{canonicalSource,missingCount}')::bigint,
      'canonicalDuplicateCount',
        (codegen_doc#>>'{canonicalSource,duplicateCount}')::bigint,
      'canonicalIncompleteCount',
        (codegen_doc#>>'{canonicalSource,incompleteLaneCount}')::bigint,
      'normalizedIdentityDuplicateGroupCount',
        (codegen_doc#>>'{canonicalSource,normalizedIdentityDuplicateGroupCount}')::bigint,
      'normalizedIdentityDuplicateRowCount',
        (codegen_doc#>>'{canonicalSource,normalizedIdentityDuplicateRowCount}')::bigint,
      'stepCount',(codegen_doc#>>'{stepExecution,stepCount}')::bigint,
      'eligibleCount',(codegen_doc#>>'{stepExecution,eligibleCount}')::bigint,
      'stepBlockerCount',(codegen_doc#>>'{stepExecution,blockerCount}')::bigint,
      'packageShapeAttestationCoverage',
        (codegen_doc#>>'{stepExecution,packageShapeAttestationCoverage}')::bigint
    )
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_row_counts(snapshot jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'process',(snapshot->'process')-'hash',
    'actor',(snapshot->'actor')-'hash',
    'accountAssignment',(snapshot->'accountAssignment')-'hash',
    'permissionRequirement',(snapshot->'permissionRequirement')-'hash',
    'permissionGrant',(snapshot->'permissionGrant')-'hash',
    'codegenInput',(snapshot->'codegenInput')-'hash'
  )
$$;

CREATE OR REPLACE FUNCTION framework_mark_design_causality_dirty(requested_mask integer)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_mask<1 OR requested_mask>63 THEN
    RAISE EXCEPTION 'design causality change mask must be between 1 and 63'
      USING ERRCODE='22023';
  END IF;
  INSERT INTO public.framework_design_change_signal(
    source_txid,scope_key,change_mask
  ) VALUES(txid_current(),'GLOBAL',requested_mask)
  ON CONFLICT(scope_key,source_txid) DO UPDATE
    SET change_mask=public.framework_design_change_signal.change_mask |
                    excluded.change_mask;
END
$$;

CREATE OR REPLACE FUNCTION framework_compile_design_changes(
  worker_name varchar,expected_revision bigint,expected_canonical_hash varchar
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  worker varchar(100):=btrim(worker_name);
  head_row public.framework_design_causality_head%ROWTYPE;
  snapshot jsonb; root_hash varchar(64); counts jsonb;
  process_doc jsonb; actor_doc jsonb; account_doc jsonb;
  requirement_doc jsonb; grant_doc jsonb; codegen_doc jsonb;
  process_section jsonb; actor_section jsonb; account_section jsonb;
  requirement_section jsonb; grant_section jsonb; codegen_section jsonb;
  signal_ids bigint[]; combined_mask integer; signal_count integer;
  new_event public.framework_design_causality_event%ROWTYPE;
  old_stage varchar(32); old_version bigint; supersede_evidence varchar(64);
  supersede_evidence_ref varchar(500); initial_evidence_ref varchar(500);
  old_transition_hash varchar(64); initial_evidence varchar(64); affected integer;
BEGIN
  IF current_setting('transaction_isolation') NOT IN ('repeatable read','serializable') THEN
    RAISE EXCEPTION 'design compiler requires REPEATABLE READ or SERIALIZABLE'
      USING ERRCODE='25001';
  END IF;
  IF worker IS NULL OR worker !~ '^[A-Za-z0-9._:-]{1,100}$' THEN
    RAISE EXCEPTION 'invalid design compiler worker name' USING ERRCODE='22023';
  END IF;
  IF expected_revision IS NULL OR expected_canonical_hash IS NULL OR
     expected_canonical_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid expected canonical hash' USING ERRCODE='22023';
  END IF;
  IF NOT pg_try_advisory_xact_lock(1128354388,1380271955) THEN
    RETURN jsonb_build_object('status','BUSY');
  END IF;

  SELECT * INTO STRICT head_row FROM public.framework_design_causality_head
   WHERE scope_key='GLOBAL' FOR UPDATE;
  IF head_row.revision<>expected_revision OR
     head_row.canonical_hash<>expected_canonical_hash THEN
    RAISE EXCEPTION 'stale design head: expected revision/hash %/%, actual %/%',
      expected_revision,expected_canonical_hash,head_row.revision,head_row.canonical_hash
      USING ERRCODE='40001';
  END IF;

  SELECT array_agg(signal_id ORDER BY signal_id),bit_or(change_mask),count(*)
    INTO signal_ids,combined_mask,signal_count
    FROM (
      SELECT signal_id,change_mask FROM public.framework_design_change_signal
       WHERE signal_status='DIRTY' ORDER BY signal_id FOR UPDATE
    ) locked_signals;
  IF signal_count=0 THEN
    RETURN jsonb_build_object(
      'status','NO_WORK','revision',head_row.revision,
      'canonicalHash',head_row.canonical_hash
    );
  END IF;

  -- Recompute only components affected by the coalesced source mask in this
  -- MVCC snapshot. Unchanged hashes/counts are immutable facts from the locked
  -- head. PROCESS also invalidates codegen input because inventory membership
  -- joins process/step definitions. The bit-63 bootstrap materializes all six
  -- v2 summaries while preserving immutable v1 head/event history bytes.
  IF (combined_mask & 1)<>0 THEN
    process_doc:=public.framework_design_causality_process_component();
    process_section:=jsonb_build_object(
      'hash',public.framework_design_causality_sha256(process_doc),
      'processCount',(process_doc->>'processCount')::bigint,
      'stepCount',(process_doc->>'stepCount')::bigint
    );
  ELSE
    process_section:=jsonb_build_object('hash',head_row.process_hash)||
      coalesce(head_row.row_counts->'process','{}'::jsonb);
  END IF;
  IF (combined_mask & 2)<>0 THEN
    actor_doc:=public.framework_design_causality_actor_component();
    actor_section:=jsonb_build_object(
      'hash',public.framework_design_causality_sha256(actor_doc),
      'actorCount',(actor_doc->>'actorCount')::bigint
    );
  ELSE
    actor_section:=jsonb_build_object('hash',head_row.actor_hash)||
      coalesce(head_row.row_counts->'actor','{}'::jsonb);
  END IF;
  IF (combined_mask & 4)<>0 THEN
    account_doc:=public.framework_design_causality_account_component();
    account_section:=jsonb_build_object(
      'hash',public.framework_design_causality_sha256(account_doc),
      'assignmentCount',(account_doc->>'assignmentCount')::bigint
    );
  ELSE
    account_section:=jsonb_build_object('hash',head_row.account_assignment_hash)||
      coalesce(head_row.row_counts->'accountAssignment','{}'::jsonb);
  END IF;
  IF (combined_mask & 8)<>0 THEN
    requirement_doc:=public.framework_design_causality_permission_requirement_component();
    requirement_section:=jsonb_build_object(
      'hash',public.framework_design_causality_sha256(requirement_doc),
      'normalizedCount',(requirement_doc->>'normalizedCount')::bigint,
      'featureCount',(requirement_doc->>'featureCount')::bigint,
      'fieldBindingCount',(requirement_doc->>'fieldBindingCount')::bigint,
      'screenGuardCount',(requirement_doc->>'screenGuardCount')::bigint,
      'mappingComplete',(requirement_doc->>'mappingComplete')::boolean
    );
  ELSE
    requirement_section:=jsonb_build_object(
      'hash',head_row.permission_requirement_hash
    )||coalesce(head_row.row_counts->'permissionRequirement','{}'::jsonb);
  END IF;
  IF (combined_mask & 16)<>0 THEN
    grant_doc:=public.framework_design_causality_permission_grant_component();
    grant_section:=jsonb_build_object(
      'hash',public.framework_design_causality_sha256(grant_doc),
      'normalizedCount',(grant_doc->>'normalizedCount')::bigint,
      'legacyRoleGrantCount',(grant_doc->>'legacyRoleGrantCount')::bigint,
      'legacyUserOverrideCount',(grant_doc->>'legacyUserOverrideCount')::bigint,
      'legacyAccountRoleCount',(grant_doc->>'legacyAccountRoleCount')::bigint,
      'mappingComplete',(grant_doc->>'mappingComplete')::boolean
    );
  ELSE
    grant_section:=jsonb_build_object('hash',head_row.permission_grant_hash)||
      coalesce(head_row.row_counts->'permissionGrant','{}'::jsonb);
  END IF;
  IF head_row.canonical_schema_version=1 OR (combined_mask & 33)<>0 THEN
    codegen_doc:=public.framework_design_causality_codegen_input_component();
    codegen_section:=jsonb_build_object(
      'hash',public.framework_design_causality_sha256(codegen_doc),
      'inventoryScreenCount',
        (codegen_doc#>>'{designInventory,screenCount}')::bigint,
      'emittedScreenCount',
        (codegen_doc#>>'{incrementalEmitted,screenCount}')::bigint,
      'incrementalDiscoveryCapacity',
        (codegen_doc#>>'{incrementalEmitted,discoveryCapacity}')::bigint,
      'incrementalPaginationRequiredCount',
        (codegen_doc#>>'{incrementalEmitted,paginationRequiredCount}')::bigint,
      'generatedCount',(codegen_doc#>>'{designInventory,generatedCount}')::bigint,
      'manualCount',(codegen_doc#>>'{designInventory,manualCount}')::bigint,
      'hybridCount',(codegen_doc#>>'{designInventory,hybridCount}')::bigint,
      'invalidInventoryCount',
        (codegen_doc#>>'{designInventory,invalidCount}')::bigint,
      'invalidPageSlugCount',
        (codegen_doc#>>'{designInventory,invalidPageSlugCount}')::bigint,
      'duplicatePageSlugGroupCount',
        (codegen_doc#>>'{designInventory,duplicatePageSlugGroupCount}')::bigint,
      'orphanInventoryCount',
        (codegen_doc#>>'{designInventory,orphanCount}')::bigint,
      'inventoryOverflowCount',
        (codegen_doc#>>'{designInventory,overflowCount}')::bigint,
      'invalidEmittedCount',
        (codegen_doc#>>'{incrementalEmitted,invalidCount}')::bigint,
      'canonicalCompilableCount',
        (codegen_doc#>>'{canonicalSource,compilableCount}')::bigint,
      'canonicalMissingCount',
        (codegen_doc#>>'{canonicalSource,missingCount}')::bigint,
      'canonicalDuplicateCount',
        (codegen_doc#>>'{canonicalSource,duplicateCount}')::bigint,
      'canonicalIncompleteCount',
        (codegen_doc#>>'{canonicalSource,incompleteLaneCount}')::bigint,
      'normalizedIdentityDuplicateGroupCount',
        (codegen_doc#>>'{canonicalSource,normalizedIdentityDuplicateGroupCount}')::bigint,
      'normalizedIdentityDuplicateRowCount',
        (codegen_doc#>>'{canonicalSource,normalizedIdentityDuplicateRowCount}')::bigint,
      'stepCount',(codegen_doc#>>'{stepExecution,stepCount}')::bigint,
      'eligibleCount',(codegen_doc#>>'{stepExecution,eligibleCount}')::bigint,
      'stepBlockerCount',(codegen_doc#>>'{stepExecution,blockerCount}')::bigint,
      'packageShapeAttestationCoverage',
        (codegen_doc#>>'{stepExecution,packageShapeAttestationCoverage}')::bigint
    );
  ELSE
    codegen_section:=jsonb_build_object('hash',head_row.codegen_input_hash)||
      coalesce(head_row.row_counts->'codegenInput','{}'::jsonb);
  END IF;
  snapshot:=jsonb_build_object(
    'schema','carbonet.design-causality-root/v2',
    'process',process_section,'actor',actor_section,
    'accountAssignment',account_section,
    'permissionRequirement',requirement_section,
    'permissionGrant',grant_section,'codegenInput',codegen_section
  );
  IF snapshot->>'schema'<>'carbonet.design-causality-root/v2' THEN
    RAISE EXCEPTION 'design compiler requires canonical root v2'
      USING ERRCODE='55000';
  END IF;
  root_hash:=public.framework_design_causality_sha256(snapshot);
  counts:=public.framework_design_causality_row_counts(snapshot);
  IF root_hash=head_row.canonical_hash AND head_row.canonical_schema_version=2 THEN
    UPDATE public.framework_design_change_signal SET signal_status='NOOP'
     WHERE signal_id=ANY(signal_ids) AND signal_status='DIRTY';
    RETURN jsonb_build_object(
      'status','NO_SEMANTIC_CHANGE','revision',head_row.revision,
      'canonicalHash',head_row.canonical_hash,'signalCount',signal_count
    );
  END IF;

  INSERT INTO public.framework_design_causality_event(
    scope_key,revision,previous_hash,canonical_hash,process_hash,actor_hash,
    account_assignment_hash,permission_requirement_hash,permission_grant_hash,
    codegen_input_hash,row_counts,canonical_schema_version,change_mask,event_hash
  ) VALUES (
    'GLOBAL',head_row.revision+1,head_row.canonical_hash,root_hash,
    snapshot#>>'{process,hash}',snapshot#>>'{actor,hash}',
    snapshot#>>'{accountAssignment,hash}',snapshot#>>'{permissionRequirement,hash}',
    snapshot#>>'{permissionGrant,hash}',snapshot#>>'{codegenInput,hash}',counts,2,
    combined_mask,
    public.framework_design_causality_event_hash_v2(
      head_row.revision+1,head_row.canonical_hash,root_hash,
      snapshot#>>'{process,hash}',snapshot#>>'{actor,hash}',
      snapshot#>>'{accountAssignment,hash}',snapshot#>>'{permissionRequirement,hash}',
      snapshot#>>'{permissionGrant,hash}',snapshot#>>'{codegenInput,hash}',
      counts,combined_mask
    )
  ) RETURNING * INTO new_event;

  INSERT INTO public.framework_design_causality_event_signal(event_id,signal_id)
  SELECT new_event.event_id,unnest(signal_ids);

  IF head_row.current_event_id IS NOT NULL THEN
    SELECT s.current_stage,s.stage_version,t.row_hash
      INTO old_stage,old_version,old_transition_hash
      FROM public.framework_design_causality_stage s
      JOIN public.framework_design_causality_stage_transition t
        ON t.event_id=s.event_id AND t.new_version=s.stage_version
     WHERE s.event_id=head_row.current_event_id FOR UPDATE OF s;
    IF old_stage NOT IN ('RELAY_E2E_PASSED','SUPERSEDED','TERMINAL_FAILED') THEN
      supersede_evidence:=public.framework_design_causality_sha256(jsonb_build_object(
        'action','SUPERSEDED_BY_NEW_CANONICAL_HEAD',
        'newEventId',new_event.event_id,'newCanonicalHash',root_hash
      ));
      supersede_evidence_ref:=format(
        'db://design-causality/event/%s/superseded-by/%s',
        head_row.current_event_id,new_event.event_id
      );
      UPDATE public.framework_design_causality_stage
         SET current_stage='SUPERSEDED',stage_version=old_version+1,
             lease_owner=NULL,lease_expires_at=NULL,
             evidence_ref=supersede_evidence_ref,updated_at=clock_timestamp()
       WHERE event_id=head_row.current_event_id AND stage_version=old_version;
      GET DIAGNOSTICS affected=ROW_COUNT;
      IF affected<>1 THEN
        RAISE EXCEPTION 'superseded stage CAS lost' USING ERRCODE='40001';
      END IF;
      INSERT INTO public.framework_design_causality_stage_transition(
        event_id,new_version,from_stage,to_stage,evidence_hash,evidence_ref,
        previous_transition_hash,transition_actor,row_hash
      ) VALUES(
        head_row.current_event_id,old_version+1,old_stage,'SUPERSEDED',
        supersede_evidence,supersede_evidence_ref,old_transition_hash,worker,
        public.framework_design_causality_transition_hash(
          head_row.current_event_id,old_version+1,old_stage,'SUPERSEDED',
          supersede_evidence,supersede_evidence_ref,worker,old_transition_hash
        )
      );
    END IF;
  END IF;

  INSERT INTO public.framework_design_causality_stage(event_id,current_stage,stage_version)
  VALUES(new_event.event_id,'CANONICAL_COMPILED',0);
  initial_evidence:=public.framework_design_causality_sha256(jsonb_build_object(
    'action','CANONICAL_COMPILED','canonicalHash',root_hash,
    'canonicalSchemaVersion',2,'codegenInputHash',new_event.codegen_input_hash,
    'signalCount',signal_count,'changeMask',combined_mask
  ));
  initial_evidence_ref:=format(
    'db://design-causality/event/%s/canonical-compiled',new_event.event_id
  );
  INSERT INTO public.framework_design_causality_stage_transition(
    event_id,new_version,from_stage,to_stage,evidence_hash,evidence_ref,
    previous_transition_hash,transition_actor,row_hash
  ) VALUES(
    new_event.event_id,0,'NONE','CANONICAL_COMPILED',initial_evidence,
    initial_evidence_ref,NULL,worker,
    public.framework_design_causality_transition_hash(
      new_event.event_id,0,'NONE','CANONICAL_COMPILED',initial_evidence,
      initial_evidence_ref,worker,NULL
    )
  );

  UPDATE public.framework_design_causality_head SET
    revision=new_event.revision,canonical_schema_version=2,canonical_hash=root_hash,
    process_hash=new_event.process_hash,actor_hash=new_event.actor_hash,
    account_assignment_hash=new_event.account_assignment_hash,
    permission_requirement_hash=new_event.permission_requirement_hash,
    permission_grant_hash=new_event.permission_grant_hash,
    codegen_input_hash=new_event.codegen_input_hash,row_counts=counts,
    current_event_id=new_event.event_id,updated_at=clock_timestamp()
   WHERE scope_key='GLOBAL' AND revision=head_row.revision
     AND canonical_hash=head_row.canonical_hash;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN
    RAISE EXCEPTION 'design head CAS lost' USING ERRCODE='40001';
  END IF;
  UPDATE public.framework_design_change_signal
     SET signal_status='COMPILED',compiled_event_id=new_event.event_id
   WHERE signal_id=ANY(signal_ids) AND signal_status='DIRTY';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>signal_count THEN
    RAISE EXCEPTION 'dirty signal attribution CAS lost' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object(
    'status','COMPILED','eventId',new_event.event_id,'revision',new_event.revision,
    'canonicalHash',root_hash,'canonicalSchemaVersion',2,
    'codegenInputHash',new_event.codegen_input_hash,
    'signalCount',signal_count,'changeMask',combined_mask,
    'currentStage','CANONICAL_COMPILED'
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_codegen_semantic_row(
  requested_table text,source_row jsonb
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
BEGIN
  CASE requested_table
    WHEN 'framework_screen_blueprint' THEN
      RETURN source_row-ARRAY[
        'validation_message','generated_source_path','created_by',
        'created_at','updated_at','transition_status','source_reference'
      ];
    WHEN 'framework_professional_screen_contract' THEN
      RETURN source_row-ARRAY[
        'updated_by','created_at','updated_at'
      ];
    WHEN 'framework_step_execution_spec' THEN
      RETURN public.framework_design_causality_codegen_step_row(source_row);
    ELSE
      RAISE EXCEPTION 'unsupported codegen-input source table: %',requested_table
        USING ERRCODE='22023';
  END CASE;
END
$$;

CREATE OR REPLACE FUNCTION framework_capture_design_causality_codegen_dirty()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP='UPDATE' AND
     public.framework_design_causality_codegen_semantic_row(
       TG_TABLE_NAME,to_jsonb(OLD)
     ) IS NOT DISTINCT FROM
     public.framework_design_causality_codegen_semantic_row(
       TG_TABLE_NAME,to_jsonb(NEW)
     ) THEN
    RETURN NEW;
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'framework_screen_blueprint' THEN
      IF TG_OP='DELETE' THEN
        PERFORM public.framework_refresh_design_codegen_blueprint_leaf(
          (to_jsonb(OLD)->>'blueprint_id')::bigint
        );
      ELSIF TG_OP='INSERT' THEN
        PERFORM public.framework_refresh_design_codegen_blueprint_leaf(
          (to_jsonb(NEW)->>'blueprint_id')::bigint
        );
      ELSE
        IF OLD.blueprint_id IS DISTINCT FROM NEW.blueprint_id THEN
          PERFORM public.framework_refresh_design_codegen_blueprint_leaf(OLD.blueprint_id);
        END IF;
        PERFORM public.framework_refresh_design_codegen_blueprint_leaf(NEW.blueprint_id);
      END IF;
    WHEN 'framework_professional_screen_contract' THEN
      IF TG_OP='DELETE' THEN
        PERFORM public.framework_refresh_design_codegen_contract_leaf(
          (to_jsonb(OLD)->>'contract_id')::bigint
        );
      ELSIF TG_OP='INSERT' THEN
        PERFORM public.framework_refresh_design_codegen_contract_leaf(
          (to_jsonb(NEW)->>'contract_id')::bigint
        );
      ELSE
        IF OLD.contract_id IS DISTINCT FROM NEW.contract_id THEN
          PERFORM public.framework_refresh_design_codegen_contract_leaf(OLD.contract_id);
        END IF;
        PERFORM public.framework_refresh_design_codegen_contract_leaf(NEW.contract_id);
      END IF;
    WHEN 'framework_step_execution_spec' THEN
      IF TG_OP='DELETE' THEN
        PERFORM public.framework_refresh_design_codegen_step_leaf(
          OLD.process_code,OLD.step_code
        );
      ELSIF TG_OP='INSERT' THEN
        PERFORM public.framework_refresh_design_codegen_step_leaf(
          NEW.process_code,NEW.step_code
        );
      ELSE
        IF (OLD.process_code,OLD.step_code) IS DISTINCT FROM
           (NEW.process_code,NEW.step_code) THEN
          PERFORM public.framework_refresh_design_codegen_step_leaf(
            OLD.process_code,OLD.step_code
          );
        END IF;
        PERFORM public.framework_refresh_design_codegen_step_leaf(
          NEW.process_code,NEW.step_code
        );
      END IF;
    ELSE
      RAISE EXCEPTION 'unsupported codegen cache source: %',TG_TABLE_NAME
        USING ERRCODE='22023';
  END CASE;
  PERFORM public.framework_mark_design_causality_dirty(
    CASE WHEN TG_TABLE_NAME='framework_professional_screen_contract'
         THEN 40 ELSE 32 END);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE OR REPLACE FUNCTION framework_capture_design_causality_codegen_truncate_dirty()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'framework_screen_blueprint' THEN
      TRUNCATE TABLE public.framework_design_codegen_blueprint_leaf_cache;
    WHEN 'framework_professional_screen_contract' THEN
      TRUNCATE TABLE public.framework_design_codegen_contract_leaf_cache;
    WHEN 'framework_step_execution_spec' THEN
      TRUNCATE TABLE public.framework_design_codegen_step_leaf_cache;
    ELSE
      RAISE EXCEPTION 'unsupported codegen cache truncate source: %',TG_TABLE_NAME
        USING ERRCODE='22023';
  END CASE;
  PERFORM public.framework_mark_design_causality_dirty(
    CASE WHEN TG_TABLE_NAME='framework_professional_screen_contract'
         THEN 40 ELSE 32 END);
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION framework_capture_design_permission_cache_dirty()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP='UPDATE' AND
     public.framework_design_causality_semantic_row(TG_TABLE_NAME,to_jsonb(OLD))
       IS NOT DISTINCT FROM
     public.framework_design_causality_semantic_row(TG_TABLE_NAME,to_jsonb(NEW)) THEN
    IF TG_TABLE_NAME='framework_page_design' AND
       OLD.page_design_id IS DISTINCT FROM NEW.page_design_id THEN
      NULL;
    ELSIF TG_TABLE_NAME='framework_page_field_definition' AND
          (OLD.page_field_id,OLD.page_design_id) IS DISTINCT FROM
          (NEW.page_field_id,NEW.page_design_id) THEN
      NULL;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'framework_permission_requirement_v1' THEN
      IF TG_OP<>'INSERT' THEN
        PERFORM public.framework_refresh_design_permission_requirement_leaf(
          OLD.process_code,OLD.step_code,OLD.permission_code,OLD.scope_type);
      END IF;
      IF TG_OP<>'DELETE' THEN
        PERFORM public.framework_refresh_design_permission_requirement_leaf(
          NEW.process_code,NEW.step_code,NEW.permission_code,NEW.scope_type);
      END IF;
    WHEN 'comtnmenufunctioninfo' THEN
      IF TG_OP<>'INSERT' THEN
        PERFORM public.framework_refresh_design_permission_feature_leaf(OLD.feature_code);
      END IF;
      IF TG_OP<>'DELETE' THEN
        PERFORM public.framework_refresh_design_permission_feature_leaf(NEW.feature_code);
      END IF;
    WHEN 'framework_page_design' THEN
      IF TG_OP<>'INSERT' THEN
        PERFORM public.framework_refresh_design_permission_page_leafs(OLD.page_design_id);
      END IF;
      IF TG_OP<>'DELETE' AND
         (TG_OP<>'UPDATE' OR OLD.page_design_id IS DISTINCT FROM NEW.page_design_id) THEN
        PERFORM public.framework_refresh_design_permission_page_leafs(NEW.page_design_id);
      END IF;
    WHEN 'framework_page_field_definition' THEN
      IF TG_OP<>'INSERT' THEN
        PERFORM public.framework_refresh_design_permission_field_leaf(OLD.page_field_id);
      END IF;
      IF TG_OP<>'DELETE' THEN
        PERFORM public.framework_refresh_design_permission_field_leaf(NEW.page_field_id);
      END IF;
    WHEN 'framework_permission_mapping_control_v1' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'unsupported permission cache source: %',TG_TABLE_NAME
        USING ERRCODE='22023';
  END CASE;
  PERFORM public.framework_mark_design_causality_dirty(
    CASE WHEN TG_TABLE_NAME='framework_permission_mapping_control_v1'
         THEN 24 ELSE 8 END);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE OR REPLACE FUNCTION framework_capture_design_causality_v2_truncate_dirty()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE requested_mask integer;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'framework_process_definition' THEN requested_mask:=1;
    WHEN 'framework_process_step' THEN requested_mask:=1;
    WHEN 'framework_actor_definition' THEN requested_mask:=2;
    WHEN 'framework_account_actor_assignment' THEN requested_mask:=4;
    WHEN 'framework_permission_requirement_v1' THEN
      TRUNCATE TABLE public.framework_design_permission_requirement_leaf_cache;
      requested_mask:=8;
    WHEN 'framework_permission_grant_v1' THEN requested_mask:=16;
    WHEN 'framework_permission_mapping_control_v1' THEN requested_mask:=24;
    WHEN 'framework_page_design' THEN
      TRUNCATE TABLE public.framework_design_permission_field_leaf_cache;
      requested_mask:=8;
    WHEN 'framework_page_field_definition' THEN
      TRUNCATE TABLE public.framework_design_permission_field_leaf_cache;
      requested_mask:=8;
    WHEN 'comtnmenufunctioninfo' THEN
      TRUNCATE TABLE public.framework_design_permission_feature_leaf_cache;
      requested_mask:=8;
    WHEN 'comtnauthorfunctionrelate' THEN requested_mask:=16;
    WHEN 'comtnuserfeatureoverride' THEN requested_mask:=16;
    WHEN 'comtnemplyrscrtyestbs' THEN requested_mask:=16;
    ELSE
      RAISE EXCEPTION 'unsupported v2 truncate source: %',TG_TABLE_NAME
        USING ERRCODE='22023';
  END CASE;
  PERFORM public.framework_mark_design_causality_dirty(requested_mask);
  RETURN NULL;
END
$$;

-- The canonical screen compiler still emits these two CSV columns as raw text.
-- Keep their normalized sets for policy semantics, but bind raw byte changes to
-- the process component until that compiler is migrated to canonical arrays.
-- Input/output contracts use the compiler's exact JSON projection: valid JSON
-- is canonicalized, blank input is {}, and malformed input preserves raw text.
CREATE OR REPLACE FUNCTION framework_capture_design_causality_process_step_raw_dirty()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.evidence_types IS NOT DISTINCT FROM NEW.evidence_types
     AND OLD.segregation_actor_codes IS NOT DISTINCT FROM
       NEW.segregation_actor_codes
     AND public.framework_try_jsonb(OLD.input_contract,'{}'::jsonb)
       IS NOT DISTINCT FROM
       public.framework_try_jsonb(NEW.input_contract,'{}'::jsonb)
     AND public.framework_try_jsonb(OLD.output_contract,'{}'::jsonb)
       IS NOT DISTINCT FROM
       public.framework_try_jsonb(NEW.output_contract,'{}'::jsonb) THEN
    RETURN NEW;
  END IF;
  PERFORM public.framework_mark_design_causality_dirty(1);
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_design_causality_screen_blueprint_codegen_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_screen_blueprint
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_codegen_dirty();
CREATE TRIGGER trg_design_causality_professional_screen_codegen_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_professional_screen_contract
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_codegen_dirty();
CREATE TRIGGER trg_design_causality_step_execution_codegen_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_codegen_dirty();
CREATE TRIGGER trg_design_causality_screen_blueprint_codegen_truncate_dirty
AFTER TRUNCATE ON framework_screen_blueprint
FOR EACH STATEMENT EXECUTE FUNCTION framework_capture_design_causality_codegen_truncate_dirty();
CREATE TRIGGER trg_design_causality_professional_screen_codegen_truncate_dirty
AFTER TRUNCATE ON framework_professional_screen_contract
FOR EACH STATEMENT EXECUTE FUNCTION framework_capture_design_causality_codegen_truncate_dirty();
CREATE TRIGGER trg_design_causality_step_execution_codegen_truncate_dirty
AFTER TRUNCATE ON framework_step_execution_spec
FOR EACH STATEMENT EXECUTE FUNCTION framework_capture_design_causality_codegen_truncate_dirty();

CREATE TRIGGER trg_design_causality_permission_requirement_cache_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_permission_requirement_v1
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_permission_cache_dirty();
CREATE TRIGGER trg_design_causality_menu_function_cache_dirty
AFTER INSERT OR UPDATE OR DELETE ON comtnmenufunctioninfo
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_permission_cache_dirty();
CREATE TRIGGER trg_design_causality_page_design_cache_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_page_design
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_permission_cache_dirty();
CREATE TRIGGER trg_design_causality_page_field_cache_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_page_field_definition
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_permission_cache_dirty();
CREATE TRIGGER trg_design_causality_mapping_cache_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_permission_mapping_control_v1
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_permission_cache_dirty();

CREATE TRIGGER trg_design_causality_process_step_raw_csv_dirty
AFTER UPDATE OF evidence_types,segregation_actor_codes,input_contract,output_contract
ON framework_process_step
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_process_step_raw_dirty();

CREATE TRIGGER trg_design_causality_process_definition_truncate_dirty
AFTER TRUNCATE ON framework_process_definition FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_process_step_truncate_dirty
AFTER TRUNCATE ON framework_process_step FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_actor_truncate_dirty
AFTER TRUNCATE ON framework_actor_definition FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_account_assignment_truncate_dirty
AFTER TRUNCATE ON framework_account_actor_assignment FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_permission_requirement_truncate_dirty
AFTER TRUNCATE ON framework_permission_requirement_v1 FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_permission_grant_truncate_dirty
AFTER TRUNCATE ON framework_permission_grant_v1 FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_mapping_truncate_dirty
AFTER TRUNCATE ON framework_permission_mapping_control_v1 FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_page_design_truncate_dirty
AFTER TRUNCATE ON framework_page_design FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_page_field_truncate_dirty
AFTER TRUNCATE ON framework_page_field_definition FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_menu_function_truncate_dirty
AFTER TRUNCATE ON comtnmenufunctioninfo FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_role_function_grant_truncate_dirty
AFTER TRUNCATE ON comtnauthorfunctionrelate FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_user_override_grant_truncate_dirty
AFTER TRUNCATE ON comtnuserfeatureoverride FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();
CREATE TRIGGER trg_design_causality_account_role_grant_truncate_dirty
AFTER TRUNCATE ON comtnemplyrscrtyestbs FOR EACH STATEMENT
EXECUTE FUNCTION framework_capture_design_causality_v2_truncate_dirty();

ALTER TABLE framework_screen_blueprint ENABLE ALWAYS TRIGGER
  trg_design_causality_screen_blueprint_codegen_dirty;
ALTER TABLE framework_professional_screen_contract ENABLE ALWAYS TRIGGER
  trg_design_causality_professional_screen_codegen_dirty;
ALTER TABLE framework_step_execution_spec ENABLE ALWAYS TRIGGER
  trg_design_causality_step_execution_codegen_dirty;
ALTER TABLE framework_screen_blueprint ENABLE ALWAYS TRIGGER
  trg_design_causality_screen_blueprint_codegen_truncate_dirty;
ALTER TABLE framework_professional_screen_contract ENABLE ALWAYS TRIGGER
  trg_design_causality_professional_screen_codegen_truncate_dirty;
ALTER TABLE framework_step_execution_spec ENABLE ALWAYS TRIGGER
  trg_design_causality_step_execution_codegen_truncate_dirty;
ALTER TABLE framework_permission_requirement_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_permission_requirement_cache_dirty;
ALTER TABLE comtnmenufunctioninfo ENABLE ALWAYS TRIGGER
  trg_design_causality_menu_function_cache_dirty;
ALTER TABLE framework_page_design ENABLE ALWAYS TRIGGER
  trg_design_causality_page_design_cache_dirty;
ALTER TABLE framework_page_field_definition ENABLE ALWAYS TRIGGER
  trg_design_causality_page_field_cache_dirty;
ALTER TABLE framework_permission_mapping_control_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_mapping_cache_dirty;
ALTER TABLE framework_process_step ENABLE ALWAYS TRIGGER
  trg_design_causality_process_step_raw_csv_dirty;

ALTER TABLE framework_process_definition ENABLE ALWAYS TRIGGER
  trg_design_causality_process_definition_truncate_dirty;
ALTER TABLE framework_process_step ENABLE ALWAYS TRIGGER
  trg_design_causality_process_step_truncate_dirty;
ALTER TABLE framework_actor_definition ENABLE ALWAYS TRIGGER
  trg_design_causality_actor_truncate_dirty;
ALTER TABLE framework_account_actor_assignment ENABLE ALWAYS TRIGGER
  trg_design_causality_account_assignment_truncate_dirty;
ALTER TABLE framework_permission_requirement_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_permission_requirement_truncate_dirty;
ALTER TABLE framework_permission_grant_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_permission_grant_truncate_dirty;
ALTER TABLE framework_permission_mapping_control_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_mapping_truncate_dirty;
ALTER TABLE framework_page_design ENABLE ALWAYS TRIGGER
  trg_design_causality_page_design_truncate_dirty;
ALTER TABLE framework_page_field_definition ENABLE ALWAYS TRIGGER
  trg_design_causality_page_field_truncate_dirty;
ALTER TABLE comtnmenufunctioninfo ENABLE ALWAYS TRIGGER
  trg_design_causality_menu_function_truncate_dirty;
ALTER TABLE comtnauthorfunctionrelate ENABLE ALWAYS TRIGGER
  trg_design_causality_role_function_grant_truncate_dirty;
ALTER TABLE comtnuserfeatureoverride ENABLE ALWAYS TRIGGER
  trg_design_causality_user_override_grant_truncate_dirty;
ALTER TABLE comtnemplyrscrtyestbs ENABLE ALWAYS TRIGGER
  trg_design_causality_account_role_grant_truncate_dirty;

CREATE OR REPLACE FUNCTION framework_enforce_design_causality_source_classification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE event_mask integer;
BEGIN
  IF NEW.classification='RUNTIME_ONLY'
     AND OLD.classification IS DISTINCT FROM NEW.classification THEN
    SELECT change_mask INTO STRICT event_mask
      FROM public.framework_design_causality_event WHERE event_id=NEW.event_id;
    -- 1 PROCESS | 2 ACTOR | 8 PERMISSION_REQUIREMENT | 32 CODEGEN_INPUT.
    IF (event_mask & 43)<>0 THEN
      RAISE EXCEPTION 'source-required design change cannot be runtime-only (mask=%)',
        event_mask USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_design_causality_source_classification_guard
BEFORE UPDATE OF classification ON framework_design_causality_stage
FOR EACH ROW EXECUTE FUNCTION framework_enforce_design_causality_source_classification();
ALTER TABLE framework_design_causality_stage ENABLE ALWAYS TRIGGER
  trg_design_causality_source_classification_guard;

CREATE OR REPLACE FUNCTION framework_design_causality_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-status/v2',
    'activationPolicy','SOURCE_IMMEDIATE_V1',
    'generationEnforcement',true,'deploymentWiring',1,
    'producerCoverage',jsonb_build_object(
      'databaseDirtySignal',1,'postCommitCompiler',1,'generator',1,
      'deployment',1,'runtimeProbe',1,'relayE2e',1
    ),
    'head',jsonb_build_object(
      'revision',h.revision,'canonicalSchemaVersion',h.canonical_schema_version,
      'canonicalHash',h.canonical_hash,'codegenInputHash',h.codegen_input_hash,
      'currentEventId',h.current_event_id,
      'currentStage',s.current_stage,'stageVersion',s.stage_version
    ),
    'dirtySignalCount',(
      SELECT count(*) FROM public.framework_design_change_signal
       WHERE signal_status='DIRTY'
    ),
    'mappingComplete',jsonb_build_object(
      'permissionRequirement',h.row_counts#>'{permissionRequirement,mappingComplete}',
      'permissionGrant',h.row_counts#>'{permissionGrant,mappingComplete}'
    ),
    'codegenReadiness',public.framework_design_causality_codegen_readiness()
  )
  FROM public.framework_design_causality_head h
  LEFT JOIN public.framework_design_causality_stage s
    ON s.event_id=h.current_event_id
  WHERE h.scope_key='GLOBAL'
$$;

CREATE OR REPLACE FUNCTION framework_run_design_causality_compiler_worker()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  compiler_result jsonb;
  compiler_status text;
  observed_stage text;
  before_revision bigint;
  dirty_signal_count bigint;
  head_row public.framework_design_causality_head%ROWTYPE;
  codegen_readiness jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'carbonet_design_compiler' THEN
    RAISE EXCEPTION 'design compiler worker API requires SET LOCAL ROLE carbonet_design_compiler'
      USING ERRCODE='42501';
  END IF;
  IF current_setting('transaction_isolation') NOT IN ('repeatable read','serializable') THEN
    RAISE EXCEPTION 'design compiler worker API requires REPEATABLE READ or SERIALIZABLE'
      USING ERRCODE='25001';
  END IF;

  SELECT * INTO STRICT head_row
    FROM public.framework_design_causality_head WHERE scope_key='GLOBAL';
  before_revision:=head_row.revision;
  compiler_result:=public.framework_compile_design_changes(
    'project-auto-completion-compiler',head_row.revision,head_row.canonical_hash
  );
  compiler_status:=compiler_result->>'status';
  IF compiler_status NOT IN ('BUSY','NO_WORK','NO_SEMANTIC_CHANGE','COMPILED') THEN
    RAISE EXCEPTION 'invalid internal design compiler status'
      USING ERRCODE='55000';
  END IF;

  SELECT coalesce(s.current_stage,'BASELINE') INTO observed_stage
    FROM public.framework_design_causality_head h
    LEFT JOIN public.framework_design_causality_stage s
      ON s.event_id=h.current_event_id
   WHERE h.scope_key='GLOBAL';
  SELECT * INTO STRICT head_row
    FROM public.framework_design_causality_head WHERE scope_key='GLOBAL';
  SELECT count(*) INTO dirty_signal_count
    FROM public.framework_design_change_signal WHERE signal_status='DIRTY';
  codegen_readiness:=public.framework_design_causality_codegen_readiness();
  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-compiler-worker-result/v2',
    'status',compiler_status,'currentStage',observed_stage,
    'beforeRevision',before_revision,'headRevision',head_row.revision,
    'canonicalSchemaVersion',head_row.canonical_schema_version,
    'currentEventId',head_row.current_event_id,
    'canonicalHash',head_row.canonical_hash,
    'codegenInputHash',head_row.codegen_input_hash,
    'codegenReadiness',codegen_readiness,
    'dirtySignalCount',dirty_signal_count
  );
END
$$;

REVOKE ALL ON FUNCTION
  framework_design_causality_event_hash_v2(
    bigint,text,text,text,text,text,text,text,text,jsonb,integer
  ),framework_design_causality_codegen_step_row(jsonb),
  framework_design_causality_valid_inventory_item(jsonb),
  framework_design_causality_valid_incremental_item(jsonb),
  framework_refresh_design_codegen_blueprint_leaf(bigint),
  framework_refresh_design_codegen_contract_leaf(bigint),
  framework_refresh_design_codegen_step_leaf(text,text),
  framework_refresh_design_permission_requirement_leaf(text,text,text,text),
  framework_refresh_design_permission_feature_leaf(text),
  framework_refresh_design_permission_field_leaf(bigint),
  framework_refresh_design_permission_page_leafs(bigint),
  framework_design_causality_codegen_input_component(),
  framework_design_causality_codegen_readiness(),
  framework_design_causality_codegen_semantic_row(text,jsonb),
  framework_capture_design_causality_codegen_dirty(),
  framework_capture_design_causality_codegen_truncate_dirty(),
  framework_capture_design_permission_cache_dirty(),
  framework_capture_design_causality_v2_truncate_dirty(),
  framework_capture_design_causality_process_step_raw_dirty(),
  framework_enforce_design_causality_source_classification()
  FROM PUBLIC;
REVOKE ALL ON TABLE framework_design_codegen_blueprint_leaf_cache,
  framework_design_codegen_contract_leaf_cache,
  framework_design_codegen_step_leaf_cache,
  framework_design_permission_requirement_leaf_cache,
  framework_design_permission_feature_leaf_cache,
  framework_design_permission_field_leaf_cache FROM PUBLIC;
REVOKE ALL ON FUNCTION framework_design_causality_snapshot(),
  framework_mark_design_causality_dirty(integer),
  framework_compile_design_changes(varchar,bigint,varchar),
  framework_run_design_causality_compiler_worker(),
  framework_design_causality_status()
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON FUNCTION
      framework_design_causality_event_hash_v2(
        bigint,text,text,text,text,text,text,text,text,jsonb,integer
      ),framework_design_causality_codegen_step_row(jsonb),
      framework_design_causality_valid_inventory_item(jsonb),
      framework_design_causality_valid_incremental_item(jsonb),
      framework_refresh_design_codegen_blueprint_leaf(bigint),
      framework_refresh_design_codegen_contract_leaf(bigint),
      framework_refresh_design_codegen_step_leaf(text,text),
      framework_refresh_design_permission_requirement_leaf(text,text,text,text),
      framework_refresh_design_permission_feature_leaf(text),
      framework_refresh_design_permission_field_leaf(bigint),
      framework_refresh_design_permission_page_leafs(bigint),
      framework_design_causality_codegen_input_component(),
      framework_design_causality_codegen_readiness(),
      framework_design_causality_codegen_semantic_row(text,jsonb),
      framework_capture_design_causality_codegen_dirty(),
      framework_capture_design_causality_codegen_truncate_dirty(),
      framework_capture_design_permission_cache_dirty(),
      framework_capture_design_causality_v2_truncate_dirty(),
      framework_capture_design_causality_process_step_raw_dirty(),
      framework_enforce_design_causality_source_classification(),
      framework_design_causality_snapshot(),
      framework_mark_design_causality_dirty(integer),
      framework_compile_design_changes(varchar,bigint,varchar),
      framework_run_design_causality_compiler_worker(),
      framework_design_causality_status()
      FROM carbonet_app;
    REVOKE ALL ON TABLE framework_design_codegen_blueprint_leaf_cache,
      framework_design_codegen_contract_leaf_cache,
      framework_design_codegen_step_leaf_cache,
      framework_design_permission_requirement_leaf_cache,
      framework_design_permission_feature_leaf_cache,
      framework_design_permission_field_leaf_cache FROM carbonet_app;
    GRANT EXECUTE ON FUNCTION framework_design_causality_status()
      TO carbonet_app;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_design_compiler') THEN
    REVOKE ALL ON FUNCTION
      framework_design_causality_event_hash_v2(
        bigint,text,text,text,text,text,text,text,text,jsonb,integer
      ),framework_design_causality_codegen_step_row(jsonb),
      framework_design_causality_valid_inventory_item(jsonb),
      framework_design_causality_valid_incremental_item(jsonb),
      framework_refresh_design_codegen_blueprint_leaf(bigint),
      framework_refresh_design_codegen_contract_leaf(bigint),
      framework_refresh_design_codegen_step_leaf(text,text),
      framework_refresh_design_permission_requirement_leaf(text,text,text,text),
      framework_refresh_design_permission_feature_leaf(text),
      framework_refresh_design_permission_field_leaf(bigint),
      framework_refresh_design_permission_page_leafs(bigint),
      framework_design_causality_codegen_input_component(),
      framework_design_causality_codegen_readiness(),
      framework_design_causality_codegen_semantic_row(text,jsonb),
      framework_capture_design_causality_codegen_dirty(),
      framework_capture_design_causality_codegen_truncate_dirty(),
      framework_capture_design_permission_cache_dirty(),
      framework_capture_design_causality_v2_truncate_dirty(),
      framework_capture_design_causality_process_step_raw_dirty(),
      framework_enforce_design_causality_source_classification(),
      framework_design_causality_snapshot(),
      framework_mark_design_causality_dirty(integer),
      framework_compile_design_changes(varchar,bigint,varchar),
      framework_design_causality_status()
      FROM carbonet_design_compiler;
    REVOKE ALL ON TABLE framework_screen_blueprint,
      framework_professional_screen_contract,framework_step_execution_spec,
      framework_design_codegen_blueprint_leaf_cache,
      framework_design_codegen_contract_leaf_cache,
      framework_design_codegen_step_leaf_cache,
      framework_design_permission_requirement_leaf_cache,
      framework_design_permission_feature_leaf_cache,
      framework_design_permission_field_leaf_cache,
      framework_canonical_endpoint_upgrade_activation_event
      FROM carbonet_design_compiler;
    GRANT EXECUTE ON FUNCTION framework_run_design_causality_compiler_worker()
      TO carbonet_design_compiler;
  END IF;
END
$$;

SELECT public.framework_mark_design_causality_dirty(63);

DO $$
DECLARE
  guard record;
  current_head jsonb;
  current_event_count bigint;
  current_event_set_hash varchar(64);
  trigger_count integer;
  public_execute_count integer;
  public_cache_privilege_count integer;
  row_id bigint;
  row_key record;
  cache_hash_before varchar(64);
  cache_hash_after varchar(64);
BEGIN
  SELECT * INTO STRICT guard
    FROM pg_temp.framework_design_causality_v1_install_guard;
  IF (guard.head_row->>'canonical_schema_version')::integer<>1 THEN
    RAISE EXCEPTION 'M1.1 requires an unreplaced v1 head'
      USING ERRCODE='55000';
  END IF;
  SELECT to_jsonb(h)-'codegen_input_hash' INTO STRICT current_head
    FROM public.framework_design_causality_head h WHERE scope_key='GLOBAL';
  IF current_head<>guard.head_row THEN
    RAISE EXCEPTION 'M1.1 rewrote the existing v1 head'
      USING ERRCODE='55000';
  END IF;
  SELECT count(*),coalesce(public.framework_design_causality_sha256(
           jsonb_agg(to_jsonb(e)-'codegen_input_hash' ORDER BY e.event_id)
         ),repeat('0',64))
    INTO current_event_count,current_event_set_hash
    FROM public.framework_design_causality_event e;
  IF current_event_count<>guard.event_count
     OR current_event_set_hash<>guard.event_set_hash THEN
    RAISE EXCEPTION 'M1.1 rewrote existing v1 event history'
      USING ERRCODE='55000';
  END IF;
  IF (SELECT count(*) FROM public.framework_design_change_signal
       WHERE source_txid=txid_current() AND scope_key='GLOBAL'
          AND signal_status='DIRTY' AND change_mask=63)<>1 THEN
    RAISE EXCEPTION 'M1.1 bit-63 dirty seed postcondition failed'
      USING ERRCODE='55000';
  END IF;
  SELECT count(*) INTO trigger_count FROM pg_trigger
   WHERE NOT tgisinternal AND tgenabled='A' AND tgname=ANY(ARRAY[
     'trg_design_causality_screen_blueprint_codegen_dirty',
     'trg_design_causality_professional_screen_codegen_dirty',
     'trg_design_causality_step_execution_codegen_dirty',
     'trg_design_causality_screen_blueprint_codegen_truncate_dirty',
     'trg_design_causality_professional_screen_codegen_truncate_dirty',
     'trg_design_causality_step_execution_codegen_truncate_dirty',
     'trg_design_causality_permission_requirement_cache_dirty',
     'trg_design_causality_menu_function_cache_dirty',
     'trg_design_causality_page_design_cache_dirty',
     'trg_design_causality_page_field_cache_dirty',
     'trg_design_causality_mapping_cache_dirty',
     'trg_design_causality_process_step_raw_csv_dirty',
     'trg_design_causality_process_definition_truncate_dirty',
     'trg_design_causality_process_step_truncate_dirty',
     'trg_design_causality_actor_truncate_dirty',
     'trg_design_causality_account_assignment_truncate_dirty',
     'trg_design_causality_permission_requirement_truncate_dirty',
     'trg_design_causality_permission_grant_truncate_dirty',
     'trg_design_causality_mapping_truncate_dirty',
     'trg_design_causality_page_design_truncate_dirty',
     'trg_design_causality_page_field_truncate_dirty',
     'trg_design_causality_menu_function_truncate_dirty',
     'trg_design_causality_role_function_grant_truncate_dirty',
     'trg_design_causality_user_override_grant_truncate_dirty',
     'trg_design_causality_account_role_grant_truncate_dirty',
     'trg_design_causality_source_classification_guard'
    ]);
  IF trigger_count<>26 THEN
    RAISE EXCEPTION 'M1.1 enabled-always trigger postcondition failed: %',
      trigger_count USING ERRCODE='55000';
  END IF;
  IF EXISTS(
       SELECT 1 FROM public.framework_screen_blueprint s
        FULL JOIN public.framework_design_codegen_blueprint_leaf_cache c
          ON c.blueprint_id=s.blueprint_id
       WHERE s.blueprint_id IS NULL OR c.blueprint_id IS NULL
     ) OR EXISTS(
       SELECT 1 FROM public.framework_professional_screen_contract s
        FULL JOIN public.framework_design_codegen_contract_leaf_cache c
          ON c.contract_id=s.contract_id
       WHERE s.contract_id IS NULL OR c.contract_id IS NULL
      ) OR EXISTS(
       SELECT 1 FROM public.framework_step_execution_spec s
        FULL JOIN public.framework_design_codegen_step_leaf_cache c
          ON c.process_code=s.process_code AND c.step_code=s.step_code
        WHERE s.process_code IS NULL OR c.process_code IS NULL
     ) OR EXISTS(
       SELECT 1 FROM public.framework_permission_requirement_v1 s
       FULL JOIN public.framework_design_permission_requirement_leaf_cache c
         ON c.process_code=s.process_code AND c.step_code=s.step_code
        AND c.permission_code=s.permission_code AND c.scope_type=s.scope_type
       WHERE s.process_code IS NULL OR c.process_code IS NULL
     ) OR EXISTS(
       SELECT 1 FROM public.comtnmenufunctioninfo s
       FULL JOIN public.framework_design_permission_feature_leaf_cache c
         ON c.feature_code=s.feature_code
       WHERE s.feature_code IS NULL OR c.feature_code IS NULL
     ) OR EXISTS(
       SELECT 1
         FROM (SELECT f.page_field_id FROM public.framework_page_field_definition f
                JOIN public.framework_page_design d USING(page_design_id)) s
         FULL JOIN public.framework_design_permission_field_leaf_cache c
           ON c.page_field_id=s.page_field_id
        WHERE s.page_field_id IS NULL OR c.page_field_id IS NULL
      ) THEN
    RAISE EXCEPTION 'M1.1 source/cache exact-key postcondition failed'
      USING ERRCODE='55000';
  END IF;
  SELECT public.framework_design_causality_sha256(jsonb_build_object(
    'blueprint',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.blueprint_id)
      FROM public.framework_design_codegen_blueprint_leaf_cache c),'[]'::jsonb),
    'contract',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.contract_id)
      FROM public.framework_design_codegen_contract_leaf_cache c),'[]'::jsonb),
    'step',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.process_code COLLATE "C",c.step_code COLLATE "C")
      FROM public.framework_design_codegen_step_leaf_cache c),'[]'::jsonb),
    'permissionRequirement',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.process_code COLLATE "C",c.step_code COLLATE "C",
               c.permission_code COLLATE "C",c.scope_type COLLATE "C")
      FROM public.framework_design_permission_requirement_leaf_cache c),'[]'::jsonb),
    'permissionFeature',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.feature_code COLLATE "C")
      FROM public.framework_design_permission_feature_leaf_cache c),'[]'::jsonb),
    'permissionField',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.page_field_id)
      FROM public.framework_design_permission_field_leaf_cache c),'[]'::jsonb)
  )) INTO cache_hash_before;
  FOR row_id IN SELECT blueprint_id FROM public.framework_screen_blueprint LOOP
    PERFORM public.framework_refresh_design_codegen_blueprint_leaf(row_id);
  END LOOP;
  FOR row_id IN
    SELECT contract_id FROM public.framework_professional_screen_contract
  LOOP
    PERFORM public.framework_refresh_design_codegen_contract_leaf(row_id);
  END LOOP;
  FOR row_key IN
    SELECT process_code,step_code FROM public.framework_step_execution_spec
  LOOP
    PERFORM public.framework_refresh_design_codegen_step_leaf(
      row_key.process_code,row_key.step_code
    );
  END LOOP;
  FOR row_key IN SELECT process_code,step_code,permission_code,scope_type
                   FROM public.framework_permission_requirement_v1
  LOOP
    PERFORM public.framework_refresh_design_permission_requirement_leaf(
      row_key.process_code,row_key.step_code,row_key.permission_code,row_key.scope_type
    );
  END LOOP;
  FOR row_key IN SELECT feature_code FROM public.comtnmenufunctioninfo LOOP
    PERFORM public.framework_refresh_design_permission_feature_leaf(
      row_key.feature_code);
  END LOOP;
  FOR row_id IN SELECT page_field_id FROM public.framework_page_field_definition LOOP
    PERFORM public.framework_refresh_design_permission_field_leaf(row_id);
  END LOOP;
  SELECT public.framework_design_causality_sha256(jsonb_build_object(
    'blueprint',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.blueprint_id)
      FROM public.framework_design_codegen_blueprint_leaf_cache c),'[]'::jsonb),
    'contract',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.contract_id)
      FROM public.framework_design_codegen_contract_leaf_cache c),'[]'::jsonb),
    'step',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.process_code COLLATE "C",c.step_code COLLATE "C")
      FROM public.framework_design_codegen_step_leaf_cache c),'[]'::jsonb),
    'permissionRequirement',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.process_code COLLATE "C",c.step_code COLLATE "C",
               c.permission_code COLLATE "C",c.scope_type COLLATE "C")
      FROM public.framework_design_permission_requirement_leaf_cache c),'[]'::jsonb),
    'permissionFeature',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.feature_code COLLATE "C")
      FROM public.framework_design_permission_feature_leaf_cache c),'[]'::jsonb),
    'permissionField',coalesce((SELECT jsonb_agg(to_jsonb(c)
      ORDER BY c.page_field_id)
      FROM public.framework_design_permission_field_leaf_cache c),'[]'::jsonb)
  )) INTO cache_hash_after;
  IF cache_hash_before<>cache_hash_after THEN
    RAISE EXCEPTION 'M1.1 leaf cache value postcondition failed'
      USING ERRCODE='55000';
  END IF;
  IF NOT pg_get_constraintdef(
       (SELECT oid FROM pg_constraint
         WHERE conrelid='public.framework_design_change_signal'::regclass
           AND conname='framework_design_change_signal_change_mask_check')
     ) LIKE '%63%'
     OR NOT pg_get_constraintdef(
       (SELECT oid FROM pg_constraint
         WHERE conrelid='public.framework_design_causality_event'::regclass
           AND conname='framework_design_causality_event_change_mask_check')
     ) LIKE '%63%' THEN
    RAISE EXCEPTION 'M1.1 change-mask constraint postcondition failed'
      USING ERRCODE='55000';
  END IF;
  SELECT count(*) INTO public_execute_count
    FROM unnest(ARRAY[
      'framework_design_causality_codegen_input_component()'::regprocedure,
      'framework_design_causality_codegen_readiness()'::regprocedure,
      'framework_refresh_design_codegen_blueprint_leaf(bigint)'::regprocedure,
      'framework_refresh_design_codegen_contract_leaf(bigint)'::regprocedure,
      'framework_refresh_design_codegen_step_leaf(text,text)'::regprocedure,
      'framework_refresh_design_permission_requirement_leaf(text,text,text,text)'::regprocedure,
      'framework_refresh_design_permission_feature_leaf(text)'::regprocedure,
      'framework_refresh_design_permission_field_leaf(bigint)'::regprocedure,
      'framework_refresh_design_permission_page_leafs(bigint)'::regprocedure,
      'framework_capture_design_permission_cache_dirty()'::regprocedure,
      'framework_capture_design_causality_v2_truncate_dirty()'::regprocedure,
      'framework_capture_design_causality_process_step_raw_dirty()'::regprocedure,
      'framework_compile_design_changes(character varying,bigint,character varying)'::regprocedure,
      'framework_run_design_causality_compiler_worker()'::regprocedure
    ]) function_oid
    JOIN pg_proc p ON p.oid=function_oid
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
   WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE';
  IF public_execute_count<>0 THEN
    RAISE EXCEPTION 'PUBLIC can execute M1.1 privileged functions'
      USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO public_cache_privilege_count
    FROM pg_class c
    CROSS JOIN LATERAL aclexplode(
      coalesce(c.relacl,acldefault('r',c.relowner))
    ) acl
   WHERE c.oid=ANY(ARRAY[
      'framework_design_codegen_blueprint_leaf_cache'::regclass,
      'framework_design_codegen_contract_leaf_cache'::regclass,
      'framework_design_codegen_step_leaf_cache'::regclass,
      'framework_design_permission_requirement_leaf_cache'::regclass,
      'framework_design_permission_feature_leaf_cache'::regclass,
      'framework_design_permission_field_leaf_cache'::regclass
   ]) AND acl.grantee=0;
  IF public_cache_privilege_count<>0 THEN
    RAISE EXCEPTION 'PUBLIC has design codegen leaf cache privileges'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') AND (
       has_table_privilege('carbonet_app',
         'framework_design_codegen_blueprint_leaf_cache',
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_table_privilege('carbonet_app',
         'framework_design_codegen_contract_leaf_cache',
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
        OR has_table_privilege('carbonet_app',
          'framework_design_codegen_step_leaf_cache',
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_table_privilege('carbonet_app',
          'framework_design_permission_requirement_leaf_cache',
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_table_privilege('carbonet_app',
          'framework_design_permission_feature_leaf_cache',
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_table_privilege('carbonet_app',
          'framework_design_permission_field_leaf_cache',
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     ) THEN
    RAISE EXCEPTION 'carbonet_app has design codegen leaf cache privileges'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_design_compiler') THEN
    IF NOT has_function_privilege(
         'carbonet_design_compiler',
         'framework_run_design_causality_compiler_worker()','EXECUTE'
       ) OR has_function_privilege(
         'carbonet_design_compiler',
         'framework_design_causality_codegen_input_component()','EXECUTE'
       ) OR has_function_privilege(
         'carbonet_design_compiler',
         'framework_mark_design_causality_dirty(integer)','EXECUTE'
       ) OR has_function_privilege(
         'carbonet_design_compiler',
         'framework_capture_design_causality_process_step_raw_dirty()','EXECUTE'
       ) OR has_table_privilege(
         'carbonet_design_compiler','framework_step_execution_spec','SELECT'
       ) OR has_table_privilege(
          'carbonet_design_compiler',
          'framework_design_codegen_blueprint_leaf_cache','SELECT'
       ) OR has_table_privilege(
          'carbonet_design_compiler',
          'framework_design_permission_requirement_leaf_cache','SELECT'
       ) THEN
      RAISE EXCEPTION 'M1.1 compiler least-privilege postcondition failed'
        USING ERRCODE='42501';
    END IF;
  END IF;
END
$$;

COMMENT ON FUNCTION framework_design_causality_codegen_input_component() IS
  'Sixth v2 component: deterministic raw design inventory, set-based emitted screen inputs, canonical professional source, and status-normalized step inputs';
COMMENT ON FUNCTION framework_design_causality_codegen_readiness() IS
  'SOURCE_IMMEDIATE_V1 readiness telemetry; SOURCE save is authoritative for generation, endpoint closure, deployment evidence, and runtime verification';
COMMENT ON TABLE framework_design_causality_event IS
  'Immutable global canonical root revisions; v1 keeps five hashes, v2 adds codegenInputHash; never stores canonical account data';
