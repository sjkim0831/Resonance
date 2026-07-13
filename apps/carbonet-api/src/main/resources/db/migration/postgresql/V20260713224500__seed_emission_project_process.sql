-- Reference-backed carbon emission project lifecycle.
INSERT INTO framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,process_status)
VALUES('EMISSION_PROJECT','탄소배출 프로젝트 수행','CARBON_EMISSION','1.1.0','프로젝트 생성부터 자료수집·산정·검증·승인·보고까지 하나의 감사 가능한 흐름으로 완료한다.','기업 책임자가 조직·사업장·산정기간·Scope·담당자·마감을 확정한다.','승인된 산정 결과와 보고서가 존재하고 모든 상태 전이 및 증적이 감사 이력에 기록된다.','DRAFT')
ON CONFLICT(process_code) DO UPDATE SET process_name=excluded.process_name,domain_code=excluded.domain_code,process_version=excluded.process_version,goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,process_status='DRAFT',updated_at=current_timestamp;

DELETE FROM framework_process_step WHERE process_code='EMISSION_PROJECT';
INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule,user_path,admin_path,api_contract) VALUES
('EMISSION_PROJECT',1,'EMISSION_PROJECT_SETUP','프로젝트 기본정보 확정','COMPANY_MANAGER','DRAFT','CONFIRM_SCOPE','PLANNED','조직·사업장·산정기간·Scope·책임자·마감일이 모두 지정됨','/emission/project/create','/admin/emission/management','POST /home/api/emission-projects'),
('EMISSION_PROJECT',2,'EMISSION_PROJECT_COLLECT','활동자료·증빙 수집','SITE_DATA_OWNER','PLANNED','SUBMIT_ACTIVITY_DATA','DATA_SUBMITTED','필수 활동자료와 단위 및 증빙이 제출되고 누락 항목이 없음','/emission/data_input','/admin/emission/survey-admin-data','POST /home/api/emission-projects/{id}/activities'),
('EMISSION_PROJECT',3,'EMISSION_PROJECT_CALCULATE','배출계수 매핑·산정','CALCULATOR','DATA_SUBMITTED','CALCULATE','CALCULATED','모든 산정 대상에 유효한 배출계수·단위환산·계산근거가 존재함','/emission/simulate','/admin/emission/calculation-rule','POST /home/api/emission-projects/{id}/calculation'),
('EMISSION_PROJECT',4,'EMISSION_PROJECT_VALIDATE','데이터·산정 결과 검증','VERIFIER','CALCULATED','VALIDATE','VERIFIED','필수값·이상치·증빙·계산식 검증 오류가 0건임','/emission/validate','/admin/emission/validate','emission-validation-workflow'),
('EMISSION_PROJECT',5,'EMISSION_PROJECT_CORRECT','보완·재산정','SITE_DATA_OWNER','CORRECTION_REQUIRED','RESUBMIT','CALCULATED','검증 의견별 조치와 변경 사유가 기록되고 재산정됨','/emission/data_input?mode=correction','/admin/emission/validate','emission-correction-workflow'),
('EMISSION_PROJECT',6,'EMISSION_PROJECT_APPROVE','검토·승인·확정','APPROVER','VERIFIED','APPROVE','APPROVED','승인권자와 승인 의견 및 결과 버전이 기록됨','/emission/validate?tab=approval','/admin/emission/approval-workflow','emission-approval-workflow'),
('EMISSION_PROJECT',7,'EMISSION_PROJECT_REPORT','보고서 생성·제출','COMPANY_MANAGER','APPROVED','PUBLISH_REPORT','COMPLETED','확정 결과 기반 보고서가 생성·제출되고 다운로드 및 진위검증 가능함','/emission/report_submit','/admin/emission/survey-report','emission-report-workflow');

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status) VALUES
('EMISSION_PROJECT_HAPPY','EMISSION_PROJECT','정상 경로: 생성부터 보고까지 완료','HAPPY_PATH','서로 다른 5개 액터 계정과 하나의 테스트 프로젝트가 존재한다.','["프로젝트 생성","자료·증빙 제출","배출계수 매핑·산정","검증 통과","승인","보고서 생성·제출"]','["최종 상태=COMPLETED","검증 오류=0","승인 이력=1건 이상","보고서 버전과 산정 버전 일치","모든 전이 감사로그 존재"]','DRAFT'),
('EMISSION_PROJECT_EXCEPTION','EMISSION_PROJECT','예외 경로: 필수자료 누락 후 보완·재산정','EXCEPTION','필수 단위 또는 증빙이 누락된 활동자료가 존재한다.','["자료 제출","검증 실패","보완 요청","자료 수정","재산정","재검증"]','["누락 제출은 승인 불가","상태=CORRECTION_REQUIRED","보완 전후 값과 사유 보존","재검증 후 VERIFIED 가능"]','DRAFT'),
('EMISSION_PROJECT_AUTH','EMISSION_PROJECT','권한 경로: 액터별 허용 액션 검증','AUTHORITY','자료담당자·산정자·검증자·승인자가 서로 다른 계정이다.','["자료담당자가 승인 시도","산정자가 검증확정 시도","검증자가 승인 시도","승인권자가 승인"]','["비인가 액션은 403","승인권자만 APPROVED 전이","거부 시도도 감사로그 기록"]','DRAFT'),
('EMISSION_PROJECT_ISOLATION','EMISSION_PROJECT','격리 경로: 테넌트·프로젝트 데이터 차단','ISOLATION','테넌트 A/B와 각 프로젝트 및 동일 역할 계정이 존재한다.','["A 계정이 B 프로젝트 조회·수정 시도","A 프로젝트 정상 조회"]','["교차 조회·수정은 404 또는 403","목록·검색·다운로드에도 B 데이터 0건","A 프로젝트만 노출"]','DRAFT'),
('EMISSION_PROJECT_RECOVERY','EMISSION_PROJECT','복구 경로: 산정·보고 실패 후 안전한 재처리','RECOVERY','산정 또는 보고 생성 중 실패를 재현할 수 있다.','["산정 실행 중 실패","동일 요청 재시도","보고 생성 중 실패","재생성"]','["중복 산정 결과 없음","멱등키로 동일 버전 유지","실패 상태와 원인 기록","복구 후 다음 단계 1회만 전이"]','DRAFT')
ON CONFLICT(case_code) DO UPDATE SET case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status='DRAFT',updated_at=current_timestamp;
