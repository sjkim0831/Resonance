-- Promote the implemented project verification/approval route as the
-- REVIEW_DECISION representative. The screen reads and writes the same
-- tenant-scoped submission, decision, actor, and immutable calculation data.

CREATE TEMP TABLE review_decision_field_spec (
  field_order integer, field_group varchar(80), field_code varchar(100), field_name varchar(200),
  data_type varchar(30), control_type varchar(40), api_property varchar(240),
  source_table varchar(100), source_column varchar(100), required boolean, editable boolean,
  validation jsonb, permission_code varchar(100), semantic_definition text
) ON COMMIT DROP;

INSERT INTO review_decision_field_spec VALUES
 (1,'프로젝트','projectId','프로젝트 ID','STRING','HIDDEN','project.id','emission_project_registry','project_id',true,false,'{}','PERM_EMISSION_REVIEW_READ','검증·승인 대상 프로젝트의 테넌트 범위 식별자'),
 (2,'프로젝트','projectName','프로젝트명','STRING','TEXT','project.name','emission_project_registry','project_name',true,false,'{}','PERM_EMISSION_REVIEW_READ','검증·승인 대상 프로젝트명'),
 (3,'프로젝트','siteName','사업장명','STRING','TEXT','project.site','emission_project_registry','site_name',true,false,'{}','PERM_EMISSION_REVIEW_READ','산정 및 검증 범위 사업장'),
 (4,'제출 버전','submissionId','제출본 ID','LONG','SELECT','submissions[].id','emission_activity_submission','submission_id',true,true,'{"minimum":1}','PERM_EMISSION_REVIEW_READ','결정 대상 활동자료 제출본의 불변 식별자'),
 (5,'제출 버전','submissionVersion','제출 버전','INTEGER','TEXT','submissions[].version','emission_activity_submission','version_no',true,false,'{"minimum":1}','PERM_EMISSION_REVIEW_READ','재제출 때 증가하는 활동자료 제출 버전'),
 (6,'제출 버전','submissionState','제출 상태','CODE','STATUS','submissions[].state','emission_activity_submission','submission_state',true,false,'{"enum":["SUBMITTED","IN_VERIFICATION","VERIFIED","CORRECTION_REQUIRED","APPROVED"]}','PERM_EMISSION_REVIEW_READ','허용된 검증·승인 명령을 결정하는 현재 상태'),
 (7,'제출 버전','submittedActor','제출자','STRING','TEXT','submissions[].submittedActor','emission_activity_submission','submitted_actor',true,false,'{}','PERM_EMISSION_REVIEW_READ','해당 버전을 제출한 계정'),
 (8,'제출 버전','submittedAt','제출 일시','DATETIME','DATETIME','submissions[].submittedAt','emission_activity_submission','submitted_at',true,false,'{}','PERM_EMISSION_REVIEW_READ','해당 버전이 검토 대기 상태로 제출된 시각'),
 (9,'검토 입력','decision','결정','CODE','ACTION_GROUP','command.decision','emission_submission_review','decision',true,true,'{"enum":["STARTED","PASSED","CORRECTION_REQUESTED","APPROVED","REJECTED"]}','PERM_EMISSION_REVIEW_DECIDE','상태와 액터 권한으로 제한되는 검증 또는 승인 결정'),
 (10,'검토 입력','reviewComment','검토 의견','STRING','TEXTAREA','command.comment','emission_submission_review','comment_text',false,true,'{"maxLength":4000,"requiredWhen":["CORRECTION_REQUESTED","REJECTED"]}','PERM_EMISSION_REVIEW_DECIDE','보완 요청과 반려 때 반드시 저장하는 구체적 사유'),
 (11,'검토 입력','issueCount','오류 건수','INTEGER','NUMBER','command.issueCount','emission_submission_review','issue_count',true,true,'{"minimum":0}','PERM_EMISSION_VERIFY','검증 결정 시 확인한 차단·보완 오류 수'),
 (12,'검토 이력','reviewId','검토 이력 ID','LONG','HIDDEN','reviews[].id','emission_submission_review','review_id',true,false,'{"minimum":1}','PERM_EMISSION_REVIEW_READ','추가 전용 검토 결정 이력 식별자'),
 (13,'검토 이력','reviewStage','검토 단계','CODE','STATUS','reviews[].stage','emission_submission_review','review_stage',true,false,'{"enum":["VERIFICATION","APPROVAL"]}','PERM_EMISSION_REVIEW_READ','검증자 결정과 승인자 결정을 분리하는 단계'),
 (14,'검토 이력','reviewerId','검토자','STRING','TEXT','reviews[].reviewer','emission_submission_review','reviewer_id',true,false,'{}','PERM_EMISSION_REVIEW_READ','결정을 수행한 인증 계정'),
 (15,'검토 이력','reviewCreatedAt','결정 일시','DATETIME','DATETIME','reviews[].createdAt','emission_submission_review','created_at',true,false,'{}','PERM_EMISSION_REVIEW_READ','검토 결정이 서버에 기록된 시각'),
 (16,'검토 이력','reviewCalculationId','산정 버전 ID','LONG','LINK','reviews[].calculationId','emission_submission_review','calculation_id',false,false,'{"minimum":1}','PERM_EMISSION_REVIEW_READ','승인 결정이 잠그는 산정 실행 식별자'),
 (17,'액터 권한','actorCode','배정 액터','CODE','BADGE_LIST','actors[].actorCode','framework_project_actor_assignment','actor_code',true,false,'{"enum":["VERIFIER","APPROVER"]}','PERM_EMISSION_REVIEW_READ','프로젝트에 배정된 검증자 또는 승인자 역할'),
 (18,'액터 권한','actorUserId','배정 사용자','STRING','TEXT','actors[].userId','framework_project_actor_assignment','user_id',true,false,'{}','PERM_EMISSION_REVIEW_READ','프로젝트 액터 역할을 수행할 수 있는 계정'),
 (19,'액터 권한','actorActiveYn','액터 활성 여부','BOOLEAN','STATUS','actors[].activeYn','framework_project_actor_assignment','active_yn',true,false,'{}','PERM_EMISSION_REVIEW_READ','현재 결정 권한에 포함되는 활성 배정 여부'),
 (20,'산정 잠금','calculationId','산정 실행 ID','LONG','HIDDEN','latestCalculation.id','emission_calculation_run','calculation_id',true,false,'{"minimum":1}','PERM_EMISSION_REVIEW_READ','제출본 검증과 승인에 연결되는 최신 산정 실행'),
 (21,'산정 잠금','calculationVersion','산정 버전','INTEGER','TEXT','latestCalculation.version','emission_calculation_run','version_no',true,false,'{"minimum":1}','PERM_EMISSION_REVIEW_READ','승인 대상 산정 결과 버전'),
 (22,'산정 잠금','totalEmission','총 배출량','DECIMAL','NUMBER','latestCalculation.totalEmission','emission_calculation_run','total_emission',true,false,'{"minimum":0}','PERM_EMISSION_REVIEW_READ','승인 전에 검증할 산정 버전 총 배출량'),
 (23,'산정 잠금','snapshotHash','입력 지문','STRING','HASH','latestCalculation.snapshotHash','emission_calculation_run','snapshot_hash',true,false,'{"minLength":32}','PERM_EMISSION_REVIEW_READ','산정 입력의 변경 여부를 검출하는 지문'),
 (24,'산정 잠금','lockedAt','잠금 일시','DATETIME','DATETIME','latestCalculation.lockedAt','emission_calculation_run','locked_at',false,false,'{}','PERM_EMISSION_REVIEW_READ','승인된 산정 버전이 불변 처리된 시각'),
 (25,'산정 잠금','lockedBy','잠금 수행자','STRING','TEXT','latestCalculation.lockedBy','emission_calculation_run','locked_by',false,false,'{}','PERM_EMISSION_REVIEW_READ','산정 버전 잠금을 발생시킨 승인자'),
 (26,'상태 감사','eventType','상태 이벤트','CODE','TIMELINE','events[].eventType','emission_activity_submission_event','event_type',true,false,'{}','PERM_EMISSION_REVIEW_READ','검증 시작·통과·보완 요청·승인·반려 이벤트'),
 (27,'상태 감사','previousState','이전 상태','CODE','STATUS','events[].previousState','emission_activity_submission_event','previous_state',true,false,'{}','PERM_EMISSION_REVIEW_READ','명령 실행 직전 제출본 상태'),
 (28,'상태 감사','newState','변경 상태','CODE','STATUS','events[].newState','emission_activity_submission_event','new_state',true,false,'{}','PERM_EMISSION_REVIEW_READ','명령 실행 후 제출본 상태'),
 (29,'상태 감사','eventActor','상태 변경자','STRING','TEXT','events[].eventActor','emission_activity_submission_event','event_actor',true,false,'{}','PERM_EMISSION_REVIEW_READ','상태 전이를 수행한 인증 계정'),
 (30,'상태 감사','eventNote','상태 변경 사유','STRING','TEXT','events[].eventNote','emission_activity_submission_event','event_note',false,false,'{}','PERM_EMISSION_REVIEW_READ','보완·반려 사유를 포함한 상태 전이 근거');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'EMISSION.REVIEW.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),
 'EMISSION',field_name,data_type,semantic_definition,
 CASE WHEN field_code IN('submittedActor','reviewerId','actorUserId','lockedBy','eventActor') THEN 'PERSONAL' ELSE 'INTERNAL' END,validation
