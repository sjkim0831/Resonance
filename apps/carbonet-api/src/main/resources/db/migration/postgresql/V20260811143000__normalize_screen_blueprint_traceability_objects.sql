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
