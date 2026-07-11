CREATE TABLE IF NOT EXISTS carbonet_customer_trace_approval (
    use_case_id VARCHAR(80) PRIMARY KEY,
    trace_id VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    domain_name VARCHAR(120) NOT NULL,
    approval_state VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reviewer_id VARCHAR(200),
    reviewed_at TIMESTAMPTZ,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_comment TEXT NOT NULL DEFAULT '',
    source_version VARCHAR(100),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_customer_trace_approval_state CHECK (
        approval_state IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'VERIFIED')
    ),
    CONSTRAINT ck_customer_trace_evidence_array CHECK (jsonb_typeof(evidence_refs) = 'array'),
    CONSTRAINT ck_customer_trace_verified_evidence CHECK (
        approval_state <> 'VERIFIED' OR jsonb_array_length(evidence_refs) > 0
    ),
    CONSTRAINT ck_customer_trace_review_identity CHECK (
        approval_state = 'PENDING' OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS carbonet_customer_trace_approval_history (
    history_id BIGSERIAL PRIMARY KEY,
    use_case_id VARCHAR(80) NOT NULL,
    previous_state VARCHAR(30),
    new_state VARCHAR(30) NOT NULL,
    reviewer_id VARCHAR(200),
    reviewed_at TIMESTAMPTZ,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_comment TEXT NOT NULL DEFAULT '',
    row_version BIGINT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_source VARCHAR(40) NOT NULL DEFAULT 'APPLICATION'
);

CREATE INDEX IF NOT EXISTS idx_customer_trace_approval_state
    ON carbonet_customer_trace_approval (approval_state, domain_name, use_case_id);
CREATE INDEX IF NOT EXISTS idx_customer_trace_approval_reviewed
    ON carbonet_customer_trace_approval (reviewed_at DESC) WHERE reviewed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_trace_history_use_case
    ON carbonet_customer_trace_approval_history (use_case_id, history_id DESC);

CREATE OR REPLACE FUNCTION carbonet_record_customer_trace_approval_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    IF TG_OP = 'UPDATE' THEN
        NEW.row_version := OLD.row_version + 1;
    END IF;
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

DROP TRIGGER IF EXISTS trg_customer_trace_approval_history ON carbonet_customer_trace_approval;
CREATE TRIGGER trg_customer_trace_approval_history
BEFORE INSERT OR UPDATE ON carbonet_customer_trace_approval
FOR EACH ROW EXECUTE FUNCTION carbonet_record_customer_trace_approval_history();

COMMENT ON TABLE carbonet_customer_trace_approval IS
    'Human-reviewed approval state for the canonical Customer Trace use-case ledger.';
COMMENT ON TABLE carbonet_customer_trace_approval_history IS
    'Append-only audit history for Customer Trace approval, evidence, and review changes.';
