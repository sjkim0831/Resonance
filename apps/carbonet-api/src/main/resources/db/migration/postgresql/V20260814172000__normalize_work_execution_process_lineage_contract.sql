-- Stage B (contract): normalize only the exact WORK_EXECUTION PSC inventory
-- after the generated evidence_count bridge is deployed and readable.
SET lock_timeout='5s';
SET statement_timeout='30s';

DO $migration$
DECLARE
  target_resource_id bigint;
  resource_count integer;
  total_count integer;
  global_binding_count integer;
  canonical_count integer;
  canonical_data_count integer;
  canonical_field_count integer;
  canonical_required_count integer;
  canonical_resolved_count integer;
  canonical_contract_mismatch integer;
  psc_count integer;
  psc_logical_count integer;
  psc_resolved_count integer;
  psc_resolved_contract_mismatch integer;
  psc_editable_logical_count integer;
  psc_editable_field_count integer;
  psc_server_logical_count integer;
  psc_server_field_count integer;
  psc_server_contract_mismatch integer;
  other_target_count integer;
  evidence_generated text;
  evidence_expression_hash text;
  draft_schema_mismatch integer;
  function_count integer;
  editable_updated integer;
  server_updated integer;
  fully_resolved_count integer;
  payload_resolved_count integer;
  server_resolved_count integer;
  physical_source_mismatch integer;
  trigger_count integer;
  pre_lineage boolean;
  pre_score integer;
  pre_status text;
  pre_issues text[];
  post_lineage boolean;
  post_score integer;
  post_status text;
  post_issues text[];
  post_field_count integer;
  immutable_target_hash text;
  immutable_target_hash_after text;
  foreign_hash text;
  foreign_hash_after text;
  immutable_psc_keys text[];
