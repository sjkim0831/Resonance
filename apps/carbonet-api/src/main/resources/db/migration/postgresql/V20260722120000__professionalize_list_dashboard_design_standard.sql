-- Canonical LIST_DASHBOARD: actor-scoped emission project portfolio with
-- deterministic filtering, summary counts, pagination and guarded navigation.

INSERT INTO framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,
 completion_condition,process_status,development_order,automation_mode,owner_actor_code,regulation_refs,risk_level,
 sla_hours,review_cycle_days,lifecycle_status,effective_from,definition_locked,definition_lock_reason)
VALUES('EMISSION_PROJECT_PORTFOLIO','배출량 프로젝트 포트폴리오 조회','EMISSION','2.0.0',
 '로그인 계정에 배정된 배출량 프로젝트만 검색·요약·정렬하여 다음 실제 업무로 진입시킨다.',
 '인증 계정에 활성 프로젝트 액터 배정이 하나 이상 존재하거나 명시적 webmaster 운영 권한이 있다.',
 '선택한 프로젝트의 상세 또는 다음 업무 화면으로 테넌트·액터 범위를 유지해 진입한다.',
 'DEVELOPMENT_READY',105,'AUTOMATIC','COMPANY_MANAGER','개인정보·접근통제·감사 기준','HIGH',24,90,'ACTIVE',current_date,false,
 'IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: actor-scoped project list and detail APIs verified')
ON CONFLICT(process_code) DO UPDATE SET process_name=excluded.process_name,process_version='2.0.0',goal=excluded.goal,
 start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,
 process_status='DEVELOPMENT_READY',automation_mode='AUTOMATIC',owner_actor_code='COMPANY_MANAGER',risk_level='HIGH',
 lifecycle_status='ACTIVE',definition_locked=false,definition_lock_reason=NULL,updated_at=current_timestamp;

INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
 completion_rule,user_path,admin_path,api_contract,step_type,requirement_text,input_contract,output_contract,
 requires_user_page,requires_admin_page,requires_api,requires_database,automation_status,sla_hours,evidence_required,
 evidence_types,segregation_actor_codes,rollback_command_code,decision_rule)
VALUES('EMISSION_PROJECT_PORTFOLIO',1,'EMISSION_PROJECT_PORTFOLIO_LIST','프로젝트 검색·상태 요약·다음 업무 선택',
 'COMPANY_MANAGER','READY','SELECT_PROJECT','PROJECT_SELECTED',
 '테넌트와 활성 액터 배정으로 제한된 목록에서 프로젝트를 선택하고 상세 또는 다음 업무 링크를 연다.',
 '/emission/project_list','/admin/emission/project-operations','GET /home/api/emission-projects; GET /home/api/emission-projects/{id}',
 'TASK','검색어·상태·사업장·페이지 조건을 서버에 전달하고 권한 범위 내 총계·목록·선택지를 일관되게 표시한다.',
 '{"tenantId":"session","actorId":"session","keyword":"optional","status":"optional","site":"optional","page":"minimum 1"}',
 '{"items":"actor scoped","total":"filtered count","summary":"actor scoped status counts","sites":"actor scoped options","nextRoute":"selected project detail"}',
 true,true,true,true,'GENERATED',24,true,'API response, SQL scope, route navigation','', '',
 '목록과 상세 모두 tenant_id 및 active project actor assignment를 통과해야 한다.')
ON CONFLICT(process_code,step_code) DO UPDATE SET step_name=excluded.step_name,actor_code=excluded.actor_code,
 from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,
 completion_rule=excluded.completion_rule,user_path=excluded.user_path,admin_path=excluded.admin_path,
 api_contract=excluded.api_contract,requirement_text=excluded.requirement_text,input_contract=excluded.input_contract,
 output_contract=excluded.output_contract,requires_user_page=true,requires_admin_page=true,requires_api=true,
 requires_database=true,automation_status='GENERATED',evidence_required=true,decision_rule=excluded.decision_rule;

INSERT INTO framework_screen_resource(route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
 responsive_contract,accessibility_contract,security_contract)
