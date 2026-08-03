-- Canonical actor journey for the Resonance test company. It intentionally
-- starts at activity collection so each account can exercise its own step.
INSERT INTO emission_project_registry(
 project_id,tenant_id,project_name,site_name,calculation_period,scope_name,
 owner_name,progress_percent,current_step,due_date,project_status,reporting_year,
 period_start,period_end,organization_boundary,emission_standard,
 methodology_version,verification_level,collection_cycle,materiality_threshold,settings_snapshot
)
SELECT 'PRJ-ACTOR-TEST','TEST_COMPANY_001','액터 분리 통합 테스트 프로젝트',
 coalesce((SELECT site_name FROM emission_site_registry WHERE tenant_id='TEST_COMPANY_001' AND site_status='ACTIVE' ORDER BY site_name LIMIT 1),'테스트 사업장'),
 '2026.01 ~ 2026.12','Scope 1·2·3','qaowner26',10,'활동자료 수집',current_date+30,'진행',2026,
 date '2026-01-01',date '2026-12-31','OPERATIONAL_CONTROL','GHG_PROTOCOL','2026.1','LIMITED','MONTHLY',5,
 jsonb_build_object('fixture','ACTOR_ACCOUNT_JOURNEY','companyId','TEST_COMPANY_001')
WHERE NOT EXISTS (SELECT 1 FROM emission_project_registry WHERE project_id='PRJ-ACTOR-TEST');

WITH task(task_code,task_name,step_order,task_status,progress_weight,process_code,step_code,actor_code,predecessor,rule,target) AS (
 VALUES
 ('BASIC_INFO','기본정보 확인',1,'DONE',10,'EMISSION_PROJECT','EMISSION_PROJECT_SETUP','COMPANY_MANAGER','','프로젝트 기본정보와 산정기간이 확정됨','/emission/project/detail?id=PRJ-ACTOR-TEST'),
 ('ACTIVITY_DATA','활동자료 수집',2,'READY',15,'EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','SITE_DATA_OWNER','BASIC_INFO','품질검사를 통과한 활동자료가 제출됨','/emission/activity-data?projectId=PRJ-ACTOR-TEST'),
 ('CALCULATION','배출량 산정',3,'BLOCKED',15,'EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE','CALCULATOR','ACTIVITY_DATA','배출량 산정 버전이 생성됨','/emission/calculation?projectId=PRJ-ACTOR-TEST'),
 ('VERIFICATION','데이터 검증',4,'BLOCKED',15,'EMISSION_PROJECT','EMISSION_PROJECT_VALIDATE','VERIFIER','CALCULATION','검증 오류가 없고 검증 이력이 생성됨','/emission/validate?projectId=PRJ-ACTOR-TEST'),
 ('APPROVAL','검토·승인',5,'BLOCKED',15,'EMISSION_PROJECT','EMISSION_PROJECT_APPROVE','APPROVER','VERIFICATION','권한 있는 승인자가 결과를 승인함','/emission/validate?tab=approval&projectId=PRJ-ACTOR-TEST'),
 ('REPORT','확정·보고',6,'BLOCKED',15,'EMISSION_PROJECT','EMISSION_PROJECT_REPORT','COMPANY_MANAGER','APPROVAL','확정 결과 보고서가 발행됨','/emission/report_submit?projectId=PRJ-ACTOR-TEST'),
 ('REGULATORY_SUBMISSION','규제기관 제출·접수',7,'BLOCKED',15,'REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S1','COMPANY_MANAGER','REPORT','제출 패키지와 접수번호가 보존되고 규제기관 수리가 완료됨','/emission/report-submission?projectId=PRJ-ACTOR-TEST')
)
INSERT INTO emission_project_task(project_id,task_code,task_name,step_order,task_status,progress_weight,due_date,process_code,process_step_code,actor_code,predecessor_codes,completion_rule,target_url,assignee_id,completed_at,completed_by)
SELECT 'PRJ-ACTOR-TEST',task_code,task_name,step_order,task_status,progress_weight,current_date+30,process_code,step_code,actor_code,predecessor,rule,target,
 CASE actor_code WHEN 'COMPANY_MANAGER' THEN 'qaowner26' WHEN 'SITE_DATA_OWNER' THEN 'qadata26' WHEN 'CALCULATOR' THEN 'qacalc26' WHEN 'VERIFIER' THEN 'qaverify26' WHEN 'APPROVER' THEN 'qaapprove26' END,
 CASE WHEN task_code='BASIC_INFO' THEN current_timestamp END,
 CASE WHEN task_code='BASIC_INFO' THEN 'qaowner26' END
FROM task
ON CONFLICT(project_id,task_code) DO UPDATE SET
 task_name=excluded.task_name,step_order=excluded.step_order,process_code=excluded.process_code,
 process_step_code=excluded.process_step_code,actor_code=excluded.actor_code,
 predecessor_codes=excluded.predecessor_codes,completion_rule=excluded.completion_rule,
 target_url=excluded.target_url,assignee_id=excluded.assignee_id,due_date=excluded.due_date;

DELETE FROM framework_project_actor_assignment
WHERE project_id='PRJ-ACTOR-TEST'
  AND actor_code IN ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER');
INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id,active_yn)
VALUES
 ('PRJ-ACTOR-TEST','COMPANY_MANAGER','qaowner26','Y'),
 ('PRJ-ACTOR-TEST','SITE_DATA_OWNER','qadata26','Y'),
 ('PRJ-ACTOR-TEST','CALCULATOR','qacalc26','Y'),
 ('PRJ-ACTOR-TEST','VERIFIER','qaverify26','Y'),
 ('PRJ-ACTOR-TEST','APPROVER','qaapprove26','Y')
ON CONFLICT(project_id,actor_code,user_id) DO UPDATE SET active_yn='Y';

WITH fixture(account_id,actor_code) AS (
 VALUES ('qaowner26','COMPANY_MANAGER'),('qadata26','SITE_DATA_OWNER'),
 ('qacalc26','CALCULATOR'),('qaverify26','VERIFIER'),('qaapprove26','APPROVER')
)
INSERT INTO framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
SELECT account_id,'TEST_COMPANY_001','PRJ-ACTOR-TEST',actor_code,'PRJ-ACTOR-TEST','ACTIVE' FROM fixture
ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET assignment_status='ACTIVE',valid_until=null;
