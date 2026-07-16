UPDATE framework_process_step
SET from_state='CORRECTION_REQUIRED',
    to_state='DATA_SUBMITTED',
    command_code='RESUBMIT'
WHERE process_code='EMISSION_PROJECT'
  AND step_code='EMISSION_PROJECT_CORRECT';
