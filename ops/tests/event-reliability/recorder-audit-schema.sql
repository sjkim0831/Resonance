-- Existing recorder contract consolidated. No historical data updates.
CREATE TABLE IF NOT EXISTS process_preview_recording_audit (
 id bigserial PRIMARY KEY,
 event_type varchar(24) NOT NULL, status varchar(24) NOT NULL,
 alert boolean NOT NULL DEFAULT false, reason text, process_code varchar(160),
 consecutive_failures integer NOT NULL DEFAULT 0, duration_ms bigint NOT NULL DEFAULT 0,
 payload jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
 acknowledgement_status varchar(24) NOT NULL DEFAULT 'NOT_REQUIRED',
 acknowledged_at timestamptz, acknowledged_by varchar(100),
 source_code varchar(80) NOT NULL DEFAULT 'PROCESS_PREVIEW_RECORDER',
 severity varchar(16) NOT NULL DEFAULT 'INFO', assigned_actor varchar(80), due_at timestamptz,
 workflow_status varchar(24) NOT NULL DEFAULT 'CLOSED', resolved_at timestamptz,
 resolved_by varchar(100), resolution_note text,
 escalation_level integer NOT NULL DEFAULT 0, escalated_at timestamptz
);
CREATE TABLE IF NOT EXISTS process_preview_recording_audit_transition (
 id bigserial PRIMARY KEY,
 audit_id bigint NOT NULL REFERENCES process_preview_recording_audit(id) ON DELETE CASCADE,
 from_status varchar(24), to_status varchar(24) NOT NULL, actor varchar(100) NOT NULL,
 detail text, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_preview_recording_audit_occurred ON process_preview_recording_audit(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_preview_recording_audit_process ON process_preview_recording_audit(process_code,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_preview_recording_audit_ack ON process_preview_recording_audit(acknowledgement_status,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_preview_recording_audit_source ON process_preview_recording_audit(source_code,occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_preview_recording_open_failure_source ON process_preview_recording_audit(source_code) WHERE event_type='FAILURE' AND status='FAILED_FINAL' AND acknowledgement_status='UNACKNOWLEDGED';
CREATE UNIQUE INDEX IF NOT EXISTS uq_preview_recording_unack_failure_source ON process_preview_recording_audit(source_code) WHERE event_type='FAILURE' AND acknowledgement_status='UNACKNOWLEDGED';
CREATE INDEX IF NOT EXISTS idx_preview_recording_transition_audit ON process_preview_recording_audit_transition(audit_id,occurred_at);
CREATE TABLE IF NOT EXISTS process_preview_runtime_alert_delivery (
 id bigserial PRIMARY KEY,
 audit_id bigint NOT NULL REFERENCES process_preview_recording_audit(id) ON DELETE CASCADE,
 channel varchar(16) NOT NULL, attempt_no integer NOT NULL DEFAULT 1,
 delivery_status varchar(24) NOT NULL, http_status integer, detail varchar(500),
 destination_fingerprint varchar(64), attempted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 next_retry_at timestamptz, delivered_at timestamptz,
 CONSTRAINT uk_runtime_alert_delivery_attempt UNIQUE(audit_id,channel,attempt_no)
);
CREATE INDEX IF NOT EXISTS idx_runtime_alert_delivery_retry ON process_preview_runtime_alert_delivery(delivery_status,next_retry_at);
