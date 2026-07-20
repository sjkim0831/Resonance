-- Normalize legacy generator jobs to the same fail-closed contract used by
-- newly registered actor/process implementation work.
UPDATE framework_development_job
SET specification_json = (
      COALESCE(NULLIF(specification_json, ''), '{}')::jsonb
      || jsonb_build_object('reuseCommonAssets', true)
    )::text,
    updated_at = current_timestamp
WHERE job_type IN ('FULL_STACK', 'FULL_STACK_GENERATION')
  AND NOT (COALESCE(NULLIF(specification_json, ''), '{}')::jsonb ? 'reuseCommonAssets');

