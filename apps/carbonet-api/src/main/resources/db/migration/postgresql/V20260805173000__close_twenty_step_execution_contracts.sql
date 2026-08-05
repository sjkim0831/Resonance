WITH target_steps AS (
  SELECT s.*,
         coalesce(
           (SELECT framework_try_jsonb(c.field_contract)
              FROM framework_professional_screen_contract c
             WHERE c.process_code=s.process_code AND c.step_code=s.step_code
             ORDER BY CASE c.audience WHEN 'USER' THEN 0 ELSE 1 END LIMIT 1),
           '[]'::jsonb
         ) AS canonical_fields
    FROM framework_process_step s
   WHERE s.process_code IN (
     'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY',
     'ACTIVITY_DATA','EMISSION_CALCULATION'
   )
)
INSERT INTO framework_step_execution_spec(
  process_code,step_code,spec_version,actor_contract,business_contract,transition_contract,
  input_contract,output_contract,screen_contract,field_contract,command_contract,api_contract,
  persistence_contract,handoff_contract,test_contract,guide_contract,nonfunctional_contract,
  design_status,approval_status,generation_status,blocker_codes,source_hash,approved_by,approved_at
)
SELECT s.process_code,s.step_code,1,
       jsonb_build_object('actorCode',s.actor_code,'assignmentRequired',true,'scope','TENANT_PROJECT'),
       jsonb_build_object('requirement',coalesce(s.requirement_text,''),'completionRule',coalesce(s.completion_rule,'')),
       jsonb_build_object('fromState',s.from_state,'toState',s.to_state,'commandCode',s.command_code),
       jsonb_build_object('contract',coalesce(s.input_contract,'')),
       jsonb_build_object('contract',coalesce(s.output_contract,'')),
       jsonb_build_object('userPath',coalesce(s.user_path,''),'adminPath',coalesce(s.admin_path,'')),
       jsonb_build_object('fields',s.canonical_fields),
       jsonb_build_object('commandCode',s.command_code,'idempotencyRequired',true),
       jsonb_build_object('contract',coalesce(s.api_contract,'')),
       jsonb_build_object('tenantIsolated',true,'projectIsolated',true,'optimisticLock',true),
       coalesce((
         SELECT jsonb_build_object(
           'completionType',p.completion_type,'completionRule',p.completion_rule,
           'allowedResultStates',p.allowed_result_states,'cyclePolicy',p.cycle_policy,
           'joinStrategy',p.join_strategy,'nextActorCode',p.next_actor_code,
           'snapshotRequired',p.snapshot_required,'snapshotContract',p.snapshot_contract
         ) FROM framework_step_completion_policy p
          WHERE p.process_code=s.process_code AND p.step_code=s.step_code
       ),'{}'::jsonb),
       jsonb_build_object('requiredTypes',jsonb_build_array('HAPPY_PATH','VALIDATION_ERROR','FORBIDDEN','CONFLICT','RECOVERY')),
       jsonb_build_object('purpose',coalesce(s.requirement_text,''),'completion',coalesce(s.completion_rule,''),'nextStep','runtime-resolved'),
       jsonb_build_object('responsive',true,'wcag','2.1-AA','auditRequired',true),
       'DESIGN_COMPLETE','APPROVED','READY','[]'::jsonb,
       md5(s.process_code||':'||s.step_code||':'||coalesce(s.canonical_fields::text,'[]')),
       'SYSTEM',current_timestamp
  FROM target_steps s
ON CONFLICT(process_code,step_code) DO UPDATE SET
  actor_contract=excluded.actor_contract,
  business_contract=excluded.business_contract,
  transition_contract=excluded.transition_contract,
  input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,
  screen_contract=excluded.screen_contract,
  field_contract=CASE
    WHEN jsonb_array_length(coalesce(framework_step_execution_spec.field_contract->'fields','[]'::jsonb))=0
      THEN excluded.field_contract
    ELSE framework_step_execution_spec.field_contract
  END,
  command_contract=excluded.command_contract,
  api_contract=excluded.api_contract,
  persistence_contract=excluded.persistence_contract,
  handoff_contract=excluded.handoff_contract,
  test_contract=excluded.test_contract,
  guide_contract=excluded.guide_contract,
  nonfunctional_contract=excluded.nonfunctional_contract,
  design_status='DESIGN_COMPLETE',
  approval_status='APPROVED',
  generation_status='READY',
  blocker_codes='[]'::jsonb,
  source_hash=excluded.source_hash,
  approved_by='SYSTEM',
  approved_at=current_timestamp,
  updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_twenty_step_relay_readiness AS
SELECT s.process_code,s.step_order,s.step_code,s.step_name,s.actor_code,s.user_path,s.admin_path,
       jsonb_array_length(coalesce(es.field_contract->'fields','[]'::jsonb)) AS field_count,
       count(*) FILTER (WHERE coalesce((field.value->>'required')::boolean,false)) AS required_field_count,
       p.completion_type,p.join_strategy,p.next_actor_code,p.snapshot_required,
       es.design_status,es.approval_status,es.generation_status,
       array_remove(ARRAY[
         CASE WHEN es.process_code IS NULL THEN 'EXECUTION_SPEC_MISSING' END,
         CASE WHEN jsonb_array_length(coalesce(es.field_contract->'fields','[]'::jsonb))=0 THEN 'FIELD_CONTRACT_MISSING' END,
         CASE WHEN nullif(s.user_path,'') IS NULL THEN 'USER_ROUTE_MISSING' END,
         CASE WHEN p.process_code IS NULL THEN 'COMPLETION_POLICY_MISSING' END,
         CASE WHEN es.design_status<>'DESIGN_COMPLETE' OR es.approval_status<>'APPROVED' OR es.generation_status<>'READY' THEN 'SPEC_NOT_READY' END
       ],NULL) AS blocker_codes
  FROM framework_process_step s
  LEFT JOIN framework_step_execution_spec es USING(process_code,step_code)
  LEFT JOIN framework_step_completion_policy p USING(process_code,step_code)
  LEFT JOIN LATERAL jsonb_array_elements(coalesce(es.field_contract->'fields','[]'::jsonb)) field(value) ON true
 WHERE s.process_code IN (
   'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY',
   'ACTIVITY_DATA','EMISSION_CALCULATION'
 )
 GROUP BY s.process_code,s.step_order,s.step_code,s.step_name,s.actor_code,s.user_path,s.admin_path,
          es.field_contract,p.completion_type,p.join_strategy,p.next_actor_code,p.snapshot_required,
          es.process_code,es.design_status,es.approval_status,es.generation_status,p.process_code;

COMMENT ON VIEW framework_twenty_step_relay_readiness IS
  'Five-process twenty-step customer relay readiness with fields, routes, actors and handoff blockers';

