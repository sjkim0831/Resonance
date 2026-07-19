WITH primary_assignment AS (
    SELECT DISTINCT ON (candidate.project_id,candidate.actor_code)
           candidate.project_id,candidate.actor_code,candidate.user_id
    FROM framework_project_actor_assignment candidate
    WHERE candidate.active_yn='Y'
    ORDER BY candidate.project_id,candidate.actor_code,candidate.assigned_at DESC,candidate.assignment_id DESC
)
UPDATE emission_project_task task
SET assignee_id=assignment.user_id,updated_at=current_timestamp
FROM primary_assignment assignment
WHERE assignment.project_id=task.project_id
  AND assignment.actor_code=task.actor_code
  AND coalesce(task.assignee_id,'')<>assignment.user_id;

COMMENT ON COLUMN emission_project_task.assignee_id IS
    '프로젝트 액터 배정 API가 관리하는 단계별 주 담당 계정';
