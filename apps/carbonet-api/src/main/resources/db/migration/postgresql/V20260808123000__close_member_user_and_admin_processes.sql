WITH design(process_code,step_code,step_order,step_name,actor_code,user_path,api_contract,requirement_text,completion_rule) AS (VALUES
 ('MEMBER_APPROVAL','MEMBER_APPROVAL_S1',1,'가입 신청 대기열·상태 확인','MEMBER_ADMIN','/admin/member/approve','GET /admin/api/admin/member/approve/page','신청 유형·접수일·신청자·현재 상태를 검색하고 검토 대상을 선택한다.','검토할 신청 건과 담당자가 확정되고 상세 검토 이력이 시작되어야 한다.'),
 ('MEMBER_APPROVAL','MEMBER_APPROVAL_S2',2,'신청 정보·동의·증빙 검토','MEMBER_ADMIN','/admin/member/approve','GET /admin/api/admin/member/approve/page','회원 정보, 소속, 필수 동의, 본인확인 결과와 제출 증빙을 원본 데이터와 대조한다.','필수 항목·동의·본인확인·증빙 검사 결과가 모두 저장되어야 한다.'),
 ('MEMBER_APPROVAL','MEMBER_APPROVAL_S3',3,'보완 요청·반려 사유 확정','VERIFIER','/admin/member/approve','POST /admin/api/admin/member/approve/action','누락·불일치·정책 위반을 분류하고 신청자에게 전달할 보완 또는 반려 사유를 확정한다.','처리 사유, 근거, 담당자와 통지 결과가 감사 이력에 저장되어야 한다.'),
 ('MEMBER_APPROVAL','MEMBER_APPROVAL_S4',4,'승인·계정 활성화·신청자 통지','APPROVER','/admin/member/approve','POST /admin/api/admin/member/approve/action','검토가 완료된 신청을 승인하고 회원 계정과 권한을 활성화한 뒤 결과를 통지한다.','승인 상태·계정 활성화·권한·통지·처리 이력이 모두 일치해야 한다.'),
 ('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S1',1,'회원 검색·상태·소속 조회','MEMBER_ADMIN','/admin/member/list','GET /admin/api/admin/member/list/page','회원 유형·상태·소속·가입 기간으로 회원을 검색하고 관리 대상을 선택한다.','선택 회원의 식별자·소속·상태와 관리 범위가 확정되어야 한다.'),
 ('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S2',2,'회원 상세·가입 결과·활동 이력 확인','MEMBER_ADMIN','/admin/member/list','GET /admin/api/admin/member/detail/page','홈페이지 가입 결과, 승인 결과, 계정 상태, 소속과 주요 변경 이력을 통합 조회한다.','최초 가입 신청부터 현재 계정까지 데이터 계보와 이력 조회가 가능해야 한다.'),
 ('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S3',3,'회원 정보·상태·권한 변경','VERIFIER','/admin/member/list','GET/POST /admin/api/admin/member/edit','수정 권한과 변경 사유를 확인하고 회원 정보·상태·소속·권한 변경안을 검증한다.','변경 전후 값·사유·담당자·권한 검증 결과가 저장되어야 한다.'),
 ('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S4',4,'변경 확정·통지·감사 추적','APPROVER','/admin/member/list','POST /admin/api/admin/member/edit','검토된 변경을 확정하고 사용자 통지, 감사 이력과 후속 업무를 생성한다.','DB 재조회 값, 통지 결과, 감사 이력과 후속 업무 상태가 모두 일치해야 한다.')
)
UPDATE framework_process_step step SET step_order=design.step_order,step_name=design.step_name,actor_code=design.actor_code,
 user_path=design.user_path,admin_path=design.user_path,api_contract=design.api_contract,
 requirement_text=design.requirement_text,completion_rule=design.completion_rule
FROM design WHERE step.process_code=design.process_code AND step.step_code=design.step_code;

UPDATE framework_process_step_screen_binding SET entry_mode='SUPPORT'
 WHERE process_code IN('MEMBER_APPROVAL','MEMBER_ADMINISTRATION') AND binding_status='ACTIVE';

WITH target(process_code,step_code,route_path) AS (VALUES
 ('MEMBER_APPROVAL','MEMBER_APPROVAL_S1','/admin/member/approve'),('MEMBER_APPROVAL','MEMBER_APPROVAL_S2','/admin/member/approve'),
 ('MEMBER_APPROVAL','MEMBER_APPROVAL_S3','/admin/member/approve'),('MEMBER_APPROVAL','MEMBER_APPROVAL_S4','/admin/member/approve'),
 ('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S1','/admin/member/list'),('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S2','/admin/member/list'),
 ('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S3','/admin/member/list'),('MEMBER_ADMINISTRATION','MEMBER_ADMINISTRATION_S4','/admin/member/list')
)
INSERT INTO framework_process_step_screen_binding(process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,initial_view,
 context_contract,visibility_contract,completion_contract,guide_contract,binding_status)
