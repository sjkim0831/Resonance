-- Every assignment guide step opens the dedicated assignment workspace.
-- EMISSION_PROJECT is the initial target only; users can select another work type/process there.
UPDATE framework_process_step
SET user_path='/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT'
WHERE process_code='WORK_ASSIGNMENT';

UPDATE framework_page_design
SET actual_route_path='/emission/work-assignment',
    route_status='IMPLEMENTED',
    updated_at=current_timestamp
WHERE process_code='WORK_ASSIGNMENT' AND audience='USER';

DO $$
DECLARE
  invalid_route_count integer;
BEGIN
  SELECT count(*) INTO invalid_route_count
  FROM framework_process_step
  WHERE process_code='WORK_ASSIGNMENT'
    AND user_path NOT LIKE '/emission/work-assignment%';

  IF invalid_route_count <> 0 THEN
    RAISE EXCEPTION 'Work assignment guide route mismatch: %', invalid_route_count;
  END IF;
END $$;
