-- Hermes workflow memory schema.
-- Scope: request interpretation, ordered work steps, execution evidence, and reusable failure/improvement memory.
-- Target DB: CUBRID-compatible SQL.

CREATE TABLE IF NOT EXISTS hermes_task (
  hermes_task_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  trace_id VARCHAR(80),
  user_request CLOB,
  interpreted_intent CLOB,
  task_type VARCHAR(80) DEFAULT 'GENERAL' NOT NULL,
  risk_level VARCHAR(30) DEFAULT 'MEDIUM' NOT NULL,
  status VARCHAR(40) DEFAULT 'INTERPRETED' NOT NULL,
  owner_model VARCHAR(120) DEFAULT 'qwen3.6-40b-deck-opus-q4' NOT NULL,
  executor_type VARCHAR(80) DEFAULT 'CODEX_SCRIPT' NOT NULL,
  target_route VARCHAR(500),
  target_module VARCHAR(300),
  target_db_name VARCHAR(120) DEFAULT 'carbonet',
  plan_summary CLOB,
  result_summary CLOB,
  failure_summary CLOB,
  evidence_root VARCHAR(1000),
  requested_by VARCHAR(80) DEFAULT 'hermes' NOT NULL,
  completed_at DATETIME,
  row_version INTEGER DEFAULT 0 NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_task_id)
);

CREATE INDEX idx_hermes_task_project_status
  ON hermes_task (project_id, status, frst_regist_pnttm);
CREATE INDEX idx_hermes_task_trace
  ON hermes_task (trace_id);
CREATE INDEX idx_hermes_task_type_risk
  ON hermes_task (task_type, risk_level);

CREATE TABLE IF NOT EXISTS hermes_command_interpretation (
  interpretation_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  raw_command CLOB,
  normalized_command CLOB,
  intent_json CLOB,
  ordered_stage_json CLOB,
  target_hint_json CLOB,
  risk_gate_json CLOB,
  model_name VARCHAR(120) DEFAULT 'qwen3.6-40b-deck-opus-q4' NOT NULL,
  confidence_score DOUBLE DEFAULT 0 NOT NULL,
  status VARCHAR(40) DEFAULT 'READY' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (interpretation_id)
);

CREATE INDEX idx_hermes_interpretation_task
  ON hermes_command_interpretation (hermes_task_id, status);

CREATE TABLE IF NOT EXISTS hermes_task_step (
  hermes_step_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  step_order INTEGER DEFAULT 0 NOT NULL,
  stage_code VARCHAR(80) NOT NULL,
  step_title VARCHAR(200) NOT NULL,
  step_instruction CLOB,
  expected_evidence CLOB,
  allowed_executor VARCHAR(80) DEFAULT 'CODEX_SCRIPT' NOT NULL,
  model_role VARCHAR(80) DEFAULT 'QWEN40_PLANNER' NOT NULL,
  status VARCHAR(40) DEFAULT 'PENDING' NOT NULL,
  started_at DATETIME,
  finished_at DATETIME,
  error_summary CLOB,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_step_id)
);

CREATE INDEX idx_hermes_task_step_task_order
  ON hermes_task_step (hermes_task_id, step_order);
CREATE INDEX idx_hermes_task_step_status
  ON hermes_task_step (status, stage_code);

CREATE TABLE IF NOT EXISTS hermes_execution_log (
  hermes_execution_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  hermes_step_id VARCHAR(80),
  execution_type VARCHAR(80) NOT NULL,
  command_text CLOB,
  target_path VARCHAR(1000),
  target_url VARCHAR(1000),
  status VARCHAR(40) DEFAULT 'PENDING' NOT NULL,
  exit_code INTEGER,
  stdout_ref VARCHAR(1000),
  stderr_ref VARCHAR(1000),
  output_summary CLOB,
  started_at DATETIME,
  finished_at DATETIME,
  elapsed_ms BIGINT,
  executed_by VARCHAR(80) DEFAULT 'codex' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_execution_id)
);

CREATE INDEX idx_hermes_execution_task_status
  ON hermes_execution_log (hermes_task_id, status);
CREATE INDEX idx_hermes_execution_type_time
  ON hermes_execution_log (execution_type, started_at);

CREATE TABLE IF NOT EXISTS hermes_verification_log (
  hermes_verification_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  hermes_execution_id VARCHAR(80),
  verification_type VARCHAR(80) NOT NULL,
  command_text CLOB,
  target_url VARCHAR(1000),
  status VARCHAR(40) DEFAULT 'PENDING' NOT NULL,
  passed_yn CHAR(1) DEFAULT 'N' NOT NULL,
  exit_code INTEGER,
  evidence_ref VARCHAR(1000),
  result_summary CLOB,
  verified_by VARCHAR(80) DEFAULT 'codex' NOT NULL,
  verified_at DATETIME,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_verification_id)
);

