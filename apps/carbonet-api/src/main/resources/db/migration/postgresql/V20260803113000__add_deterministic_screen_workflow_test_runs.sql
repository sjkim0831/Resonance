-- AI-independent screen workflow verification evidence.
-- Every run is reproducible from the registered actor/process/screen contracts.
CREATE TABLE IF NOT EXISTS framework_screen_workflow_test_run (
  run_id bigserial PRIMARY KEY,
  screen_resource_id bigint NOT NULL REFERENCES framework_screen_resource(screen_resource_id) ON DELETE CASCADE,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  route_key varchar(500) NOT NULL,
  result varchar(24) NOT NULL CHECK(result IN ('PASSED','BLOCKED')),
  passed_check_count integer NOT NULL DEFAULT 0,
  total_check_count integer NOT NULL DEFAULT 0,
  blocker_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_by varchar(100) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_screen_workflow_test_run_lookup
  ON framework_screen_workflow_test_run(screen_resource_id,process_code,step_code,executed_at DESC);

COMMENT ON TABLE framework_screen_workflow_test_run IS
  'Deterministic, AI-independent evidence for screen-level actor/process/field/authority/test closing.';
