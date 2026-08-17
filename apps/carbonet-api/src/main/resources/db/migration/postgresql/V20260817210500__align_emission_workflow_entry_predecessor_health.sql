-- A first step is allowed to omit a task predecessor only when the process
-- catalogue declares the process as an ENTRY with no prerequisite process.
-- Every other blank predecessor, and every nonblank dangling task reference,
-- remains a workflow-health failure.
SET lock_timeout='5s';
SET statement_timeout='30s';

CREATE OR REPLACE VIEW emission_project_workflow_health AS
WITH task_contract AS (
  SELECT task.*,
         CASE
           WHEN task.task_code='BASIC_INFO' THEN true
           WHEN sequence.process_role='ENTRY'
             AND nullif(btrim(coalesce(sequence.prerequisite_process_codes,'')),'') IS NULL
             AND step.step_order=(
               SELECT min(first_step.step_order)
               FROM framework_process_step first_step
               WHERE first_step.process_code=task.process_code
             )
           THEN true
           ELSE false
         END AS valid_predecessor_root,
         CASE
           WHEN nullif(btrim(task.predecessor_codes),'') IS NULL THEN false
           ELSE EXISTS (
             SELECT 1
             FROM unnest(string_to_array(task.predecessor_codes,',')) predecessor(task_code)
             WHERE nullif(btrim(predecessor.task_code),'') IS NULL
                OR NOT EXISTS (
                  SELECT 1
                  FROM emission_project_task parent
                  WHERE parent.project_id=task.project_id
                    AND parent.task_code=btrim(predecessor.task_code)
                )
           )
         END AS dangling_predecessor
  FROM emission_project_task task
  LEFT JOIN framework_process_step step
    ON step.process_code=task.process_code
   AND step.step_code=task.process_step_code
  LEFT JOIN framework_business_process_sequence sequence
    ON sequence.process_code=task.process_code
   AND sequence.sequence_status='ACTIVE'
)
SELECT project.project_id,project.tenant_id,project.project_name,
 count(task.task_id) task_count,
 count(DISTINCT task.task_code) task_code_count,
 count(*) FILTER(WHERE task.actor_code IS NULL OR trim(task.actor_code)='') missing_actor_count,
 count(*) FILTER(WHERE task.target_url IS NULL OR trim(task.target_url)='' OR task.target_url='#') missing_route_count,
 count(*) FILTER(WHERE task.completion_rule IS NULL OR trim(task.completion_rule)='') missing_rule_count,
 count(*) FILTER(WHERE task.task_id IS NOT NULL AND (
   (nullif(btrim(task.predecessor_codes),'') IS NULL AND NOT task.valid_predecessor_root)
   OR task.dangling_predecessor
 )) missing_predecessor_count,
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
   AND count(*) FILTER(WHERE task.task_id IS NOT NULL AND (
     (nullif(btrim(task.predecessor_codes),'') IS NULL AND NOT task.valid_predecessor_root)
     OR task.dangling_predecessor
   ))=0
   AND (SELECT count(DISTINCT assignment.actor_code)
          FROM framework_project_actor_assignment assignment
         WHERE assignment.project_id=project.project_id AND assignment.active_yn='Y')>=5
   AND bool_and(task.due_date IS NULL OR task.due_date<=project.due_date)
 THEN 'READY' ELSE 'REPAIR_REQUIRED' END workflow_health
FROM emission_project_registry project
LEFT JOIN task_contract task ON task.project_id=project.project_id
GROUP BY project.project_id,project.tenant_id,project.project_name;

COMMENT ON VIEW emission_project_workflow_health IS
  '핵심 7단계와 확장 전문 프로세스의 계약 기반 액터·경로·완료규칙·선행단계·기한 정합성 상태';

RESET statement_timeout;
RESET lock_timeout;
