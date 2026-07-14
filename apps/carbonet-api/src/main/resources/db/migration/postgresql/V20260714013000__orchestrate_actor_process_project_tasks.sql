ALTER TABLE emission_project_task
 ADD COLUMN IF NOT EXISTS process_code varchar(80),
 ADD COLUMN IF NOT EXISTS process_step_code varchar(80),
 ADD COLUMN IF NOT EXISTS actor_code varchar(60),
 ADD COLUMN IF NOT EXISTS predecessor_codes text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS completion_rule text,
 ADD COLUMN IF NOT EXISTS blocked_reason varchar(500),
 ADD COLUMN IF NOT EXISTS started_at timestamp,
 ADD COLUMN IF NOT EXISTS completed_at timestamp,
 ADD COLUMN IF NOT EXISTS completed_by varchar(100);

UPDATE emission_project_task SET
 process_code='EMISSION_PROJECT',
 process_step_code=CASE task_code
   WHEN 'BASIC_INFO' THEN 'EMISSION_PROJECT_SETUP'
   WHEN 'ACTIVITY_DATA' THEN 'EMISSION_PROJECT_COLLECT'
   WHEN 'CALCULATION' THEN 'EMISSION_PROJECT_CALCULATE'
   WHEN 'VERIFICATION' THEN 'EMISSION_PROJECT_VALIDATE'
   WHEN 'APPROVAL' THEN 'EMISSION_PROJECT_APPROVE'
   WHEN 'REPORT' THEN 'EMISSION_PROJECT_REPORT' END,
 actor_code=CASE task_code
   WHEN 'BASIC_INFO' THEN 'COMPANY_MANAGER'
   WHEN 'ACTIVITY_DATA' THEN 'SITE_DATA_OWNER'
   WHEN 'CALCULATION' THEN 'CALCULATOR'
   WHEN 'VERIFICATION' THEN 'VERIFIER'
   WHEN 'APPROVAL' THEN 'APPROVER'
   WHEN 'REPORT' THEN 'COMPANY_MANAGER' END,
 predecessor_codes=CASE task_code
   WHEN 'ACTIVITY_DATA' THEN 'BASIC_INFO'
   WHEN 'CALCULATION' THEN 'ACTIVITY_DATA'
   WHEN 'VERIFICATION' THEN 'CALCULATION'
   WHEN 'APPROVAL' THEN 'VERIFICATION'
   WHEN 'REPORT' THEN 'APPROVAL' ELSE '' END,
 completion_rule=CASE task_code
   WHEN 'BASIC_INFO' THEN '프로젝트 기본정보와 산정기간이 확정됨'
   WHEN 'ACTIVITY_DATA' THEN '품질검사를 통과한 활동자료가 제출됨'
   WHEN 'CALCULATION' THEN '배출량 산정 버전이 생성됨'
   WHEN 'VERIFICATION' THEN '검증 오류가 없고 검증 이력이 생성됨'
   WHEN 'APPROVAL' THEN '권한 있는 승인자가 결과를 승인함'
   WHEN 'REPORT' THEN '확정 결과 보고서가 발행됨' END
WHERE task_code IN ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT');

UPDATE emission_project_task t SET task_status='DONE',completed_at=coalesce(completed_at,created_at),completed_by=coalesce(completed_by,p.owner_name)
FROM emission_project_registry p
WHERE t.project_id=p.project_id AND t.task_code='BASIC_INFO'
  AND p.project_name<>'' AND p.site_name<>'' AND p.period_start IS NOT NULL AND p.period_end IS NOT NULL;

UPDATE emission_project_task t SET task_status='READY',blocked_reason=null
WHERE t.task_code='ACTIVITY_DATA' AND t.task_status IN ('WAITING','IN_PROGRESS')
  AND EXISTS (SELECT 1 FROM emission_project_task p WHERE p.project_id=t.project_id AND p.task_code='BASIC_INFO' AND p.task_status='DONE');

UPDATE emission_project_task t SET task_status='BLOCKED',blocked_reason='선행 업무가 완료되지 않았습니다.'
WHERE t.task_status='WAITING' AND t.predecessor_codes<>'';

CREATE INDEX IF NOT EXISTS ix_emission_project_task_actor_queue
 ON emission_project_task(actor_code,task_status,due_date,priority);
CREATE INDEX IF NOT EXISTS ix_emission_project_task_process
 ON emission_project_task(project_id,process_code,step_order);

CREATE TABLE IF NOT EXISTS framework_project_actor_assignment (
 assignment_id bigserial PRIMARY KEY,
 project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
 actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
 user_id varchar(100) NOT NULL,
 active_yn char(1) NOT NULL DEFAULT 'Y' CHECK(active_yn IN ('Y','N')),
 assigned_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(project_id,actor_code,user_id)
);

INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id)
SELECT p.project_id,a.actor_code,p.owner_name
FROM emission_project_registry p
CROSS JOIN (VALUES('COMPANY_MANAGER'),('SITE_DATA_OWNER'),('CALCULATOR')) a(actor_code)
WHERE p.owner_name IS NOT NULL AND p.owner_name<>''
ON CONFLICT DO NOTHING;

COMMENT ON TABLE framework_project_actor_assignment IS '프로젝트별 사용자-액터 실행 권한 연결';
COMMENT ON COLUMN emission_project_task.predecessor_codes IS '쉼표로 구분한 선행 task_code';
