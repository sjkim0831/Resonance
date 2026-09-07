SET ROLE p006_app;
CREATE TABLE IF NOT EXISTS dt_telemetry_snapshot (
    snapshot_id BIGSERIAL PRIMARY KEY,
    scenario_id UUID NOT NULL REFERENCES dt_simulation_scenario(scenario_id) ON DELETE CASCADE,
    source_name VARCHAR(120) NOT NULL,
    metrics_json JSONB NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_dt_telemetry_snapshot_scenario_time ON dt_telemetry_snapshot(scenario_id, measured_at DESC);
