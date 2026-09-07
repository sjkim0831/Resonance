SET ROLE p006_app;
CREATE TABLE IF NOT EXISTS dt_project_session (
  session_hash CHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES dt_project_account(account_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_dt_project_session_account ON dt_project_session(account_id, expires_at);
