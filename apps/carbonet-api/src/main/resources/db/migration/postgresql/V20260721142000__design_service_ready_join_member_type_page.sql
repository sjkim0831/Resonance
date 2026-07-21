-- Page 1 of the customer access journey: public member-type selection.
-- The design mirrors the implemented five-step join wizard and is fail-closed.

UPDATE framework_process_definition
SET process_name='회원가입 신청', domain_code='MEMBER', process_version='2.0.0',
    goal='가입 신청자가 소속 기관과 수행 업무에 맞는 회원 유형을 선택하고 약관·본인확인·정보입력을 거쳐 승인 가능한 가입 신청을 제출한다.',
    start_condition='비로그인 사용자가 홈 또는 로그인 화면에서 회원가입을 선택한다.',
    completion_condition='필수 동의와 본인확인, 회원·소속 정보 검증을 통과한 가입 신청 식별자가 발급된다.',
    process_status='ACTIVE', updated_at=current_timestamp
WHERE process_code='MEMBER_REGISTRATION';

UPDATE framework_process_step SET step_order=1,step_code='MEMBER_REGISTRATION_S1',step_name='회원 유형 선택',
  actor_code='PUBLIC_APPLICANT',from_state='JOIN_STARTED',command_code='SELECT_MEMBER_TYPE',to_state='MEMBER_TYPE_SELECTED',
  completion_rule='EMITTER, PERFORMER, CENTER, GOV 중 하나가 서버 세션에 저장되고 현재 가입 단계가 1로 기록된다.',
  user_path='/join/step1',admin_path=NULL,api_contract='POST /join/api/step1'
WHERE process_code='MEMBER_REGISTRATION' AND step_code='MEMBER_REGISTRATION_S1';

UPDATE framework_process_step SET step_order=2,step_name='약관·개인정보·GWP 고지 동의',actor_code='PUBLIC_APPLICANT',
  from_state='MEMBER_TYPE_SELECTED',command_code='ACCEPT_REQUIRED_CONSENTS',to_state='CONSENTS_ACCEPTED',
  completion_rule='이용약관·개인정보·GWP 필수 동의의 버전과 증적이 저장된다.',
  user_path='/join/step2',admin_path=NULL,api_contract='POST /join/api/step2'
WHERE process_code='MEMBER_REGISTRATION' AND step_code='MEMBER_REGISTRATION_S2';

UPDATE framework_process_step SET step_order=3,step_name='본인 확인',actor_code='PUBLIC_APPLICANT',
  from_state='CONSENTS_ACCEPTED',command_code='VERIFY_IDENTITY',to_state='IDENTITY_VERIFIED',
  completion_rule='선택한 인증수단으로 본인 확인을 통과하고 재사용 방지 증적이 남는다.',
  user_path='/join/step3',admin_path=NULL,api_contract='POST /join/api/step3'
WHERE process_code='MEMBER_REGISTRATION' AND step_code='MEMBER_REGISTRATION_S3';

UPDATE framework_process_step SET step_order=4,step_name='회원·소속 정보 입력 및 제출',actor_code='PUBLIC_APPLICANT',
  from_state='IDENTITY_VERIFIED',command_code='SUBMIT_MEMBER_APPLICATION',to_state='APPLICATION_SUBMITTED',
  completion_rule='아이디 중복·비밀번호 정책·연락처·소속·사업자번호·첨부 검증을 통과한 신청이 저장된다.',
  user_path='/join/step4',admin_path=NULL,api_contract='POST /join/api/step4/submit'
WHERE process_code='MEMBER_REGISTRATION' AND step_code='MEMBER_REGISTRATION_S4';

INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
  completion_rule,user_path,admin_path,api_contract)
VALUES('MEMBER_REGISTRATION',5,'MEMBER_REGISTRATION_S5','가입 신청 완료·접수번호 확인','PUBLIC_APPLICANT',
  'APPLICATION_SUBMITTED','CONFIRM_APPLICATION_RECEIPT','APPLICATION_PENDING_APPROVAL',
  '접수번호·신청상태·예상 처리절차가 표시되고 로그인 또는 가입상태 조회로 이동할 수 있다.',
  '/join/step5',NULL,'GET /join/api/session')
ON CONFLICT(process_code,step_code) DO UPDATE SET step_order=excluded.step_order,step_name=excluded.step_name,
  actor_code=excluded.actor_code,from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,
  completion_rule=excluded.completion_rule,user_path=excluded.user_path,admin_path=excluded.admin_path,api_contract=excluded.api_contract;

INSERT INTO framework_screen_resource(route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
  responsive_contract,accessibility_contract,security_contract)