FROM review_decision_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
 canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding
WHERE screen_resource_id IN(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key='/emission/validate');

INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'EMISSION.REVIEW.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,
 f.required,f.editable,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN review_decision_field_spec f
WHERE r.route_key='/emission/validate'
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

DELETE FROM framework_page_field_definition f USING framework_page_design d
WHERE f.page_design_id=d.page_design_id
 AND lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/emission/validate';

INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.field_order,f.field_group,f.field_code,f.field_name,f.data_type,f.control_type,
 f.required,f.editable,f.control_type NOT IN('HIDDEN'),false,f.source_table,f.source_column,f.api_property,'DB_RESOLVED',f.validation,
 CASE WHEN f.field_code IN('submittedActor','reviewerId','actorUserId','lockedBy','eventActor') THEN 'PERSONAL' ELSE 'INTERNAL' END,
 f.permission_code,f.field_code IN('decision','reviewComment','snapshotHash','previousState','newState'),
 CASE WHEN f.required THEN 10 ELSE 50 END,f.semantic_definition,'IMPLEMENTATION_RECONCILIATION'
FROM framework_page_design d CROSS JOIN review_decision_field_spec f
WHERE lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/emission/validate'
ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_name=excluded.field_name,data_type=excluded.data_type,
 control_type=excluded.control_type,source_table=excluded.source_table,source_column=excluded.source_column,
 api_property=excluded.api_property,mapping_status='DB_RESOLVED',validation_contract=excluded.validation_contract,
 permission_code=excluded.permission_code,design_source=excluded.design_source,updated_at=current_timestamp;

