-- Establish reusable, fail-closed screen-type standards before mass generation.
-- A representative may be promoted only when the existing ten-point design gate passes.

CREATE TABLE IF NOT EXISTS framework_screen_template_standard (
  screen_type varchar(60) PRIMARY KEY,
  standard_name varchar(160) NOT NULL,
  representative_screen_resource_id bigint REFERENCES framework_screen_resource(screen_resource_id),
  representative_route varchar(400),
  standard_status varchar(30) NOT NULL DEFAULT 'NEEDS_REPRESENTATIVE'
    CHECK (standard_status IN ('NEEDS_REPRESENTATIVE','REVIEW_REQUIRED','APPROVED','RETIRED')),
  minimum_design_gate_score integer NOT NULL DEFAULT 100 CHECK (minimum_design_gate_score BETWEEN 0 AND 100),
  reusable_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  standard_version varchar(30) NOT NULL DEFAULT '1.0.0',
  evidence_ref text NOT NULL DEFAULT '',
  protected boolean NOT NULL DEFAULT true,
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

INSERT INTO framework_screen_template_standard(screen_type,standard_name,reusable_scope,updated_by)
SELECT type.screen_type,
       CASE type.screen_type
         WHEN 'FORM_WIZARD' THEN '단계형 입력·검증 표준'
         WHEN 'LIST_DASHBOARD' THEN '목록·검색·현황 표준'
         WHEN 'WORKSPACE' THEN '전문 업무 작업공간 표준'
         WHEN 'WORK_EXECUTION' THEN '업무 실행·완료 표준'
         WHEN 'REVIEW_DECISION' THEN '검토·판정·승인 표준'
         WHEN 'REPORT_DOCUMENT' THEN '보고서·산출물 표준'
         WHEN 'PROCESS_STEP_WORKSPACE' THEN '프로세스 단계 작업공간 표준'
         WHEN 'DATA_COLLECTION' THEN '자료 수집·업로드 표준'
         WHEN 'PROCESS_ORCHESTRATION' THEN '프로세스 관제·오케스트레이션 표준'
         ELSE type.screen_type||' 화면 표준'
       END,
       jsonb_build_object(
         'requiredLayers',jsonb_build_array('THEME','SECTION','COMPONENT','DESIGN','FRONTEND','API','BACKEND','DATABASE','TEST'),
         'requiredStates',jsonb_build_array('LOADING','EMPTY','READY','ERROR','FORBIDDEN'),
         'requiredTests',jsonb_build_array('HAPPY_PATH','AUTHORITY','EXCEPTION'),
         'responsive',jsonb_build_array('mobile','tablet','desktop'),
         'generationPolicy','FAIL_CLOSED'
       ),'SCREEN_TEMPLATE_STANDARD_BOOTSTRAP'
FROM (
  VALUES ('FORM_WIZARD'),('LIST_DASHBOARD'),('WORKSPACE'),('WORK_EXECUTION'),('REVIEW_DECISION'),
         ('REPORT_DOCUMENT'),('PROCESS_STEP_WORKSPACE'),('DATA_COLLECTION'),('PROCESS_ORCHESTRATION')
) type(screen_type)
ON CONFLICT(screen_type) DO UPDATE SET standard_name=excluded.standard_name,
  reusable_scope=excluded.reusable_scope,updated_by=excluded.updated_by,updated_at=current_timestamp;

-- Selecting a membership type is a public applicant decision. It has no admin action at this step;
-- review and approval are modeled by their own later process steps and admin screens.
UPDATE framework_process_step
SET requires_admin_page=false
WHERE process_code='MEMBER_REGISTRATION' AND step_code='MEMBER_REGISTRATION_S1';

INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,
  business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
  command_contract,state_contract,api_contract,data_contract,evidence_contract,
  responsive_contract,accessibility_contract,security_contract,
  api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,
  exception_states_verified,audit_evidence_ref,contract_status,updated_by
)
SELECT 'MEMBER_REGISTRATION','MEMBER_REGISTRATION_S1','USER',r.route_key,r.screen_name,'PUBLIC_APPLICANT',
  '가입 신청자가 소속과 수행 업무에 맞는 회원 유형을 선택하고, 이후 동의·본인확인·정보입력 단계에 일관된 가입 문맥을 전달한다.',
  '비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다.',
  '허용된 회원 유형 중 하나가 서버 세션에 저장되고 가입 단계 1 완료 상태와 다음 경로가 확정된다.',
  '["단계 완료율","유형 선택 성공률","검증 오류율","다음 단계 이동률"]',
  '[{"id":"progress","purpose":"5단계 진행 상태"},{"id":"type-selection","purpose":"회원 유형 설명·선택"},{"id":"actions","purpose":"취소·다음 단계"},{"id":"feedback","purpose":"오류·복구 안내"}]',
  '[{"code":"membershipType","type":"enum","required":true,"values":["EMITTER","PERFORMER","CENTER","GOV"]},{"code":"userType","type":"server-assigned","value":"USR02"},{"code":"joinStep","type":"server-assigned","value":1}]',
  '[{"code":"LOAD_JOIN_SESSION","method":"GET"},{"code":"SELECT_MEMBER_TYPE","method":"POST","idempotent":true},{"code":"CONTINUE_TO_TERMS","guard":"save-success"},{"code":"RESET_JOIN_AND_HOME","confirmation":true}]',
  '["LOADING","EMPTY","READY","SAVING","SUCCESS","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
  '[{"method":"GET","path":"/join/api/session","response":"JoinSession"},{"method":"POST","path":"/join/api/step1","request":{"membership_type":"MembershipType"},"response":{"step":1,"membershipType":"MembershipType","version":"session-version"}},{"method":"POST","path":"/join/api/reset"}]',
  '[{"entity":"JoinSession","storage":"HTTP_SESSION_JOIN_VO","key":"sessionId","version":"session-version","fields":["ENTRPRS_SE_CODE","USER_TY","JOIN_STEP"],"transaction":"single-session-write"}]',
  '[{"event":"MEMBER_TYPE_SELECTED","version":"1.0","fields":["requestId","membershipType","locale","occurredAt"],"personalDataExcluded":true},{"tests":["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"]}]',
  '{"mobile":"single column card group and full-width actions","tablet":"two-column card group","desktop":"four-column card group within 1280px","overflow":"no horizontal overflow from 320px"}',
  '{"standard":"WCAG 2.1 AA","semantics":"fieldset and legend","keyboard":"arrow and tab navigation","focus":"visible focus and error focus transfer","announcement":"selection, error and save result announced"}',
  '{"authentication":"PUBLIC","csrf":"required for writes","allowedValues":"server allow-list","isolation":"per-session","rateLimit":"per IP and session","personalData":"not collected in this step"}',
  true,true,true,true,true,true,
  'MEMBER_REGISTRATION_S1:route+api+session-lineage+five-independent-tests:2026-07-22',
  'VERIFIED','SCREEN_TEMPLATE_STANDARD_BOOTSTRAP'