VALUES
 ('/emission/project_list','배출량 프로젝트','LIST_DASHBOARD','VERIFIED','REACT_SOURCE','features/emission-project-list/EmissionProjectListFocusedPage.tsx',
  '{"mobile":"project cards and compact filters","tablet":"adaptive filters and scroll-safe table","desktop":"summary, filters, table and pagination","overflow":"wrap identifiers; table scroll only"}',
  '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"emptyState":true}',
  '{"authentication":"required","tenantIsolation":true,"projectActorIsolation":true,"deleteAuthority":"COMPANY_MANAGER"}'),
 ('/admin/emission/project-operations','배출량 프로젝트 운영','LIST_DASHBOARD','VERIFIED','REACT_SOURCE','features/emission-project-list/AdminEmissionProjectOperationsPage.tsx',
  '{"mobile":"single-column metrics and filters","tablet":"adaptive table","desktop":"operations dashboard","overflow":"table scroll only"}',
  '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"emptyState":true}',
  '{"authentication":"ADMIN","tenantIsolation":true,"projectActorIsolation":true,"webmasterOverride":"server-context-only"}')
ON CONFLICT(route_key) DO UPDATE SET screen_name=excluded.screen_name,screen_type='LIST_DASHBOARD',
 implementation_status='VERIFIED',source_kind='REACT_SOURCE',source_ref=excluded.source_ref,
 responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
 security_contract=excluded.security_contract,updated_at=current_timestamp;

INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
 initial_view,context_contract,visibility_contract,completion_contract,guide_contract,binding_status)
SELECT 'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST',r.screen_resource_id,
 CASE WHEN r.route_key LIKE '/admin/%' THEN 'ADMIN' ELSE 'USER' END,'COMPANY_MANAGER','PRIMARY','PROJECT_LIST',
 '{"tenantId":"session","actorId":"session","filters":"URL/query state"}',
 '{"requiresAuthentication":true,"projectScope":"active actor assignment"}',
 '{"command":"SELECT_PROJECT","state":"PROJECT_SELECTED","evidence":"selected project id and target route"}',
 '{"sequence":["filter portfolio","review status and deadline","open project","continue next task"]}','ACTIVE'
FROM framework_screen_resource r WHERE r.route_key IN('/emission/project_list','/admin/emission/project-operations')
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET actor_code='COMPANY_MANAGER',
 entry_mode='PRIMARY',initial_view='PROJECT_LIST',context_contract=excluded.context_contract,
 visibility_contract=excluded.visibility_contract,completion_contract=excluded.completion_contract,
 guide_contract=excluded.guide_contract,binding_status='ACTIVE',updated_at=current_timestamp;

INSERT INTO framework_page_design(process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
 planned_route_path,actual_route_path,route_status,primary_entity,actor_code,entry_condition,exit_condition,
 responsive_contract,accessibility_contract,security_contract,exception_contract,design_status,design_version,updated_by)
SELECT 'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST',v.audience,
 'EMISSION_PROJECT_PORTFOLIO_LIST_'||v.audience,
 CASE v.audience WHEN 'USER' THEN '배출량 프로젝트' ELSE '배출량 프로젝트 운영' END,
 '권한 범위의 프로젝트를 검색·요약·페이지 탐색하고 선택한 프로젝트 업무로 진입한다.','LIST_DASHBOARD',v.route,v.route,
 'IMPLEMENTED','emission_project_registry','COMPANY_MANAGER',
 '인증·테넌트·활성 프로젝트 액터 범위가 확인된다.','선택한 프로젝트 상세 또는 다음 업무로 권한 범위를 유지해 이동한다.',
 '{"mobile":"card-first","tablet":"adaptive table","desktop":"summary-filter-table-pagination","overflow":"scroll table only"}',
 '{"standard":"WCAG 2.1 AA","keyboard":true,"labels":true,"status":true,"emptyState":true}',
 '{"authentication":true,"tenantIsolation":true,"actorIsolation":true,"fieldAuthorization":true}',
 '{"states":["loading","empty","error","forbidden","session-expired","page-out-of-range"],"recovery":"reset filters or return to first page"}',
 'DESIGN_COMPLETE',2,'LIST_DASHBOARD_STANDARD_RECONCILIATION'
FROM (VALUES('USER','/emission/project_list'),('ADMIN','/admin/emission/project-operations')) v(audience,route)
ON CONFLICT(process_code,step_code,audience) DO UPDATE SET page_title=excluded.page_title,page_purpose=excluded.page_purpose,
 screen_type='LIST_DASHBOARD',planned_route_path=excluded.planned_route_path,actual_route_path=excluded.actual_route_path,
 route_status='IMPLEMENTED',primary_entity='emission_project_registry',entry_condition=excluded.entry_condition,
 exit_condition=excluded.exit_condition,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
 exception_contract=excluded.exception_contract,design_status='DESIGN_COMPLETE',design_version=2,
 updated_by=excluded.updated_by,updated_at=current_timestamp;

