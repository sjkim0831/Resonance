-- Retry is bounded. Exhausted work remains visible for review and is never
-- made executable by lowering attempt_count on every orchestration cycle.
DO $$
DECLARE
  function_ddl text;
  patched_ddl text;
  old_fragment text := $fragment$
      lease_until=NULL,last_error=NULL,
      attempt_count=least(framework_development_job.attempt_count,
        greatest(0,framework_development_job.max_attempts-1)),
      specification_json=excluded.specification_json,updated_at=current_timestamp
    WHERE framework_development_job.job_status IN ('FAILED','BLOCKED');
$fragment$;
  new_fragment text := $fragment$
      lease_until=NULL,last_error=NULL,
      specification_json=excluded.specification_json,updated_at=current_timestamp
    WHERE framework_development_job.job_status IN ('FAILED','BLOCKED')
      AND framework_development_job.attempt_count<framework_development_job.max_attempts;
$fragment$;
BEGIN
  SELECT pg_get_functiondef('framework_run_contract_completion(character varying,integer,boolean)'::regprocedure)
  INTO function_ddl;
  patched_ddl := replace(function_ddl,old_fragment,new_fragment);
  IF patched_ddl=function_ddl THEN
    RAISE EXCEPTION 'contract completion bounded retry patch point not found';
  END IF;
  EXECUTE patched_ddl;
END $$;

SELECT framework_run_contract_completion('FLYWAY_BOUNDED_RETRY_PREVIEW',25,true);
