-- Bind every generated MEMBER process step to an existing professional screen.
-- Reusing a route is intentional: processCode/stepCode/actorCode/guide query context
-- tells the shared screen which workflow responsibility is being performed.
WITH route_map(process_code,step_order,user_path,admin_path) AS (VALUES
 ('TERMS_CONSENT',1,'/join/step1','/admin/system/consent-history'),
 ('TERMS_CONSENT',2,'/join/step2','/admin/system/consent-history'),
 ('TERMS_CONSENT',3,'/join/step2','/admin/system/consent-history'),
 ('TERMS_CONSENT',4,'/join/step3','/admin/system/consent-history'),
 ('MEMBER_REGISTRATION',1,'/join/step1','/admin/member/list'),
 ('MEMBER_REGISTRATION',2,'/join/step3','/admin/member/list'),
 ('MEMBER_REGISTRATION',3,'/join/step4','/admin/member/approve'),
 ('MEMBER_REGISTRATION',4,'/join/step5','/admin/member/approve'),
 ('IDENTITY_VERIFICATION',1,'/signin/authChoice','/admin/member/list'),
 ('IDENTITY_VERIFICATION',2,'/join/step4','/admin/member/list'),
 ('IDENTITY_VERIFICATION',3,'/signin/findId','/admin/member/approve'),
 ('IDENTITY_VERIFICATION',4,'/signin/loginView','/admin/member/approve'),
 ('MEMBER_APPROVAL',1,'/join/companyJoinStatusSearch','/admin/member/approve'),
 ('MEMBER_APPROVAL',2,'/join/companyJoinStatusDetail','/admin/member/approve'),
 ('MEMBER_APPROVAL',3,'/join/companyJoinStatusDetail','/admin/member/approve'),
 ('MEMBER_APPROVAL',4,'/signin/loginView','/admin/member/list'),
 ('LOGIN_AUTHENTICATION',1,'/signin/loginView','/admin/member/login_history'),
 ('LOGIN_AUTHENTICATION',2,'/signin/authChoice','/admin/member/login_history'),
 ('LOGIN_AUTHENTICATION',3,'/mypage/password','/admin/member/login_history'),
 ('LOGIN_AUTHENTICATION',4,'/mypage/index','/admin/member/login_history'),
 ('MFA_MANAGEMENT',1,'/mypage/password','/admin/member/reset_password'),
 ('MFA_MANAGEMENT',2,'/mypage/password','/admin/member/reset_password'),
 ('MFA_MANAGEMENT',3,'/mypage/password','/admin/member/login_history'),
 ('MFA_MANAGEMENT',4,'/mypage/password','/admin/member/login_history'),
 ('PASSWORD_RECOVERY',1,'/signin/findPassword','/admin/member/reset_password'),
 ('PASSWORD_RECOVERY',2,'/signin/findPassword','/admin/member/reset_password'),
 ('PASSWORD_RECOVERY',3,'/signin/findPassword/result','/admin/member/login_history'),
 ('PASSWORD_RECOVERY',4,'/signin/loginView','/admin/member/login_history'),
 ('ACCOUNT_LOCK_RECOVERY',1,'/signin/loginForbidden','/admin/member/activate'),
 ('ACCOUNT_LOCK_RECOVERY',2,'/signin/findPassword','/admin/member/activate'),
 ('ACCOUNT_LOCK_RECOVERY',3,'/signin/findPassword/result','/admin/member/activate'),
 ('ACCOUNT_LOCK_RECOVERY',4,'/signin/loginView','/admin/member/login_history'),
 ('PROFILE_MANAGEMENT',1,'/mypage/profile','/admin/member/list'),
 ('PROFILE_MANAGEMENT',2,'/mypage/notification','/admin/member/list'),
 ('PROFILE_MANAGEMENT',3,'/mypage/marketing','/admin/member/login_history'),
 ('PROFILE_MANAGEMENT',4,'/mypage/password','/admin/member/login_history'),
 ('ACCOUNT_WITHDRAWAL',1,'/mypage/profile','/admin/member/list'),
 ('ACCOUNT_WITHDRAWAL',2,'/mypage/profile','/admin/member/withdrawn'),
 ('ACCOUNT_WITHDRAWAL',3,'/mypage/profile','/admin/member/withdrawn'),
 ('ACCOUNT_WITHDRAWAL',4,'/signin/loginView','/admin/member/withdrawn'),
 ('MEMBER_ADMINISTRATION',1,'/mypage/profile','/admin/member/list'),
 ('MEMBER_ADMINISTRATION',2,'/mypage/profile','/admin/member/approve'),
 ('MEMBER_ADMINISTRATION',3,'/mypage/profile','/admin/member/activate'),
 ('MEMBER_ADMINISTRATION',4,'/mypage/profile','/admin/member/login_history'),
 ('COMPANY_REGISTRATION_APPROVAL',1,'/join/companyRegister','/admin/member/company_list'),
 ('COMPANY_REGISTRATION_APPROVAL',2,'/join/companyRegisterComplete','/admin/member/company-approve'),
 ('COMPANY_REGISTRATION_APPROVAL',3,'/join/companyJoinStatusDetail','/admin/member/company-approve'),
 ('COMPANY_REGISTRATION_APPROVAL',4,'/mypage/company','/admin/member/company_list'),
 ('ORGANIZATION_DEPARTMENT',1,'/mypage/company','/admin/member/dept-role-mapping'),
 ('ORGANIZATION_DEPARTMENT',2,'/mypage/staff','/admin/member/dept-role-mapping'),
 ('ORGANIZATION_DEPARTMENT',3,'/mypage/staff','/admin/member/dept-role-mapping'),
 ('ORGANIZATION_DEPARTMENT',4,'/mypage/company','/admin/member/dept-role-mapping'),
 ('BUSINESS_SITE_ADMINISTRATION',1,'/mypage/company','/admin/emission/site-management'),
 ('BUSINESS_SITE_ADMINISTRATION',2,'/mypage/company','/admin/emission/site-management'),
 ('BUSINESS_SITE_ADMINISTRATION',3,'/emission/project_list','/admin/emission/site-management'),
 ('BUSINESS_SITE_ADMINISTRATION',4,'/mypage/company','/admin/emission/site-management')
)
UPDATE framework_process_step step
SET user_path=coalesce(nullif(step.user_path,''),route_map.user_path),
    admin_path=coalesce(nullif(step.admin_path,''),route_map.admin_path)
