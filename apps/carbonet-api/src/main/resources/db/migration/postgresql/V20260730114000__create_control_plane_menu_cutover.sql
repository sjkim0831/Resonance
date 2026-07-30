CREATE TABLE IF NOT EXISTS framework_control_plane_menu_cutover (
    menu_code VARCHAR(20) PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    source_route VARCHAR(1000) NOT NULL,
    previous_menu_use_at VARCHAR(1) NOT NULL,
    previous_detail_use_at VARCHAR(1) NOT NULL,
    cutover_status VARCHAR(30) NOT NULL,
    retired_at TIMESTAMP,
    restored_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_framework_control_plane_menu_cutover_status
    ON framework_control_plane_menu_cutover(cutover_status, project_id);
