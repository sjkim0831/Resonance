-- Canonical WORK_EXECUTION standard: project-scoped work input, evidence,
-- optimistic draft versioning, server-authoritative completion and audit handoff.

CREATE TABLE IF NOT EXISTS framework_process_work_draft (
  draft_id uuid PRIMARY KEY,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(100) NOT NULL,
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  account_id varchar(100) NOT NULL,
  actor_code varchar(100) NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_version integer NOT NULL DEFAULT 1 CHECK (draft_version > 0),
  draft_status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (draft_status IN ('DRAFT','SUBMITTED')),
  saved_at timestamp NOT NULL DEFAULT current_timestamp,
  submitted_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT fk_process_work_draft_step FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code),
  CONSTRAINT uq_process_work_draft_scope UNIQUE(tenant_id,project_id,process_code,step_code,account_id)
);
CREATE INDEX IF NOT EXISTS ix_process_work_draft_scope
  ON framework_process_work_draft(tenant_id,project_id,process_code,step_code,draft_status);

INSERT INTO framework_screen_resource(route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
 responsive_contract,accessibility_contract,security_contract)
VALUES('/work/execution','전문 업무 실행','WORK_EXECUTION','VERIFIED','REACT_SOURCE',
 'features/work-execution/WorkExecutionPage.tsx',
 '{"mobile":"context then work form then actions","tablet":"two-column fields and actions","desktop":"work canvas plus sticky completion rail","overflow":"tables scroll locally and all text wraps"}',
 '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"focusVisible":true,"tableHeaders":true}',
 '{"authentication":"MEMBER","tenantIsolation":true,"projectIsolation":true,"actorAssignment":true,"optimisticVersion":true,"serverStateTransition":true,"idempotency":true,"audit":true}')
ON CONFLICT(route_key) DO UPDATE SET screen_name=excluded.screen_name,screen_type='WORK_EXECUTION',
 implementation_status='VERIFIED',source_kind='REACT_SOURCE',source_ref=excluded.source_ref,
 responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
 security_contract=excluded.security_contract,updated_at=current_timestamp;

INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
 initial_view,context_contract,visibility_contract,completion_contract,guide_contract,binding_status)
SELECT 'EMISSION_PROJECT','EMISSION_PROJECT_COLLECT',r.screen_resource_id,'USER','SITE_DATA_OWNER','PRIMARY','WORK_EXECUTION',
 '{"tenantId":"required actor scope","projectId":"required assignment scope","processCode":"required","stepCode":"required and current"}',
 '{"authentication":true,"route":"hidden dependent route","actor":"active and date-valid project assignment"}',
 '{"draft":"optimistic version","required":"result+basis+evidence","command":"server contract","audit":"request/result snapshots","handoff":"next state and actor"}',
 '{"sequence":["load assigned work","record result","attach evidence","save versioned draft","pass completion checks","complete idempotently","continue from my tasks"]}',
 'ACTIVE'
FROM framework_screen_resource r WHERE r.route_key='/work/execution'
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET actor_code='SITE_DATA_OWNER',
 entry_mode='PRIMARY',initial_view='WORK_EXECUTION',context_contract=excluded.context_contract,
 visibility_contract=excluded.visibility_contract,completion_contract=excluded.completion_contract,
 guide_contract=excluded.guide_contract,binding_status='ACTIVE',updated_at=current_timestamp;

CREATE TEMP TABLE work_execution_field_spec(
 field_order integer,field_group varchar(60),field_code varchar(100),field_name varchar(160),data_type varchar(30),
 control_type varchar(40),api_property varchar(200),source_table varchar(100),source_column varchar(100),required boolean,
 editable boolean,validation jsonb,semantic_definition text
) ON COMMIT DROP;

