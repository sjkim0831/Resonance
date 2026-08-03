CREATE TABLE IF NOT EXISTS framework_screen_workflow_test_case (
  test_case_id bigserial PRIMARY KEY,
  screen_resource_id bigint NOT NULL REFERENCES framework_screen_resource(screen_resource_id) ON DELETE CASCADE,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  case_name varchar(240) NOT NULL,
  pre_input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_result varchar(24) NOT NULL DEFAULT 'PASSED' CHECK(expected_result IN ('PASSED','BLOCKED')),
  expected_state varchar(80),
  active boolean NOT NULL DEFAULT true,
  created_by varchar(100) NOT NULL,
  updated_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(screen_resource_id,process_code,step_code,case_name)
);

ALTER TABLE framework_screen_workflow_test_run
  ADD COLUMN IF NOT EXISTS test_case_id bigint REFERENCES framework_screen_workflow_test_case(test_case_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_screen_workflow_test_case_lookup
  ON framework_screen_workflow_test_case(process_code,step_code,screen_resource_id,active);

COMMENT ON TABLE framework_screen_workflow_test_case IS
  'Reusable pre-input fixtures and expected outcomes for AI-independent screen workflow tests.';
