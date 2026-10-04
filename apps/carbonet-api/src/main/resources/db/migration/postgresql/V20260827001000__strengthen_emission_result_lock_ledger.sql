ALTER TABLE emission_result_lock
    ADD COLUMN IF NOT EXISTS calculation_version integer,
    ADD COLUMN IF NOT EXISTS total_emission numeric(24,8),
    ADD COLUMN IF NOT EXISTS result_unit varchar(30),
    ADD COLUMN IF NOT EXISTS input_snapshot_hash varchar(64),
    ADD COLUMN IF NOT EXISTS lock_hash varchar(64),
    ADD COLUMN IF NOT EXISTS lock_payload jsonb;

ALTER TABLE emission_result_lock
    DROP CONSTRAINT IF EXISTS ck_emission_result_lock_hash;

ALTER TABLE emission_result_lock
    ADD CONSTRAINT ck_emission_result_lock_hash
    CHECK (lock_hash IS NULL OR lock_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS idx_emission_result_lock_project_audit
    ON emission_result_lock (tenant_id, project_id, locked_at DESC);
