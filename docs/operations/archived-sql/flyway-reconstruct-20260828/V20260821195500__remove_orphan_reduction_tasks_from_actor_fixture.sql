-- The actor relay fixture predates reduction process delivery. A historical
-- assignment sync generated REDUCTION_EXECUTION tasks without its prerequisite
-- REDUCTION_PROJECT_APPROVAL process, making the otherwise healthy fixture fail
-- the global workflow gate. Remove only untouched generated tasks with no
-- notification evidence; real project and completed work remain fail-closed.
DELETE FROM emission_project_task task
WHERE task.project_id = 'PRJ-ACTOR-TEST'
  AND task.task_code LIKE 'AUTO\_%' ESCAPE '\'
  AND task.process_code = 'REDUCTION_EXECUTION'
  AND task.task_status = 'BLOCKED'
  AND task.started_at IS NULL
  AND task.completed_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM emission_workflow_notification notification
    WHERE notification.task_id = task.task_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM emission_project_task prerequisite
    WHERE prerequisite.project_id = task.project_id
      AND prerequisite.process_code = 'REDUCTION_PROJECT_APPROVAL'
  );