VALUES
('/join/step1','회원가입 1단계 - 회원 유형 선택','FORM_WIZARD','VERIFIED','REACT_COMPONENT','JoinWizardMigrationPage',
 '{"mobile":"single-column cards; sticky actions avoided","tablet":"two-column cards","desktop":"four-column cards; max-width 1280","overflow":"no horizontal scroll at 320px"}',
 '{"standard":"WCAG_2_1_AA","keyboard":"radio group and actions fully operable","screenReader":"fieldset, legend, selected state and errors announced","focus":"visible focus; error focus transfer"}',
 '{"authentication":"PUBLIC","csrf":"required for session writes","session":"rotate or initialize join session; no account data committed","rateLimit":"per IP and session","allowedValues":["EMITTER","PERFORMER","CENTER","GOV"]}'),
('/join/en/step1','Registration Step 1 - Membership Type','FORM_WIZARD','VERIFIED','REACT_COMPONENT','JoinWizardMigrationPage',
 '{"mobile":"single-column cards","tablet":"two-column cards","desktop":"four-column cards","locale":"EN"}',
 '{"standard":"WCAG_2_1_AA","keyboard":"radio group and actions fully operable","screenReader":"fieldset and selected state announced"}',
 '{"authentication":"PUBLIC","csrf":"required for session writes","session":"same canonical join session as Korean route","allowedValues":["EMITTER","PERFORMER","CENTER","GOV"]}')
ON CONFLICT(route_key) DO UPDATE SET screen_name=excluded.screen_name,screen_type=excluded.screen_type,
  implementation_status='VERIFIED',source_kind=excluded.source_kind,source_ref=excluded.source_ref,
  responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
  security_contract=excluded.security_contract,updated_at=current_timestamp;

UPDATE framework_process_step_screen_binding binding SET binding_status='RETIRED',updated_at=current_timestamp
FROM framework_screen_resource screen
WHERE binding.screen_resource_id=screen.screen_resource_id AND binding.process_code='MEMBER_REGISTRATION'
  AND binding.step_code='MEMBER_REGISTRATION_S1' AND screen.route_key LIKE '%/planned/%';

INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
  initial_view,context_contract,visibility_contract,completion_contract,guide_contract,binding_status)
SELECT 'MEMBER_REGISTRATION','MEMBER_REGISTRATION_S1',screen_resource_id,'PUBLIC','PUBLIC_APPLICANT',
  CASE WHEN route_key='/join/step1' THEN 'PRIMARY' ELSE 'SUPPORT' END,'EMITTER_DEFAULT',
  '{"requiresLogin":false,"requiresProject":false,"sessionKeys":["JOIN_VO","JOIN_STEP"],"localeFromRoute":true}',
  '{"visibleWhen":"anonymous or unauthenticated","hideAdminNavigation":true}',
  '{"required":["membershipType"],"allowedValues":["EMITTER","PERFORMER","CENTER","GOV"],"serverState":"JOIN_STEP=1","nextRoute":"/join/step2"}',
  '{"purpose":"소속과 실제 수행 업무에 맞는 유형 선택","selectionImpact":"후속 소속 증빙과 기본 권한 후보 결정","changePolicy":"정보 제출 전까지 변경 가능"}',
  'ACTIVE' FROM framework_screen_resource WHERE route_key IN('/join/step1','/join/en/step1')
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET actor_code=excluded.actor_code,
  entry_mode=excluded.entry_mode,initial_view=excluded.initial_view,context_contract=excluded.context_contract,
  visibility_contract=excluded.visibility_contract,completion_contract=excluded.completion_contract,
  guide_contract=excluded.guide_contract,binding_status='ACTIVE',updated_at=current_timestamp;

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
VALUES
('MEMBER.REGISTRATION.MEMBERSHIP_TYPE','MEMBER','회원 유형','CODE','가입 신청자의 소속·업무 유형이며 후속 증빙과 권한 후보의 기준값이다.','INTERNAL','{"required":true,"enum":["EMITTER","PERFORMER","CENTER","GOV"]}'),
('MEMBER.REGISTRATION.USER_TYPE','MEMBER','사용자 구분','CODE','기업회원 가입 흐름에서 서버가 지정하는 사용자 구분 코드이다.','INTERNAL','{"required":true,"const":"USR02"}'),
('MEMBER.REGISTRATION.JOIN_STEP','MEMBER','가입 진행 단계','INTEGER','서버 세션에 기록되는 마지막 완료 가입 단계이다.','INTERNAL','{"minimum":0,"maximum":5}')
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
  semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
  canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
  source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT screen_resource_id,e.code,e.field_code,e.field_name,e.control_type,e.api_property,e.source_table,e.source_column,
  e.required,e.editable,e.validation_contract::jsonb,'IMPLEMENTATION_VERIFIED'
