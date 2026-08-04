-- Work assignment is a single shared panel inside the global Full Workflow
-- canvas. It intentionally does not create four duplicate route pages.
UPDATE framework_process_step
SET requires_user_page=false, requires_admin_page=false
WHERE process_code='WORK_ASSIGNMENT';

INSERT INTO framework_process_data_handoff(
  process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
  payload_contract,integrity_contract,authorization_contract,failure_contract
)
SELECT step.process_code,step.step_code,step.process_code,next.step_code,'STEP',
  '["tenantId","projectId","processCode","accountId"]',
  jsonb_build_object('fromOutput',framework_try_jsonb(step.output_contract),'toInput',framework_try_jsonb(next.input_contract)),
  '{"immutableSnapshot":true,"optimisticLock":true,"assignmentAudit":true}',
  jsonb_build_object('fromActor',step.actor_code,'toActor',next.actor_code,'tenantIsolation',true,'projectIsolation',true),
  '{"onMissing":"DEPENDENCY_BLOCKED","onInvalid":"VALIDATION_ERROR","onUnauthorized":"DENY_AND_AUDIT"}'
FROM framework_process_step step
JOIN framework_process_step next
  ON next.process_code=step.process_code AND next.step_order=step.step_order+1
WHERE step.process_code='WORK_ASSIGNMENT'
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type) DO NOTHING;
