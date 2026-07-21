-- Locked processes are immutable reference implementations. They may still be
-- audited and may receive implementation/evidence jobs, but the completion
-- orchestrator must never rewrite their governed step state.
DO $$
DECLARE
  function_ddl text;
  patched_ddl text;
  old_fragment text := $fragment$
    FROM framework_contract_completion_result r
    WHERE r.run_id=current_run_id AND r.process_code=s.process_code AND r.step_code=s.step_code;
$fragment$;
  new_fragment text := $fragment$
    FROM framework_contract_completion_result r
    JOIN framework_process_definition p ON p.process_code=r.process_code
    WHERE r.run_id=current_run_id AND r.process_code=s.process_code AND r.step_code=s.step_code
      AND NOT p.definition_locked;
$fragment$;
BEGIN
  SELECT pg_get_functiondef('framework_run_contract_completion(character varying,integer,boolean)'::regprocedure)
  INTO function_ddl;
  patched_ddl := replace(function_ddl,old_fragment,new_fragment);
  IF patched_ddl=function_ddl THEN
    RAISE EXCEPTION 'contract completion function patch point not found';
  END IF;
  EXECUTE patched_ddl;
END $$;

SELECT framework_run_contract_completion('FLYWAY_LOCKED_PROCESS_PREVIEW',25,true);
