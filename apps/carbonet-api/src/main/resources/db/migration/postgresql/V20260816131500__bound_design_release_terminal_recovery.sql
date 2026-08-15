ALTER TABLE framework_actor_process_design_release
    ADD COLUMN IF NOT EXISTS generation_retry_attempt smallint
    GENERATED ALWAYS AS (
        CASE
            WHEN coalesce(generation_result->>'retryAttempt', '0') ~ '^[0-9]{1,2}$'
                THEN (coalesce(generation_result->>'retryAttempt', '0'))::smallint
            ELSE 32767::smallint
        END
    ) STORED;

ALTER TABLE framework_actor_process_design_release
    ADD COLUMN IF NOT EXISTS generation_retry_not_before_epoch bigint
    GENERATED ALWAYS AS (
        CASE
            WHEN coalesce(generation_result->>'retryNotBeforeEpoch', '0') ~ '^[0-9]{1,12}$'
                THEN (coalesce(generation_result->>'retryNotBeforeEpoch', '0'))::bigint
            ELSE 9223372036854775807::bigint
        END
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_actor_process_design_release_terminal_due
    ON framework_actor_process_design_release(
        generation_retry_not_before_epoch,
        project_id,
        design_version
    )
    WHERE release_status IN ('FAILED', 'REVIEW_REQUIRED')
      AND generation_retry_attempt < 3;

COMMENT ON COLUMN framework_actor_process_design_release.generation_retry_attempt IS
    'Indexed scalar projection of the immutable generation receipt retry attempt; invalid or exhausted receipts cannot enter the due-recovery index.';

COMMENT ON INDEX idx_actor_process_design_release_terminal_due IS
    'Bounds terminal self-healing to due FAILED or REVIEW_REQUIRED rows with retry attempt below 3. Verify with EXPLAIN (ANALYZE, BUFFERS) on the terminal branch ordered by generation_retry_not_before_epoch LIMIT 10; the expected plan is an Index Scan on this partial index and exhausted receipts have zero index entries.';
