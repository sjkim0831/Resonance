CREATE TABLE IF NOT EXISTS framework_project_process_step_assignment (
    tenant_id varchar(100) NOT NULL,
    project_id varchar(100) NOT NULL,
    process_code varchar(150) NOT NULL,
    step_code varchar(150) NOT NULL,
    actor_code varchar(100) NOT NULL,
    account_id varchar(100) NOT NULL,
    assigned_by varchar(100) NOT NULL,
    assigned_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (tenant_id, project_id, process_code, step_code)
);

CREATE INDEX IF NOT EXISTS idx_project_process_step_assignment_account
    ON framework_project_process_step_assignment (tenant_id, account_id, project_id);

INSERT INTO framework_project_process_step_assignment(
    tenant_id, project_id, process_code, step_code, actor_code, account_id, assigned_by
)
SELECT p.tenant_id, t.project_id, t.process_code, t.process_step_code,
       coalesce(nullif(t.actor_code, ''), s.actor_code), t.assignee_id, 'SYSTEM_BACKFILL'
FROM emission_project_task t
JOIN emission_project_registry p ON p.project_id = t.project_id
JOIN framework_process_step s ON s.process_code = t.process_code AND s.step_code = t.process_step_code
WHERE nullif(trim(t.assignee_id), '') IS NOT NULL
ON CONFLICT (tenant_id, project_id, process_code, step_code) DO UPDATE
SET actor_code = excluded.actor_code,
    account_id = excluded.account_id,
    updated_at = current_timestamp;

COMMENT ON TABLE framework_project_process_step_assignment IS
    '프로젝트별 프로세스 책임자와 세부 절차 담당 계정의 공통 배정 원장';
