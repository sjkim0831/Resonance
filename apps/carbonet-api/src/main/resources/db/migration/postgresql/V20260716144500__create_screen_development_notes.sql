CREATE TABLE IF NOT EXISTS framework_screen_development_note (
    route_key varchar(500) PRIMARY KEY,
    route_path varchar(1000) NOT NULL,
    page_id varchar(200),
    page_title varchar(500),
    design_note text,
    function_note text,
    acceptance_note text,
    development_status varchar(30) NOT NULL DEFAULT 'DRAFT',
    note_version integer NOT NULL DEFAULT 1,
    updated_by varchar(200) NOT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_screen_development_note_page
    ON framework_screen_development_note(page_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS framework_screen_development_note_history (
    history_id bigserial PRIMARY KEY,
    route_key varchar(500) NOT NULL,
    route_path varchar(1000) NOT NULL,
    page_id varchar(200),
    page_title varchar(500),
    design_note text,
    function_note text,
    acceptance_note text,
    development_status varchar(30) NOT NULL,
    note_version integer NOT NULL,
    changed_by varchar(200) NOT NULL,
    changed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_screen_development_note_history_route
    ON framework_screen_development_note_history(route_key, note_version DESC);

COMMENT ON TABLE framework_screen_development_note IS '화면 URL별 설계·기능·검증 기준의 최신 개발 정본';
COMMENT ON TABLE framework_screen_development_note_history IS '화면 개발 메모의 불변 버전 이력';
