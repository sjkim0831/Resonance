CREATE OR REPLACE FUNCTION framework_retire_redundant_planned_screen_contracts(
  requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  stale_routes text[];
  updated_pages integer := 0;
  deleted_contracts integer := 0;
  deleted_resources integer := 0;
BEGIN
  SELECT array_agg(DISTINCT lower(split_part(planned.route_path,'?',1)))
    INTO stale_routes
  FROM framework_professional_screen_contract planned
  WHERE planned.process_code=requested_process
    AND lower(split_part(planned.route_path,'?',1)) LIKE '%/planned/%'
    AND EXISTS (
      SELECT 1 FROM framework_professional_screen_readiness canonical
      WHERE canonical.process_code=planned.process_code
        AND canonical.step_code=planned.step_code
        AND canonical.audience=planned.audience
        AND canonical.readiness_score=100
        AND lower(split_part(canonical.route_path,'?',1)) NOT LIKE '%/planned/%'
    );

  WITH canonical AS (
    SELECT DISTINCT ON (process_code,step_code,audience)
      process_code,step_code,audience,route_path
    FROM framework_professional_screen_readiness
    WHERE process_code=requested_process AND readiness_score=100
      AND lower(split_part(route_path,'?',1)) NOT LIKE '%/planned/%'
    ORDER BY process_code,step_code,audience,contract_id
  )
  UPDATE framework_page_design page
     SET actual_route_path=canonical.route_path,
         route_status='IMPLEMENTED',updated_at=current_timestamp
    FROM canonical
   WHERE page.process_code=canonical.process_code
     AND page.step_code=canonical.step_code
     AND page.audience=canonical.audience
     AND lower(split_part(page.planned_route_path,'?',1)) LIKE '%/planned/%';
  GET DIAGNOSTICS updated_pages=ROW_COUNT;

  DELETE FROM framework_professional_screen_contract planned
  WHERE planned.process_code=requested_process
    AND lower(split_part(planned.route_path,'?',1))=ANY(coalesce(stale_routes,array[]::text[]));
  GET DIAGNOSTICS deleted_contracts=ROW_COUNT;

  DELETE FROM framework_screen_resource resource
  WHERE resource.route_key=ANY(coalesce(stale_routes,array[]::text[]))
    AND NOT EXISTS (
      SELECT 1 FROM framework_professional_screen_contract contract
      WHERE lower(split_part(contract.route_path,'?',1))=resource.route_key
    );
  GET DIAGNOSTICS deleted_resources=ROW_COUNT;

  PERFORM framework_sync_professional_contract_screen_graph(requested_process);
  RETURN jsonb_build_object(
    'processCode',requested_process,'updatedPages',updated_pages,
    'deletedContracts',deleted_contracts,'deletedResources',deleted_resources
  );
END
$function$;

SELECT framework_retire_redundant_planned_screen_contracts('ORGANIZATIONAL_BOUNDARY');

DO $block$
BEGIN
  IF (SELECT count(*) FROM framework_professional_screen_readiness
      WHERE process_code='ORGANIZATIONAL_BOUNDARY')<>8
     OR (SELECT count(*) FROM framework_professional_screen_readiness
         WHERE process_code='ORGANIZATIONAL_BOUNDARY' AND readiness_score=100)<>8
     OR EXISTS (
       SELECT 1 FROM framework_page_design
       WHERE process_code='ORGANIZATIONAL_BOUNDARY'
         AND (route_status<>'IMPLEMENTED' OR nullif(actual_route_path,'') IS NULL)
     ) THEN
    RAISE EXCEPTION 'organizational boundary canonical screen adoption failed';
  END IF;
END
$block$;
