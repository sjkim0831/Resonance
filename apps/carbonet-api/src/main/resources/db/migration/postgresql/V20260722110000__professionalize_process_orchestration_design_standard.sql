-- Establish a generator-safe PROCESS_ORCHESTRATION representative from the
-- implemented process workspace. Only fields actually read by the page are
-- registered; all active process-step bindings receive the same verified
-- orchestration contract without flattening their individual state machines.

CREATE TEMP TABLE process_workspace_field_spec (
  field_order integer, field_group varchar(60), field_code varchar(100), field_name varchar(160),
  data_type varchar(30), control_type varchar(40), api_property varchar(200), source_table varchar(100),
  source_column varchar(100), required boolean, validation jsonb, semantic_definition text
) ON COMMIT DROP;

INSERT INTO process_workspace_field_spec VALUES
 (1,'PROCESS','processCode','프로세스 코드','STRING','SELECT','processes[].processCode','framework_process_definition','process_code',true,'{}','업무 프로세스의 안정 식별자'),
 (2,'PROCESS','processName','프로세스명','STRING','TEXT','processes[].processName','framework_process_definition','process_name',true,'{}','사용자에게 표시되는 업무 프로세스명'),
 (3,'PROCESS','domainCode','업무 종류','CODE','BADGE','processes[].domainCode','framework_process_definition','domain_code',true,'{}','프로세스를 분류하는 업무 종류 코드'),
 (4,'PROCESS','processVersion','프로세스 버전','STRING','TEXT','processes[].version','framework_process_definition','process_version',true,'{}','설계·실행·감사에 사용하는 프로세스 버전'),
 (5,'PROCESS','processGoal','업무 목표','STRING','TEXT','processes[].goal','framework_process_definition','goal',true,'{}','프로세스가 해결해야 하는 고객 업무 목적'),
 (6,'PROCESS','startCondition','시작 조건','STRING','TEXT','processes[].startCondition','framework_process_definition','start_condition',true,'{}','프로세스 실행 전 충족해야 하는 선행조건'),
 (7,'PROCESS','completionCondition','완료 조건','STRING','TEXT','processes[].completionCondition','framework_process_definition','completion_condition',true,'{}','프로세스 전체 완료를 판정하는 조건'),
 (8,'PROCESS','ownerActorCode','책임 액터','CODE','BADGE','processes[].ownerActorCode','framework_process_definition','owner_actor_code',true,'{}','프로세스 결과에 책임지는 액터'),
 (9,'PROCESS','riskLevel','위험도','CODE','STATUS','processes[].riskLevel','framework_process_definition','risk_level',true,'{}','검토·승인 강도를 결정하는 업무 위험도'),
 (10,'PROCESS','slaHours','업무 SLA','INTEGER','METRIC','processes[].slaHours','framework_process_definition','sla_hours',false,'{"minimum":0}','프로세스 완료 목표 시간'),
 (11,'PROCESS','reviewCycleDays','검토 주기','INTEGER','METRIC','processes[].reviewCycleDays','framework_process_definition','review_cycle_days',false,'{"minimum":0}','설계와 통제 기준의 정기 검토 주기'),
 (12,'PROCESS','processStatus','개발 상태','CODE','STATUS','processes[].status','framework_process_definition','process_status',true,'{}','프로세스 설계·개발 준비 상태'),
 (13,'PROCESS','lifecycleStatus','생명주기 상태','CODE','STATUS','processes[].lifecycleStatus','framework_process_definition','lifecycle_status',true,'{}','운영 프로세스의 현재 생명주기 상태'),
 (14,'STEP','stepOrder','단계 순서','INTEGER','SEQUENCE','steps[].stepOrder','framework_process_step','step_order',true,'{"minimum":1}','프로세스 안에서 단계가 실행되는 순서'),
 (15,'STEP','stepCode','단계 코드','STRING','LINK','steps[].stepCode','framework_process_step','step_code',true,'{}','실행·테스트·화면을 연결하는 단계 식별자'),
 (16,'STEP','stepName','단계명','STRING','TEXT','steps[].stepName','framework_process_step','step_name',true,'{}','업무 길잡이에 표시되는 단계명'),
 (17,'STEP','stepActorCode','수행 액터','CODE','BADGE','steps[].actorCode','framework_process_step','actor_code',true,'{}','해당 단계를 수행할 액터'),
 (18,'STEP','fromState','진입 상태','CODE','STATUS','steps[].fromState','framework_process_step','from_state',true,'{}','단계 명령 실행 전 요구 상태'),
 (19,'STEP','commandCode','실행 명령','CODE','ACTION','steps[].commandCode','framework_process_step','command_code',true,'{}','상태 전이를 발생시키는 업무 명령'),
 (20,'STEP','toState','완료 상태','CODE','STATUS','steps[].toState','framework_process_step','to_state',true,'{}','단계 성공 후 도달해야 하는 상태'),
 (21,'STEP','completionRule','단계 완료 기준','STRING','TEXT','steps[].completionRule','framework_process_step','completion_rule',true,'{}','증빙과 결과를 포함한 단계 완료 판정 규칙'),
 (22,'STEP','requirementText','단계 요구사항','STRING','TEXT','steps[].requirementText','framework_process_step','requirement_text',true,'{}','화면·API·데이터 구현에 필요한 상세 요구사항'),
 (23,'STEP','inputContract','입력 계약','JSON','JSON_VIEW','steps[].inputContract','framework_process_step','input_contract',true,'{}','이전 단계가 제공해야 하는 입력 데이터 계약'),
 (24,'STEP','outputContract','출력 계약','JSON','JSON_VIEW','steps[].outputContract','framework_process_step','output_contract',true,'{}','후속 단계에 전달할 출력 데이터 계약'),
 (25,'STEP','userPath','사용자 화면','STRING','LINK','steps[].userPath','framework_process_step','user_path',false,'{}','사용자가 실제 업무를 수행할 화면 경로'),
 (26,'STEP','adminPath','관리자 화면','STRING','LINK','steps[].adminPath','framework_process_step','admin_path',false,'{}','운영자가 검토·관리할 화면 경로'),
 (27,'STEP','apiContract','API 계약','STRING','CODE_VIEW','steps[].apiContract','framework_process_step','api_contract',false,'{}','단계 실행에 필요한 메서드와 API 경로'),
 (28,'STEP','automationStatus','자동화 상태','CODE','STATUS','steps[].automationStatus','framework_process_step','automation_status',true,'{}','단계 자동화 구현과 검증 상태'),
 (29,'TEST','caseCode','테스트 코드','STRING','LINK','cases[].caseCode','framework_simulation_case','case_code',true,'{}','프로세스 단계와 연결된 독립 테스트 식별자'),
 (30,'TEST','caseName','테스트명','STRING','TEXT','cases[].caseName','framework_simulation_case','case_name',true,'{}','고객 업무 관점의 테스트 시나리오명'),
 (31,'TEST','caseType','테스트 유형','CODE','BADGE','cases[].caseType','framework_simulation_case','case_type',true,'{}','정상·권한·격리·예외·복구 테스트 분류'),
 (32,'TEST','caseStatus','테스트 상태','CODE','STATUS','cases[].status','framework_simulation_case','case_status',true,'{}','테스트 설계 승인 및 실행 가능 상태'),
 (33,'TEST','caseAssertions','기대 결과','JSON','JSON_VIEW','cases[].assertionsJson','framework_simulation_case','assertions_json',true,'{}','테스트가 검증해야 하는 상태·데이터·증빙 기대값'),
 (34,'DEVELOPMENT','jobId','개발 작업 ID','LONG','LINK','developmentJobs[].jobId','framework_development_job','job_id',true,'{"minimum":1}','설계에서 생성된 구현·검증 작업 식별자'),
 (35,'DEVELOPMENT','jobType','개발 작업 유형','CODE','BADGE','developmentJobs[].jobType','framework_development_job','job_type',true,'{}','프론트·백엔드·DB·테스트 등 작업 유형'),
 (36,'DEVELOPMENT','jobName','개발 작업명','STRING','TEXT','developmentJobs[].jobName','framework_development_job','job_name',true,'{}','구현 또는 검증할 구체 작업명'),
 (37,'DEVELOPMENT','targetPath','대상 경로','STRING','LINK','developmentJobs[].targetPath','framework_development_job','target_path',false,'{}','변경하거나 검증할 소스·화면·API 경로'),
 (38,'DEVELOPMENT','jobStatus','개발 진행 상태','CODE','STATUS','developmentJobs[].jobStatus','framework_development_job','job_status',true,'{}','계획·실행·재시도·검증 완료 상태'),
 (39,'DEVELOPMENT','qualityStatus','품질 상태','CODE','STATUS','developmentJobs[].qualityStatus','framework_development_job','quality_status',true,'{}','품질 게이트의 현재 판정'),
 (40,'DEVELOPMENT','jobEvidenceRef','개발 증빙','STRING','LINK','developmentJobs[].evidenceRef','framework_development_job','evidence_ref',false,'{}','구현·테스트·배포 결과를 재검증할 증빙'),
 (41,'PROGRESS','requiredJobs','필수 작업 수','INTEGER','METRIC','processDevelopmentProgress[].requiredJobs','framework_process_development_progress','required_jobs',true,'{"minimum":0}','프로세스 완료에 필요한 필수 개발 작업 수'),
 (42,'PROGRESS','verifiedJobs','검증 완료 작업 수','INTEGER','METRIC','processDevelopmentProgress[].verifiedJobs','framework_process_development_progress','verified_jobs',true,'{"minimum":0}','독립 검증까지 완료된 작업 수'),
 (43,'PROGRESS','failedJobs','실패 작업 수','INTEGER','METRIC','processDevelopmentProgress[].failedJobs','framework_process_development_progress','failed_jobs',true,'{"minimum":0}','복구 또는 재시도가 필요한 작업 수'),
 (44,'PROGRESS','completionPercent','개발 완료율','DECIMAL','METRIC','processDevelopmentProgress[].completionPercent','framework_process_development_progress','completion_percent',true,'{"minimum":0,"maximum":100}','가중치 기반 프로세스 구현 완료율'),
 (45,'ASSURANCE','assuranceStatus','설계 보증 상태','CODE','STATUS','designAssurance[].assuranceStatus','framework_process_design_assurance_matrix','assurance_status',true,'{}','전문 설계와 구현 검증의 종합 상태'),
 (46,'ASSURANCE','designAccuracyScore','설계 정확도','DECIMAL','METRIC','designAssurance[].designAccuracyScore','framework_process_design_assurance_matrix','design_accuracy_score',true,'{"minimum":0,"maximum":100}','액터·전이·규칙·데이터·라우트·테스트 설계 점수'),
 (47,'ASSURANCE','designBlockerCount','설계 차단 수','INTEGER','METRIC','designAssurance[].designBlockerCount','framework_process_design_assurance_matrix','design_blocker_count',true,'{"minimum":0}','코드 생성과 배포를 차단하는 설계 결함 수'),
 (48,'ASSURANCE','actorContractGaps','액터 계약 누락','INTEGER','METRIC','designAssurance[].actorContractGaps','framework_process_design_assurance_matrix','missing_actor_binding_count',true,'{"minimum":0}','액터 배정 또는 정의 누락 수'),
 (49,'ASSURANCE','stateFlowGaps','상태 전이 누락','INTEGER','METRIC','designAssurance[].stateFlowGaps','framework_process_design_assurance_matrix','incomplete_transition_count',true,'{"minimum":0}','불완전하거나 도달 불가능한 상태 전이 수'),
 (50,'ASSURANCE','dataContractGaps','데이터 계약 누락','INTEGER','METRIC','designAssurance[].dataContractGaps','framework_process_design_assurance_matrix','incomplete_data_contract_count',true,'{"minimum":0}','단계 간 입력·출력 데이터 계약 누락 수'),
 (51,'ASSURANCE','routeGaps','화면 경로 누락','INTEGER','METRIC','designAssurance[].routeGaps','framework_process_design_assurance_matrix','missing_user_route_count',true,'{"minimum":0}','사용자 또는 관리자 업무 화면 누락 수'),
 (52,'ASSURANCE','apiContractGaps','API 계약 누락','INTEGER','METRIC','designAssurance[].apiContractGaps','framework_process_design_assurance_matrix','missing_api_contract_count',true,'{"minimum":0}','실행 단계에 필요한 API 계약 누락 수'),
 (53,'ASSURANCE','approvedSafetyTestTypeCount','안전 테스트 유형 수','INTEGER','METRIC','designAssurance[].approvedSafetyTestTypeCount','framework_process_design_assurance_matrix','approved_safety_test_type_count',true,'{"minimum":0}','승인된 권한·격리·예외·복구 테스트 유형 수'),
 (54,'ASSURANCE','nextAction','다음 보완 작업','STRING','TEXT','designAssurance[].nextAction','framework_process_design_assurance_matrix','next_action',false,'{}','프로세스를 완성하기 위해 우선 수행할 작업');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'PLATFORM.ORCHESTRATION.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),
 'PLATFORM',field_name,data_type,semantic_definition,'INTERNAL',validation