FROM route_map
WHERE step.process_code=route_map.process_code
  AND step.step_order=route_map.step_order
  AND EXISTS (SELECT 1 FROM framework_process_definition process WHERE process.process_code=step.process_code AND NOT process.definition_locked);

-- The guide must never advertise a required interactive page without a route.
DO $$
DECLARE missing_count integer;
BEGIN
 SELECT count(*) INTO missing_count
 FROM framework_process_step step
 JOIN framework_process_definition process ON process.process_code=step.process_code
 WHERE upper(process.domain_code)='MEMBER'
   AND ((step.requires_user_page AND coalesce(nullif(step.user_path,''),(
          SELECT binding.menu_url FROM framework_process_menu_binding binding
          WHERE binding.process_code=step.process_code AND binding.audience='USER' AND binding.binding_status='ACTIVE'
          ORDER BY (binding.step_code=step.step_code) DESC,binding.menu_code LIMIT 1
        )) IS NULL)
     OR (step.requires_admin_page AND coalesce(nullif(step.admin_path,''),(
          SELECT binding.menu_url FROM framework_process_menu_binding binding
          WHERE binding.process_code=step.process_code AND binding.audience='ADMIN' AND binding.binding_status='ACTIVE'
          ORDER BY (binding.step_code=step.step_code) DESC,binding.menu_code LIMIT 1
        )) IS NULL));
 IF missing_count<>0 THEN
   RAISE EXCEPTION 'MEMBER_PROCESS_GUIDE_ROUTE_GAP:%',missing_count;
 END IF;
END $$;
