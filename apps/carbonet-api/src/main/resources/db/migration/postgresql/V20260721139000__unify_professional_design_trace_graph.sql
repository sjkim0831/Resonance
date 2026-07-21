-- One canonical, generator-ready design graph for actors, business order,
-- processes, executable project work, guides, screens, fields, persistence and
-- tests. A screen is deliberately independent from a process step so the same
-- implemented workspace can safely serve many processes/steps (N:M).

CREATE TABLE IF NOT EXISTS framework_screen_resource (
  screen_resource_id bigserial PRIMARY KEY,
  route_key varchar(500) NOT NULL UNIQUE,
  screen_name varchar(300) NOT NULL,
  screen_type varchar(60) NOT NULL DEFAULT 'WORKSPACE',
  implementation_status varchar(32) NOT NULL DEFAULT 'DESIGN_ONLY'
    CHECK(implementation_status IN ('DESIGN_ONLY','IMPLEMENTED','VERIFIED')),
  source_kind varchar(32) NOT NULL DEFAULT 'DESIGN_REGISTRY',
  source_ref text,
  responsive_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  accessibility_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  security_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_process_step_screen_binding (
  binding_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  screen_resource_id bigint NOT NULL REFERENCES framework_screen_resource(screen_resource_id) ON DELETE CASCADE,
  audience varchar(16) NOT NULL CHECK(audience IN ('USER','ADMIN','PUBLIC')),
  actor_code varchar(80) NOT NULL REFERENCES framework_actor_definition(actor_code),
  entry_mode varchar(24) NOT NULL DEFAULT 'PRIMARY' CHECK(entry_mode IN ('PRIMARY','SUPPORT','POPUP','TAB','READ_ONLY')),
  initial_view varchar(120),
  context_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  guide_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  binding_status varchar(24) NOT NULL DEFAULT 'ACTIVE' CHECK(binding_status IN ('ACTIVE','DRAFT','RETIRED')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(process_code,step_code,screen_resource_id,audience),
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_step_screen_route
  ON framework_process_step_screen_binding(process_code,step_code,audience,binding_status);

CREATE TABLE IF NOT EXISTS framework_screen_capability (
  capability_id bigserial PRIMARY KEY,
  screen_resource_id bigint NOT NULL REFERENCES framework_screen_resource(screen_resource_id) ON DELETE CASCADE,
  capability_code varchar(120) NOT NULL,
  capability_name varchar(240) NOT NULL,
  capability_type varchar(32) NOT NULL CHECK(capability_type IN ('QUERY','COMMAND','VALIDATION','CALCULATION','UPLOAD','DOWNLOAD','NAVIGATION','DECISION')),
  command_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  implementation_status varchar(24) NOT NULL DEFAULT 'DESIGNED' CHECK(implementation_status IN ('DESIGNED','IMPLEMENTED','VERIFIED')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(screen_resource_id,capability_code)
);

CREATE TABLE IF NOT EXISTS framework_step_capability_binding (
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  capability_id bigint NOT NULL REFERENCES framework_screen_capability(capability_id) ON DELETE CASCADE,
  actor_code varchar(80) NOT NULL REFERENCES framework_actor_definition(actor_code),
  required boolean NOT NULL DEFAULT true,
  permission_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_effect jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(process_code,step_code,capability_id),
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS framework_data_element (
  data_element_code varchar(240) PRIMARY KEY,
  domain_code varchar(60) NOT NULL,
  logical_name varchar(240) NOT NULL,
  data_type varchar(40) NOT NULL,
  semantic_definition text NOT NULL,
  privacy_class varchar(24) NOT NULL DEFAULT 'INTERNAL',
  unit_dimension varchar(60),
  code_group varchar(100),
  canonical_validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_screen_data_binding (
  screen_resource_id bigint NOT NULL REFERENCES framework_screen_resource(screen_resource_id) ON DELETE CASCADE,
  data_element_code varchar(240) NOT NULL REFERENCES framework_data_element(data_element_code) ON DELETE CASCADE,
  field_code varchar(120) NOT NULL,
  field_name varchar(240) NOT NULL,
  control_type varchar(40) NOT NULL,
  api_property varchar(160) NOT NULL,
  source_table varchar(160),
  source_column varchar(160),
  required boolean NOT NULL DEFAULT false,
  editable boolean NOT NULL DEFAULT true,
  validation_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  lineage_status varchar(32) NOT NULL CHECK(lineage_status IN ('CONTEXT','LOGICAL_CONTRACT','DB_RESOLVED','IMPLEMENTATION_VERIFIED')),
  PRIMARY KEY(screen_resource_id,data_element_code,field_code)
);

CREATE TABLE IF NOT EXISTS framework_step_data_binding (
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  data_element_code varchar(240) NOT NULL REFERENCES framework_data_element(data_element_code) ON DELETE CASCADE,
  io_direction varchar(12) NOT NULL CHECK(io_direction IN ('INPUT','OUTPUT','INOUT')),
  required boolean NOT NULL DEFAULT false,
  source_step_code varchar(100),
  handoff_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(process_code,step_code,data_element_code,io_direction),
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS framework_state_transition_contract (
  transition_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  actor_code varchar(80) NOT NULL REFERENCES framework_actor_definition(actor_code),
  command_code varchar(120) NOT NULL,
  from_state varchar(80) NOT NULL,
  to_state varchar(80) NOT NULL,
  precondition_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_required boolean NOT NULL DEFAULT true,
  UNIQUE(process_code,step_code,command_code,from_state,to_state),
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS framework_step_test_binding (
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  case_code varchar(100) NOT NULL REFERENCES framework_simulation_case(case_code) ON DELETE CASCADE,
  trace_scope varchar(16) NOT NULL CHECK(trace_scope IN ('STEP','PROCESS')),
  expected_state varchar(80),
  assertion_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_required boolean NOT NULL DEFAULT true,
  PRIMARY KEY(process_code,step_code,case_code),
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS framework_design_generation_run (
  run_id bigserial PRIMARY KEY,
  requested_process_code varchar(80),
  run_status varchar(24) NOT NULL CHECK(run_status IN ('RUNNING','COMPLETED','BLOCKED','FAILED')),
  generated_process_count integer NOT NULL DEFAULT 0,
  generated_step_count integer NOT NULL DEFAULT 0,
  generated_screen_count integer NOT NULL DEFAULT 0,
  blocker_count integer NOT NULL DEFAULT 0,
  duration_ms bigint,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by varchar(100) NOT NULL,
  started_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp
);

CREATE OR REPLACE FUNCTION framework_generate_professional_design_graph(
  requested_process varchar DEFAULT NULL, requested_by varchar DEFAULT 'DESIGN_GRAPH_GENERATOR'
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  started timestamp := clock_timestamp();
  run_key bigint;
  result jsonb;
BEGIN
  IF requested_process IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM framework_process_definition WHERE process_code=requested_process
  ) THEN RAISE EXCEPTION 'unknown process %',requested_process; END IF;

  INSERT INTO framework_design_generation_run(requested_process_code,run_status,requested_by)
  VALUES(requested_process,'RUNNING',requested_by) RETURNING run_id INTO run_key;

  INSERT INTO framework_screen_resource(route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
    responsive_contract,accessibility_contract,security_contract)
  SELECT DISTINCT ON(route_key) route_key,page_title,screen_type,
    CASE WHEN route_status='IMPLEMENTED' THEN 'IMPLEMENTED' ELSE 'DESIGN_ONLY' END,
    'PAGE_DESIGN',page_code,responsive_contract,accessibility_contract,security_contract
  FROM (
    SELECT lower(split_part(coalesce(nullif(actual_route_path,''),planned_route_path),'?',1)) route_key,d.*
    FROM framework_page_design d
    WHERE (requested_process IS NULL OR d.process_code=requested_process)
      AND nullif(split_part(coalesce(nullif(actual_route_path,''),planned_route_path),'?',1),'') IS NOT NULL
  ) q ORDER BY route_key,CASE route_status WHEN 'IMPLEMENTED' THEN 0 ELSE 1 END,page_design_id
  ON CONFLICT(route_key) DO UPDATE SET
    screen_name=excluded.screen_name,screen_type=excluded.screen_type,
    implementation_status=CASE WHEN framework_screen_resource.implementation_status='VERIFIED' THEN 'VERIFIED'
      WHEN excluded.implementation_status='IMPLEMENTED' THEN 'IMPLEMENTED' ELSE framework_screen_resource.implementation_status END,
    responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
    security_contract=excluded.security_contract,updated_at=current_timestamp;

  INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,
    entry_mode,context_contract,visibility_contract,completion_contract,guide_contract)
  SELECT d.process_code,d.step_code,r.screen_resource_id,d.audience,d.actor_code,'PRIMARY',
    jsonb_build_object('tenantId',true,'projectId',true,'processCode',d.process_code,'stepCode',d.step_code,'actorCode',d.actor_code),
    jsonb_build_object('audience',d.audience,'serverAuthorization',true,'tenantIsolation',true,'projectIsolation',true),
    jsonb_build_object('entryCondition',d.entry_condition,'exitCondition',d.exit_condition),
    jsonb_build_object('title',d.page_title,'purpose',d.page_purpose,'route',r.route_key,
      'nextStepCode',d.downstream_step_code,'resumeSupported',true)
  FROM framework_page_design d JOIN framework_screen_resource r
    ON r.route_key=lower(split_part(coalesce(nullif(d.actual_route_path,''),d.planned_route_path),'?',1))
  WHERE requested_process IS NULL OR d.process_code=requested_process
  ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET
    actor_code=excluded.actor_code,context_contract=excluded.context_contract,
    visibility_contract=excluded.visibility_contract,completion_contract=excluded.completion_contract,
    guide_contract=excluded.guide_contract,binding_status='ACTIVE',updated_at=current_timestamp;

  INSERT INTO framework_screen_capability(screen_resource_id,capability_code,capability_name,capability_type,
    command_contract,error_contract,evidence_contract,implementation_status)
  SELECT DISTINCT ON(b.screen_resource_id,upper(s.command_code))
    b.screen_resource_id,upper(s.command_code),s.step_name||' 실행','COMMAND',
    jsonb_build_object('commandCode',s.command_code,'transactional',true,'idempotencyRequired',true,'rowVersionRequired',true),
    jsonb_build_object('states',jsonb_build_array('VALIDATION_ERROR','FORBIDDEN','CONFLICT','DEPENDENCY_BLOCKED','SERVER_ERROR')),
    jsonb_build_object('auditRequired',true,'inputSnapshot',true,'resultSnapshot',true),
    CASE r.implementation_status WHEN 'VERIFIED' THEN 'VERIFIED' WHEN 'IMPLEMENTED' THEN 'IMPLEMENTED' ELSE 'DESIGNED' END
  FROM framework_process_step_screen_binding b
  JOIN framework_process_step s USING(process_code,step_code)
  JOIN framework_screen_resource r USING(screen_resource_id)
  WHERE requested_process IS NULL OR s.process_code=requested_process
  ORDER BY b.screen_resource_id,upper(s.command_code),
    CASE r.implementation_status WHEN 'VERIFIED' THEN 0 WHEN 'IMPLEMENTED' THEN 1 ELSE 2 END,
    s.process_code,s.step_order
  ON CONFLICT(screen_resource_id,capability_code) DO UPDATE SET
    capability_name=excluded.capability_name,command_contract=excluded.command_contract,
    error_contract=excluded.error_contract,evidence_contract=excluded.evidence_contract,
    implementation_status=excluded.implementation_status,updated_at=current_timestamp;

  INSERT INTO framework_step_capability_binding(process_code,step_code,capability_id,actor_code,required,
    permission_contract,completion_effect)
  SELECT DISTINCT ON(b.process_code,b.step_code,c.capability_id)
    b.process_code,b.step_code,c.capability_id,b.actor_code,true,
    jsonb_build_object('actorCode',b.actor_code,'serverAuthorization',true,'segregationOfDuties',true),
    jsonb_build_object('completionRule',s.completion_rule,'fromState',s.from_state,'toState',s.to_state)
  FROM framework_process_step_screen_binding b
  JOIN framework_process_step s USING(process_code,step_code)
  JOIN framework_screen_capability c ON c.screen_resource_id=b.screen_resource_id AND c.capability_code=upper(s.command_code)
  WHERE requested_process IS NULL OR b.process_code=requested_process
  ORDER BY b.process_code,b.step_code,c.capability_id,
    CASE b.entry_mode WHEN 'PRIMARY' THEN 0 WHEN 'TAB' THEN 1 WHEN 'POPUP' THEN 2 ELSE 3 END
  ON CONFLICT(process_code,step_code,capability_id) DO UPDATE SET
    actor_code=excluded.actor_code,permission_contract=excluded.permission_contract,completion_effect=excluded.completion_effect;

  INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,
    privacy_class,canonical_validation)
  SELECT DISTINCT ON(upper(p.domain_code)||'.'||upper(f.field_code))
    upper(p.domain_code)||'.'||upper(f.field_code),upper(p.domain_code),f.field_name,f.data_type,
    coalesce(nullif(f.help_text,''),f.field_name||' 업무 데이터'),f.privacy_class,f.validation_contract
  FROM framework_page_field_definition f JOIN framework_page_design d USING(page_design_id)
  JOIN framework_process_definition p USING(process_code)
  WHERE requested_process IS NULL OR d.process_code=requested_process
  ORDER BY upper(p.domain_code)||'.'||upper(f.field_code),
    CASE f.mapping_status WHEN 'DB_RESOLVED' THEN 0 WHEN 'CONTEXT' THEN 1 ELSE 2 END,
    f.page_field_id
  ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
    semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
    canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

  -- A step-level contract remains traceable even when its shared screen is a
  -- metadata workspace and has no editable physical field yet. Concrete screen,
  -- API and DB bindings enrich (and never replace) these semantic I/O anchors.
  INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,
    privacy_class,canonical_validation)
  SELECT upper(s.process_code)||'.'||upper(s.step_code)||'.'||io.suffix,upper(p.domain_code),
    s.step_name||io.logical_name,'JSON',io.definition,'INTERNAL',io.contract
  FROM framework_process_step s JOIN framework_process_definition p USING(process_code)
  CROSS JOIN LATERAL (VALUES
    ('INPUT_CONTRACT',' 입력 계약','단계 실행에 필요한 필드·문서·업무 문맥의 구조화 계약',framework_try_jsonb(s.input_contract)),
    ('OUTPUT_CONTRACT',' 산출물 계약','완료 조건을 증명하고 후속 단계로 전달할 구조화 산출물 계약',framework_try_jsonb(s.output_contract))
  ) io(suffix,logical_name,definition,contract)
  WHERE requested_process IS NULL OR s.process_code=requested_process
  ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,
    semantic_definition=excluded.semantic_definition,canonical_validation=excluded.canonical_validation,
    updated_at=current_timestamp;

  INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,
    api_property,source_table,source_column,required,editable,validation_contract,lineage_status)
  SELECT DISTINCT ON(r.screen_resource_id,e.data_element_code,f.field_code)
    r.screen_resource_id,e.data_element_code,f.field_code,f.field_name,f.control_type,f.api_property,
    f.source_table,f.source_column,f.required,f.editable,f.validation_contract,
    CASE WHEN f.mapping_status='DB_RESOLVED' AND f.source_table IS NOT NULL AND f.source_column IS NOT NULL
      THEN 'DB_RESOLVED' ELSE f.mapping_status END
  FROM framework_page_field_definition f JOIN framework_page_design d USING(page_design_id)
  JOIN framework_process_definition p USING(process_code)
  JOIN framework_data_element e ON e.data_element_code=upper(p.domain_code)||'.'||upper(f.field_code)
  JOIN framework_screen_resource r ON r.route_key=lower(split_part(coalesce(nullif(d.actual_route_path,''),d.planned_route_path),'?',1))
  WHERE requested_process IS NULL OR d.process_code=requested_process
  ORDER BY r.screen_resource_id,e.data_element_code,f.field_code,
    CASE f.mapping_status WHEN 'DB_RESOLVED' THEN 0 WHEN 'CONTEXT' THEN 1 ELSE 2 END
  ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET
    field_name=excluded.field_name,control_type=excluded.control_type,api_property=excluded.api_property,
    source_table=excluded.source_table,source_column=excluded.source_column,required=excluded.required,
    editable=excluded.editable,validation_contract=excluded.validation_contract,lineage_status=excluded.lineage_status;

  INSERT INTO framework_step_data_binding(process_code,step_code,data_element_code,io_direction,required,handoff_rule)
  SELECT DISTINCT ON(b.process_code,b.step_code,d.data_element_code,CASE WHEN d.editable THEN 'INOUT' ELSE 'OUTPUT' END)
    b.process_code,b.step_code,d.data_element_code,
    CASE WHEN d.editable THEN 'INOUT' ELSE 'OUTPUT' END,d.required,
    jsonb_build_object('screenResourceId',b.screen_resource_id,'fieldCode',d.field_code,'apiProperty',d.api_property,
      'sourceTable',d.source_table,'sourceColumn',d.source_column)
  FROM framework_process_step_screen_binding b JOIN framework_screen_data_binding d USING(screen_resource_id)
  WHERE requested_process IS NULL OR b.process_code=requested_process
  ORDER BY b.process_code,b.step_code,d.data_element_code,CASE WHEN d.editable THEN 'INOUT' ELSE 'OUTPUT' END,
    CASE d.lineage_status WHEN 'IMPLEMENTATION_VERIFIED' THEN 0 WHEN 'DB_RESOLVED' THEN 1 WHEN 'CONTEXT' THEN 2 ELSE 3 END,
    d.field_code
  ON CONFLICT(process_code,step_code,data_element_code,io_direction) DO UPDATE SET
    required=excluded.required,handoff_rule=excluded.handoff_rule;

  INSERT INTO framework_step_data_binding(process_code,step_code,data_element_code,io_direction,required,handoff_rule)
  SELECT s.process_code,s.step_code,upper(s.process_code)||'.'||upper(s.step_code)||'.'||io.suffix,
    io.direction,true,jsonb_build_object('contract',io.contract,'semanticAnchor',true,
      'requiresConcreteFieldBinding',io.contract<>'{}'::jsonb)
  FROM framework_process_step s
  CROSS JOIN LATERAL (VALUES
    ('INPUT_CONTRACT','INPUT',framework_try_jsonb(s.input_contract)),
    ('OUTPUT_CONTRACT','OUTPUT',framework_try_jsonb(s.output_contract))
  ) io(suffix,direction,contract)
  WHERE requested_process IS NULL OR s.process_code=requested_process
  ON CONFLICT(process_code,step_code,data_element_code,io_direction) DO UPDATE SET
    required=true,handoff_rule=excluded.handoff_rule;

  INSERT INTO framework_state_transition_contract(process_code,step_code,actor_code,command_code,from_state,to_state,
    precondition_contract,completion_contract,failure_contract,audit_contract,idempotency_required)
  SELECT process_code,step_code,actor_code,command_code,from_state,to_state,
    jsonb_build_object('inputContract',framework_try_jsonb(input_contract),'actorRequired',true,'predecessorsCompleted',true),
    jsonb_build_object('rule',completion_rule,'outputContract',framework_try_jsonb(output_contract)),
    jsonb_build_object('rollbackState',from_state,'retry','idempotent-only','conflictDetection',true),
    jsonb_build_object('actor',true,'timestamp',true,'beforeAfter',true,'evidence',true),true
  FROM framework_process_step WHERE requested_process IS NULL OR process_code=requested_process
  ON CONFLICT(process_code,step_code,command_code,from_state,to_state) DO UPDATE SET
    actor_code=excluded.actor_code,precondition_contract=excluded.precondition_contract,
    completion_contract=excluded.completion_contract,failure_contract=excluded.failure_contract,
    audit_contract=excluded.audit_contract,idempotency_required=true;

  INSERT INTO framework_step_test_binding(process_code,step_code,case_code,trace_scope,expected_state,assertion_contract,evidence_required)
  SELECT s.process_code,s.step_code,c.case_code,
    CASE WHEN upper(c.steps_json) LIKE '%'||upper(s.step_code)||'%' THEN 'STEP' ELSE 'PROCESS' END,
    s.to_state,framework_try_jsonb(c.assertions_json),true
  FROM framework_process_step s JOIN framework_simulation_case c USING(process_code)
  WHERE requested_process IS NULL OR s.process_code=requested_process
  ON CONFLICT(process_code,step_code,case_code) DO UPDATE SET trace_scope=excluded.trace_scope,
    expected_state=excluded.expected_state,assertion_contract=excluded.assertion_contract,evidence_required=true;

  SELECT jsonb_build_object(
    'schemaVersion','3.0.0','runId',run_key,'requestedProcess',requested_process,
    'durationMs',round(extract(epoch FROM(clock_timestamp()-started))*1000),
    'processCount',count(DISTINCT s.process_code),'stepCount',count(DISTINCT(s.process_code,s.step_code)),
    'screenCount',count(DISTINCT b.screen_resource_id),
    'manyToManyBindingCount',count(DISTINCT b.binding_id),
    'blockerCount',count(*) FILTER(WHERE q.design_status<>'READY')
  ) INTO result
  FROM framework_process_step s
  LEFT JOIN framework_process_step_screen_binding b USING(process_code,step_code)
  LEFT JOIN framework_professional_design_graph_quality q USING(process_code,step_code)
  WHERE requested_process IS NULL OR s.process_code=requested_process;

  UPDATE framework_design_generation_run SET run_status=CASE WHEN (result->>'blockerCount')::integer=0 THEN 'COMPLETED' ELSE 'BLOCKED' END,
    generated_process_count=(result->>'processCount')::integer,generated_step_count=(result->>'stepCount')::integer,
    generated_screen_count=(result->>'screenCount')::integer,blocker_count=(result->>'blockerCount')::integer,
    duration_ms=(result->>'durationMs')::bigint,result_snapshot=result,completed_at=current_timestamp WHERE run_id=run_key;
  RETURN result;
END $function$;

CREATE OR REPLACE VIEW framework_professional_design_graph AS
SELECT seq.work_type_code,seq.workflow_order,seq.workflow_phase,p.process_code,p.process_name,
  s.step_code,s.step_name,s.step_order,s.actor_code,s.from_state,s.command_code,s.to_state,
  b.binding_id,b.audience,b.entry_mode,r.screen_resource_id,r.route_key,r.screen_name,r.screen_type,r.implementation_status,
  b.context_contract,b.visibility_contract,b.completion_contract,b.guide_contract,
  coalesce((SELECT jsonb_agg(jsonb_build_object('capabilityCode',c.capability_code,'name',c.capability_name,
    'type',c.capability_type,'required',x.required,'implementationStatus',c.implementation_status) ORDER BY c.capability_code)
    FROM framework_step_capability_binding x JOIN framework_screen_capability c USING(capability_id)
    WHERE x.process_code=s.process_code AND x.step_code=s.step_code AND c.screen_resource_id=r.screen_resource_id),'[]'::jsonb) capabilities,
  coalesce((SELECT jsonb_agg(jsonb_build_object('dataElementCode',d.data_element_code,'name',e.logical_name,
    'direction',d.io_direction,'required',d.required,'lineage',d.handoff_rule) ORDER BY d.data_element_code)
    FROM framework_step_data_binding d JOIN framework_data_element e USING(data_element_code)
    WHERE d.process_code=s.process_code AND d.step_code=s.step_code),'[]'::jsonb) data_elements,
  coalesce((SELECT jsonb_agg(jsonb_build_object('caseCode',t.case_code,'scope',t.trace_scope,
    'expectedState',t.expected_state,'evidenceRequired',t.evidence_required) ORDER BY t.case_code)
    FROM framework_step_test_binding t WHERE t.process_code=s.process_code AND t.step_code=s.step_code),'[]'::jsonb) tests
  ,coalesce((SELECT jsonb_agg(jsonb_build_object('projectId',t.project_id,'taskId',t.task_id,
    'taskCode',t.task_code,'taskName',t.task_name,'status',t.task_status,'assigneeId',t.assignee_id,
    'dueDate',t.due_date,'targetUrl',t.target_url) ORDER BY t.project_id,t.step_order,t.task_id)
    FROM emission_project_task t WHERE framework_task_matches_process(t.process_code,t.task_code,s.process_code)
      AND (t.process_step_code=s.step_code OR t.process_step_code IS NULL)),'[]'::jsonb) actual_project_tasks
FROM framework_business_process_sequence seq
JOIN framework_process_definition p USING(process_code)
JOIN framework_process_step s USING(process_code)
LEFT JOIN framework_process_step_screen_binding b ON b.process_code=s.process_code AND b.step_code=s.step_code AND b.binding_status='ACTIVE'
LEFT JOIN framework_screen_resource r USING(screen_resource_id);

CREATE OR REPLACE VIEW framework_professional_design_graph_quality AS
SELECT s.process_code,s.step_code,
  count(DISTINCT b.binding_id)::integer screen_binding_count,
  count(DISTINCT c.capability_id)::integer capability_count,
  count(DISTINCT d.data_element_code) FILTER(WHERE d.io_direction IN ('INPUT','INOUT'))::integer input_count,
  count(DISTINCT d.data_element_code) FILTER(WHERE d.io_direction IN ('OUTPUT','INOUT'))::integer output_count,
  count(DISTINCT t.case_code)::integer test_count,
  count(DISTINCT sc.case_type)::integer test_family_count,
  count(DISTINCT tr.transition_id)::integer transition_count,
  array_remove(ARRAY[
    CASE WHEN count(DISTINCT b.binding_id)=0 THEN 'SCREEN_BINDING_MISSING' END,
    CASE WHEN count(DISTINCT c.capability_id)=0 THEN 'CAPABILITY_BINDING_MISSING' END,
    CASE WHEN count(DISTINCT d.data_element_code) FILTER(WHERE d.io_direction IN ('INPUT','INOUT'))=0 THEN 'INPUT_LINEAGE_MISSING' END,
    CASE WHEN count(DISTINCT d.data_element_code) FILTER(WHERE d.io_direction IN ('OUTPUT','INOUT'))=0 THEN 'OUTPUT_LINEAGE_MISSING' END,
    CASE WHEN count(DISTINCT tr.transition_id)=0 THEN 'STATE_TRANSITION_MISSING' END,
    CASE WHEN count(DISTINCT sc.case_type)<5 THEN 'SAFETY_TEST_FAMILY_MISSING' END
  ],NULL) blocker_codes,
  CASE WHEN count(DISTINCT b.binding_id)>0 AND count(DISTINCT c.capability_id)>0
    AND count(DISTINCT d.data_element_code) FILTER(WHERE d.io_direction IN ('INPUT','INOUT'))>0
    AND count(DISTINCT d.data_element_code) FILTER(WHERE d.io_direction IN ('OUTPUT','INOUT'))>0
    AND count(DISTINCT tr.transition_id)>0 AND count(DISTINCT sc.case_type)>=5 THEN 'READY' ELSE 'BLOCKED' END design_status
FROM framework_process_step s
LEFT JOIN framework_process_step_screen_binding b USING(process_code,step_code)
LEFT JOIN framework_step_capability_binding c USING(process_code,step_code)
LEFT JOIN framework_step_data_binding d USING(process_code,step_code)
LEFT JOIN framework_state_transition_contract tr USING(process_code,step_code)
LEFT JOIN framework_step_test_binding t USING(process_code,step_code)
LEFT JOIN framework_simulation_case sc USING(case_code)
GROUP BY s.process_code,s.step_code;

-- The function reads the quality view, therefore define it before invoking it.
SELECT framework_generate_professional_design_graph(NULL,'FLYWAY_PROFESSIONAL_DESIGN_GRAPH');

CREATE OR REPLACE VIEW framework_professional_design_graph_summary AS
SELECT count(DISTINCT process_code)::integer process_count,count(*)::integer step_count,
  count(*) FILTER(WHERE design_status='READY')::integer ready_step_count,
  count(*) FILTER(WHERE design_status='BLOCKED')::integer blocked_step_count,
  coalesce(sum(screen_binding_count),0)::integer screen_binding_count,
  coalesce(sum(capability_count),0)::integer capability_binding_count,
  coalesce(sum(test_count),0)::integer test_binding_count
FROM framework_professional_design_graph_quality;

DO $verification$
DECLARE missing_steps integer; duplicate_routes integer; elapsed bigint;
BEGIN
  SELECT count(*) INTO missing_steps FROM framework_professional_design_graph_quality WHERE screen_binding_count=0;
  SELECT count(*) INTO duplicate_routes FROM (SELECT route_key FROM framework_screen_resource GROUP BY route_key HAVING count(*)>1) x;
  SELECT duration_ms INTO elapsed FROM framework_design_generation_run ORDER BY run_id DESC LIMIT 1;
  IF missing_steps>0 THEN RAISE EXCEPTION 'professional design graph has % steps without a screen binding',missing_steps; END IF;
  IF duplicate_routes>0 THEN RAISE EXCEPTION 'professional design graph has % duplicate canonical routes',duplicate_routes; END IF;
  IF elapsed>300000 THEN RAISE EXCEPTION 'full design generation exceeded five minute budget: % ms',elapsed; END IF;
END $verification$;
