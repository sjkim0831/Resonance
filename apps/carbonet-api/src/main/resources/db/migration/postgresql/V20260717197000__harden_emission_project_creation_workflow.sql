ALTER TABLE emission_project_registry
  ADD COLUMN IF NOT EXISTS creation_request_id varchar(100),
  ADD COLUMN IF NOT EXISTS workflow_version varchar(30) NOT NULL DEFAULT 'EMISSION_PROJECT_V1',
  ADD COLUMN IF NOT EXISTS workflow_initialized_at timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS uq_emission_project_creation_request
  ON emission_project_registry(tenant_id, creation_request_id)
  WHERE creation_request_id IS NOT NULL;

UPDATE emission_project_registry SET workflow_initialized_at=coalesce(workflow_initialized_at,created_at)
WHERE workflow_initialized_at IS NULL;

UPDATE emission_project_task task SET due_date=CASE task.step_order
  WHEN 1 THEN least(project.due_date,current_date)
  WHEN 6 THEN project.due_date
  ELSE least(project.due_date,current_date+greatest(1,ceil((project.due_date-current_date)*task.step_order/6.0)::integer))
END,updated_at=current_timestamp
FROM emission_project_registry project
WHERE project.project_id=task.project_id AND project.due_date IS NOT NULL AND task.task_status<>'DONE';

CREATE OR REPLACE VIEW emission_project_workflow_health AS
SELECT project.project_id,project.tenant_id,project.project_name,
 count(task.task_id) task_count,count(DISTINCT task.task_code) task_code_count,
 count(*) FILTER(WHERE task.actor_code IS NULL OR trim(task.actor_code)='') missing_actor_count,
 count(*) FILTER(WHERE task.target_url IS NULL OR trim(task.target_url)='' OR task.target_url='#') missing_route_count,
 count(*) FILTER(WHERE task.completion_rule IS NULL OR trim(task.completion_rule)='') missing_rule_count,
 count(*) FILTER(WHERE task.task_code<>'BASIC_INFO' AND (task.predecessor_codes IS NULL OR trim(task.predecessor_codes)='')) missing_predecessor_count,
 (SELECT count(DISTINCT assignment.actor_code) FROM framework_project_actor_assignment assignment WHERE assignment.project_id=project.project_id AND assignment.active_yn='Y') actor_assignment_count,
 bool_and(task.due_date IS NULL OR task.due_date<=project.due_date) deadlines_valid,
 CASE WHEN count(task.task_id)=6 AND count(DISTINCT task.task_code)=6
  AND count(*) FILTER(WHERE task.actor_code IS NULL OR trim(task.actor_code)='')=0
  AND count(*) FILTER(WHERE task.target_url IS NULL OR trim(task.target_url)='' OR task.target_url='#')=0
  AND count(*) FILTER(WHERE task.completion_rule IS NULL OR trim(task.completion_rule)='')=0
  AND count(*) FILTER(WHERE task.task_code<>'BASIC_INFO' AND (task.predecessor_codes IS NULL OR trim(task.predecessor_codes)=''))=0
  AND (SELECT count(DISTINCT assignment.actor_code) FROM framework_project_actor_assignment assignment WHERE assignment.project_id=project.project_id AND assignment.active_yn='Y')>=5
  AND bool_and(task.due_date IS NULL OR task.due_date<=project.due_date)
 THEN 'READY' ELSE 'REPAIR_REQUIRED' END workflow_health
FROM emission_project_registry project LEFT JOIN emission_project_task task ON task.project_id=project.project_id
GROUP BY project.project_id,project.tenant_id,project.project_name;

CREATE INDEX IF NOT EXISTS ix_emission_project_task_next_action
 ON emission_project_task(project_id,task_status,step_order,due_date)
 WHERE task_status IN ('READY','IN_PROGRESS','BLOCKED','WAITING');
