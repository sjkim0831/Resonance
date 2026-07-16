CREATE TABLE IF NOT EXISTS framework_process_execution (
 execution_id uuid PRIMARY KEY,
 tenant_id varchar(80) NOT NULL,
 project_id varchar(100) NOT NULL,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code),
 current_step_code varchar(80) NOT NULL,
 execution_status varchar(30) NOT NULL DEFAULT 'RUNNING',
 current_state varchar(80) NOT NULL,
 initiated_by_actor varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
 initiated_by varchar(100) NOT NULL,
 started_at timestamp NOT NULL DEFAULT current_timestamp,
 completed_at timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_process_execution_event (
 event_id bigserial PRIMARY KEY,
 execution_id uuid NOT NULL REFERENCES framework_process_execution(execution_id) ON DELETE CASCADE,
 step_code varchar(80) NOT NULL,
 actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
 command_code varchar(100) NOT NULL,
 from_state varchar(80) NOT NULL,
 to_state varchar(80) NOT NULL,
 idempotency_key varchar(160) NOT NULL,
 request_json text NOT NULL DEFAULT '{}',
 result_json text NOT NULL DEFAULT '{}',
 executed_by varchar(100) NOT NULL,
 executed_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(execution_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_process_execution_project
 ON framework_process_execution(tenant_id,project_id,process_code,execution_status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_process_execution_running
 ON framework_process_execution(tenant_id,project_id,process_code)
 WHERE execution_status='RUNNING';
CREATE INDEX IF NOT EXISTS ix_process_execution_event_trace
 ON framework_process_execution_event(execution_id,event_id);

COMMENT ON TABLE framework_process_execution IS '프로젝트에서 여러 액터가 여러 화면을 통과하는 프로세스 실행 인스턴스';
COMMENT ON TABLE framework_process_execution_event IS '액터·단계·명령·상태 전이·멱등키를 포함하는 종단간 업무 실행 증적';
