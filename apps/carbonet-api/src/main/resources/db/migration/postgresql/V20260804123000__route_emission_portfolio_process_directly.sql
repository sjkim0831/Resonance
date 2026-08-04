-- The first carbon-emission workflow opens the professional portfolio screen
-- directly. The project list remains available as its own menu, but is no
-- longer an intermediate hop in the task guide.
ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_step
SET user_path='/emission/project-portfolio'
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST';

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_navigation_binding
SET target_path='/emission/project-portfolio',
    navigation_type='IMPLEMENTED_SCREEN',
    business_screen_implemented=true,
    binding_status='ACTIVE',
    binding_source='DIRECT_PORTFOLIO_WORKFLOW',
    verified_at=current_timestamp,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO';

UPDATE framework_process_menu_binding
SET menu_url='/emission/project-portfolio',
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND (step_code='EMISSION_PROJECT_PORTFOLIO_LIST' OR step_code IS NULL)
  AND audience='USER'
  AND binding_status='ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM framework_process_step
    WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
      AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
      AND user_path='/emission/project-portfolio'
  ) THEN
    RAISE EXCEPTION 'Portfolio process step direct route was not applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM framework_process_navigation_binding
    WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
      AND target_path='/emission/project-portfolio'
      AND binding_status='ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Portfolio process navigation direct route was not applied';
  END IF;
END $$;
