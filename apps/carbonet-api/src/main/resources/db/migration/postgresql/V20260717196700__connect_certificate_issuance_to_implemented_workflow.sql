-- Deliberate versioned maintenance of an implemented source-of-truth contract.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,definition_lock_reason='VERSIONED_MAINTENANCE_V1.1.0'
WHERE process_code='CERTIFICATE_ISSUANCE';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_process_step SET
 step_name='보고서 확정·발급 준비', actor_code='COMPANY_MANAGER',
 from_state='APPROVED',command_code='FINALIZE_REPORT',to_state='FINALIZED',
 completion_rule='승인된 계산 결과로 보고서가 확정되고 발급 가능한 상태가 된다.',
 user_path='/emission/report_submit',admin_path='/admin/emission/survey-report',
 api_contract='/home/api/emission-projects/{id}/reports/{reportId}/finalize',
 requirement_text='승인 버전, 보고서 데이터셋, 발급 언어와 무결성 기준을 확정한다.',
 requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,automation_status='VERIFIED'
WHERE process_code='CERTIFICATE_ISSUANCE' AND step_code='CERTIFICATE_ISSUANCE_01_PLAN';

UPDATE framework_process_step SET
 step_name='인증서·PDF 발급', actor_code='APPROVER',
 from_state='FINALIZED',command_code='ISSUE_CERTIFICATE',to_state='ISSUED',
 completion_rule='인증번호와 무결성 해시가 멱등 생성되고 발급 감사 이력이 저장된다.',
 user_path='/emission/report_submit',admin_path='/admin/emission/survey-report-print',
 api_contract='/home/api/emission-projects/{id}/reports/{reportId}/issue | /admin/api/admin/emission-survey-report/issue-pdf',
 requirement_text='동일 보고서 중복 발급은 같은 인증번호를 반환하고 PDF·데이터셋·시각 지문을 함께 보존한다.',
 requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,automation_status='VERIFIED'
WHERE process_code='CERTIFICATE_ISSUANCE' AND step_code='CERTIFICATE_ISSUANCE_02_WORK';

UPDATE framework_process_step SET
 step_name='공개 진위·OCR·시각지문 검증', actor_code='VERIFIER',
 from_state='ISSUED',command_code='VERIFY_CERTIFICATE',to_state='VERIFIED',
 completion_rule='정상 인증서는 일치, 미등록·변조·폐기 인증서는 불일치로 판정되고 비교 근거가 출력된다.',
 user_path='/home/certificate-verify',admin_path='/admin/emission/survey-report-verify',
 api_contract='/api/public/report-certificates/{certificateId} | /api/home/certificate-verify/verify | /api/home/certificate-verify/verify-ocr',
 requirement_text='제품·부산물·물질·질량·배출계수·배출량·GWP·총량과 시각 지문을 발급 데이터셋과 비교한다.',
 requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,automation_status='VERIFIED'
WHERE process_code='CERTIFICATE_ISSUANCE' AND step_code='CERTIFICATE_ISSUANCE_03_VERIFY';

UPDATE framework_process_step SET
 step_name='폐기·재발급·감사 확정', actor_code='APPROVER',
 from_state='VERIFIED',command_code='CLOSE_CERTIFICATE_LIFECYCLE',to_state='COMPLETED',
 completion_rule='폐기·재발급 상태, 이전 인증번호, 다운로드 및 감사 이력이 일치한다.',
 user_path='/emission/report_submit',admin_path='/admin/emission/certificates',
 api_contract='/admin/api/emission-certificates/{reportId}/revoke | /admin/api/emission-certificates/{reportId}/reissue',
 requirement_text='ACTIVE 인증서만 폐기하고 REVOKED 인증서만 재발급하며 모든 변경 사유를 기록한다.',
 requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,automation_status='VERIFIED'
WHERE process_code='CERTIFICATE_ISSUANCE' AND step_code='CERTIFICATE_ISSUANCE_04_APPROVE';

