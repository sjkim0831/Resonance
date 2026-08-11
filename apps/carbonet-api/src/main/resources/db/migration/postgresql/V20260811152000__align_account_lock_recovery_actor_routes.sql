-- Align account-lock recovery routes with the actor that actually executes each step.
-- Public members execute request/verification; review and final approval are admin-only.

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_step
SET requires_user_page = true,
    user_path = '/signin/findPassword',
    requires_admin_page = true
WHERE process_code = 'ACCOUNT_LOCK_RECOVERY'
  AND step_code = 'ACCOUNT_LOCK_RECOVERY_S1';

UPDATE framework_process_step
SET requires_user_page = false,
    user_path = NULL,
    requires_admin_page = true
WHERE process_code = 'ACCOUNT_LOCK_RECOVERY'
  AND step_code IN ('ACCOUNT_LOCK_RECOVERY_S3', 'ACCOUNT_LOCK_RECOVERY_S4');

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

DO $$
DECLARE
  invalid_actor_route_count integer;
  blocker_count integer;
BEGIN
  SELECT count(*) INTO invalid_actor_route_count
  FROM framework_process_step
  WHERE process_code = 'ACCOUNT_LOCK_RECOVERY'
    AND (
      (step_code IN ('ACCOUNT_LOCK_RECOVERY_S1', 'ACCOUNT_LOCK_RECOVERY_S2')
       AND (NOT requires_user_page OR nullif(btrim(user_path), '') IS NULL))
      OR
      (step_code IN ('ACCOUNT_LOCK_RECOVERY_S3', 'ACCOUNT_LOCK_RECOVERY_S4')
       AND (requires_user_page OR NOT requires_admin_page OR nullif(btrim(admin_path), '') IS NULL))
    );

  SELECT design_blocker_count INTO blocker_count
  FROM framework_process_design_assurance_matrix
  WHERE process_code = 'ACCOUNT_LOCK_RECOVERY';

  IF invalid_actor_route_count <> 0 OR blocker_count <> 0 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY_ACTOR_ROUTE_ALIGNMENT_FAILED invalid=% blockers=%',
      invalid_actor_route_count, blocker_count;
  END IF;
END $$;
