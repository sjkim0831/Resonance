-- Recompile mutable actor/process/step definitions into the existing fourteen
-- executable contracts.  Professional screen contracts remain authoritative
-- for their four structured projection fields and are refreshed by the exact
-- route/audience save path in the same transaction.

CREATE OR REPLACE FUNCTION public.framework_refresh_process_execution_specs(
  requested_process text,
  requested_actor text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  step_row record;
  refreshed_count integer;
  defined_count integer;
  blocked_count integer;
  ready_count integer;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$' THEN
    RAISE EXCEPTION 'invalid process refresh identity'
      USING ERRCODE='22023';
  END IF;
  IF requested_actor IS NULL OR btrim(requested_actor)=''
     OR length(requested_actor)>100 OR requested_actor<>btrim(requested_actor) THEN
    RAISE EXCEPTION 'authenticated refresh actor is required'
      USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.framework_process_definition process
     WHERE process.process_code=requested_process
  ) THEN
    RAISE EXCEPTION 'process refresh identity not found: %',requested_process
      USING ERRCODE='P0002';
  END IF;
  IF EXISTS(
    SELECT 1
      FROM public.framework_process_definition process
      LEFT JOIN public.framework_actor_definition owner
        ON owner.actor_code=process.owner_actor_code
     WHERE process.process_code=requested_process
       AND (process.owner_actor_code IS NULL OR owner.actor_code IS NULL
         OR owner.use_at<>'Y')
  ) OR EXISTS(
    SELECT 1
      FROM public.framework_process_step step
      LEFT JOIN public.framework_actor_definition primary_actor
        ON primary_actor.actor_code=step.actor_code
      LEFT JOIN public.framework_actor_definition escalation_actor
        ON escalation_actor.actor_code=step.escalation_actor_code
     WHERE step.process_code=requested_process
       AND (primary_actor.actor_code IS NULL OR primary_actor.use_at<>'Y'
         OR (step.escalation_actor_code IS NOT NULL
           AND (escalation_actor.actor_code IS NULL OR escalation_actor.use_at<>'Y')))
  ) OR EXISTS(
    SELECT 1
      FROM public.framework_process_step step
      CROSS JOIN LATERAL unnest(regexp_split_to_array(
        coalesce(nullif(btrim(step.segregation_actor_codes),''),'__NONE__'),
        '[[:space:]]*,[[:space:]]*')) segregation(actor_code)
     WHERE step.process_code=requested_process
       AND segregation.actor_code<>'__NONE__'
       AND NOT EXISTS(
         SELECT 1 FROM public.framework_actor_definition actor
          WHERE actor.actor_code=segregation.actor_code AND actor.use_at='Y')
  ) THEN
    RAISE EXCEPTION 'process actor reference is not exact: %',requested_process
      USING ERRCODE='23503';
  END IF;

  FOR step_row IN
    SELECT step.step_code
      FROM public.framework_process_step step
     WHERE step.process_code=requested_process
     ORDER BY step.step_order,step.step_code COLLATE "C"
  LOOP
    PERFORM public.framework_refresh_step_schema_set(
      requested_process,step_row.step_code,'DIRECT_DESIGN_MUTATION',false);
  END LOOP;

  WITH tests AS MATERIALIZED (
    SELECT simulation.process_code,
           coalesce(jsonb_agg(jsonb_build_object(
             'caseCode',simulation.case_code,'name',simulation.case_name,
             'type',simulation.case_type,'preconditions',simulation.preconditions,
             'steps',public.framework_try_jsonb(simulation.steps_json),
             'assertions',public.framework_try_jsonb(simulation.assertions_json),
             'status',simulation.case_status)
             ORDER BY simulation.case_type,simulation.case_code),'[]'::jsonb) value,
           count(DISTINCT CASE
             WHEN simulation.case_type IN('EXCEPTION','VALIDATION') THEN 'EXCEPTION'
             WHEN simulation.case_type IN('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY')
               THEN simulation.case_type END)::integer safety_family_count
      FROM public.framework_simulation_case simulation
     WHERE simulation.process_code=requested_process
     GROUP BY simulation.process_code
  ), pages AS MATERIALIZED (
    SELECT page.process_code,page.step_code,
           jsonb_agg(jsonb_build_object(
             'audience',page.audience,'pageCode',page.page_code,
             'title',page.page_title,'purpose',page.page_purpose,
             'screenType',page.screen_type,'plannedRoute',page.planned_route_path,
             'actualRoute',page.actual_route_path,'routeStatus',page.route_status,
             'primaryEntity',page.primary_entity,'responsive',page.responsive_contract,
             'accessibility',page.accessibility_contract,'security',page.security_contract,
             'exceptions',page.exception_contract)
             ORDER BY page.audience,page.page_code) screen_contract
      FROM public.framework_page_design page
     WHERE page.process_code=requested_process
     GROUP BY page.process_code,page.step_code
  ), professional_steps AS MATERIALIZED (
    SELECT DISTINCT contract.process_code,contract.step_code
      FROM public.framework_professional_screen_contract contract
     WHERE contract.process_code=requested_process
  ), compiled AS MATERIALIZED (
    SELECT process.process_code,step.step_code,process.definition_locked,
      jsonb_build_object(
        'actorCode',step.actor_code,'actorName',actor.actor_name,
        'actorType',actor.actor_type,'purpose',actor.purpose,
        'capabilityCodes',coalesce(to_jsonb(regexp_split_to_array(
          nullif(btrim(actor.capability_codes),''),'[[:space:]]*,[[:space:]]*')),'[]'::jsonb),
        'delegationAllowed',actor.delegation_allowed,'useAt',actor.use_at,
        'responsibility',actor.responsibility_text,
        'accountability',actor.accountability_text,
        'competency',actor.competency_requirements,
        'conflictActorCodes',coalesce(to_jsonb(regexp_split_to_array(
          nullif(btrim(actor.conflict_actor_codes),''),'[[:space:]]*,[[:space:]]*')),'[]'::jsonb),
        'maxConcurrentAssignments',actor.max_concurrent_assignments,
        'reviewCycleDays',actor.review_cycle_days,
        'ownerActorCode',process.owner_actor_code,
        'escalationActorCode',step.escalation_actor_code,
        'segregationActorCodes',coalesce(to_jsonb(regexp_split_to_array(
          nullif(btrim(step.segregation_actor_codes),''),'[[:space:]]*,[[:space:]]*')),'[]'::jsonb),
        'tenantIsolation',true,'projectIsolation',true,'delegationChecked',true,
        'segregationOfDuties',true,
        'relatedActors',(
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'actorCode',related.actor_code,'actorName',related.actor_name,
            'actorNameEn',related.actor_name_en,'actorType',related.actor_type,
            'purpose',related.purpose,
            'capabilityCodes',coalesce(to_jsonb(regexp_split_to_array(
              nullif(btrim(related.capability_codes),''),'[[:space:]]*,[[:space:]]*')),'[]'::jsonb),
            'delegationAllowed',related.delegation_allowed,'useAt',related.use_at,
            'responsibility',related.responsibility_text,
            'accountability',related.accountability_text,
            'competency',related.competency_requirements,
            'conflictActorCodes',coalesce(to_jsonb(regexp_split_to_array(
              nullif(btrim(related.conflict_actor_codes),''),'[[:space:]]*,[[:space:]]*')),'[]'::jsonb),
            'maxConcurrentAssignments',related.max_concurrent_assignments,
            'reviewCycleDays',related.review_cycle_days)
            ORDER BY related.actor_code COLLATE "C"),'[]'::jsonb)
            FROM public.framework_actor_definition related
           WHERE related.actor_code=step.actor_code
              OR related.actor_code=process.owner_actor_code
              OR related.actor_code=step.escalation_actor_code
              OR related.actor_code=ANY(regexp_split_to_array(
                coalesce(nullif(btrim(step.segregation_actor_codes),''),'__NONE__'),
                '[[:space:]]*,[[:space:]]*'))),
        'permissions',public.framework_step_permission_requirements(
          process.process_code,step.step_code)) actor_contract,
      jsonb_build_object(
        'domainCode',process.domain_code,'processName',process.process_name,
        'stepName',step.step_name,'goal',process.goal,
        'requirement',step.requirement_text,'completionRule',step.completion_rule,
        'riskLevel',process.risk_level,'slaHours',process.sla_hours,
        'regulationRefs',process.regulation_refs) business_contract,
      jsonb_build_object(
        'commandCode',step.command_code,'fromState',step.from_state,
        'toState',step.to_state,'stepOrder',step.step_order,
        'parentStepCode',step.parent_step_code,'stepType',step.step_type,
        'completionRule',step.completion_rule,'optimisticLock',true,
        'idempotencyRequired',true,'auditRequired',true) transition_contract,
      schema_set.input_schema input_contract,
      schema_set.output_schema output_contract,
      CASE WHEN professional.process_code IS NOT NULL AND existing.process_code IS NOT NULL
        THEN existing.screen_contract ELSE coalesce(page.screen_contract,'[]'::jsonb) END screen_contract,
      CASE WHEN professional.process_code IS NOT NULL AND existing.process_code IS NOT NULL
        THEN existing.field_contract ELSE coalesce((
          SELECT jsonb_agg(jsonb_build_object('audience',grouped.audience,
                   'fields',grouped.fields) ORDER BY grouped.audience)
            FROM (
              SELECT design.audience,
                     jsonb_agg(field.value ORDER BY field.ordinality) fields
                FROM public.framework_page_design design
                CROSS JOIN LATERAL jsonb_array_elements(schema_set.field_schema)
                  WITH ORDINALITY field(value,ordinality)
               WHERE design.process_code=step.process_code
                 AND design.step_code=step.step_code
                 AND field.value->>'audience'=design.audience
               GROUP BY design.audience
            ) grouped),'[]'::jsonb) END field_contract,
      CASE WHEN professional.process_code IS NOT NULL AND existing.process_code IS NOT NULL
        THEN existing.command_contract ELSE jsonb_build_array(jsonb_build_object(
          'commandCode',step.command_code,'actorCode',step.actor_code,
          'entryState',step.from_state,'resultState',step.to_state,
          'serverAuthorization',true,'validationRequired',true,
          'auditRequired',true)) END command_contract,
      CASE WHEN professional.process_code IS NOT NULL AND existing.process_code IS NOT NULL
        THEN existing.api_contract WHEN step.requires_api THEN jsonb_build_array(jsonb_build_object(
          'declaredContract',step.api_contract,'transactional',true,
          'tenantGuard',true,'projectGuard',true,'actorGuard',true,
          'idempotencyKey',true,'rowVersion',true,'errorContract',jsonb_build_array(
            'VALIDATION_ERROR','FORBIDDEN','CONFLICT','DEPENDENCY_BLOCKED','SERVER_ERROR')))
        ELSE '[]'::jsonb END api_contract,
      schema_set.persistence_schema persistence_contract,
      CASE WHEN schema_set.handoff_schema='[]'::jsonb THEN jsonb_build_array(
        jsonb_build_object('handoffType','TERMINAL','toState',step.to_state,
          'contextKeys',jsonb_build_array('tenantId','projectId','processCode',
            'stepCode','actorCode','rowVersion')))
        ELSE schema_set.handoff_schema END handoff_contract,
      coalesce(test.value,'[]'::jsonb) test_contract,
      jsonb_build_object(
        'workTypeCode',process.domain_code,'processCode',process.process_code,
        'stepCode',step.step_code,'stepOrder',step.step_order,
        'actorCode',step.actor_code,'title',step.step_name,
        'purpose',step.requirement_text,'entryCondition',step.from_state,
        'completionCondition',step.completion_rule,'userPath',step.user_path,
        'adminPath',step.admin_path,'nextStepCode',(
          SELECT next_step.step_code FROM public.framework_process_step next_step
           WHERE next_step.process_code=step.process_code
             AND next_step.step_order>step.step_order
           ORDER BY next_step.step_order,next_step.step_code COLLATE "C" LIMIT 1)) guide_contract,
      jsonb_build_object(
        'responsive',jsonb_build_object('mobile','single-column','tablet','adaptive-two-column',
          'desktop','task-optimized','noTextOverflow',true),
        'accessibility',jsonb_build_object('standard','WCAG 2.1 AA','keyboard',true,
          'focus',true,'errorSummary',true),
        'security',jsonb_build_object('serverAuthorization',true,'tenantIsolation',true,
          'projectIsolation',true,'audit',true),
        'performance',jsonb_build_object('paginationRequired',true,
          'searchIndexRequired',true,'targetP95Ms',500),
        'recovery',jsonb_build_object('retry','idempotent-only',
          'resumeFromLastVerifiedState',true)) nonfunctional_contract,
      array_remove(ARRAY[
        CASE WHEN schema_set.completeness_status<>'COMPLETE' THEN 'STEP_SCHEMA_INCOMPLETE' END,
        CASE WHEN professional.process_code IS NULL
          AND coalesce(jsonb_array_length(page.screen_contract),0)=0
          AND (step.requires_user_page OR step.requires_admin_page)
          THEN 'PAGE_DESIGN_MISSING' END,
        CASE WHEN coalesce(test.safety_family_count,0)<5
          THEN 'TEST_FAMILY_MISSING' END],NULL) blockers
    FROM public.framework_process_definition process
    JOIN public.framework_process_step step USING(process_code)
    JOIN public.framework_actor_definition actor ON actor.actor_code=step.actor_code
    JOIN public.framework_step_schema_set schema_set USING(process_code,step_code)
    LEFT JOIN public.framework_step_execution_spec existing USING(process_code,step_code)
    LEFT JOIN pages page USING(process_code,step_code)
    LEFT JOIN tests test USING(process_code)
    LEFT JOIN professional_steps professional USING(process_code,step_code)
    WHERE process.process_code=requested_process
  ), versioned AS MATERIALIZED (
    SELECT compiled.*,
      encode(sha256(convert_to(
        actor_contract::text||business_contract::text||transition_contract::text||
        input_contract::text||output_contract::text||screen_contract::text||
        field_contract::text||command_contract::text||api_contract::text||
        persistence_contract::text||handoff_contract::text||test_contract::text||
        guide_contract::text||nonfunctional_contract::text,'UTF8')),'hex') compiled_hash
    FROM compiled
  ), upserted AS (
    INSERT INTO public.framework_step_execution_spec(
      process_code,step_code,spec_version,actor_contract,business_contract,
      transition_contract,input_contract,output_contract,screen_contract,
      field_contract,command_contract,api_contract,persistence_contract,
      handoff_contract,test_contract,guide_contract,nonfunctional_contract,
      design_status,approval_status,generation_status,blocker_codes,source_hash,
      approved_by,approved_at)
    SELECT process_code,step_code,1,actor_contract,business_contract,
      transition_contract,input_contract,output_contract,screen_contract,
      field_contract,command_contract,api_contract,persistence_contract,
      handoff_contract,test_contract,guide_contract,nonfunctional_contract,
      CASE WHEN cardinality(blockers)=0 THEN 'DESIGN_COMPLETE' ELSE 'DESIGN_BLOCKED' END,
      CASE WHEN definition_locked AND cardinality(blockers)=0 THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
      CASE WHEN definition_locked AND cardinality(blockers)=0 THEN 'READY' ELSE 'BLOCKED' END,
      to_jsonb(blockers),compiled_hash,
      CASE WHEN definition_locked AND cardinality(blockers)=0 THEN requested_actor END,
      CASE WHEN definition_locked AND cardinality(blockers)=0 THEN current_timestamp END
    FROM versioned
    ON CONFLICT(process_code,step_code) DO UPDATE SET
      spec_version=CASE WHEN
        public.framework_step_execution_spec.actor_contract IS DISTINCT FROM excluded.actor_contract OR
        public.framework_step_execution_spec.business_contract IS DISTINCT FROM excluded.business_contract OR
        public.framework_step_execution_spec.transition_contract IS DISTINCT FROM excluded.transition_contract OR
        public.framework_step_execution_spec.input_contract IS DISTINCT FROM excluded.input_contract OR
        public.framework_step_execution_spec.output_contract IS DISTINCT FROM excluded.output_contract OR
        public.framework_step_execution_spec.screen_contract IS DISTINCT FROM excluded.screen_contract OR
        public.framework_step_execution_spec.field_contract IS DISTINCT FROM excluded.field_contract OR
        public.framework_step_execution_spec.command_contract IS DISTINCT FROM excluded.command_contract OR
        public.framework_step_execution_spec.api_contract IS DISTINCT FROM excluded.api_contract OR
        public.framework_step_execution_spec.persistence_contract IS DISTINCT FROM excluded.persistence_contract OR
        public.framework_step_execution_spec.handoff_contract IS DISTINCT FROM excluded.handoff_contract OR
        public.framework_step_execution_spec.test_contract IS DISTINCT FROM excluded.test_contract OR
        public.framework_step_execution_spec.guide_contract IS DISTINCT FROM excluded.guide_contract OR
        public.framework_step_execution_spec.nonfunctional_contract IS DISTINCT FROM excluded.nonfunctional_contract
        THEN public.framework_step_execution_spec.spec_version+1
        ELSE public.framework_step_execution_spec.spec_version END,
      actor_contract=excluded.actor_contract,
      business_contract=excluded.business_contract,
      transition_contract=excluded.transition_contract,
      input_contract=excluded.input_contract,output_contract=excluded.output_contract,
      screen_contract=excluded.screen_contract,field_contract=excluded.field_contract,
      command_contract=excluded.command_contract,api_contract=excluded.api_contract,
      persistence_contract=excluded.persistence_contract,
      handoff_contract=excluded.handoff_contract,test_contract=excluded.test_contract,
      guide_contract=excluded.guide_contract,
      nonfunctional_contract=excluded.nonfunctional_contract,
      design_status=excluded.design_status,
      approval_status=CASE
        WHEN excluded.design_status='DESIGN_COMPLETE'
          AND public.framework_step_execution_spec.approval_status='APPROVED'
          THEN 'APPROVED' ELSE excluded.approval_status END,
      generation_status=CASE
        WHEN excluded.design_status='DESIGN_COMPLETE'
          AND public.framework_step_execution_spec.approval_status='APPROVED'
          THEN CASE WHEN public.framework_step_execution_spec.generation_status='GENERATED'
            AND public.framework_step_execution_spec.actor_contract IS NOT DISTINCT FROM excluded.actor_contract
            AND public.framework_step_execution_spec.business_contract IS NOT DISTINCT FROM excluded.business_contract
            AND public.framework_step_execution_spec.transition_contract IS NOT DISTINCT FROM excluded.transition_contract
            AND public.framework_step_execution_spec.input_contract IS NOT DISTINCT FROM excluded.input_contract
            AND public.framework_step_execution_spec.output_contract IS NOT DISTINCT FROM excluded.output_contract
            AND public.framework_step_execution_spec.screen_contract IS NOT DISTINCT FROM excluded.screen_contract
            AND public.framework_step_execution_spec.field_contract IS NOT DISTINCT FROM excluded.field_contract
            AND public.framework_step_execution_spec.command_contract IS NOT DISTINCT FROM excluded.command_contract
            AND public.framework_step_execution_spec.api_contract IS NOT DISTINCT FROM excluded.api_contract
            AND public.framework_step_execution_spec.persistence_contract IS NOT DISTINCT FROM excluded.persistence_contract
            AND public.framework_step_execution_spec.handoff_contract IS NOT DISTINCT FROM excluded.handoff_contract
            AND public.framework_step_execution_spec.test_contract IS NOT DISTINCT FROM excluded.test_contract
            AND public.framework_step_execution_spec.guide_contract IS NOT DISTINCT FROM excluded.guide_contract
            AND public.framework_step_execution_spec.nonfunctional_contract IS NOT DISTINCT FROM excluded.nonfunctional_contract
            THEN 'GENERATED' ELSE 'READY' END
        ELSE excluded.generation_status END,
      blocker_codes=excluded.blocker_codes,source_hash=excluded.source_hash,
      approved_by=CASE
        WHEN excluded.design_status='DESIGN_COMPLETE'
          AND public.framework_step_execution_spec.approval_status='APPROVED'
          THEN public.framework_step_execution_spec.approved_by ELSE excluded.approved_by END,
      approved_at=CASE
        WHEN excluded.design_status='DESIGN_COMPLETE'
          AND public.framework_step_execution_spec.approval_status='APPROVED'
          THEN public.framework_step_execution_spec.approved_at ELSE excluded.approved_at END,
      updated_at=current_timestamp
    RETURNING 1
  )
  SELECT count(*)::integer INTO refreshed_count FROM upserted;

  SELECT count(*)::integer INTO defined_count
    FROM public.framework_process_step step
   WHERE step.process_code=requested_process;
  SELECT count(*) FILTER(WHERE spec.design_status='DESIGN_BLOCKED')::integer,
         count(*) FILTER(WHERE spec.design_status='DESIGN_COMPLETE'
           AND spec.approval_status='APPROVED'
           AND spec.generation_status IN('READY','GENERATED'))::integer
    INTO blocked_count,ready_count
    FROM public.framework_step_execution_spec spec
   WHERE spec.process_code=requested_process;

  RETURN jsonb_build_object(
    'processCode',requested_process,'refreshedStepCount',refreshed_count,
    'definedStepCount',defined_count,'blockedStepCount',blocked_count,
    'generationReadyStepCount',ready_count,'refreshedBy',requested_actor);