INSERT INTO work_execution_field_spec VALUES
 (1,'CONTEXT','tenantId','테넌트 ID','STRING','TEXT','query.tenantId','framework_account_actor_assignment','tenant_id',true,true,'{"minLength":1}','계정과 업무 데이터를 격리하는 테넌트 경계'),
 (2,'CONTEXT','projectId','프로젝트 ID','STRING','TEXT','query.projectId','framework_process_execution','project_id',true,true,'{"minLength":1}','액터 배정과 실행을 결합하는 프로젝트 식별자'),
 (3,'CONTEXT','processCode','프로세스 코드','STRING','TEXT','query.processCode','framework_process_definition','process_code',true,true,'{"minLength":1}','실행할 전문 업무 프로세스 식별자'),
 (4,'CONTEXT','stepCode','단계 코드','STRING','TEXT','query.stepCode','framework_process_step','step_code',true,true,'{"minLength":1}','현재 처리할 업무 단계 식별자'),
 (5,'CONTRACT','stepName','업무명','STRING','TEXT','contract.stepName','framework_process_step','step_name',true,false,'{}','액터가 수행할 전문 업무명'),
 (6,'CONTRACT','actorCode','담당 액터','CODE','BADGE','contract.actorCode','framework_process_step','actor_code',true,false,'{}','서버가 검증하는 단계 수행 액터'),
 (7,'CONTRACT','commandCode','완료 명령','CODE','ACTION','contract.commandCode','framework_process_step','command_code',true,false,'{}','단계를 완료시키는 서버 명령'),
 (8,'CONTRACT','fromState','진입 상태','CODE','STATUS','contract.fromState','framework_process_step','from_state',true,false,'{}','업무를 시작할 수 있는 상태'),
 (9,'CONTRACT','toState','완료 상태','CODE','STATUS','contract.toState','framework_process_step','to_state',true,false,'{}','업무 완료 후 도달하는 상태'),
 (10,'CONTRACT','requirementText','업무 요구사항','STRING','TEXT','contract.requirementText','framework_process_step','requirement_text',true,false,'{}','업무 수행에 필요한 전문 요구사항'),
 (11,'CONTRACT','completionRule','완료 판정 기준','STRING','TEXT','contract.completionRule','framework_process_step','completion_rule',true,false,'{}','입력과 증빙을 완료로 판정하는 규칙'),
 (12,'CONTRACT','inputContract','진입 데이터 계약','JSON','JSON_VIEW','contract.inputContract','framework_process_step','input_contract',true,false,'{}','상위 단계에서 전달받아야 하는 데이터'),
 (13,'CONTRACT','outputContract','결과·인계 계약','JSON','JSON_VIEW','contract.outputContract','framework_process_step','output_contract',true,false,'{}','다음 단계와 액터에 전달할 결과'),
 (14,'DRAFT','draftId','임시저장 ID','UUID','HIDDEN','draft.draftId','framework_process_work_draft','draft_id',false,false,'{}','사용자별 업무 임시저장 식별자'),
 (15,'DRAFT','draftVersion','임시저장 버전','INTEGER','VERSION','draft.draftVersion','framework_process_work_draft','draft_version',true,false,'{"minimum":0}','동시 수정 충돌을 차단하는 낙관적 버전'),
 (16,'DRAFT','draftStatus','임시저장 상태','CODE','STATUS','draft.draftStatus','framework_process_work_draft','draft_status',true,false,'{"enum":["NOT_SAVED","DRAFT","SUBMITTED"]}','임시저장과 제출 완료 상태'),
 (17,'WORK','workSummary','처리 결과 요약','STRING','TEXTAREA','draft.payloadJson.workSummary','framework_process_work_draft','payload_json',true,true,'{"minLength":1,"maxLength":4000}','액터가 수행한 업무 결과와 판단 요약'),
 (18,'WORK','decisionBasis','판단·계산 근거','STRING','TEXTAREA','draft.payloadJson.decisionBasis','framework_process_work_draft','payload_json',true,true,'{"minLength":1,"maxLength":4000}','결과를 재현할 수 있는 판단과 계산 근거'),
 (19,'WORK','resultValue','결과값','DECIMAL','NUMBER','draft.payloadJson.resultValue','framework_process_work_draft','payload_json',false,true,'{}','업무에서 산출된 정량 결과'),
 (20,'WORK','resultUnit','결과 단위','STRING','TEXT','draft.payloadJson.resultUnit','framework_process_work_draft','payload_json',false,true,'{"maxLength":60}','정량 결과에 적용되는 표준 단위'),
 (21,'WORK','exceptionReason','예외·보완 사항','STRING','TEXTAREA','draft.payloadJson.exceptionReason','framework_process_work_draft','payload_json',false,true,'{"maxLength":4000}','예외와 후속 보완이 필요한 사유'),
 (22,'EVIDENCE','documentId','문서·증빙 ID','STRING','TEXT','draft.evidenceJson.documentId','framework_process_work_draft','evidence_json',true,true,'{"maxLength":200}','원본 증빙을 식별하는 문서 ID'),
 (23,'EVIDENCE','sourceUrl','출처 URL·저장소','STRING','TEXT','draft.evidenceJson.sourceUrl','framework_process_work_draft','evidence_json',false,true,'{"maxLength":2000}','원본 증빙의 접근 가능한 위치'),
 (24,'EVIDENCE','checksum','무결성 체크섬','STRING','TEXT','draft.evidenceJson.checksum','framework_process_work_draft','evidence_json',false,true,'{"maxLength":128}','증빙 변경 여부를 확인하는 해시'),
 (25,'EXECUTION','executionId','실행 ID','UUID','TEXT','execution.executionId','framework_process_execution','execution_id',false,false,'{}','상태 전이와 감사 이벤트의 상위 식별자'),
 (26,'EXECUTION','executionStatus','실행 상태','CODE','STATUS','execution.executionStatus','framework_process_execution','execution_status',false,false,'{}','미시작·진행·완료 실행 상태'),
 (27,'EXECUTION','currentStepCode','현재 실행 단계','STRING','STATUS','execution.currentStepCode','framework_process_execution','current_step_code',false,false,'{}','현재 계정이 처리할 수 있는 서버 기준 단계'),
 (28,'EXECUTION','currentState','현재 상태','CODE','STATUS','execution.currentState','framework_process_execution','current_state',false,false,'{}','명령 실행 전 서버 권위 상태'),
 (29,'AUDIT','eventId','감사 이벤트 ID','LONG','TEXT','events[].eventId','framework_process_execution_event','event_id',false,false,'{}','상태 전이 감사 이벤트 식별자'),
 (30,'AUDIT','eventActor','처리 액터','CODE','BADGE','events[].actorCode','framework_process_execution_event','actor_code',false,false,'{}','이벤트를 수행한 액터'),
 (31,'AUDIT','eventCommand','처리 명령','CODE','TEXT','events[].commandCode','framework_process_execution_event','command_code',false,false,'{}','감사 이력에 기록된 명령'),
 (32,'AUDIT','eventTransition','상태 전이','STRING','STATUS','events[].fromState+toState','framework_process_execution_event','to_state',false,false,'{}','명령 전후의 상태 전이'),
 (33,'AUDIT','eventAt','처리 시각','DATETIME','DATETIME','events[].executedAt','framework_process_execution_event','executed_at',false,false,'{}','서버 기준 처리 시각');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'PLATFORM.WORK_EXECUTION.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),'PLATFORM',field_name,data_type,
 semantic_definition,CASE WHEN field_group IN('WORK','EVIDENCE') THEN 'CONFIDENTIAL' ELSE 'INTERNAL' END,validation
