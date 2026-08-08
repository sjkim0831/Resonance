WITH bindings(step_code,case_code,expected_state) AS (VALUES
  ('WORK_ASSIGNMENT_CONTEXT','WORK_ASSIGNMENT-HAPPY','CONTEXT_SELECTED'),
  ('WORK_ASSIGNMENT_CONTEXT','WORK_ASSIGNMENT-AUTH','READY'),
  ('WORK_ASSIGNMENT_ACTOR','WORK_ASSIGNMENT-HAPPY','ACTORS_ASSIGNED'),
  ('WORK_ASSIGNMENT_ACTOR','WORK_ASSIGNMENT-ISOLATION','CONTEXT_SELECTED'),
  ('WORK_ASSIGNMENT_STEP','WORK_ASSIGNMENT-HAPPY','STEPS_ASSIGNED'),
  ('WORK_ASSIGNMENT_STEP','WORK_ASSIGNMENT-VALIDATION','ACTORS_ASSIGNED'),
  ('WORK_ASSIGNMENT_CONFIRM','WORK_ASSIGNMENT-HAPPY','COMPLETED'),
  ('WORK_ASSIGNMENT_CONFIRM','WORK_ASSIGNMENT-RECOVERY','COMPLETED')
)
INSERT INTO framework_step_test_binding(
  process_code,step_code,case_code,trace_scope,expected_state,assertion_contract,evidence_required
)
SELECT 'WORK_ASSIGNMENT',step_code,case_code,'STEP',expected_state,
       jsonb_build_object(
         'deterministic',true,
         'aiRequired',false,
         'runtimeHarness','ops/scripts/validate-work-assignment-runtime.sh'
       ),true
  FROM bindings
ON CONFLICT(process_code,step_code,case_code) DO UPDATE SET
  trace_scope=excluded.trace_scope,
  expected_state=excluded.expected_state,
  assertion_contract=excluded.assertion_contract,
  evidence_required=true;

DO $$
DECLARE
  unbound_step_count integer;
  missing_case_count integer;
BEGIN
  SELECT count(*) INTO unbound_step_count
    FROM framework_process_step step
   WHERE step.process_code='WORK_ASSIGNMENT'
     AND NOT EXISTS (
       SELECT 1 FROM framework_step_test_binding binding
        WHERE binding.process_code=step.process_code AND binding.step_code=step.step_code
     );

  SELECT 5-count(DISTINCT simulation.case_type) INTO missing_case_count
    FROM framework_step_test_binding binding
    JOIN framework_simulation_case simulation USING(case_code)
   WHERE binding.process_code='WORK_ASSIGNMENT'
     AND simulation.case_type IN ('HAPPY_PATH','AUTHORITY','ISOLATION','VALIDATION','RECOVERY');

  IF unbound_step_count<>0 THEN
    RAISE EXCEPTION 'WORK_ASSIGNMENT_UNBOUND_STEPS: %',unbound_step_count;
  END IF;
  IF missing_case_count<>0 THEN
    RAISE EXCEPTION 'WORK_ASSIGNMENT_TEST_TYPES_INCOMPLETE: %',missing_case_count;
  END IF;
END $$;
