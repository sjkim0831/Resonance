-- A process step owns one canonical SchemaSet. Page fields, API properties,
-- persistence mappings and handoff payloads are compiled into it. Subsequent
-- design-column changes invalidate only the affected step and enqueue bounded
-- frontend/backend/database/test work; the existing screen generator handles
-- the frontend artifact incrementally.

CREATE TABLE IF NOT EXISTS framework_step_schema_set (
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  schema_hash varchar(64) NOT NULL,
  input_schema jsonb NOT NULL,
  output_schema jsonb NOT NULL,
  field_schema jsonb NOT NULL,
  persistence_schema jsonb NOT NULL,
  handoff_schema jsonb NOT NULL,
  context_keys jsonb NOT NULL,
  completeness_status varchar(20) NOT NULL
    CHECK (completeness_status IN ('COMPLETE','BLOCKED')),
  blocker_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  generation_status varchar(20) NOT NULL DEFAULT 'SYNCED'
    CHECK (generation_status IN ('DIRTY','SYNCED','FAILED')),
  generated_hash varchar(64),
  last_change_reason varchar(200) NOT NULL DEFAULT 'INITIAL_COMPILE',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(process_code,step_code),
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_step_schema_set_generation
  ON framework_step_schema_set(generation_status,completeness_status,updated_at);

CREATE TABLE IF NOT EXISTS framework_schema_change_event (
  event_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  previous_hash varchar(64),
  current_hash varchar(64) NOT NULL,
  schema_version integer NOT NULL,
  change_reason varchar(200) NOT NULL,
  affected_layers jsonb NOT NULL,
  event_status varchar(20) NOT NULL DEFAULT 'QUEUED'
    CHECK (event_status IN ('QUEUED','GENERATED','VERIFIED','FAILED')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp,
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_schema_change_event_queue
  ON framework_schema_change_event(event_status,created_at,event_id);

CREATE OR REPLACE FUNCTION framework_refresh_step_schema_set(
  requested_process varchar,
  requested_step varchar,
  change_reason varchar DEFAULT 'DESIGN_CHANGED',
  enqueue_change boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  step_row framework_process_step%ROWTYPE;
  previous_hash varchar;
  next_hash varchar;
  next_version integer := 1;
  input_json jsonb;
  output_json jsonb;
  fields_json jsonb;
  persistence_json jsonb;
  handoff_json jsonb;
  contexts_json jsonb;
  blockers_json jsonb;
  is_complete boolean;
  page_count integer;
  field_count integer;
  bad_mapping_count integer;
  changed boolean := false;
BEGIN
  SELECT * INTO STRICT step_row FROM framework_process_step
  WHERE process_code=requested_process AND step_code=requested_step;

  input_json := coalesce(framework_try_jsonb(step_row.input_contract),'{}'::jsonb);
  output_json := coalesce(framework_try_jsonb(step_row.output_contract),'{}'::jsonb);

  SELECT count(DISTINCT d.page_design_id),
         count(f.page_field_id),
         count(f.page_field_id) FILTER (
           WHERE nullif(btrim(f.api_property),'') IS NULL
              OR (f.mapping_status='DB_RESOLVED' AND (
                   nullif(btrim(f.source_table),'') IS NULL
                OR nullif(btrim(f.source_column),'') IS NULL
                OR NOT EXISTS (
                  SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='public'
                    AND c.table_name=f.source_table
                    AND c.column_name=f.source_column)))
         ),
         coalesce(jsonb_agg(jsonb_build_object(
           'audience',d.audience,'pageCode',d.page_code,'route',
             coalesce(d.actual_route_path,d.planned_route_path),
           'fieldOrder',f.field_order,'fieldGroup',f.field_group,
           'fieldCode',f.field_code,'fieldName',f.field_name,
           'dataType',f.data_type,'controlType',f.control_type,
           'required',f.required,'editable',f.editable,
           'apiProperty',f.api_property,'mappingStatus',f.mapping_status,
           'sourceTable',f.source_table,'sourceColumn',f.source_column,
           'validation',f.validation_contract,'privacyClass',f.privacy_class,
           'permissionCode',f.permission_code,
           'evidenceRequired',f.evidence_required
         ) ORDER BY d.audience,f.field_order,f.page_field_id)
           FILTER (WHERE f.page_field_id IS NOT NULL),'[]'::jsonb)
  INTO page_count,field_count,bad_mapping_count,fields_json
  FROM framework_page_design d
  LEFT JOIN framework_page_field_definition f
    ON f.page_design_id=d.page_design_id
  WHERE d.process_code=requested_process AND d.step_code=requested_step;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'audience',d.audience,'pageCode',d.page_code,
           'primaryEntity',d.primary_entity,
           'fields',coalesce((
             SELECT jsonb_agg(jsonb_build_object(
               'fieldCode',f.field_code,'apiProperty',f.api_property,
               'sourceTable',f.source_table,'sourceColumn',f.source_column,
               'mappingStatus',f.mapping_status,'required',f.required)
               ORDER BY f.field_order,f.page_field_id)
             FROM framework_page_field_definition f
             WHERE f.page_design_id=d.page_design_id),'[]'::jsonb)
         ) ORDER BY d.audience),'[]'::jsonb)
  INTO persistence_json
  FROM framework_page_design d
  WHERE d.process_code=requested_process AND d.step_code=requested_step;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'handoffType',h.handoff_type,'toProcessCode',h.to_process_code,
           'toStepCode',h.to_step_code,'contextKeys',h.context_keys,
           'payload',h.payload_contract,'integrity',h.integrity_contract,
           'authorization',h.authorization_contract,'failure',h.failure_contract)
           ORDER BY h.handoff_type,h.to_process_code,h.to_step_code),'[]'::jsonb),
         coalesce(jsonb_agg(DISTINCT h.context_keys)
           FILTER (WHERE h.handoff_id IS NOT NULL),'[]'::jsonb)
  INTO handoff_json,contexts_json
  FROM framework_process_data_handoff h
  WHERE h.process_code=requested_process AND h.from_step_code=requested_step;

  blockers_json := to_jsonb(array_remove(ARRAY[
    CASE WHEN input_json='{}'::jsonb THEN 'INPUT_SCHEMA_MISSING' END,
    CASE WHEN output_json='{}'::jsonb THEN 'OUTPUT_SCHEMA_MISSING' END,
    CASE WHEN (step_row.requires_user_page OR step_row.requires_admin_page)
                   AND coalesce(page_count,0)=0 THEN 'PAGE_SCHEMA_MISSING' END,
    CASE WHEN (step_row.requires_user_page OR step_row.requires_admin_page)
                   AND coalesce(field_count,0)=0 THEN 'FIELD_SCHEMA_MISSING' END,
    CASE WHEN coalesce(bad_mapping_count,0)>0 THEN 'FIELD_MAPPING_INVALID' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM framework_process_step n
      WHERE n.process_code=requested_process
        AND n.step_order>step_row.step_order)
      AND handoff_json='[]'::jsonb THEN 'HANDOFF_SCHEMA_MISSING' END
  ],NULL));
  is_complete := jsonb_array_length(blockers_json)=0;

  next_hash := md5(input_json::text||output_json::text||fields_json::text||
                    persistence_json::text||handoff_json::text) ||
               md5('STEP_SCHEMA_SET_V1|'||requested_process||'|'||
                    requested_step||'|'||fields_json::text);

  SELECT schema_hash,schema_version INTO previous_hash,next_version
  FROM framework_step_schema_set
  WHERE process_code=requested_process AND step_code=requested_step;
  changed := previous_hash IS NOT NULL AND previous_hash<>next_hash;
  next_version := CASE WHEN changed THEN next_version+1
                       ELSE coalesce(next_version,1) END;

  INSERT INTO framework_step_schema_set(
    process_code,step_code,schema_version,schema_hash,input_schema,
    output_schema,field_schema,persistence_schema,handoff_schema,context_keys,
    completeness_status,blocker_codes,generation_status,generated_hash,
    last_change_reason,updated_at)
  VALUES(requested_process,requested_step,next_version,next_hash,input_json,
    output_json,fields_json,persistence_json,handoff_json,contexts_json,
    CASE WHEN is_complete THEN 'COMPLETE' ELSE 'BLOCKED' END,blockers_json,
    CASE WHEN changed THEN 'DIRTY' ELSE 'SYNCED' END,
    CASE WHEN changed THEN NULL ELSE next_hash END,change_reason,current_timestamp)
  ON CONFLICT(process_code,step_code) DO UPDATE SET
    schema_version=excluded.schema_version,schema_hash=excluded.schema_hash,
    input_schema=excluded.input_schema,output_schema=excluded.output_schema,
    field_schema=excluded.field_schema,
    persistence_schema=excluded.persistence_schema,
    handoff_schema=excluded.handoff_schema,context_keys=excluded.context_keys,
    completeness_status=excluded.completeness_status,
    blocker_codes=excluded.blocker_codes,
    generation_status=excluded.generation_status,
    generated_hash=excluded.generated_hash,
    last_change_reason=excluded.last_change_reason,
    updated_at=current_timestamp;

  -- Publish the same field contract to the runtime screen contract. Its
  -- existing trigger marks only matching generated/hybrid blueprints DIRTY.
  UPDATE framework_professional_screen_contract c SET
    field_contract=coalesce((
      SELECT jsonb_agg(field ORDER BY (field->>'fieldOrder')::integer)
      FROM jsonb_array_elements(fields_json) field
      WHERE field->>'audience'=c.audience),'[]'::jsonb)::text,
    updated_by='STEP_SCHEMA_SET',updated_at=current_timestamp
  WHERE c.process_code=requested_process AND c.step_code=requested_step
    AND c.field_contract IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(field ORDER BY (field->>'fieldOrder')::integer)
      FROM jsonb_array_elements(fields_json) field
      WHERE field->>'audience'=c.audience),'[]'::jsonb)::text;

  UPDATE framework_step_execution_spec e SET
    input_contract=input_json,output_contract=output_json,
    field_contract=jsonb_build_array(jsonb_build_object(
      'schemaSetVersion',next_version,'fields',fields_json)),
    persistence_contract=jsonb_build_object(
      'schemaSetVersion',next_version,'mappings',persistence_json,
      'transactional',step_row.requires_api,'migrationRequired',true),
    handoff_contract=handoff_json,
    blocker_codes=blockers_json,
    design_status=CASE WHEN is_complete THEN 'DESIGN_COMPLETE'
                       ELSE 'DESIGN_BLOCKED' END,
    approval_status=CASE WHEN changed THEN 'REVIEW_REQUIRED'
                         ELSE approval_status END,
    generation_status=CASE WHEN is_complete AND NOT changed THEN generation_status
                           ELSE 'BLOCKED' END,
    source_hash=next_hash,updated_at=current_timestamp
  WHERE e.process_code=requested_process AND e.step_code=requested_step;

  INSERT INTO framework_page_data_contract(
    contract_id,page_id,binding_key,source_type,endpoint_path,
    static_payload_json,refresh_seconds,active_yn,updated_at)
  SELECT 'SCHEMA_DATA_'||substr(md5(d.page_code),1,24),d.page_code,
    'stepSchema','SCHEMA_SET',coalesce(d.actual_route_path,d.planned_route_path),
    jsonb_build_object('processCode',requested_process,'stepCode',requested_step,
      'schemaVersion',next_version,'schemaHash',next_hash)::text,
    0,'Y',current_timestamp
  FROM framework_page_design d
  WHERE d.process_code=requested_process AND d.step_code=requested_step
  ON CONFLICT(page_id,binding_key) DO UPDATE SET
    source_type=excluded.source_type,endpoint_path=excluded.endpoint_path,
    static_payload_json=excluded.static_payload_json,active_yn='Y',
    updated_at=current_timestamp;

  INSERT INTO framework_page_action_contract(
    action_id,page_id,action_code,action_type,target_path,http_method,
    confirmation_text,required_actor_codes,active_yn,updated_at)
  SELECT 'SCHEMA_ACTION_'||substr(md5(d.page_code||step_row.command_code),1,24),
    d.page_code,step_row.command_code,'PROCESS_COMMAND',
    coalesce(d.actual_route_path,d.planned_route_path),'POST',
    CASE WHEN step_row.completion_rule='' THEN NULL
         ELSE step_row.completion_rule END,
    step_row.actor_code,'Y',current_timestamp
  FROM framework_page_design d
  WHERE d.process_code=requested_process AND d.step_code=requested_step
  ON CONFLICT(page_id,action_code) DO UPDATE SET
    action_type=excluded.action_type,target_path=excluded.target_path,
    http_method=excluded.http_method,
    confirmation_text=excluded.confirmation_text,
    required_actor_codes=excluded.required_actor_codes,active_yn='Y',
    updated_at=current_timestamp;

  IF changed AND enqueue_change THEN
    INSERT INTO framework_schema_change_event(
      process_code,step_code,previous_hash,current_hash,schema_version,
      change_reason,affected_layers)
    VALUES(requested_process,requested_step,previous_hash,next_hash,next_version,
      change_reason,'["DATABASE","BACKEND","FRONTEND_USER","FRONTEND_ADMIN","TEST"]');

    INSERT INTO framework_development_job(
      process_code,step_code,job_type,job_name,target_path,
      specification_json,job_status,approval_status,quality_status,
      required,created_by,updated_at)
    SELECT requested_process,requested_step,work.job_type,
      'SchemaSet v'||next_version||' 증분 반영 - '||work.job_type,
      'schema-set/'||lower(requested_process)||'/'||lower(requested_step)||
        '/'||lower(work.job_type),
      jsonb_build_object('schemaVersion',next_version,'schemaHash',next_hash,
        'changeReason',change_reason,'blockers',blockers_json)::text,
      CASE WHEN is_complete THEN 'PLANNED' ELSE 'BLOCKED' END,
      'PENDING','PENDING',true,'STEP_SCHEMA_SET',current_timestamp
    FROM (VALUES('DATABASE'),('BACKEND'),('FRONTEND_USER'),
                ('FRONTEND_ADMIN'),('TEST')) work(job_type)
    WHERE (work.job_type<>'FRONTEND_USER' OR step_row.requires_user_page)
      AND (work.job_type<>'FRONTEND_ADMIN' OR step_row.requires_admin_page)
    ON CONFLICT(process_code,step_code,job_type,target_path) DO UPDATE SET
      job_name=excluded.job_name,
      specification_json=excluded.specification_json,
      job_status=excluded.job_status,approval_status='PENDING',
      quality_status='PENDING',evidence_ref=NULL,
      completed_at=NULL,last_error=NULL,updated_at=current_timestamp;
  END IF;

  RETURN jsonb_build_object('processCode',requested_process,
    'stepCode',requested_step,'schemaVersion',next_version,
    'schemaHash',next_hash,'changed',changed,
    'complete',is_complete,'blockers',blockers_json,
    'fieldCount',coalesce(field_count,0),'pageCount',coalesce(page_count,0));
