ALTER TABLE framework_actor_process_design_release
    DROP CONSTRAINT IF EXISTS ck_actor_process_design_release_status;

ALTER TABLE framework_actor_process_design_release
    ADD CONSTRAINT ck_actor_process_design_release_status
    CHECK (
        release_status IN (
            'PROMOTED',
            'QUEUED',
            'RUNNING',
            'APPLIED',
            'REVIEW_REQUIRED',
            'FAILED'
        )
    );

CREATE INDEX IF NOT EXISTS idx_actor_process_design_release_recovery
    ON framework_actor_process_design_release(release_status, received_at)
    WHERE release_status IN ('QUEUED', 'RUNNING');