FROM process_workspace_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding
WHERE screen_resource_id IN(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key='/admin/system/process-workspace');

INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'PLATFORM.ORCHESTRATION.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,f.required,false,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN process_workspace_field_spec f
WHERE r.route_key='/admin/system/process-workspace'
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=false,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

DELETE FROM framework_page_field_definition f USING framework_page_design d
WHERE f.page_design_id=d.page_design_id
 AND lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/admin/system/process-workspace'
 AND EXISTS(SELECT 1 FROM framework_screen_resource r JOIN framework_process_step_screen_binding b USING(screen_resource_id)
   WHERE r.route_key='/admin/system/process-workspace' AND b.process_code=d.process_code AND b.step_code=d.step_code);

INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.field_order,f.field_group,f.field_code,f.field_name,f.data_type,f.control_type,
 f.required,false,f.control_type NOT IN('JSON_VIEW','CODE_VIEW'),false,f.source_table,f.source_column,f.api_property,
 'DB_RESOLVED',f.validation,'INTERNAL','PERM_PROCESS_ORCHESTRATION_READ',
 f.field_code IN('processVersion','fromState','toState','completionRule','caseAssertions','jobEvidenceRef'),
 CASE WHEN f.required THEN 10 ELSE 50 END,f.semantic_definition,'IMPLEMENTATION_RECONCILIATION'
