CREATE TABLE IF NOT EXISTS framework_screen_development_gate_run (
    gate_run_id bigserial PRIMARY KEY,
    process_code varchar(100) NOT NULL,
    step_code varchar(100) NOT NULL,
    route_path varchar(1000) NOT NULL,
    page_id varchar(200),
    gate_status varchar(20) NOT NULL,
    readiness_score integer NOT NULL CHECK (readiness_score BETWEEN 0 AND 100),
    design_note_passed boolean NOT NULL,
    selected_mockup_passed boolean NOT NULL,
    actor_contract_passed boolean NOT NULL,
    safety_tests_passed boolean NOT NULL,
    design_asset_checked boolean NOT NULL,
    check_result_json text NOT NULL DEFAULT '{}',
    failure_summary text,
    executed_by varchar(200) NOT NULL,
    executed_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT ck_screen_development_gate_status CHECK (gate_status IN ('PASSED','FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_screen_development_gate_route
    ON framework_screen_development_gate_run(route_path, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_screen_development_gate_process
    ON framework_screen_development_gate_run(process_code, step_code, executed_at DESC);

COMMENT ON TABLE framework_screen_development_gate_run IS '화면 자동개발 승인 전 설계·HTML 시안·액터·5대 안전 테스트 사전검사 이력';
