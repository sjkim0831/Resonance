CREATE TABLE IF NOT EXISTS framework_work_assignment_audit (
  audit_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(100) NOT NULL,
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  actor_code varchar(60) NOT NULL,
  account_id varchar(100) NOT NULL,
  assigned_by varchar(100) NOT NULL,
  assigned_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_work_assignment_audit_context
  ON framework_work_assignment_audit(tenant_id,project_id,process_code,assigned_at DESC);

INSERT INTO framework_actor_definition(
  actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
  delegation_allowed,use_at,responsibility_text,accountability_text,
  competency_requirements,conflict_actor_codes,max_concurrent_assignments,review_cycle_days
) VALUES (
  'WORK_ASSIGNMENT_MANAGER','업무 배정 담당자','Work Assignment Manager','BUSINESS',
  '소속 기업의 프로젝트 프로세스와 단계별 담당 계정을 배정·재배정하고 인계 상태를 관리한다.',
  'PROJECT_VIEW,PROCESS_VIEW,ACCOUNT_VIEW,WORK_ASSIGN,WORK_REASSIGN,ASSIGNMENT_AUDIT',
  true,'Y','기업 내 계정·액터·프로세스·단계의 적합성을 확인하고 담당자를 지정한다.',
  '테넌트 격리, 직무분리, 배정 누락과 중복을 방지하고 변경 이력을 보존한다.',
  '조직·프로젝트·액터 권한 및 업무 프로세스 이해','APPROVER,VERIFIER',0,90
) ON CONFLICT(actor_code) DO UPDATE SET
  actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,
  purpose=excluded.purpose,capability_codes=excluded.capability_codes,use_at='Y',
  responsibility_text=excluded.responsibility_text,accountability_text=excluded.accountability_text,
  competency_requirements=excluded.competency_requirements,updated_at=current_timestamp;

UPDATE framework_account_actor_assignment
SET assignment_status='INACTIVE'
WHERE account_id='qaassign26' AND tenant_id='TEST_COMPANY_001'
  AND project_id='*' AND actor_code='COMPANY_MANAGER';
INSERT INTO framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
VALUES('qaassign26','TEST_COMPANY_001','*','WORK_ASSIGNMENT_MANAGER','*','ACTIVE')
ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET
  data_scope='*',assignment_status='ACTIVE',valid_until=null;

INSERT INTO framework_process_definition(
  process_code,process_name,domain_code,process_version,goal,start_condition,
  completion_condition,process_status,development_order,owner_actor_code,
  risk_level,sla_hours,review_cycle_days,lifecycle_status,effective_from,definition_locked
) VALUES (
  'WORK_ASSIGNMENT','프로젝트 업무 배정','EMISSION','1.0.0',
  '기업의 업무 종류·프로세스·액터·단계를 선택하고 적격한 소속 계정에 원자적으로 배정한다.',
  '활성 기업·프로젝트·계정과 업무 배정 담당자 권한이 존재한다.',
  '모든 선택 단계에 담당 계정이 저장되고 계정별 업무 길잡이·알림·감사 이력에서 확인된다.',
  'ACTIVE',5,'WORK_ASSIGNMENT_MANAGER','HIGH',4,90,'ACTIVE',current_date,false
) ON CONFLICT(process_code) DO UPDATE SET
  process_name=excluded.process_name,goal=excluded.goal,start_condition=excluded.start_condition,
  completion_condition=excluded.completion_condition,process_status='ACTIVE',
  owner_actor_code='WORK_ASSIGNMENT_MANAGER',updated_at=current_timestamp;

INSERT INTO framework_process_step(
  process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
  completion_rule,user_path,api_contract,step_type,requirement_text,input_contract,
  output_contract,requires_user_page,requires_api,requires_database,requires_notification,
  automation_status,evidence_required
) VALUES
('WORK_ASSIGNMENT',1,'WORK_ASSIGNMENT_CONTEXT','업무 종류·프로젝트 선택','WORK_ASSIGNMENT_MANAGER','READY','SELECT_ASSIGNMENT_CONTEXT','CONTEXT_SELECTED','업무 종류, 프로젝트와 프로세스가 선택됨','/emission/project-portfolio?assignment=1','/home/api/work-assignments','FORM','담당자가 소속 기업 범위에서 프로젝트와 프로세스를 선택한다.','{"required":["tenantId","projectId","processCode"]}','{"produces":["assignmentContext"]}',true,true,true,false,'IMPLEMENTED',false),
('WORK_ASSIGNMENT',2,'WORK_ASSIGNMENT_ACTOR','액터별 계정 배정','WORK_ASSIGNMENT_MANAGER','CONTEXT_SELECTED','ASSIGN_ACTOR_ACCOUNTS','ACTORS_ASSIGNED','필수 액터마다 적격한 기업 계정이 선택됨','/emission/project-portfolio?assignment=1','/home/api/work-assignments','FORM','프로세스의 액터별 기본 담당 계정을 지정한다.','{"required":["actorCode","accountId"]}','{"produces":["projectActorAssignments"]}',true,true,true,true,'IMPLEMENTED',true),
('WORK_ASSIGNMENT',3,'WORK_ASSIGNMENT_STEP','단계별 계정 배정','WORK_ASSIGNMENT_MANAGER','ACTORS_ASSIGNED','ASSIGN_STEP_ACCOUNTS','STEPS_ASSIGNED','모든 실행 단계에 담당 계정이 저장됨','/emission/project-portfolio?assignment=1','/home/api/work-assignments','FORM','액터 기본값을 적용하고 필요한 단계는 별도 계정으로 재배정한다.','{"required":["stepCode","actorCode","accountId"]}','{"produces":["taskAssignees","notifications"]}',true,true,true,true,'IMPLEMENTED',true),
('WORK_ASSIGNMENT',4,'WORK_ASSIGNMENT_CONFIRM','배정 확정·인계','WORK_ASSIGNMENT_MANAGER','STEPS_ASSIGNED','CONFIRM_ASSIGNMENTS','COMPLETED','계정별 업무 길잡이와 감사 이력에서 배정 결과가 확인됨','/emission/project-portfolio?assignment=1','/home/api/work-assignments','APPROVAL','배정 결과를 원자적으로 저장하고 담당자에게 알린다.','{"required":["assignments","assignedBy"]}','{"produces":["assignmentAudit","workflowNotifications"]}',true,true,true,true,'IMPLEMENTED',true)
ON CONFLICT(process_code,step_code) DO UPDATE SET
  step_name=excluded.step_name,actor_code=excluded.actor_code,from_state=excluded.from_state,
  command_code=excluded.command_code,to_state=excluded.to_state,
  completion_rule=excluded.completion_rule,user_path=excluded.user_path,
  api_contract=excluded.api_contract,requirement_text=excluded.requirement_text,
  input_contract=excluded.input_contract,output_contract=excluded.output_contract,
  automation_status='IMPLEMENTED';

INSERT INTO framework_business_process_sequence(
  work_type_code,process_code,workflow_order,workflow_phase,process_role,
  prerequisite_process_codes,next_process_code,sequence_status
) VALUES('EMISSION','WORK_ASSIGNMENT',5,'프로젝트 준비','SUPPORT','','EMISSION_PROJECT','ACTIVE')
ON CONFLICT(process_code) DO UPDATE SET
  workflow_order=excluded.workflow_order,workflow_phase=excluded.workflow_phase,
  process_role=excluded.process_role,sequence_status='ACTIVE',updated_at=current_timestamp;

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status)
VALUES
('WORK_ASSIGNMENT-HAPPY','WORK_ASSIGNMENT','기업 계정 단계 배정','HAPPY_PATH','업무 배정 담당자와 활성 프로젝트·계정 존재','["프로젝트 선택","액터 기본 계정 선택","단계별 계정 선택","저장"]','["단계 담당자 저장","계정 업무 노출","알림·감사 생성"]','APPROVED'),
('WORK_ASSIGNMENT-AUTH','WORK_ASSIGNMENT','비권한 배정 차단','AUTHORITY','일반 기업 계정 로그인','["배정 API 호출"]','["HTTP 403","DB 변경 0건"]','APPROVED'),
('WORK_ASSIGNMENT-ISOLATION','WORK_ASSIGNMENT','타 기업 계정 배정 차단','ISOLATION','다른 테넌트 계정 지정','["배정 저장"]','["TENANT_ACCOUNT_NOT_ELIGIBLE","DB 변경 0건"]','APPROVED'),
('WORK_ASSIGNMENT-VALIDATION','WORK_ASSIGNMENT','필수 배정 검증','VALIDATION','단계 또는 계정 누락','["배정 저장"]','["ASSIGNMENTS_REQUIRED","DB 변경 0건"]','APPROVED'),
('WORK_ASSIGNMENT-RECOVERY','WORK_ASSIGNMENT','재배정 복구','RECOVERY','기존 담당자 존재','["새 계정 재배정","구 계정 확인","신규 계정 확인"]','["구 배정 비활성","신규 배정 활성","감사 이력 보존"]','APPROVED')
ON CONFLICT(case_code) DO UPDATE SET steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status='APPROVED',updated_at=current_timestamp;
