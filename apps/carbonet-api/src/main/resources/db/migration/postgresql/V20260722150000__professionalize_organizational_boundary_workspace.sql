-- Register the implemented organizational-boundary workspace as the canonical
-- four-actor execution surface. The same React workspace is intentionally N:M
-- bound to collection, review, consolidation and approval steps.

INSERT INTO framework_screen_resource(route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
 responsive_contract,accessibility_contract,security_contract)
VALUES
('/emission/organizational-boundary','조직경계 및 연결 산정','WORKSPACE','VERIFIED','REACT_SOURCE','features/organizational-boundary/OrganizationalBoundaryPage.tsx',
 '{"mobile":"stage cards and forms stack; wide ledgers scroll locally","tablet":"two-column policy and metrics","desktop":"four-stage workspace and full ledgers","overflow":"no page horizontal overflow"}',
 '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"tableHeaders":true,"focusVisible":true}',
 '{"authentication":"MEMBER","tenantIsolation":true,"projectIsolation":true,"actorAssignment":true,"optimisticVersion":true,"serverTransition":true,"audit":true}'),
('/admin/emission/organizational-boundary','조직경계 운영','WORKSPACE','VERIFIED','REACT_SOURCE','features/organizational-boundary/OrganizationalBoundaryPage.tsx',
 '{"mobile":"admin shell plus stacked workspace","tablet":"two-column policy and metrics","desktop":"admin shell and full four-stage workspace","overflow":"tables scroll locally"}',
 '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"tableHeaders":true,"focusVisible":true}',
 '{"authentication":"ADMIN","tenantIsolation":true,"projectIsolation":true,"actorOrWebmaster":true,"optimisticVersion":true,"serverTransition":true,"audit":true}')
ON CONFLICT(route_key) DO UPDATE SET screen_name=excluded.screen_name,screen_type='WORKSPACE',implementation_status='VERIFIED',
 source_kind='REACT_SOURCE',source_ref=excluded.source_ref,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,updated_at=current_timestamp;

INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
 initial_view,context_contract,visibility_contract,completion_contract,guide_contract,binding_status)
SELECT s.process_code,s.step_code,r.screen_resource_id,a.audience,s.actor_code,
 CASE WHEN a.audience='USER' THEN 'PRIMARY' ELSE 'SUPPORT' END,'ORGANIZATIONAL_BOUNDARY_WORKSPACE',
 '{"tenantId":"resolved from authenticated project","projectId":"required","processCode":"ORGANIZATIONAL_BOUNDARY","currentStep":"server authoritative"}',
 jsonb_build_object('authentication',true,'projectAssignment',true,'actor',s.actor_code,'webmasterOverride',a.audience='ADMIN'),
 jsonb_build_object('command',s.command_code,'fromState',s.from_state,'toState',s.to_state,'evidenceRequired',true,'auditEvent',true),
 jsonb_build_object('sequence',jsonb_build_array('load project scope','complete current stage fields','validate evidence and totals','execute server transition','notify next actor','continue in work guide')),
 'ACTIVE'
FROM framework_process_step s
CROSS JOIN (VALUES('USER','/emission/organizational-boundary'),('ADMIN','/admin/emission/organizational-boundary')) a(audience,route_key)
JOIN framework_screen_resource r ON r.route_key=a.route_key
WHERE s.process_code='ORGANIZATIONAL_BOUNDARY'
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET actor_code=excluded.actor_code,
 entry_mode=excluded.entry_mode,initial_view=excluded.initial_view,context_contract=excluded.context_contract,
 visibility_contract=excluded.visibility_contract,completion_contract=excluded.completion_contract,
 guide_contract=excluded.guide_contract,binding_status='ACTIVE',updated_at=current_timestamp;

CREATE TEMP TABLE org_boundary_field_spec(
 field_order integer,field_group varchar(40),field_code varchar(100),field_name varchar(160),data_type varchar(30),
 control_type varchar(40),api_property varchar(200),source_table varchar(100),source_column varchar(100),required boolean,
 editable boolean,validation jsonb,semantic_definition text
) ON COMMIT DROP;