END $$;

CREATE OR REPLACE FUNCTION framework_step_schema_design_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  design_id bigint;
  changed_process_id varchar;
  changed_step_id varchar;
BEGIN
  IF TG_TABLE_NAME='framework_page_field_definition' THEN
    design_id := CASE WHEN TG_OP='DELETE' THEN OLD.page_design_id
                      ELSE NEW.page_design_id END;
    SELECT process_code,step_code INTO changed_process_id,changed_step_id
    FROM framework_page_design WHERE page_design_id=design_id;
  ELSIF TG_TABLE_NAME='framework_page_design' THEN
    changed_process_id := CASE WHEN TG_OP='DELETE' THEN OLD.process_code
                               ELSE NEW.process_code END;
    changed_step_id := CASE WHEN TG_OP='DELETE' THEN OLD.step_code
                            ELSE NEW.step_code END;
  ELSIF TG_TABLE_NAME='framework_process_data_handoff' THEN
    changed_process_id := CASE WHEN TG_OP='DELETE' THEN OLD.process_code
                               ELSE NEW.process_code END;
    changed_step_id := CASE WHEN TG_OP='DELETE' THEN OLD.from_step_code
                            ELSE NEW.from_step_code END;
  ELSE
    changed_process_id := CASE WHEN TG_OP='DELETE' THEN OLD.process_code
                               ELSE NEW.process_code END;
    changed_step_id := CASE WHEN TG_OP='DELETE' THEN OLD.step_code
                            ELSE NEW.step_code END;
  END IF;

  IF changed_process_id IS NOT NULL AND changed_step_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM framework_process_step process_step
      WHERE process_step.process_code=changed_process_id
        AND process_step.step_code=changed_step_id) THEN
    PERFORM framework_refresh_step_schema_set(
      changed_process_id,changed_step_id,TG_TABLE_NAME||':'||TG_OP,true);
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS trg_page_field_schema_propagation
  ON framework_page_field_definition;
