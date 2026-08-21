-- Align generated REDUCTION contracts with the canonical runtime relations and
-- the four-step state machine. The validator remains fail-closed.
UPDATE framework_professional_screen_contract
SET data_contract = replace(
      replace(
        replace(
          replace(
            replace(
              replace(data_contract,
                '"PROCESS_EXECUTION"','"framework_process_execution"'),
              '"PROCESS_STEP"','"framework_process_step"'),
            '"WORK_DRAFT"','"framework_process_work_draft"'),
          '"AUDIT_EVENT"','"framework_process_execution_event"'),
        '"reduction_project"','"emission_project_registry"'),
      '"reduction scenario; emission baseline; reduction target"','"emission_project_registry"'),
    updated_at = current_timestamp
WHERE process_code LIKE 'REDUCTION_%';

UPDATE framework_process_step
SET to_state = CASE WHEN step_order=4 THEN 'COMPLETED' ELSE to_state END,
    output_contract = jsonb_set(
      coalesce(nullif(output_contract,'')::jsonb,'{}'::jsonb),
      '{toState}',
      to_jsonb(CASE WHEN step_order=4 THEN 'COMPLETED' ELSE to_state END),
      true
    )::text
WHERE process_code IN (
  'REDUCTION_TARGET_PLANNING','REDUCTION_ROADMAP',
  'REDUCTION_PROJECT_REGISTRATION','REDUCTION_PROJECT_APPROVAL',
  'REDUCTION_PERFORMANCE','REDUCTION_SCENARIO','REDUCTION_REPORTING'
);

DO $$
DECLARE
  process_code text;
  result record;
BEGIN
  FOREACH process_code IN ARRAY ARRAY[
    'REDUCTION_TARGET_PLANNING','REDUCTION_ROADMAP',
    'REDUCTION_PROJECT_REGISTRATION','REDUCTION_PROJECT_APPROVAL',
    'REDUCTION_PERFORMANCE','REDUCTION_SCENARIO','REDUCTION_REPORTING'
  ] LOOP
    SELECT * INTO result
    FROM framework_validate_process_design(
      process_code,
      'FLYWAY_REDUCTION_EXECUTABLE_DESIGN_REPAIR'
    );
    IF result.blocker_count <> 0 THEN
      RAISE EXCEPTION 'REDUCTION_DESIGN_REPAIR_INCOMPLETE process=% blockers=%',
        process_code,result.blocker_count;
    END IF;
  END LOOP;
END $$;
