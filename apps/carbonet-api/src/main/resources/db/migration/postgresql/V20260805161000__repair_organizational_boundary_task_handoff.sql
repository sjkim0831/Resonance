-- Close the handoff between the parent emission-project setup task and the
-- first specialized organizational-boundary task. This is intentionally
-- idempotent so every project created before or after the workflow split can
-- be repaired by the same migration.
UPDATE emission_project_task child
SET predecessor_codes = parent.task_code,
    updated_at = CURRENT_TIMESTAMP,
    blocked_reason = CASE
      WHEN child.task_status = 'BLOCKED' THEN '선행 업무 완료 후 자동 활성화'
      ELSE child.blocked_reason
    END
FROM emission_project_task parent
WHERE child.project_id = parent.project_id
  AND child.process_code = 'ORGANIZATIONAL_BOUNDARY'
  AND child.process_step_code = 'ORGANIZATIONAL_BOUNDARY_S1'
  AND (child.predecessor_codes IS NULL OR btrim(child.predecessor_codes) = '')
  AND parent.task_code = 'BASIC_INFO';

UPDATE emission_project_task child
SET task_status = 'READY',
    blocked_reason = NULL,
    updated_at = CURRENT_TIMESTAMP
FROM emission_project_task parent
WHERE child.project_id = parent.project_id
  AND child.process_code = 'ORGANIZATIONAL_BOUNDARY'
  AND child.process_step_code = 'ORGANIZATIONAL_BOUNDARY_S1'
  AND child.predecessor_codes = parent.task_code
  AND child.task_status = 'BLOCKED'
  AND parent.task_code = 'BASIC_INFO'
  AND parent.task_status = 'DONE';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM emission_project_task child
    WHERE child.process_code = 'ORGANIZATIONAL_BOUNDARY'
      AND child.process_step_code = 'ORGANIZATIONAL_BOUNDARY_S1'
      AND (child.predecessor_codes IS NULL OR btrim(child.predecessor_codes) = '')
      AND EXISTS (
        SELECT 1
        FROM emission_project_task parent
        WHERE parent.project_id = child.project_id
          AND parent.task_code = 'BASIC_INFO'
      )
  ) THEN
    RAISE EXCEPTION 'organizational-boundary first-step handoff remains incomplete';
  END IF;
END $$;

CREATE OR REPLACE VIEW emission_project_workflow_health AS
SELECT project.project_id, project.tenant_id, project.project_name,
 count(task.task_id) task_count,
 count(DISTINCT task.task_code) task_code_count,
 count(*) FILTER(WHERE task.actor_code IS NULL OR trim(task.actor_code)='') missing_actor_count,
 count(*) FILTER(WHERE task.target_url IS NULL OR trim(task.target_url)='' OR task.target_url='#') missing_route_count,
 count(*) FILTER(WHERE task.completion_rule IS NULL OR trim(task.completion_rule)='') missing_rule_count,
 count(*) FILTER(WHERE task.task_code<>'BASIC_INFO' AND (task.predecessor_codes IS NULL OR trim(task.predecessor_codes)='')) missing_predecessor_count,
 (SELECT count(DISTINCT assignment.actor_code)
    FROM framework_project_actor_assignment assignment
   WHERE assignment.project_id=project.project_id AND assignment.active_yn='Y') actor_assignment_count,
 bool_and(task.due_date IS NULL OR task.due_date<=project.due_date) deadlines_valid,
 CASE WHEN
   count(task.task_id) FILTER (WHERE task.task_code IN
     ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT','REGULATORY_SUBMISSION')) = 7
   AND count(DISTINCT task.task_code) FILTER (WHERE task.task_code IN
     ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT','REGULATORY_SUBMISSION')) = 7
   AND count(*) FILTER(WHERE task.actor_code IS NULL OR trim(task.actor_code)='')=0
   AND count(*) FILTER(WHERE task.target_url IS NULL OR trim(task.target_url)='' OR task.target_url='#')=0
   AND count(*) FILTER(WHERE task.completion_rule IS NULL OR trim(task.completion_rule)='')=0
   AND count(*) FILTER(WHERE task.task_code<>'BASIC_INFO' AND (task.predecessor_codes IS NULL OR trim(task.predecessor_codes)=''))=0
   AND (SELECT count(DISTINCT assignment.actor_code)
          FROM framework_project_actor_assignment assignment
         WHERE assignment.project_id=project.project_id AND assignment.active_yn='Y')>=5
   AND bool_and(task.due_date IS NULL OR task.due_date<=project.due_date)
 THEN 'READY' ELSE 'REPAIR_REQUIRED' END workflow_health
FROM emission_project_registry project
LEFT JOIN emission_project_task task ON task.project_id=project.project_id
GROUP BY project.project_id,project.tenant_id,project.project_name;

COMMENT ON VIEW emission_project_workflow_health IS
  '핵심 7단계와 확장 전문 프로세스의 액터·경로·완료규칙·선행단계·기한 정합성 상태';