INSERT INTO org_boundary_field_spec VALUES
(1,'CONTEXT','tenantId','테넌트 ID','STRING','HIDDEN','tenantId','emission_organizational_boundary','tenant_id',true,false,'{"minLength":1}','조직경계 데이터 격리 경계'),
(2,'CONTEXT','projectId','프로젝트 ID','STRING','HIDDEN','project.id','emission_organizational_boundary','project_id',true,false,'{"minLength":1}','경계 버전과 프로젝트의 결합 키'),
(3,'BOUNDARY','version','경계 버전','INTEGER','VERSION','versions[].version','emission_organizational_boundary','version_no',true,false,'{"minimum":1}','승인 후 변경을 분리하는 불변 버전'),
(4,'BOUNDARY','boundaryMethod','연결 접근법','CODE','SELECT','versions[].boundaryMethod','emission_organizational_boundary','boundary_method',true,true,'{"enum":["OPERATIONAL_CONTROL","FINANCIAL_CONTROL","EQUITY_SHARE"]}','조직경계 연결 기준'),
(5,'BOUNDARY','reportingBasis','보고 기준','STRING','TEXT','versions[].reportingBasis','emission_organizational_boundary','reporting_basis',true,true,'{"maxLength":60}','적용 표준과 방법론'),
(6,'BOUNDARY','rationale','선정 근거','STRING','TEXTAREA','versions[].rationale','emission_organizational_boundary','rationale',true,true,'{"minLength":1}','경계 결정의 감사 가능 근거'),
(7,'BOUNDARY','effectiveFrom','적용 시작일','DATE','DATE','versions[].effectiveFrom','emission_organizational_boundary','effective_from',true,true,'{}','경계 기준 적용 시작일'),
(8,'BOUNDARY','effectiveUntil','적용 종료일','DATE','DATE','versions[].effectiveUntil','emission_organizational_boundary','effective_until',false,true,'{"afterOrEqual":"effectiveFrom"}','경계 기준 적용 종료일'),
(9,'BOUNDARY','status','경계 상태','CODE','STATUS','versions[].status','emission_organizational_boundary','boundary_status',true,false,'{}','초안·검토·연결·승인 상태'),
(10,'BOUNDARY','rowVersion','동시성 버전','INTEGER','HIDDEN','versions[].rowVersion','emission_organizational_boundary','row_version',true,false,'{"minimum":1}','동시 수정 충돌 방지 버전'),
(11,'MEMBER','entityCode','법인·사업장 코드','STRING','TEXT','members[].entityCode','emission_organizational_boundary_member','entity_code',true,true,'{"minLength":1,"maxLength":80}','경계 구성원 고유 업무 코드'),
(12,'MEMBER','entityName','법인·사업장명','STRING','TEXT','members[].entityName','emission_organizational_boundary_member','entity_name',true,true,'{"minLength":1,"maxLength":200}','보고 대상 조직 이름'),
(13,'MEMBER','entityType','조직 유형','CODE','SELECT','members[].entityType','emission_organizational_boundary_member','entity_type',true,true,'{"enum":["LEGAL_ENTITY","SITE","JV"]}','법인·사업장·합작 분류'),
(14,'MEMBER','countryCode','국가 코드','CODE','TEXT','members[].countryCode','emission_organizational_boundary_member','country_code',true,true,'{"pattern":"^[A-Z]{2}$"}','보고 대상 소재 국가'),
(15,'MEMBER','ownershipPercent','지분율','DECIMAL','NUMBER','members[].ownershipPercent','emission_organizational_boundary_member','ownership_percent',true,true,'{"minimum":0,"maximum":100}','지분 접근법과 통제 판단 입력'),
(16,'MEMBER','controlType','통제 유형','CODE','SELECT','members[].controlType','emission_organizational_boundary_member','control_type',true,true,'{"enum":["OPERATIONAL","FINANCIAL","EQUITY","NONE"]}','운영·재무·지분 통제 판정'),
(17,'MEMBER','includedYn','경계 포함 여부','BOOLEAN','SELECT','members[].includedYn','emission_organizational_boundary_member','included_yn',true,true,'{"enum":["Y","N"]}','연결 산정 포함 결정'),
(18,'MEMBER','exclusionReason','제외 사유','STRING','TEXT','members[].exclusionReason','emission_organizational_boundary_member','exclusion_reason',false,true,'{"requiredWhen":{"includedYn":"N"}}','제외 결정의 필수 설명'),
(19,'MEMBER','memberEvidenceRef','경계 판정 증빙','STRING','TEXT','members[].evidenceRef','emission_organizational_boundary_member','evidence_ref',false,true,'{"maxLength":2000}','소유·통제 및 제외 판정 원본'),
(20,'ELIMINATION','sourceEntityCode','발생 법인','STRING','TEXT','eliminations[].sourceEntityCode','emission_organizational_boundary_elimination','source_entity_code',true,true,'{"differentFrom":"counterpartyEntityCode"}','내부거래 발생 조직'),
(21,'ELIMINATION','counterpartyEntityCode','상대 법인','STRING','TEXT','eliminations[].counterpartyEntityCode','emission_organizational_boundary_elimination','counterparty_entity_code',true,true,'{"differentFrom":"sourceEntityCode"}','내부거래 상대 조직'),
(22,'ELIMINATION','activityCategory','활동 구분','STRING','TEXT','eliminations[].activityCategory','emission_organizational_boundary_elimination','activity_category',true,true,'{"minLength":1}','중복 제거 대상 활동 분류'),
(23,'ELIMINATION','grossEmission','거래 총 배출량','DECIMAL','NUMBER','eliminations[].grossEmission','emission_organizational_boundary_elimination','gross_emission',true,true,'{"minimum":0}','제거 전 내부거래 배출량'),
(24,'ELIMINATION','eliminatedEmission','제거 배출량','DECIMAL','NUMBER','eliminations[].eliminatedEmission','emission_organizational_boundary_elimination','eliminated_emission',true,true,'{"minimum":0,"maximumField":"grossEmission"}','중복 연결에서 제거할 배출량'),
(25,'ELIMINATION','unit','배출량 단위','STRING','TEXT','eliminations[].unit','emission_organizational_boundary_elimination','unit',true,true,'{"maxLength":30}','연결 산정 표준 단위'),
(26,'ELIMINATION','eliminationEvidenceRef','내부거래 증빙','STRING','TEXT','eliminations[].evidenceRef','emission_organizational_boundary_elimination','evidence_ref',true,true,'{"minLength":1}','제거 분개와 원천자료'),
(27,'RESULT','totalGrossEmission','총 배출량','DECIMAL','NUMBER','consolidations[].grossEmission','emission_organizational_boundary_consolidation','gross_emission',true,true,'{"minimum":0}','연결 제거 전 총계'),
(28,'RESULT','totalEliminatedEmission','총 제거량','DECIMAL','NUMBER','consolidations[].eliminatedEmission','emission_organizational_boundary_consolidation','eliminated_emission',true,false,'{"minimum":0}','내부거래 제거 합계'),
(29,'RESULT','netEmission','순 배출량','DECIMAL','NUMBER','consolidations[].netEmission','emission_organizational_boundary_consolidation','net_emission',true,false,'{"formula":"gross-eliminated"}','조직경계 최종 연결 배출량'),
(30,'RESULT','reconciliationDifference','조정 차이','DECIMAL','NUMBER','consolidations[].reconciliationDifference','emission_organizational_boundary_consolidation','reconciliation_difference',true,false,'{"maximumAbsolute":0}','연결 산정 대사 차이'),
(31,'RESULT','calculationHash','계산 해시','STRING','TEXT','consolidations[].calculationHash','emission_organizational_boundary_consolidation','calculation_hash',true,false,'{"minLength":32}','산정 결과 무결성 식별자'),
(32,'APPROVAL','approvedBy','승인자','STRING','TEXT','versions[].approvedBy','emission_organizational_boundary','approved_by',false,false,'{}','승인·잠금 수행 계정'),
(33,'APPROVAL','approvedAt','승인 시각','DATETIME','DATETIME','versions[].approvedAt','emission_organizational_boundary','approved_at',false,false,'{}','서버 기준 승인 시각'),
(34,'EXECUTION','executionId','프로세스 실행 ID','UUID','TEXT','execution.executionId','framework_process_execution','execution_id',false,false,'{}','네 단계 상태와 감사 이벤트의 상위 식별자'),
(35,'EXECUTION','currentStepCode','현재 업무 단계','CODE','STATUS','execution.currentStepCode','framework_process_execution','current_step_code',false,false,'{}','현재 처리 액터와 화면 단계'),
(36,'EXECUTION','currentState','현재 업무 상태','CODE','STATUS','execution.currentState','framework_process_execution','current_state',false,false,'{}','서버 권위의 업무 상태'),
(37,'AUDIT','eventId','감사 이벤트 ID','LONG','TEXT','events[].eventId','framework_process_execution_event','event_id',false,false,'{}','단계 전이 감사 식별자'),
(38,'AUDIT','eventCommand','업무 명령','CODE','TEXT','events[].commandCode','framework_process_execution_event','command_code',false,false,'{}','실행된 멱등 업무 명령'),
(39,'HANDOFF','notificationId','인계 알림 ID','LONG','TEXT','notifications[].id','emission_workflow_notification','notification_id',false,false,'{}','다음 액터 업무 인계 식별자');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'EMISSION.ORGANIZATIONAL_BOUNDARY.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),'EMISSION',field_name,data_type,
 semantic_definition,CASE WHEN field_group IN('MEMBER','ELIMINATION') THEN 'CONFIDENTIAL' ELSE 'INTERNAL' END,validation
