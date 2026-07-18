CREATE TABLE IF NOT EXISTS framework_activity_runtime_validation_run (
  validation_id bigserial PRIMARY KEY,
  process_code varchar(100) NOT NULL DEFAULT 'ACTIVITY_DATA',
  validation_status varchar(20) NOT NULL,
  authenticated_api_count integer NOT NULL,
  protected_api_count integer NOT NULL,
  page_count integer NOT NULL,
  p95_millis integer NOT NULL,
  ready_replicas integer NOT NULL,
  evidence_json text NOT NULL,
  source_commit varchar(64) NOT NULL,
  executed_by varchar(100) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

UPDATE framework_professional_screen_contract
SET menu_verified=true,updated_by='FLYWAY',updated_at=current_timestamp
WHERE process_code='ACTIVITY_DATA' AND contract_status='VERIFIED';

