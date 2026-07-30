CREATE TABLE IF NOT EXISTS framework_development_rollback_request (
 rollback_request_id bigserial PRIMARY KEY,
 source_job_id bigint NOT NULL REFERENCES framework_development_job(job_id) ON DELETE RESTRICT,
 rollback_job_id bigint REFERENCES framework_development_job(job_id) ON DELETE SET NULL,
 rollback_ref varchar(500) NOT NULL,
 request_reason text NOT NULL,
 request_status varchar(30) NOT NULL DEFAULT 'PENDING',
 preflight_status varchar(30) NOT NULL DEFAULT 'PENDING',
 preflight_summary text,
 requested_by varchar(100) NOT NULL,
 requested_at timestamp NOT NULL DEFAULT current_timestamp,
 approved_by varchar(100),
 approved_at timestamp,
 completed_at timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 CONSTRAINT chk_development_rollback_request_status
   CHECK (request_status IN ('PENDING','APPROVED','REJECTED','QUEUED','COMPLETED','FAILED')),
 CONSTRAINT chk_development_rollback_preflight_status
   CHECK (preflight_status IN ('PENDING','PASSED','FAILED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_development_rollback_active_source
 ON framework_development_rollback_request(source_job_id)
 WHERE request_status IN ('PENDING','APPROVED','QUEUED');

CREATE INDEX IF NOT EXISTS idx_development_rollback_status
 ON framework_development_rollback_request(request_status,requested_at DESC);

COMMENT ON TABLE framework_development_rollback_request IS
 '검증된 개발 작업의 승인 기반 안전 롤백 요청과 실행 증적';
COMMENT ON COLUMN framework_development_rollback_request.rollback_ref IS
 '실행기가 검증할 불변 Git commit, DB backup 또는 배포 revision';
