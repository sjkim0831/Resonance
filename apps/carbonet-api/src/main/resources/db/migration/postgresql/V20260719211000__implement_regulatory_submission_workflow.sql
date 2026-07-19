CREATE TABLE IF NOT EXISTS emission_regulatory_submission (
  regulatory_submission_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
  report_id bigint NOT NULL REFERENCES emission_project_report(report_id) ON DELETE RESTRICT,
  submission_version integer NOT NULL,
  authority_code varchar(80) NOT NULL,
  authority_name varchar(200) NOT NULL,
  reporting_program varchar(160) NOT NULL,
  reporting_period varchar(80) NOT NULL,
  legal_basis text NOT NULL,
  submission_channel varchar(30) NOT NULL CHECK (submission_channel IN ('SYSTEM','PORTAL','EMAIL','OFFLINE','API')),
  submission_deadline date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PACKAGED','SUBMITTED','RECEIVED','CORRECTION_REQUIRED','RESUBMITTED','ACCEPTED','CANCELLED')),
  package_hash varchar(64) NOT NULL,
  external_receipt_no varchar(120),
  correction_reason text,
  correction_due_date date,
  submitted_by varchar(100),
  submitted_at timestamp,
  received_at timestamp,
  accepted_at timestamp,
  note_text text NOT NULL DEFAULT '',
  client_request_id varchar(100) NOT NULL,
  created_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE (tenant_id,project_id,client_request_id),
  UNIQUE (tenant_id,project_id,submission_version)
);

