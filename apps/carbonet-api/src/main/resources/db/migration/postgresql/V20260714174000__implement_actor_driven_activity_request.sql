CREATE TABLE IF NOT EXISTS emission_activity_request (
 request_id bigserial PRIMARY KEY,
 tenant_id varchar(100) NOT NULL,
 project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
 request_title varchar(200) NOT NULL,
 request_detail text NOT NULL,
 requested_items text NOT NULL,
 requester_id varchar(100) NOT NULL,
 assignee_id varchar(100) NOT NULL,
 due_date date NOT NULL,
 request_status varchar(30) NOT NULL DEFAULT 'REQUESTED'
   CHECK(request_status IN ('REQUESTED','IN_PROGRESS','SUBMITTED','CLOSED','CANCELLED')),
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS ix_emission_activity_request_queue
 ON emission_activity_request(tenant_id,assignee_id,request_status,due_date);

-- A process is not development-ready until required artifacts and scenarios pass.
UPDATE framework_process_definition
SET process_status='IN_DEVELOPMENT',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND process_status<>'DEVELOPMENT_READY';

UPDATE framework_process_artifact
SET delivery_status='IN_REVIEW',updated_at=current_timestamp,
 notes=concat_ws(' ',notes,'액터 기반 종단간 실행 증거가 확인되어야 VERIFIED로 승격한다.')
WHERE process_code='EMISSION_PROJECT' AND delivery_status='IMPLEMENTED';

UPDATE framework_simulation_case
SET case_status='READY',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND case_status='DRAFT';
