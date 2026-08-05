UPDATE framework_step_execution_spec
SET generation_status='GENERATED',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
  AND design_status='DESIGN_COMPLETE'
  AND approval_status='APPROVED';

UPDATE framework_professional_screen_contract
SET api_verified=true,
    database_verified=true,
    authority_verified=true,
    exception_states_verified=true,
    audit_evidence_ref='verified:portfolio-preference-design-generator+flyway+authenticated-read-write-reread-conflict-restore',
    contract_status='VERIFIED',
    updated_by='PORTFOLIO_PREFERENCE_E2E',
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST';

DO $$
DECLARE verified_count integer;
BEGIN
  IF to_regclass('emission_project_portfolio_preference') IS NULL THEN
    RAISE EXCEPTION 'generated portfolio preference table is missing';
  END IF;
  SELECT count(*) INTO verified_count
  FROM framework_professional_screen_contract
  WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
    AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
    AND contract_status='VERIFIED'
    AND api_verified AND database_verified AND authority_verified AND exception_states_verified;
  IF verified_count<>2 THEN
    RAISE EXCEPTION 'portfolio preference contract verification failed count=%',verified_count;
  END IF;
END $$;
