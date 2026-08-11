-- The deterministic SDUI generator consumes traceability as an object.  A
-- small legacy cohort was stored as an array by the permissive JSON fallback,
-- which made the current generator fail before it could repair the cohort.
-- Preserve every legacy entry while restoring the canonical object contract.
WITH invalid AS (
  SELECT blueprint_id,
         framework_try_jsonb(traceability_json) AS legacy_traceability
    FROM framework_screen_blueprint
   WHERE jsonb_typeof(framework_try_jsonb(traceability_json)) = 'array'
)
UPDATE framework_screen_blueprint blueprint
   SET traceability_json = jsonb_build_object(
         'schemaVersion', '2.0.0',
         'requirementIds', jsonb_build_array(
           blueprint.process_code || ':' || blueprint.step_code || ':' || blueprint.audience
         ),
         'requiredScenarioTypes', jsonb_build_array(
           'HAPPY_PATH', 'AUTHORITY', 'ISOLATION', 'EXCEPTION', 'RECOVERY'
         ),
         'legacyEntries', invalid.legacy_traceability,
         'normalizationReason', 'LEGACY_ARRAY_TO_TRACEABILITY_OBJECT'
       )::text,
       updated_at = current_timestamp
  FROM invalid
 WHERE blueprint.blueprint_id = invalid.blueprint_id;

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*)
    INTO invalid_count
    FROM framework_screen_blueprint
   WHERE jsonb_typeof(framework_try_jsonb(specification_json)) IS DISTINCT FROM 'object'
      OR jsonb_typeof(framework_try_jsonb(traceability_json)) IS DISTINCT FROM 'object';
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'screen blueprint object contract remains invalid for % row(s)', invalid_count;
  END IF;
END $$;

-- Source generation replaces one canonical catalog atomically, so a truncated
-- export must never be allowed to erase valid screens beyond the old 1,000-row
-- boundary.  Five thousand remains a bounded batch while covering the current
-- catalog and near-term multi-project growth.
CREATE OR REPLACE FUNCTION framework_screen_blueprint_export(requested_limit integer DEFAULT 5000)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('schemaVersion','2.0.0',
    'batch',jsonb_build_object('code','DB_LIVE','source','POSTGRESQL',
      'exportedAt',current_timestamp),'blueprints',coalesce(jsonb_agg(jsonb_build_object(
      'blueprintCode',b.blueprint_code,'processCode',b.process_code,'stepCode',b.step_code,
      'actorCode',b.actor_code,'audience',b.audience,'pageId',b.page_id,
      'pageName',b.page_name,'routePath',lower(split_part(b.route_path,'?',1)),
      'screenType',b.screen_type,'templateCode',b.template_code,
      'specificationJson',b.specification_json,'traceabilityJson',b.traceability_json,
      'validationStatus',b.validation_status
    ) ORDER BY p.development_order,b.process_code,s.step_order,b.audience,b.blueprint_id),'[]'::jsonb))
  FROM framework_screen_blueprint b
  JOIN framework_process_definition p USING(process_code)
  JOIN framework_process_step s ON s.process_code=b.process_code AND s.step_code=b.step_code
  WHERE b.validation_status='VALID' AND b.blueprint_id IN (
    SELECT b2.blueprint_id FROM framework_screen_blueprint b2
    JOIN framework_process_definition p2 USING(process_code)
    JOIN framework_process_step s2 ON s2.process_code=b2.process_code AND s2.step_code=b2.step_code
    WHERE b2.validation_status='VALID'
    ORDER BY p2.development_order,b2.process_code,s2.step_order,b2.audience,b2.blueprint_id
    LIMIT greatest(1,least(coalesce(requested_limit,5000),5000)))
$$;
