CREATE OR REPLACE FUNCTION framework_task_matches_process(task_process_code varchar,task_code varchar,catalog_process_code varchar)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT task_process_code=catalog_process_code
      OR (catalog_process_code='ACTIVITY_DATA' AND task_code='ACTIVITY_DATA')
      OR (catalog_process_code='EMISSION_CALCULATION' AND task_code='CALCULATION')
$$;

-- The seven established runtime tasks remain the execution source of truth.
-- Remove only tasks created by the first applicability backfill; user tasks are
-- never deleted by this repair.
DELETE FROM emission_project_task WHERE task_code LIKE 'AUTO\_%' ESCAPE '\';

-- Upgrade the already-installed synchronization function without duplicating
-- its complete body. These replacements make the activity-data and calculation
-- runtime tasks satisfy their dedicated catalogue processes.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('framework_sync_project_processes(varchar,varchar)'::regprocedure) INTO definition;
  definition:=replace(definition,'existing.process_code=p.process_code','framework_task_matches_process(existing.process_code, existing.task_code, p.process_code)');
  definition:=replace(definition,'existing.process_code=a.process_code','framework_task_matches_process(existing.process_code, existing.task_code, a.process_code)');
  definition:=replace(definition,'t.process_code=a.process_code','framework_task_matches_process(t.process_code, t.task_code, a.process_code)');
  EXECUTE definition;
END $$;

-- Re-evaluate after the duplicate repair. The function is idempotent and the
-- project advisory lock prevents concurrent task generation.
DO $$ DECLARE project_code varchar; BEGIN
  FOR project_code IN SELECT project_id FROM emission_project_registry LOOP
    PERFORM framework_sync_project_processes(project_code,'FLYWAY_RUNTIME_TASK_REUSE');
  END LOOP;
END $$;

CREATE OR REPLACE VIEW framework_project_process_readiness AS
SELECT a.project_id,p.tenant_id,p.project_name,a.process_code,d.process_name,
       seq.workflow_order,seq.workflow_phase,seq.process_role,
       a.applicability_status,a.implementation_status,a.task_generation_status,a.execution_status,
       a.reason_code,a.reason_text,
       count(t.task_id) AS task_count,
       count(t.task_id) FILTER(WHERE t.task_status='DONE') AS completed_task_count
FROM framework_project_process_applicability a
JOIN emission_project_registry p ON p.project_id=a.project_id
JOIN framework_process_definition d ON d.process_code=a.process_code
JOIN framework_business_process_sequence seq ON seq.process_code=a.process_code
LEFT JOIN emission_project_task t ON t.project_id=a.project_id
 AND framework_task_matches_process(t.process_code,t.task_code,a.process_code)
GROUP BY a.project_id,p.tenant_id,p.project_name,a.process_code,d.process_name,
         seq.workflow_order,seq.workflow_phase,seq.process_role,
         a.applicability_status,a.implementation_status,a.task_generation_status,a.execution_status,
         a.reason_code,a.reason_text;
