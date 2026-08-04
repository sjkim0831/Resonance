-- Work assignment is an orchestration responsibility, not an emission execution step.
INSERT INTO framework_business_work_type(
  work_type_code, work_type_name, work_type_name_en, description, sort_order, use_at
) VALUES (
  'WORK_ASSIGNMENT', '업무 배정', 'Work Assignment',
  '프로젝트별 프로세스 책임자, 액터 및 단계 담당 계정을 배정하고 변경 이력을 관리하는 독립 업무',
  15, 'Y'
)
ON CONFLICT(work_type_code) DO UPDATE SET
  work_type_name=excluded.work_type_name,
  work_type_name_en=excluded.work_type_name_en,
  description=excluded.description,
  sort_order=excluded.sort_order,
  use_at='Y',
  updated_at=current_timestamp;

UPDATE framework_process_definition
SET domain_code='WORK_ASSIGNMENT',
    process_name='프로젝트 업무 배정',
    updated_at=current_timestamp
WHERE process_code='WORK_ASSIGNMENT';

-- process_code is the sequence identity, so reclassify the existing row in place.
UPDATE framework_business_process_sequence
SET work_type_code='WORK_ASSIGNMENT',
    workflow_order=10,
    workflow_phase='업무 배정',
    process_role='ENTRY',
    prerequisite_process_codes='',
    next_process_code='',
    sequence_status='ACTIVE',
    updated_at=current_timestamp
WHERE process_code='WORK_ASSIGNMENT';

SELECT * FROM framework_rebuild_process_execution_topology();

DO $$
DECLARE
  emission_order text;
  assignment_count integer;
  assignment_predecessor_count integer;
BEGIN
  SELECT string_agg(process_code, '>' ORDER BY workflow_order)
  INTO emission_order
  FROM framework_business_process_sequence
  WHERE work_type_code='EMISSION' AND sequence_status='ACTIVE';

  IF emission_order <> 'EMISSION_PROJECT_PORTFOLIO>EMISSION_PROJECT>ORGANIZATIONAL_BOUNDARY>ACTIVITY_DATA>EMISSION_CALCULATION' THEN
    RAISE EXCEPTION 'Invalid emission process order after assignment separation: %', emission_order;
  END IF;

  SELECT count(*) INTO assignment_count
  FROM framework_business_process_sequence
  WHERE work_type_code='WORK_ASSIGNMENT' AND process_code='WORK_ASSIGNMENT' AND sequence_status='ACTIVE';

  IF assignment_count <> 1 THEN
    RAISE EXCEPTION 'Work assignment classification count must be 1, actual %', assignment_count;
  END IF;

  SELECT count(*) INTO assignment_predecessor_count
  FROM framework_process_execution_topology
  WHERE process_code='EMISSION_PROJECT'
    AND position('WORK_ASSIGNMENT' IN coalesce(predecessor_process_codes::text, '')) > 0;

  IF assignment_predecessor_count <> 0 THEN
    RAISE EXCEPTION 'Work assignment must not block emission execution';
  END IF;
END $$;
