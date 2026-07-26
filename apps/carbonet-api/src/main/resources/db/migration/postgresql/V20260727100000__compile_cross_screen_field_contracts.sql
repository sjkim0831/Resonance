CREATE TABLE IF NOT EXISTS framework_contract_compilation_run (
  compilation_id bigserial PRIMARY KEY,
  contract_hash varchar(64) NOT NULL,
  screen_count integer NOT NULL,
  field_count integer NOT NULL,
  lineage_count integer NOT NULL,
  blocking_count integer NOT NULL,
  warning_count integer NOT NULL,
  compilation_status varchar(16) NOT NULL CHECK(compilation_status IN ('PASSED','BLOCKED','FAILED')),
  elapsed_millis bigint NOT NULL,
  result_json jsonb NOT NULL,
  compiled_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_canonical_field_contract (
  canonical_field_key varchar(500) PRIMARY KEY,
  field_name varchar(300) NOT NULL,
  data_type varchar(40) NOT NULL,
  unit_dimension varchar(80),
  privacy_class varchar(40) NOT NULL,
  source_table varchar(200),
  source_column varchar(200),
  api_property varchar(200),
  contract_hash varchar(64) NOT NULL,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_screen_field_binding (
  contract_id bigint NOT NULL REFERENCES framework_professional_screen_contract(contract_id) ON DELETE CASCADE,
  field_code varchar(300) NOT NULL,
  canonical_field_key varchar(500) NOT NULL REFERENCES framework_canonical_field_contract(canonical_field_key),
  route_path varchar(1000) NOT NULL,
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  audience varchar(20) NOT NULL,
  required boolean NOT NULL,
  editable boolean NOT NULL,
  control_type varchar(80),
  mapping_status varchar(40),
  field_order integer NOT NULL,
  PRIMARY KEY(contract_id,field_code)
);

CREATE TABLE IF NOT EXISTS framework_cross_screen_field_lineage (
  process_code varchar(80) NOT NULL,
  audience varchar(20) NOT NULL,
  from_step_code varchar(80) NOT NULL,
  to_step_code varchar(80) NOT NULL,
  canonical_field_key varchar(500) NOT NULL REFERENCES framework_canonical_field_contract(canonical_field_key),
  lineage_type varchar(30) NOT NULL,
  compatibility_status varchar(16) NOT NULL CHECK(compatibility_status IN ('COMPATIBLE','CONVERTED','BLOCKED')),
  PRIMARY KEY(process_code,audience,from_step_code,to_step_code,canonical_field_key)
);

CREATE TABLE IF NOT EXISTS framework_contract_compilation_issue (
  compilation_id bigint NOT NULL REFERENCES framework_contract_compilation_run(compilation_id) ON DELETE CASCADE,
  issue_code varchar(80) NOT NULL,
  severity varchar(16) NOT NULL CHECK(severity IN ('BLOCKING','WARNING')),
  resource_key varchar(1000) NOT NULL,
  field_key varchar(500),
  message text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_contract_issue_run_severity
  ON framework_contract_compilation_issue(compilation_id,severity,issue_code);
CREATE INDEX IF NOT EXISTS ix_screen_field_canonical
  ON framework_screen_field_binding(canonical_field_key,process_code,step_code);

CREATE OR REPLACE FUNCTION framework_contract_compiler_snapshot()
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'schemaVersion','1.0.0',
    'contracts',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'contractId',c.contract_id,'processCode',c.process_code,'stepCode',c.step_code,
      'stepOrder',s.step_order,'audience',c.audience,
      'routePath',lower(split_part(c.route_path,'?',1)),
      'fields',coalesce(framework_try_jsonb(c.field_contract),'[]'::jsonb),
      'apis',coalesce(framework_try_jsonb(c.api_contract),'[]'::jsonb),
      'data',coalesce(framework_try_jsonb(c.data_contract),'[]'::jsonb),
      'states',coalesce(framework_try_jsonb(c.state_contract),'[]'::jsonb)
    ) ORDER BY p.development_order,c.process_code,s.step_order,c.audience,c.contract_id)
    FROM framework_professional_screen_contract c
    JOIN framework_process_definition p USING(process_code)
    JOIN framework_process_step s ON s.process_code=c.process_code AND s.step_code=c.step_code
    WHERE c.contract_status IN ('DESIGN_COMPLETE','REVIEW_REQUIRED','VERIFIED')),'[]'::jsonb),
    'databaseColumns',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable='YES'))
      FROM information_schema.columns WHERE table_schema='public'),'[]'::jsonb),
    'registeredEndpoints',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'method',upper(http_method),'path',route_path,'key',endpoint_key))
      FROM framework_api_endpoint_registry WHERE active_yn='Y'),'[]'::jsonb))