FROM org_boundary_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding WHERE screen_resource_id IN
 (SELECT screen_resource_id FROM framework_screen_resource WHERE route_key IN('/emission/organizational-boundary','/admin/emission/organizational-boundary'));
INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'EMISSION.ORGANIZATIONAL_BOUNDARY.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,f.required,f.editable,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN org_boundary_field_spec f
WHERE r.route_key IN('/emission/organizational-boundary','/admin/emission/organizational-boundary');

UPDATE framework_professional_screen_contract c SET
 field_contract=(SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'name',f.field_name,'apiProperty',f.api_property,
   'source',f.source_table||'.'||f.source_column,'required',f.required,'editable',f.editable) ORDER BY f.field_order)::text FROM org_boundary_field_spec f),
 section_contract='["processStage","boundaryPolicy","entityRegister","inclusionDecision","eliminationLedger","consolidationResult","approvalAndVersion","auditAndHandoff"]',
 command_contract=CASE c.step_code WHEN 'ORGANIZATIONAL_BOUNDARY_S1' THEN '["saveVersionedDraft"]' WHEN 'ORGANIZATIONAL_BOUNDARY_S2' THEN '["validateInclusion","requestReview"]' WHEN 'ORGANIZATIONAL_BOUNDARY_S3' THEN '["validateEliminations","runConsolidation"]' ELSE '["approveAndLock","rejectForCorrection"]' END,
 state_contract='["LOADING","DRAFT","REVIEW_READY","CONSOLIDATED","APPROVED","REJECTED","VALIDATION_ERROR","VERSION_CONFLICT","FORBIDDEN","SESSION_EXPIRED"]',
 data_contract='[{"entities":["emission_organizational_boundary","emission_organizational_boundary_member","emission_organizational_boundary_elimination","emission_organizational_boundary_consolidation","framework_process_execution","framework_process_execution_event","emission_workflow_notification"],"tenantScoped":true,"projectScoped":true,"optimisticVersion":"row_version"}]',
 evidence_contract='[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"],"lineage":"39 DB-resolved fields","handoff":"next actor notification","audit":"immutable process event"}]',
 responsive_contract='{"mobile":"stacked stages and local ledger scrolling","tablet":"two-column policy and metrics","desktop":"four-stage professional workspace"}',
 accessibility_contract='{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"ariaLive":true,"tableHeaders":true,"focusVisible":true}',
 security_contract='{"authentication":true,"tenantIsolation":true,"projectIsolation":true,"actorAssignment":true,"optimisticVersion":true,"serverTransition":true,"idempotency":true,"audit":true}',
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,accessibility_verified=true,
 exception_states_verified=true,audit_evidence_ref='OrganizationalBoundaryPage+EmissionProjectRegistryController+EmissionProjectRegistryService:2.0.0:2026-07-22',
 contract_status='VERIFIED',updated_by='ORGANIZATIONAL_BOUNDARY_STANDARD_RECONCILIATION',menu_verified=true,updated_at=current_timestamp
