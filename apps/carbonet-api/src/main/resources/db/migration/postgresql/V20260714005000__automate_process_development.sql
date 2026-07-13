ALTER TABLE framework_process_definition
 ADD COLUMN IF NOT EXISTS parent_process_code varchar(80),
 ADD COLUMN IF NOT EXISTS process_level integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS automation_mode varchar(30) NOT NULL DEFAULT 'ASSISTED';

ALTER TABLE framework_process_step
 ADD COLUMN IF NOT EXISTS parent_step_code varchar(80),
 ADD COLUMN IF NOT EXISTS step_type varchar(30) NOT NULL DEFAULT 'TASK',
 ADD COLUMN IF NOT EXISTS requirement_text text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS input_contract text NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS output_contract text NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS requires_user_page boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS requires_admin_page boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS requires_api boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS requires_database boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS requires_notification boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS automation_status varchar(30) NOT NULL DEFAULT 'NOT_ANALYZED';

CREATE TABLE IF NOT EXISTS framework_development_job (
 job_id bigserial PRIMARY KEY,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 step_code varchar(80),
 job_type varchar(30) NOT NULL,
 job_name varchar(200) NOT NULL,
 target_path varchar(400),
 specification_json text NOT NULL DEFAULT '{}',
 dependency_job_ids text NOT NULL DEFAULT '',
 job_status varchar(30) NOT NULL DEFAULT 'PLANNED',
 approval_status varchar(30) NOT NULL DEFAULT 'DRAFT',
 execution_log text,
 evidence_ref varchar(500),
 created_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(process_code,step_code,job_type,target_path),
 FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_development_job_queue
 ON framework_development_job(process_code,job_status,job_type);

COMMENT ON TABLE framework_development_job IS '프로세스 정의에서 자동 도출된 DB·API·백엔드·프론트·테스트 개발 작업';
COMMENT ON COLUMN framework_process_step.parent_step_code IS '서브 절차의 상위 단계 코드';
COMMENT ON COLUMN framework_process_step.automation_status IS 'NOT_ANALYZED, PLANNED, APPROVED, GENERATED, VERIFIED';
