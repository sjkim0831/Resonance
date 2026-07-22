-- Canonical PROCESS_STEP_WORKSPACE: an actor-scoped, project-scoped state
-- transition workspace backed by the real process execution ledger.

INSERT INTO framework_screen_resource(route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
 responsive_contract,accessibility_contract,security_contract)
VALUES('/admin/system/process-step-workspace','프로세스 단계 실행 작업공간','PROCESS_STEP_WORKSPACE','VERIFIED','REACT_SOURCE',
 'features/process-step-workspace/ProcessStepWorkspacePage.tsx',
 '{"mobile":"ordered step cards then work form","tablet":"step rail and work detail","desktop":"320px step rail plus execution workspace","overflow":"tables scroll locally; text wraps"}',
 '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"focusVisible":true,"tableHeaders":true}',
 '{"authentication":"ADMIN","tenantIsolation":true,"projectIsolation":true,"actorAssignment":true,"serverStateTransition":true,"idempotency":true,"audit":true}')
ON CONFLICT(route_key) DO UPDATE SET screen_name=excluded.screen_name,screen_type='PROCESS_STEP_WORKSPACE',
 implementation_status='VERIFIED',source_kind='REACT_SOURCE',source_ref=excluded.source_ref,
 responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
 security_contract=excluded.security_contract,updated_at=current_timestamp;

INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
 initial_view,context_contract,visibility_contract,completion_contract,guide_contract,binding_status)
SELECT 'EMISSION_PROJECT','EMISSION_PROJECT_COLLECT',r.screen_resource_id,'ADMIN','SITE_DATA_OWNER','SUPPORT','STEP_EXECUTION',
 '{"tenantId":"required project scope","projectId":"required actor assignment","processCode":"required","stepCode":"selected or current execution"}',
 '{"authentication":true,"route":"hidden dependent route","actor":"active assignment for at least one process step"}',
 '{"command":"framework_process_step.command_code","state":"to_state","evidence":"execution event + request/result snapshots","handoff":"next step and actor"}',
 '{"sequence":["select process context","load or start execution","select current step","record work and evidence","validate and complete","continue with next actor task"]}',
 'ACTIVE'
FROM framework_screen_resource r WHERE r.route_key='/admin/system/process-step-workspace'
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET actor_code='SITE_DATA_OWNER',
 entry_mode='SUPPORT',initial_view='STEP_EXECUTION',context_contract=excluded.context_contract,
 visibility_contract=excluded.visibility_contract,completion_contract=excluded.completion_contract,
 guide_contract=excluded.guide_contract,binding_status='ACTIVE',updated_at=current_timestamp;

CREATE TEMP TABLE process_step_workspace_field_spec(
 field_order integer,field_group varchar(60),field_code varchar(100),field_name varchar(160),data_type varchar(30),
 control_type varchar(40),api_property varchar(200),source_table varchar(100),source_column varchar(100),required boolean,
 editable boolean,validation jsonb,semantic_definition text
) ON COMMIT DROP;

