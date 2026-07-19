CREATE TABLE IF NOT EXISTS emission_workflow_notification (
    notification_id bigserial PRIMARY KEY,
    tenant_id varchar(100) NOT NULL,
    project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
    task_id bigint REFERENCES emission_project_task(task_id) ON DELETE CASCADE,
    event_type varchar(30) NOT NULL,
    recipient_id varchar(100) NOT NULL,
    actor_code varchar(60),
    title varchar(200) NOT NULL,
    message_text varchar(1000) NOT NULL,
    target_url varchar(300),
    read_at timestamp,
    created_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS ix_emission_workflow_notification_inbox
    ON emission_workflow_notification(tenant_id, lower(recipient_id), read_at, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_emission_workflow_notification_unread_handoff
    ON emission_workflow_notification(project_id, task_id, lower(recipient_id), event_type)
    WHERE read_at IS NULL AND event_type IN ('HANDOFF', 'CORRECTION');

COMMENT ON TABLE emission_workflow_notification IS
    '배출량 프로젝트 업무 완료 후 다음 액터 인계와 보완 요청을 영속적으로 전달하는 알림함';
