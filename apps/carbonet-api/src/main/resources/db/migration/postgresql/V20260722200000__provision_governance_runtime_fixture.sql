-- The governance runtime validator executes the complete six-step state machine
-- in a transaction that is always rolled back. Keep its accounts project-scoped
-- so production wildcard assignments are never used as test fixtures.
WITH fixture(account_id, actor_code) AS (
  VALUES
    ('qaowner26', 'PLATFORM_OPERATOR'),
    ('qaverify26', 'VERIFIER'),
    ('qaapprove26', 'APPROVER')
), scoped AS (
  SELECT f.account_id,
         f.actor_code,
         project.tenant_id,
         project.project_id
  FROM fixture f
  JOIN emission_project_registry project
    ON project.project_id = 'PRJ-2026-001'
  JOIN comtnemplyrinfo account
    ON lower(account.emplyr_id) = lower(f.account_id)
)
INSERT INTO framework_account_actor_assignment(
  account_id,
  tenant_id,
  project_id,
  actor_code,
  data_scope,
  assignment_status,
  valid_from,
  valid_until
)
SELECT account_id,
       tenant_id,
       project_id,
       actor_code,
       project_id,
       'ACTIVE',
       current_date,
       NULL
FROM scoped
ON CONFLICT(account_id, tenant_id, project_id, actor_code)
DO UPDATE SET
  data_scope = excluded.data_scope,
  assignment_status = 'ACTIVE',
  valid_from = least(framework_account_actor_assignment.valid_from, current_date),
  valid_until = NULL;

DO $$
DECLARE
  fixture_count integer;
BEGIN
  SELECT count(DISTINCT assignment.actor_code)
  INTO fixture_count
  FROM framework_account_actor_assignment assignment
  WHERE assignment.tenant_id = 'DEFAULT'
    AND assignment.project_id = 'PRJ-2026-001'
    AND assignment.assignment_status = 'ACTIVE'
    AND assignment.actor_code IN ('PLATFORM_OPERATOR', 'VERIFIER', 'APPROVER')
    AND (assignment.valid_from IS NULL OR assignment.valid_from <= current_date)
    AND (assignment.valid_until IS NULL OR assignment.valid_until >= current_date);

  IF fixture_count <> 3 THEN
    RAISE EXCEPTION
      'Governance runtime fixture is incomplete: expected 3 actors, found %',
      fixture_count;
  END IF;
END $$;
