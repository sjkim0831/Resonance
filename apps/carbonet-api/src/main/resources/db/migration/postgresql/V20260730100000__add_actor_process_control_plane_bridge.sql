CREATE TABLE IF NOT EXISTS framework_actor_process_design_release (
    project_id varchar(64) NOT NULL,
    design_version integer NOT NULL,
    contract_sha256 char(64) NOT NULL,
    contract_payload jsonb NOT NULL,
    source_system varchar(32) NOT NULL DEFAULT 'BACKSTAGE',
    release_status varchar(32) NOT NULL,
    received_at timestamptz NOT NULL DEFAULT current_timestamp,
    applied_at timestamptz,
    generation_result jsonb,
    PRIMARY KEY (project_id, design_version),
    CONSTRAINT ck_actor_process_design_release_source
        CHECK (source_system = 'BACKSTAGE'),
    CONSTRAINT ck_actor_process_design_release_status
        CHECK (release_status IN ('PROMOTED', 'APPLIED', 'REVIEW_REQUIRED'))
);

CREATE INDEX IF NOT EXISTS idx_actor_process_design_release_latest
    ON framework_actor_process_design_release(project_id, design_version DESC);

COMMENT ON TABLE framework_actor_process_design_release IS
    'Backstage에서 검증·승격된 Actor·Process 설계 계약의 Resonance 실행 사본';