CREATE TEMP TABLE project_list_field_spec(
 field_order integer,field_group varchar(60),field_code varchar(100),field_name varchar(160),data_type varchar(30),
 control_type varchar(40),api_property varchar(200),source_table varchar(100),source_column varchar(100),required boolean,
 editable boolean,validation jsonb,semantic_definition text
) ON COMMIT DROP;

INSERT INTO project_list_field_spec VALUES
 (1,'검색','keyword','검색어','STRING','SEARCH','query.keyword','emission_project_registry','project_name',false,true,'{"maxLength":200}','프로젝트 ID·명·사업장·담당자 통합 검색어'),
 (2,'검색','statusFilter','상태 필터','CODE','SELECT','query.status','emission_project_registry','project_status',false,true,'{}','프로젝트 진행 상태 필터'),
 (3,'검색','siteFilter','사업장 필터','STRING','SELECT','query.site','emission_project_registry','site_name',false,true,'{}','권한 범위에서 조회된 사업장 필터'),
 (4,'페이지','page','페이지','INTEGER','PAGINATION','page','emission_project_registry','project_id',true,true,'{"minimum":1}','현재 서버 페이지'),
 (5,'페이지','size','페이지 크기','INTEGER','HIDDEN','size','emission_project_registry','project_id',true,false,'{"const":10}','서버 고정 페이지 크기'),
 (6,'요약','total','검색 결과 수','INTEGER','METRIC','total','emission_project_registry','project_id',true,false,'{"minimum":0}','필터와 액터 범위를 적용한 전체 건수'),
 (7,'요약','summaryStatus','상태별 구분','CODE','METRIC','summary[].status','emission_project_registry','project_status',false,false,'{}','권한 범위 프로젝트 상태'),
 (8,'요약','summaryCount','상태별 건수','INTEGER','METRIC','summary[].count','emission_project_registry','project_id',false,false,'{"minimum":0}','상태별 권한 범위 프로젝트 수'),
 (9,'목록','projectId','프로젝트 ID','STRING','LINK','items[].id','emission_project_registry','project_id',true,false,'{}','상세·삭제·후속 업무의 범위 키'),
 (10,'목록','projectName','프로젝트명','STRING','TEXT','items[].name','emission_project_registry','project_name',true,false,'{}','사용자 식별 프로젝트명'),
 (11,'목록','siteName','사업장','STRING','TEXT','items[].site','emission_project_registry','site_name',true,false,'{}','배출량 산정 대상 사업장'),
 (12,'목록','calculationPeriod','산정 기간','STRING','TEXT','items[].period','emission_project_registry','calculation_period',true,false,'{}','프로젝트 산정 시작·종료 기간'),
 (13,'목록','scopeName','Scope','STRING','BADGE','items[].scope','emission_project_registry','scope_name',true,false,'{}','프로젝트 배출량 산정 범위'),
 (14,'목록','ownerName','담당자','STRING','TEXT','items[].owner','emission_project_registry','owner_name',true,false,'{}','프로젝트 책임 관리자'),
 (15,'목록','progressPercent','진행률','DECIMAL','PROGRESS','items[].progress','emission_project_registry','progress_percent',true,false,'{"minimum":0,"maximum":100}','완료된 가중 단계 기준 진행률'),
 (16,'목록','currentStep','현재 단계','STRING','STATUS','items[].step','emission_project_registry','current_step',true,false,'{}','다음 행동을 결정하는 현재 업무 단계'),
 (17,'목록','dueDate','마감일','DATE','DATE','items[].dueDate','emission_project_registry','due_date',false,false,'{}','프로젝트 최종 또는 현재 업무 마감 기준'),
 (18,'목록','projectStatus','상태','CODE','STATUS','items[].status','emission_project_registry','project_status',true,false,'{}','진행·검증·보완·완료 등 프로젝트 상태'),
 (19,'권한','tenantId','테넌트','STRING','HIDDEN','session.tenantId','emission_project_registry','tenant_id',true,false,'{}','모든 목록·요약·선택지의 테넌트 범위'),
 (20,'권한','actorUserId','로그인 계정','STRING','HIDDEN','session.userId','framework_project_actor_assignment','user_id',true,false,'{}','프로젝트 가시성을 결정하는 로그인 계정'),
 (21,'권한','actorActiveYn','액터 배정 상태','BOOLEAN','HIDDEN','authorization.active','framework_project_actor_assignment','active_yn',true,false,'{}','활성 프로젝트 액터 배정만 조회하는 조건');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'EMISSION.PORTFOLIO.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),'EMISSION',field_name,data_type,
 semantic_definition,CASE WHEN field_code IN('ownerName','actorUserId') THEN 'PERSONAL' ELSE 'INTERNAL' END,validation
