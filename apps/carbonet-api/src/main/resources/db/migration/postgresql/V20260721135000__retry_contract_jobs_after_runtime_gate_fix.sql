-- One bounded retry is granted only for jobs exhausted by the now-corrected
-- server-context, executable-scenario, and governance-requirement gates.
WITH repaired AS (
  UPDATE framework_development_job j
  SET specification_json=(coalesce(nullif(j.specification_json,''),'{}')::jsonb
      || jsonb_build_object('runtimeGateRepairVersion','CONTRACT_RUNTIME_GATES_V1'))::text,
      job_status='RETRY',attempt_count=greatest(0,j.max_attempts-1),
      worker_id=NULL,lease_token=NULL,lease_until=NULL,last_error=NULL,
      updated_at=current_timestamp
  WHERE j.created_by='CONTRACT_COMPLETION_ALGORITHM'
    AND j.job_status='FAILED' AND j.attempt_count>=j.max_attempts
    AND j.last_error IN ('professional development contract preflight failed',
      'deterministic generator failed with code 1')
    AND j.specification_json::jsonb->>'specRepairVersion'='CONTRACT_GENERATOR_SPEC_V1'
    AND NOT (j.specification_json::jsonb ? 'runtimeGateRepairVersion')
  RETURNING j.job_id
)
INSERT INTO framework_development_job_event(
  job_id,event_type,from_status,to_status,worker_id,detail_json)
SELECT job_id,'RUNTIME_GATE_REPAIR','FAILED','RETRY','contract-completion-migration',
  jsonb_build_object('repairVersion','CONTRACT_RUNTIME_GATES_V1',
    'reason','server context, executable scenario, and governance requirement gates corrected')
FROM repaired;

SELECT framework_run_contract_completion('FLYWAY_RUNTIME_GATE_PREVIEW',25,true);
