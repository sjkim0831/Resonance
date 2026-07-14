BEGIN;

DO $$
DECLARE
  project varchar(40);
  owner_name varchar(100);
  ready_count integer;
  blocked_count integer;
BEGIN
  SELECT project_id,owner_name INTO project,owner_name
  FROM emission_project_registry ORDER BY project_id LIMIT 1;
  IF project IS NULL THEN RAISE EXCEPTION 'ORCHESTRATION_PROJECT_FIXTURE_MISSING'; END IF;

  IF EXISTS (
    SELECT 1 FROM emission_project_task
    WHERE project_id=project AND task_code IN ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT')
      AND (process_code IS NULL OR process_step_code IS NULL OR actor_code IS NULL OR completion_rule IS NULL)
  ) THEN RAISE EXCEPTION 'TASK_PROCESS_ACTOR_CONTRACT_MISSING'; END IF;

  UPDATE emission_project_task SET task_status='DONE',completed_at=current_timestamp,completed_by=owner_name
  WHERE project_id=project AND task_code='BASIC_INFO';
  UPDATE emission_project_task n SET task_status='READY',blocked_reason=null
  WHERE n.project_id=project AND n.task_code='ACTIVITY_DATA'
    AND NOT EXISTS (
      SELECT 1 FROM emission_project_task p
      WHERE p.project_id=n.project_id
        AND p.task_code=ANY(string_to_array(nullif(n.predecessor_codes,''),','))
        AND p.task_status<>'DONE'
    );

  SELECT count(*) INTO ready_count FROM emission_project_task
  WHERE project_id=project AND task_code='ACTIVITY_DATA' AND task_status='READY';
  SELECT count(*) INTO blocked_count FROM emission_project_task
  WHERE project_id=project AND task_code='CALCULATION' AND task_status IN ('BLOCKED','WAITING');
  IF ready_count<>1 THEN RAISE EXCEPTION 'NEXT_TASK_NOT_OPENED'; END IF;
  IF blocked_count<>1 THEN RAISE EXCEPTION 'DOWNSTREAM_TASK_NOT_BLOCKED'; END IF;

  IF owner_name IS NOT NULL AND owner_name<>'' AND NOT EXISTS (
    SELECT 1 FROM framework_project_actor_assignment
    WHERE project_id=project AND user_id=owner_name AND actor_code='COMPANY_MANAGER' AND active_yn='Y'
  ) THEN RAISE EXCEPTION 'PROJECT_ACTOR_ASSIGNMENT_MISSING'; END IF;
END $$;

ROLLBACK;
