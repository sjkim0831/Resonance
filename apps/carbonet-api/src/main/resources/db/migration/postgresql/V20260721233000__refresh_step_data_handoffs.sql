-- Recompile adjacent-step handoffs after processes gain new steps.
-- This is intentionally idempotent so design expansion never leaves the
-- executable workflow topology behind its canonical process definition.
INSERT INTO framework_process_data_handoff(
 process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
 payload_contract,integrity_contract,authorization_contract,failure_contract)
SELECT s.process_code,s.step_code,s.process_code,n.step_code,'STEP',
 '["tenantId","projectId","processCode","recordId","rowVersion"]'::jsonb,
 jsonb_build_object(
   'fromOutput',framework_try_jsonb(s.output_contract),
   'toInput',framework_try_jsonb(n.input_contract),
   'requiredContext',jsonb_build_array('tenantId','projectId','recordId','statusCode','rowVersion')),
 '{"immutableSnapshot":true,"hashWhenEvidenceOrCalculation":true,"optimisticLock":true}'::jsonb,
 jsonb_build_object(
   'fromActor',s.actor_code,
   'toActor',n.actor_code,
   'tenantIsolation',true,
   'projectIsolation',true,
   'segregationChecked',true),
 '{"onMissing":"DEPENDENCY_BLOCKED","onInvalid":"VALIDATION_ERROR","onConflict":"RELOAD_AND_REVIEW","onUnauthorized":"DENY_AND_AUDIT"}'::jsonb
FROM framework_process_step s
JOIN framework_process_step n
  ON n.process_code=s.process_code
 AND n.step_order=(
   SELECT min(x.step_order)
   FROM framework_process_step x
   WHERE x.process_code=s.process_code AND x.step_order>s.step_order)
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type)
DO UPDATE SET
 context_keys=excluded.context_keys,
 payload_contract=excluded.payload_contract,
 integrity_contract=excluded.integrity_contract,
 authorization_contract=excluded.authorization_contract,
 failure_contract=excluded.failure_contract,
 updated_at=current_timestamp;