END
$$;

COMMENT ON FUNCTION public.framework_refresh_process_execution_specs(text,text) IS
  'Refreshes all fourteen executable contracts for one process after an authenticated design mutation';

REVOKE ALL ON FUNCTION public.framework_refresh_process_execution_specs(text,text)
  FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    GRANT EXECUTE ON FUNCTION public.framework_refresh_process_execution_specs(text,text)
      TO carbonet_app;
  END IF;
END
$$;

DO $$
DECLARE refresh_api oid:=to_regprocedure(
  'public.framework_refresh_process_execution_specs(text,text)');
DECLARE refresh_namespace text;
BEGIN
  SELECT namespace.nspname INTO refresh_namespace
    FROM pg_proc function_row
    JOIN pg_namespace namespace ON namespace.oid=function_row.pronamespace
   WHERE function_row.oid=refresh_api;
  IF refresh_api IS NULL OR EXISTS(
    SELECT 1 FROM pg_proc function_row
    CROSS JOIN LATERAL aclexplode(
      coalesce(function_row.proacl,acldefault('f',function_row.proowner))) acl
     WHERE function_row.oid=refresh_api AND acl.grantee=0
       AND acl.privilege_type='EXECUTE'
  ) OR EXISTS(
    SELECT 1 FROM pg_proc WHERE oid=refresh_api
      AND (NOT prosecdef OR NOT EXISTS(
        SELECT 1 FROM unnest(coalesce(proconfig,'{}'::text[])) setting
         WHERE setting='search_path=pg_catalog, '||refresh_namespace))
  ) THEN
    RAISE EXCEPTION 'process spec refresh API ACL postcondition failed'
      USING ERRCODE='42501';
  END IF;
END
$$;
