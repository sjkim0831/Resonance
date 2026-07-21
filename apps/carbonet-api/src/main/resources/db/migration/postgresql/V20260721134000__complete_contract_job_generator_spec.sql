-- FULL_STACK jobs must satisfy the same deterministic generator contract as
-- hand-authored jobs. Build a non-placeholder requirement from governed step
-- metadata and declare the mandatory generator explicitly.
DO $$
DECLARE
  function_ddl text;
  patched_ddl text;
  old_fragment text := $fragment$
        'algorithm','CONTRACT_DRIVEN_VERTICAL_COMPLETION_V1',
        'completionRunId',current_run_id,'completionStatus',r.completion_status,
$fragment$;
  new_fragment text := $fragment$
        'algorithm','CONTRACT_DRIVEN_VERTICAL_COMPLETION_V1',
        'generatorRequired',true,
        'requirement',(SELECT coalesce(nullif(btrim(s.requirement_text),''),
          s.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.')
          FROM framework_process_step s
          WHERE s.process_code=r.process_code AND s.step_code=r.step_code),
        'completionRunId',current_run_id,'completionStatus',r.completion_status,
$fragment$;
BEGIN
  SELECT pg_get_functiondef('framework_run_contract_completion(character varying,integer,boolean)'::regprocedure)
  INTO function_ddl;
  patched_ddl := replace(function_ddl,old_fragment,new_fragment);
  IF patched_ddl=function_ddl THEN
    RAISE EXCEPTION 'contract generator specification patch point not found';
  END IF;
  EXECUTE patched_ddl;
END $$;

WITH repaired AS (
  UPDATE framework_development_job j
  SET specification_json=(coalesce(nullif(j.specification_json,''),'{}')::jsonb
      || jsonb_build_object(
        'generatorRequired',true,
        'requirement',coalesce(nullif(btrim(s.requirement_text),''),
          s.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.'),
        'specRepairVersion','CONTRACT_GENERATOR_SPEC_V1'))::text,
      job_status='RETRY',attempt_count=greatest(0,j.max_attempts-1),
      worker_id=NULL,lease_token=NULL,lease_until=NULL,last_error=NULL,
      updated_at=current_timestamp
  FROM framework_process_step s
  WHERE j.process_code=s.process_code AND j.step_code=s.step_code
    AND j.created_by='CONTRACT_COMPLETION_ALGORITHM'
    AND j.job_status='FAILED' AND j.attempt_count>=j.max_attempts
    AND j.last_error IN ('professional development contract preflight failed',
      'deterministic generator failed with code 1')
    AND NOT (coalesce(nullif(j.specification_json,''),'{}')::jsonb ? 'specRepairVersion')
  RETURNING j.job_id
)
INSERT INTO framework_development_job_event(
  job_id,event_type,from_status,to_status,worker_id,detail_json)
SELECT job_id,'SPEC_REPAIR_RETRY','FAILED','RETRY','contract-completion-migration',
  jsonb_build_object('repairVersion','CONTRACT_GENERATOR_SPEC_V1',
    'reason','governed requirement and deterministic generator contract added')
FROM repaired;

SELECT framework_run_contract_completion('FLYWAY_GENERATOR_SPEC_PREVIEW',25,true);
