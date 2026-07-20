-- Preserve immutable implemented process definitions while making every process
-- selectable in the page-by-page development queue.
WITH processes_without_jobs AS (
    SELECT p.process_code
    FROM framework_process_definition p
    JOIN framework_business_work_type w
      ON w.work_type_code = upper(p.domain_code)
     AND w.use_at = 'Y'
    WHERE NOT EXISTS (
        SELECT 1 FROM framework_development_job j
        WHERE j.process_code = p.process_code
    )
), job_templates(job_type, job_name, group_code, weight) AS (
    VALUES
      ('DESIGN', 'Detailed design contract', 'DESIGN', 1.0::numeric),
      ('DATABASE', 'Schema and migration', 'BACKEND_DATA', 1.0::numeric),
      ('API', 'API, authorization and idempotency', 'BACKEND_API', 1.0::numeric),
      ('FRONTEND_USER', 'User workflow screen', 'FRONTEND', 1.0::numeric),
      ('FRONTEND_ADMIN', 'Administrator workflow screen', 'FRONTEND', 1.0::numeric),
      ('TEST', 'Happy, exception, authority, isolation and recovery tests', 'TEST', 1.0::numeric),
      ('INTEGRATION', 'Menu, screen, API and database integration', 'INTEGRATION', 1.0::numeric)
)
INSERT INTO framework_development_job(
    process_code, step_code, job_type, job_name, target_path,
    specification_json, job_status, approval_status, created_by,
    execution_mode, job_group_code, required, progress_weight,
    max_attempts, quality_status, quality_report
)
SELECT s.process_code, s.step_code, t.job_type,
       s.step_name || ' - ' || t.job_name,
       'design://process/' || lower(s.process_code) || '/' || lower(s.step_code) || '/' || lower(t.job_type),
       jsonb_build_object(
         'processCode', s.process_code,
         'stepCode', s.step_code,
         'actorCode', s.actor_code,
         'completionRule', s.completion_rule,
         'inputContract', s.input_contract::jsonb,
         'outputContract', s.output_contract::jsonb,
         'commonAssetsOnly', true,
         'responsiveRequired', true,
         'accessibility', 'WCAG_2_1_AA',
         'implementationClaimed', false
       )::text,
       'PLANNED', 'PENDING', 'WORK_CATALOG_AUDIT',
       'PARALLEL', t.group_code, true, t.weight, 3,
       'PENDING', 'Evidence is required before completion.'
FROM framework_process_step s
JOIN processes_without_jobs p ON p.process_code = s.process_code
CROSS JOIN job_templates t
ON CONFLICT(process_code, step_code, job_type, target_path) DO NOTHING;

DO $$
DECLARE process_id varchar;
BEGIN
  FOR process_id IN
    SELECT DISTINCT j.process_code
    FROM framework_development_job j
    WHERE j.created_by = 'WORK_CATALOG_AUDIT'
  LOOP
    PERFORM framework_sync_development_dependencies(process_id);
  END LOOP;
END $$;
