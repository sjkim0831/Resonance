-- Page-field governance deliberately invalidates a generated execution spec
-- whenever a field changes.  V20260806213000 changed the report owner and all
-- dependent field permissions in one transaction; finalize the now-synchronized
-- contract only after those dependency updates have completed.

UPDATE framework_step_execution_spec
SET design_status='DESIGN_COMPLETE',
    approval_status='APPROVED',
    generation_status='READY',
    blocker_codes='[]'::jsonb,
    spec_version=spec_version+1,
    source_hash=encode(sha256(convert_to(concat_ws('|',actor_contract::text,business_contract::text,
      transition_contract::text,input_contract::text,output_contract::text,screen_contract::text,
      field_contract::text,command_contract::text,api_contract::text,persistence_contract::text,
      handoff_contract::text,test_contract::text,guide_contract::text,nonfunctional_contract::text),'UTF8')),'hex'),
    approved_by='PROFESSIONAL_REVIEW',
    approved_at=current_timestamp,
    updated_at=current_timestamp
WHERE process_code='REPORT_CERTIFICATION'
  AND step_code='REPORT_CERTIFICATION_02_WORK';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM framework_step_execution_spec
    WHERE process_code='REPORT_CERTIFICATION'
      AND step_code='REPORT_CERTIFICATION_02_WORK'
      AND actor_contract->>'actorCode'='CALCULATOR'
      AND guide_contract->>'actorCode'='CALCULATOR'
      AND generation_status='READY'
      AND blocker_codes='[]'::jsonb
  ) THEN
    RAISE EXCEPTION 'report certification professional execution spec was not finalized';
  END IF;
END $$;