$$;

CREATE OR REPLACE FUNCTION framework_import_contract_compilation(requested_result jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE run_id bigint;
BEGIN
  INSERT INTO framework_contract_compilation_run(
    contract_hash,screen_count,field_count,lineage_count,blocking_count,warning_count,
    compilation_status,elapsed_millis,result_json)
  VALUES(requested_result->>'contractHash',(requested_result->>'screenCount')::integer,
    (requested_result->>'fieldCount')::integer,(requested_result->>'lineageCount')::integer,
    (requested_result->>'blockingCount')::integer,(requested_result->>'warningCount')::integer,
    requested_result->>'status',(requested_result->>'elapsedMillis')::bigint,requested_result)
  RETURNING compilation_id INTO run_id;

  DELETE FROM framework_cross_screen_field_lineage;
  DELETE FROM framework_screen_field_binding;
  DELETE FROM framework_canonical_field_contract;

  INSERT INTO framework_canonical_field_contract(
    canonical_field_key,field_name,data_type,unit_dimension,privacy_class,
    source_table,source_column,api_property,contract_hash)
  SELECT "canonicalKey","fieldName","dataType",nullif("unitDimension",''),
    "privacyClass",nullif("sourceTable",''),nullif("sourceColumn",''),
    nullif("apiProperty",''),"contractHash"
  FROM jsonb_to_recordset(requested_result->'canonicalFields') AS x(
    "canonicalKey" text,"fieldName" text,"dataType" text,"unitDimension" text,
    "privacyClass" text,"sourceTable" text,"sourceColumn" text,
    "apiProperty" text,"contractHash" text);

  INSERT INTO framework_screen_field_binding(
    contract_id,field_code,canonical_field_key,route_path,process_code,step_code,
    audience,required,editable,control_type,mapping_status,field_order)
  SELECT "contractId","fieldCode","canonicalKey","routePath","processCode","stepCode",
    audience,required,editable,"controlType","mappingStatus","fieldOrder"
  FROM jsonb_to_recordset(requested_result->'bindings') AS x(
    "contractId" bigint,"fieldCode" text,"canonicalKey" text,"routePath" text,
    "processCode" text,"stepCode" text,audience text,required boolean,editable boolean,
    "controlType" text,"mappingStatus" text,"fieldOrder" integer);

  INSERT INTO framework_cross_screen_field_lineage(
    process_code,audience,from_step_code,to_step_code,canonical_field_key,
    lineage_type,compatibility_status)
  SELECT "processCode",audience,"fromStepCode","toStepCode","canonicalKey",
    "lineageType","compatibilityStatus"
  FROM jsonb_to_recordset(requested_result->'lineage') AS x(
    "processCode" text,audience text,"fromStepCode" text,"toStepCode" text,
    "canonicalKey" text,"lineageType" text,"compatibilityStatus" text);

  INSERT INTO framework_contract_compilation_issue(
    compilation_id,issue_code,severity,resource_key,field_key,message,evidence_json)
  SELECT run_id,"issueCode",severity,"resourceKey",nullif("fieldKey",''),
    message,coalesce(evidence,'{}'::jsonb)
  FROM jsonb_to_recordset(requested_result->'issues') AS x(
    "issueCode" text,severity text,"resourceKey" text,"fieldKey" text,
    message text,evidence jsonb);
  RETURN jsonb_build_object('success',true,'compilationId',run_id,
    'status',requested_result->>'status');
END $$;

CREATE OR REPLACE FUNCTION framework_contract_generation_allowed()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT compilation_status='PASSED'
    FROM framework_contract_compilation_run ORDER BY compilation_id DESC LIMIT 1),false)
$$;

CREATE OR REPLACE VIEW framework_latest_contract_compilation AS
SELECT r.*,coalesce((SELECT jsonb_agg(jsonb_build_object(
  'code',i.issue_code,'severity',i.severity,'resourceKey',i.resource_key,
  'fieldKey',i.field_key,'message',i.message) ORDER BY i.severity,i.issue_code)
  FROM framework_contract_compilation_issue i WHERE i.compilation_id=r.compilation_id),'[]'::jsonb) issues
FROM framework_contract_compilation_run r
WHERE r.compilation_id=(SELECT max(compilation_id) FROM framework_contract_compilation_run);
