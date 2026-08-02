-- New requirement processes are imported after the historical one-shot compiler
-- migration has run. Materialize their executable contracts on demand so the
-- deterministic generator never needs AI merely because a spec row is absent.
CREATE OR REPLACE FUNCTION framework_compile_process_execution_specs(requested_process varchar)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE compiled_count integer;
DECLARE step_row record;
BEGIN
  FOR step_row IN
    SELECT step_code FROM framework_process_step WHERE process_code=requested_process ORDER BY step_order
  LOOP
    PERFORM framework_refresh_step_schema_set(requested_process,step_row.step_code,
      'INITIAL_PROCESS_SPEC_COMPILE',false);
  END LOOP;

  WITH tests AS (
    SELECT process_code,
      coalesce(jsonb_agg(jsonb_build_object(
        'caseCode',case_code,'name',case_name,'type',case_type,
        'preconditions',preconditions,'steps',framework_try_jsonb(steps_json),
        'assertions',framework_try_jsonb(assertions_json),'status',case_status)
        ORDER BY case_type,case_code),'[]'::jsonb) test_contract,
      count(DISTINCT CASE
        WHEN case_type IN ('EXCEPTION','VALIDATION') THEN 'EXCEPTION'
        WHEN case_type IN ('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY') THEN case_type END) safety_family_count
    FROM framework_simulation_case WHERE process_code=requested_process GROUP BY process_code
  ), screens AS (
    SELECT process_code,step_code,
      jsonb_agg(jsonb_build_object(
        'audience',audience,'pageCode',page_code,'title',page_title,'purpose',page_purpose,
        'screenType',screen_type,'plannedRoute',planned_route_path,'actualRoute',actual_route_path,
        'routeStatus',route_status,'primaryEntity',primary_entity,'responsive',responsive_contract,
        'accessibility',accessibility_contract,'security',security_contract,'exceptions',exception_contract)
        ORDER BY audience) screen_contract
    FROM framework_page_design WHERE process_code=requested_process GROUP BY process_code,step_code
  ), compiled AS (
    SELECT p.process_code,s.step_code,
      jsonb_build_object('actorCode',s.actor_code,'ownerActorCode',p.owner_actor_code,
        'tenantIsolation',true,'projectIsolation',true,'delegationChecked',true,'segregationOfDuties',true) actor_contract,
      jsonb_build_object('domainCode',p.domain_code,'processName',p.process_name,'stepName',s.step_name,
        'goal',p.goal,'requirement',s.requirement_text,'completionRule',s.completion_rule,
        'riskLevel',p.risk_level,'slaHours',p.sla_hours,'regulationRefs',p.regulation_refs) business_contract,
      jsonb_build_object('commandCode',s.command_code,'fromState',s.from_state,'toState',s.to_state,
        'stepOrder',s.step_order,'parentStepCode',s.parent_step_code,'stepType',s.step_type,
        'completionRule',s.completion_rule,'optimisticLock',true,'idempotencyRequired',true,'auditRequired',true) transition_contract,
      ss.input_schema input_contract,ss.output_schema output_contract,
      coalesce(sc.screen_contract,'[]'::jsonb) screen_contract,
      coalesce((SELECT jsonb_agg(jsonb_build_object('audience',audience,'fields',fields) ORDER BY audience)
        FROM (SELECT d.audience,jsonb_agg(f ORDER BY (f->>'fieldOrder')::integer) fields
          FROM framework_page_design d CROSS JOIN LATERAL jsonb_array_elements(ss.field_schema) f
          WHERE d.process_code=s.process_code AND d.step_code=s.step_code AND f->>'audience'=d.audience
          GROUP BY d.audience) grouped_fields),'[]'::jsonb) field_contract,
      jsonb_build_array(jsonb_build_object('commandCode',s.command_code,'actorCode',s.actor_code,
        'entryState',s.from_state,'resultState',s.to_state,'serverAuthorization',true,
        'validationRequired',true,'auditRequired',true)) command_contract,
      CASE WHEN s.requires_api THEN jsonb_build_array(jsonb_build_object('declaredContract',s.api_contract,
        'transactional',true,'tenantGuard',true,'projectGuard',true,'actorGuard',true,
        'idempotencyKey',true,'rowVersion',true,'errorContract',jsonb_build_array(
          'VALIDATION_ERROR','FORBIDDEN','CONFLICT','DEPENDENCY_BLOCKED','SERVER_ERROR'))) ELSE '[]'::jsonb END api_contract,
      ss.persistence_schema persistence_contract,
      CASE WHEN ss.handoff_schema='[]'::jsonb THEN jsonb_build_array(jsonb_build_object(
        'handoffType','TERMINAL','toState',s.to_state,'contextKeys',jsonb_build_array(
          'tenantId','projectId','processCode','stepCode','actorCode','rowVersion')))
        ELSE ss.handoff_schema END handoff_contract,
      coalesce(t.test_contract,'[]'::jsonb) test_contract,
      jsonb_build_object('workTypeCode',p.domain_code,'processCode',p.process_code,'stepCode',s.step_code,
        'stepOrder',s.step_order,'actorCode',s.actor_code,'title',s.step_name,'purpose',s.requirement_text,
        'entryCondition',s.from_state,'completionCondition',s.completion_rule,'userPath',s.user_path,
        'adminPath',s.admin_path,'nextStepCode',(SELECT n.step_code FROM framework_process_step n
          WHERE n.process_code=s.process_code AND n.step_order>s.step_order ORDER BY n.step_order LIMIT 1)) guide_contract,
      jsonb_build_object('responsive',jsonb_build_object('mobile','single-column','tablet','adaptive-two-column',
        'desktop','task-optimized','noTextOverflow',true),'accessibility',jsonb_build_object(
        'standard','WCAG 2.1 AA','keyboard',true,'focus',true,'errorSummary',true),'security',jsonb_build_object(
        'serverAuthorization',true,'tenantIsolation',true,'projectIsolation',true,'audit',true),
        'performance',jsonb_build_object('paginationRequired',true,'searchIndexRequired',true,'targetP95Ms',500),
        'recovery',jsonb_build_object('retry','idempotent-only','resumeFromLastVerifiedState',true)) nonfunctional_contract,
      array_remove(ARRAY[
        CASE WHEN ss.completeness_status<>'COMPLETE' THEN 'STEP_SCHEMA_INCOMPLETE' END,
        CASE WHEN coalesce(jsonb_array_length(sc.screen_contract),0)=0 AND
          (s.requires_user_page OR s.requires_admin_page) THEN 'PAGE_DESIGN_MISSING' END,
        CASE WHEN coalesce(t.safety_family_count,0)<5 THEN 'TEST_FAMILY_MISSING' END],NULL) blockers
    FROM framework_process_definition p JOIN framework_process_step s USING(process_code)
    JOIN framework_step_schema_set ss USING(process_code,step_code)
    LEFT JOIN screens sc USING(process_code,step_code) LEFT JOIN tests t USING(process_code)
    WHERE p.process_code=requested_process
  )
  INSERT INTO framework_step_execution_spec(process_code,step_code,spec_version,actor_contract,business_contract,
    transition_contract,input_contract,output_contract,screen_contract,field_contract,command_contract,api_contract,
    persistence_contract,handoff_contract,test_contract,guide_contract,nonfunctional_contract,design_status,
    approval_status,generation_status,blocker_codes,source_hash)
  SELECT process_code,step_code,1,actor_contract,business_contract,transition_contract,input_contract,output_contract,
    screen_contract,field_contract,command_contract,api_contract,persistence_contract,handoff_contract,test_contract,
    guide_contract,nonfunctional_contract,CASE WHEN cardinality(blockers)=0 THEN 'DESIGN_COMPLETE' ELSE 'DESIGN_BLOCKED' END,
    'REVIEW_REQUIRED','BLOCKED',to_jsonb(blockers),md5(actor_contract::text||business_contract::text||
      transition_contract::text||input_contract::text||output_contract::text||screen_contract::text||
      field_contract::text||command_contract::text||api_contract::text||persistence_contract::text||
      handoff_contract::text||test_contract::text||guide_contract::text||nonfunctional_contract::text)
  FROM compiled ON CONFLICT(process_code,step_code) DO NOTHING;

  GET DIAGNOSTICS compiled_count = ROW_COUNT;
  RETURN compiled_count;
END $$;

COMMENT ON FUNCTION framework_compile_process_execution_specs(varchar) IS
  'Compiles missing executable step specs for processes imported after the one-shot baseline migration.';