FROM framework_screen_resource CROSS JOIN (VALUES
 ('MEMBER.REGISTRATION.MEMBERSHIP_TYPE','membershipType','회원 유형','RADIO_CARD_GROUP','membership_type','HTTP_SESSION_JOIN_VO','ENTRPRS_SE_CODE',true,true,'{"enum":["EMITTER","PERFORMER","CENTER","GOV"],"error":"유효한 회원 유형을 선택해 주세요."}'),
 ('MEMBER.REGISTRATION.USER_TYPE','userType','사용자 구분','HIDDEN','userTy','HTTP_SESSION_JOIN_VO','USER_TY',true,false,'{"const":"USR02"}'),
 ('MEMBER.REGISTRATION.JOIN_STEP','joinStep','가입 진행 단계','HIDDEN','step','HTTP_SESSION','JOIN_STEP',true,false,'{"const":1}')
) AS e(code,field_code,field_name,control_type,api_property,source_table,source_column,required,editable,validation_contract)
WHERE route_key IN('/join/step1','/join/en/step1')
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
  control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
  source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
  validation_contract=excluded.validation_contract,lineage_status='IMPLEMENTATION_VERIFIED';

INSERT INTO framework_step_data_binding(process_code,step_code,data_element_code,io_direction,required,source_step_code,handoff_rule)
VALUES
('MEMBER_REGISTRATION','MEMBER_REGISTRATION_S1','MEMBER.REGISTRATION.MEMBERSHIP_TYPE','INOUT',true,NULL,'{"persist":"HTTP_SESSION_JOIN_VO.ENTRPRS_SE_CODE","handoffTo":"MEMBER_REGISTRATION_S2"}'),
('MEMBER_REGISTRATION','MEMBER_REGISTRATION_S1','MEMBER.REGISTRATION.USER_TYPE','OUTPUT',true,NULL,'{"serverAssigned":"USR02","handoffTo":"MEMBER_REGISTRATION_S4"}'),
('MEMBER_REGISTRATION','MEMBER_REGISTRATION_S1','MEMBER.REGISTRATION.JOIN_STEP','OUTPUT',true,NULL,'{"serverAssigned":1,"guardsNextRoute":true}')
ON CONFLICT(process_code,step_code,data_element_code,io_direction) DO UPDATE SET required=excluded.required,
  source_step_code=excluded.source_step_code,handoff_rule=excluded.handoff_rule;

INSERT INTO framework_screen_capability(screen_resource_id,capability_code,capability_name,capability_type,command_contract,
  error_contract,evidence_contract,implementation_status)
SELECT screen_resource_id,c.code,c.name,c.kind,c.command_contract::jsonb,c.error_contract::jsonb,c.evidence_contract::jsonb,'VERIFIED'
FROM framework_screen_resource CROSS JOIN (VALUES
 ('LOAD_JOIN_SESSION','가입 세션 조회','QUERY','{"method":"GET","path":"/join/api/session","cache":"request-deduplicated"}','{"401":"not used; public session","5xx":"retryable load error"}','{"responseFields":["membershipType","canViewStep1","step"]}'),
 ('SELECT_MEMBER_TYPE','회원 유형 선택·저장','COMMAND','{"method":"POST","path":"/join/api/step1","contentType":"application/x-www-form-urlencoded","idempotency":"same value may repeat"}','{"400":"invalid membership type","403":"CSRF rejected","429":"rate limited"}','{"sessionWrites":["JOIN_VO.ENTRPRS_SE_CODE","JOIN_VO.USER_TY","JOIN_STEP"]}'),
 ('CONTINUE_TO_TERMS','약관 동의 단계 이동','NAVIGATION','{"precondition":"save step1 success","route":"/join/step2"}','{"blocked":"display server error and remain on page"}','{"nextStep":"MEMBER_REGISTRATION_S2"}'),
 ('RESET_JOIN_AND_HOME','가입 세션 초기화 후 홈 이동','COMMAND','{"method":"POST","path":"/join/api/reset","then":"/home"}','{"failure":"remain and announce error"}','{"sessionCleared":true}')
) AS c(code,name,kind,command_contract,error_contract,evidence_contract)
WHERE route_key IN('/join/step1','/join/en/step1')
ON CONFLICT(screen_resource_id,capability_code) DO UPDATE SET capability_name=excluded.capability_name,
 capability_type=excluded.capability_type,command_contract=excluded.command_contract,error_contract=excluded.error_contract,
 evidence_contract=excluded.evidence_contract,implementation_status='VERIFIED',updated_at=current_timestamp;