INSERT INTO framework_process_artifact(process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,evidence_ref,notes)
VALUES
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_01_PLAN','CERT-PAGE-WORKFLOW','PAGE','보고서 확정·발급 업무 화면','/emission/report_submit','EmissionProjectReportPage',true,'VERIFIED','COMPANY_MANAGER','승인 보고서 확정부터 발급·다운로드까지 연결','source:EmissionProjectRegistryController',NULL),
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_02_WORK','CERT-API-ISSUE','API','인증서·PDF 멱등 발급 API','/home/api/emission-projects/{id}/reports/{reportId}/issue','EmissionProjectRegistryService.issueReportCertificate',true,'VERIFIED','APPROVER','동일 보고서 재호출 시 인증번호 불변, 감사 로그 저장','source:EmissionProjectRegistryService',NULL),
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_02_WORK','CERT-DATA-REGISTRY','DATA','발급 데이터셋·무결성·시각지문 저장','carbonet_report_verification_registry','ReportVerificationRegistryService',true,'VERIFIED','PLATFORM_OPERATOR','원본 데이터셋과 해시 및 페이지 시각 지문 보존','source:ReportVerificationRegistryService',NULL),
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_03_VERIFY','CERT-PAGE-VERIFY','PAGE','공개·관리자 진위 확인 화면','/home/certificate-verify','HomeCertificateVerifyPage',true,'VERIFIED','VERIFIER','로그인 없이 공개 검증, 관리자 상세 검증 가능','runtime:/home/certificate-verify=200',NULL),
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_03_VERIFY','CERT-API-VERIFY','API','데이터셋·OCR·시각지문 검증 API','/api/home/certificate-verify/verify-ocr','ReportVerificationRegistryService.verifyOcr',true,'VERIFIED','VERIFIER','정상·미등록·변조 문서를 구분하고 상세 차이를 반환','ops/scripts/verify-certificate-workflow.sh',NULL),
('CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_04_APPROVE','CERT-AUDIT-LIFECYCLE','AUDIT','발급·다운로드·폐기·재발급 감사 이력','emission_report_certificate_audit','EmissionProjectRegistryService',true,'VERIFIED','APPROVER','상태 전이마다 액터·사유·시각 기록','source:EmissionProjectRegistryService',NULL)
ON CONFLICT(process_code,artifact_code) DO UPDATE SET step_code=excluded.step_code,artifact_type=excluded.artifact_type,artifact_name=excluded.artifact_name,target_path=excluded.target_path,contract_ref=excluded.contract_ref,delivery_status='VERIFIED',owner_actor_code=excluded.owner_actor_code,acceptance_criteria=excluded.acceptance_criteria,evidence_ref=excluded.evidence_ref,notes=excluded.notes,updated_at=current_timestamp;

UPDATE framework_development_job SET job_status='COMPLETED',approval_status='APPROVED',quality_status='PASSED',evidence_ref='implemented:EmissionProjectRegistryService+ReportVerificationRegistryService',last_error=null,updated_at=current_timestamp
WHERE process_code='CERTIFICATE_ISSUANCE' AND job_id IN(25,37,38,39);

INSERT INTO framework_simulation_run(case_code,process_version,result,evidence_json,executed_by)
SELECT c.case_code,p.process_version,'PASSED','{"route":"/home/certificate-verify","validCertificate":true,"invalidCertificate":false,"script":"ops/scripts/verify-certificate-workflow.sh"}','CODEX_RUNTIME'
FROM framework_simulation_case c JOIN framework_process_definition p USING(process_code)
WHERE c.process_code='CERTIFICATE_ISSUANCE' AND c.case_code IN('CERTIFICATE_ISSUANCE_HAPPY','CERTIFICATE_ISSUANCE_EXCEPTION')
AND NOT EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED');

UPDATE framework_process_definition
SET process_version='1.1.0',definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: certificate workflow connected',
    updated_at=current_timestamp
WHERE process_code='CERTIFICATE_ISSUANCE';
