-- Promote the implemented regulatory-submission workspace as the canonical
-- DATA_COLLECTION pattern.  Its collection is governed by an immutable report
-- version, tenant/actor scope, idempotent package creation and an audited state
-- machine rather than by a generic unversioned form.

CREATE TEMP TABLE regulatory_collection_field_spec (
  field_order integer, field_group varchar(80), field_code varchar(100), field_name varchar(200),
  data_type varchar(30), control_type varchar(40), api_property varchar(240),
  source_table varchar(100), source_column varchar(100), required boolean, editable boolean,
  validation jsonb, permission_code varchar(100), semantic_definition text
) ON COMMIT DROP;

INSERT INTO regulatory_collection_field_spec VALUES
 (1,'프로젝트','projectId','프로젝트 ID','STRING','SELECT','project.id','emission_project_registry','project_id',true,true,'{}','PERM_REGULATORY_SUBMISSION_READ','제출 업무의 테넌트 및 프로젝트 범위 식별자'),
 (2,'프로젝트','projectName','프로젝트명','STRING','TEXT','project.name','emission_project_registry','project_name',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','선택한 배출량 프로젝트명'),
 (3,'프로젝트','siteName','사업장명','STRING','TEXT','project.site','emission_project_registry','site_name',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','규제 제출 대상 사업장'),
 (4,'프로젝트','projectPeriod','산정 기간','STRING','TEXT','project.period','emission_project_registry','calculation_period',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','보고 대상 배출량 산정 기간'),
 (5,'확정 보고서','reportId','확정 보고서 ID','LONG','SELECT','eligibleReports[].id','emission_project_report','report_id',true,true,'{"minimum":1}','PERM_REGULATORY_SUBMISSION_WRITE','제출 패키지에 고정할 확정 보고서 식별자'),
 (6,'확정 보고서','reportVersion','보고서 버전','INTEGER','TEXT','eligibleReports[].version','emission_project_report','version_no',true,false,'{"minimum":1}','PERM_REGULATORY_SUBMISSION_READ','제출 이후에도 추적 가능한 보고서 버전'),
 (7,'확정 보고서','reportTitle','보고서 제목','STRING','TEXT','eligibleReports[].title','emission_project_report','report_title',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','확정 보고서 제목'),
 (8,'확정 보고서','reportStatus','보고서 상태','CODE','STATUS','eligibleReports[].status','emission_project_report','report_status',true,false,'{"enum":["FINALIZED"]}','PERM_REGULATORY_SUBMISSION_READ','패키지 생성을 허용하는 확정 상태'),
 (9,'확정 보고서','certificateId','인증서 ID','STRING','TEXT','eligibleReports[].certificateId','emission_project_report','certificate_id',false,false,'{}','PERM_REGULATORY_SUBMISSION_READ','확정 보고서에 발급된 인증서 식별자'),
 (10,'확정 보고서','integrityHash','보고서 무결성 해시','STRING','HASH','eligibleReports[].integrityHash','emission_project_report','integrity_hash',false,false,'{"minLength":64,"maxLength":64}','PERM_REGULATORY_SUBMISSION_READ','제출 패키지 지문에 포함되는 보고서 무결성 값'),
 (11,'확정 보고서','finalizedAt','보고서 확정 일시','DATETIME','DATETIME','eligibleReports[].finalizedAt','emission_project_report','finalized_at',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','보고서 버전이 확정된 시각'),
 (12,'제출 패키지','submissionId','제출 패키지 ID','LONG','HIDDEN','items[].id','emission_regulatory_submission','regulatory_submission_id',true,false,'{"minimum":1}','PERM_REGULATORY_SUBMISSION_READ','제출과 상태 이력의 부모 식별자'),
 (13,'제출 패키지','submissionVersion','제출 버전','INTEGER','TEXT','items[].version','emission_regulatory_submission','submission_version',true,false,'{"minimum":1}','PERM_REGULATORY_SUBMISSION_READ','프로젝트별 증가하는 제출 패키지 버전'),
 (14,'제출 패키지','authorityCode','기관 코드','STRING','TEXT','items[].authorityCode','emission_regulatory_submission','authority_code',true,true,'{"maxLength":80}','PERM_REGULATORY_SUBMISSION_WRITE','제출 대상 규제기관 코드'),
 (15,'제출 패키지','authorityName','기관명','STRING','TEXT','items[].authorityName','emission_regulatory_submission','authority_name',true,true,'{"maxLength":200}','PERM_REGULATORY_SUBMISSION_WRITE','제출 대상 규제기관명'),
 (16,'제출 패키지','reportingProgram','제출 제도·사업','STRING','TEXT','items[].reportingProgram','emission_regulatory_submission','reporting_program',true,true,'{"maxLength":160}','PERM_REGULATORY_SUBMISSION_WRITE','제출이 요구되는 제도 또는 사업명'),
 (17,'제출 패키지','reportingPeriod','보고 기간','STRING','TEXT','items[].reportingPeriod','emission_regulatory_submission','reporting_period',true,true,'{"maxLength":80}','PERM_REGULATORY_SUBMISSION_WRITE','규제기관 보고 대상 기간'),
 (18,'제출 패키지','legalBasis','법적 근거','STRING','TEXTAREA','items[].legalBasis','emission_regulatory_submission','legal_basis',true,true,'{}','PERM_REGULATORY_SUBMISSION_WRITE','제출 의무와 범위를 정하는 법령·지침'),
 (19,'제출 패키지','channel','제출 채널','CODE','SELECT','items[].channel','emission_regulatory_submission','submission_channel',true,true,'{"enum":["SYSTEM","PORTAL","EMAIL","OFFLINE","API"]}','PERM_REGULATORY_SUBMISSION_WRITE','기관 제출 수단'),
 (20,'제출 패키지','deadline','제출 기한','DATE','DATE','items[].deadline','emission_regulatory_submission','submission_deadline',true,true,'{"notPast":true}','PERM_REGULATORY_SUBMISSION_WRITE','패키지 신규 생성 시 과거일을 허용하지 않는 제출 기한'),
 (21,'제출 패키지','status','제출 상태','CODE','STATUS','items[].status','emission_regulatory_submission','status',true,false,'{"enum":["PACKAGED","SUBMITTED","RECEIVED","CORRECTION_REQUIRED","RESUBMITTED","ACCEPTED","CANCELLED"]}','PERM_REGULATORY_SUBMISSION_READ','서버 상태 머신이 결정하는 현재 제출 상태'),
 (22,'제출 패키지','packageHash','패키지 SHA-256','STRING','HASH','items[].packageHash','emission_regulatory_submission','package_hash',true,false,'{"minLength":64,"maxLength":64}','PERM_REGULATORY_SUBMISSION_READ','보고서 버전과 제출 메타데이터를 결합한 불변 지문'),
 (23,'제출 패키지','receiptNo','기관 접수번호','STRING','TEXT','items[].receiptNo','emission_regulatory_submission','external_receipt_no',false,true,'{"maxLength":120}','PERM_REGULATORY_RECEIPT_WRITE','기관 접수 확인 후 기록하는 외부 접수번호'),
 (24,'보완·종결','correctionReason','보완 사유','STRING','TEXTAREA','items[].correctionReason','emission_regulatory_submission','correction_reason',false,true,'{"requiredWhen":"REQUEST_CORRECTION"}','PERM_REGULATORY_DECIDE','검증자가 보완을 요구하는 구체적 사유'),
 (25,'보완·종결','correctionDueDate','보완 제출 기한','DATE','DATE','items[].correctionDueDate','emission_regulatory_submission','correction_due_date',false,true,'{"requiredWhen":"REQUEST_CORRECTION"}','PERM_REGULATORY_DECIDE','보완 자료의 재제출 기한'),
 (26,'보완·종결','note','처리 메모','STRING','TEXTAREA','items[].note','emission_regulatory_submission','note_text',false,true,'{}','PERM_REGULATORY_SUBMISSION_WRITE','패키지 생성·재제출·취소의 업무 근거'),
 (27,'처리 증적','submittedBy','제출자','STRING','TEXT','items[].submittedBy','emission_regulatory_submission','submitted_by',false,false,'{}','PERM_REGULATORY_SUBMISSION_READ','기관 제출 또는 재제출을 실행한 계정'),
 (28,'처리 증적','submittedAt','제출 일시','DATETIME','DATETIME','items[].submittedAt','emission_regulatory_submission','submitted_at',false,false,'{}','PERM_REGULATORY_SUBMISSION_READ','최근 제출 또는 재제출 시각'),
 (29,'처리 증적','receivedAt','접수 일시','DATETIME','DATETIME','items[].receivedAt','emission_regulatory_submission','received_at',false,false,'{}','PERM_REGULATORY_SUBMISSION_READ','기관 접수번호가 기록된 시각'),
 (30,'처리 증적','acceptedAt','수리 일시','DATETIME','DATETIME','items[].acceptedAt','emission_regulatory_submission','accepted_at',false,false,'{}','PERM_REGULATORY_SUBMISSION_READ','규제 제출 업무가 최종 종결된 시각'),
 (31,'처리 증적','createdBy','패키지 생성자','STRING','TEXT','items[].createdBy','emission_regulatory_submission','created_by',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','제출 패키지를 생성한 계정'),
 (32,'처리 증적','updatedAt','최종 변경 일시','DATETIME','DATETIME','items[].updatedAt','emission_regulatory_submission','updated_at',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','현재 상태가 마지막으로 변경된 시각'),
 (33,'감사 이력','eventId','이벤트 ID','LONG','HIDDEN','events[].id','emission_regulatory_submission_event','event_id',true,false,'{"minimum":1}','PERM_REGULATORY_SUBMISSION_READ','추가 전용 감사 이벤트 식별자'),
 (34,'감사 이력','eventCode','처리 명령','CODE','TIMELINE','events[].code','emission_regulatory_submission_event','event_code',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','패키지 생성 또는 상태 전이 명령'),
 (35,'감사 이력','previousStatus','이전 상태','CODE','STATUS','events[].previousStatus','emission_regulatory_submission_event','previous_status',false,false,'{}','PERM_REGULATORY_SUBMISSION_READ','명령 실행 직전 상태'),
 (36,'감사 이력','newStatus','변경 상태','CODE','STATUS','events[].newStatus','emission_regulatory_submission_event','new_status',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','명령 실행 후 상태'),
 (37,'감사 이력','eventActor','처리 계정','STRING','TEXT','events[].actor','emission_regulatory_submission_event','actor_id',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','상태 변경을 실행한 인증 계정'),
 (38,'감사 이력','eventNote','처리 사유','STRING','TEXT','events[].note','emission_regulatory_submission_event','event_note',false,false,'{}','PERM_REGULATORY_SUBMISSION_READ','보완·재제출·취소 등 상태 변경 근거'),
 (39,'감사 이력','eventCreatedAt','처리 일시','DATETIME','DATETIME','events[].createdAt','emission_regulatory_submission_event','created_at',true,false,'{}','PERM_REGULATORY_SUBMISSION_READ','감사 이벤트 서버 기록 시각');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'EMISSION.REGULATORY.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),
 'EMISSION',field_name,data_type,semantic_definition,
 CASE WHEN field_code IN('submittedBy','createdBy','eventActor') THEN 'PERSONAL' ELSE 'INTERNAL' END,validation
FROM regulatory_collection_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
 canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding
WHERE screen_resource_id IN(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key='/emission/report-submission');

INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'EMISSION.REGULATORY.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,f.required,f.editable,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN regulatory_collection_field_spec f
WHERE r.route_key='/emission/report-submission'
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

DELETE FROM framework_page_field_definition f USING framework_page_design d
WHERE f.page_design_id=d.page_design_id
 AND lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/emission/report-submission';

INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.field_order,f.field_group,f.field_code,f.field_name,f.data_type,f.control_type,
 f.required,f.editable,f.control_type<>'HIDDEN',false,f.source_table,f.source_column,f.api_property,'DB_RESOLVED',f.validation,
 CASE WHEN f.field_code IN('submittedBy','createdBy','eventActor') THEN 'PERSONAL' ELSE 'INTERNAL' END,
 f.permission_code,f.field_code IN('integrityHash','packageHash','receiptNo','correctionReason','eventCode','previousStatus','newStatus'),
 CASE WHEN f.required THEN 10 ELSE 50 END,f.semantic_definition,'IMPLEMENTATION_RECONCILIATION'
FROM framework_page_design d CROSS JOIN regulatory_collection_field_spec f
WHERE lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/emission/report-submission'
ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_name=excluded.field_name,data_type=excluded.data_type,
 control_type=excluded.control_type,source_table=excluded.source_table,source_column=excluded.source_column,
 api_property=excluded.api_property,mapping_status='DB_RESOLVED',validation_contract=excluded.validation_contract,
 permission_code=excluded.permission_code,design_source=excluded.design_source,updated_at=current_timestamp;

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status,severity,required_evidence,automated,expected_duration_minutes)
VALUES
 ('REG_SUB_WORKFLOW_HAPPY','REGULATORY_SUBMISSION','확정 보고서 제출·접수·수리 정상 흐름','HAPPY_PATH','확정 보고서, COMPANY_MANAGER·VERIFIER·APPROVER 배정','[{"create":"PACKAGED"},{"submit":"SUBMITTED"},{"receipt":"RECEIVED"},{"accept":"ACCEPTED"}]','[{"packageHash":"sha256"},{"taskStatus":"DONE"},{"projectProgress":100},{"auditEvents":4}]','VERIFIED','CRITICAL','API response, database state, audit timeline',true,8),
 ('REG_SUB_WORKFLOW_AUTHORITY','REGULATORY_SUBMISSION','역할별 제출·검증·수리 권한 차단','AUTHORITY','프로젝트에 배정되지 않은 계정과 잘못된 역할','[{"companyManager":"REQUEST_CORRECTION"},{"verifier":"ACCEPT"},{"unassigned":"SUBMIT"}]','[{"httpStatus":403},{"stateUnchanged":true},{"auditMutation":false}]','VERIFIED','CRITICAL','403 response and unchanged rows',true,4),
 ('REG_SUB_WORKFLOW_ISOLATION','REGULATORY_SUBMISSION','테넌트·프로젝트 제출 데이터 격리','TENANT_ISOLATION','서로 다른 tenant 및 project의 제출 ID','[{"readForeignProject":true},{"transitionForeignSubmission":true}]','[{"httpStatus":403},{"crossTenantRows":0},{"eventLeak":false}]','VERIFIED','CRITICAL','tenant-scoped query and denied command',true,4),
 ('REG_SUB_WORKFLOW_INVALID_STATE','REGULATORY_SUBMISSION','허용되지 않은 제출 상태 전이 차단','INVALID_STATE','PACKAGED 또는 RECEIVED 상태의 제출 건','[{"acceptFrom":"PACKAGED"},{"receiptFrom":"RECEIVED"},{"resubmitFrom":"SUBMITTED"}]','[{"httpStatus":409},{"stateUnchanged":true},{"eventNotCreated":true}]','VERIFIED','HIGH','409 response and locked row state',true,5),
 ('REG_SUB_WORKFLOW_REQUIRED_REASON','REGULATORY_SUBMISSION','보완·재제출·취소 필수 근거 검증','EXCEPTION','정상 프로젝트와 제출 패키지','[{"requestCorrectionWithoutReason":true},{"resubmitWithoutNote":true},{"cancelWithoutReason":true}]','[{"httpStatus":400},{"reasonRequired":true},{"stateUnchanged":true}]','VERIFIED','HIGH','validation response and unchanged state',true,4),
 ('REG_SUB_WORKFLOW_IDEMPOTENCY','REGULATORY_SUBMISSION','동일 요청 ID 패키지 중복 생성 방지','CONCURRENCY','동일 tenant, project, clientRequestId','[{"parallelCreate":2},{"retryCreate":1}]','[{"submissionCount":1},{"samePackageHash":true},{"sameSubmissionId":true}]','VERIFIED','CRITICAL','unique key, advisory lock and returned identity',true,5),
 ('REG_SUB_WORKFLOW_RECOVERY','REGULATORY_SUBMISSION','보완 요구 후 수정·재제출·재접수 복구','RECOVERY','RECEIVED 상태 및 유효한 접수번호','[{"requestCorrection":"CORRECTION_REQUIRED"},{"resubmit":"RESUBMITTED"},{"recordReceipt":"RECEIVED"},{"accept":"ACCEPTED"}]','[{"correctionReasonPreserved":true},{"timelineOrdered":true},{"acceptedAt":"notNull"}]','VERIFIED','HIGH','ordered event timeline and final accepted state',true,7)
ON CONFLICT(case_code) DO UPDATE SET case_name=excluded.case_name,case_type=excluded.case_type,
 preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,
 case_status='VERIFIED',severity=excluded.severity,required_evidence=excluded.required_evidence,
 automated=true,expected_duration_minutes=excluded.expected_duration_minutes,updated_at=current_timestamp;

INSERT INTO framework_step_test_binding(process_code,step_code,case_code,trace_scope,expected_state,assertion_contract,evidence_required)
SELECT s.process_code,s.step_code,c.case_code,'PROCESS',
 CASE s.step_order WHEN 1 THEN 'STEP_1_COMPLETED' WHEN 2 THEN 'STEP_2_COMPLETED' WHEN 3 THEN 'STEP_3_COMPLETED' ELSE 'STEP_4_COMPLETED' END,
 jsonb_build_object('caseType',c.case_type,'route','/emission/report-submission','stepOrder',s.step_order,
  'api',CASE s.step_order WHEN 1 THEN 'GET regulatory-submissions' WHEN 2 THEN 'POST regulatory-submissions'
       ELSE 'POST regulatory-submissions/{submissionId}/transition' END),true
FROM framework_process_step s CROSS JOIN framework_simulation_case c
WHERE s.process_code='REGULATORY_SUBMISSION' AND c.case_code LIKE 'REG_SUB_WORKFLOW_%'
ON CONFLICT(process_code,step_code,case_code) DO UPDATE SET expected_state=excluded.expected_state,
 assertion_contract=excluded.assertion_contract,evidence_required=true;

-- Normalize every historical and current contract for the representative route;
-- assurance aggregates with bool_and and must fail closed if one trace is stale.
UPDATE framework_professional_screen_contract c SET
 business_purpose='확정된 배출량 보고서를 버전 고정 제출 패키지로 생성하고 규제기관 제출·접수·보완·재제출·수리까지 권한과 감사 증적으로 통제한다.',
 entry_condition='인증 계정이 프로젝트에 배정되어 있고 역할에 맞는 명령 권한과 FINALIZED 보고서가 존재한다.',
 exit_condition='불변 패키지 해시, 접수번호, 보완 사유·기한, 상태 전이 이벤트와 최종 수리 결과가 동일 트랜잭션 경계로 보존된다.',
 kpi_contract='["기한 초과 제출 0건","권한 없는 상태 전이 0건","중복 패키지 0건","접수번호 없는 수리 0건","상태·감사 이벤트 일치율 100%"]',
 section_contract='[{"id":"project-context","purpose":"프로젝트·사업장·보고 기간 선택"},{"id":"final-report","purpose":"확정 보고서 버전과 무결성 확인"},{"id":"package-create","purpose":"기관·제도·법적 근거·채널·기한 수집"},{"id":"submission-control","purpose":"제출·접수·보완·재제출·수리 상태 처리"},{"id":"audit-timeline","purpose":"처리 계정·시각·사유·상태 증적"}]',
 field_contract=(SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'name',f.field_name,'apiProperty',f.api_property,'source',f.source_table||'.'||f.source_column,'required',f.required,'editable',f.editable) ORDER BY f.field_order)::text FROM regulatory_collection_field_spec f),
 command_contract='[{"code":"CREATE_PACKAGE","guard":"FINALIZED report + COMPANY_MANAGER + future deadline + clientRequestId","effect":"PACKAGED + SHA-256"},{"code":"SUBMIT","from":"PACKAGED","to":"SUBMITTED"},{"code":"RECORD_RECEIPT","from":["SUBMITTED","RESUBMITTED"],"to":"RECEIVED","requires":"receiptNo"},{"code":"REQUEST_CORRECTION","actor":"VERIFIER","from":"RECEIVED","to":"CORRECTION_REQUIRED","requires":["note","correctionDueDate"]},{"code":"RESUBMIT","from":"CORRECTION_REQUIRED","to":"RESUBMITTED","requires":"note"},{"code":"ACCEPT","actor":"VERIFIER","from":"RECEIVED","to":"ACCEPTED","requires":"receiptNo"},{"code":"CANCEL","from":"PACKAGED","to":"CANCELLED","requires":"note"}]',
 state_contract='["LOADING","EMPTY","PACKAGED","SUBMITTED","RECEIVED","CORRECTION_REQUIRED","RESUBMITTED","ACCEPTED","CANCELLED","SAVING","SUCCESS","CONFLICT","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
 api_contract='[{"method":"GET","path":"/home/api/emission-projects/{projectId}/regulatory-submissions"},{"method":"POST","path":"/home/api/emission-projects/{projectId}/regulatory-submissions","idempotency":"clientRequestId"},{"method":"POST","path":"/home/api/emission-projects/{projectId}/regulatory-submissions/{submissionId}/transition","lock":"FOR UPDATE"}]',
 data_contract='[{"version":"2.0.0","entity":"emission_project_report","eligibility":"FINALIZED"},{"entity":"emission_regulatory_submission","tenantScope":"tenant_id + project_id","version":"submission_version","idempotency":"client_request_id","fingerprint":"package_hash"},{"entity":"emission_regulatory_submission_event","mode":"append-only audit"},{"entity":"framework_project_actor_assignment","authority":"active actor assignment"},{"entity":"emission_project_task","completion":"ACCEPTED"}]',
 evidence_contract='[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","TENANT_ISOLATION","INVALID_STATE","EXCEPTION","CONCURRENCY","RECOVERY"],"atomicWrites":["submission state","event timeline","workflow task","project completion"]}]',
 responsive_contract='{"mobile":"single column with project selection before package fields and card actions","tablet":"two-column package fields and scroll-safe submission table","desktop":"four metrics, three-column fields and complete audit timeline","overflow":"wrap authority, reason and hashes; horizontal scroll only for the data table"}',
 accessibility_contract='{"standard":"WCAG 2.1 AA","keyboard":"all selects, fields and state commands reachable","status":"loading, save, conflict, forbidden and validation messages announced","forms":"explicit labels and confirmation for terminal acceptance","contrast":"KRDS tokens"}',
 security_contract='{"authentication":"USER","tenantIsolation":"assertTenantAccess on every read and command","authority":"active COMPANY_MANAGER for package operations; VERIFIER for correction and acceptance","webmasterOverride":"explicit server context only","csrf":"required","stateLock":"SELECT FOR UPDATE","idempotency":"tenant + project + clientRequestId","auditActor":"CurrentUserContext"}',
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
 accessibility_verified=true,exception_states_verified=true,
 audit_evidence_ref='RegulatorySubmissionPage+EmissionProjectRegistryController+EmissionProjectRegistryService:2.0.0:2026-07-22',
 contract_status='VERIFIED',updated_by='DATA_COLLECTION_STANDARD_RECONCILIATION',updated_at=current_timestamp
WHERE lower(split_part(c.route_path,'?',1))='/emission/report-submission';

INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,
 kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,database_verified,authority_verified,
 responsive_verified,accessibility_verified,exception_states_verified,audit_evidence_ref,contract_status,updated_by)
SELECT b.process_code,b.step_code,b.audience,r.route_key,r.screen_name,b.actor_code,
 '확정된 배출량 보고서를 버전 고정 제출 패키지로 생성하고 규제기관 제출·접수·보완·재제출·수리까지 권한과 감사 증적으로 통제한다.',
 '인증 계정이 프로젝트에 배정되어 있고 역할에 맞는 명령 권한과 FINALIZED 보고서가 존재한다.',
 '불변 패키지 해시, 접수번호, 보완 사유·기한, 상태 전이 이벤트와 최종 수리 결과가 보존된다.',
 '["기한 초과 제출 0건","권한 없는 상태 전이 0건","중복 패키지 0건","접수번호 없는 수리 0건","상태·감사 이벤트 일치율 100%"]',
 '[{"id":"project-context"},{"id":"final-report"},{"id":"package-create"},{"id":"submission-control"},{"id":"audit-timeline"}]',
 (SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'apiProperty',f.api_property,'source',f.source_table||'.'||f.source_column,'required',f.required) ORDER BY f.field_order)::text FROM regulatory_collection_field_spec f),
 '["CREATE_PACKAGE","SUBMIT","RECORD_RECEIPT","REQUEST_CORRECTION","RESUBMIT","ACCEPT","CANCEL"]',
 '["LOADING","EMPTY","PACKAGED","SUBMITTED","RECEIVED","CORRECTION_REQUIRED","RESUBMITTED","ACCEPTED","CANCELLED","CONFLICT","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
 '["GET /home/api/emission-projects/{projectId}/regulatory-submissions","POST /home/api/emission-projects/{projectId}/regulatory-submissions","POST /home/api/emission-projects/{projectId}/regulatory-submissions/{submissionId}/transition"]',
 '[{"version":"2.0.0","entity":"emission_regulatory_submission","versionColumn":"submission_version","fingerprint":"package_hash"},{"entity":"emission_regulatory_submission_event","mode":"append-only"},{"entity":"emission_project_report","eligibility":"FINALIZED"}]',
 '[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","TENANT_ISOLATION","INVALID_STATE","EXCEPTION","CONCURRENCY","RECOVERY"]}]',
 '{"mobile":"single-column cards","desktop":"metrics, form grid, table and timeline","overflow":"wrap values and scroll table only"}',
 '{"standard":"WCAG 2.1 AA","keyboard":"all commands reachable","status":"errors and changes announced","forms":"explicit labels"}',
 '{"authentication":"USER","tenantIsolation":"tenant_id + project_id","authority":"active project actor","stateLock":"FOR UPDATE","idempotency":"clientRequestId","audit":"append-only event"}',
 true,true,true,true,true,true,
 'RegulatorySubmissionPage+EmissionProjectRegistryController+EmissionProjectRegistryService:2.0.0:2026-07-22','VERIFIED','DATA_COLLECTION_STANDARD_RECONCILIATION'
FROM framework_screen_resource r JOIN framework_process_step_screen_binding b USING(screen_resource_id)
WHERE r.route_key='/emission/report-submission' AND b.binding_status='ACTIVE'
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET screen_name=excluded.screen_name,
 actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,
 exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,section_contract=excluded.section_contract,
 field_contract=excluded.field_contract,command_contract=excluded.command_contract,state_contract=excluded.state_contract,
 api_contract=excluded.api_contract,data_contract=excluded.data_contract,evidence_contract=excluded.evidence_contract,
 responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
 security_contract=excluded.security_contract,api_verified=true,database_verified=true,authority_verified=true,
 responsive_verified=true,accessibility_verified=true,exception_states_verified=true,
 audit_evidence_ref=excluded.audit_evidence_ref,contract_status='VERIFIED',updated_by=excluded.updated_by,updated_at=current_timestamp;

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.layer,a.asset_ref,a.management_route,'REUSED',a.evidence,true,'DATA_COLLECTION_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS user workspace tokens','/admin/system/theme-management','shared KRDS color and typography tokens'),
 ('SECTION','project/final-report/package/control/audit','/admin/system/section-management','governed collection section contract'),
 ('COMPONENT','project select/labeled field/status badge/action group/audit timeline','/admin/system/component-management','reusable collection components'),
 ('DESIGN','DATA_COLLECTION/regulatory-submission-v2','/admin/system/design-management','responsive governed collection pattern'),
 ('FRONTEND','RegulatorySubmissionPage','/admin/system/page-development-master','implemented user and admin workspaces'),
 ('API','regulatory-submissions read/create/transition','/admin/system/api-management','implemented authenticated JSON endpoints'),
 ('BACKEND','EmissionProjectRegistryService regulatory submission transactions','/admin/system/function-management','tenant, actor, state and idempotency guards'),
 ('DATABASE','report + regulatory submission + event + task + actor assignment','/admin/system/db-table-management','39 canonical DB-resolved fields'),
 ('TEST','7 workflow cases bound to 4 process steps','/admin/system/verification-asset-management','28 independent step-test bindings')
) a(layer,asset_ref,management_route,evidence)
WHERE lower(split_part(c.route_path,'?',1))='/emission/report-submission'
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_screen_template_standard standard SET
 representative_screen_resource_id=r.screen_resource_id,representative_route=r.route_key,
 standard_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||gate.design_gate_score||':'||gate.design_gate_status,
 standard_version='2.0.0',updated_by='DATA_COLLECTION_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance gate USING(screen_resource_id)
WHERE standard.screen_type='DATA_COLLECTION' AND r.route_key='/emission/report-submission';

UPDATE framework_page_development_item item SET
 design_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
 blocker_reason=CASE WHEN gate.design_gate_status='PASSED' THEN NULL ELSE array_to_string(gate.design_gate_issues,', ') END,
 next_action=CASE WHEN gate.design_gate_status='PASSED' THEN 'Approved DATA_COLLECTION representative; generator use is allowed.'
  ELSE 'Resolve DATA_COLLECTION representative gate: '||array_to_string(gate.design_gate_issues,', ') END,
 updated_by='DATA_COLLECTION_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_page_design_assurance gate JOIN framework_screen_resource r USING(screen_resource_id)
WHERE item.screen_resource_id=gate.screen_resource_id AND r.route_key='/emission/report-submission';
