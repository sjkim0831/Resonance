ALTER TABLE carbonet_report_verification_registry
    ADD COLUMN IF NOT EXISTS pdf_storage_key VARCHAR(500),
    ADD COLUMN IF NOT EXISTS pdf_stored_at TIMESTAMPTZ;

ALTER TABLE carbonet_report_verification_registry
    DROP CONSTRAINT IF EXISTS ck_carbonet_report_verification_pdf_storage_pair;

ALTER TABLE carbonet_report_verification_registry
    ADD CONSTRAINT ck_carbonet_report_verification_pdf_storage_pair
        CHECK ((pdf_storage_key IS NULL) = (pdf_stored_at IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS uq_carbonet_report_verification_pdf_storage_key
    ON carbonet_report_verification_registry (pdf_storage_key)
    WHERE pdf_storage_key IS NOT NULL;

COMMENT ON COLUMN carbonet_report_verification_registry.pdf_storage_key IS
    'Relative immutable-object key for the exact issued PDF stored on the persistent report-original mount.';

COMMENT ON COLUMN carbonet_report_verification_registry.pdf_stored_at IS
    'Time at which the exact issued PDF bytes were durably persisted.';
