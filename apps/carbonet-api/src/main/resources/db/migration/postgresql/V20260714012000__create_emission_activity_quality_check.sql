CREATE TABLE IF NOT EXISTS emission_activity_quality_run (
    run_id bigserial PRIMARY KEY,
    tenant_id varchar(40) NOT NULL,
    project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE RESTRICT,
    executed_actor varchar(100) NOT NULL,
    total_count integer NOT NULL DEFAULT 0,
    blocking_count integer NOT NULL DEFAULT 0,
    warning_count integer NOT NULL DEFAULT 0,
    quality_score integer NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
    submit_ready boolean NOT NULL DEFAULT false,
    executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS emission_activity_quality_issue (
    issue_id bigserial PRIMARY KEY,
    run_id bigint NOT NULL REFERENCES emission_activity_quality_run(run_id) ON DELETE CASCADE,
    activity_id bigint REFERENCES emission_activity_data(activity_id) ON DELETE SET NULL,
    rule_code varchar(50) NOT NULL,
    severity varchar(10) NOT NULL CHECK (severity IN ('BLOCKING','WARNING')),
    field_name varchar(40),
    issue_message varchar(500) NOT NULL,
    remediation_message varchar(500) NOT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS ix_emission_quality_run_scope
 ON emission_activity_quality_run(tenant_id,project_id,executed_at DESC);
CREATE INDEX IF NOT EXISTS ix_emission_quality_issue_run
 ON emission_activity_quality_issue(run_id,severity,activity_id);

COMMENT ON TABLE emission_activity_quality_run IS 'Tenant-scoped immutable activity-data quality check execution';
COMMENT ON TABLE emission_activity_quality_issue IS 'Blocking and warning issues produced by an activity-data quality run';
