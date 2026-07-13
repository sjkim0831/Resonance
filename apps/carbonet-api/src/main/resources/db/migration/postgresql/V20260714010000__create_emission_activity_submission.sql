CREATE TABLE IF NOT EXISTS emission_activity_submission (
    submission_id bigserial PRIMARY KEY,
    project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE RESTRICT,
    tenant_id varchar(40) NOT NULL DEFAULT 'TENANT-001',
    site_name varchar(160) NOT NULL,
    version_no integer NOT NULL DEFAULT 1,
    submission_state varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (submission_state IN ('DRAFT','SUBMITTED','ACCEPTED','REJECTED')),
    idempotency_key varchar(80) NOT NULL,
    deadline_date date,
    submitted_actor varchar(100),
    submitted_at timestamp,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    UNIQUE(project_id, idempotency_key),
    UNIQUE(project_id, version_no)
);

CREATE TABLE IF NOT EXISTS emission_activity_submission_event (
    event_id bigserial PRIMARY KEY,
    submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id) ON DELETE CASCADE,
    event_type varchar(30) NOT NULL CHECK (event_type IN ('CREATED','SUBMITTED','ACCEPTED','REJECTED','CORRECTION_REQUESTED')),
    event_actor varchar(100) NOT NULL,
    event_time timestamp NOT NULL DEFAULT current_timestamp,
    event_note varchar(500),
    previous_state varchar(30),
    new_state varchar(30)
);

CREATE TABLE IF NOT EXISTS emission_activity_submission_evidence (
    evidence_id bigserial PRIMARY KEY,
    submission_id bigint NOT NULL REFERENCES emission_activity_submission(submission_id) ON DELETE CASCADE,
    activity_id bigint NOT NULL REFERENCES emission_activity_data(activity_id) ON DELETE RESTRICT,
    evidence_type varchar(40) NOT NULL,
    evidence_path varchar(500),
    evidence_name varchar(200),
    uploaded_actor varchar(100),
    uploaded_at timestamp NOT NULL DEFAULT current_timestamp,
    UNIQUE(submission_id, activity_id, evidence_type)
);

CREATE INDEX IF NOT EXISTS idx_submission_project ON emission_activity_submission(project_id);
CREATE INDEX IF NOT EXISTS idx_submission_site ON emission_activity_submission(site_name);
CREATE INDEX IF NOT EXISTS idx_submission_state ON emission_activity_submission(submission_state);
CREATE INDEX IF NOT EXISTS idx_submission_deadline ON emission_activity_submission(deadline_date);
CREATE INDEX IF NOT EXISTS idx_submission_idempotency ON emission_activity_submission(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_event_submission ON emission_activity_submission_event(submission_id);
CREATE INDEX IF NOT EXISTS idx_event_time ON emission_activity_submission_event(event_time);
CREATE INDEX IF NOT EXISTS idx_evidence_submission ON emission_activity_submission_evidence(submission_id);
CREATE INDEX IF NOT EXISTS idx_evidence_activity ON emission_activity_submission_evidence(activity_id);

COMMENT ON TABLE emission_activity_submission IS 'Activity-data submission header with tenant/project/site/version/state/idempotency key/deadline/actor-time';
COMMENT ON TABLE emission_activity_submission_event IS 'Immutable submission event history';
COMMENT ON TABLE emission_activity_submission_evidence IS 'Evidence reference metadata for submission activities';