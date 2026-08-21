-- Reduction work is part of the project lifecycle, but the project process
-- synchronizer previously omitted the REDUCTION work type. This left official
-- step assignments disconnected from emission_project_task and My Work.
DO $$
DECLARE
  definition text;
  old_scope constant text := 'seq.work_type_code IN (''EMISSION'',''MRV'',''COMPLIANCE'',''DATA_GOVERNANCE'',''PORTFOLIO'')';
  new_scope constant text := 'seq.work_type_code IN (''EMISSION'',''MRV'',''COMPLIANCE'',''DATA_GOVERNANCE'',''PORTFOLIO'',''REDUCTION'')';
BEGIN
  definition := pg_get_functiondef(
    'framework_sync_project_processes(character varying,character varying)'::regprocedure
  );

  IF position(new_scope in definition) = 0 THEN
    IF position(old_scope in definition) = 0 THEN
      RAISE EXCEPTION 'REDUCTION_PROJECT_PROCESS_SYNC_SCOPE_SOURCE_NOT_FOUND';
    END IF;
    definition := replace(definition, old_scope, new_scope);
    EXECUTE definition;
  END IF;

  definition := pg_get_functiondef(
    'framework_sync_project_processes(character varying,character varying)'::regprocedure
  );
  IF position(new_scope in definition) = 0 THEN
    RAISE EXCEPTION 'REDUCTION_PROJECT_PROCESS_SYNC_SCOPE_PATCH_FAILED';
  END IF;
END $$;

-- Reconcile only projects that already have an explicit REDUCTION assignment.
-- This avoids silently opting unrelated projects into a new business workflow.
DO $$
DECLARE
  target_project_id varchar;
BEGIN
  FOR target_project_id IN
    SELECT DISTINCT assignment.project_id
    FROM framework_project_process_step_assignment assignment
    JOIN framework_process_definition process
      ON process.process_code = assignment.process_code
    WHERE upper(process.domain_code) = 'REDUCTION'
  LOOP
    PERFORM framework_sync_project_processes(
      target_project_id,
      'FLYWAY_REDUCTION_ASSIGNMENT_RECONCILE'
    );
  END LOOP;
END $$;

CREATE OR REPLACE VIEW framework_reduction_assignment_delivery_audit AS
SELECT
  assignment.project_id,
  count(DISTINCT assignment.process_code)
    FILTER (WHERE assignment.step_code = '__PROCESS__') AS assigned_process_count,
  count(*) FILTER (WHERE assignment.step_code <> '__PROCESS__') AS assigned_step_count,
  count(DISTINCT task.process_code) AS generated_process_count,
  count(DISTINCT task.task_id) AS generated_task_count,
  count(*) FILTER (
    WHERE assignment.step_code <> '__PROCESS__'
      AND task.task_id IS NULL
  ) AS missing_task_count
FROM framework_project_process_step_assignment assignment
JOIN framework_process_definition process
  ON process.process_code = assignment.process_code
 AND upper(process.domain_code) = 'REDUCTION'
LEFT JOIN emission_project_task task
  ON task.project_id = assignment.project_id
 AND task.process_code = assignment.process_code
 AND task.process_step_code = assignment.step_code
GROUP BY assignment.project_id;

COMMENT ON VIEW framework_reduction_assignment_delivery_audit IS
  '감축 프로세스·단계 배정과 실제 내 업무 task 생성의 폐쇄 여부';
