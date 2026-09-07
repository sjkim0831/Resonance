-- Restore the company approval step that was incorrectly collapsed into /mypage/staff.
ALTER TABLE framework_process_step
  DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_step
SET step_name = '기업 심사·승인',
    actor_code = 'APPROVER',
    from_state = 'APPLIED',
    command_code = 'APPROVE_COMPANY',
    to_state = 'APPROVED',
    completion_rule = '독립 승인자가 기업 정보, 사업자등록 증빙과 대표권을 확인하고 승인 또는 사유 있는 반려를 저장한다.',
    requirement_text = '기업 가입 신청의 정보와 제출 증빙을 검토하여 승인·보완·반려 결과를 기록한다.',
    user_path = '/join/companyJoinStatusDetail',
    admin_path = '/admin/member/company-approve',
    api_contract = 'POST /api/admin/member/company-approve/action'
WHERE process_code = 'COMPANY_ONBOARDING'
  AND step_code = 'COMPANY_ONBOARDING_APPROVE';

ALTER TABLE framework_process_step
  ENABLE TRIGGER trg_guard_locked_process_step;
