CREATE TABLE IF NOT EXISTS account_recovery_request (
    request_id UUID PRIMARY KEY,
    target_user_id VARCHAR(100),
    target_user_se VARCHAR(10),
    delivery_channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
    masked_destination VARCHAR(320),
    otp_hash VARCHAR(64),
    proof_hash VARCHAR(64),
    status VARCHAR(30) NOT NULL,
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    requested_ip VARCHAR(64) NOT NULL,
    user_agent VARCHAR(500),
    expires_at TIMESTAMP,
    proof_expires_at TIMESTAMP,
    verified_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT account_recovery_request_status_ck CHECK
      (status IN ('PENDING_DELIVERY','CODE_SENT','VERIFIED','COMPLETED','EXPIRED','LOCKED','DELIVERY_FAILED','SUBJECT_NOT_FOUND')),
    CONSTRAINT account_recovery_delivery_status_ck CHECK
      (delivery_status IN ('PENDING','SENT','FAILED','SUPPRESSED'))
);

CREATE INDEX IF NOT EXISTS account_recovery_request_subject_idx
    ON account_recovery_request (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS account_recovery_request_ip_idx
    ON account_recovery_request (requested_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS account_recovery_request_status_idx
    ON account_recovery_request (status, expires_at);

CREATE TABLE IF NOT EXISTS account_recovery_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES account_recovery_request(request_id) ON DELETE CASCADE,
    event_code VARCHAR(50) NOT NULL,
    actor_id VARCHAR(100) NOT NULL DEFAULT 'ANONYMOUS',
    actor_ip VARCHAR(64),
    detail_code VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS account_recovery_audit_request_idx
    ON account_recovery_audit (request_id, created_at);

COMMENT ON TABLE account_recovery_request IS 'Server-authoritative, single-use account recovery challenge and proof state';
COMMENT ON COLUMN account_recovery_request.otp_hash IS 'SHA-256 digest bound to request id and server recovery pepper; raw OTP is never persisted';
COMMENT ON COLUMN account_recovery_request.proof_hash IS 'Single-use recovery proof digest; raw proof is returned only once after OTP verification';