CREATE TRIGGER trg_page_field_schema_propagation
AFTER INSERT OR UPDATE OR DELETE ON framework_page_field_definition
FOR EACH ROW EXECUTE FUNCTION framework_step_schema_design_changed();

DROP TRIGGER IF EXISTS trg_page_design_schema_propagation
  ON framework_page_design;
CREATE TRIGGER trg_page_design_schema_propagation
AFTER INSERT OR UPDATE OF page_code,planned_route_path,actual_route_path,
  route_status,primary_entity,actor_code ON framework_page_design
FOR EACH ROW EXECUTE FUNCTION framework_step_schema_design_changed();

DROP TRIGGER IF EXISTS trg_handoff_schema_propagation
  ON framework_process_data_handoff;
CREATE TRIGGER trg_handoff_schema_propagation
AFTER INSERT OR UPDATE OR DELETE ON framework_process_data_handoff
FOR EACH ROW EXECUTE FUNCTION framework_step_schema_design_changed();

DROP TRIGGER IF EXISTS trg_process_step_schema_propagation
  ON framework_process_step;
CREATE TRIGGER trg_process_step_schema_propagation
AFTER UPDATE OF input_contract,output_contract,api_contract,
  requires_user_page,requires_admin_page,requires_api,requires_database
ON framework_process_step
FOR EACH ROW EXECUTE FUNCTION framework_step_schema_design_changed();