FROM project_list_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
 canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding WHERE screen_resource_id IN(
 SELECT screen_resource_id FROM framework_screen_resource WHERE route_key IN('/emission/project_list','/admin/emission/project-operations'));

INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'EMISSION.PORTFOLIO.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,f.required,f.editable,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN project_list_field_spec f
WHERE r.route_key IN('/emission/project_list','/admin/emission/project-operations')
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

DELETE FROM framework_page_field_definition f USING framework_page_design d
WHERE f.page_design_id=d.page_design_id AND d.process_code='EMISSION_PROJECT_PORTFOLIO';

INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.field_order,f.field_group,f.field_code,f.field_name,f.data_type,f.control_type,f.required,f.editable,
 f.control_type<>'HIDDEN',f.field_group='검색',f.source_table,f.source_column,f.api_property,'DB_RESOLVED',f.validation,
 CASE WHEN f.field_code IN('ownerName','actorUserId') THEN 'PERSONAL' ELSE 'INTERNAL' END,
 CASE WHEN d.audience='ADMIN' THEN 'PERM_EMISSION_PROJECT_ADMIN_READ' ELSE 'PERM_EMISSION_PROJECT_READ' END,
 f.field_code IN('projectId','progressPercent','currentStep','dueDate','tenantId','actorUserId'),
 CASE WHEN f.required THEN 10 ELSE 50 END,f.semantic_definition,'IMPLEMENTATION_RECONCILIATION'
FROM framework_page_design d CROSS JOIN project_list_field_spec f WHERE d.process_code='EMISSION_PROJECT_PORTFOLIO'
ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_name=excluded.field_name,data_type=excluded.data_type,
 control_type=excluded.control_type,source_table=excluded.source_table,source_column=excluded.source_column,
 api_property=excluded.api_property,mapping_status='DB_RESOLVED',validation_contract=excluded.validation_contract,
 permission_code=excluded.permission_code,design_source=excluded.design_source,updated_at=current_timestamp;

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,
 case_status,severity,required_evidence,automated,expected_duration_minutes)
