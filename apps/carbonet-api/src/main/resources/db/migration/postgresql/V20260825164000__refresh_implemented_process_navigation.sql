-- Promote process navigation bindings when a real implemented page was
-- registered after the original navigation factory migration ran.
-- Public pages are exposed through the USER navigation audience.
WITH implemented_route AS (
  SELECT DISTINCT ON (d.process_code)
         d.process_code,
         CASE WHEN d.audience = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END AS audience,
         coalesce(nullif(d.actual_route_path, ''), nullif(d.planned_route_path, '')) AS target_path
    FROM framework_page_design d
    JOIN framework_process_navigation_binding n
      ON n.process_code = d.process_code
     AND n.binding_status = 'ACTIVE'
   WHERE d.route_status = 'IMPLEMENTED'
     AND coalesce(nullif(d.actual_route_path, ''), nullif(d.planned_route_path, '')) IS NOT NULL
     AND n.navigation_type = 'DESIGN_WORKSPACE'
   ORDER BY d.process_code,
            CASE d.audience WHEN 'USER' THEN 0 WHEN 'PUBLIC' THEN 1 ELSE 2 END,
            d.page_design_id
)
UPDATE framework_process_navigation_binding n
   SET audience = r.audience,
       navigation_type = 'IMPLEMENTED_SCREEN',
       target_path = r.target_path,
       business_screen_implemented = true,
       binding_source = 'IMPLEMENTED_PAGE_REFRESH',
       binding_status = 'ACTIVE',
       verified_at = current_timestamp,
       updated_at = current_timestamp
  FROM implemented_route r
 WHERE n.process_code = r.process_code;

DO $$
DECLARE remaining bigint;
BEGIN
  SELECT count(*) INTO remaining
    FROM framework_process_navigation_coverage n
   WHERE n.navigation_status = 'DESIGN_WORKSPACE_ONLY'
     AND n.implemented_page_count > 0;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'IMPLEMENTED_PROCESS_NAVIGATION_NOT_PROMOTED remaining=%', remaining;
  END IF;
END $$;
