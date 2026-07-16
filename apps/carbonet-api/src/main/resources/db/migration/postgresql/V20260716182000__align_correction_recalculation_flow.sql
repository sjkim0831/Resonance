UPDATE framework_process_step
SET from_state='CORRECTION_REQUIRED',
    to_state='DATA_SUBMITTED',
    command_code='RESUBMIT',
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT'
  AND step_code='EMISSION_PROJECT_CORRECT';
