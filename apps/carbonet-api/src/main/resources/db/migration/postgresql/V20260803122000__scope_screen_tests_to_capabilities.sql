ALTER TABLE framework_screen_workflow_test_case
  ADD COLUMN IF NOT EXISTS capability_code varchar(160) NOT NULL DEFAULT 'ALL';

ALTER TABLE framework_screen_workflow_test_run
  ADD COLUMN IF NOT EXISTS capability_code varchar(160) NOT NULL DEFAULT 'ALL';

ALTER TABLE framework_screen_workflow_test_case
  DROP CONSTRAINT IF EXISTS framework_screen_workflow_tes_screen_resource_id_process_co_key;

ALTER TABLE framework_screen_workflow_test_case
  ADD CONSTRAINT framework_screen_workflow_test_case_scope_key
  UNIQUE(screen_resource_id,process_code,step_code,capability_code,case_name);

DROP INDEX IF EXISTS idx_screen_workflow_test_case_lookup;
CREATE INDEX idx_screen_workflow_test_case_lookup
  ON framework_screen_workflow_test_case(process_code,step_code,screen_resource_id,capability_code,active);

COMMENT ON COLUMN framework_screen_workflow_test_case.capability_code IS
  'Selected screen capability whose step-scoped dataset is stored by this fixture; ALL preserves legacy fixtures.';
COMMENT ON COLUMN framework_screen_workflow_test_run.capability_code IS
  'Capability selected when the deterministic workflow test was executed.';
