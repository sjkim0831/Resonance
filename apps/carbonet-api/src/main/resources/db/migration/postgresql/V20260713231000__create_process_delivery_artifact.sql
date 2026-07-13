CREATE TABLE IF NOT EXISTS framework_process_artifact (
 artifact_id bigserial PRIMARY KEY,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 step_code varchar(80),
 artifact_code varchar(120) NOT NULL,
 artifact_type varchar(30) NOT NULL,
 artifact_name varchar(180) NOT NULL,
 target_path varchar(400),
 contract_ref varchar(400),
 required boolean NOT NULL DEFAULT true,
 delivery_status varchar(30) NOT NULL DEFAULT 'PLANNED',
 owner_actor_code varchar(60) REFERENCES framework_actor_definition(actor_code),
 acceptance_criteria text NOT NULL,
 evidence_ref text,
 notes text,
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(process_code,artifact_code)
);
CREATE INDEX IF NOT EXISTS idx_process_artifact_gate ON framework_process_artifact(process_code,required,delivery_status);

INSERT INTO framework_process_artifact(process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,contract_ref,owner_actor_code,acceptance_criteria,delivery_status) VALUES
('EMISSION_PROJECT','EMISSION_PROJECT_SETUP','EP-PAGE-SETUP','PAGE','프로젝트 등록 화면','/emission/project/create','emission-project-registry','COMPANY_MANAGER','필수정보 검증, 중복명 확인, 저장 후 상세 이동, 모바일 대응','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_SETUP','EP-PAGE-HUB','PAGE','프로젝트 프로세스 작업공간','/emission/project/detail','emission-project-registry','COMPANY_MANAGER','7단계·액터·완료조건·감사이력과 후속 화면 연결','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_SETUP','EP-API-PROJECT','API','프로젝트 등록·조회·복사·삭제 API','/home/api/emission-projects','EmissionProjectRegistryController','PLATFORM_OPERATOR','테넌트 격리, 입력검증, 트랜잭션, 감사로그','IN_REVIEW'),
('EMISSION_PROJECT','EMISSION_PROJECT_SETUP','EP-DATA-PROJECT','DATA','프로젝트·Task·담당자 데이터 계약',NULL,'emission_project_registry','PLATFORM_OPERATOR','프로젝트 ID 기준 참조무결성·버전·삭제정책','IN_REVIEW'),
('EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','EP-PAGE-COLLECT','PAGE','활동자료·증빙 입력 화면','/emission/data_input','emission-activity-workflow','SITE_DATA_OWNER','필수값·단위·증빙·엑셀 업로드·임시저장·제출','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','EP-API-ACTIVITY','API','활동자료 등록·업로드·매핑 API','/home/api/emission-projects/{id}/activities','EmissionProjectRegistryController','PLATFORM_OPERATOR','전체 행 저장, 멱등 업로드, 오류 행 반환, 프로젝트 격리','IN_REVIEW'),
('EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE','EP-PAGE-CALCULATE','PAGE','배출계수 매핑·산정 화면','/emission/simulate','emission-calculation-workflow','CALCULATOR','계수 출처·단위환산·계산근거·재산정 버전 표시','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE','EP-API-CALCULATE','API','산정 실행 API','/home/api/emission-projects/{id}/calculation','EmissionProjectRegistryController','PLATFORM_OPERATOR','동일 요청 멱등성, 스냅샷, 합계 검증, 실패 롤백','IN_REVIEW'),
('EMISSION_PROJECT','EMISSION_PROJECT_VALIDATE','EP-PAGE-VALIDATE','PAGE','검증·보완 요청 화면','/emission/validate','emission-validation-workflow','VERIFIER','오류별 근거·담당자·기한·보완 요청·재검증','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_VALIDATE','EP-RULE-VALIDATE','RULE','필수값·이상치·증빙·계산 검증 규칙',NULL,'emission-validation-rule','VERIFIER','규칙 버전과 실행 결과 재현 가능, 오류 0건일 때만 통과','PLANNED'),
('EMISSION_PROJECT','EMISSION_PROJECT_CORRECT','EP-PAGE-CORRECT','PAGE','보완·재산정 작업 화면','/emission/data_input?mode=correction','emission-correction-workflow','SITE_DATA_OWNER','검증 의견 연결, 전후 값·사유·증빙·재제출 이력','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_APPROVE','EP-PAGE-APPROVE','PAGE','검토·승인·반려 화면','/emission/validate?tab=approval','emission-approval-workflow','APPROVER','검증 통과 건만 승인, 반려사유 필수, 승인버전 잠금','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_APPROVE','EP-AUTH','AUTHORITY','액터·프로젝트 데이터 권한',NULL,'framework_account_actor_assignment','PLATFORM_OPERATOR','각 액터 최소권한, 테넌트·프로젝트 격리, 비인가 403','PLANNED'),
('EMISSION_PROJECT','EMISSION_PROJECT_REPORT','EP-PAGE-REPORT','PAGE','보고서 생성·제출 화면','/emission/report_submit','emission-report-workflow','COMPANY_MANAGER','승인 버전 기반 생성, 제출상태·다운로드·진위검증','IMPLEMENTED'),
('EMISSION_PROJECT','EMISSION_PROJECT_REPORT','EP-API-REPORT','API','보고서 생성·제출 API',NULL,'emission-report-workflow','PLATFORM_OPERATOR','PDF 자산 완전성, 언어, 재생성 멱등성, 제출 잠금','PLANNED'),
('EMISSION_PROJECT',NULL,'EP-NOTIFICATION','NOTIFICATION','배정·마감·보완·승인 알림',NULL,'emission-notification-policy','PLATFORM_OPERATOR','중복 방지, 수신자·채널·발송결과·재시도 기록','PLANNED'),
('EMISSION_PROJECT',NULL,'EP-AUDIT','AUDIT','전체 상태 전이 감사로그',NULL,'emission-audit-log','AUDITOR','행위자·시각·전후 상태·사유·요청 ID 변경불가 보존','PLANNED'),
('EMISSION_PROJECT',NULL,'EP-TEST-HAPPY','TEST','정상 완료 시나리오',NULL,'EMISSION_PROJECT_HAPPY','VERIFIER','프로젝트 생성부터 보고서 제출까지 실제 데이터 통과','PLANNED'),
('EMISSION_PROJECT',NULL,'EP-TEST-EXCEPTION','TEST','누락·보완 시나리오',NULL,'EMISSION_PROJECT_EXCEPTION','VERIFIER','누락 차단과 보완·재산정 이력 검증','PLANNED'),
('EMISSION_PROJECT',NULL,'EP-TEST-SECURITY','TEST','권한·격리 시나리오',NULL,'EMISSION_PROJECT_AUTH,EMISSION_PROJECT_ISOLATION','AUDITOR','비인가 액션 및 교차 테넌트 접근 차단','PLANNED'),
('EMISSION_PROJECT',NULL,'EP-TEST-RECOVERY','TEST','실패·복구 시나리오',NULL,'EMISSION_PROJECT_RECOVERY','PLATFORM_OPERATOR','중복 없이 복구되고 실패 증적 보존','PLANNED'),
('EMISSION_PROJECT',NULL,'EP-OPS','OPERATION','모니터링·백업·복구·운영 절차',NULL,'carbonet-runtime','PLATFORM_OPERATOR','상태·오류·성능 관측, 백업 검증, 장애 복구 절차','IN_REVIEW')
ON CONFLICT(process_code,artifact_code) DO UPDATE SET step_code=excluded.step_code,artifact_type=excluded.artifact_type,artifact_name=excluded.artifact_name,target_path=excluded.target_path,contract_ref=excluded.contract_ref,owner_actor_code=excluded.owner_actor_code,acceptance_criteria=excluded.acceptance_criteria,updated_at=current_timestamp;
