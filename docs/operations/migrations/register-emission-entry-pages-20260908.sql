BEGIN;
-- Navigation/design only. Existing task states, assignments and approvals are unchanged.
WITH plan(route,step,actor,audience,sequence,required,condition,purpose) AS (VALUES
('/emission/project_list','EMISSION_PROJECT_SETUP','COMPANY_MANAGER','USER',5,false,'프로젝트 선택 또는 신규 생성 전','기존 프로젝트를 선택하거나 새 프로젝트 등록을 시작한다.'),
('/admin/emission/site-management','EMISSION_PROJECT_SETUP','COMPANY_MANAGER','ADMIN',8,false,'선택할 사업장이 없고 사업장 관리 권한이 있을 때','사업장 원장을 등록한다. 프로젝트에 사업장을 연결하는 업무와 구분한다.'),
('/emission/project/create','EMISSION_PROJECT_SETUP','COMPANY_MANAGER','USER',10,true,'신규 프로젝트이며 projectId가 없을 때','프로젝트명, 복수 사업장, 산정기간을 저장하고 생성된 projectId를 다음 화면으로 전달한다.'),
('/emission/project/detail','EMISSION_PROJECT_SETUP','COMPANY_MANAGER','USER',20,true,'projectId가 존재할 때','저장된 사업장·기간과 실제 다음 업무를 확인한다.'),
('/emission/work-assignment','EMISSION_PROJECT_SETUP','COMPANY_MANAGER','USER',30,false,'업무 담당자 배정 또는 변경이 필요할 때','프로젝트 ID를 유지하여 담당자를 지정한다. 현재 단계별 선택 배정은 추가 검증이 필요하다.'),
('/emission/excel-upload','EMISSION_PROJECT_COLLECT','SITE_DATA_OWNER','USER',15,false,'projectId가 있고 파일로 자료를 입력할 때','기존 고정 6열 엑셀 업로드. 임의 열 매핑 기능과 구분한다.'),
('/emission/calculation-results','EMISSION_PROJECT_CALCULATE','CALCULATOR','USER',30,true,'산정 결과 버전이 생성되었을 때','산정 결과와 근거를 확인한다. 사업장별 결과 추적 완전성은 추가 검증이 필요하다.')
)
INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,screen_sequence,is_required,transition_type,entry_condition,context_contract,guide_contract,test_contract,binding_status)
SELECT 'EMISSION_PROJECT',p.step,r.screen_resource_id,p.audience,p.actor,'SUPPORT',p.sequence,p.required,'SEQUENTIAL',p.condition,
jsonb_build_object('projectId',CASE WHEN p.route IN('/emission/project_list','/emission/project/create','/admin/emission/site-management') THEN 'optional' ELSE 'required' END),
jsonb_build_object('purpose',p.purpose,'verificationStatus','SOURCE_AND_ROUTE_AUDITED_NOT_E2E','reviewDate','2026-09-08'),
jsonb_build_object('status','NOT_RUN','requiredChecks',jsonb_build_array('권한','입력','저장','재조회','다음 화면 projectId 전달')),'ACTIVE'
FROM plan p JOIN framework_screen_resource r ON r.route_key=p.route
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET
screen_sequence=excluded.screen_sequence,is_required=excluded.is_required,entry_condition=excluded.entry_condition,
context_contract=excluded.context_contract,guide_contract=excluded.guide_contract,test_contract=excluded.test_contract,updated_at=current_timestamp;
UPDATE framework_process_step_screen_binding SET screen_sequence=40,entry_condition='projectId가 존재하고 산정 전 포함 사업장과 조직 경계를 확정할 때',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_SETUP' AND screen_resource_id=(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key='/emission/organizational-boundary') AND audience='USER';
COMMIT;
