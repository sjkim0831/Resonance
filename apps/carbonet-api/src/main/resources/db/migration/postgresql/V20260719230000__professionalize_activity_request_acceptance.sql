ALTER TABLE emission_activity_request
    DROP CONSTRAINT IF EXISTS emission_activity_request_request_status_check;

ALTER TABLE emission_activity_request
    ADD CONSTRAINT emission_activity_request_request_status_check
    CHECK (request_status IN (
        'REQUESTED','IN_PROGRESS','SUBMITTED','CORRECTION_REQUIRED',
        'ACCEPTED','CLOSED','CANCELLED'
    ));

ALTER TABLE emission_activity_request
    ADD COLUMN IF NOT EXISTS last_submission_id bigint REFERENCES emission_activity_submission(submission_id),
    ADD COLUMN IF NOT EXISTS submitted_by varchar(100),
    ADD COLUMN IF NOT EXISTS submitted_at timestamp,
    ADD COLUMN IF NOT EXISTS correction_reason text,
    ADD COLUMN IF NOT EXISTS correction_due_date date,
    ADD COLUMN IF NOT EXISTS correction_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accepted_by varchar(100),
    ADD COLUMN IF NOT EXISTS accepted_at timestamp;

CREATE TABLE IF NOT EXISTS emission_activity_request_event (
    event_id bigserial PRIMARY KEY,
    request_id bigint NOT NULL REFERENCES emission_activity_request(request_id) ON DELETE CASCADE,
    event_code varchar(40) NOT NULL,
    previous_status varchar(30),
    new_status varchar(30) NOT NULL,
    actor_id varchar(100) NOT NULL,
    event_note text,
    submission_id bigint REFERENCES emission_activity_submission(submission_id),
    created_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS ix_emission_activity_request_event_timeline
    ON emission_activity_request_event(request_id, created_at DESC, event_id DESC);

CREATE INDEX IF NOT EXISTS ix_emission_activity_request_acceptance_queue
    ON emission_activity_request(tenant_id, project_id, request_status, due_date);

COMMENT ON TABLE emission_activity_request_event IS
    '활동자료 요청, 착수, 제출, 보완, 재제출, 관리자 접수 이력을 보존하는 업무 감사 이벤트';
