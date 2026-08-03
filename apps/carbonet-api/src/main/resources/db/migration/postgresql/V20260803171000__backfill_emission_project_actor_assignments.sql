-- Existing projects predate account-aware workflow creation. Backfill the five
-- executable business actors so deployment validation and the guide use the
-- same assignment source. Prefer an active tenant account; retain the project
-- owner only as a legacy fallback so old projects remain operable.
WITH required(actor_code) AS (
  VALUES ('COMPANY_MANAGER'),('SITE_DATA_OWNER'),('CALCULATOR'),('VERIFIER'),('APPROVER')
), resolved AS (
  SELECT p.project_id,r.actor_code,
    coalesce(
      (SELECT a.account_id
       FROM framework_account_actor_assignment a
       WHERE a.tenant_id=p.tenant_id
         AND a.actor_code=r.actor_code
         AND a.assignment_status='ACTIVE'
         AND (a.valid_from IS NULL OR a.valid_from<=current_date)
         AND (a.valid_until IS NULL OR a.valid_until>=current_date)
       ORDER BY CASE WHEN a.project_id=p.project_id THEN 0 WHEN a.project_id='*' THEN 1 ELSE 2 END,a.account_id
       LIMIT 1),
      nullif(trim(p.owner_name),'')
    ) user_id
  FROM emission_project_registry p CROSS JOIN required r
)
INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id,active_yn)
SELECT project_id,actor_code,user_id,'Y'
FROM resolved WHERE user_id IS NOT NULL
ON CONFLICT(project_id,actor_code,user_id) DO UPDATE SET active_yn='Y';

UPDATE emission_project_task task SET
  assignee_id=(SELECT a.user_id
    FROM framework_project_actor_assignment a
    WHERE a.project_id=task.project_id AND a.actor_code=task.actor_code AND a.active_yn='Y'
    ORDER BY a.assigned_at DESC,a.assignment_id LIMIT 1),
  updated_at=current_timestamp
WHERE coalesce(trim(task.assignee_id),'')=''
  AND EXISTS (SELECT 1 FROM framework_project_actor_assignment a
    WHERE a.project_id=task.project_id AND a.actor_code=task.actor_code AND a.active_yn='Y');

DO $$
DECLARE broken_count integer;
BEGIN
  SELECT count(*) INTO broken_count
  FROM emission_project_workflow_health
  WHERE workflow_health<>'READY';
  IF broken_count>0 THEN
    RAISE EXCEPTION 'EMISSION_PROJECT_ACTOR_BACKFILL_INCOMPLETE: % project(s)',broken_count;
  END IF;
END $$;
