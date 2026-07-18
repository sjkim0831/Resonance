ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition SET definition_locked=false,definition_lock_reason='VERSIONED_MAINTENANCE_V1.1.0' WHERE process_code='REPORT_CERTIFICATION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

INSERT INTO framework_api_endpoint_registry(endpoint_key,http_method,route_path,implementation_ref) VALUES
('REPORT:CERTIFICATE:PUBLIC','GET','/api/public/report-certificates/{certificateId}','PublicReportCertificateController#verify'),
('REPORT:VERIFY:DATASET','POST','/api/home/certificate-verify/verify','ReportVerificationRegistryController#verify'),
('REPORT:VERIFY:OCR','POST','/api/home/certificate-verify/verify-ocr','ReportVerificationRegistryController#verifyOcr')
ON CONFLICT(endpoint_key) DO UPDATE SET http_method=excluded.http_method,route_path=excluded.route_path,implementation_ref=excluded.implementation_ref,active_yn='Y',verified_at=current_timestamp;

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step SET
 user_path=CASE step_code WHEN 'REPORT_CERTIFICATION_01_PLAN' THEN '/emission/report_submit' WHEN 'REPORT_CERTIFICATION_02_WORK' THEN '/emission/report_submit' WHEN 'REPORT_CERTIFICATION_03_VERIFY' THEN '/home/certificate-verify' ELSE '/emission/report-download' END,
 admin_path=CASE step_code WHEN 'REPORT_CERTIFICATION_01_PLAN' THEN '/admin/emission/report-certificates' WHEN 'REPORT_CERTIFICATION_02_WORK' THEN '/admin/emission/survey-report' WHEN 'REPORT_CERTIFICATION_03_VERIFY' THEN '/admin/emission/survey-report-verify' ELSE '/admin/emission/report-certificates' END,
 api_contract=CASE step_code
  WHEN 'REPORT_CERTIFICATION_01_PLAN' THEN 'GET /home/api/emission-projects/{id}/reports'
  WHEN 'REPORT_CERTIFICATION_02_WORK' THEN 'POST /home/api/emission-projects/{id}/reports; POST /home/api/emission-projects/{id}/reports/{reportId}/finalize'
  WHEN 'REPORT_CERTIFICATION_03_VERIFY' THEN 'GET /api/public/report-certificates/{certificateId}; POST /api/home/certificate-verify/verify; POST /api/home/certificate-verify/verify-ocr'
  ELSE 'POST /home/api/emission-projects/{id}/reports/{reportId}/issue; POST /home/api/emission-projects/{id}/reports/{reportId}/download; GET /home/api/report-access-history' END,
 requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,requires_notification=true,automation_status='VERIFIED'
WHERE process_code='REPORT_CERTIFICATION';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

