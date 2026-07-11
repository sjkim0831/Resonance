CREATE INDEX IF NOT EXISTS idx_access_event_created_at_desc
    ON access_event (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trace_event_created_at_desc
    ON trace_event (created_at DESC);
