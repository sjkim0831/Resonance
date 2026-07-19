UPDATE emission_project_task task
SET due_date=project.due_date,updated_at=current_timestamp
FROM emission_project_registry project
WHERE task.project_id=project.project_id AND task.task_code='REGULATORY_SUBMISSION';

CREATE OR REPLACE VIEW emission_project_workflow_health AS
SELECT project.project_id,project.tenant_id,project.project_name,
 count(task.task_id) task_count,count(DISTINCT task.task_code) task_code_count,
 count(*) FILTER(WHERE task.actor_code IS NULL OR trim(task.actor_code)='') missing_actor_count,
 count(*) FILTER(WHERE task.target_url IS NULL OR trim(task.target_url)='' OR task.target_url='#') missing_route_count,
 count(*) FILTER(WHERE task.completion_rule IS NULL OR trim(task.completion_rule)='') missing_rule_count,
 count(*) FILTER(WHERE task.task_code<>'BASIC_INFO' AND (task.predecessor_codes IS NULL OR trim(task.predecessor_codes)='')) missing_predecessor_count,
 (SELECT count(DISTINCT assignment.actor_code) FROM framework_project_actor_assignment assignment WHERE assignment.project_id=project.project_id AND assignment.active_yn='Y') actor_assignment_count,
 bool_and(task.due_date IS NULL OR task.due_date<=project.due_date) deadlines_valid,
 CASE WHEN count(task.task_id)=7 AND count(DISTINCT task.task_code)=7
  AND count(*) FILTER(WHERE task.actor_code IS NULL OR trim(task.actor_code)='')=0
  AND count(*) FILTER(WHERE task.target_url IS NULL OR trim(task.target_url)='' OR task.target_url='#')=0
  AND count(*) FILTER(WHERE task.completion_rule IS NULL OR trim(task.completion_rule)='')=0
  AND count(*) FILTER(WHERE task.task_code<>'BASIC_INFO' AND (task.predecessor_codes IS NULL OR trim(task.predecessor_codes)=''))=0
  AND (SELECT count(DISTINCT assignment.actor_code) FROM framework_project_actor_assignment assignment WHERE assignment.project_id=project.project_id AND assignment.active_yn='Y')>=5
  AND bool_and(task.due_date IS NULL OR task.due_date<=project.due_date)
 THEN 'READY' ELSE 'REPAIR_REQUIRED' END workflow_health
FROM emission_project_registry project LEFT JOIN emission_project_task task ON task.project_id=project.project_id
GROUP BY project.project_id,project.tenant_id,project.project_name;

COMMENT ON VIEW emission_project_workflow_health IS '7단계 배출량 프로젝트 업무의 액터·경로·완료규칙·선행단계·기한 정합성 상태';
