ALTER TABLE carbonet_report_verification_registry
    ADD COLUMN IF NOT EXISTS ocr_evidence_json jsonb,
    ADD COLUMN IF NOT EXISTS ocr_evidence_version integer,
    ADD COLUMN IF NOT EXISTS ocr_evidence_registered_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'chk_report_verification_ocr_evidence_object'
           AND conrelid = 'carbonet_report_verification_registry'::regclass
    ) THEN
        ALTER TABLE carbonet_report_verification_registry
            ADD CONSTRAINT chk_report_verification_ocr_evidence_object
            CHECK (ocr_evidence_json IS NULL OR jsonb_typeof(ocr_evidence_json) = 'object');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'chk_report_verification_ocr_evidence_version'
           AND conrelid = 'carbonet_report_verification_registry'::regclass
    ) THEN
        ALTER TABLE carbonet_report_verification_registry
            ADD CONSTRAINT chk_report_verification_ocr_evidence_version
            CHECK (ocr_evidence_version IS NULL OR ocr_evidence_version >= 1);
    END IF;
END $$;
