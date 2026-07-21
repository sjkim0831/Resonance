-- Contract completion is idempotent: a failed/blocked job is retried in place
-- instead of colliding with the governed process/step/type/target identity.
DO $$
DECLARE
  function_ddl text;
  patched_ddl text;
  old_fragment text := $fragment$
          AND j.job_status IN ('PLANNED','RETRY','RUNNING','COMPLETED','VERIFIED'));
    GET DIAGNOSTICS queued_count=ROW_COUNT;
$fragment$;
  new_fragment text := $fragment$
          AND j.job_status IN ('PLANNED','RETRY','RUNNING','COMPLETED','VERIFIED'))
    ON CONFLICT(process_code,step_code,job_type,target_path) DO UPDATE SET
      job_status='RETRY',approval_status='APPROVED',worker_id=NULL,lease_token=NULL,
      lease_until=NULL,last_error=NULL,
      attempt_count=least(framework_development_job.attempt_count,
        greatest(0,framework_development_job.max_attempts-1)),
      specification_json=excluded.specification_json,updated_at=current_timestamp
    WHERE framework_development_job.job_status IN ('FAILED','BLOCKED');
    GET DIAGNOSTICS queued_count=ROW_COUNT;
$fragment$;
BEGIN
  SELECT pg_get_functiondef('framework_run_contract_completion(character varying,integer,boolean)'::regprocedure)
  INTO function_ddl;
  patched_ddl := replace(function_ddl,old_fragment,new_fragment);
  IF patched_ddl=function_ddl THEN
    RAISE EXCEPTION 'contract completion retry patch point not found';
  END IF;
  EXECUTE patched_ddl;
END $$;

SELECT framework_run_contract_completion('FLYWAY_IDEMPOTENCY_PREVIEW',25,true);