CREATE OR REPLACE VIEW framework_step_schema_set_readiness AS
SELECT s.process_code,p.process_name,s.step_code,step.step_name,
  step.step_order,step.actor_code,s.schema_version,s.schema_hash,
  s.completeness_status,s.blocker_codes,s.generation_status,
  jsonb_array_length(s.field_schema) field_count,
  jsonb_array_length(s.handoff_schema) handoff_count,
  count(e.event_id) FILTER(WHERE e.event_status='QUEUED') queued_changes,
  s.last_change_reason,s.updated_at
FROM framework_step_schema_set s
JOIN framework_process_definition p USING(process_code)
JOIN framework_process_step step USING(process_code,step_code)
LEFT JOIN framework_schema_change_event e
  ON e.process_code=s.process_code AND e.step_code=s.step_code
GROUP BY s.process_code,p.process_name,s.step_code,step.step_name,
  step.step_order,step.actor_code,s.schema_version,s.schema_hash,
  s.completeness_status,s.blocker_codes,s.generation_status,
  s.field_schema,s.handoff_schema,s.last_change_reason,s.updated_at;

-- Initial compilation establishes a baseline and intentionally does not create
-- thousands of development jobs. Only later design changes are enqueued.
DO $$
DECLARE row_record record;
BEGIN
  FOR row_record IN
    SELECT process_code,step_code FROM framework_process_step
    ORDER BY process_code,step_order
  LOOP
    PERFORM framework_refresh_step_schema_set(
      row_record.process_code,row_record.step_code,'INITIAL_COMPILE',false);
  END LOOP;
END $$;

DO $$
DECLARE
  step_total integer;
  schema_total integer;
BEGIN
  SELECT count(*) INTO step_total FROM framework_process_step;
  SELECT count(*) INTO schema_total FROM framework_step_schema_set;
  IF step_total<>schema_total THEN
    RAISE EXCEPTION 'STEP_SCHEMA_SET_COVERAGE_FAILED steps=% schemas=%',
      step_total,schema_total;
  END IF;
END $$;