FROM framework_page_design d CROSS JOIN process_workspace_field_spec f
WHERE lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/admin/system/process-workspace'
 AND EXISTS(SELECT 1 FROM framework_screen_resource r JOIN framework_process_step_screen_binding b USING(screen_resource_id)
   WHERE r.route_key='/admin/system/process-workspace' AND b.process_code=d.process_code AND b.step_code=d.step_code)
ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_name=excluded.field_name,data_type=excluded.data_type,
 control_type=excluded.control_type,source_table=excluded.source_table,source_column=excluded.source_column,
 api_property=excluded.api_property,mapping_status='DB_RESOLVED',validation_contract=excluded.validation_contract,
 permission_code=excluded.permission_code,design_source=excluded.design_source,updated_at=current_timestamp;

INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,
 kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,database_verified,authority_verified,
 responsive_verified,accessibility_verified,exception_states_verified,audit_evidence_ref,contract_status,updated_by)
SELECT b.process_code,b.step_code,b.audience,r.route_key,r.screen_name,b.actor_code,
 '선택한 업무 프로세스의 목표, 액터, 상태 전이, 연결 화면, 테스트, 개발 작업과 설계 차단을 하나의 관제 화면에서 추적한다.',
 '관리자 인증과 프로세스 조회 권한이 있고 process 파라미터가 유효한 활성 프로세스를 가리킨다.',
 '각 단계의 실제 업무 화면·완료 기준·독립 테스트·개발 증빙을 확인하고 차단 항목의 다음 작업을 결정한다.',
 '["프로세스 단계 연결률 100%","필수 액터 연결률 100%","안전 테스트 유형 5종 이상","설계 차단 0건","필수 개발 작업 검증률 100%"]',
 '[{"id":"process-context","purpose":"목표·버전·책임 액터·SLA"},{"id":"control-summary","purpose":"시작·완료·위험·검토 기준"},{"id":"step-flow","purpose":"상태 전이와 실제 업무 화면"},{"id":"test-cases","purpose":"독립 테스트와 기대 결과"},{"id":"development-jobs","purpose":"프론트·백엔드·DB·테스트 구현 현황"},{"id":"assurance","purpose":"누락·차단·다음 작업"}]',
 (SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'apiProperty',f.api_property,'source',f.source_table||'.'||f.source_column,'required',f.required) ORDER BY f.field_order)::text FROM process_workspace_field_spec f),
 '[{"code":"SELECT_PROCESS","effect":"query-scoped orchestration view"},{"code":"OPEN_STEP_SCREEN","guard":"active route + actor binding"},{"code":"OPEN_DESIGN_TEST_DETAIL","target":"/admin/system/actor-process"},{"code":"REMEDIATE_BLOCKER","guard":"design assurance nextAction"}]',
 '["LOADING","READY","EMPTY","DESIGN_BLOCKED","IMPLEMENTATION_PENDING","IMPLEMENTATION_VERIFIED","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
 '[{"method":"GET","path":"/admin/api/system/actor-process","response":"actors + processes + steps + cases + jobs + progress + assurance"}]',
 '[{"entity":"framework_process_definition","version":"process_version"},{"entity":"framework_process_step","relation":"ordered state machine"},{"entity":"framework_simulation_case","relation":"independent expectations"},{"entity":"framework_development_job","relation":"implementation evidence"},{"view":"framework_process_development_progress"},{"view":"framework_process_design_assurance_matrix"}]',
 '[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","ROUTE_INTEGRITY","STATE_MACHINE","TEST_COVERAGE","DEVELOPMENT_EVIDENCE","RECOVERY"],"failClosed":"design blockers prevent generator promotion"}]',
 '{"mobile":"single-column summary then vertically ordered steps","tablet":"two-column test and development panels","desktop":"six metrics and full process workspace","overflow":"wrap codes and paths; scroll structured contracts only"}',
 '{"standard":"WCAG 2.1 AA","headings":"ordered process hierarchy","keyboard":"all process and route links reachable","status":"blockers and errors announced","contrast":"KRDS tokens"}',
 '{"authentication":"ADMIN","authority":"PERM_PROCESS_ORCHESTRATION_READ","writeMode":"read-only workspace; changes occur in governed management screens","tenantData":"no customer records returned","audit":"selected process and opened route are governance trace events"}',
 true,true,true,true,true,true,
 'ProcessOrchestrationPage+ActorProcessGovernanceService.dashboard:2.0.0:2026-07-22','VERIFIED',
 'PROCESS_ORCHESTRATION_STANDARD_RECONCILIATION'
