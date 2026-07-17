ALTER TABLE emission_project_registry
  ADD COLUMN IF NOT EXISTS organization_boundary varchar(40),
  ADD COLUMN IF NOT EXISTS emission_standard varchar(40),
  ADD COLUMN IF NOT EXISTS methodology_version varchar(40),
  ADD COLUMN IF NOT EXISTS verification_level varchar(40),
  ADD COLUMN IF NOT EXISTS collection_cycle varchar(40),
  ADD COLUMN IF NOT EXISTS materiality_threshold integer,
  ADD COLUMN IF NOT EXISTS settings_snapshot jsonb;

CREATE TABLE IF NOT EXISTS emission_project_activity_request (
  request_id bigserial PRIMARY KEY,
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
  tenant_id varchar(120) NOT NULL,
  site_name varchar(160) NOT NULL,
  assignee_id varchar(100) NOT NULL,
  collection_cycle varchar(40) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  request_status varchar(30) NOT NULL DEFAULT 'READY',
  request_source varchar(30) NOT NULL DEFAULT 'PROJECT_SETUP',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(project_id, site_name, assignee_id)
);

CREATE INDEX IF NOT EXISTS idx_emission_activity_request_tenant_status
  ON emission_project_activity_request(tenant_id, request_status, due_date);

UPDATE framework_project_registration_requirement
SET implementation_status='SUPPORTED',
    implementation_note='프로젝트 생성 계약, 설정 스냅샷 및 최초 자료 요청 자동 생성에 연결됨'
WHERE requirement_code IN ('PRJ_METHOD_STANDARD','PRJ_DATA_ASSIGN');

UPDATE framework_project_registration_requirement
SET implementation_status='PARTIAL',
    implementation_note='중요성 기준은 생성 계약과 스냅샷에 연결됨. 범위 제외 사유 편집은 설정 화면에서 후속 구현'
WHERE requirement_code='PRJ_SCOPE_EXCLUSION';
