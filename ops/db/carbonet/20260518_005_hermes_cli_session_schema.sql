-- Hermes CLI session logging schema.
-- Captures SSH/terminal Hermes launches and links transcripts back to workflow memory.

CREATE TABLE IF NOT EXISTS hermes_cli_session (
  hermes_session_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80),
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  workspace_path VARCHAR(1000),
  command_line CLOB,
  mode VARCHAR(40) DEFAULT 'INTERACTIVE' NOT NULL,
  status VARCHAR(40) DEFAULT 'STARTED' NOT NULL,
  transcript_ref VARCHAR(1000),
  stdout_ref VARCHAR(1000),
  stderr_ref VARCHAR(1000),
  exit_code INTEGER,
  started_at DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  finished_at DATETIME,
  elapsed_ms BIGINT,
  summary CLOB,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_session_id)
);

CREATE INDEX idx_hermes_cli_session_task
  ON hermes_cli_session (hermes_task_id, status);

CREATE INDEX idx_hermes_cli_session_time
  ON hermes_cli_session (project_id, started_at);

COMMIT;
