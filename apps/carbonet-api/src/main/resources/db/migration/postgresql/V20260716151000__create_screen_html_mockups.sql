CREATE TABLE IF NOT EXISTS framework_screen_html_mockup (
    mockup_id bigserial PRIMARY KEY,
    route_key varchar(500) NOT NULL,
    route_path varchar(1000) NOT NULL,
    page_id varchar(200),
    slot_no smallint NOT NULL CHECK (slot_no BETWEEN 1 AND 5),
    mockup_title varchar(500) NOT NULL,
    prompt_text text NOT NULL,
    html_content text NOT NULL,
    mockup_status varchar(30) NOT NULL DEFAULT 'DRAFT',
    selected boolean NOT NULL DEFAULT false,
    mockup_version integer NOT NULL DEFAULT 1,
    updated_by varchar(200) NOT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT uk_screen_html_mockup_slot UNIQUE (route_key, slot_no),
    CONSTRAINT ck_screen_html_mockup_status CHECK (mockup_status IN ('DRAFT','SELECTED','APPLY_REQUESTED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_screen_html_mockup_selected
    ON framework_screen_html_mockup(route_key) WHERE selected = true;

CREATE INDEX IF NOT EXISTS idx_screen_html_mockup_page
    ON framework_screen_html_mockup(page_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS framework_screen_html_mockup_history (
    history_id bigserial PRIMARY KEY,
    mockup_id bigint NOT NULL,
    route_key varchar(500) NOT NULL,
    route_path varchar(1000) NOT NULL,
    page_id varchar(200),
    slot_no smallint NOT NULL,
    mockup_title varchar(500) NOT NULL,
    prompt_text text NOT NULL,
    html_content text NOT NULL,
    mockup_status varchar(30) NOT NULL,
    selected boolean NOT NULL,
    mockup_version integer NOT NULL,
    changed_by varchar(200) NOT NULL,
    changed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_screen_html_mockup_history
    ON framework_screen_html_mockup_history(route_key, slot_no, mockup_version DESC);

COMMENT ON TABLE framework_screen_html_mockup IS '화면 URL별 프롬프트 기반 HTML 시안(최대 5개) 최신본';
COMMENT ON TABLE framework_screen_html_mockup_history IS 'HTML 시안 변경 및 선택 이력';
