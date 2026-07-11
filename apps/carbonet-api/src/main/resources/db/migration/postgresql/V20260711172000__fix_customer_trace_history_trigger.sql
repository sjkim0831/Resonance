DROP TRIGGER IF EXISTS trg_customer_trace_approval_history ON carbonet_customer_trace_approval;

CREATE OR REPLACE FUNCTION carbonet_record_customer_trace_approval_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR OLD.approval_state IS DISTINCT FROM NEW.approval_state
       OR OLD.evidence_refs IS DISTINCT FROM NEW.evidence_refs
       OR OLD.review_comment IS DISTINCT FROM NEW.review_comment THEN
        INSERT INTO carbonet_customer_trace_approval_history (
            use_case_id, previous_state, new_state, reviewer_id, reviewed_at,
            evidence_refs, review_comment, row_version, change_source
        ) VALUES (
            NEW.use_case_id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.approval_state END,
            NEW.approval_state, NEW.reviewer_id, NEW.reviewed_at,
            NEW.evidence_refs, NEW.review_comment, NEW.row_version,
            CASE WHEN TG_OP = 'INSERT' THEN 'BASELINE_IMPORT' ELSE 'APPLICATION' END
        );
    END IF;
    RETURN NEW;
END;
$$;

WITH ranked_baselines AS (
    SELECT history_id,
           row_number() OVER (PARTITION BY use_case_id ORDER BY history_id) AS occurrence
    FROM carbonet_customer_trace_approval_history
    WHERE change_source = 'BASELINE_IMPORT'
      AND previous_state IS NULL
)
DELETE FROM carbonet_customer_trace_approval_history history
USING ranked_baselines duplicate
WHERE history.history_id = duplicate.history_id
  AND duplicate.occurrence > 1;

CREATE TRIGGER trg_customer_trace_approval_history
AFTER INSERT OR UPDATE ON carbonet_customer_trace_approval
FOR EACH ROW EXECUTE FUNCTION carbonet_record_customer_trace_approval_history();

CREATE OR REPLACE FUNCTION carbonet_touch_customer_trace_approval()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    NEW.row_version := OLD.row_version + 1;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_trace_approval_touch ON carbonet_customer_trace_approval;
CREATE TRIGGER trg_customer_trace_approval_touch
BEFORE UPDATE ON carbonet_customer_trace_approval
FOR EACH ROW EXECUTE FUNCTION carbonet_touch_customer_trace_approval();