FROM work_execution_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
 canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding WHERE screen_resource_id=(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key='/work/execution');
INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'PLATFORM.WORK_EXECUTION.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,f.required,f.editable,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN work_execution_field_spec f WHERE r.route_key='/work/execution'
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,
 business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,
 api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,exception_states_verified,
 audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT 'EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','USER','/work/execution','전문 업무 실행','SITE_DATA_OWNER',
 '프로젝트 액터가 배정된 업무의 입력, 판단 근거, 정량 결과, 증빙과 예외를 버전 관리로 저장하고 서버 상태 전이 규칙에 따라 완료하여 다음 액터에게 인계한다.',
 '인증된 계정에 테넌트와 프로젝트의 유효한 액터 배정이 있고 선택 단계가 서버의 현재 실행 단계와 일치해야 한다.',
 '필수 결과와 판단 근거 및 증빙이 저장되고 멱등 완료 명령과 감사 이벤트가 생성되며 다음 단계와 담당 액터가 결정되어야 한다.',
 '["권한 없는 접근 0건","임시저장 충돌 유실 0건","필수 입력·증빙 충족률 100%","중복 완료 0건","다음 액터 인계율 100%"]',
 '[{"id":"work-context"},{"id":"step-contract"},{"id":"work-result"},{"id":"evidence-lineage"},{"id":"completion-checks"},{"id":"work-actions"},{"id":"audit-history"},{"id":"next-handoff"}]',
 (SELECT jsonb_agg(jsonb_build_object('fieldCode',field_code,'apiProperty',api_property,'source',source_table||'.'||source_column,'required',required,'editable',editable) ORDER BY field_order)::text FROM work_execution_field_spec),
 '[{"code":"LOAD_WORK","method":"GET"},{"code":"SAVE_DRAFT","method":"PUT","optimisticVersion":true},{"code":"START_PROCESS","method":"POST","guard":"first step actor"},{"code":"VALIDATE_COMPLETE","method":"POST","guard":"required fields + evidence + current actor/state","idempotent":true},{"code":"CONTINUE_NEXT","effect":"next actor handoff"}]',
 '["LOADING","NOT_SAVED","DRAFT","READY","SAVING","VALIDATING","COMPLETING","SUBMITTED","COMPLETED","VERSION_CONFLICT","VALIDATION_ERROR","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
 '[{"method":"GET","path":"/home/api/process-executions/draft"},{"method":"PUT","path":"/home/api/process-executions/draft","version":"expectedVersion"},{"method":"GET","path":"/home/api/process-executions"},{"method":"POST","path":"/home/api/process-executions/start"},{"method":"POST","path":"/home/api/process-executions/{executionId}/commands","idempotency":"required"}]',
 '[{"version":"2.0.0","entity":"framework_process_work_draft","unique":"tenant+project+process+step+account","optimistic":"draft_version"},{"entity":"framework_account_actor_assignment","scope":"active and date-valid"},{"entity":"framework_process_execution","state":"server authoritative"},{"entity":"framework_process_execution_event","audit":"immutable transition"}]',
 '[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","ISOLATION","VERSION_CONFLICT","IDEMPOTENCY","EXCEPTION","RECOVERY"],"representativeStep":"EMISSION_PROJECT_COLLECT","linkedStepTests":23,"evidence":"documentId+sourceUrl+checksum"}]',
 '{"mobile":"context, result, evidence, checks and actions","tablet":"two-column fields","desktop":"work canvas plus sticky completion rail","overflow":"local table scroll only"}',
 '{"standard":"WCAG 2.1 AA","keyboard":"all fields and actions reachable","labels":"explicit","status":"aria-live","table":"headers","focus":"visible"}',
 '{"authentication":"MEMBER","tenantIsolation":true,"projectIsolation":true,"actorAssignment":"active and date-valid","draftVersion":"optimistic conflict","stateTransition":"server authoritative","idempotency":"UUID required","audit":"request and result snapshots"}',
 true,true,true,true,true,true,
 'WorkExecutionPage+ProcessExecutionApiController+ActorProcessGovernanceService+framework_process_work_draft:2.0.0:2026-07-22',
 'VERIFIED','WORK_EXECUTION_STANDARD_RECONCILIATION','HIDDEN',true
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
SELECT c.contract_id,a.layer,a.ref,a.management_route,'REUSED',a.evidence,true,'WORK_EXECUTION_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS member work tokens','/admin/system/theme-management','shared KRDS theme'),
 ('SECTION','context/contract/result/evidence/checks/actions/audit/handoff','/admin/system/section-management','work execution section contract'),
 ('COMPONENT','field/status/contract card/checklist/action rail/audit table','/admin/system/component-management','reusable common components'),
 ('DESIGN','WORK_EXECUTION/platform-v2','/admin/system/design-management','responsive professional work pattern'),
 ('FRONTEND','WorkExecutionPage','/admin/system/page-development-master','implemented hidden dependent route'),
 ('API','work draft + execution find/start/command','/admin/system/api-management','authenticated scoped APIs'),
 ('BACKEND','ActorProcessGovernanceService work draft and state machine','/admin/system/function-management','actor/version/state/idempotency guards'),
 ('DATABASE','work draft + assignment + execution + event','/admin/system/db-table-management','33 DB-resolved fields'),
 ('TEST','23 representative step tests in 7 families','/admin/system/verification-asset-management','normal, authority, isolation, conflict and recovery')
) a(layer,ref,management_route,evidence)
WHERE c.route_path='/work/execution'
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_screen_template_standard standard SET representative_screen_resource_id=r.screen_resource_id,
 representative_route=r.route_key,standard_status=CASE WHEN g.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||g.design_gate_score||':'||g.design_gate_status,
 standard_version='2.0.0',updated_by='WORK_EXECUTION_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance g USING(screen_resource_id)
WHERE standard.screen_type='WORK_EXECUTION' AND r.route_key='/work/execution';

COMMENT ON TABLE framework_process_work_draft IS
  'Actor-scoped professional work draft with optimistic versioning. Completion changes the row to SUBMITTED in the same process command transaction.';
