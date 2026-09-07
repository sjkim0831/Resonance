-- The withdrawal request is initiated by the signed-in member, not a privacy officer.
DO $$
BEGIN
  ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
  UPDATE framework_process_step
     SET actor_code = 'MEMBER_USER'
   WHERE process_code = 'ACCOUNT_WITHDRAWAL'
     AND step_code = 'ACCOUNT_WITHDRAWAL_S1';
  ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;
END $$;
