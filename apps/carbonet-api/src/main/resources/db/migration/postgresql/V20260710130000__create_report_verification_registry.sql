CREATE TABLE IF NOT EXISTS carbonet_report_verification_registry (
    certificate_id VARCHAR(80) PRIMARY KEY,
    payload_version INTEGER NOT NULL DEFAULT 2,
    issued_at TIMESTAMPTZ NOT NULL,
    report_title VARCHAR(500),
    product_name VARCHAR(500),
    report_generated_at VARCHAR(100),
    total_emission NUMERIC(30, 10) NOT NULL DEFAULT 0,
    row_count INTEGER NOT NULL DEFAULT 0,
    calculated_row_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    payload_hash CHAR(64) NOT NULL,
    integrity_code VARCHAR(64) NOT NULL,
    dataset_hash CHAR(64) NOT NULL,
    dataset_json JSONB NOT NULL,
    issuer_id VARCHAR(200),
    status_code VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_carbonet_report_verification_status CHECK (status_code IN ('ISSUED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_carbonet_report_verification_hash
    ON carbonet_report_verification_registry (payload_hash);

CREATE INDEX IF NOT EXISTS idx_carbonet_report_verification_issued_at
    ON carbonet_report_verification_registry (issued_at DESC);

COMMENT ON TABLE carbonet_report_verification_registry IS
    'Authoritative issued-report registry containing the canonical dataset used for authenticity comparison.';