CREATE INDEX idx_hermes_verification_task
  ON hermes_verification_log (hermes_task_id, verification_type, passed_yn);

CREATE TABLE IF NOT EXISTS hermes_failure_pattern (
  failure_pattern_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  pattern_key VARCHAR(200) NOT NULL,
  failure_type VARCHAR(80) NOT NULL,
  symptom_summary CLOB,
  root_cause_summary CLOB,
  recovery_summary CLOB,
  prevention_summary CLOB,
  source_task_id VARCHAR(80),
  hit_count INTEGER DEFAULT 1 NOT NULL,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (failure_pattern_id)
);

CREATE INDEX idx_hermes_failure_pattern_key
  ON hermes_failure_pattern (project_id, pattern_key, active_yn);

CREATE TABLE IF NOT EXISTS hermes_model_decision (
  hermes_decision_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  decision_stage VARCHAR(80) NOT NULL,
  selected_model VARCHAR(120) NOT NULL,
  fallback_model VARCHAR(120),
  decision_reason CLOB,
  confidence_score DOUBLE DEFAULT 0 NOT NULL,
  accepted_yn CHAR(1) DEFAULT 'N' NOT NULL,
  evidence_ref VARCHAR(1000),
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_decision_id)
);

CREATE INDEX idx_hermes_model_decision_task
  ON hermes_model_decision (hermes_task_id, decision_stage);

CREATE TABLE IF NOT EXISTS hermes_runtime_snapshot (
  hermes_snapshot_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80),
  snapshot_type VARCHAR(80) NOT NULL,
  source_ref VARCHAR(1000),
  summary CLOB,
  raw_payload CLOB,
  collected_by VARCHAR(80) DEFAULT 'codex' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_snapshot_id)
);

CREATE INDEX idx_hermes_runtime_snapshot_task
  ON hermes_runtime_snapshot (hermes_task_id, snapshot_type);

CREATE TABLE IF NOT EXISTS hermes_workflow_stage_template (
  stage_code VARCHAR(80) NOT NULL,
  stage_order INTEGER DEFAULT 0 NOT NULL,
  stage_name VARCHAR(200) NOT NULL,
  default_executor VARCHAR(80) DEFAULT 'CODEX_SCRIPT' NOT NULL,
  evidence_policy CLOB,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (stage_code)
);

INSERT INTO hermes_workflow_stage_template (stage_code, stage_order, stage_name, default_executor, evidence_policy)
SELECT 'REQUEST_CAPTURE', 10, 'Request capture', 'HERMES', '{"required":["raw_request","trace_id"]}'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_workflow_stage_template WHERE stage_code = 'REQUEST_CAPTURE');

INSERT INTO hermes_workflow_stage_template (stage_code, stage_order, stage_name, default_executor, evidence_policy)
SELECT 'INTENT_PARSE', 20, 'Intent and risk parse', 'QWEN40', '{"required":["task_type","risk_level","targets"]}'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_workflow_stage_template WHERE stage_code = 'INTENT_PARSE');

INSERT INTO hermes_workflow_stage_template (stage_code, stage_order, stage_name, default_executor, evidence_policy)
SELECT 'SCOPE_ROUTE', 30, 'Frontend/backend/db/script/k8s route', 'QWEN40', '{"required":["stage_breakdown","ownership"]}'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_workflow_stage_template WHERE stage_code = 'SCOPE_ROUTE');

INSERT INTO hermes_workflow_stage_template (stage_code, stage_order, stage_name, default_executor, evidence_policy)
SELECT 'PRECHECK', 40, 'Runtime and repository precheck', 'CODEX_SCRIPT', '{"required":["git_status","service_status","db_status"]}'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_workflow_stage_template WHERE stage_code = 'PRECHECK');

INSERT INTO hermes_workflow_stage_template (stage_code, stage_order, stage_name, default_executor, evidence_policy)
SELECT 'IMPLEMENT', 50, 'Bounded implementation', 'CODEX', '{"required":["changed_files","patch_summary"]}'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_workflow_stage_template WHERE stage_code = 'IMPLEMENT');

INSERT INTO hermes_workflow_stage_template (stage_code, stage_order, stage_name, default_executor, evidence_policy)
SELECT 'VERIFY', 60, 'Build/runtime verification', 'CODEX_SCRIPT', '{"required":["build_result","runtime_probe","route_probe"]}'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_workflow_stage_template WHERE stage_code = 'VERIFY');

INSERT INTO hermes_workflow_stage_template (stage_code, stage_order, stage_name, default_executor, evidence_policy)
SELECT 'REFLECT', 70, 'Failure pattern and memory update', 'QWEN40_CODEX', '{"required":["result_summary","reusable_pattern"]}'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_workflow_stage_template WHERE stage_code = 'REFLECT');

COMMIT;
