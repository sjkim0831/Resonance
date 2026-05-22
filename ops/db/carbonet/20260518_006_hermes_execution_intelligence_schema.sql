-- Hermes execution intelligence extensions.
-- Stores context packs and next-action recommendations for Qwen40-first execution planning.

CREATE TABLE IF NOT EXISTS hermes_context_pack (
  hermes_context_pack_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  request_fingerprint VARCHAR(80),
  system_context CLOB,
  previous_work_context CLOB,
  codebase_context CLOB,
  runtime_context CLOB,
  agent_team_context CLOB,
  risk_context CLOB,
  evidence_ref VARCHAR(1000),
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_context_pack_id)
);

CREATE INDEX idx_hermes_context_pack_task
  ON hermes_context_pack (hermes_task_id, frst_regist_pnttm);

CREATE TABLE IF NOT EXISTS hermes_next_action_recommendation (
  hermes_recommendation_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  recommendation_order INTEGER DEFAULT 0 NOT NULL,
  recommendation_type VARCHAR(80) DEFAULT 'NEXT_ACTION' NOT NULL,
  title VARCHAR(300) NOT NULL,
  rationale CLOB,
  command_text CLOB,
  target_route VARCHAR(500),
  target_module VARCHAR(500),
  expected_evidence CLOB,
  risk_level VARCHAR(30) DEFAULT 'MEDIUM' NOT NULL,
  status VARCHAR(40) DEFAULT 'READY' NOT NULL,
  accepted_yn CHAR(1) DEFAULT 'N' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_recommendation_id)
);

CREATE INDEX idx_hermes_next_action_task
  ON hermes_next_action_recommendation (hermes_task_id, recommendation_order);

CREATE TABLE IF NOT EXISTS hermes_capability_pattern (
  hermes_pattern_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  pattern_key VARCHAR(200) NOT NULL,
  pattern_type VARCHAR(80) NOT NULL,
  trigger_summary CLOB,
  execution_order CLOB,
  verification_order CLOB,
  reuse_score DOUBLE DEFAULT 0 NOT NULL,
  source_task_id VARCHAR(80),
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_pattern_id)
);

CREATE INDEX idx_hermes_capability_pattern_key
  ON hermes_capability_pattern (project_id, pattern_key, active_yn);

COMMIT;
