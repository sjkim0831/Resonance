-- One orchestrated route implements four distinct work-assignment steps.
-- Verification flags remain false until authenticated runtime and UI evidence pass.
WITH design(step_code,screen_name,purpose,entry_rule,exit_rule,kpis,sections,fields,commands,evidence) AS (
 VALUES
 ('WORK_ASSIGNMENT_CONTEXT','업무 배정 문맥 선택','동일 기업의 업무 종류, 프로세스, 프로젝트를 선택하여 담당자 배정의 유효한 실행 문맥을 확정한다.','로그인 계정이 업무 배정 관리자 액터와 대상 기업의 활성 데이터 범위 권한을 보유한다.','선택 프로젝트와 프로세스가 같은 테넌트에 속하고 절차 및 배정 가능 계정 목록이 조회된다.','["프로젝트 수","절차 수","테넌트 차단 수"]','["업무 종류","프로세스","프로젝트","문맥 오류"]','["tenantId","projectId","workTypeCode","processCode","processVersion"]','["문맥 조회","프로젝트 변경","프로세스 변경","오류 복구"]','["동일 기업 조회","비권한 403","타 테넌트 403","빈 목록"]'),
 ('WORK_ASSIGNMENT_ACTOR','프로세스 책임자·액터 기본 배정','프로세스 조정 책임자와 액터별 기본 담당 계정을 지정하여 세부 절차 배정 기준을 만든다.','유효한 업무 문맥과 동일 기업의 활성 계정 및 액터 배정 정보가 조회되어 있다.','프로세스 책임자와 액터 기본값이 동일 기업 계정으로 선택되어 세부 절차에 반영된다.','["책임자 지정","액터 기본 지정률","타 기업 노출 수"]','["프로세스 책임자","액터 스윔레인","기본 계정","범위 안내"]','["processAccountId","actorCode","actorName","accountId","department","dataScope"]','["책임자 지정","액터 기본값 적용","개별 재정의"]','["동일 기업 6계정","타 기업 0건","기본값 적용"]'),
 ('WORK_ASSIGNMENT_STEP','절차별 담당 계정 배정','프로세스의 모든 절차를 실행 순서와 담당 액터별로 표시하고 각 절차에 실제 수행 계정을 배정한다.','프로세스 책임자가 지정되고 최신 프로세스 버전의 모든 절차와 허용 액터가 조회되어 있다.','모든 절차에 허용 계정이 지정되고 누락 0건 상태에서 하나의 트랜잭션으로 저장된다.','["전체 절차","배정 완료","미배정","Task 수"]','["절차 순서","액터 스윔레인","담당 선택","완료 요약"]','["stepCode","stepName","stepOrder","actorCode","accountId","taskReady"]','["액터 일괄 배정","절차 개별 배정","저장·알림","재조회"]','["7절차 저장","8배정 행","6 Task","알림 생성"]'),
 ('WORK_ASSIGNMENT_CONFIRM','배정 결과 확인·감사·복구','저장 결과를 재조회하여 배정, Task, 알림, 감사 기록이 일치하는지 확인하고 실패 시 원상복구한다.','책임자와 모든 절차 담당자가 지정되어 저장할 수 있고 변경 전 기준 스냅샷이 존재한다.','응답과 DB 재조회가 일치하며 감사·알림이 기록되고 오류 요청은 롤백되어 기존 배정이 보존된다.','["재조회 일치","감사 이벤트","알림","롤백 성공률"]','["저장 상태","결과 재조회","감사·알림","오류·복구"]','["assignedStepCount","updatedTaskCount","auditEventId","notificationCount","evidenceHash","recoveryStatus"]','["저장","재조회","검증","복구","다음 업무"]','["정상 저장","비관리자 403","타 테넌트 403","빈 배정 400","복구"]')
)
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
 command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,contract_status,updated_by)
SELECT 'WORK_ASSIGNMENT',d.step_code,'USER','/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT',
 d.screen_name,s.actor_code,d.purpose,d.entry_rule,d.exit_rule,d.kpis,d.sections,d.fields,d.commands,
 '["LOADING","EMPTY","ERROR","FORBIDDEN","READY","DIRTY","SAVING","SUCCESS","ROLLBACK"]',
 '["GET /home/api/work-assignments","POST /home/api/work-assignments"]',
 '["framework_project_process_assignment","framework_project_process_step_assignment","emission_project_task","framework_work_assignment_audit","emission_workflow_notification"]',d.evidence,
 '1280px 가로 스윔레인과 768px 이하 순서형 카드를 제공하고 본문 가로 넘침을 방지한다.',
 '명시적 레이블, 키보드 탐색, 44px 조작 영역, role=status 상태 안내를 제공한다.',
 '서버가 테넌트, 프로젝트, 업무 배정 액터, 프로세스, 절차, 담당 계정을 다시 검증한다.',
 'DESIGN_COMPLETE','FLYWAY_WORK_ASSIGNMENT_DESIGN'
FROM design d JOIN framework_process_step s ON s.process_code='WORK_ASSIGNMENT' AND s.step_code=d.step_code
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
 screen_name=excluded.screen_name,actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,
 entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,
 section_contract=excluded.section_contract,field_contract=excluded.field_contract,command_contract=excluded.command_contract,
 state_contract=excluded.state_contract,api_contract=excluded.api_contract,data_contract=excluded.data_contract,
 evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
 contract_status=CASE WHEN framework_professional_screen_contract.contract_status='VERIFIED' THEN 'VERIFIED' ELSE 'DESIGN_COMPLETE' END,
 updated_by=excluded.updated_by,updated_at=current_timestamp;

DO $$ DECLARE designed integer; BEGIN
 SELECT count(*) INTO designed FROM framework_professional_screen_design_readiness
 WHERE process_code='WORK_ASSIGNMENT' AND design_readiness_score=100;
 IF designed<>4 THEN RAISE EXCEPTION 'WORK_ASSIGNMENT screen design count mismatch: %',designed; END IF;
END $$;
