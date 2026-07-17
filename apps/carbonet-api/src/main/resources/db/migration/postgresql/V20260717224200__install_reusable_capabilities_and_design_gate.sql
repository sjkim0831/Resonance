CREATE TABLE IF NOT EXISTS framework_common_feature_package (
  feature_code varchar(80) PRIMARY KEY,
  feature_name varchar(160) NOT NULL,
  feature_version varchar(40) NOT NULL,
  feature_category varchar(40) NOT NULL,
  description text NOT NULL,
  api_contract jsonb NOT NULL DEFAULT '[]',
  data_contract jsonb NOT NULL DEFAULT '[]',
  ui_contract jsonb NOT NULL DEFAULT '[]',
  event_contract jsonb NOT NULL DEFAULT '[]',
  permission_contract jsonb NOT NULL DEFAULT '[]',
  test_contract jsonb NOT NULL DEFAULT '[]',
  install_strategy varchar(30) NOT NULL DEFAULT 'BIND_EXISTING',
  active_yn char(1) NOT NULL DEFAULT 'Y',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_common_feature_dependency (
  feature_code varchar(80) NOT NULL REFERENCES framework_common_feature_package(feature_code) ON DELETE CASCADE,
  depends_on_feature_code varchar(80) NOT NULL REFERENCES framework_common_feature_package(feature_code),
  minimum_version varchar(40) NOT NULL DEFAULT '1.0.0',
  required_yn char(1) NOT NULL DEFAULT 'Y',
  PRIMARY KEY(feature_code,depends_on_feature_code),
  CHECK(feature_code<>depends_on_feature_code)
);

CREATE TABLE IF NOT EXISTS framework_screen_feature_binding (
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  audience varchar(20) NOT NULL,
  route_path varchar(300) NOT NULL,
  feature_code varchar(80) NOT NULL REFERENCES framework_common_feature_package(feature_code),
  binding_options jsonb NOT NULL DEFAULT '{}',
  required_yn char(1) NOT NULL DEFAULT 'Y',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(process_code,step_code,audience,route_path,feature_code)
);

CREATE TABLE IF NOT EXISTS framework_feature_installation (
  installation_id bigserial PRIMARY KEY,
  project_scope varchar(120) NOT NULL DEFAULT 'PLATFORM',
  feature_code varchar(80) NOT NULL REFERENCES framework_common_feature_package(feature_code),
  installed_version varchar(40) NOT NULL,
  installation_status varchar(30) NOT NULL DEFAULT 'INSTALLED',
  configuration jsonb NOT NULL DEFAULT '{}',
  evidence_ref text,
  installed_by varchar(120) NOT NULL,
  installed_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(project_scope,feature_code)
);

CREATE TABLE IF NOT EXISTS framework_api_endpoint_registry (
  endpoint_key varchar(240) PRIMARY KEY,
  http_method varchar(10) NOT NULL,
  route_path varchar(300) NOT NULL,
  implementation_ref text NOT NULL,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  verified_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(http_method,route_path)
);

CREATE TABLE IF NOT EXISTS framework_process_design_validation_run (
  validation_run_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  validation_status varchar(20) NOT NULL,
  blocker_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  result_json jsonb NOT NULL DEFAULT '[]',
  source_fingerprint varchar(64) NOT NULL,
  executed_by varchar(120) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

INSERT INTO framework_common_feature_package
(feature_code,feature_name,feature_version,feature_category,description,api_contract,data_contract,ui_contract,event_contract,permission_contract,test_contract)
VALUES
('FILE_EVIDENCE','파일·증빙 관리','1.0.0','DATA','업로드, 무결성, 버전, 다운로드와 증빙 연결을 제공한다.','[]','["emission_activity_evidence"]','["EvidenceUploader","EvidenceList","IntegrityStatus"]','["EVIDENCE_ATTACHED","EVIDENCE_REPLACED"]','["PROJECT_OBJECT_SCOPE"]','["UPLOAD","SIZE_TYPE_REJECT","TENANT_ISOLATION","RECOVERY"]'),
('EXCEL_IMPORT','엑셀 양식 해석·업로드','1.0.0','DATA','양식 영역 판별, 헤더 매핑, 미리보기, 검증과 멱등 저장을 제공한다.','[]','["emission_activity_data","emission_activity_submission"]','["ExcelDropzone","SheetPreview","ColumnMapping","ImportResult"]','["IMPORT_VALIDATED","IMPORT_COMMITTED"]','["SITE_DATA_OWNER"]','["LEFT_TABLE_ONLY","HEADER_SPLIT","IDEMPOTENT_IMPORT","LARGE_FILE"]'),
('AI_MAPPING','AI 후보 검색·매핑','1.0.0','AI','전체 후보 검색, 점수·근거 정렬, 사용자 확정과 모델 추적을 제공한다.','[]','["emission_factor_mapping"]','["MappingSearchDialog","CandidateRanking","MappingDecision"]','["MAPPING_RECOMMENDED","MAPPING_CONFIRMED"]','["CALCULATOR"]','["TOP_K","ALL_ROWS","RANKING","MANUAL_OVERRIDE"]'),
('UNIT_CONVERSION','단위 변환·전체 적용','1.0.0','CALCULATION','단위 차원 검증, 섹션·전체 적용, 환산 근거와 정밀도를 제공한다.','[]','["emission_unit_conversion"]','["UnitSelector","BulkUnitApply","ConversionEvidence"]','["UNIT_APPLIED"]','["SITE_DATA_OWNER","CALCULATOR"]','["DIMENSION","ROUNDING","BULK_SCOPE"]'),
('APPROVAL_WORKFLOW','검증·승인·반려','1.0.0','WORKFLOW','업무분리, 전자결정, 반려·보완, 잠금과 감사 이력을 제공한다.','["GET /home/api/emission-projects/{id}/review-workflow","POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/start","POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision","POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision"]','["emission_activity_submission","emission_submission_review","emission_calculation_run"]','["ApprovalQueue","ReviewWorkspace","DecisionDialog","DecisionHistory"]','["VERIFICATION_STARTED","VERIFIED","APPROVED","REJECTED"]','["VERIFIER","APPROVER","SEGREGATION_OF_DUTIES"]','["HAPPY","REJECTION_REASON","SELF_APPROVAL_DENIED","STALE_VERSION"]'),
('PDF_REPORT','PDF 보고서 생성','1.0.0','REPORT','동일 DOM·CSS 기반 Chromium 인쇄, 데이터셋 포함과 다운로드를 제공한다.','[]','["emission_project_report"]','["ReportPreview","PrintControls"]','["REPORT_FINALIZED","PDF_GENERATED"]','["COMPANY_MANAGER"]','["DOM_PARITY","FONT_EMBED","PAGE_BREAK","HASH_STABILITY"]'),
('CERTIFICATE_VERIFY','OCR·시각지문·데이터셋 진위검증','1.0.0','VERIFY','정규화 데이터셋, OCR, 시각 지문과 항목별 일치 판정을 제공한다.','["GET /api/public/report-certificates/{certificateId}","POST /api/home/certificate-verify/verify","POST /api/home/certificate-verify/verify-ocr"]','["emission_project_report","emission_report_access_ledger"]','["CertificateVerifyForm","VerificationSummary","ComparisonDetail"]','["CERTIFICATE_VERIFIED"]','["PUBLIC_VERIFY","AUDIT_READ"]','["DATASET","OCR","VISUAL_FINGERPRINT","TAMPERED_PDF"]'),
('SEARCH_INDEX','통합 검색·색인','1.0.0','SEARCH','메뉴, 업무, 게시글과 업무 자산의 증분 색인과 구분 검색을 제공한다.','[]','["framework_unified_asset_catalog"]','["GlobalSearch","SectionedResults","ResultMore"]','["INDEX_REFRESHED"]','["RESULT_OBJECT_SCOPE"]','["SECTION","FILTER","PERMISSION","INCREMENTAL"]'),
('NOTIFICATION_ESCALATION','알림·마감·에스컬레이션','1.0.0','WORKFLOW','Task 마감, 지연, 재알림, 관리자 고지와 다음 업무 안내를 제공한다.','[]','["emission_project_task","framework_process_execution_event"]','["TaskQuestPanel","DeadlineBadge","WorkflowMap"]','["TASK_READY","TASK_OVERDUE","TASK_ESCALATED"]','["ASSIGNED_ACTOR"]','["DEADLINE","NEXT_TASK","ESCALATION","NO_DUPLICATE"]')
ON CONFLICT(feature_code) DO UPDATE SET
 feature_name=excluded.feature_name,feature_version=excluded.feature_version,feature_category=excluded.feature_category,
 description=excluded.description,api_contract=excluded.api_contract,data_contract=excluded.data_contract,
 ui_contract=excluded.ui_contract,event_contract=excluded.event_contract,permission_contract=excluded.permission_contract,
 test_contract=excluded.test_contract,updated_at=current_timestamp;

INSERT INTO framework_common_feature_dependency(feature_code,depends_on_feature_code) VALUES
('EXCEL_IMPORT','FILE_EVIDENCE'),('AI_MAPPING','UNIT_CONVERSION'),('PDF_REPORT','FILE_EVIDENCE'),
('CERTIFICATE_VERIFY','PDF_REPORT'),('NOTIFICATION_ESCALATION','SEARCH_INDEX')
ON CONFLICT DO NOTHING;

INSERT INTO framework_api_endpoint_registry(endpoint_key,http_method,route_path,implementation_ref) VALUES
('EMISSION:PROJECT:CREATE','POST','/home/api/emission-projects','EmissionProjectRegistryController#create'),
('EMISSION:PROJECT:WORKFLOW','GET','/home/api/emission-projects/{id}/review-workflow','EmissionProjectRegistryController#reviewWorkflow'),
('EMISSION:VERIFY:START','POST','/home/api/emission-projects/{id}/submissions/{submissionId}/verification/start','EmissionProjectRegistryController#startVerification'),
('EMISSION:VERIFY:DECIDE','POST','/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision','EmissionProjectRegistryController#decideVerification'),
('EMISSION:APPROVAL:DECIDE','POST','/home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision','EmissionProjectRegistryController#decideApproval'),
('EMISSION:CALCULATION:READ','GET','/home/api/emission-projects/{id}/calculation','EmissionProjectRegistryController#calculation'),
('EMISSION:CALCULATION:RUN','POST','/home/api/emission-projects/{id}/calculation','EmissionProjectRegistryController#calculate'),
('EMISSION:REPORT:LIST','GET','/home/api/emission-projects/{id}/reports','EmissionProjectRegistryController#reports'),
('EMISSION:REPORT:CREATE','POST','/home/api/emission-projects/{id}/reports','EmissionProjectRegistryController#createReport'),
('EMISSION:REPORT:FINALIZE','POST','/home/api/emission-projects/{id}/reports/{reportId}/finalize','EmissionProjectRegistryController#finalizeReport'),
('EMISSION:CERTIFICATE:ISSUE','POST','/home/api/emission-projects/{id}/reports/{reportId}/issue','EmissionProjectRegistryController#issueReportCertificate')
ON CONFLICT(endpoint_key) DO UPDATE SET http_method=excluded.http_method,route_path=excluded.route_path,implementation_ref=excluded.implementation_ref,active_yn='Y',verified_at=current_timestamp;

INSERT INTO framework_screen_feature_binding(process_code,step_code,audience,route_path,feature_code) VALUES
('EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','USER','/emission/data_input','FILE_EVIDENCE'),
('EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','USER','/emission/data_input','EXCEL_IMPORT'),
('EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE','USER','/emission/simulate','AI_MAPPING'),
('EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE','USER','/emission/simulate','UNIT_CONVERSION'),
('EMISSION_PROJECT','EMISSION_PROJECT_VALIDATE','USER','/emission/validate','APPROVAL_WORKFLOW'),
('EMISSION_PROJECT','EMISSION_PROJECT_APPROVE','USER','/emission/validate?tab=approval','APPROVAL_WORKFLOW'),
('EMISSION_PROJECT','EMISSION_PROJECT_APPROVE','ADMIN','/admin/emission/approval-workflow','APPROVAL_WORKFLOW'),
('EMISSION_PROJECT','EMISSION_PROJECT_REPORT','USER','/emission/report_submit','PDF_REPORT'),
('EMISSION_PROJECT','EMISSION_PROJECT_REPORT','USER','/emission/report_submit','CERTIFICATE_VERIFY'),
('EMISSION_PROJECT','EMISSION_PROJECT_SETUP','USER','/emission/project/create','NOTIFICATION_ESCALATION')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION framework_install_common_feature(p_feature_code text,p_project_scope text,p_actor text,p_configuration jsonb DEFAULT '{}')
RETURNS TABLE(feature_code text,installed_version text,installation_status text) LANGUAGE plpgsql AS $$
DECLARE v_version text;
BEGIN
 SELECT feature_version INTO v_version FROM framework_common_feature_package
 WHERE framework_common_feature_package.feature_code=p_feature_code AND active_yn='Y';
 IF v_version IS NULL THEN RAISE EXCEPTION 'ACTIVE_FEATURE_PACKAGE_NOT_FOUND:%',p_feature_code; END IF;
 IF EXISTS(
   SELECT 1 FROM framework_common_feature_dependency d
   LEFT JOIN framework_feature_installation i ON i.feature_code=d.depends_on_feature_code AND i.project_scope=p_project_scope AND i.installation_status='INSTALLED'
   WHERE d.feature_code=p_feature_code AND d.required_yn='Y' AND i.installation_id IS NULL
 ) THEN RAISE EXCEPTION 'REQUIRED_FEATURE_DEPENDENCY_NOT_INSTALLED:%',p_feature_code; END IF;
 INSERT INTO framework_feature_installation(project_scope,feature_code,installed_version,configuration,evidence_ref,installed_by)
 VALUES(p_project_scope,p_feature_code,v_version,coalesce(p_configuration,'{}'),'feature-package:'||p_feature_code||':'||v_version,p_actor)
 ON CONFLICT(project_scope,feature_code) DO UPDATE SET installed_version=excluded.installed_version,installation_status='INSTALLED',configuration=excluded.configuration,evidence_ref=excluded.evidence_ref,installed_by=excluded.installed_by,updated_at=current_timestamp;
 RETURN QUERY SELECT p_feature_code,v_version,'INSTALLED'::text;
END $$;

CREATE OR REPLACE FUNCTION framework_validate_process_design(p_process_code text,p_actor text DEFAULT 'SYSTEM')
RETURNS TABLE(validation_status text,blocker_count integer,warning_count integer,validation_run_id bigint) LANGUAGE plpgsql AS $$
DECLARE v_issues jsonb; v_blockers integer; v_warnings integer; v_run bigint; v_hash text;
BEGIN
 WITH issues AS (
   SELECT s.step_code,'STATE_OUTPUT_MISMATCH' code,'BLOCKER' severity,
          'outputContract.toState와 단계 toState가 다릅니다.' message
   FROM framework_process_step s
   WHERE s.process_code=p_process_code
     AND coalesce((s.output_contract::jsonb->>'toState'),'')<>s.to_state
   UNION ALL
   SELECT s.step_code,'NEXT_STATE_UNREACHABLE','BLOCKER','다음 단계 또는 명시적 분기에서 소비하지 않는 상태입니다.'
   FROM framework_process_step s
   WHERE s.process_code=p_process_code AND s.to_state<>'COMPLETED'
     AND NOT EXISTS(SELECT 1 FROM framework_process_step n WHERE n.process_code=s.process_code AND n.from_state=s.to_state)
   UNION ALL
   SELECT s.step_code,'USER_SCREEN_CONTRACT_MISSING','BLOCKER','사용자 경로의 전문 화면 계약이 없습니다.'
   FROM framework_process_step s WHERE s.process_code=p_process_code AND s.requires_user_page
     AND NOT EXISTS(SELECT 1 FROM framework_professional_screen_contract c WHERE c.process_code=s.process_code AND c.step_code=s.step_code AND c.audience='USER' AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.user_path,'?',1)))
   UNION ALL
   SELECT s.step_code,'ADMIN_SCREEN_CONTRACT_MISSING','BLOCKER','관리자 경로의 전문 화면 계약이 없습니다.'
   FROM framework_process_step s WHERE s.process_code=p_process_code AND s.requires_admin_page
     AND NOT EXISTS(SELECT 1 FROM framework_professional_screen_contract c WHERE c.process_code=s.process_code AND c.step_code=s.step_code AND c.audience='ADMIN' AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.admin_path,'?',1)))
   UNION ALL
   SELECT c.step_code,'API_ENDPOINT_NOT_IMPLEMENTED','BLOCKER','설계 API가 구현 엔드포인트 레지스트리에 없습니다: '||a.endpoint
   FROM framework_professional_screen_contract c
   CROSS JOIN LATERAL jsonb_array_elements_text(c.api_contract::jsonb) a(endpoint)
   WHERE c.process_code=p_process_code AND a.endpoint~'^(GET|POST|PUT|PATCH|DELETE) '
     AND NOT EXISTS(SELECT 1 FROM framework_api_endpoint_registry r WHERE r.active_yn='Y' AND upper(r.http_method)||' '||r.route_path=a.endpoint)
   UNION ALL
   SELECT c.step_code,'DATA_ENTITY_NOT_IMPLEMENTED','BLOCKER','설계 데이터 엔터티가 실제 테이블로 확인되지 않습니다: '||d.entity
   FROM framework_professional_screen_contract c
   CROSS JOIN LATERAL jsonb_array_elements_text(c.data_contract::jsonb) d(entity)
   WHERE c.process_code=p_process_code AND to_regclass(d.entity) IS NULL
   UNION ALL
   SELECT b.step_code,'FEATURE_NOT_INSTALLED','WARNING','화면이 사용하는 공통 기능이 플랫폼에 설치되지 않았습니다: '||b.feature_code
   FROM framework_screen_feature_binding b
   WHERE b.process_code=p_process_code AND b.required_yn='Y'
     AND NOT EXISTS(SELECT 1 FROM framework_feature_installation i WHERE i.project_scope='PLATFORM' AND i.feature_code=b.feature_code AND i.installation_status='INSTALLED')
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('stepCode',step_code,'code',code,'severity',severity,'message',message) ORDER BY step_code,code),'[]'),
          count(*) FILTER(WHERE severity='BLOCKER'),count(*) FILTER(WHERE severity='WARNING')
   INTO v_issues,v_blockers,v_warnings FROM issues;
 SELECT md5(string_agg(concat_ws('|',step_code,from_state,to_state,input_contract,output_contract,user_path,admin_path,api_contract),'~' ORDER BY step_order)) INTO v_hash
 FROM framework_process_step WHERE process_code=p_process_code;
 INSERT INTO framework_process_design_validation_run(process_code,validation_status,blocker_count,warning_count,result_json,source_fingerprint,executed_by)
 VALUES(p_process_code,CASE WHEN v_blockers=0 THEN 'PASSED' ELSE 'BLOCKED' END,v_blockers,v_warnings,v_issues,coalesce(v_hash,''),p_actor) RETURNING framework_process_design_validation_run.validation_run_id INTO v_run;
 RETURN QUERY SELECT CASE WHEN v_blockers=0 THEN 'PASSED' ELSE 'BLOCKED' END,v_blockers,v_warnings,v_run;
END $$;

DO $$ DECLARE r record;
BEGIN
 FOR r IN SELECT feature_code FROM framework_common_feature_package ORDER BY CASE WHEN feature_code IN ('FILE_EVIDENCE','UNIT_CONVERSION','SEARCH_INDEX') THEN 0 WHEN feature_code='PDF_REPORT' THEN 1 WHEN feature_code='CERTIFICATE_VERIFY' THEN 2 ELSE 1 END,feature_code LOOP
   BEGIN PERFORM * FROM framework_install_common_feature(r.feature_code,'PLATFORM','MIGRATION','{}');
   EXCEPTION WHEN OTHERS THEN NULL;
   END;
 END LOOP;
END $$;
