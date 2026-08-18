ALTER TABLE carbonet_report_verification_registry
    ADD COLUMN IF NOT EXISTS pdf_sha256 CHAR(64),
    ADD COLUMN IF NOT EXISTS pdf_size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS pdf_fingerprint_registered_by VARCHAR(200),
    ADD COLUMN IF NOT EXISTS pdf_fingerprint_registered_at TIMESTAMPTZ;

ALTER TABLE carbonet_report_verification_registry
    DROP CONSTRAINT IF EXISTS ck_carbonet_report_verification_pdf_sha256;

ALTER TABLE carbonet_report_verification_registry
    ADD CONSTRAINT ck_carbonet_report_verification_pdf_sha256
        CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE carbonet_report_verification_registry
    DROP CONSTRAINT IF EXISTS ck_carbonet_report_verification_pdf_size;

ALTER TABLE carbonet_report_verification_registry
    ADD CONSTRAINT ck_carbonet_report_verification_pdf_size
        CHECK (pdf_size_bytes IS NULL OR pdf_size_bytes > 0);

ALTER TABLE carbonet_report_verification_registry
    DROP CONSTRAINT IF EXISTS ck_carbonet_report_verification_pdf_pair;

ALTER TABLE carbonet_report_verification_registry
    ADD CONSTRAINT ck_carbonet_report_verification_pdf_pair
        CHECK ((pdf_sha256 IS NULL) = (pdf_size_bytes IS NULL));

CREATE INDEX IF NOT EXISTS idx_carbonet_report_verification_pdf_sha256
    ON carbonet_report_verification_registry (pdf_sha256)
    WHERE pdf_sha256 IS NOT NULL;

COMMENT ON COLUMN carbonet_report_verification_registry.pdf_sha256 IS
    'SHA-256 of the final server-rendered PDF bytes. NULL means a legacy record that cannot prove exact-file authenticity.';

COMMENT ON COLUMN carbonet_report_verification_registry.pdf_size_bytes IS
    'Exact byte length paired with pdf_sha256 for issued-file verification.';

ALTER TABLE emission_project_report
    ADD COLUMN IF NOT EXISTS pdf_sha256 CHAR(64),
    ADD COLUMN IF NOT EXISTS pdf_size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS pdf_fingerprint_registered_by VARCHAR(200),
    ADD COLUMN IF NOT EXISTS pdf_fingerprint_registered_at TIMESTAMPTZ;

ALTER TABLE emission_project_report
    DROP CONSTRAINT IF EXISTS ck_emission_project_report_pdf_sha256;

ALTER TABLE emission_project_report
    ADD CONSTRAINT ck_emission_project_report_pdf_sha256
        CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE emission_project_report
    DROP CONSTRAINT IF EXISTS ck_emission_project_report_pdf_size;

ALTER TABLE emission_project_report
    ADD CONSTRAINT ck_emission_project_report_pdf_size
        CHECK (pdf_size_bytes IS NULL OR pdf_size_bytes > 0);

ALTER TABLE emission_project_report
    DROP CONSTRAINT IF EXISTS ck_emission_project_report_pdf_pair;

ALTER TABLE emission_project_report
    ADD CONSTRAINT ck_emission_project_report_pdf_pair
        CHECK ((pdf_sha256 IS NULL) = (pdf_size_bytes IS NULL));

CREATE INDEX IF NOT EXISTS idx_emission_project_report_pdf_sha256
    ON emission_project_report (pdf_sha256)
    WHERE pdf_sha256 IS NOT NULL;

COMMENT ON COLUMN emission_project_report.pdf_sha256 IS
    'SHA-256 of a trusted finalized report PDF, registered once and never replaced by a different file.';