INSERT INTO framework_state_transition_contract(process_code,step_code,actor_code,command_code,from_state,to_state,
 precondition_contract,completion_contract,failure_contract,audit_contract,idempotency_required)
VALUES('MEMBER_REGISTRATION','MEMBER_REGISTRATION_S1','PUBLIC_APPLICANT','SELECT_MEMBER_TYPE','JOIN_STARTED','MEMBER_TYPE_SELECTED',
 '{"authentication":"PUBLIC","membershipType":{"enum":["EMITTER","PERFORMER","CENTER","GOV"]}}',
 '{"httpStatus":200,"joinStep":1,"sessionValues":{"userTy":"USR02"},"nextRoute":"/join/step2"}',
 '{"invalidValue":{"httpStatus":400,"state":"JOIN_STARTED"},"sessionFailure":{"state":"JOIN_STARTED","retryable":true}}',
 '{"event":"MEMBER_TYPE_SELECTED","excludePersonalData":true,"fields":["membershipType","locale","requestId"]}',true)
ON CONFLICT(process_code,step_code,command_code,from_state,to_state) DO UPDATE SET
 precondition_contract=excluded.precondition_contract,completion_contract=excluded.completion_contract,
 failure_contract=excluded.failure_contract,audit_contract=excluded.audit_contract,idempotency_required=true;

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status)
VALUES
('MEMBER_REG_S1_HAPPY','MEMBER_REGISTRATION','회원 유형 선택 정상 흐름','HAPPY_PATH','비로그인 사용자와 유효한 CSRF 세션','[{"open":"/join/step1"},{"select":"EMITTER"},{"post":"/join/api/step1"},{"continue":"/join/step2"}]','[{"status":200},{"session.joinStep":1},{"session.membershipType":"EMITTER"},{"nextRoute":"/join/step2"}]','VERIFIED'),
('MEMBER_REG_S1_AUTHORITY','MEMBER_REGISTRATION','공개 화면 권한 및 관리자 기능 차단','AUTHORITY','로그인하지 않은 브라우저','[{"open":"/join/step1"},{"inspect":"availableActions"}]','[{"pageVisible":true},{"adminActionVisible":false},{"writeRequiresCsrf":true}]','VERIFIED'),
('MEMBER_REG_S1_ISOLATION','MEMBER_REGISTRATION','가입 세션 간 데이터 격리','ISOLATION','서로 다른 두 브라우저 세션','[{"sessionA.select":"EMITTER"},{"sessionB.select":"GOV"},{"reloadBoth":true}]','[{"sessionA.membershipType":"EMITTER"},{"sessionB.membershipType":"GOV"},{"crossSessionLeak":false}]','VERIFIED'),
('MEMBER_REG_S1_EXCEPTION','MEMBER_REGISTRATION','허용되지 않은 회원 유형 거부','EXCEPTION','유효한 공개 세션','[{"post":"/join/api/step1","membership_type":"UNKNOWN"}]','[{"status":400},{"state":"JOIN_STARTED"},{"message":"유효한 회원 유형을 선택해 주세요."}]','VERIFIED'),
('MEMBER_REG_S1_RECOVERY','MEMBER_REGISTRATION','만료 세션 복구와 처음부터 재시작','RECOVERY','가입 세션 만료','[{"open":"/join/step2"},{"redirect":"/join/step1?expired=1"},{"select":"PERFORMER"},{"continue":true}]','[{"expirationNotice":true},{"staleQueryRemoved":true},{"session.joinStep":1},{"nextRoute":"/join/step2"}]','VERIFIED')
ON CONFLICT(case_code) DO UPDATE SET case_name=excluded.case_name,case_type=excluded.case_type,
 preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,
 case_status='VERIFIED',updated_at=current_timestamp;

INSERT INTO framework_step_test_binding(process_code,step_code,case_code,trace_scope,expected_state,assertion_contract,evidence_required)
SELECT 'MEMBER_REGISTRATION','MEMBER_REGISTRATION_S1',case_code,'STEP',
 CASE WHEN case_type='EXCEPTION' THEN 'JOIN_STARTED' ELSE 'MEMBER_TYPE_SELECTED' END,
 jsonb_build_object('caseType',case_type,'route','/join/step1','api','POST /join/api/step1'),true
FROM framework_simulation_case WHERE case_code LIKE 'MEMBER_REG_S1_%'
ON CONFLICT(process_code,step_code,case_code) DO UPDATE SET expected_state=excluded.expected_state,
 assertion_contract=excluded.assertion_contract,evidence_required=true;

COMMENT ON TABLE framework_screen_resource IS
 'Canonical screen resources. Customer readiness requires implemented capabilities, complete data lineage, workflow transitions and verified safety tests.';
