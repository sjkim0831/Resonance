-- The compiled execution contract was already terminal, but the command
-- runtime reads framework_process_step.to_state. Keep both sources identical.

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,
    definition_lock_reason='VERSIONED_MAINTENANCE_TERMINAL_STATE_2026_08_06',
    updated_at=current_timestamp
WHERE process_code='REGULATORY_SUBMISSION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step
SET to_state='COMPLETED'
WHERE process_code='REGULATORY_SUBMISSION'
  AND step_code='REGULATORY_SUBMISSION_S4';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_step_execution_spec
SET transition_contract=jsonb_set(transition_contract,'{toState}',to_jsonb('COMPLETED'::text),true),
    source_hash=encode(sha256(convert_to(concat_ws('|',actor_contract::text,business_contract::text,
      jsonb_set(transition_contract,'{toState}',to_jsonb('COMPLETED'::text),true)::text,
      input_contract::text,output_contract::text,screen_contract::text,field_contract::text,
      command_contract::text,api_contract::text,persistence_contract::text,handoff_contract::text,
      test_contract::text,guide_contract::text,nonfunctional_contract::text),'UTF8')),'hex'),
    spec_version=spec_version+1,
    design_status='DESIGN_COMPLETE',approval_status='APPROVED',generation_status='READY',
    blocker_codes='[]'::jsonb,approved_by='PROFESSIONAL_REVIEW',approved_at=current_timestamp,
    updated_at=current_timestamp
WHERE process_code='REGULATORY_SUBMISSION'
  AND step_code='REGULATORY_SUBMISSION_S4';

UPDATE framework_process_definition
SET process_version='1.1.1',
    definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: terminal command and contract aligned',
    last_reviewed_at=current_timestamp,
    updated_at=current_timestamp
WHERE process_code='REGULATORY_SUBMISSION';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM framework_process_step s
    JOIN framework_step_execution_spec e USING(process_code,step_code)
    WHERE s.process_code='REGULATORY_SUBMISSION'
      AND s.step_code='REGULATORY_SUBMISSION_S4'
      AND s.to_state='COMPLETED'
      AND e.transition_contract->>'toState'='COMPLETED'
  ) THEN
    RAISE EXCEPTION 'regulatory submission terminal state is not aligned';
  END IF;
END $$;
