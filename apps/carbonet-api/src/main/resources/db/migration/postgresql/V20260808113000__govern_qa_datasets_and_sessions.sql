ALTER TABLE framework_screen_workflow_test_case
  ADD COLUMN IF NOT EXISTS case_type varchar(32) NOT NULL DEFAULT 'HAPPY_PATH',
  ADD COLUMN IF NOT EXISTS case_order integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS case_description varchar(1000) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS expected_output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_sequence_json jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE framework_screen_workflow_test_case
    ADD CONSTRAINT framework_screen_workflow_test_case_type_ck
    CHECK (case_type IN ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS framework_qa_process_test_session (
  session_id uuid PRIMARY KEY,
  project_id varchar(80) NOT NULL DEFAULT '',
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  session_status varchar(24) NOT NULL DEFAULT 'PAUSED'
    CHECK (session_status IN ('READY','RUNNING','PAUSED','COMPLETED','FAILED','RESET')),
  current_step_code varchar(100),
  current_case_code varchar(160),
  current_case_index integer NOT NULL DEFAULT 0,
  total_case_count integer NOT NULL DEFAULT 0,
  completed_case_count integer NOT NULL DEFAULT 0,
  working_input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_history_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_fingerprint varchar(64) NOT NULL DEFAULT '',
  created_by varchar(100) NOT NULL,
  updated_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_qa_process_test_session_lookup
  ON framework_qa_process_test_session(process_code,project_id,updated_at DESC);

CREATE OR REPLACE VIEW framework_qa_process_case_catalog AS
WITH bound AS (
  SELECT step.process_code,step.step_code,step.step_order,step.step_name,
         test.case_code,test.case_name,test.case_type,test.preconditions,
         test.steps_json,test.assertions_json,test.case_status,test.automated,
         binding.screen_resource_id,binding.audience,
         row_number() OVER(PARTITION BY step.process_code,step.step_code,test.case_code
                           ORDER BY CASE binding.entry_mode WHEN 'PRIMARY' THEN 0 ELSE 1 END,
                                    CASE binding.audience WHEN 'USER' THEN 0 WHEN 'PUBLIC' THEN 1 ELSE 2 END,
                                    binding.screen_resource_id) binding_rank
    FROM framework_process_step step
    JOIN framework_step_test_binding test_binding
      ON test_binding.process_code=step.process_code AND test_binding.step_code=step.step_code
    JOIN framework_simulation_case test ON test.case_code=test_binding.case_code
    LEFT JOIN framework_process_step_screen_binding binding
      ON binding.process_code=step.process_code AND binding.step_code=step.step_code
     AND binding.binding_status='ACTIVE'
)
SELECT bound.*,screen.route_key,screen.screen_name,master.item_id,
       fixture.test_case_id,fixture.capability_code,fixture.pre_input_json,
       fixture.expected_result,fixture.expected_state,fixture.expected_output_json,
       fixture.action_sequence_json,fixture.case_description
  FROM bound
  LEFT JOIN framework_screen_resource screen USING(screen_resource_id)
  LEFT JOIN framework_page_development_master master USING(screen_resource_id)
  LEFT JOIN LATERAL (
    SELECT fixture.* FROM framework_screen_workflow_test_case fixture
     WHERE fixture.screen_resource_id=bound.screen_resource_id
       AND fixture.process_code=bound.process_code AND fixture.step_code=bound.step_code
       AND fixture.case_type=bound.case_type AND fixture.active=true
     ORDER BY fixture.updated_at DESC,fixture.test_case_id DESC LIMIT 1
  ) fixture ON true
 WHERE binding_rank=1;

COMMENT ON VIEW framework_qa_process_case_catalog IS
  'AI-independent process/step/case catalog with editable QA input fixtures and deterministic screen bindings.';