WHERE c.process_code='ORGANIZATIONAL_BOUNDARY'
  AND lower(split_part(c.route_path,'?',1)) IN('/emission/organizational-boundary','/admin/emission/organizational-boundary');

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.layer,a.ref,a.management_route,'REUSED',a.evidence,true,'ORGANIZATIONAL_BOUNDARY_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS government work tokens','/admin/system/theme-management','shared KRDS theme'),
 ('SECTION','stage/policy/entity/elimination/result/approval/handoff','/admin/system/section-management','workspace section contract'),
 ('COMPONENT','stage card/field/table/status/action','/admin/system/component-management','common components'),
 ('DESIGN','WORKSPACE/organizational-boundary-v2','/admin/system/design-management','responsive professional pattern'),
 ('FRONTEND','OrganizationalBoundaryPage','/admin/system/page-development-master','implemented shared user/admin source'),
 ('API','boundary query/save/review/consolidate/decision','/admin/system/api-management','authenticated scoped endpoints'),
 ('BACKEND','EmissionProjectRegistryService + process governance','/admin/system/function-management','transactional domain and process handoff'),
 ('DATABASE','boundary/member/elimination/consolidation/execution/notification','/admin/system/db-table-management','39 DB-resolved fields'),
 ('TEST','four steps x five test families','/admin/system/verification-asset-management','normal authority isolation exception recovery')
) a(layer,ref,management_route,evidence)
WHERE c.process_code='ORGANIZATIONAL_BOUNDARY'
  AND lower(split_part(c.route_path,'?',1)) IN('/emission/organizational-boundary','/admin/emission/organizational-boundary')
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_process_definition SET process_status='ACTIVE',process_version='2.0.0',automation_mode='AUTOMATIC',updated_at=current_timestamp
WHERE process_code='ORGANIZATIONAL_BOUNDARY';