BEGIN
  LOCK TABLE public.framework_screen_resource IN SHARE MODE;
  LOCK TABLE public.framework_screen_data_binding IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.framework_process_work_draft IN ACCESS SHARE MODE;

  SELECT count(*),min(screen_resource_id)
    INTO resource_count,target_resource_id
    FROM public.framework_screen_resource
   WHERE route_key='/work/execution';
  IF resource_count<>1 THEN
    RAISE EXCEPTION 'WORK_EXECUTION screen resource is not exact: count=%',resource_count;
  END IF;

  WITH expected(column_name,data_type,is_nullable) AS (VALUES
    ('draft_id','uuid','NO'),
    ('payload_json','jsonb','NO'),
    ('evidence_count','integer','YES'),
    ('draft_version','integer','NO'),
    ('draft_status','character varying','NO')
  )
  SELECT count(*) INTO draft_schema_mismatch
    FROM expected
    LEFT JOIN information_schema.columns actual
      ON actual.table_schema='public'
     AND actual.table_name='framework_process_work_draft'
     AND actual.column_name=expected.column_name
   WHERE actual.column_name IS NULL
      OR actual.data_type IS DISTINCT FROM expected.data_type
      OR actual.is_nullable IS DISTINCT FROM expected.is_nullable;
  SELECT attribute.attgenerated,md5(pg_get_expr(definition.adbin,definition.adrelid))
    INTO evidence_generated,evidence_expression_hash
    FROM pg_attribute attribute
    JOIN pg_attrdef definition
      ON definition.adrelid=attribute.attrelid
     AND definition.adnum=attribute.attnum
   WHERE attribute.attrelid='public.framework_process_work_draft'::regclass
     AND attribute.attname='evidence_count'
     AND NOT attribute.attisdropped;
  IF draft_schema_mismatch<>0 OR evidence_generated IS DISTINCT FROM 's'
     OR evidence_expression_hash IS DISTINCT FROM '5d489072ab71f9533680c3bd4cc43ea6' THEN
    RAISE EXCEPTION
      'WORK_EXECUTION draft physical contract drifted: columnMismatches=% evidenceGenerated=% evidenceExpression=%',
      draft_schema_mismatch,evidence_generated,evidence_expression_hash;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'),
         count(DISTINCT data_element_code) FILTER (WHERE left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'),
         count(DISTINCT field_code) FILTER (WHERE left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'),
         count(*) FILTER (WHERE left(data_element_code,24)='PLATFORM.WORK_EXECUTION.' AND required),
         count(*) FILTER (WHERE left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'
           AND lineage_status IN('DB_RESOLVED','IMPLEMENTATION_VERIFIED')
           AND nullif(btrim(api_property),'') IS NOT NULL
           AND nullif(btrim(source_table),'') IS NOT NULL
           AND nullif(btrim(source_column),'') IS NOT NULL),
         count(*) FILTER (WHERE left(data_element_code,4)='PSC_'),
         count(*) FILTER (WHERE left(data_element_code,4)='PSC_'
           AND lineage_status='LOGICAL_CONTRACT'),
         count(*) FILTER (WHERE left(data_element_code,4)='PSC_'
           AND lineage_status IN('DB_RESOLVED','IMPLEMENTATION_VERIFIED')
           AND nullif(btrim(api_property),'') IS NOT NULL
           AND nullif(btrim(source_table),'') IS NOT NULL
           AND nullif(btrim(source_column),'') IS NOT NULL),
         count(*) FILTER (WHERE left(data_element_code,4)='PSC_'
            AND lineage_status='LOGICAL_CONTRACT' AND editable
            AND nullif(btrim(field_code),'') IS NOT NULL
            AND api_property=field_code
            AND nullif(btrim(source_table),'') IS NULL
            AND nullif(btrim(source_column),'') IS NULL),
         count(DISTINCT field_code) FILTER (WHERE left(data_element_code,4)='PSC_'
            AND lineage_status='LOGICAL_CONTRACT' AND editable
            AND nullif(btrim(field_code),'') IS NOT NULL
            AND api_property=field_code
            AND nullif(btrim(source_table),'') IS NULL
            AND nullif(btrim(source_column),'') IS NULL),
         count(*) FILTER (WHERE left(data_element_code,4)='PSC_'
           AND lineage_status='LOGICAL_CONTRACT' AND NOT editable
           AND field_code IN('recordId','rowVersion','statusCode','evidenceCount')
           AND nullif(btrim(source_table),'') IS NULL
           AND nullif(btrim(source_column),'') IS NULL),
         count(DISTINCT field_code) FILTER (WHERE left(data_element_code,4)='PSC_'
           AND lineage_status='LOGICAL_CONTRACT' AND NOT editable
           AND field_code IN('recordId','rowVersion','statusCode','evidenceCount')),
         count(*) FILTER (WHERE left(data_element_code,24)<>'PLATFORM.WORK_EXECUTION.'
           AND left(data_element_code,4)<>'PSC_')
    INTO total_count,canonical_count,canonical_data_count,canonical_field_count,
         canonical_required_count,canonical_resolved_count,psc_count,
         psc_logical_count,psc_resolved_count,psc_editable_logical_count,
         psc_editable_field_count,psc_server_logical_count,
         psc_server_field_count,other_target_count
    FROM public.framework_screen_data_binding
   WHERE screen_resource_id=target_resource_id;

  SELECT lineage_passed,design_gate_score,design_gate_status,design_gate_issues
    INTO STRICT pre_lineage,pre_score,pre_status,pre_issues
    FROM public.framework_page_design_assurance
   WHERE screen_resource_id=target_resource_id;

  WITH specification(field_code,api_property,source_table,source_column,required,editable) AS (VALUES
    ('tenantId','query.tenantId','framework_account_actor_assignment','tenant_id',true,true),
    ('projectId','query.projectId','framework_process_execution','project_id',true,true),
    ('processCode','query.processCode','framework_process_definition','process_code',true,true),
    ('stepCode','query.stepCode','framework_process_step','step_code',true,true),
    ('stepName','contract.stepName','framework_process_step','step_name',true,false),
    ('actorCode','contract.actorCode','framework_process_step','actor_code',true,false),
    ('commandCode','contract.commandCode','framework_process_step','command_code',true,false),
    ('fromState','contract.fromState','framework_process_step','from_state',true,false),
    ('toState','contract.toState','framework_process_step','to_state',true,false),
    ('requirementText','contract.requirementText','framework_process_step','requirement_text',true,false),
    ('completionRule','contract.completionRule','framework_process_step','completion_rule',true,false),
    ('inputContract','contract.inputContract','framework_process_step','input_contract',true,false),
    ('outputContract','contract.outputContract','framework_process_step','output_contract',true,false),
    ('draftId','draft.draftId','framework_process_work_draft','draft_id',false,false),
    ('draftVersion','draft.draftVersion','framework_process_work_draft','draft_version',true,false),
    ('draftStatus','draft.draftStatus','framework_process_work_draft','draft_status',true,false),
    ('workSummary','draft.payloadJson.workSummary','framework_process_work_draft','payload_json',true,true),
    ('decisionBasis','draft.payloadJson.decisionBasis','framework_process_work_draft','payload_json',true,true),
    ('resultValue','draft.payloadJson.resultValue','framework_process_work_draft','payload_json',false,true),
    ('resultUnit','draft.payloadJson.resultUnit','framework_process_work_draft','payload_json',false,true),
    ('exceptionReason','draft.payloadJson.exceptionReason','framework_process_work_draft','payload_json',false,true),
    ('documentId','draft.evidenceJson.documentId','framework_process_work_draft','evidence_json',true,true),
    ('sourceUrl','draft.evidenceJson.sourceUrl','framework_process_work_draft','evidence_json',false,true),
    ('checksum','draft.evidenceJson.checksum','framework_process_work_draft','evidence_json',false,true),
    ('executionId','execution.executionId','framework_process_execution','execution_id',false,false),
    ('executionStatus','execution.executionStatus','framework_process_execution','execution_status',false,false),
    ('currentStepCode','execution.currentStepCode','framework_process_execution','current_step_code',false,false),
    ('currentState','execution.currentState','framework_process_execution','current_state',false,false),
    ('eventId','events[].eventId','framework_process_execution_event','event_id',false,false),
    ('eventActor','events[].actorCode','framework_process_execution_event','actor_code',false,false),
    ('eventCommand','events[].commandCode','framework_process_execution_event','command_code',false,false),
    ('eventTransition','events[].fromState+toState','framework_process_execution_event','to_state',false,false),
    ('eventAt','events[].executedAt','framework_process_execution_event','executed_at',false,false)
  ), expected AS (
    SELECT 'PLATFORM.WORK_EXECUTION.'||
             upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')) data_element_code,
           field_code,api_property,source_table,source_column,required,editable
      FROM specification
  ), actual AS (
    SELECT data_element_code,field_code,api_property,source_table,source_column,required,editable
      FROM public.framework_screen_data_binding
     WHERE screen_resource_id=target_resource_id
       AND left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'
  ), difference AS (
    (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
    UNION ALL
    (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
  )
  SELECT count(*) INTO canonical_contract_mismatch FROM difference;

  WITH expected(data_element_code,field_code,api_property,source_table,source_column,required,editable,lineage_status) AS (VALUES
    ('PSC_11D99FED59D571DD36F40840','stepCode','stepCode','framework_process_step','step_code',true,false,'DB_RESOLVED'),
    ('PSC_4ED7441162E444B6DB6916A4','tenantId','tenantId','emission_project_registry','tenant_id',true,false,'DB_RESOLVED'),
    ('PSC_582A4FC69651C4F123CFB2DC','reportingYear','reportingYear','emission_project_registry','reporting_year',true,true,'DB_RESOLVED'),
    ('PSC_8E6EDCAD0B45FDD7D8728391','processCode','processCode','framework_process_definition','process_code',true,false,'DB_RESOLVED'),
    ('PSC_AAF648FDD29AB51B3E8E3808','updatedAt','updatedAt','emission_project_registry','updated_at',false,false,'DB_RESOLVED'),
    ('PSC_C795DEEC45D3428648AC7676','projectId','projectId','emission_project_registry','project_id',true,true,'DB_RESOLVED'),
    ('PSC_FFA9D486F435E5BBFD976D57','createdAt','createdAt','emission_project_registry','created_at',false,false,'DB_RESOLVED')
  ), actual AS (
    SELECT data_element_code,field_code,api_property,source_table,source_column,required,editable,lineage_status
      FROM public.framework_screen_data_binding
     WHERE screen_resource_id=target_resource_id
       AND left(data_element_code,4)='PSC_'
       AND lineage_status IN('DB_RESOLVED','IMPLEMENTATION_VERIFIED')
  ), difference AS (
    (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
    UNION ALL
    (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
  )
  SELECT count(*) INTO psc_resolved_contract_mismatch FROM difference;

  WITH expected(field_code,required) AS (VALUES
    ('recordId',false),('rowVersion',true),('statusCode',true),('evidenceCount',false)
  )
  SELECT count(*) INTO psc_server_contract_mismatch
    FROM expected
    LEFT JOIN public.framework_screen_data_binding actual
      ON actual.screen_resource_id=target_resource_id
     AND left(actual.data_element_code,4)='PSC_'
     AND actual.field_code=expected.field_code
   WHERE actual.field_code IS NULL
      OR actual.api_property IS DISTINCT FROM expected.field_code
      OR actual.required IS DISTINCT FROM expected.required
      OR actual.editable IS DISTINCT FROM false
      OR actual.lineage_status IS DISTINCT FROM 'LOGICAL_CONTRACT'
      OR nullif(btrim(actual.source_table),'') IS NOT NULL
      OR nullif(btrim(actual.source_column),'') IS NOT NULL;

  IF total_count<>69
     OR canonical_count<>33 OR canonical_data_count<>33 OR canonical_field_count<>33
     OR canonical_required_count<>18 OR canonical_resolved_count<>33
     OR canonical_contract_mismatch<>0
     OR psc_count<>36 OR psc_logical_count<>29 OR psc_resolved_count<>7
     OR psc_resolved_contract_mismatch<>0
     OR psc_editable_logical_count<>25 OR psc_editable_field_count<>25
     OR psc_server_logical_count<>4 OR psc_server_field_count<>4
     OR psc_server_contract_mismatch<>0
     OR other_target_count<>0
     OR pre_lineage IS DISTINCT FROM false OR pre_score<>90 OR pre_status<>'FAILED'
     OR pre_issues IS DISTINCT FROM ARRAY['INPUT_OUTPUT_LINEAGE_INCOMPLETE']::text[] THEN
    RAISE EXCEPTION
      'WORK_EXECUTION stage B precondition failed: total=% canonical=%/%/% required=% resolved=% canonicalMismatch=% psc=% logical=% resolvedPsc=% resolvedMismatch=% editableLogical=%/% serverLogical=%/% serverMismatch=% other=% gate=%/%/% issues=%',
      total_count,canonical_count,canonical_data_count,canonical_field_count,
      canonical_required_count,canonical_resolved_count,canonical_contract_mismatch,
      psc_count,psc_logical_count,psc_resolved_count,psc_resolved_contract_mismatch,
      psc_editable_logical_count,psc_editable_field_count,psc_server_logical_count,
      psc_server_field_count,psc_server_contract_mismatch,other_target_count,
      pre_lineage,pre_score,pre_status,pre_issues;
  END IF;

  SELECT count(*) INTO function_count
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
   WHERE namespace.nspname='public'
     AND procedure.proname='framework_normalize_work_execution_psc_lineage'
     AND procedure.pronargs=0;
  SELECT count(*) INTO trigger_count
    FROM pg_trigger
   WHERE tgrelid='public.framework_screen_data_binding'::regclass
     AND tgname='framework_work_execution_psc_lineage_biu'
     AND NOT tgisinternal;
  IF function_count<>0 OR trigger_count<>0 THEN
    RAISE EXCEPTION
      'WORK_EXECUTION stage B object collision: functions=% triggers=%',
      function_count,trigger_count;
  END IF;

  SELECT count(*) INTO global_binding_count
    FROM public.framework_screen_data_binding;
  SELECT array_agg(data_element_code||chr(31)||field_code
           ORDER BY data_element_code,field_code)
    INTO immutable_psc_keys
    FROM public.framework_screen_data_binding
   WHERE screen_resource_id=target_resource_id
     AND left(data_element_code,4)='PSC_'
     AND lineage_status IN('DB_RESOLVED','IMPLEMENTATION_VERIFIED');
  SELECT coalesce(md5(string_agg(to_jsonb(binding)::text,E'\n'
           ORDER BY data_element_code,field_code)),'EMPTY')
    INTO immutable_target_hash
    FROM public.framework_screen_data_binding binding
   WHERE screen_resource_id=target_resource_id
     AND (left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'
       OR data_element_code||chr(31)||field_code=ANY(immutable_psc_keys));
  SELECT coalesce(md5(string_agg(to_jsonb(binding)::text,E'\n'
           ORDER BY screen_resource_id,data_element_code,field_code)),'EMPTY')
    INTO foreign_hash
    FROM public.framework_screen_data_binding binding
   WHERE screen_resource_id<>target_resource_id;

  EXECUTE $function$
    CREATE FUNCTION public.framework_normalize_work_execution_psc_lineage()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $body$
    BEGIN
      IF left(NEW.data_element_code,4)<>'PSC_'
         OR NOT EXISTS(
           SELECT 1 FROM public.framework_screen_resource resource
            WHERE resource.screen_resource_id=NEW.screen_resource_id
              AND resource.route_key='/work/execution'
         )
         OR NEW.lineage_status IS DISTINCT FROM 'LOGICAL_CONTRACT'
         OR nullif(btrim(NEW.source_table),'') IS NOT NULL
         OR nullif(btrim(NEW.source_column),'') IS NOT NULL THEN
        RETURN NEW;
      END IF;

      IF NEW.editable
         AND nullif(btrim(NEW.field_code),'') IS NOT NULL
         AND NEW.api_property=NEW.field_code THEN
        NEW.source_table:='framework_process_work_draft';
        NEW.source_column:='payload_json';
        NEW.lineage_status:='DB_RESOLVED';
      ELSIF NOT NEW.editable AND NEW.field_code='recordId'
         AND NEW.api_property=NEW.field_code THEN
        NEW.api_property:='draft.draftId';
        NEW.source_table:='framework_process_work_draft';
        NEW.source_column:='draft_id';
        NEW.lineage_status:='DB_RESOLVED';
      ELSIF NOT NEW.editable AND NEW.field_code='rowVersion'
         AND NEW.api_property=NEW.field_code THEN
        NEW.api_property:='draft.draftVersion';
        NEW.source_table:='framework_process_work_draft';
        NEW.source_column:='draft_version';
        NEW.lineage_status:='DB_RESOLVED';
      ELSIF NOT NEW.editable AND NEW.field_code='statusCode'
         AND NEW.api_property=NEW.field_code THEN
        NEW.api_property:='draft.draftStatus';
        NEW.source_table:='framework_process_work_draft';
        NEW.source_column:='draft_status';
        NEW.lineage_status:='DB_RESOLVED';
      ELSIF NOT NEW.editable AND NEW.field_code='evidenceCount'
         AND NEW.api_property=NEW.field_code THEN
        NEW.api_property:='draft.evidenceCount';
        NEW.source_table:='framework_process_work_draft';
        NEW.source_column:='evidence_count';
        NEW.lineage_status:='DB_RESOLVED';
      END IF;
      RETURN NEW;
    END
    $body$
  $function$;

  EXECUTE $trigger$
    CREATE TRIGGER framework_work_execution_psc_lineage_biu
    BEFORE INSERT OR UPDATE OF
      screen_resource_id,data_element_code,field_code,api_property,source_table,
      source_column,lineage_status,editable
    ON public.framework_screen_data_binding
    FOR EACH ROW EXECUTE FUNCTION public.framework_normalize_work_execution_psc_lineage()
  $trigger$;

  UPDATE public.framework_screen_data_binding binding
     SET source_table='framework_process_work_draft',
         source_column='payload_json',
         lineage_status='DB_RESOLVED'
   WHERE binding.screen_resource_id=target_resource_id
     AND left(binding.data_element_code,4)='PSC_'
     AND binding.lineage_status='LOGICAL_CONTRACT'
     AND binding.editable
     AND nullif(btrim(binding.field_code),'') IS NOT NULL
     AND binding.api_property=binding.field_code
     AND nullif(btrim(binding.source_table),'') IS NULL
     AND nullif(btrim(binding.source_column),'') IS NULL;
  GET DIAGNOSTICS editable_updated=ROW_COUNT;
  IF editable_updated<>25 THEN
    RAISE EXCEPTION 'WORK_EXECUTION editable PSC normalization is not exact: %',editable_updated;
  END IF;

  UPDATE public.framework_screen_data_binding binding
     SET api_property=CASE binding.field_code
           WHEN 'recordId' THEN 'draft.draftId'
           WHEN 'rowVersion' THEN 'draft.draftVersion'
           WHEN 'statusCode' THEN 'draft.draftStatus'
           WHEN 'evidenceCount' THEN 'draft.evidenceCount'
         END,
         source_table='framework_process_work_draft',
         source_column=CASE binding.field_code
           WHEN 'recordId' THEN 'draft_id'
           WHEN 'rowVersion' THEN 'draft_version'
           WHEN 'statusCode' THEN 'draft_status'
           WHEN 'evidenceCount' THEN 'evidence_count'
         END,
         lineage_status='DB_RESOLVED'
   WHERE binding.screen_resource_id=target_resource_id
     AND left(binding.data_element_code,4)='PSC_'
     AND binding.lineage_status='LOGICAL_CONTRACT'
     AND NOT binding.editable
     AND binding.field_code IN('recordId','rowVersion','statusCode','evidenceCount')
     AND binding.api_property=binding.field_code
     AND nullif(btrim(binding.source_table),'') IS NULL
     AND nullif(btrim(binding.source_column),'') IS NULL;
  GET DIAGNOSTICS server_updated=ROW_COUNT;
  IF server_updated<>4 THEN
    RAISE EXCEPTION 'WORK_EXECUTION server PSC normalization is not exact: %',server_updated;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE lineage_status IN('DB_RESOLVED','IMPLEMENTATION_VERIFIED')
           AND nullif(btrim(api_property),'') IS NOT NULL
           AND nullif(btrim(source_table),'') IS NOT NULL
           AND nullif(btrim(source_column),'') IS NOT NULL),
         count(*) FILTER (WHERE left(data_element_code,4)='PSC_'
           AND editable AND nullif(btrim(field_code),'') IS NOT NULL
           AND api_property=field_code
           AND source_table='framework_process_work_draft'
           AND source_column='payload_json' AND lineage_status='DB_RESOLVED'),
         count(*) FILTER (WHERE left(data_element_code,4)='PSC_' AND NOT editable
           AND source_table='framework_process_work_draft' AND lineage_status='DB_RESOLVED'
           AND ((field_code='recordId' AND api_property='draft.draftId' AND source_column='draft_id')
             OR (field_code='rowVersion' AND api_property='draft.draftVersion' AND source_column='draft_version')
             OR (field_code='statusCode' AND api_property='draft.draftStatus' AND source_column='draft_status')
             OR (field_code='evidenceCount' AND api_property='draft.evidenceCount' AND source_column='evidence_count')))
    INTO total_count,fully_resolved_count,payload_resolved_count,server_resolved_count
    FROM public.framework_screen_data_binding
   WHERE screen_resource_id=target_resource_id;

  SELECT coalesce(md5(string_agg(to_jsonb(binding)::text,E'\n'
           ORDER BY data_element_code,field_code)),'EMPTY')
    INTO immutable_target_hash_after
    FROM public.framework_screen_data_binding binding
   WHERE screen_resource_id=target_resource_id
     AND (left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'
       OR data_element_code||chr(31)||field_code=ANY(immutable_psc_keys));
  SELECT coalesce(md5(string_agg(to_jsonb(binding)::text,E'\n'
           ORDER BY screen_resource_id,data_element_code,field_code)),'EMPTY')
    INTO foreign_hash_after
    FROM public.framework_screen_data_binding binding
   WHERE screen_resource_id<>target_resource_id;
  SELECT lineage_passed,design_gate_score,design_gate_status,design_gate_issues,field_count
    INTO STRICT post_lineage,post_score,post_status,post_issues,post_field_count
    FROM public.framework_page_design_assurance
   WHERE screen_resource_id=target_resource_id;
  SELECT count(*) INTO physical_source_mismatch
    FROM public.framework_screen_data_binding binding
    LEFT JOIN information_schema.columns source_column
      ON source_column.table_schema='public'
     AND source_column.table_name=binding.source_table
     AND source_column.column_name=binding.source_column
   WHERE binding.screen_resource_id=target_resource_id
     AND source_column.column_name IS NULL;
  SELECT count(*) INTO trigger_count
    FROM pg_trigger
   WHERE tgrelid='public.framework_screen_data_binding'::regclass
     AND tgname='framework_work_execution_psc_lineage_biu'
     AND NOT tgisinternal;

  IF (SELECT count(*) FROM public.framework_screen_data_binding)<>global_binding_count
     OR total_count<>69 OR fully_resolved_count<>69
     OR payload_resolved_count<>25 OR server_resolved_count<>4
     OR physical_source_mismatch<>0
     OR immutable_target_hash_after IS DISTINCT FROM immutable_target_hash
     OR foreign_hash_after IS DISTINCT FROM foreign_hash
     OR post_lineage IS DISTINCT FROM true OR post_score<>100 OR post_status<>'PASSED'
     OR coalesce(cardinality(post_issues),-1)<>0 OR post_field_count<>69
     OR trigger_count<>1 THEN
    RAISE EXCEPTION
      'WORK_EXECUTION stage B postcondition failed: global=%/% total=% resolved=% payload=% server=% physicalSourceMismatch=% immutable=% foreign=% gate=%/%/% issues=% fields=% trigger=%',
      global_binding_count,(SELECT count(*) FROM public.framework_screen_data_binding),
      total_count,fully_resolved_count,payload_resolved_count,server_resolved_count,
      physical_source_mismatch,
      immutable_target_hash_after=immutable_target_hash,foreign_hash_after=foreign_hash,
      post_lineage,post_score,post_status,post_issues,post_field_count,trigger_count;
  END IF;
END
$migration$;

RESET statement_timeout;
RESET lock_timeout;
