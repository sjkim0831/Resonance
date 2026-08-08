DO $$
BEGIN
  IF (SELECT count(*) FROM framework_process_step
      WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
        AND step_code IN ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_APPROVER_REVIEW')) <> 2 THEN
    RAISE EXCEPTION 'company reapplication relay step contract mismatch';
  END IF;
END $$;

-- The public status detail route is an observation screen, not the approver's
-- command surface. Keep the administrator action on its owned admin route and
-- align the second step start state with the first step's symbolic end state.
UPDATE framework_process_step
SET from_state='APPLIED',
    user_path=NULL,
    requires_user_page=false,
    requires_admin_page=true
WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
  AND step_code='COMPANY_REAPPLICATION_APPROVER_REVIEW';

UPDATE framework_step_execution_spec
SET transition_contract=jsonb_set(
      coalesce(transition_contract,'{}'::jsonb),
      '{fromState}',to_jsonb('APPLIED'::text),true
    ),
    screen_contract=(
      SELECT coalesce(jsonb_agg(screen), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(screen_contract,'[]'::jsonb)) screen
      WHERE coalesce(screen->>'routePath','')<>'/join/companyJoinStatusDetail'
    ),
    updated_at=current_timestamp
WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
  AND step_code='COMPANY_REAPPLICATION_APPROVER_REVIEW';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM framework_process_step
    WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
      AND step_code='COMPANY_REAPPLICATION_APPROVER_REVIEW'
      AND (from_state<>'APPLIED' OR user_path IS NOT NULL OR NOT requires_admin_page)
  ) THEN
    RAISE EXCEPTION 'company reapplication relay alignment failed';
  END IF;
END $$;
