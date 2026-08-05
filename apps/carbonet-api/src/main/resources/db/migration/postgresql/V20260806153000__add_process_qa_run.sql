CREATE TABLE IF NOT EXISTS framework_process_qa_run (
    qa_run_id BIGSERIAL PRIMARY KEY,
    process_code VARCHAR(120) NOT NULL REFERENCES framework_process_definition(process_code),
    step_code VARCHAR(120) NOT NULL DEFAULT '',
    result VARCHAR(20) NOT NULL CHECK (result IN ('PASSED','FAILED')),
    failure_reason TEXT,
    evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_by VARCHAR(200) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_framework_process_qa_run_lookup
    ON framework_process_qa_run(process_code, executed_at DESC);
