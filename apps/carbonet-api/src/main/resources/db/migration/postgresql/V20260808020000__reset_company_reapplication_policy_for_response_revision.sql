-- A new applicant-response field changes the executable public contract.
-- Reopen only the machine-promoted policy; never overwrite a human review.
UPDATE framework_screen_workflow_policy policy
SET classification = 'REVIEW_REQUIRED',
    reason_code = 'MISSING_WORKFLOW_EVIDENCE',
    reason_text = '보완·재신청 답변 필드를 포함한 최신 화면 계약의 BUSINESS_E2E 증거가 필요합니다.',
    source = 'COMPANY_REAPPLICATION_PUBLIC_1_1_0',
    review_status = 'PENDING',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = current_timestamp
WHERE policy.route_key = '/join/companyreapply'
  AND policy.source = 'CONTRACT_E2E_PROMOTER'
  AND policy.review_status = 'AUTO_APPROVED'
  AND policy.reviewed_by IS NULL
  AND policy.reviewed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM framework_professional_screen_contract contract
    JOIN framework_process_step_screen_binding binding
      ON binding.process_code = contract.process_code
     AND binding.step_code = contract.step_code
     AND binding.audience = contract.audience
    JOIN framework_screen_resource resource
      ON resource.screen_resource_id = binding.screen_resource_id
    WHERE contract.process_code = 'COMPANY_REAPPLICATION_PUBLIC'
      AND contract.step_code = 'COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
      AND contract.audience = 'PUBLIC'
      AND contract.contract_status = 'REVIEW_REQUIRED'
      AND contract.design_version = '1.1.0'
      AND binding.actor_code = 'PUBLIC_APPLICANT'
      AND binding.binding_status = 'DRAFT'
      AND binding.design_version = '1.1.0'
      AND resource.route_key = policy.route_key
  );

DO $$
DECLARE v_policy integer;
DECLARE v_binding integer;
DECLARE v_contract integer;
BEGIN
  SELECT count(*) INTO v_policy
  FROM framework_screen_workflow_policy
  WHERE route_key='/join/companyreapply'
    AND classification='REVIEW_REQUIRED'
    AND reason_code='MISSING_WORKFLOW_EVIDENCE'
    AND review_status='PENDING';

  SELECT count(*) INTO v_binding
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource resource USING(screen_resource_id)
  WHERE resource.route_key='/join/companyreapply'
    AND binding.process_code='COMPANY_REAPPLICATION_PUBLIC'
    AND binding.step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
    AND binding.actor_code='PUBLIC_APPLICANT'
    AND binding.audience='PUBLIC'
    AND binding.binding_status='DRAFT'
    AND binding.design_version='1.1.0';

  SELECT count(*) INTO v_contract
  FROM framework_professional_screen_contract
  WHERE lower(split_part(route_path,'?',1))='/join/companyreapply'
    AND process_code='COMPANY_REAPPLICATION_PUBLIC'
    AND step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
    AND audience='PUBLIC'
    AND contract_status='REVIEW_REQUIRED'
    AND design_version='1.1.0';

  IF v_policy<>1 OR v_binding<>1 OR v_contract<>1 THEN
    RAISE EXCEPTION 'COMPANY_REAPPLICATION_RESPONSE_POLICY_RESET_INVALID policy=% binding=% contract=%',
      v_policy,v_binding,v_contract;
  END IF;
END;
$$;