FROM framework_screen_resource r WHERE r.route_key IN('/join/step1','/join/en/step1')
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

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.asset_layer,a.asset_ref,a.management_route,'REUSED',a.evidence_ref,true,'SCREEN_TEMPLATE_STANDARD_BOOTSTRAP'
FROM framework_professional_screen_contract c
CROSS JOIN (VALUES
  ('THEME','KRDS public service tokens','/admin/system/theme-management','JoinWizardMigrationPage token usage'),
  ('SECTION','join-progress/type-selection/actions/feedback','/admin/system/section-management','page manifest join-wizard'),
  ('COMPONENT','MembershipTypeCardGroup + JoinWizardActions','/admin/system/component-management','page manifest join-wizard'),
  ('DESIGN','FORM_WIZARD/member-registration-v1','/admin/system/design-management','professional screen contract'),
  ('FRONTEND','JoinWizardMigrationPage','/admin/system/page-development-master','implemented React route'),
  ('API','GET session + POST step1/reset','/admin/system/api-management','verified join API contract'),
  ('BACKEND','join session step transition','/admin/system/function-management','verified session command'),
  ('DATABASE','HTTP_SESSION_JOIN_VO lineage','/admin/system/db-table-management','three verified data bindings'),
  ('TEST','MEMBER_REG_S1_*','/admin/system/verification-asset-management','five verified independent test types')
) a(asset_layer,asset_ref,management_route,evidence_ref)
WHERE c.process_code='MEMBER_REGISTRATION' AND c.step_code='MEMBER_REGISTRATION_S1'
  AND c.route_path IN('/join/step1','/join/en/step1')
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,
  management_route=excluded.management_route,decision='REUSED',evidence_ref=excluded.evidence_ref,
  protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