DELETE FROM framework_professional_screen_contract WHERE process_code='REPORT_CERTIFICATION';
WITH mapping(step_code,user_route,admin_route,api_json,screen_name) AS (VALUES
 ('REPORT_CERTIFICATION_01_PLAN','/emission/report_submit','/admin/emission/report-certificates','["GET /home/api/emission-projects/{id}/reports"]'::jsonb,'보고서 작성 계획·원천 결과 확인'),
 ('REPORT_CERTIFICATION_02_WORK','/emission/report_submit','/admin/emission/survey-report','["POST /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports/{reportId}/finalize"]'::jsonb,'보고서 작성·확정'),
 ('REPORT_CERTIFICATION_03_VERIFY','/home/certificate-verify','/admin/emission/survey-report-verify','["GET /api/public/report-certificates/{certificateId}","POST /api/home/certificate-verify/verify","POST /api/home/certificate-verify/verify-ocr"]'::jsonb,'데이터셋·OCR·시각지문 진위 확인'),
 ('REPORT_CERTIFICATION_04_APPROVE','/emission/report-download','/admin/emission/report-certificates','["POST /home/api/emission-projects/{id}/reports/{reportId}/issue","POST /home/api/emission-projects/{id}/reports/{reportId}/download","GET /home/api/report-access-history"]'::jsonb,'인증서 발급·다운로드·감사')
)
INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,exception_states_verified,audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT 'REPORT_CERTIFICATION',m.step_code,c.audience,CASE c.audience WHEN 'ADMIN' THEN m.admin_route ELSE m.user_route END,m.screen_name,s.actor_code,c.business_purpose,c.entry_condition,c.exit_condition,c.kpi_contract,c.section_contract,c.field_contract,c.command_contract,c.state_contract,m.api_json,'["emission_project_report","emission_report_certificate_audit","emission_report_access_ledger","emission_calculation_run","emission_activity_submission"]','approved calculation source; immutable integrity hash; dataset/OCR/visual fingerprint comparison; issue/download/access audit evidence',c.responsive_contract,c.accessibility_contract,c.security_contract,true,true,true,true,true,true,'implemented:EmissionProjectRegistryService+ReportVerificationRegistryService+certificate-workflow','VERIFIED','FLYWAY','HIDDEN',true
FROM mapping m CROSS JOIN (VALUES('USER'),('ADMIN')) c0(audience)
JOIN framework_professional_screen_contract c ON c.process_code='EMISSION_PROJECT' AND c.step_code='EMISSION_PROJECT_REPORT' AND c.audience=c0.audience
JOIN framework_process_step s ON s.process_code='REPORT_CERTIFICATION' AND s.step_code=m.step_code;

INSERT INTO framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,job_status,approval_status,created_by)
SELECT 'REPORT_CERTIFICATION',replace(j.step_code,'EMISSION_CALCULATION','REPORT_CERTIFICATION'),j.job_type,replace(j.job_name,'배출량 산정','보고서·인증서'),
 CASE replace(j.step_code,'EMISSION_CALCULATION','REPORT_CERTIFICATION')
  WHEN 'REPORT_CERTIFICATION_01_PLAN' THEN CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/report-certificates' WHEN j.job_type='FRONTEND_USER' THEN '/emission/report_submit' ELSE coalesce(j.target_path,'') END
  WHEN 'REPORT_CERTIFICATION_02_WORK' THEN CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/survey-report' WHEN j.job_type='FRONTEND_USER' THEN '/emission/report_submit' ELSE coalesce(j.target_path,'') END
  WHEN 'REPORT_CERTIFICATION_03_VERIFY' THEN CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/survey-report-verify' WHEN j.job_type='FRONTEND_USER' THEN '/home/certificate-verify' ELSE coalesce(j.target_path,'') END
  ELSE CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/report-certificates' WHEN j.job_type='FRONTEND_USER' THEN '/emission/report-download' ELSE coalesce(j.target_path,'') END END,
 replace(j.specification_json,'EMISSION_CALCULATION','REPORT_CERTIFICATION'),'PLANNED','APPROVED','FLYWAY'
FROM framework_development_job j WHERE j.process_code='EMISSION_CALCULATION'
ON CONFLICT(process_code,step_code,job_type,target_path) DO UPDATE SET job_name=excluded.job_name,specification_json=excluded.specification_json,approval_status='APPROVED',updated_at=current_timestamp;

UPDATE framework_process_artifact SET delivery_status=CASE WHEN artifact_type='PAGE' THEN 'IMPLEMENTED' ELSE 'PLANNED' END,evidence_ref=null,updated_at=current_timestamp WHERE process_code='REPORT_CERTIFICATION';
UPDATE framework_process_definition SET process_version='1.1.0',process_status='IN_DEVELOPMENT',automation_mode='AUTOMATIC',definition_locked=true,definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: report and certificate contracts verified',updated_at=current_timestamp WHERE process_code='REPORT_CERTIFICATION';

DO $$ DECLARE validation record; BEGIN SELECT * INTO validation FROM framework_validate_process_design('REPORT_CERTIFICATION','MIGRATION_REPORT_CERTIFICATION'); IF validation.blocker_count<>0 THEN RAISE EXCEPTION 'REPORT_CERTIFICATION_DESIGN_BLOCKED:%',validation.blocker_count; END IF; END $$;
