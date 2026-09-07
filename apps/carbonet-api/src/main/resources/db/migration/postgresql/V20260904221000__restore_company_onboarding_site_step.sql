-- Restore only COMPANY_ONBOARDING step 3 to the original site-registration design.
DO $$
BEGIN
  ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

  UPDATE framework_process_step
     SET step_order = 3,
         step_name = '조직·사업장 등록',
         actor_code = 'COMPANY_MANAGER',
         from_state = 'APPROVED',
         command_code = 'REGISTER_SITE',
         to_state = 'SITE_READY',
         completion_rule = '활성 사업장 1건 이상 등록',
         requirement_text = '조직과 사업장 운영경계 등록',
         user_path = '/mypage/company',
         admin_path = '/admin/emission/site-management',
         api_contract = 'GET|POST /api/admin/emission/sites'
   WHERE process_code = 'COMPANY_ONBOARDING'
     AND step_code = 'COMPANY_ONBOARDING_SITE';

  ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;
END $$;
