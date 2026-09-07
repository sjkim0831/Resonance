SET ROLE p006_app;

CREATE TABLE IF NOT EXISTS dt_project_account (
    account_id VARCHAR(64) PRIMARY KEY,
    login_id VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dt_role (
    role_code VARCHAR(64) PRIMARY KEY,
    role_name VARCHAR(120) NOT NULL,
    description VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS dt_permission (
    permission_code VARCHAR(64) PRIMARY KEY,
    permission_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS dt_account_role (
    account_id VARCHAR(64) NOT NULL REFERENCES dt_project_account(account_id) ON DELETE CASCADE,
    role_code VARCHAR(64) NOT NULL REFERENCES dt_role(role_code) ON DELETE CASCADE,
    PRIMARY KEY (account_id, role_code)
);

CREATE TABLE IF NOT EXISTS dt_role_permission (
    role_code VARCHAR(64) NOT NULL REFERENCES dt_role(role_code) ON DELETE CASCADE,
    permission_code VARCHAR(64) NOT NULL REFERENCES dt_permission(permission_code) ON DELETE CASCADE,
    PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS dt_scene (
    scene_id UUID PRIMARY KEY,
    scene_name VARCHAR(200) NOT NULL,
    usd_path VARCHAR(1000) NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dt_scene_object (
    object_id UUID PRIMARY KEY,
    scene_id UUID NOT NULL REFERENCES dt_scene(scene_id) ON DELETE CASCADE,
    asset_code VARCHAR(100) NOT NULL,
    prim_path VARCHAR(1000) NOT NULL,
    transform_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    behavior_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dt_simulation_scenario (
    scenario_id UUID PRIMARY KEY,
    scene_id UUID NOT NULL REFERENCES dt_scene(scene_id) ON DELETE CASCADE,
    scenario_name VARCHAR(200) NOT NULL,
    parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dt_simulation_run (
    run_id UUID PRIMARY KEY,
    scenario_id UUID NOT NULL REFERENCES dt_simulation_scenario(scenario_id) ON DELETE CASCADE,
    run_status VARCHAR(30) NOT NULL,
    input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dt_audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    actor_id VARCHAR(64),
    action_code VARCHAR(100) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_id VARCHAR(100),
    result_code VARCHAR(30) NOT NULL,
    detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO dt_role(role_code, role_name, description) VALUES
('PROJECT_ADMIN','프로젝트 관리자','계정·자산·설계·실행·승인 전체 권한'),
('FACTORY_DESIGNER','공장 설계자','설비 배치·연결·애니메이션 편집'),
('SIMULATION_OPERATOR','시뮬레이션 운영자','시뮬레이션 실행과 결과 조회'),
('REVIEWER','검토자','장면과 결과 검토·승인')
ON CONFLICT (role_code) DO UPDATE SET role_name=EXCLUDED.role_name, description=EXCLUDED.description;

INSERT INTO dt_permission(permission_code, permission_name) VALUES
('ACCOUNT_MANAGE','계정 관리'),('ASSET_MANAGE','자산 관리'),('ASSET_VIEW','자산 조회'),
('SCENE_EDIT','장면 편집'),('SCENE_VIEW','장면 조회'),('ANIMATION_EDIT','애니메이션 편집'),
('SIMULATION_RUN','시뮬레이션 실행'),('RESULT_VIEW','결과 조회'),('RESULT_APPROVE','결과 승인')
ON CONFLICT (permission_code) DO UPDATE SET permission_name=EXCLUDED.permission_name;

INSERT INTO dt_role_permission(role_code, permission_code)
SELECT 'PROJECT_ADMIN', permission_code FROM dt_permission
ON CONFLICT DO NOTHING;

INSERT INTO dt_role_permission(role_code, permission_code) VALUES
('FACTORY_DESIGNER','ASSET_VIEW'),('FACTORY_DESIGNER','SCENE_EDIT'),('FACTORY_DESIGNER','ANIMATION_EDIT'),
('SIMULATION_OPERATOR','SCENE_VIEW'),('SIMULATION_OPERATOR','SIMULATION_RUN'),('SIMULATION_OPERATOR','RESULT_VIEW'),
('REVIEWER','SCENE_VIEW'),('REVIEWER','RESULT_VIEW'),('REVIEWER','RESULT_APPROVE')
ON CONFLICT DO NOTHING;