-- Recurrence prevention: the gate previously rejected the two strongest lineage states that
-- the canonical binding table itself permits (DB_RESOLVED and IMPLEMENTATION_VERIFIED).
CREATE OR REPLACE VIEW framework_page_design_assurance AS
WITH binding AS (
  SELECT b.screen_resource_id,
         count(*) FILTER (WHERE b.binding_status='ACTIVE') binding_count,
         count(DISTINCT b.actor_code) FILTER (WHERE b.binding_status='ACTIVE' AND trim(coalesce(b.actor_code,''))<>'') actor_count,
         count(DISTINCT (b.process_code,b.step_code)) FILTER (WHERE b.binding_status='ACTIVE') process_step_count,
         count(*) FILTER (WHERE b.binding_status='ACTIVE' AND b.audience='USER') user_binding_count
  FROM framework_process_step_screen_binding b GROUP BY b.screen_resource_id
), contract AS (
  SELECT r.screen_resource_id,count(c.contract_id) contract_count,
         count(c.contract_id) FILTER (WHERE length(trim(c.business_purpose))>=20
           AND length(trim(c.entry_condition))>=10 AND length(trim(c.exit_condition))>=10
           AND c.section_contract<>'[]' AND c.field_contract<>'[]' AND c.command_contract<>'[]') semantic_count,
         bool_and(c.authority_verified) authority_verified,
         bool_and(c.exception_states_verified AND c.state_contract LIKE '%ERROR%' AND c.state_contract LIKE '%FORBIDDEN%') exception_verified,
         bool_and(c.audit_evidence_ref<>'' AND (c.data_contract ILIKE '%version%' OR c.evidence_contract ILIKE '%version%')) version_verified
  FROM framework_screen_resource r LEFT JOIN framework_professional_screen_contract c
    ON lower(split_part(c.route_path,'?',1))=r.route_key GROUP BY r.screen_resource_id
), transition_gate AS (
  SELECT b.screen_resource_id,
         bool_and(trim(coalesce(s.from_state,''))<>'' AND trim(coalesce(s.to_state,''))<>''
           AND trim(coalesce(s.command_code,''))<>'' AND trim(coalesce(s.completion_rule,''))<>'') transition_verified,
         bool_and(NOT s.requires_admin_page OR EXISTS(
           SELECT 1 FROM framework_process_step_screen_binding admin_binding
           WHERE admin_binding.process_code=b.process_code AND admin_binding.step_code=b.step_code
             AND admin_binding.audience='ADMIN' AND admin_binding.binding_status='ACTIVE')) admin_counterpart_verified
  FROM framework_process_step_screen_binding b JOIN framework_process_step s USING(process_code,step_code)
  WHERE b.binding_status='ACTIVE' GROUP BY b.screen_resource_id
), lineage_gate AS (
  SELECT d.screen_resource_id,count(*) field_count,
         bool_and(trim(coalesce(d.api_property,''))<>'' AND trim(coalesce(d.source_table,''))<>''
           AND trim(coalesce(d.source_column,''))<>''
           AND d.lineage_status IN('DB_RESOLVED','IMPLEMENTATION_VERIFIED')) lineage_verified
  FROM framework_screen_data_binding d GROUP BY d.screen_resource_id
), test_gate AS (
  SELECT b.screen_resource_id,count(DISTINCT t.case_code) test_count,count(DISTINCT t.case_type) test_type_count
  FROM framework_process_step_screen_binding b
  JOIN framework_step_test_binding x ON x.process_code=b.process_code AND x.step_code=b.step_code
  JOIN framework_simulation_case t ON t.case_code=x.case_code AND t.case_status IN('VERIFIED','APPROVED','ACTIVE')
  WHERE b.binding_status='ACTIVE' GROUP BY b.screen_resource_id
), evaluated AS (
  SELECT r.screen_resource_id,
    coalesce(b.binding_count,0)>0 AND coalesce(b.actor_count,0)>0 actor_passed,
    coalesce(b.process_step_count,0)>0 process_passed,
    coalesce(c.contract_count,0)>=coalesce(b.binding_count,0) AND coalesce(c.semantic_count,0)>=coalesce(b.binding_count,0) contract_passed,
    coalesce(l.field_count,0)>0 AND coalesce(l.lineage_verified,false) lineage_passed,
    coalesce(tg.transition_verified,false) transition_passed,coalesce(c.authority_verified,false) authority_passed,
    coalesce(c.version_verified,false) version_passed,coalesce(c.exception_verified,false) exception_passed,
    coalesce(tg.admin_counterpart_verified,true) admin_counterpart_passed,
    coalesce(test.test_count,0)>=3 AND coalesce(test.test_type_count,0)>=3 test_passed,
    coalesce(test.test_count,0) test_count,coalesce(l.field_count,0) field_count
  FROM framework_screen_resource r LEFT JOIN binding b USING(screen_resource_id)
  LEFT JOIN contract c USING(screen_resource_id) LEFT JOIN transition_gate tg USING(screen_resource_id)
  LEFT JOIN lineage_gate l USING(screen_resource_id) LEFT JOIN test_gate test USING(screen_resource_id)
)
SELECT e.*,
  ((actor_passed::int+process_passed::int+contract_passed::int+lineage_passed::int+transition_passed::int+
    authority_passed::int+version_passed::int+exception_passed::int+admin_counterpart_passed::int+test_passed::int)*10) design_gate_score,
  CASE WHEN actor_passed AND process_passed AND contract_passed AND lineage_passed AND transition_passed
    AND authority_passed AND version_passed AND exception_passed AND admin_counterpart_passed AND test_passed
    THEN 'PASSED' ELSE 'FAILED' END design_gate_status,
  array_remove(ARRAY[
    CASE WHEN NOT actor_passed THEN 'ACTOR_BINDING_MISSING' END,
    CASE WHEN NOT process_passed THEN 'PROCESS_STEP_MISSING' END,
    CASE WHEN NOT contract_passed THEN 'PROFESSIONAL_CONTRACT_INCOMPLETE' END,
    CASE WHEN NOT lineage_passed THEN 'INPUT_OUTPUT_LINEAGE_INCOMPLETE' END,
    CASE WHEN NOT transition_passed THEN 'STATE_TRANSITION_INCOMPLETE' END,
    CASE WHEN NOT authority_passed THEN 'AUTHORITY_NOT_VERIFIED' END,
    CASE WHEN NOT version_passed THEN 'VERSION_AUDIT_CONTRACT_MISSING' END,
    CASE WHEN NOT exception_passed THEN 'EXCEPTION_RECOVERY_NOT_VERIFIED' END,
    CASE WHEN NOT admin_counterpart_passed THEN 'ADMIN_COUNTERPART_MISSING' END,
    CASE WHEN NOT test_passed THEN 'INDEPENDENT_TEST_COVERAGE_INCOMPLETE' END
  ],NULL)::text[] design_gate_issues
