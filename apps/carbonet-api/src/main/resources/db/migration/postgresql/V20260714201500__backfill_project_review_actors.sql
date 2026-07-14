-- Legacy emission projects predate explicit verifier and approver assignment.
-- Preserve their existing workflow by assigning the project owner only where a role is missing.
INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id)
SELECT p.project_id,roles.actor_code,p.owner_name
FROM emission_project_registry p
CROSS JOIN (VALUES ('VERIFIER'),('APPROVER')) roles(actor_code)
WHERE nullif(trim(p.owner_name),'') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM framework_project_actor_assignment current_assignment
    WHERE current_assignment.project_id=p.project_id
      AND current_assignment.actor_code=roles.actor_code
      AND current_assignment.active_yn='Y'
  )
ON CONFLICT DO NOTHING;

INSERT INTO framework_account_actor_assignment(
  account_id,tenant_id,project_id,actor_code,data_scope,assignment_status
)
SELECT assignment.user_id,p.tenant_id,p.project_id,assignment.actor_code,p.project_id,'ACTIVE'
FROM framework_project_actor_assignment assignment
JOIN emission_project_registry p ON p.project_id=assignment.project_id
WHERE assignment.active_yn='Y'
ON CONFLICT(account_id,tenant_id,project_id,actor_code)
DO UPDATE SET data_scope=excluded.data_scope,assignment_status='ACTIVE';

UPDATE emission_project_task task
SET assignee_id=(
      SELECT candidate.user_id
      FROM framework_project_actor_assignment candidate
      WHERE candidate.project_id=task.project_id
        AND candidate.actor_code=task.actor_code
        AND candidate.active_yn='Y'
      ORDER BY candidate.assigned_at
      LIMIT 1
    ),
    updated_at=current_timestamp
WHERE (task.assignee_id IS NULL OR trim(task.assignee_id)='')
  AND EXISTS (
    SELECT 1
    FROM framework_project_actor_assignment candidate
    WHERE candidate.project_id=task.project_id
      AND candidate.actor_code=task.actor_code
      AND candidate.active_yn='Y'
  );