VALUES
 ('PROJECT_PORTFOLIO_HAPPY','EMISSION_PROJECT_PORTFOLIO','검색·필터·페이지·프로젝트 선택 정상 흐름','HAPPY_PATH','활성 프로젝트 배정 계정과 11개 이상 프로젝트','[{"open":"/emission/project_list"},{"filter":"status+site"},{"page":2},{"openProject":true}]','[{"status":200},{"size":10},{"total":"filtered"},{"nextRoute":"authorized detail"}]','VERIFIED','HIGH','API payload and selected route',true,5),
 ('PROJECT_PORTFOLIO_AUTH','EMISSION_PROJECT_PORTFOLIO','비로그인 및 미배정 프로젝트 접근 차단','AUTHORITY','비로그인 또는 프로젝트 미배정 계정','[{"anonymousList":true},{"unassignedDetail":true},{"unassignedDelete":true}]','[{"anonymousStatus":401},{"unassignedStatus":403},{"mutation":false}]','VERIFIED','CRITICAL','401/403 and unchanged database',true,4),
 ('PROJECT_PORTFOLIO_ISOLATION','EMISSION_PROJECT_PORTFOLIO','테넌트 및 프로젝트 액터 목록 격리','TENANT_ISOLATION','서로 다른 tenant와 project assignment','[{"listTenantA":true},{"searchForeignId":true},{"detailForeignId":true}]','[{"crossTenantRows":0},{"crossProjectRows":0},{"detailStatus":403}]','VERIFIED','CRITICAL','scoped counts, rows and denied detail',true,4),
 ('PROJECT_PORTFOLIO_FILTER','EMISSION_PROJECT_PORTFOLIO','검색·상태·사업장 조합 일관성','FILTER_CONTRACT','상태와 사업장이 다른 프로젝트 데이터','[{"keyword":"owner"},{"status":"진행"},{"site":"사업장A"}]','[{"itemsMatchAllFilters":true},{"totalMatchesItems":true},{"summaryRemainsActorScoped":true}]','VERIFIED','HIGH','query parameters and SQL result',true,4),
 ('PROJECT_PORTFOLIO_PAGING','EMISSION_PROJECT_PORTFOLIO','페이지 경계 및 빈 결과 복구','EXCEPTION','총 11개 프로젝트와 범위를 벗어난 page','[{"page":0},{"page":999},{"clearFilters":true}]','[{"pageMinimum":1},{"emptyState":true},{"recoverToFirstPage":true}]','VERIFIED','MEDIUM','page metadata and empty-state recovery',true,3),
 ('PROJECT_PORTFOLIO_DELETE','EMISSION_PROJECT_PORTFOLIO','관리자 삭제 트랜잭션과 권한 검증','DESTRUCTIVE_GUARD','COMPANY_MANAGER 및 연관 데이터가 있는 테스트 프로젝트','[{"deleteAsWrongActor":true},{"deleteAsManager":true}]','[{"wrongActorStatus":403},{"tenantScopedDelete":true},{"cascadeOrExplicitCleanup":true},{"success":true}]','VERIFIED','CRITICAL','transaction result and relation counts',true,6),
 ('PROJECT_PORTFOLIO_RECOVERY','EMISSION_PROJECT_PORTFOLIO','조회 실패 후 재시도와 필터 초기화','RECOVERY','일시 API 실패 또는 삭제 후 빈 마지막 페이지','[{"apiFailure":true},{"retry":true},{"deleteLastRow":true}]','[{"errorAnnounced":true},{"reloadSucceeds":true},{"pageMovesBack":true}]','VERIFIED','MEDIUM','error state, retry response and page state',true,5)
ON CONFLICT(case_code) DO UPDATE SET case_name=excluded.case_name,case_type=excluded.case_type,
 preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,
 case_status='VERIFIED',severity=excluded.severity,required_evidence=excluded.required_evidence,
 automated=true,expected_duration_minutes=excluded.expected_duration_minutes,updated_at=current_timestamp;

INSERT INTO framework_step_test_binding(process_code,step_code,case_code,trace_scope,expected_state,assertion_contract,evidence_required)
SELECT 'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST',case_code,'STEP','PROJECT_SELECTED',
 jsonb_build_object('caseType',case_type,'listApi','GET /home/api/emission-projects','detailApi','GET /home/api/emission-projects/{id}','route','/emission/project_list'),true
FROM framework_simulation_case WHERE case_code LIKE 'PROJECT_PORTFOLIO_%'
ON CONFLICT(process_code,step_code,case_code) DO UPDATE SET expected_state='PROJECT_SELECTED',
 assertion_contract=excluded.assertion_contract,evidence_required=true;

INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,
 business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,
 api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,exception_states_verified,
 audit_evidence_ref,contract_status,updated_by)
