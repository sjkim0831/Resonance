ALTER TABLE carbonet_report_verification_registry
    ADD COLUMN IF NOT EXISTS visual_profile_json JSONB,
    ADD COLUMN IF NOT EXISTS visual_profile_version INTEGER,
    ADD COLUMN IF NOT EXISTS visual_profile_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN carbonet_report_verification_registry.visual_profile_json IS
    'Page-normalized visual fingerprint captured from the final issued PDF for photographed-document damage comparison.';
