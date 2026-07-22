-- Close the reverse navigation contract for the implemented project portfolio
-- process.  A process is not complete unless users can navigate from the
-- process catalog to its real business screen and back through the menu tree.
INSERT INTO framework_process_navigation_binding(
  process_code,
  menu_code,
  step_code,
  actor_code,
  audience,
  navigation_type,
  target_path,
  business_screen_implemented,
  binding_status,
  binding_source,
  verified_at
)
VALUES(
  'EMISSION_PROJECT_PORTFOLIO',
  'H1020102',
  'EMISSION_PROJECT_PORTFOLIO_LIST',
  'COMPANY_MANAGER',
  'USER',
  'IMPLEMENTED_SCREEN',
  '/emission/project_list',
  true,
  'ACTIVE',
  'LIST_DASHBOARD_STANDARD_RECONCILIATION',
  current_timestamp
)
ON CONFLICT(process_code) DO UPDATE SET
  menu_code=excluded.menu_code,
  step_code=excluded.step_code,
  actor_code=excluded.actor_code,
  audience=excluded.audience,
  navigation_type=excluded.navigation_type,
  target_path=excluded.target_path,
  business_screen_implemented=true,
  binding_status='ACTIVE',
  binding_source=excluded.binding_source,
  verified_at=current_timestamp,
  updated_at=current_timestamp;

DO $$
DECLARE audit framework_process_navigation_summary%ROWTYPE;
BEGIN
  SELECT * INTO audit FROM framework_process_navigation_summary;
  IF audit.process_count<>audit.navigation_bound_count
     OR audit.navigation_missing_count<>0 THEN
    RAISE EXCEPTION
      'Project portfolio navigation closure failed: process=%, bound=%, missing=%',
      audit.process_count,audit.navigation_bound_count,audit.navigation_missing_count;
  END IF;
END $$;