-- One complete contract per active process-step binding is required because the
-- same professional screen executes verification and approval for several flows.
UPDATE framework_professional_screen_contract c SET
 business_purpose='테넌트 범위의 제출 버전과 산정 결과를 독립 검증하고, 보완 요청 또는 통과 후 승인자가 결과 버전을 확정·잠금한다.',
 entry_condition=CASE WHEN c.actor_code='APPROVER' THEN '제출본이 VERIFIED 상태이고 프로젝트 APPROVER 배정과 최신 산정 버전이 존재한다.' ELSE '제출본이 SUBMITTED 또는 IN_VERIFICATION 상태이고 프로젝트 VERIFIER 배정과 산정 결과가 존재한다.' END,
 exit_condition=CASE WHEN c.actor_code='APPROVER' THEN '승인 또는 반려 결정, 사유, 승인자, 산정 버전 잠금과 상태 이벤트가 하나의 트랜잭션으로 저장된다.' ELSE '검증 통과 또는 보완 요청, 오류 수, 의견, 검증자와 상태 이벤트가 하나의 트랜잭션으로 저장된다.' END,
 kpi_contract='["권한 없는 결정 0건","상태 전이 오류 0건","사유 없는 보완·반려 0건","승인 산정 버전 잠금률 100%","결정·이벤트 감사 일치율 100%"]',
 section_contract='[{"id":"project-context","purpose":"프로젝트·사업장·액터 범위"},{"id":"submission-versions","purpose":"제출 버전과 현재 상태 선택"},{"id":"decision-panel","purpose":"상태·액터별 허용 명령과 필수 의견"},{"id":"calculation-evidence","purpose":"총 배출량·입력 지문·산정 버전 검토"},{"id":"review-history","purpose":"검증·승인 결정 이력"},{"id":"state-audit","purpose":"이전·신규 상태와 수행자 감사"}]',
 field_contract=(SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'name',f.field_name,'apiProperty',f.api_property,'source',f.source_table||'.'||f.source_column,'required',f.required) ORDER BY f.field_order)::text FROM review_decision_field_spec f),
 command_contract='[{"code":"START_VERIFICATION","guard":"SUBMITTED + VERIFIER","api":"POST /home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/start"},{"code":"PASS_VERIFICATION","guard":"IN_VERIFICATION + VERIFIER","api":"POST .../verification/decision","payload":{"decision":"PASSED"}},{"code":"REQUEST_CORRECTION","guard":"IN_VERIFICATION + VERIFIER + comment","api":"POST .../verification/decision","payload":{"decision":"CORRECTION_REQUESTED"}},{"code":"APPROVE","guard":"VERIFIED + APPROVER","api":"POST .../approval/decision","payload":{"decision":"APPROVED"}},{"code":"REJECT","guard":"VERIFIED + APPROVER + comment","api":"POST .../approval/decision","payload":{"decision":"REJECTED"}}]',
 state_contract='["LOADING","EMPTY","SUBMITTED","IN_VERIFICATION","VERIFIED","CORRECTION_REQUIRED","APPROVED","SAVING","SUCCESS","CONFLICT","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
 api_contract='[{"method":"GET","path":"/home/api/emission-projects/{projectId}/review-workflow"},{"method":"POST","path":"/home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/start"},{"method":"POST","path":"/home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/decision"},{"method":"POST","path":"/home/api/emission-projects/{projectId}/submissions/{submissionId}/approval/decision"}]',
 data_contract='[{"entity":"emission_activity_submission","version":"version_no","tenantScope":"tenant_id + project_id","lock":"FOR UPDATE"},{"entity":"emission_submission_review","mode":"append-only decision history"},{"entity":"emission_activity_submission_event","mode":"append-only state audit"},{"entity":"emission_calculation_run","version":"version_no","approvalEffect":"locked_at + locked_by"},{"entity":"framework_project_actor_assignment","authority":"active VERIFIER or APPROVER"}]',
 evidence_contract='[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","TENANT_ISOLATION","INVALID_STATE","REQUIRED_REASON","CONCURRENT_DECISION","RECOVERY"],"atomicWrites":["submission state","review history","state event","workflow task","calculation lock"]}]',
 responsive_contract='{"mobile":"single column; version selector before decision controls; table horizontal scroll only","tablet":"stacked project context and decision panel","desktop":"version rail with decision workspace","overflow":"wrap identifiers and comments; never clip action labels"}',
 accessibility_contract='{"standard":"WCAG 2.1 AA","keyboard":"version and decision controls keyboard reachable","status":"save, conflict, forbidden and validation messages announced","forms":"explicit labels and error association","contrast":"KRDS tokens"}',
 security_contract='{"authentication":"USER","tenantIsolation":"project tenant asserted on every read and command","authority":"framework_project_actor_assignment active VERIFIER or APPROVER","webmasterOverride":"explicit server context only","csrf":"required","stateLock":"SELECT FOR UPDATE","reasonRequired":["CORRECTION_REQUESTED","REJECTED"],"auditActor":"CurrentUserContext"}',
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
 accessibility_verified=true,exception_states_verified=true,
 audit_evidence_ref='EmissionProjectReviewPage+EmissionProjectRegistryController+EmissionProjectRegistryService:2.0.0:2026-07-22',
 contract_status='VERIFIED',updated_by='REVIEW_DECISION_STANDARD_RECONCILIATION',updated_at=current_timestamp
