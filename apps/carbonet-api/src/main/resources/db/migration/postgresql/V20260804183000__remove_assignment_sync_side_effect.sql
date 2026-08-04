-- The assignment API must only reassign already-instantiated runtime tasks.
-- These four auto tasks were created on the isolated actor test project by the
-- former broad process-sync call and have no user data or completion evidence.
DELETE FROM emission_project_task
WHERE project_id='PRJ-ACTOR-TEST'
  AND task_code LIKE 'AUTO\_%' ESCAPE '\'
  AND process_code='ORGANIZATIONAL_BOUNDARY'
  AND task_status='BLOCKED'
  AND NOT EXISTS (
    SELECT 1 FROM emission_workflow_notification n
    WHERE n.task_id=emission_project_task.task_id
  );
