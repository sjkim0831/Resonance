-- Every executable step must be connected to at least one designed screen,
-- even when legacy requires_* flags were left false. Keep the view definition
-- in one place and fail the migration if PostgreSQL's normalized definition no
-- longer contains the guarded clauses.
DO $migration$
DECLARE
  original_definition text := pg_get_viewdef('framework_contract_completion_queue'::regclass,true);
  patched_definition text;
BEGIN
  patched_definition := replace(
    original_definition,
    'COALESCE(pa.designed_page_count, 0) < (',
    'COALESCE(pa.designed_page_count, 0) = 0 OR COALESCE(pa.designed_page_count, 0) < ('
  );
  IF patched_definition=original_definition THEN
    RAISE EXCEPTION 'page contract predicate was not found in completion queue';
  END IF;

  original_definition := patched_definition;
  patched_definition := replace(
    original_definition,
    'j.quality_status::text = ''VERIFIED''::text',
    'j.quality_status::text = ANY (ARRAY[''VERIFIED''::character varying,''PASSED''::character varying]::text[])'
  );
  IF patched_definition=original_definition THEN
    RAISE EXCEPTION 'quality evidence predicate was not found in completion queue';
  END IF;

  EXECUTE 'CREATE OR REPLACE VIEW framework_contract_completion_queue AS '||patched_definition;
END $migration$;

-- Older deterministic workers persisted the job evidence but omitted the
-- quality mirror. Normalize only algorithm jobs with immutable Git evidence.
UPDATE framework_development_job
SET quality_status='VERIFIED',updated_at=current_timestamp
WHERE created_by='CONTRACT_COMPLETION_ALGORITHM'
  AND job_status='VERIFIED'
  AND quality_status IS DISTINCT FROM 'VERIFIED'
  AND evidence_ref ~ '^git:[0-9a-f]{40}(;|$)';
