ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step
SET user_path='/emission/activity-data?mode=correction'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CORRECT';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

-- The canonical customer-journey project must exercise five independent
-- accounts. Remove legacy owner fallbacks before restoring the exact matrix.
DELETE FROM framework_project_actor_assignment
WHERE project_id='PRJ-2026-001'
  AND actor_code IN ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER');

INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id,active_yn)
VALUES
 ('PRJ-2026-001','COMPANY_MANAGER','qaowner26','Y'),
 ('PRJ-2026-001','SITE_DATA_OWNER','qadata26','Y'),
 ('PRJ-2026-001','CALCULATOR','qacalc26','Y'),
 ('PRJ-2026-001','VERIFIER','qaverify26','Y'),
 ('PRJ-2026-001','APPROVER','qaapprove26','Y')
ON CONFLICT(project_id,actor_code,user_id) DO UPDATE SET active_yn='Y',assigned_at=current_timestamp;

WITH project AS (
  SELECT tenant_id,project_id FROM emission_project_registry WHERE project_id='PRJ-2026-001'
), fixture(account_id,actor_code) AS (
  VALUES
   ('qaowner26','COMPANY_MANAGER'),('qadata26','SITE_DATA_OWNER'),
   ('qacalc26','CALCULATOR'),('qaverify26','VERIFIER'),('qaapprove26','APPROVER')
)
INSERT INTO framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
SELECT f.account_id,p.tenant_id,p.project_id,f.actor_code,p.project_id,'ACTIVE'
FROM fixture f CROSS JOIN project p
ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET
 data_scope=excluded.data_scope,assignment_status='ACTIVE',valid_until=null;

WITH binding(task_code,account_id) AS (
  VALUES ('BASIC_INFO','qaowner26'),('ACTIVITY_DATA','qadata26'),
   ('CALCULATION','qacalc26'),('VERIFICATION','qaverify26'),
   ('APPROVAL','qaapprove26'),('REPORT','qaowner26'),
   ('REGULATORY_SUBMISSION','qaowner26')
)
UPDATE emission_project_task task SET assignee_id=binding.account_id,updated_at=current_timestamp
FROM binding
WHERE task.project_id='PRJ-2026-001' AND task.task_code=binding.task_code;

-- A dedicated project-scoped fixture lets the generic runtime smoke execute
-- GOVERNANCE_CHANGE without reusing an active customer workflow.
INSERT INTO framework_account_actor_assignment(
 account_id,tenant_id,project_id,actor_code,data_scope,assignment_status,valid_from,valid_until
)
SELECT 'webmaster','DEFAULT','RUNTIME-SMOKE-GOVERNANCE',step.actor_code,
       'RUNTIME-SMOKE-GOVERNANCE','ACTIVE',current_date,null
FROM framework_process_step step
WHERE step.process_code='GOVERNANCE_CHANGE'
GROUP BY step.actor_code
ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET
 assignment_status='ACTIVE',data_scope=excluded.data_scope,valid_until=null;
