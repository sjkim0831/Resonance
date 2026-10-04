ALTER TABLE emission_project_report
    ADD COLUMN IF NOT EXISTS result_lock_id bigint REFERENCES emission_result_lock(result_lock_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS result_lock_hash varchar(64);

ALTER TABLE emission_project_report
    DROP CONSTRAINT IF EXISTS ck_emission_report_result_lock_hash;
ALTER TABLE emission_project_report
    ADD CONSTRAINT ck_emission_report_result_lock_hash
    CHECK (result_lock_hash IS NULL OR result_lock_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS idx_emission_project_report_result_lock
    ON emission_project_report(result_lock_id);