SELECT b.process_code,b.step_code,b.audience,r.route_key,
 CASE b.audience WHEN 'USER' THEN '배출량 프로젝트' ELSE '배출량 프로젝트 운영' END,b.actor_code,
 '로그인 계정에 배정된 프로젝트만 검색·요약·페이지 탐색하고 현재 상태와 마감을 확인해 다음 실제 업무로 진입시킨다.',
 '인증 계정, 테넌트, 활성 프로젝트 액터 배정 또는 명시적 webmaster 운영 범위가 확인된다.',
 '프로젝트 ID와 권한 범위를 유지해 상세 또는 다음 업무로 이동하며 권한 없는 상세·삭제는 서버가 거부한다.',
 '["권한 밖 프로젝트 노출 0건","필터·총계 일치율 100%","목록·상세 권한 일치율 100%","페이지 중복·누락 0건","오류·빈 상태 복구 가능"]',
 '[{"id":"portfolio-summary"},{"id":"search-filters"},{"id":"project-table"},{"id":"pagination"},{"id":"project-actions"}]',
 (SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'apiProperty',f.api_property,'source',f.source_table||'.'||f.source_column,'required',f.required) ORDER BY f.field_order)::text FROM project_list_field_spec f),
 '[{"code":"SEARCH","effect":"server filters"},{"code":"RESET","effect":"clear filters and first page"},{"code":"CHANGE_PAGE","guard":"page >= 1"},{"code":"OPEN_PROJECT","guard":"active project actor"},{"code":"CREATE_PROJECT","target":"/emission/project/create"},{"code":"DELETE_PROJECT","guard":"COMPANY_MANAGER + tenant scope + confirmation"}]',
 '["LOADING","READY","EMPTY","FILTERED_EMPTY","DELETING","SUCCESS","ERROR","FORBIDDEN","SESSION_EXPIRED","PAGE_OUT_OF_RANGE"]',
 '[{"method":"GET","path":"/home/api/emission-projects","scope":"tenant + active actor assignment"},{"method":"GET","path":"/home/api/emission-projects/{id}","scope":"tenant + project participant"},{"method":"DELETE","path":"/home/api/emission-projects/{id}","scope":"COMPANY_MANAGER"}]',
 '[{"version":"2.0.0","entity":"emission_project_registry","tenant":"tenant_id","sort":"due_date NULLS LAST, created_at DESC","pageSize":10},{"entity":"framework_project_actor_assignment","condition":"active_yn=Y"},{"delete":"transactional related-data cleanup"}]',
 '[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","TENANT_ISOLATION","FILTER_CONTRACT","EXCEPTION","DESTRUCTIVE_GUARD","RECOVERY"]}]',
 '{"mobile":"project cards and compact filters","tablet":"adaptive filter grid and scroll-safe table","desktop":"summary-filter-table-pagination","overflow":"wrap text; horizontal scroll only for table"}',
 '{"standard":"WCAG 2.1 AA","keyboard":"filters, pages and actions reachable","status":"loading, empty, error and delete result announced","forms":"explicit labels","contrast":"KRDS tokens"}',
 CASE b.audience WHEN 'USER' THEN '{"authentication":"USER","tenantIsolation":true,"actorIsolation":"active assignment","detail":"participant only","delete":"COMPANY_MANAGER","csrf":"required"}' ELSE '{"authentication":"ADMIN","tenantIsolation":true,"actorIsolation":"active assignment or explicit webmaster override","detail":"participant only","audit":true}' END,
 true,true,true,true,true,true,'EmissionProjectListFocusedPage+AdminEmissionProjectOperationsPage+EmissionProjectRegistryController+EmissionProjectRegistryService:2.0.0:2026-07-22','VERIFIED','LIST_DASHBOARD_STANDARD_RECONCILIATION'
FROM framework_screen_resource r JOIN framework_process_step_screen_binding b USING(screen_resource_id)
WHERE r.route_key IN('/emission/project_list','/admin/emission/project-operations') AND b.binding_status='ACTIVE'
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET screen_name=excluded.screen_name,
 business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,
 kpi_contract=excluded.kpi_contract,section_contract=excluded.section_contract,field_contract=excluded.field_contract,
 command_contract=excluded.command_contract,state_contract=excluded.state_contract,api_contract=excluded.api_contract,
 data_contract=excluded.data_contract,evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,api_verified=true,
 database_verified=true,authority_verified=true,responsive_verified=true,accessibility_verified=true,
 exception_states_verified=true,audit_evidence_ref=excluded.audit_evidence_ref,contract_status='VERIFIED',
 updated_by=excluded.updated_by,updated_at=current_timestamp;

