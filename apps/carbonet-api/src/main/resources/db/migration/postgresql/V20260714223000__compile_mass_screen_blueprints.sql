CREATE TABLE IF NOT EXISTS framework_screen_blueprint (
 blueprint_id bigserial PRIMARY KEY,
 blueprint_code varchar(140) NOT NULL UNIQUE,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 step_code varchar(80) NOT NULL,
 actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
 audience varchar(20) NOT NULL CHECK (audience IN ('USER','ADMIN')),
 page_id varchar(160) NOT NULL,
 page_name varchar(200) NOT NULL,
 route_path varchar(300) NOT NULL,
 screen_type varchar(40) NOT NULL REFERENCES framework_screen_type(screen_type),
 template_code varchar(80) NOT NULL,
 specification_json text NOT NULL DEFAULT '{}',
 traceability_json text NOT NULL DEFAULT '{}',
 validation_status varchar(20) NOT NULL DEFAULT 'DRAFT',
 validation_message text,
 generated_source_path varchar(500),
 created_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(process_code,step_code,audience),
 UNIQUE(audience,route_path)
);

CREATE TABLE IF NOT EXISTS framework_screen_generation_batch (
 batch_id bigserial PRIMARY KEY,
 batch_code varchar(80) NOT NULL UNIQUE,
 batch_name varchar(200) NOT NULL,
 process_code varchar(80),
 requested_count integer NOT NULL CHECK(requested_count BETWEEN 1 AND 1000),
 compiled_count integer NOT NULL DEFAULT 0,
 valid_count integer NOT NULL DEFAULT 0,
 invalid_count integer NOT NULL DEFAULT 0,
 queued_count integer NOT NULL DEFAULT 0,
 batch_status varchar(30) NOT NULL DEFAULT 'COMPILING',
 dry_run boolean NOT NULL DEFAULT true,
 requested_by varchar(100) NOT NULL,
 summary_json text NOT NULL DEFAULT '{}',
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 completed_at timestamp
);

CREATE TABLE IF NOT EXISTS framework_screen_generation_batch_item (
 batch_id bigint NOT NULL REFERENCES framework_screen_generation_batch(batch_id) ON DELETE CASCADE,
 blueprint_id bigint NOT NULL REFERENCES framework_screen_blueprint(blueprint_id) ON DELETE CASCADE,
 item_order integer NOT NULL,
 item_status varchar(30) NOT NULL DEFAULT 'COMPILED',
 development_job_id bigint REFERENCES framework_development_job(job_id),
 validation_message text,
 PRIMARY KEY(batch_id,blueprint_id),
 UNIQUE(batch_id,item_order)
);

CREATE INDEX IF NOT EXISTS ix_screen_blueprint_process ON framework_screen_blueprint(process_code,step_code,audience);
CREATE INDEX IF NOT EXISTS ix_generation_batch_status ON framework_screen_generation_batch(batch_status,created_at DESC);

CREATE OR REPLACE VIEW framework_screen_blueprint_traceability AS
SELECT b.blueprint_id,b.blueprint_code,b.process_code,p.process_name,b.step_code,s.step_name,b.actor_code,
 b.audience,b.page_id,b.page_name,b.route_path,b.screen_type,b.template_code,b.validation_status,
 CASE WHEN s.step_id IS NOT NULL THEN true ELSE false END AS has_step,
 EXISTS(SELECT 1 FROM framework_simulation_case c WHERE c.process_code=b.process_code AND c.case_type='HAPPY_PATH') AS has_happy_test,
 EXISTS(SELECT 1 FROM framework_simulation_case c WHERE c.process_code=b.process_code AND c.case_type='AUTHORITY') AS has_authority_test,
 EXISTS(SELECT 1 FROM framework_simulation_case c WHERE c.process_code=b.process_code AND c.case_type='ISOLATION') AS has_isolation_test,
 EXISTS(SELECT 1 FROM framework_simulation_case c WHERE c.process_code=b.process_code AND c.case_type='EXCEPTION') AS has_exception_test,
 EXISTS(SELECT 1 FROM framework_simulation_case c WHERE c.process_code=b.process_code AND c.case_type='RECOVERY') AS has_recovery_test
FROM framework_screen_blueprint b
JOIN framework_process_definition p ON p.process_code=b.process_code
LEFT JOIN framework_process_step s ON s.process_code=b.process_code AND s.step_code=b.step_code;

COMMENT ON TABLE framework_screen_blueprint IS '액터·프로세스·단계·테스트·디자인을 연결한 화면 생성 단일 원본';
COMMENT ON TABLE framework_screen_generation_batch IS '최대 1000개 화면 설계 컴파일 및 생성 작업 배치';
