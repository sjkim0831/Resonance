CREATE TABLE IF NOT EXISTS framework_company_manager_delegation (
    delegation_id varchar(36) PRIMARY KEY,
    tenant_id varchar(64) NOT NULL,
    project_id varchar(64) NOT NULL,
    actor_code varchar(64) NOT NULL DEFAULT 'COMPANY_MANAGER',
    predecessor_account_id varchar(128) NOT NULL,
    successor_account_id varchar(128) NOT NULL,
    delegation_scope varchar(32) NOT NULL DEFAULT 'PROJECT',
    reason_text varchar(1000) NOT NULL,
    delegation_status varchar(24) NOT NULL DEFAULT 'REQUESTED',
    requested_by varchar(128) NOT NULL,
    requested_at timestamp without time zone NOT NULL DEFAULT current_timestamp,
    approved_by varchar(128),
    approved_at timestamp without time zone,
    completed_by varchar(128),
    completed_at timestamp without time zone,
    rejected_by varchar(128),
    rejected_at timestamp without time zone,
    rejection_reason varchar(1000),
    idempotency_key varchar(128) NOT NULL,
    version integer NOT NULL DEFAULT 1,
    created_at timestamp without time zone NOT NULL DEFAULT current_timestamp,
    updated_at timestamp without time zone NOT NULL DEFAULT current_timestamp,
    CONSTRAINT ck_company_manager_delegation_accounts CHECK (lower(predecessor_account_id) <> lower(successor_account_id)),
    CONSTRAINT ck_company_manager_delegation_status CHECK (delegation_status IN ('REQUESTED','APPROVED','COMPLETED','REJECTED','CANCELLED')),
    CONSTRAINT uq_company_manager_delegation_idempotency UNIQUE (tenant_id,idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_manager_delegation_open
    ON framework_company_manager_delegation(tenant_id,project_id,actor_code)
    WHERE delegation_status IN ('REQUESTED','APPROVED');

CREATE INDEX IF NOT EXISTS ix_company_manager_delegation_successor
    ON framework_company_manager_delegation(tenant_id,successor_account_id,delegation_status,requested_at DESC);

COMMENT ON TABLE framework_company_manager_delegation IS '회원사 관리자 위임 요청, 기관 승인, 원자적 업무 인계를 보존하는 실행 원장';