WHERE lower(split_part(c.route_path,'?',1))='/emission/validate';

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.layer,a.asset_ref,a.management_route,'REUSED',a.evidence,true,'REVIEW_DECISION_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS workspace typography and government tokens','/admin/system/theme-management','shared KRDS token contract'),
 ('SECTION','project context/submission rail/decision/evidence/history/audit','/admin/system/section-management','professional decision section contract'),
 ('COMPONENT','status badge/action group/reason input/history table','/admin/system/component-management','reusable decision components'),
 ('DESIGN','REVIEW_DECISION/emission-project-v2','/admin/system/design-management','responsive review-decision pattern'),
 ('FRONTEND','EmissionProjectReviewPage','/admin/system/page-development-master','implemented localized route and guarded controls'),
 ('API','review-workflow + verification + approval commands','/admin/system/api-management','implemented JSON endpoints'),
 ('BACKEND','EmissionProjectRegistryService transactional review workflow','/admin/system/function-management','tenant, actor and state guards'),
 ('DATABASE','submission + review + event + calculation + actor assignment','/admin/system/db-table-management','30 canonical DB-resolved fields'),
 ('TEST','linked process-step simulation cases','/admin/system/verification-asset-management','independent happy, authority and exception scenarios')
) a(layer,asset_ref,management_route,evidence)
WHERE lower(split_part(c.route_path,'?',1))='/emission/validate'
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_screen_template_standard standard SET
 representative_screen_resource_id=r.screen_resource_id,representative_route=r.route_key,
 standard_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||gate.design_gate_score||':'||gate.design_gate_status,
 standard_version='2.0.0',updated_by='REVIEW_DECISION_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance gate USING(screen_resource_id)
WHERE standard.screen_type='REVIEW_DECISION' AND r.route_key='/emission/validate';

UPDATE framework_page_development_item item SET
 design_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
 blocker_reason=CASE WHEN gate.design_gate_status='PASSED' THEN NULL ELSE array_to_string(gate.design_gate_issues,', ') END,
 next_action=CASE WHEN gate.design_gate_status='PASSED' THEN 'Approved REVIEW_DECISION representative; generator use is allowed.'
  ELSE 'Resolve REVIEW_DECISION representative gate: '||array_to_string(gate.design_gate_issues,', ') END,
 updated_by='REVIEW_DECISION_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_page_design_assurance gate JOIN framework_screen_resource r USING(screen_resource_id)
WHERE item.screen_resource_id=gate.screen_resource_id AND r.route_key='/emission/validate';
