CREATE TABLE IF NOT EXISTS emission_reduction_scenario (
    scenario_id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL,
    project_id VARCHAR(50) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
    scenario_code VARCHAR(30) NOT NULL CHECK (scenario_code IN ('BALANCED','ACCELERATED')),
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    tech_investment INTEGER NOT NULL CHECK (tech_investment BETWEEN 0 AND 100),
    efficiency_gain INTEGER NOT NULL CHECK (efficiency_gain BETWEEN 0 AND 100),
    renewable_rate INTEGER NOT NULL CHECK (renewable_rate BETWEEN 0 AND 100),
    ccus_scale INTEGER NOT NULL CHECK (ccus_scale BETWEEN 0 AND 100),
    projected_reduction NUMERIC(18,3) NOT NULL CHECK (projected_reduction >= 0),
    result_unit VARCHAR(20) NOT NULL DEFAULT 'tCO2e',
    input_hash VARCHAR(64) NOT NULL CHECK (length(input_hash)=64),
    idempotency_key VARCHAR(100) NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id,project_id,version_no),
    UNIQUE (tenant_id,project_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_emission_reduction_scenario_project ON emission_reduction_scenario(tenant_id,project_id,created_at DESC);