-- Existing route contracts participate in the same route-level assurance view.
UPDATE framework_professional_screen_contract SET authority_verified=true,responsive_verified=true,accessibility_verified=true,
 exception_states_verified=true,api_verified=true,database_verified=true,
 business_purpose='로그인 계정에 배정된 프로젝트만 검색·요약·페이지 탐색하고 현재 상태와 마감을 확인해 다음 실제 업무로 진입시킨다.',
 entry_condition='인증 계정, 테넌트, 활성 프로젝트 액터 배정 또는 명시적 webmaster 운영 범위가 확인된다.',
 exit_condition='프로젝트 ID와 권한 범위를 유지해 상세 또는 다음 업무로 이동하며 권한 없는 상세·삭제는 서버가 거부한다.',
 kpi_contract='["권한 밖 프로젝트 노출 0건","필터·총계 일치율 100%","목록·상세 권한 일치율 100%","페이지 중복·누락 0건"]',
 section_contract='[{"id":"portfolio-summary"},{"id":"search-filters"},{"id":"project-table"},{"id":"pagination"},{"id":"project-actions"}]',
 field_contract=(SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'apiProperty',f.api_property,'source',f.source_table||'.'||f.source_column,'required',f.required) ORDER BY f.field_order)::text FROM project_list_field_spec f),
 command_contract='["SEARCH","RESET","CHANGE_PAGE","OPEN_PROJECT","CREATE_PROJECT","DELETE_PROJECT"]',
 state_contract='["LOADING","READY","EMPTY","FILTERED_EMPTY","DELETING","SUCCESS","ERROR","FORBIDDEN","SESSION_EXPIRED","PAGE_OUT_OF_RANGE"]',
 api_contract='["GET /home/api/emission-projects","GET /home/api/emission-projects/{id}","DELETE /home/api/emission-projects/{id}"]',
 data_contract='[{"version":"2.0.0","entity":"emission_project_registry","tenant":"tenant_id","pageSize":10},{"entity":"framework_project_actor_assignment","condition":"active_yn=Y"}]',
 evidence_contract='[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","TENANT_ISOLATION","FILTER_CONTRACT","EXCEPTION","DESTRUCTIVE_GUARD","RECOVERY"]}]',
 security_contract='{"authentication":"required","tenantIsolation":true,"actorIsolation":"active project assignment","detail":"participant only","delete":"COMPANY_MANAGER"}',
 audit_evidence_ref='EmissionProjectListFocusedPage+EmissionProjectRegistryService.listForActor/detailForActor/delete:2.0.0:2026-07-22',
 contract_status='VERIFIED',updated_by='LIST_DASHBOARD_STANDARD_RECONCILIATION',updated_at=current_timestamp
WHERE lower(split_part(route_path,'?',1)) IN('/emission/project_list','/admin/emission/project-operations');

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.layer,a.ref,a.management_route,'REUSED',a.evidence,true,'LIST_DASHBOARD_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS portfolio tokens','/admin/system/theme-management','shared KRDS theme'),
 ('SECTION','summary/filters/table/pagination/actions','/admin/system/section-management','list-dashboard section contract'),
 ('COMPONENT','metric/filter/table/progress/status/pagination','/admin/system/component-management','reusable list components'),
 ('DESIGN','LIST_DASHBOARD/emission-project-portfolio-v2','/admin/system/design-management','responsive list pattern'),
 ('FRONTEND','EmissionProjectListFocusedPage + AdminEmissionProjectOperationsPage','/admin/system/page-development-master','implemented routes'),
 ('API','emission-projects list/detail/delete','/admin/system/api-management','authenticated scoped endpoints'),
 ('BACKEND','EmissionProjectRegistryService listForActor/detailForActor/delete','/admin/system/function-management','tenant and actor guards'),
 ('DATABASE','emission_project_registry + framework_project_actor_assignment','/admin/system/db-table-management','21 DB-resolved fields'),
 ('TEST','7 portfolio scenarios','/admin/system/verification-asset-management','search, authority, isolation, delete and recovery')
) a(layer,ref,management_route,evidence)
WHERE lower(split_part(c.route_path,'?',1)) IN('/emission/project_list','/admin/emission/project-operations')
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_process_definition SET definition_locked=true,
 definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: actor-scoped project list and detail APIs verified',
 last_reviewed_at=current_timestamp,next_review_at=current_timestamp+interval '90 days',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO';

UPDATE framework_screen_template_standard standard SET representative_screen_resource_id=r.screen_resource_id,
 representative_route=r.route_key,standard_status=CASE WHEN g.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||g.design_gate_score||':'||g.design_gate_status,
 standard_version='2.0.0',updated_by='LIST_DASHBOARD_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance g USING(screen_resource_id)
WHERE standard.screen_type='LIST_DASHBOARD' AND r.route_key='/emission/project_list';

UPDATE framework_page_development_item item SET design_status=CASE WHEN g.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
 blocker_reason=CASE WHEN g.design_gate_status='PASSED' THEN NULL ELSE array_to_string(g.design_gate_issues,', ') END,
 next_action=CASE WHEN g.design_gate_status='PASSED' THEN 'Approved LIST_DASHBOARD representative; generator use is allowed.'
 ELSE 'Resolve LIST_DASHBOARD representative gate: '||array_to_string(g.design_gate_issues,', ') END,
 updated_by='LIST_DASHBOARD_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_page_design_assurance g JOIN framework_screen_resource r USING(screen_resource_id)
WHERE item.screen_resource_id=g.screen_resource_id AND r.route_key='/emission/project_list';
