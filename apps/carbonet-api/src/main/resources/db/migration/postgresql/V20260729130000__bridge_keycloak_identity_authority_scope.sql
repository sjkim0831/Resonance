CREATE TABLE IF NOT EXISTS framework_identity_group_role_policy (
    group_name varchar(120) PRIMARY KEY,
    author_code varchar(120) NOT NULL REFERENCES comtnauthorinfo(author_code),
    role_priority integer NOT NULL DEFAULT 100,
    active_yn char(1) NOT NULL DEFAULT 'Y' CHECK (active_yn IN ('Y', 'N')),
    updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_identity_group_actor_policy (
    group_name varchar(120) NOT NULL,
    actor_code varchar(120) NOT NULL REFERENCES framework_actor_definition(actor_code),
    tenant_id varchar(80) NOT NULL DEFAULT 'DEFAULT',
    project_scope varchar(80) NOT NULL DEFAULT '*',
    data_scope varchar(200) NOT NULL DEFAULT '*',
    active_yn char(1) NOT NULL DEFAULT 'Y' CHECK (active_yn IN ('Y', 'N')),
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (group_name, actor_code)
);

CREATE TABLE IF NOT EXISTS framework_identity_actor_assignment_link (
    account_id varchar(100) NOT NULL,
    group_name varchar(120) NOT NULL,
    actor_code varchar(120) NOT NULL,
    assignment_id bigint NOT NULL REFERENCES framework_account_actor_assignment(assignment_id),
    active_yn char(1) NOT NULL DEFAULT 'Y' CHECK (active_yn IN ('Y', 'N')),
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (account_id, group_name, actor_code)
);

CREATE TABLE IF NOT EXISTS framework_identity_sync_audit (
    sync_id bigserial PRIMARY KEY,
    account_id varchar(100) NOT NULL,
    identity_provider varchar(40) NOT NULL DEFAULT 'KEYCLOAK',
    identity_subject varchar(100) NOT NULL,
    enabled_yn char(1) NOT NULL CHECK (enabled_yn IN ('Y', 'N')),
    author_code varchar(120),
    group_names jsonb NOT NULL DEFAULT '[]'::jsonb,
    actor_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
    result_code varchar(40) NOT NULL,
    detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_identity_sync_audit_account_time
    ON framework_identity_sync_audit(account_id, synced_at DESC);

INSERT INTO framework_identity_group_role_policy(
    group_name, author_code, role_priority, active_yn, updated_at
) VALUES
    ('platform-engineering', 'ROLE_SYSTEM_ADMIN', 100, 'Y', current_timestamp),
    ('carbon-operations', 'ROLE_OPERATION_ADMIN', 200, 'Y', current_timestamp),
    ('verification-governance', 'ROLE_SYSTEM_MASTER', 300, 'Y', current_timestamp)
ON CONFLICT (group_name) DO UPDATE SET
    author_code = excluded.author_code,
    role_priority = excluded.role_priority,
    active_yn = excluded.active_yn,
    updated_at = current_timestamp;

INSERT INTO framework_identity_group_actor_policy(
    group_name, actor_code, tenant_id, project_scope, data_scope, active_yn, updated_at
) VALUES
    ('platform-engineering', 'PLATFORM_OPERATOR', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('platform-engineering', 'SYSTEM_INTEGRATOR', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('carbon-operations', 'COMPANY_MANAGER', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('carbon-operations', 'SITE_DATA_OWNER', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('carbon-operations', 'CALCULATOR', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('carbon-operations', 'LCA_PRACTITIONER', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('verification-governance', 'VERIFIER', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('verification-governance', 'APPROVER', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('verification-governance', 'AUDITOR', 'DEFAULT', '*', '*', 'Y', current_timestamp),
    ('verification-governance', 'AUTHORITY_ADMIN', 'DEFAULT', '*', '*', 'Y', current_timestamp)
ON CONFLICT (group_name, actor_code) DO UPDATE SET
    tenant_id = excluded.tenant_id,
    project_scope = excluded.project_scope,
    data_scope = excluded.data_scope,
    active_yn = excluded.active_yn,
    updated_at = current_timestamp;

COMMENT ON TABLE framework_identity_group_role_policy IS
    'Keycloak 그룹을 Carbonet 메뉴·기능 기준 권한으로 변환하는 DB 관리 정책';
COMMENT ON TABLE framework_identity_group_actor_policy IS
    'Keycloak 그룹을 액터와 기본 테넌트·프로젝트·데이터 범위로 변환하는 DB 관리 정책';
COMMENT ON TABLE framework_identity_actor_assignment_link IS
    '통합계정 동기화가 생성한 액터 배정을 추적하여 안전하게 회수하기 위한 연결 정보';
COMMENT ON TABLE framework_identity_sync_audit IS
    '통합계정에서 Carbonet 권한·액터 범위로 반영한 append-only 감사 이력';
