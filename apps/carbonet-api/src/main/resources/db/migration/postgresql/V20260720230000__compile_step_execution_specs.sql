-- Compile every actor/process step into one executable, generator-owned
-- contract.  This is deliberately separate from implementation evidence:
-- DESIGN_COMPLETE means that generation inputs are structurally complete;
-- IMPLEMENTED still requires a real route/API/database/test verification.

CREATE TABLE IF NOT EXISTS framework_step_execution_spec (
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  step_code varchar(100) NOT NULL,
  spec_version integer NOT NULL DEFAULT 1,
  actor_contract jsonb NOT NULL,
  business_contract jsonb NOT NULL,
  transition_contract jsonb NOT NULL,
  input_contract jsonb NOT NULL,
  output_contract jsonb NOT NULL,
  screen_contract jsonb NOT NULL,
  field_contract jsonb NOT NULL,
  command_contract jsonb NOT NULL,
  api_contract jsonb NOT NULL,
  persistence_contract jsonb NOT NULL,
  handoff_contract jsonb NOT NULL,
  test_contract jsonb NOT NULL,
  guide_contract jsonb NOT NULL,
  nonfunctional_contract jsonb NOT NULL,
  design_status varchar(32) NOT NULL CHECK (design_status IN ('DESIGN_COMPLETE','DESIGN_BLOCKED')),
  approval_status varchar(24) NOT NULL CHECK (approval_status IN ('REVIEW_REQUIRED','APPROVED','REJECTED')),
  generation_status varchar(24) NOT NULL CHECK (generation_status IN ('BLOCKED','READY','GENERATED')),
  blocker_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_hash varchar(64) NOT NULL,
  approved_by varchar(100),
  approved_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(process_code,step_code),
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_step_execution_spec_generation
  ON framework_step_execution_spec(generation_status,process_code,step_code);

WITH page_specs AS (
  SELECT d.process_code,d.step_code,
    jsonb_agg(jsonb_build_object(
      'audience',d.audience,'pageCode',d.page_code,'title',d.page_title,
      'purpose',d.page_purpose,'screenType',d.screen_type,
      'plannedRoute',d.planned_route_path,'actualRoute',d.actual_route_path,
      'routeStatus',d.route_status,'primaryEntity',d.primary_entity,
      'responsive',d.responsive_contract,'accessibility',d.accessibility_contract,
      'security',d.security_contract,'exceptions',d.exception_contract
    ) ORDER BY d.audience) AS screens,
    jsonb_agg(jsonb_build_object(
      'audience',d.audience,'fields',coalesce(f.fields,'[]'::jsonb)
    ) ORDER BY d.audience) AS fields,
    count(*) FILTER(WHERE d.route_status='DESIGN_ONLY')::integer AS planned_count,
    count(*) FILTER(WHERE coalesce(f.field_count,0)<10)::integer AS weak_page_count
  FROM framework_page_design d
  LEFT JOIN LATERAL (
    SELECT count(*)::integer field_count,
      jsonb_agg(jsonb_build_object(
        'order',x.field_order,'group',x.field_group,'code',x.field_code,
        'name',x.field_name,'dataType',x.data_type,'controlType',x.control_type,
        'required',x.required,'editable',x.editable,'listVisible',x.list_visible,
        'searchEnabled',x.search_enabled,'sourceTable',x.source_table,
        'sourceColumn',x.source_column,'apiProperty',x.api_property,
        'mappingStatus',x.mapping_status,'validation',x.validation_contract,
        'privacyClass',x.privacy_class,'permissionCode',x.permission_code,
        'evidenceRequired',x.evidence_required,'responsivePriority',x.responsive_priority,
        'helpText',x.help_text,'designSource',x.design_source
      ) ORDER BY x.field_order,x.page_field_id) AS fields
    FROM framework_page_field_definition x WHERE x.page_design_id=d.page_design_id
  ) f ON true
  GROUP BY d.process_code,d.step_code
), test_specs AS (
  SELECT p.process_code,
    jsonb_agg(jsonb_build_object(
      'caseCode',c.case_code,'name',c.case_name,'type',c.case_type,
      'preconditions',c.preconditions,'steps',framework_try_jsonb(c.steps_json),
      'assertions',framework_try_jsonb(c.assertions_json),'status',c.case_status
    ) ORDER BY c.case_type,c.case_code) FILTER(WHERE c.case_code IS NOT NULL) AS tests,
    count(DISTINCT CASE
      WHEN c.case_type IN ('EXCEPTION','VALIDATION') THEN 'EXCEPTION'
      WHEN c.case_type IN ('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY') THEN c.case_type END)::integer AS safety_family_count
  FROM framework_process_definition p LEFT JOIN framework_simulation_case c USING(process_code)
  GROUP BY p.process_code
), handoffs AS (
  SELECT process_code,from_step_code AS step_code,
    jsonb_agg(jsonb_build_object(
      'type',handoff_type,'toProcessCode',to_process_code,'toStepCode',to_step_code,
      'contextKeys',context_keys,'payload',payload_contract,'integrity',integrity_contract,
      'authorization',authorization_contract,'failure',failure_contract
    ) ORDER BY handoff_type,to_process_code,to_step_code) AS contracts
  FROM framework_process_data_handoff GROUP BY process_code,from_step_code
), compiled AS (
  SELECT p.process_code,s.step_code,p.definition_locked,
    jsonb_build_object(
      'actorCode',s.actor_code,'ownerActorCode',p.owner_actor_code,
      'tenantIsolation',true,'projectIsolation',true,'delegationChecked',true,
      'segregationOfDuties',true
    ) AS actor_contract,
    jsonb_build_object(
      'domainCode',p.domain_code,'processName',p.process_name,'stepName',s.step_name,
      'goal',p.goal,'requirement',s.requirement_text,'completionRule',s.completion_rule,
      'riskLevel',p.risk_level,'slaHours',p.sla_hours,'regulationRefs',p.regulation_refs
    ) AS business_contract,
    jsonb_build_object(
      'commandCode',s.command_code,'fromState',s.from_state,'toState',s.to_state,
      'stepOrder',s.step_order,'parentStepCode',s.parent_step_code,
      'stepType',s.step_type,'completionRule',s.completion_rule,
      'optimisticLock',true,'idempotencyRequired',true,'auditRequired',true
    ) AS transition_contract,
    framework_try_jsonb(s.input_contract) AS input_contract,
    framework_try_jsonb(s.output_contract) AS output_contract,
    coalesce(pg.screens,'[]'::jsonb) AS screen_contract,
    coalesce(pg.fields,'[]'::jsonb) AS field_contract,
    jsonb_build_array(jsonb_build_object(
      'commandCode',s.command_code,'actorCode',s.actor_code,
      'entryState',s.from_state,'resultState',s.to_state,
      'serverAuthorization',true,'validationRequired',true,'auditRequired',true
    )) AS command_contract,
    CASE WHEN s.requires_api THEN jsonb_build_array(jsonb_build_object(
      'declaredContract',s.api_contract,'transactional',true,'tenantGuard',true,
      'projectGuard',true,'actorGuard',true,'idempotencyKey',true,'rowVersion',true,
      'errorContract',jsonb_build_array('VALIDATION_ERROR','FORBIDDEN','CONFLICT','DEPENDENCY_BLOCKED','SERVER_ERROR')
    )) ELSE '[]'::jsonb END AS api_contract,
    jsonb_build_object(
      'primaryEntities',coalesce((SELECT jsonb_agg(DISTINCT e->>'primaryEntity')
        FROM jsonb_array_elements(coalesce(pg.screens,'[]'::jsonb)) e
        WHERE nullif(e->>'primaryEntity','') IS NOT NULL),'[]'::jsonb),
      'fieldMappings',coalesce(pg.fields,'[]'::jsonb),'transactional',s.requires_api,
      'historyRequired',true,'softDeleteDefault',true,'indexesRequired',true,
      'foreignKeysRequired',true,'migrationRequired',true
    ) AS persistence_contract,
    coalesce(h.contracts,'[]'::jsonb) AS handoff_contract,
    coalesce(t.tests,'[]'::jsonb) AS test_contract,
    jsonb_build_object(
      'workTypeCode',p.domain_code,
      'processCode',p.process_code,'stepCode',s.step_code,'stepOrder',s.step_order,
      'actorCode',s.actor_code,'title',s.step_name,'purpose',s.requirement_text,
      'entryCondition',s.from_state,'completionCondition',s.completion_rule,
      'userPath',s.user_path,'adminPath',s.admin_path,
      'nextStepCode',(SELECT n.step_code FROM framework_process_step n
        WHERE n.process_code=s.process_code AND n.step_order>s.step_order ORDER BY n.step_order LIMIT 1)
    ) AS guide_contract,
    jsonb_build_object(
      'responsive',jsonb_build_object('mobile','single-column','tablet','adaptive-two-column','desktop','task-optimized','noTextOverflow',true),
      'accessibility',jsonb_build_object('standard','WCAG 2.1 AA','keyboard',true,'focus',true,'errorSummary',true),
      'security',jsonb_build_object('serverAuthorization',true,'tenantIsolation',true,'projectIsolation',true,'audit',true),
      'performance',jsonb_build_object('paginationRequired',true,'searchIndexRequired',true,'targetP95Ms',500),
      'recovery',jsonb_build_object('retry','idempotent-only','resumeFromLastVerifiedState',true)
    ) AS nonfunctional_contract,
    coalesce(pg.weak_page_count,0) AS weak_page_count,
    coalesce(t.safety_family_count,0) AS safety_family_count,
    CASE WHEN s.requires_user_page THEN 1 ELSE 0 END + CASE WHEN s.requires_admin_page THEN 1 ELSE 0 END AS required_page_count,
    jsonb_array_length(coalesce(pg.screens,'[]'::jsonb)) AS designed_page_count
  FROM framework_process_definition p
  JOIN framework_process_step s USING(process_code)
  LEFT JOIN page_specs pg USING(process_code,step_code)
  LEFT JOIN test_specs t USING(process_code)
  LEFT JOIN handoffs h USING(process_code,step_code)
), finalized AS (
  SELECT c.*,
    array_remove(ARRAY[
      CASE WHEN actor_contract->>'actorCode' IS NULL THEN 'ACTOR_MISSING' END,
      CASE WHEN business_contract->>'requirement' IS NULL OR business_contract->>'completionRule' IS NULL THEN 'BUSINESS_RULE_MISSING' END,
      CASE WHEN input_contract='{}'::jsonb OR output_contract='{}'::jsonb THEN 'DATA_CONTRACT_MISSING' END,
      CASE WHEN designed_page_count<required_page_count THEN 'PAGE_DESIGN_MISSING' END,
      CASE WHEN weak_page_count>0 THEN 'FIELD_CONTRACT_INCOMPLETE' END,
      CASE WHEN safety_family_count<5 THEN 'TEST_FAMILY_MISSING' END
    ],NULL) AS blockers
  FROM compiled c
)
INSERT INTO framework_step_execution_spec(
  process_code,step_code,spec_version,actor_contract,business_contract,transition_contract,
  input_contract,output_contract,screen_contract,field_contract,command_contract,api_contract,
  persistence_contract,handoff_contract,test_contract,guide_contract,nonfunctional_contract,
  design_status,approval_status,generation_status,blocker_codes,source_hash,approved_by,approved_at
)
SELECT process_code,step_code,1,actor_contract,business_contract,transition_contract,
  input_contract,output_contract,screen_contract,field_contract,command_contract,api_contract,
  persistence_contract,handoff_contract,test_contract,guide_contract,nonfunctional_contract,
  CASE WHEN cardinality(blockers)=0 THEN 'DESIGN_COMPLETE' ELSE 'DESIGN_BLOCKED' END,
  CASE WHEN definition_locked AND cardinality(blockers)=0 THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
  CASE WHEN definition_locked AND cardinality(blockers)=0 THEN 'READY' ELSE 'BLOCKED' END,
  to_jsonb(blockers),md5(
    actor_contract::text||business_contract::text||transition_contract::text||input_contract::text||
    output_contract::text||screen_contract::text||field_contract::text||command_contract::text||
    api_contract::text||persistence_contract::text||handoff_contract::text||test_contract::text||
    guide_contract::text||nonfunctional_contract::text),
  CASE WHEN definition_locked AND cardinality(blockers)=0 THEN 'LOCKED_IMPLEMENTATION_IMPORT' END,
  CASE WHEN definition_locked AND cardinality(blockers)=0 THEN current_timestamp END
FROM finalized
ON CONFLICT(process_code,step_code) DO UPDATE SET
  spec_version=CASE WHEN framework_step_execution_spec.source_hash<>excluded.source_hash THEN framework_step_execution_spec.spec_version+1 ELSE framework_step_execution_spec.spec_version END,
  actor_contract=excluded.actor_contract,business_contract=excluded.business_contract,
  transition_contract=excluded.transition_contract,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,screen_contract=excluded.screen_contract,
  field_contract=excluded.field_contract,command_contract=excluded.command_contract,
  api_contract=excluded.api_contract,persistence_contract=excluded.persistence_contract,
  handoff_contract=excluded.handoff_contract,test_contract=excluded.test_contract,
  guide_contract=excluded.guide_contract,nonfunctional_contract=excluded.nonfunctional_contract,
  design_status=excluded.design_status,
  approval_status=CASE WHEN framework_step_execution_spec.source_hash=excluded.source_hash THEN framework_step_execution_spec.approval_status ELSE excluded.approval_status END,
  generation_status=CASE WHEN framework_step_execution_spec.source_hash=excluded.source_hash AND framework_step_execution_spec.approval_status='APPROVED' AND excluded.design_status='DESIGN_COMPLETE' THEN 'READY' ELSE excluded.generation_status END,
  blocker_codes=excluded.blocker_codes,source_hash=excluded.source_hash,updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_step_generation_readiness AS
SELECT e.process_code,p.process_name,p.domain_code,p.domain_code AS work_type_code,e.step_code,s.step_name,s.step_order,s.actor_code,
  e.spec_version,e.design_status,e.approval_status,e.generation_status,e.blocker_codes,e.source_hash,
  jsonb_array_length(e.screen_contract) AS page_count,
  (SELECT coalesce(sum(jsonb_array_length(a->'fields')),0)::integer FROM jsonb_array_elements(e.field_contract) a) AS field_count,
  jsonb_array_length(e.test_contract) AS test_count,
  count(*) FILTER(WHERE d.route_status='IMPLEMENTED')::integer AS implemented_page_count,
  count(*) FILTER(WHERE d.route_status='DESIGN_ONLY')::integer AS planned_page_count
FROM framework_step_execution_spec e
JOIN framework_process_definition p USING(process_code)
JOIN framework_process_step s USING(process_code,step_code)
LEFT JOIN framework_page_design d USING(process_code,step_code)
GROUP BY e.process_code,p.process_name,p.domain_code,e.step_code,s.step_name,s.step_order,s.actor_code,
  e.spec_version,e.design_status,e.approval_status,e.generation_status,e.blocker_codes,e.source_hash,e.screen_contract,e.field_contract,e.test_contract;

CREATE OR REPLACE VIEW framework_full_stack_generation_summary AS
SELECT count(*)::integer AS step_count,
  count(*) FILTER(WHERE design_status='DESIGN_COMPLETE')::integer AS design_complete_count,
  count(*) FILTER(WHERE design_status='DESIGN_BLOCKED')::integer AS design_blocked_count,
  count(*) FILTER(WHERE approval_status='APPROVED')::integer AS approved_count,
  count(*) FILTER(WHERE generation_status IN ('READY','GENERATED'))::integer AS generation_ready_count,
  coalesce(sum(page_count),0)::integer AS page_count,
  coalesce(sum(field_count),0)::integer AS field_count,
  coalesce(sum(implemented_page_count),0)::integer AS implemented_page_count,
  coalesce(sum(planned_page_count),0)::integer AS planned_page_count
FROM framework_step_generation_readiness;

CREATE OR REPLACE FUNCTION framework_process_generation_snapshot(requested_process varchar DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'schemaVersion','2.0.0','generatedAt',current_timestamp,
    'summary',(SELECT to_jsonb(x) FROM framework_full_stack_generation_summary x),
    'processes',coalesce(jsonb_agg(process_json ORDER BY process_code),'[]'::jsonb)
  )
  FROM (
    SELECT p.process_code,jsonb_build_object(
      'processCode',p.process_code,'processName',p.process_name,'domainCode',p.domain_code,
      'workTypeCode',p.domain_code,'ownerActorCode',p.owner_actor_code,'goal',p.goal,
      'startCondition',p.start_condition,'completionCondition',p.completion_condition,
      'definitionLocked',p.definition_locked,
      'steps',jsonb_agg(to_jsonb(e)-'created_at'-'updated_at' ORDER BY s.step_order)
    ) AS process_json
    FROM framework_process_definition p
    JOIN framework_process_step s USING(process_code)
    JOIN framework_step_execution_spec e USING(process_code,step_code)
    WHERE requested_process IS NULL OR p.process_code=requested_process
    GROUP BY p.process_code
  ) q;
$$;

DO $$
DECLARE total_steps integer; compiled_steps integer; orphan_specs integer;
BEGIN
  SELECT count(*) INTO total_steps FROM framework_process_step;
  SELECT count(*) INTO compiled_steps FROM framework_step_execution_spec;
  SELECT count(*) INTO orphan_specs FROM framework_step_execution_spec e
    LEFT JOIN framework_process_step s USING(process_code,step_code) WHERE s.step_code IS NULL;
  IF total_steps<>compiled_steps OR orphan_specs<>0 THEN
    RAISE EXCEPTION 'STEP_EXECUTION_SPEC_COVERAGE_FAILED total=% compiled=% orphan=%',total_steps,compiled_steps,orphan_specs;
  END IF;
END $$;
