CREATE TABLE IF NOT EXISTS framework_screen_space_spec (
    coordinate_key varchar(1200) PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    route_path varchar(1000) NOT NULL,
    process_code varchar(160) NOT NULL,
    step_code varchar(160) NOT NULL,
    actor_code varchar(160) NOT NULL,
    state_code varchar(80) NOT NULL,
    archetype_code varchar(80) NOT NULL,
    screen_spec jsonb NOT NULL,
    specification_hash varchar(64) NOT NULL,
    validation_status varchar(40) NOT NULL,
    source_system varchar(80) NOT NULL DEFAULT 'BACKSTAGE',
    source_actor varchar(200) NOT NULL,
    published_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS framework_screen_space_spec_route_idx
    ON framework_screen_space_spec (lower(split_part(route_path, '?', 1)), updated_at DESC);

CREATE INDEX IF NOT EXISTS framework_screen_space_spec_process_idx
    ON framework_screen_space_spec (project_id, process_code, step_code, updated_at DESC);

COMMENT ON TABLE framework_screen_space_spec IS
    'Backstage에서 검증되어 Resonance 런타임으로 게시된 화면 공간 명세 원장';
