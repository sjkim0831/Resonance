-- COMTNINSTTINFO is read and written through a project-scoped mapper.  Older
-- installations predate that contract, so the column must be introduced and
-- existing institutions assigned to the currently deployed P003 project before
-- company onboarding can persist a registration.

ALTER TABLE comtninsttinfo
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(100);

ALTER TABLE comtninsttinfo
  ALTER COLUMN project_id TYPE VARCHAR(100)
  USING project_id::VARCHAR(100);

UPDATE comtninsttinfo
SET project_id = 'P003'
WHERE project_id IS NULL
   OR BTRIM(project_id) = '';

ALTER TABLE comtninsttinfo
  ALTER COLUMN project_id SET DEFAULT 'P003',
  ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comtninsttinfo_project_status_updated
  ON comtninsttinfo(project_id, instt_sttus, last_updt_pnttm DESC);

COMMENT ON COLUMN comtninsttinfo.project_id IS
  'Owning Resonance project runtime; required by project-scoped member onboarding queries';

DO $$
DECLARE
  project_column_count BIGINT;
  unscoped_row_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO project_column_count
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'comtninsttinfo'
    AND column_name = 'project_id'
    AND data_type = 'character varying'
    AND character_maximum_length = 100
    AND is_nullable = 'NO';

  SELECT COUNT(*)
  INTO unscoped_row_count
  FROM comtninsttinfo
  WHERE project_id IS NULL
     OR BTRIM(project_id) = '';

  IF project_column_count <> 1 THEN
    RAISE EXCEPTION
      'COMPANY_ONBOARDING_SCHEMA_MISMATCH: COMTNINSTTINFO.PROJECT_ID must be VARCHAR(100) NOT NULL';
  END IF;

  IF unscoped_row_count <> 0 THEN
    RAISE EXCEPTION
      'COMPANY_ONBOARDING_SCHEMA_MISMATCH: % COMTNINSTTINFO rows have no project scope',
      unscoped_row_count;
  END IF;
END
$$;
