-- A project must exist and be selected before its accounts can be assigned.
-- Keep one authoritative order for the full-workflow map and assignment UI.
UPDATE framework_business_process_sequence
SET workflow_order = workflow_order + 1000,
    updated_at = current_timestamp
WHERE work_type_code = 'EMISSION'
  AND process_code IN (
    'EMISSION_PROJECT_PORTFOLIO','WORK_ASSIGNMENT','EMISSION_PROJECT',
    'ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION'
  );

UPDATE framework_business_process_sequence
SET workflow_order = CASE process_code
      WHEN 'EMISSION_PROJECT_PORTFOLIO' THEN 10
      WHEN 'WORK_ASSIGNMENT' THEN 20
      WHEN 'EMISSION_PROJECT' THEN 30
      WHEN 'ORGANIZATIONAL_BOUNDARY' THEN 40
      WHEN 'ACTIVITY_DATA' THEN 50
      WHEN 'EMISSION_CALCULATION' THEN 60
    END,
    process_role = CASE
      WHEN process_code = 'EMISSION_PROJECT_PORTFOLIO' THEN 'ENTRY'
      WHEN process_code = 'WORK_ASSIGNMENT' THEN 'CORE'
      WHEN process_code = 'EMISSION_CALCULATION' THEN 'EXIT'
      ELSE 'CORE'
    END,
    updated_at = current_timestamp
WHERE work_type_code = 'EMISSION'
  AND process_code IN (
    'EMISSION_PROJECT_PORTFOLIO','WORK_ASSIGNMENT','EMISSION_PROJECT',
    'ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION'
  );

SELECT * FROM framework_rebuild_process_execution_topology();

DO $$
DECLARE
  actual_order text;
BEGIN
  SELECT string_agg(process_code, '>' ORDER BY workflow_order)
  INTO actual_order
  FROM framework_business_process_sequence
  WHERE work_type_code = 'EMISSION' AND sequence_status = 'ACTIVE';

  IF actual_order <> 'EMISSION_PROJECT_PORTFOLIO>WORK_ASSIGNMENT>EMISSION_PROJECT>ORGANIZATIONAL_BOUNDARY>ACTIVITY_DATA>EMISSION_CALCULATION' THEN
    RAISE EXCEPTION 'Invalid emission process order: %', actual_order;
  END IF;
END $$;
