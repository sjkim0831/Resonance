ALTER TABLE framework_development_job
 ADD COLUMN IF NOT EXISTS execution_mode varchar(20) NOT NULL DEFAULT 'SEQUENTIAL',
 ADD COLUMN IF NOT EXISTS job_group_code varchar(120),
 ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS progress_weight numeric(7,2) NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
 ADD COLUMN IF NOT EXISTS quality_status varchar(20) NOT NULL DEFAULT 'PENDING',
 ADD COLUMN IF NOT EXISTS quality_report text NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS search_context_ref varchar(500);

ALTER TABLE framework_development_job
 DROP CONSTRAINT IF EXISTS ck_framework_development_job_execution_mode;
ALTER TABLE framework_development_job
 ADD CONSTRAINT ck_framework_development_job_execution_mode
 CHECK (execution_mode IN ('SEQUENTIAL','PARALLEL','JOIN'));

ALTER TABLE framework_development_job
 DROP CONSTRAINT IF EXISTS ck_framework_development_job_weight;
ALTER TABLE framework_development_job
 ADD CONSTRAINT ck_framework_development_job_weight
 CHECK (progress_weight > 0 AND max_attempts > 0);

CREATE TABLE IF NOT EXISTS framework_development_job_dependency (
 job_id bigint NOT NULL REFERENCES framework_development_job(job_id) ON DELETE CASCADE,
 depends_on_job_id bigint NOT NULL REFERENCES framework_development_job(job_id) ON DELETE CASCADE,
 dependency_type varchar(20) NOT NULL DEFAULT 'REQUIRED',
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 PRIMARY KEY(job_id,depends_on_job_id),
 CHECK (job_id <> depends_on_job_id),
 CHECK (dependency_type IN ('REQUIRED','OPTIONAL'))
);

CREATE TABLE IF NOT EXISTS framework_quality_gate (
 gate_code varchar(80) PRIMARY KEY,
 gate_name varchar(160) NOT NULL,
 gate_group varchar(40) NOT NULL,
 verification_command text NOT NULL,
 failure_pattern text,
 mandatory boolean NOT NULL DEFAULT true,
 use_at char(1) NOT NULL DEFAULT 'Y',
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_development_job_gate_result (
 result_id bigserial PRIMARY KEY,
 job_id bigint NOT NULL REFERENCES framework_development_job(job_id) ON DELETE CASCADE,
 gate_code varchar(80) NOT NULL REFERENCES framework_quality_gate(gate_code),
 result varchar(20) NOT NULL,
 summary text NOT NULL DEFAULT '',
 evidence_ref varchar(500),
 checked_at timestamp NOT NULL DEFAULT current_timestamp,
 CHECK (result IN ('PASSED','FAILED','SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_development_dependency_reverse
 ON framework_development_job_dependency(depends_on_job_id,job_id);
CREATE INDEX IF NOT EXISTS idx_development_parallel_queue
 ON framework_development_job(approval_status,job_status,execution_mode,job_group_code,required);
CREATE INDEX IF NOT EXISTS idx_development_gate_job
 ON framework_development_job_gate_result(job_id,checked_at DESC);

INSERT INTO framework_quality_gate(gate_code,gate_name,gate_group,verification_command,failure_pattern,mandatory) VALUES
 ('NO_PLACEHOLDER','미완성 자리표시자 금지','CONTENT','scan_changed_text','(?i)(TBD|TODO|FIXME|placeholder|임시 구현)',true),
 ('NON_EMPTY_ARTIFACT','빈 산출물 금지','CONTENT','check_changed_files_nonempty','',true),
 ('DIFF_CHECK','Git 공백·충돌 검사','SOURCE','git diff --check','',true),
 ('JSON_VALID','JSON 구문 검사','SOURCE','jq empty','',true),
 ('FRONTEND_TYPECHECK','프런트 타입 검사','BUILD','tsc -b','',true),
 ('BACKEND_COMPILE','백엔드 컴파일','BUILD','gradle compileJava','',true),
 ('AUTOMATED_TEST','관련 자동 테스트','TEST','targeted tests','',true),
 ('DEPLOY_HEALTH','배포·헬스 확인','DEPLOY','2 replicas and actuator UP','',true)
ON CONFLICT(gate_code) DO UPDATE SET gate_name=excluded.gate_name,gate_group=excluded.gate_group,
 verification_command=excluded.verification_command,failure_pattern=excluded.failure_pattern,mandatory=excluded.mandatory,
 use_at='Y',updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_process_development_progress AS
SELECT p.process_code,
 coalesce(round(100 * sum(j.progress_weight) FILTER (WHERE j.required AND j.job_status='VERIFIED') /
   nullif(sum(j.progress_weight) FILTER (WHERE j.required),0),1),0) AS completion_percent,
 count(j.job_id) FILTER (WHERE j.required) AS required_jobs,
 count(j.job_id) FILTER (WHERE j.required AND j.job_status='VERIFIED') AS verified_jobs,
 count(j.job_id) FILTER (WHERE j.required AND j.job_status='FAILED') AS failed_jobs,
 bool_and(j.job_status='VERIFIED') FILTER (WHERE j.required) AS required_complete,
 count(j.job_id) FILTER (WHERE j.execution_mode='PARALLEL') AS parallel_jobs
FROM framework_process_definition p
LEFT JOIN framework_development_job j ON j.process_code=p.process_code
GROUP BY p.process_code;

COMMENT ON VIEW framework_process_development_progress IS '필수 작업 가중치와 병렬 작업을 포함한 프로세스 실제 개발 완료율';