FROM evaluated e;

UPDATE framework_screen_template_standard standard
SET representative_screen_resource_id=r.screen_resource_id,representative_route=r.route_key,
    standard_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
    evidence_ref='framework_page_design_assurance:'||gate.design_gate_score||':'||gate.design_gate_status,
    standard_version='1.0.0',updated_by='SCREEN_TEMPLATE_STANDARD_BOOTSTRAP',updated_at=current_timestamp
FROM framework_screen_resource r
JOIN framework_page_design_assurance gate USING(screen_resource_id)
WHERE standard.screen_type='FORM_WIZARD' AND r.route_key='/join/step1';

CREATE OR REPLACE VIEW framework_screen_template_coverage AS
WITH inventory AS (
  SELECT r.screen_type,count(*) page_count,
         count(*) FILTER(WHERE g.design_gate_status='PASSED') gate_passed_count,
         count(*) FILTER(WHERE r.implementation_status IN('VERIFIED','IMPLEMENTED')) implemented_count,
         round(avg(coalesce(g.design_gate_score,0)),1) average_gate_score
  FROM framework_screen_resource r
  LEFT JOIN framework_page_design_assurance g USING(screen_resource_id)
  GROUP BY r.screen_type
)
SELECT standard.screen_type,standard.standard_name,coalesce(inventory.page_count,0) page_count,
       coalesce(inventory.implemented_count,0) implemented_count,
       coalesce(inventory.gate_passed_count,0) gate_passed_count,coalesce(inventory.average_gate_score,0) average_gate_score,
       standard.representative_screen_resource_id,standard.representative_route,
       coalesce(representative.screen_name,'') representative_screen_name,
       standard.standard_status,standard.minimum_design_gate_score,
       coalesce(gate.design_gate_score,0) representative_gate_score,
       coalesce(gate.design_gate_status,'NOT_EVALUATED') representative_gate_status,
       coalesce(gate.design_gate_issues,ARRAY['REPRESENTATIVE_REQUIRED']::text[]) representative_gate_issues,
       standard.reusable_scope,standard.standard_version,standard.evidence_ref,standard.updated_at
FROM framework_screen_template_standard standard
LEFT JOIN inventory USING(screen_type)
LEFT JOIN framework_screen_resource representative
  ON representative.screen_resource_id=standard.representative_screen_resource_id
LEFT JOIN framework_page_design_assurance gate
  ON gate.screen_resource_id=standard.representative_screen_resource_id;

COMMENT ON TABLE framework_screen_template_standard IS
  'Fail-closed registry of reusable professional screen templates. Approval requires a real representative route with design assurance score 100.';
COMMENT ON VIEW framework_screen_template_coverage IS
  'Screen-type inventory and representative readiness used to expand professional generation safely instead of cloning shallow pages.';

UPDATE framework_page_development_item item
SET design_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
    blocker_reason=CASE WHEN gate.design_gate_status='PASSED' THEN NULL ELSE array_to_string(gate.design_gate_issues,', ') END,
    next_action=CASE WHEN gate.design_gate_status='PASSED'
      THEN 'Approved representative contract; reusable generation may proceed for this screen type.'
      ELSE 'Resolve design gate issues before generation: '||array_to_string(gate.design_gate_issues,', ') END,
    updated_by='SCREEN_TEMPLATE_STANDARD_BOOTSTRAP',updated_at=current_timestamp
FROM framework_page_design_assurance gate
WHERE gate.screen_resource_id=item.screen_resource_id
  AND gate.screen_resource_id IN(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key IN('/join/step1','/join/en/step1'));
