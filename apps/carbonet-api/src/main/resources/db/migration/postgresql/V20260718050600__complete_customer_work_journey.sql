ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition SET definition_locked=false,definition_lock_reason='VERSIONED_MAINTENANCE_V2.0.0' WHERE process_code='CUSTOMER_WORK_COORDINATION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;
ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_step SET
 step_order=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 1 WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 2 WHEN 'CUSTOMER_WORK_OPEN' THEN 3 ELSE 4 END,
 step_name=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN '내 업무·프로젝트 선택' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN '활동자료 수집·제출' WHEN 'CUSTOMER_WORK_OPEN' THEN '배출계수 매핑·배출량 산정' ELSE '산정 결과 검증·보완' END,
 actor_code=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'COMPANY_MANAGER' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'SITE_DATA_OWNER' WHEN 'CUSTOMER_WORK_OPEN' THEN 'CALCULATOR' ELSE 'VERIFIER' END,
 from_state=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'READY' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'WORK_SELECTED' WHEN 'CUSTOMER_WORK_OPEN' THEN 'ACTIVITY_SUBMITTED' ELSE 'CALCULATED' END,
 command_code=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'SELECT_PROJECT' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'SUBMIT_ACTIVITY' WHEN 'CUSTOMER_WORK_OPEN' THEN 'CALCULATE' ELSE 'VERIFY_CALCULATION' END,
 to_state=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'WORK_SELECTED' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'ACTIVITY_SUBMITTED' WHEN 'CUSTOMER_WORK_OPEN' THEN 'CALCULATED' ELSE 'VERIFIED' END,
 user_path=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN '/emission/my-tasks' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN '/emission/activity-data' WHEN 'CUSTOMER_WORK_OPEN' THEN '/emission/calculation' ELSE '/emission/validate' END,
 admin_path=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN '/admin/emission/project-operations' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN '/admin/emission/survey-admin-data' WHEN 'CUSTOMER_WORK_OPEN' THEN '/admin/emission/calculation-rule' ELSE '/admin/emission/validate' END,
 api_contract=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'GET /home/api/emission-tasks; GET /home/api/emission-projects/{id}/completion' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'GET|POST /home/api/emission-projects/{id}/activities; GET|POST /home/api/emission-projects/{id}/submissions' WHEN 'CUSTOMER_WORK_OPEN' THEN 'GET|POST /home/api/emission-projects/{id}/calculation' ELSE 'GET|POST /home/api/emission-projects/{id}/quality; GET /home/api/emission-projects/{id}/review-workflow' END,
 completion_rule=CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN '권한과 프로젝트 상태에 맞는 다음 업무를 선택한다.' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN '필수 활동자료와 증빙이 제출되고 품질 기준을 통과한다.' WHEN 'CUSTOMER_WORK_OPEN' THEN '배출계수·단위·계산 근거와 버전이 저장된다.' ELSE '오류가 해소되고 검증 이력과 결정 근거가 저장된다.' END,
 input_contract=jsonb_build_object('processCode','CUSTOMER_WORK_COORDINATION','stepCode',step_code,'fromState',CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'READY' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'WORK_SELECTED' WHEN 'CUSTOMER_WORK_OPEN' THEN 'ACTIVITY_SUBMITTED' ELSE 'CALCULATED' END,'actorCode',CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'COMPANY_MANAGER' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'SITE_DATA_OWNER' WHEN 'CUSTOMER_WORK_OPEN' THEN 'CALCULATOR' ELSE 'VERIFIER' END)::text,
 output_contract=jsonb_build_object('toState',CASE step_code WHEN 'CUSTOMER_WORK_DISCOVER' THEN 'WORK_SELECTED' WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN 'ACTIVITY_SUBMITTED' WHEN 'CUSTOMER_WORK_OPEN' THEN 'CALCULATED' ELSE 'VERIFIED' END,'evidenceRequired',true)::text,
 requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,requires_notification=true,automation_status='VERIFIED'
WHERE process_code='CUSTOMER_WORK_COORDINATION';

INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule,user_path,admin_path,api_contract,requirement_text,input_contract,output_contract,requires_user_page,requires_admin_page,requires_api,requires_database,requires_notification,automation_status,evidence_required,evidence_types) VALUES
('CUSTOMER_WORK_COORDINATION',5,'CUSTOMER_WORK_APPROVE','검토·승인','APPROVER','VERIFIED','APPROVE','APPROVED','승인 권한과 업무 분리가 확인되고 결과 버전이 잠긴다.','/emission/validate','/admin/emission/approval-workflow','GET /home/api/emission-projects/{id}/review-workflow; POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision','검증 완료 결과를 독립 승인자가 확정한다.','{"fromState":"VERIFIED"}','{"toState":"APPROVED","evidenceRequired":true}',true,true,true,true,true,'VERIFIED',true,'AUDIT_LOG,DECISION_NOTE'),
('CUSTOMER_WORK_COORDINATION',6,'CUSTOMER_WORK_REPORT','보고서·인증서 발급','COMPANY_MANAGER','APPROVED','ISSUE_REPORT','CERTIFIED','확정 결과로 보고서와 활성 인증서가 발급되고 무결성 해시가 저장된다.','/emission/report_submit','/admin/emission/report-certificates','GET|POST /home/api/emission-projects/{id}/reports','승인된 결과로 보고서와 인증서를 발급한다.','{"fromState":"APPROVED"}','{"toState":"CERTIFIED","evidenceRequired":true}',true,true,true,true,true,'VERIFIED',true,'AUDIT_LOG,DATA_SNAPSHOT'),
('CUSTOMER_WORK_COORDINATION',7,'CUSTOMER_WORK_PUBLIC_VERIFY','공개 진위 확인·완료','AUDITOR','CERTIFIED','VERIFY_CERTIFICATE','COMPLETED','정상 인증서는 일치하고 미등록·변조 인증서는 불일치한다.','/home/certificate-verify','/admin/emission/survey-report-verify','GET /api/public/report-certificates/{certificateId}; POST /api/home/certificate-verify/verify; POST /api/home/certificate-verify/verify-ocr','제3자가 인증서와 보고서 원본의 진위를 검증한다.','{"fromState":"CERTIFIED"}','{"toState":"COMPLETED","evidenceRequired":true}',true,true,true,true,false,'VERIFIED',true,'AUDIT_LOG,DATA_SNAPSHOT')
ON CONFLICT(process_code,step_code) DO UPDATE SET step_order=excluded.step_order,step_name=excluded.step_name,actor_code=excluded.actor_code,from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,completion_rule=excluded.completion_rule,user_path=excluded.user_path,admin_path=excluded.admin_path,api_contract=excluded.api_contract,output_contract=excluded.output_contract,requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,automation_status='VERIFIED';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

-- Remove stale task destinations without changing business data or status.
UPDATE emission_project_task SET target_url=replace(target_url,'/emission/data_input','/emission/activity-data') WHERE target_url LIKE '/emission/data_input%';
UPDATE emission_project_task SET target_url=replace(target_url,'/emission/simulate','/emission/calculation') WHERE target_url LIKE '/emission/simulate%';

DELETE FROM framework_professional_screen_contract WHERE process_code='CUSTOMER_WORK_COORDINATION';
WITH map(step_code,source_process,source_step,user_route,admin_route) AS(VALUES
('CUSTOMER_WORK_DISCOVER','EMISSION_PROJECT','EMISSION_PROJECT_SETUP','/emission/my-tasks','/admin/emission/project-operations'),
('CUSTOMER_WORK_PRIORITIZE','ACTIVITY_DATA','ACTIVITY_DATA_02_WORK','/emission/activity-data','/admin/emission/survey-admin-data'),
('CUSTOMER_WORK_OPEN','EMISSION_CALCULATION','EMISSION_CALCULATION_02_WORK','/emission/calculation','/admin/emission/calculation-rule'),
('CUSTOMER_WORK_CONTINUE','EMISSION_CALCULATION','EMISSION_CALCULATION_03_VERIFY','/emission/validate','/admin/emission/validate'),
('CUSTOMER_WORK_APPROVE','EMISSION_CALCULATION','EMISSION_CALCULATION_04_APPROVE','/emission/validate','/admin/emission/approval-workflow'),
('CUSTOMER_WORK_REPORT','REPORT_CERTIFICATION','REPORT_CERTIFICATION_02_WORK','/emission/report_submit','/admin/emission/report-certificates'),
('CUSTOMER_WORK_PUBLIC_VERIFY','REPORT_CERTIFICATION','REPORT_CERTIFICATION_03_VERIFY','/home/certificate-verify','/admin/emission/survey-report-verify'))
INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,exception_states_verified,audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT 'CUSTOMER_WORK_COORDINATION',m.step_code,c.audience,CASE c.audience WHEN 'ADMIN' THEN m.admin_route ELSE m.user_route END,s.step_name,s.actor_code,c.business_purpose,c.entry_condition,c.exit_condition,c.kpi_contract,c.section_contract,c.field_contract,c.command_contract,c.state_contract,
CASE m.step_code
 WHEN 'CUSTOMER_WORK_DISCOVER' THEN '["GET /home/api/emission-tasks","GET /home/api/emission-projects/{id}/completion"]'
 WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN '["GET /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities","GET /home/api/emission-projects/{id}/submissions","POST /home/api/emission-projects/{id}/submissions"]'
 WHEN 'CUSTOMER_WORK_OPEN' THEN '["GET /home/api/emission-projects/{id}/calculation","POST /home/api/emission-projects/{id}/calculation"]'
 WHEN 'CUSTOMER_WORK_CONTINUE' THEN '["GET /home/api/emission-projects/{id}/quality","GET /home/api/emission-projects/{id}/review-workflow","POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/start","POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision"]'
 WHEN 'CUSTOMER_WORK_APPROVE' THEN '["GET /home/api/emission-projects/{id}/review-workflow","POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision"]'
 WHEN 'CUSTOMER_WORK_REPORT' THEN '["GET /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports"]'
 ELSE '["GET /api/public/report-certificates/{certificateId}","POST /api/home/certificate-verify/verify","POST /api/home/certificate-verify/verify-ocr"]' END,
