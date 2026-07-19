-- Keep hidden workflow entries as deep links into the canonical user workspaces.
-- Reduction simulation remains a separate business route.

UPDATE comtnmenuinfo
SET menu_url = CASE menu_code
      WHEN 'H1020408' THEN '/emission/activity-data?tab=mapping'
      WHEN 'H102040801' THEN '/emission/activity-data?tab=mapping'
      WHEN 'H1020106' THEN '/emission/calculation'
      ELSE menu_url
    END,
    last_updt_pnttm = current_timestamp
WHERE menu_code IN ('H1020408','H102040801','H1020106');

UPDATE comtccmmndetailcode detail
SET code_dc = menu.menu_url,
    last_updt_pnttm = current_timestamp,
    last_updusr_id = 'FLYWAY_ROUTE_REPAIR'
FROM comtnmenuinfo menu
WHERE detail.code_id = 'HMENU1'
  AND detail.code = menu.menu_code
  AND menu.menu_code IN ('H1020408','H102040801','H1020106');

UPDATE framework_process_artifact
SET target_path = '/emission/calculation',
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT'
  AND step_code = 'EMISSION_PROJECT_CALCULATE'
  AND artifact_code = 'EP-PAGE-CALCULATE';

UPDATE framework_screen_feature_binding
SET route_path = '/emission/calculation',
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT'
  AND step_code = 'EMISSION_PROJECT_CALCULATE'
  AND route_path = '/emission/simulate';

UPDATE framework_project_registration_requirement
SET target_route = '/emission/calculation',
    updated_at = current_timestamp
WHERE requirement_code IN ('PRJ_METHOD_FACTOR','PRJ_METHOD_GWP')
  AND target_route = '/emission/simulate';

SELECT framework_refresh_menu_semantic_binding(menu_code)
FROM comtnmenuinfo
WHERE menu_code IN ('H1020408','H102040801','H1020106');
