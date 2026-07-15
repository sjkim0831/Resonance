CREATE TABLE IF NOT EXISTS member_consent_history (
    consent_id          BIGSERIAL PRIMARY KEY,
    join_session_id     VARCHAR(160) NOT NULL,
    member_id           VARCHAR(100),
    membership_type     VARCHAR(30),
    consent_type        VARCHAR(30) NOT NULL,
    terms_version       VARCHAR(40) NOT NULL,
    terms_hash          VARCHAR(64) NOT NULL,
    agreed              BOOLEAN NOT NULL,
    agreed_at           TIMESTAMPTZ,
    withdrawn_at        TIMESTAMPTZ,
    ip_address          VARCHAR(64),
    user_agent          VARCHAR(500),
    consent_source      VARCHAR(30) NOT NULL DEFAULT 'JOIN',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_consent_session_type_version
        UNIQUE (join_session_id, consent_type, terms_version),
    CONSTRAINT ck_member_consent_type
        CHECK (consent_type IN ('TERMS', 'PRIVACY', 'GWP_CCUS', 'MARKETING'))
);

CREATE INDEX IF NOT EXISTS idx_member_consent_member
    ON member_consent_history (member_id, agreed_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_consent_created
    ON member_consent_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_consent_type
    ON member_consent_history (consent_type, agreed, agreed_at DESC);

COMMENT ON TABLE member_consent_history IS '회원가입 약관 및 GWP·CCUS 정보 제공 동의 증적';
COMMENT ON COLUMN member_consent_history.terms_hash IS '동의 당시 서버 기준 약관 본문의 SHA-256';

INSERT INTO comtccmmndetailcode
    (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm, frst_register_id, last_updt_pnttm, last_updusr_id)
VALUES
    ('AMENU1', 'A1020106', '약관·동의 이력', 'Terms & Consent History', 'Y', CURRENT_TIMESTAMP, 'CONSENT_HISTORY', CURRENT_TIMESTAMP, 'CONSENT_HISTORY')
ON CONFLICT (code_id, code) DO UPDATE SET
    code_nm = EXCLUDED.code_nm, code_dc = EXCLUDED.code_dc, use_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP, last_updusr_id = 'CONSENT_HISTORY';

INSERT INTO comtnmenuinfo
    (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at)
VALUES
    ('A1020106', '약관·동의 이력', 'Terms & Consent History', '/admin/system/consent-history', 'fact_check', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y')
ON CONFLICT (menu_code) DO UPDATE SET
    menu_nm = EXCLUDED.menu_nm, menu_nm_en = EXCLUDED.menu_nm_en,
    menu_url = EXCLUDED.menu_url, menu_icon = EXCLUDED.menu_icon,
    use_at = 'Y', expsr_at = 'Y', last_updt_pnttm = CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
VALUES ('A1020106', 1020106, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (menu_code) DO UPDATE SET sort_ordr = EXCLUDED.sort_ordr, last_updt_pnttm = CURRENT_TIMESTAMP;