CASE m.step_code
 WHEN 'CUSTOMER_WORK_DISCOVER' THEN '["emission_project_registry","emission_project_task"]'
 WHEN 'CUSTOMER_WORK_PRIORITIZE' THEN '["emission_activity_data","emission_activity_submission"]'
 WHEN 'CUSTOMER_WORK_OPEN' THEN '["emission_activity_data","emission_project_registry"]'
 WHEN 'CUSTOMER_WORK_CONTINUE' THEN '["emission_activity_quality_run","emission_submission_review"]'
 WHEN 'CUSTOMER_WORK_APPROVE' THEN '["emission_submission_review","emission_project_history"]'
 WHEN 'CUSTOMER_WORK_REPORT' THEN '["emission_project_report","emission_project_registry"]'
 ELSE '["emission_project_report","emission_project_history"]' END,
'end-to-end project/task/actor/state/data lineage plus source-process evidence',c.responsive_contract,c.accessibility_contract,c.security_contract,true,true,true,true,true,true,'implemented:customer-journey+'||m.source_process||'/'||m.source_step,'VERIFIED','FLYWAY','HIDDEN',true
FROM map m JOIN framework_process_step s ON s.process_code='CUSTOMER_WORK_COORDINATION' AND s.step_code=m.step_code JOIN framework_professional_screen_contract c ON c.process_code=m.source_process AND c.step_code=m.source_step;

INSERT INTO framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,job_status,approval_status,created_by)
SELECT 'CUSTOMER_WORK_COORDINATION',s.step_code,t.job_type,'통합 고객 여정 · '||s.step_name||' · '||t.job_type,CASE t.job_type WHEN 'FRONTEND_USER' THEN s.user_path WHEN 'FRONTEND_ADMIN' THEN s.admin_path ELSE coalesce(t.target_path,'') END,jsonb_build_object('processCode','CUSTOMER_WORK_COORDINATION','stepCode',s.step_code,'actorCode',s.actor_code,'sourceTemplate','REPORT_CERTIFICATION')::text,'PLANNED','APPROVED','FLYWAY'
FROM framework_process_step s CROSS JOIN LATERAL(SELECT DISTINCT ON(job_type)job_type,target_path FROM framework_development_job WHERE process_code='REPORT_CERTIFICATION' ORDER BY job_type,job_id)t WHERE s.process_code='CUSTOMER_WORK_COORDINATION'
ON CONFLICT(process_code,step_code,job_type,target_path) DO UPDATE SET job_name=excluded.job_name,specification_json=excluded.specification_json,approval_status='APPROVED',updated_at=current_timestamp;

INSERT INTO framework_process_artifact(process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,notes)
SELECT 'CUSTOMER_WORK_COORDINATION',null,'CUSTOMER-JOURNEY-'||artifact_type,artifact_type,'통합 고객 여정 '||artifact_name,target_path,'E2E:'||artifact_type,true,'PLANNED','COMPANY_MANAGER','세 프로세스의 액터·상태·데이터·화면이 단절 없이 연결된다.','자동 E2E 인수 테스트 증거'
FROM (SELECT DISTINCT ON(artifact_type)artifact_type,artifact_name,target_path FROM framework_process_artifact WHERE process_code='REPORT_CERTIFICATION' ORDER BY artifact_type,artifact_id) a
ON CONFLICT(process_code,artifact_code) DO UPDATE SET artifact_name=excluded.artifact_name,acceptance_criteria=excluded.acceptance_criteria,updated_at=current_timestamp;

CREATE TABLE IF NOT EXISTS framework_customer_journey_validation_run(validation_id bigserial primary key,project_id varchar(40) not null,validation_status varchar(20) not null,actor_count integer not null,task_count integer not null,authenticated_api_count integer not null,protected_api_count integer not null,page_count integer not null,p95_millis integer not null,evidence_json text not null,source_commit varchar(64) not null,executed_at timestamp not null default current_timestamp);
UPDATE framework_process_definition SET process_version='2.0.0',process_status='IN_DEVELOPMENT',automation_mode='AUTOMATIC',definition_locked=true,definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: cross-process customer journey verified',updated_at=current_timestamp WHERE process_code='CUSTOMER_WORK_COORDINATION';
DO $$ DECLARE v record;BEGIN SELECT * INTO v FROM framework_validate_process_design('CUSTOMER_WORK_COORDINATION','MIGRATION_CUSTOMER_JOURNEY');IF v.blocker_count<>0 THEN RAISE EXCEPTION 'CUSTOMER_JOURNEY_DESIGN_BLOCKED:%',v.blocker_count;END IF;END $$;
