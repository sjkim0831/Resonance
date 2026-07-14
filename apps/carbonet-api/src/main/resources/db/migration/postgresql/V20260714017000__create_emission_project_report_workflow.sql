CREATE TABLE IF NOT EXISTS emission_project_report (
    report_id bigserial PRIMARY KEY,
    tenant_id varchar(100) NOT NULL,
    project_id varchar(100) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
    submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id),
    calculation_id bigint NOT NULL REFERENCES emission_calculation_run(calculation_id),
    version_no integer NOT NULL,
    report_title varchar(300) NOT NULL,
    report_language varchar(5) NOT NULL DEFAULT 'ko',
    report_status varchar(30) NOT NULL DEFAULT 'DRAFT',
    summary_text text,
    created_by varchar(100) NOT NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalized_by varchar(100),
    finalized_at timestamp,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, project_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_emission_project_report_project ON emission_project_report(tenant_id,project_id,created_at DESC);
