-- Identity synchronization suspends actor grants that are not owned by the
-- account's authoritative role. Use the dedicated QA accounts for every actor
-- in the isolated governance runtime fixture.
WITH fixture(account_id,actor_code) AS (
  VALUES
    ('qaowner26','PLATFORM_OPERATOR'),
    ('qaverify26','VERIFIER'),
    ('qaapprove26','APPROVER')
)
INSERT INTO framework_account_actor_assignment(
 account_id,tenant_id,project_id,actor_code,data_scope,assignment_status,valid_from,valid_until
)
SELECT account_id,'DEFAULT','RUNTIME-SMOKE-GOVERNANCE',actor_code,
       'RUNTIME-SMOKE-GOVERNANCE','ACTIVE',current_date,null
FROM fixture
ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET
 assignment_status='ACTIVE',data_scope=excluded.data_scope,valid_until=null;

UPDATE framework_account_actor_assignment
SET assignment_status='SUSPENDED',valid_until=current_date
WHERE account_id='webmaster' AND tenant_id='DEFAULT'
  AND project_id='RUNTIME-SMOKE-GOVERNANCE'
  AND actor_code IN ('VERIFIER','APPROVER');