SELECT target.process_code,target.step_code,resource.screen_resource_id,'ADMIN',step.actor_code,'PRIMARY','MEMBER_PROCESS_WORK',
 jsonb_build_object('processCode',target.process_code,'stepCode',target.step_code,'recordId','selected member or application'),
 jsonb_build_object('authentication',true,'actor',step.actor_code,'scope','authorized organization'),
 jsonb_build_object('completionRule',step.completion_rule,'databaseReread',true,'auditRequired',true),
 jsonb_build_object('purpose',step.requirement_text,'sequence',jsonb_build_array('대상 조회','세부 확인','처리 입력','검증','저장','DB 재조회','완료·인계')),
 'ACTIVE'
FROM target JOIN framework_process_step step USING(process_code,step_code)
JOIN LATERAL (SELECT candidate.screen_resource_id FROM framework_screen_resource candidate
 WHERE lower(candidate.route_key)=lower(target.route_path) ORDER BY candidate.screen_resource_id LIMIT 1) resource ON true
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET actor_code=excluded.actor_code,entry_mode='PRIMARY',
 initial_view=excluded.initial_view,context_contract=excluded.context_contract,visibility_contract=excluded.visibility_contract,
 completion_contract=excluded.completion_contract,guide_contract=excluded.guide_contract,binding_status='ACTIVE',updated_at=current_timestamp;

INSERT INTO framework_step_guidance_contract(process_code,step_code,applicability_type,applicability_rule,view_mode,completion_gate,
 required_sections,use_at)
SELECT step.process_code,step.step_code,'REQUIRED','ALWAYS',
 case step.process_code when 'MEMBER_REGISTRATION' then 'PUBLIC_REGISTRATION_STEP_'||step.step_order
      when 'MEMBER_APPROVAL' then 'ADMIN_MEMBER_APPROVAL_STEP_'||step.step_order
      else 'ADMIN_MEMBER_MANAGEMENT_STEP_'||step.step_order end,
 step.completion_rule,
 jsonb_build_array(jsonb_build_object('stepCode',step.step_code,'route',step.user_path,'purpose',step.requirement_text,
  'sections',jsonb_build_array('업무 목적','입력 데이터','처리 기능','완료 조건','테스트 데이터셋','실행 증거','다음 업무'))),'Y'
FROM framework_process_step step
WHERE step.process_code IN('MEMBER_REGISTRATION','MEMBER_APPROVAL','MEMBER_ADMINISTRATION')
ON CONFLICT(process_code,step_code) DO UPDATE SET applicability_type='REQUIRED',applicability_rule='ALWAYS',
 view_mode=excluded.view_mode,completion_gate=excluded.completion_gate,required_sections=excluded.required_sections,use_at='Y',updated_at=current_timestamp;

UPDATE framework_process_definition SET process_status='DEVELOPMENT_READY'
 WHERE process_code IN('MEMBER_APPROVAL','MEMBER_ADMINISTRATION') AND process_status='DRAFT';

DO $$
DECLARE user_steps integer;admin_steps integer;primary_bindings integer;guides integer;case_bindings integer;invalid_routes integer;
BEGIN
 SELECT count(*) INTO user_steps FROM framework_process_step WHERE process_code='MEMBER_REGISTRATION';
 SELECT count(*) INTO admin_steps FROM framework_process_step WHERE process_code IN('MEMBER_APPROVAL','MEMBER_ADMINISTRATION');
 SELECT count(*) INTO primary_bindings FROM framework_process_step_screen_binding
  WHERE process_code IN('MEMBER_APPROVAL','MEMBER_ADMINISTRATION') AND audience='ADMIN' AND entry_mode='PRIMARY' AND binding_status='ACTIVE';
 SELECT count(*) INTO guides FROM framework_step_guidance_contract
  WHERE process_code IN('MEMBER_REGISTRATION','MEMBER_APPROVAL','MEMBER_ADMINISTRATION') AND use_at='Y';
 SELECT count(*) INTO case_bindings FROM framework_step_test_binding
  WHERE process_code IN('MEMBER_REGISTRATION','MEMBER_APPROVAL','MEMBER_ADMINISTRATION');
 SELECT count(*) INTO invalid_routes FROM framework_process_step
  WHERE process_code IN('MEMBER_APPROVAL','MEMBER_ADMINISTRATION') AND user_path NOT LIKE '/admin/member/%';
 IF user_steps<>5 OR admin_steps<>8 OR primary_bindings<>8 OR guides<>13 OR case_bindings<>70 OR invalid_routes<>0 THEN
  RAISE EXCEPTION 'MEMBER_PROCESS_CLOSURE_INVALID user=% admin=% primary=% guides=% cases=% invalidRoutes=%',
   user_steps,admin_steps,primary_bindings,guides,case_bindings,invalid_routes;
 END IF;
END $$;
