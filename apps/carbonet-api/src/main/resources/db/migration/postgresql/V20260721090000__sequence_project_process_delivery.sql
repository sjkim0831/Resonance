-- Develop project-bound processes one at a time. Shared contracts may be
-- generated in bulk, but only the first unfinished process is ACTIVE.
CREATE OR REPLACE VIEW framework_project_process_sequential_delivery AS
WITH applicable AS (
  SELECT a.process_code,count(DISTINCT a.project_id)::integer AS project_count,
         bool_or(a.applicability_status='APPLICABLE') AS executable
  FROM framework_project_process_applicability a
  WHERE a.applicability_status IN ('APPLICABLE','CONDITIONAL')
  GROUP BY a.process_code
), ranked AS (
  SELECT p.process_code,p.process_name,p.domain_code,a.project_count,a.executable,
         count(s.step_id)::integer AS step_count,
         coalesce(m.assurance_status,'DESIGN_BLOCKED') AS assurance_status,
         coalesce(m.design_accuracy_score,0)::integer AS design_accuracy_score,
         coalesce(m.next_action,'DESIGN_REQUIRED') AS next_action,
         row_number() OVER(ORDER BY
           CASE p.domain_code WHEN 'EMISSION' THEN 10 WHEN 'COMPLIANCE' THEN 20
             WHEN 'MRV' THEN 30 WHEN 'DATA_GOVERNANCE' THEN 40 WHEN 'PORTFOLIO' THEN 50 ELSE 90 END,
           coalesce(seq.workflow_order,p.development_order),p.process_code)::integer AS delivery_order
  FROM applicable a
  JOIN framework_process_definition p USING(process_code)
  LEFT JOIN framework_process_step s USING(process_code)
  LEFT JOIN framework_process_design_assurance_matrix m USING(process_code)
  LEFT JOIN framework_business_process_sequence seq USING(process_code)
  GROUP BY p.process_code,p.process_name,p.domain_code,a.project_count,a.executable,m.assurance_status,
           m.design_accuracy_score,m.next_action,seq.workflow_order,p.development_order
), marked AS (
  SELECT r.*,min(delivery_order) FILTER(WHERE executable AND assurance_status<>'IMPLEMENTATION_VERIFIED') OVER() AS active_order
  FROM ranked r
)
SELECT delivery_order,process_code,process_name,domain_code,step_count,project_count,
       assurance_status,design_accuracy_score,next_action,
       CASE WHEN assurance_status='IMPLEMENTATION_VERIFIED' THEN 'VERIFIED'
            WHEN NOT executable THEN 'CONDITIONAL'
            WHEN delivery_order=active_order THEN 'ACTIVE' ELSE 'WAITING' END AS selection_status
FROM marked;

COMMENT ON VIEW framework_project_process_sequential_delivery IS
  'Sequential quality-gated delivery queue for project-bound processes';

-- Historical workers stored valid evidence but did not synchronize the quality
-- column. Reconcile only already VERIFIED jobs carrying a concrete evidence ref.
UPDATE framework_development_job
SET quality_status='VERIFIED',updated_at=current_timestamp
WHERE job_status='VERIFIED' AND quality_status<>'VERIFIED' AND nullif(evidence_ref,'') IS NOT NULL;

-- Propagate the exact verified job evidence to its generated artifact. This is
-- state reconciliation, not synthetic completion.
UPDATE framework_process_artifact artifact
SET delivery_status='VERIFIED',evidence_ref=job.evidence_ref,updated_at=current_timestamp
FROM framework_development_job job
WHERE artifact.process_code=job.process_code
  AND artifact.step_code=job.step_code
  AND artifact.contract_ref='AUTO:'||job.job_type
  AND artifact.required
  AND artifact.delivery_status<>'VERIFIED'
  AND job.job_status='VERIFIED'
  AND job.quality_status='VERIFIED'
  AND nullif(job.evidence_ref,'') IS NOT NULL;

-- The shared task workspace predates generated jobs. It may be adopted only
-- when the registered page and process-level integration/actor evidence exist.
UPDATE framework_process_artifact artifact
SET delivery_status='VERIFIED',evidence_ref='reconciled:registered-page+integration+actor-test',updated_at=current_timestamp
WHERE artifact.process_code='EMISSION_PROJECT'
  AND artifact.contract_ref='WORKSPACE:MY_TASKS'
  AND artifact.delivery_status<>'VERIFIED'
  AND EXISTS(SELECT 1 FROM ui_page_manifest page WHERE lower(page.route_path)='/emission/my-tasks' AND page.active_yn='Y')
  AND EXISTS(SELECT 1 FROM framework_development_job job WHERE job.process_code=artifact.process_code AND job.job_type='INTEGRATION' AND job.job_status='VERIFIED' AND nullif(job.evidence_ref,'') IS NOT NULL)
  AND EXISTS(SELECT 1 FROM framework_development_job job WHERE job.process_code=artifact.process_code AND job.job_type='ACTOR_TEST' AND job.job_status='VERIFIED' AND nullif(job.evidence_ref,'') IS NOT NULL);