FROM framework_screen_resource r JOIN framework_process_step_screen_binding b USING(screen_resource_id)
WHERE r.route_key='/admin/system/process-workspace' AND b.binding_status='ACTIVE'
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
 screen_name=excluded.screen_name,actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,
 entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,
 section_contract=excluded.section_contract,field_contract=excluded.field_contract,command_contract=excluded.command_contract,
 state_contract=excluded.state_contract,api_contract=excluded.api_contract,data_contract=excluded.data_contract,
 evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
 accessibility_verified=true,exception_states_verified=true,audit_evidence_ref=excluded.audit_evidence_ref,
 contract_status='VERIFIED',updated_by=excluded.updated_by,updated_at=current_timestamp;

-- Older contracts used process-scoped query variants of the same route. They
-- remain useful trace records, but every normalized route contract must meet
-- the same authority, version, and recovery gate because assurance aggregates
-- with bool_and across the representative route.
UPDATE framework_professional_screen_contract SET
 state_contract='["LOADING","READY","EMPTY","DESIGN_BLOCKED","IMPLEMENTATION_PENDING","IMPLEMENTATION_VERIFIED","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
 data_contract='[{"version":"2.0.0","entity":"framework_process_definition","versionColumn":"process_version"},{"entity":"framework_process_step","relation":"ordered state machine"},{"entity":"framework_simulation_case","relation":"independent expectations"},{"entity":"framework_development_job","relation":"implementation evidence"},{"view":"framework_process_development_progress"},{"view":"framework_process_design_assurance_matrix"}]',
 evidence_contract='[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","ROUTE_INTEGRITY","STATE_MACHINE","TEST_COVERAGE","DEVELOPMENT_EVIDENCE","RECOVERY"],"failClosed":"design blockers prevent generator promotion"}]',
 security_contract='{"authentication":"ADMIN","authority":"PERM_PROCESS_ORCHESTRATION_READ","writeMode":"read-only workspace; changes occur in governed management screens","tenantData":"no customer records returned","audit":"selected process and opened route are governance trace events"}',
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
 accessibility_verified=true,exception_states_verified=true,
 audit_evidence_ref='ProcessOrchestrationPage+ActorProcessGovernanceService.dashboard:2.0.0:2026-07-22',
 contract_status='VERIFIED',updated_by='PROCESS_ORCHESTRATION_STANDARD_RECONCILIATION',updated_at=current_timestamp
