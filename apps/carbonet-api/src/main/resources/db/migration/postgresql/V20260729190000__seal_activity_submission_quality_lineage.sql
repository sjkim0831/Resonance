-- Restore the quality-run lineage for legacy submitted activity-data versions
-- and make an incomplete submitted snapshot impossible at the database boundary.
UPDATE emission_activity_submission submission
SET quality_run_id = (
    SELECT quality.run_id
    FROM emission_activity_quality_run quality
    WHERE quality.tenant_id = submission.tenant_id
      AND quality.project_id = submission.project_id
      AND quality.submit_ready
      AND quality.total_count = submission.submitted_item_count
    ORDER BY quality.executed_at DESC, quality.run_id DESC
    LIMIT 1
)
WHERE submission.submission_state <> 'DRAFT'
  AND submission.quality_run_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM emission_activity_quality_run quality
      WHERE quality.tenant_id = submission.tenant_id
        AND quality.project_id = submission.project_id
        AND quality.submit_ready
        AND quality.total_count = submission.submitted_item_count
  );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM emission_activity_submission
        WHERE submission_state <> 'DRAFT'
          AND (
              quality_run_id IS NULL
              OR submitted_item_count <= 0
              OR snapshot_hash IS NULL
          )
    ) THEN
        RAISE EXCEPTION 'Unsealed activity-data submissions remain after quality-lineage repair';
    END IF;
END
$$;

ALTER TABLE emission_activity_submission
    DROP CONSTRAINT IF EXISTS emission_activity_submission_sealed_check;

ALTER TABLE emission_activity_submission
    ADD CONSTRAINT emission_activity_submission_sealed_check
    CHECK (
        submission_state = 'DRAFT'
        OR (
            quality_run_id IS NOT NULL
            AND submitted_item_count > 0
            AND snapshot_hash IS NOT NULL
        )
    );
