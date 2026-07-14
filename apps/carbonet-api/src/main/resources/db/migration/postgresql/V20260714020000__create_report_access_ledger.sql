CREATE TABLE IF NOT EXISTS emission_report_access_ledger (
 access_id bigserial PRIMARY KEY, tenant_id varchar(100) NOT NULL, project_id varchar(100) NOT NULL,
 report_id bigint NOT NULL REFERENCES emission_project_report(report_id) ON DELETE CASCADE,
 certificate_id varchar(100), action_code varchar(30) NOT NULL, actor_id varchar(100),
 client_ip varchar(100), user_agent text, share_token varchar(100), share_expires_at timestamp,
 share_revoked_at timestamp, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_report_access_project ON emission_report_access_ledger(tenant_id,project_id,created_at DESC);