CREATE TABLE IF NOT EXISTS emission_regulatory_submission_event (
  event_id bigserial PRIMARY KEY,
  regulatory_submission_id bigint NOT NULL REFERENCES emission_regulatory_submission(regulatory_submission_id) ON DELETE CASCADE,
  event_code varchar(40) NOT NULL,
  previous_status varchar(30),
  new_status varchar(30) NOT NULL,
  actor_id varchar(100) NOT NULL,
  event_note text NOT NULL DEFAULT '',
  evidence_json text NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_regulatory_submission_scope_status
  ON emission_regulatory_submission(tenant_id,project_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_submission_deadline
  ON emission_regulatory_submission(status,submission_deadline,correction_due_date);
CREATE INDEX IF NOT EXISTS idx_regulatory_submission_event_timeline
  ON emission_regulatory_submission_event(regulatory_submission_id,event_id);

-- Existing projects and newly created projects share the same seventh workflow task.
INSERT INTO emission_project_task(project_id,task_code,task_name,step_order,task_status,progress_weight,due_date,process_code,process_step_code,actor_code,predecessor_codes,completion_rule,target_url)
SELECT p.project_id,'REGULATORY_SUBMISSION','규제기관 제출·접수',7,
       CASE WHEN EXISTS (SELECT 1 FROM emission_project_report r WHERE r.project_id=p.project_id AND r.tenant_id=p.tenant_id AND r.report_status='FINALIZED') THEN 'READY' ELSE 'WAITING' END,
       15,coalesce(p.due_date,current_date)+7,'REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S1','COMPANY_MANAGER','REPORT',
       '제출 패키지 해시와 접수번호가 보존되고 보완이 종결되어 규제기관 수리 상태가 된다.',
       '/emission/report-submission?projectId='||p.project_id
FROM emission_project_registry p
ON CONFLICT(project_id,task_code) DO UPDATE SET task_name=excluded.task_name,step_order=7,process_code=excluded.process_code,process_step_code=excluded.process_step_code,actor_code=excluded.actor_code,predecessor_codes='REPORT',completion_rule=excluded.completion_rule,target_url=excluded.target_url,updated_at=current_timestamp;

UPDATE emission_project_task SET progress_weight=CASE task_code WHEN 'BASIC_INFO' THEN 10 ELSE 15 END
WHERE task_code IN ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT','REGULATORY_SUBMISSION');

UPDATE framework_process_step SET
 user_path='/emission/report-submission',
 admin_path='/admin/emission/regulatory-submissions',
 api_contract=CASE step_order
   WHEN 1 THEN 'GET /home/api/emission-projects/{id}/regulatory-submissions'
   WHEN 2 THEN 'POST /home/api/emission-projects/{id}/regulatory-submissions'
   ELSE 'POST /home/api/emission-projects/{id}/regulatory-submissions/{submissionId}/transition' END,
 input_contract=jsonb_build_object('tenantId','required','projectId','required','reportId','required','authorityCode','required','reportingProgram','required','submissionDeadline','required','clientRequestId','required')::text,
 output_contract=jsonb_build_object('packageHash','required','status','required','timeline','required','nextActions','required')::text,
 automation_status='GENERATED'
WHERE process_code='REGULATORY_SUBMISSION';

UPDATE comtnmenuinfo SET menu_nm='규제기관 제출',menu_nm_en='Regulatory Submission',menu_url='/emission/report-submission',menu_icon='outbox',use_at='Y',expsr_at='Y',last_updt_pnttm=current_timestamp WHERE menu_code='H1020404';
UPDATE comtccmmndetailcode SET code_nm='규제기관 제출',code_dc='/emission/report-submission',use_at='Y',last_updt_pnttm=current_timestamp WHERE code_id='HMENU1' AND code='H1020404';
UPDATE comtnmenuinfo SET menu_nm='규제 제출 현황',menu_nm_en='Regulatory Submission Status',menu_url='/admin/emission/regulatory-submissions',menu_icon='fact_check',use_at='Y',expsr_at='Y',last_updt_pnttm=current_timestamp WHERE menu_code='A1030403';
UPDATE comtccmmndetailcode SET code_nm='규제 제출 현황',code_dc='/admin/emission/regulatory-submissions',use_at='Y',last_updt_pnttm=current_timestamp WHERE code_id='AMENU1' AND code='A1030403';

INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,
 kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,database_verified,contract_status,updated_by,menu_code,menu_visibility,menu_verified)
SELECT 'REGULATORY_SUBMISSION',s.step_code,a.audience,a.route_path,
       CASE a.audience WHEN 'USER' THEN '규제기관 제출·접수 업무' ELSE '규제 제출 현황 관리' END,s.actor_code,
       '확정 보고서로 제출 패키지를 만들고 제출·접수·보완·재제출·수리를 상태머신과 증적으로 통제한다.',
       '프로젝트 접근 권한과 단계별 액터 권한이 있으며 확정 보고서가 존재한다.',
       '패키지 해시, 접수번호, 보완 사유·기한, 상태 전이와 행위자 감사 이력이 저장된다.',
       '["제출기한 잔여일","접수대기 건수","보완기한 초과","수리완료율"]',
       '["프로젝트 선택","제출 패키지 생성","제출·접수·보완 처리","감사 이력"]',
       '["확정 보고서","기관 코드·명","제출 제도","보고 기간","법적 근거","제출 채널·기한","접수번호","패키지 해시","보완 사유·기한"]',
       '["패키지 생성","기관 제출","접수번호 등록","보완 요구","보완 재제출","최종 수리","취소"]',
       '["LOADING","EMPTY","ERROR","FORBIDDEN","READY","PACKAGED","SUBMITTED","RECEIVED","CORRECTION_REQUIRED","RESUBMITTED","ACCEPTED","CANCELLED"]',
       '["GET /home/api/emission-projects/{id}/regulatory-submissions","POST /home/api/emission-projects/{id}/regulatory-submissions","POST /home/api/emission-projects/{id}/regulatory-submissions/{submissionId}/transition"]',
       '["emission_regulatory_submission","emission_regulatory_submission_event","emission_project_report","emission_project_task","framework_project_actor_assignment"]',
       '["SHA-256 package hash","external receipt number","state transition event","actor and timestamp","correction reason and deadline"]',
       '360px에서는 카드·세로 흐름, 768px 이상에서는 입력 그리드, 표는 안전한 가로 스크롤로 정보 손실 없이 제공한다.',
       'KRDS 및 WCAG 2.1 AA: 레이블, 상태 텍스트, 키보드 접근, 오류 role=alert, 로딩 role=status를 제공한다.',
       '서버가 tenant·project·actor scope, 상태 전이, 멱등키, 확정 보고서 귀속을 재검증한다.',
       true,true,'REVIEW_REQUIRED','REGULATORY_SUBMISSION_IMPLEMENTATION',
       CASE a.audience WHEN 'USER' THEN 'H1020404' ELSE 'A1030403' END,'VISIBLE',true
FROM framework_process_step s CROSS JOIN (VALUES ('USER','/emission/report-submission'),('ADMIN','/admin/emission/regulatory-submissions')) a(audience,route_path)
WHERE s.process_code='REGULATORY_SUBMISSION'
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,section_contract=excluded.section_contract,field_contract=excluded.field_contract,command_contract=excluded.command_contract,state_contract=excluded.state_contract,api_contract=excluded.api_contract,data_contract=excluded.data_contract,evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,api_verified=true,database_verified=true,menu_code=excluded.menu_code,menu_visibility='VISIBLE',menu_verified=true,contract_status='REVIEW_REQUIRED',updated_by='REGULATORY_SUBMISSION_IMPLEMENTATION',updated_at=current_timestamp;

COMMENT ON TABLE emission_regulatory_submission IS '확정 보고서의 규제기관 제출 패키지, 접수, 보완, 수리 상태와 멱등성을 관리한다.';
COMMENT ON COLUMN emission_regulatory_submission.package_hash IS '보고서 버전과 제출 메타데이터를 결합한 SHA-256 불변 패키지 지문';
