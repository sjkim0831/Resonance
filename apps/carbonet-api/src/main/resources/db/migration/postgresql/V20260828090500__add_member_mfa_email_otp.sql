CREATE TABLE IF NOT EXISTS member_mfa_setting (
    user_id varchar(100) PRIMARY KEY,
    method varchar(30) NOT NULL DEFAULT 'EMAIL_OTP',
    destination_masked varchar(320) NOT NULL DEFAULT '',
    enabled boolean NOT NULL DEFAULT false,
    verified_at timestamp,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_mfa_challenge (
    challenge_id uuid PRIMARY KEY,
    user_id varchar(100) NOT NULL,
    purpose varchar(30) NOT NULL,
    code_hash char(64) NOT NULL,
    expires_at timestamp NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 100),
    verified_at timestamp,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_member_mfa_challenge_user_purpose
    ON member_mfa_challenge(user_id, purpose, created_at DESC);

COMMENT ON TABLE member_mfa_setting IS '회원별 다중 인증 활성화 원장';
COMMENT ON TABLE member_mfa_challenge IS '일회용 MFA 인증 요청 및 검증 이력';