INSERT INTO process_step_workspace_field_spec VALUES
 (1,'CONTEXT','tenantId','테넌트 ID','STRING','TEXT','query.tenantId','framework_account_actor_assignment','tenant_id',true,true,'{"minLength":1}','프로젝트와 계정의 데이터 격리 범위'),
 (2,'CONTEXT','projectId','프로젝트 ID','STRING','TEXT','query.projectId','framework_process_execution','project_id',true,true,'{"minLength":1}','업무 실행이 귀속되는 프로젝트 식별자'),
 (3,'CONTEXT','processCode','프로세스 코드','STRING','SELECT','query.processCode','framework_process_definition','process_code',true,true,'{"minLength":1}','실행할 전문 업무 프로세스 식별자'),
 (4,'CONTEXT','processName','프로세스명','STRING','TEXT','processes[].processName','framework_process_definition','process_name',true,false,'{}','선택한 고객 업무 프로세스명'),
 (5,'CONTEXT','processVersion','프로세스 버전','STRING','TEXT','processes[].version','framework_process_definition','process_version',true,false,'{}','상태 전이와 감사에 적용되는 계약 버전'),
 (6,'EXECUTION','executionId','실행 ID','UUID','TEXT','execution.executionId','framework_process_execution','execution_id',false,false,'{}','프로세스 실행 및 이벤트의 상위 식별자'),
 (7,'EXECUTION','executionStatus','실행 상태','CODE','STATUS','execution.executionStatus','framework_process_execution','execution_status',false,false,'{}','미시작·실행·완료 상태'),
 (8,'EXECUTION','currentState','현재 상태','CODE','STATUS','execution.currentState','framework_process_execution','current_state',false,false,'{}','서버에서 잠금 검증하는 현재 업무 상태'),
 (9,'EXECUTION','currentStepCode','현재 단계','STRING','STATUS','execution.currentStepCode','framework_process_execution','current_step_code',false,false,'{}','현재 계정이 처리 가능한 단계 판단 기준'),
 (10,'STEP','stepOrder','단계 순서','INTEGER','SEQUENCE','steps[].stepOrder','framework_process_step','step_order',true,false,'{"minimum":1}','프로세스 내 실행 순서'),
 (11,'STEP','stepCode','단계 코드','STRING','SELECT','steps[].stepCode','framework_process_step','step_code',true,true,'{}','상태 전이와 화면을 연결하는 단계 식별자'),
 (12,'STEP','stepName','단계명','STRING','TEXT','steps[].stepName','framework_process_step','step_name',true,false,'{}','사용자가 수행할 업무 단계명'),
 (13,'STEP','actorCode','수행 액터','CODE','BADGE','steps[].actorCode','framework_process_step','actor_code',true,false,'{}','단계를 수행해야 하는 프로젝트 액터'),
 (14,'STEP','fromState','진입 상태','CODE','STATUS','steps[].fromState','framework_process_step','from_state',true,false,'{}','명령 실행 전 요구 상태'),
 (15,'STEP','commandCode','실행 명령','CODE','ACTION','steps[].commandCode','framework_process_step','command_code',true,false,'{}','단계를 완료시키는 서버 명령'),
 (16,'STEP','toState','완료 상태','CODE','STATUS','steps[].toState','framework_process_step','to_state',true,false,'{}','명령 성공 후 도달 상태'),
 (17,'STEP','requirementText','단계 요구사항','STRING','TEXT','steps[].requirementText','framework_process_step','requirement_text',true,false,'{}','업무 처리에 필요한 전문 요구사항'),
 (18,'STEP','completionRule','완료 판정 기준','STRING','TEXT','steps[].completionRule','framework_process_step','completion_rule',true,false,'{}','필수 입력·증적·검증 완료 조건'),
 (19,'STEP','inputContract','진입 데이터 계약','JSON','JSON_VIEW','steps[].inputContract','framework_process_step','input_contract',true,false,'{}','이전 단계로부터 받아야 하는 데이터'),
 (20,'STEP','outputContract','인계 데이터 계약','JSON','JSON_VIEW','steps[].outputContract','framework_process_step','output_contract',true,false,'{}','다음 단계에 전달해야 하는 결과'),
 (21,'STEP','apiContract','단계 API 계약','STRING','CODE_VIEW','steps[].apiContract','framework_process_step','api_contract',false,false,'{}','단계별 실제 업무 API 또는 공통 실행 API'),
 (22,'STEP','userPath','사용자 업무 화면','STRING','LINK','steps[].userPath','framework_process_step','user_path',false,false,'{}','액터가 업무 자료를 작성하는 화면'),
 (23,'STEP','adminPath','관리자 업무 화면','STRING','LINK','steps[].adminPath','framework_process_step','admin_path',false,false,'{}','운영자가 검토하고 관리하는 화면'),
 (24,'WORK','workNote','업무 처리 내용','STRING','TEXTAREA','command.requestJson.workNote','framework_process_execution_event','request_json',true,true,'{"minLength":1,"maxLength":4000}','단계에서 수행한 판단과 처리 결과'),
 (25,'WORK','evidenceRef','증빙·결과 참조','STRING','TEXTAREA','command.requestJson.evidenceRef','framework_process_execution_event','request_json',false,true,'{"maxLength":2000}','문서·파일·검증 결과의 감사 가능한 참조'),
 (26,'WORK','idempotencyKey','멱등키','UUID','HIDDEN','command.idempotencyKey','framework_process_execution_event','idempotency_key',true,false,'{}','중복 클릭과 재시도에서 이중 전이를 방지하는 키'),
 (27,'WORK','requestJson','요청 스냅샷','JSON','HIDDEN','command.requestJson','framework_process_execution_event','request_json',true,false,'{}','업무 입력과 증적의 변경 불가능한 요청 기록'),
 (28,'WORK','resultJson','결과 스냅샷','JSON','HIDDEN','command.resultJson','framework_process_execution_event','result_json',true,false,'{}','완료 결과와 인계 정보의 감사 기록'),
 (29,'AUDIT','eventId','이벤트 ID','LONG','TEXT','events[].eventId','framework_process_execution_event','event_id',false,false,'{}','상태 전이 감사 이벤트 식별자'),
 (30,'AUDIT','eventActor','처리 액터','CODE','BADGE','events[].actorCode','framework_process_execution_event','actor_code',false,false,'{}','이벤트를 실행한 액터'),
 (31,'AUDIT','eventCommand','처리 명령','CODE','TEXT','events[].commandCode','framework_process_execution_event','command_code',false,false,'{}','감사 이력에 기록된 명령'),
 (32,'AUDIT','eventFromState','이전 상태','CODE','STATUS','events[].fromState','framework_process_execution_event','from_state',false,false,'{}','이벤트 실행 전 상태'),
 (33,'AUDIT','eventToState','결과 상태','CODE','STATUS','events[].toState','framework_process_execution_event','to_state',false,false,'{}','이벤트 실행 후 상태'),
 (34,'AUDIT','eventAt','처리 시각','DATETIME','DATETIME','events[].executedAt','framework_process_execution_event','executed_at',false,false,'{}','서버 기준 상태 전이 시각');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'PLATFORM.PROCESS_STEP.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),'PLATFORM',field_name,data_type,
 semantic_definition,CASE WHEN field_code IN('workNote','evidenceRef') THEN 'CONFIDENTIAL' ELSE 'INTERNAL' END,validation
