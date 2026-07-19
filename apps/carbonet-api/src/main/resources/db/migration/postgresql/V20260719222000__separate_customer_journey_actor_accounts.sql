-- Development customer-journey fixture: keep calculation, verification and approval
-- on distinct real accounts so role separation is exercised by runtime validation.
WITH fixture(project_id, actor_code, account_id) AS (
  VALUES
    ('PRJ-2026-001','COMPANY_MANAGER','qaowner26'),
    ('PRJ-2026-001','SITE_DATA_OWNER','qadata26'),
    ('PRJ-2026-001','CALCULATOR','qacalc26'),
    ('PRJ-2026-001','VERIFIER','qaverify26'),
    ('PRJ-2026-001','APPROVER','qaapprove26')
), valid_fixture AS (
  SELECT f.*
  FROM fixture f
  JOIN emission_project_registry p ON p.project_id=f.project_id
  JOIN comtnemplyrinfo u ON lower(u.emplyr_id)=lower(f.account_id)
)
DELETE FROM framework_project_actor_assignment a
USING valid_fixture f
WHERE a.project_id=f.project_id AND a.actor_code=f.actor_code;

WITH fixture(project_id, actor_code, account_id) AS (
  VALUES
    ('PRJ-2026-001','COMPANY_MANAGER','qaowner26'),
    ('PRJ-2026-001','SITE_DATA_OWNER','qadata26'),
    ('PRJ-2026-001','CALCULATOR','qacalc26'),
    ('PRJ-2026-001','VERIFIER','qaverify26'),
    ('PRJ-2026-001','APPROVER','qaapprove26')
)
INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id,active_yn)
SELECT f.project_id,f.actor_code,f.account_id,'Y'
FROM fixture f
JOIN emission_project_registry p ON p.project_id=f.project_id
JOIN comtnemplyrinfo u ON lower(u.emplyr_id)=lower(f.account_id)
ON CONFLICT(project_id,actor_code,user_id)
DO UPDATE SET active_yn='Y',assigned_at=current_timestamp;

WITH fixture(project_id, actor_code, account_id) AS (
  VALUES
    ('PRJ-2026-001','COMPANY_MANAGER','qaowner26'),
    ('PRJ-2026-001','SITE_DATA_OWNER','qadata26'),
    ('PRJ-2026-001','CALCULATOR','qacalc26'),
    ('PRJ-2026-001','VERIFIER','qaverify26'),
    ('PRJ-2026-001','APPROVER','qaapprove26')
), scoped AS (
  SELECT f.*,p.tenant_id
  FROM fixture f
  JOIN emission_project_registry p ON p.project_id=f.project_id
  JOIN comtnemplyrinfo u ON lower(u.emplyr_id)=lower(f.account_id)
)
INSERT INTO framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
SELECT account_id,tenant_id,project_id,actor_code,project_id,'ACTIVE'
FROM scoped
ON CONFLICT(account_id,tenant_id,project_id,actor_code)
DO UPDATE SET data_scope=excluded.data_scope,assignment_status='ACTIVE',valid_until=null;

WITH assignment(task_code, account_id) AS (
  VALUES
    ('BASIC_INFO','qaowner26'),
    ('ACTIVITY_DATA','qadata26'),
    ('CALCULATION','qacalc26'),
    ('VERIFICATION','qaverify26'),
    ('APPROVAL','qaapprove26'),
    ('REPORT','qaowner26'),
    ('REGULATORY_SUBMISSION','qaowner26')
)
UPDATE emission_project_task t
SET assignee_id=a.account_id,updated_at=current_timestamp
FROM assignment a
WHERE t.project_id='PRJ-2026-001' AND t.task_code=a.task_code;

