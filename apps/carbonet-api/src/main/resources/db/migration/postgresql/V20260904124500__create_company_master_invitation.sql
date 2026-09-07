CREATE TABLE IF NOT EXISTS framework_company_master_invitation (
    invitation_id uuid PRIMARY KEY,
    instt_id varchar(100) NOT NULL,
    email varchar(320) NOT NULL DEFAULT '',
    manager_name varchar(200) NOT NULL DEFAULT '',
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamp NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    revoked_at timestamp NULL,
    used_at timestamp NULL,
    used_by_account_id varchar(100) NULL,
    CONSTRAINT ck_company_master_invitation_status
        CHECK (status IN ('ACTIVE', 'USED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_company_master_invitation_instt_status
    ON framework_company_master_invitation (instt_id, status);

CREATE INDEX IF NOT EXISTS idx_company_master_invitation_expires
    ON framework_company_master_invitation (expires_at);
