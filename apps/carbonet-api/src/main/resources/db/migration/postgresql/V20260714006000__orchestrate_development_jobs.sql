ALTER TABLE framework_development_job
 ADD COLUMN IF NOT EXISTS worker_id varchar(120),
 ADD COLUMN IF NOT EXISTS lease_token varchar(80),
 ADD COLUMN IF NOT EXISTS lease_until timestamp,
 ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS started_at timestamp,
 ADD COLUMN IF NOT EXISTS completed_at timestamp,
 ADD COLUMN IF NOT EXISTS result_json text NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS rollback_ref varchar(500),
 ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE IF NOT EXISTS framework_development_job_event (
 event_id bigserial PRIMARY KEY,
 job_id bigint NOT NULL REFERENCES framework_development_job(job_id) ON DELETE CASCADE,
 event_type varchar(30) NOT NULL,
 from_status varchar(30),
 to_status varchar(30) NOT NULL,
 worker_id varchar(120),
 detail_json text NOT NULL DEFAULT '{}',
 created_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_development_job_claim
 ON framework_development_job(approval_status,job_status,lease_until,job_id);
CREATE INDEX IF NOT EXISTS idx_development_job_event_job
 ON framework_development_job_event(job_id,event_id DESC);

COMMENT ON COLUMN framework_development_job.lease_token IS '중복 실행을 막는 단기 실행 임대 토큰';
COMMENT ON COLUMN framework_development_job.rollback_ref IS '실패 시 복구할 Git commit, DB backup 또는 배포 revision';