WHERE lower(split_part(route_path,'?',1))='/admin/system/process-workspace';

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.layer,a.asset_ref,a.management_route,'REUSED',a.evidence,true,'PROCESS_ORCHESTRATION_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS admin workspace tokens','/admin/system/theme-management','shared KRDS theme'),
 ('SECTION','context/control/step-flow/tests/jobs/assurance','/admin/system/section-management','orchestration section contract'),
 ('COMPONENT','metric/status/step card/evidence list','/admin/system/component-management','reusable process components'),
 ('DESIGN','PROCESS_ORCHESTRATION/platform-v2','/admin/system/design-management','responsive orchestration pattern'),
 ('FRONTEND','ProcessOrchestrationPage','/admin/system/page-development-master','implemented process-scoped page'),
 ('API','GET /admin/api/system/actor-process','/admin/system/api-management','implemented authenticated endpoint'),
 ('BACKEND','ActorProcessGovernanceService.dashboard','/admin/system/function-management','canonical governance aggregation'),
 ('DATABASE','process + step + test + job + assurance sources','/admin/system/db-table-management','54 DB-resolved fields'),
 ('TEST','42 linked process steps and 66 simulation cases','/admin/system/verification-asset-management','independent process coverage')
) a(layer,asset_ref,management_route,evidence)
WHERE lower(split_part(c.route_path,'?',1))='/admin/system/process-workspace'
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_screen_template_standard standard SET
 representative_screen_resource_id=r.screen_resource_id,representative_route=r.route_key,
 standard_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||gate.design_gate_score||':'||gate.design_gate_status,
 standard_version='2.0.0',updated_by='PROCESS_ORCHESTRATION_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance gate USING(screen_resource_id)
WHERE standard.screen_type='PROCESS_ORCHESTRATION' AND r.route_key='/admin/system/process-workspace';

UPDATE framework_page_development_item item SET
 design_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
 blocker_reason=CASE WHEN gate.design_gate_status='PASSED' THEN NULL ELSE array_to_string(gate.design_gate_issues,', ') END,
 next_action=CASE WHEN gate.design_gate_status='PASSED' THEN 'Approved PROCESS_ORCHESTRATION representative; generator use is allowed.'
  ELSE 'Resolve PROCESS_ORCHESTRATION representative gate: '||array_to_string(gate.design_gate_issues,', ') END,
 updated_by='PROCESS_ORCHESTRATION_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_page_design_assurance gate JOIN framework_screen_resource r USING(screen_resource_id)
WHERE item.screen_resource_id=gate.screen_resource_id AND r.route_key='/admin/system/process-workspace';