FROM process_step_workspace_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
 canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding WHERE screen_resource_id=(
 SELECT screen_resource_id FROM framework_screen_resource WHERE route_key='/admin/system/process-step-workspace');

INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'PLATFORM.PROCESS_STEP.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,f.required,f.editable,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN process_step_workspace_field_spec f
WHERE r.route_key='/admin/system/process-step-workspace'
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,
 business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,
 api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,exception_states_verified,
 audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT 'EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','ADMIN','/admin/system/process-step-workspace',
 '프로세스 단계 실행 작업공간','SITE_DATA_OWNER',
 '프로젝트 액터가 선택한 프로세스의 현재 단계를 실제 상태 전이 계약에 따라 처리하고 입력·증적·결과·감사 이력을 저장한 뒤 다음 액터 업무로 인계한다.',
 '인증된 계정에 테넌트·프로젝트·단계 액터 배정이 활성이고 이전 단계의 상태와 데이터 계약이 충족되어야 한다.',
 '서버 명령·현재 상태·멱등키·필수 처리 내용이 검증되고 실행 이벤트와 결과 스냅샷이 저장되며 다음 단계와 액터가 결정되어야 한다.',
 '["권한 없는 실행 0건","중복 상태 전이 0건","완료 이벤트 저장률 100%","다음 액터 인계율 100%","감사 스냅샷 누락 0건"]',
 '[{"id":"process-context"},{"id":"execution-step-rail"},{"id":"step-contract"},{"id":"work-evidence-form"},{"id":"transition-actions"},{"id":"audit-history"}]',
 (SELECT jsonb_agg(jsonb_build_object('fieldCode',field_code,'apiProperty',api_property,'source',source_table||'.'||source_column,'required',required,'editable',editable) ORDER BY field_order)::text FROM process_step_workspace_field_spec),
 '[{"code":"LOAD_EXECUTION","method":"GET"},{"code":"START_EXECUTION","method":"POST","guard":"first step actor"},{"code":"SELECT_STEP","guard":"process step"},{"code":"COMPLETE_STEP","method":"POST","guard":"current step + actor + state + evidence","idempotent":true},{"code":"CONTINUE_NEXT","effect":"next step and actor handoff"}]',
 '["LOADING","READY","NOT_STARTED","RUNNING","COMPLETING","COMPLETED","VALIDATION_ERROR","ERROR","AUTHORITY_DENIED","FORBIDDEN","DEPENDENCY_BLOCKED","CONFLICT","SERVER_ERROR","SESSION_EXPIRED"]',
 '[{"method":"GET","path":"/admin/api/system/actor-process"},{"method":"GET","path":"/home/api/process-executions","scope":"account actor + tenant + project + process"},{"method":"POST","path":"/home/api/process-executions/start"},{"method":"POST","path":"/home/api/process-executions/{executionId}/commands","idempotency":"required"}]',
 '[{"version":"2.0.0","entity":"framework_process_definition"},{"entity":"framework_process_step","relation":"state transition contract"},{"entity":"framework_account_actor_assignment","scope":"active account actor"},{"entity":"framework_process_execution","lock":"running execution"},{"entity":"framework_process_execution_event","unique":"execution + idempotency key"}]',
 '[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","ISOLATION","STATE_CONFLICT","IDEMPOTENCY","EXCEPTION","RECOVERY"],"representativeStep":"EMISSION_PROJECT_COLLECT","linkedStepTests":23}]',
 '{"mobile":"step cards then form","tablet":"step rail and detail","desktop":"step rail + contracts + form + audit","overflow":"local table scroll only"}',
 '{"standard":"WCAG 2.1 AA","keyboard":"all steps and commands reachable","labels":"explicit","status":"aria-live","table":"headers","focus":"visible"}',
 '{"authentication":"ADMIN","tenantIsolation":true,"projectIsolation":true,"actorAssignment":"active and date-valid","stateTransition":"server authoritative","idempotency":"UUID required","audit":"request and result snapshots"}',
 true,true,true,true,true,true,
 'ProcessStepWorkspacePage+ProcessExecutionApiController+ActorProcessGovernanceService execution ledger:2.0.0:2026-07-22',
 'VERIFIED','PROCESS_STEP_WORKSPACE_STANDARD_RECONCILIATION','HIDDEN',true
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET screen_name=excluded.screen_name,
 business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,
 kpi_contract=excluded.kpi_contract,section_contract=excluded.section_contract,field_contract=excluded.field_contract,
 command_contract=excluded.command_contract,state_contract=excluded.state_contract,api_contract=excluded.api_contract,
 data_contract=excluded.data_contract,evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,accessibility_verified=true,
 exception_states_verified=true,audit_evidence_ref=excluded.audit_evidence_ref,contract_status='VERIFIED',
 updated_by=excluded.updated_by,menu_visibility='HIDDEN',menu_verified=true,updated_at=current_timestamp;

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.layer,a.ref,a.management_route,'REUSED',a.evidence,true,'PROCESS_STEP_WORKSPACE_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS admin execution tokens','/admin/system/theme-management','shared KRDS theme'),
 ('SECTION','context/step-rail/contracts/work-evidence/actions/audit','/admin/system/section-management','step workspace section contract'),
 ('COMPONENT','field/status/step card/contract card/audit table','/admin/system/component-management','reusable common components'),
 ('DESIGN','PROCESS_STEP_WORKSPACE/platform-v2','/admin/system/design-management','responsive step execution pattern'),
 ('FRONTEND','ProcessStepWorkspacePage','/admin/system/page-development-master','implemented hidden dependent route'),
 ('API','process dashboard + execution find/start/command','/admin/system/api-management','authenticated scoped APIs'),
 ('BACKEND','ActorProcessGovernanceService state machine','/admin/system/function-management','actor/state/idempotency guards'),
 ('DATABASE','process step + assignment + execution + event','/admin/system/db-table-management','34 DB-resolved fields'),
 ('TEST','23 representative step tests in 7 types','/admin/system/verification-asset-management','normal, authority, isolation, conflict and recovery')
) a(layer,ref,management_route,evidence)
WHERE c.route_path='/admin/system/process-step-workspace'
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_screen_template_standard standard SET representative_screen_resource_id=r.screen_resource_id,
 representative_route=r.route_key,standard_status=CASE WHEN g.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||g.design_gate_score||':'||g.design_gate_status,
 standard_version='2.0.0',updated_by='PROCESS_STEP_WORKSPACE_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance g USING(screen_resource_id)
WHERE standard.screen_type='PROCESS_STEP_WORKSPACE' AND r.route_key='/admin/system/process-step-workspace';
