CREATE TABLE IF NOT EXISTS framework_generator_registry (
  generator_id varchar(80) PRIMARY KEY,
  generator_name varchar(160) NOT NULL,
  screen_type varchar(40) NOT NULL REFERENCES framework_screen_type(screen_type),
  strategy varchar(30) NOT NULL CHECK (strategy IN ('ADOPT_EXISTING','GENERATE','EXTEND')),
  template_code varchar(80) NOT NULL,
  allowed_audiences varchar(40) NOT NULL DEFAULT 'USER,ADMIN',
  verification_profile varchar(80) NOT NULL,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

INSERT INTO framework_generator_registry(generator_id,generator_name,screen_type,strategy,template_code,verification_profile) VALUES
('ADOPT_EXISTING_PAGE','기존 구현 채택','DETAIL','ADOPT_EXISTING','KRDS_ADOPT_EXISTING','existing-page-e2e'),
('KRDS_LIST_PAGE','KRDS 목록 화면','LIST','GENERATE','KRDS_LIST','list-crud-e2e'),
('KRDS_FORM_PAGE','KRDS 등록 입력 화면','FORM','GENERATE','KRDS_FORM','form-validation-e2e'),
('KRDS_DETAIL_PAGE','KRDS 상세 화면','DETAIL','GENERATE','KRDS_DETAIL','detail-authority-e2e'),
('KRDS_WORKFLOW_PAGE','KRDS 업무 흐름 화면','WORKFLOW','GENERATE','KRDS_WORKFLOW','workflow-state-e2e'),
('KRDS_DASHBOARD_PAGE','KRDS 대시보드','DASHBOARD','GENERATE','KRDS_DASHBOARD','dashboard-data-e2e'),
('KRDS_SEARCH_PAGE','KRDS 통합 검색 화면','SEARCH','GENERATE','KRDS_SEARCH','search-section-e2e'),
('KRDS_UPLOAD_PAGE','KRDS 업로드·매핑 화면','UPLOAD','GENERATE','KRDS_UPLOAD','upload-mapping-e2e'),
('KRDS_REPORT_PAGE','KRDS 보고서 화면','REPORT','GENERATE','KRDS_REPORT','report-proof-e2e'),
('KRDS_ADMIN_PAGE','KRDS 관리자 화면','ADMIN','GENERATE','KRDS_ADMIN','admin-crud-audit-e2e')
ON CONFLICT(generator_id) DO UPDATE SET generator_name=excluded.generator_name,screen_type=excluded.screen_type,
 strategy=excluded.strategy,template_code=excluded.template_code,verification_profile=excluded.verification_profile,
 active_yn='Y',updated_at=current_timestamp;

CREATE TABLE IF NOT EXISTS framework_e4b_generator_selection (
  selection_id bigserial PRIMARY KEY,
  request_id varchar(80) NOT NULL UNIQUE,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code),
  step_code varchar(100),
  model_name varchar(120) NOT NULL,
  generator_id varchar(80) NOT NULL REFERENCES framework_generator_registry(generator_id),
  screen_type varchar(40) NOT NULL,
  strategy varchar(30) NOT NULL,
  selection_json jsonb NOT NULL,
  validation_status varchar(30) NOT NULL,
  execution_status varchar(30) NOT NULL DEFAULT 'PLANNED',
  execution_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_by varchar(100) NOT NULL,
  selected_at timestamp NOT NULL DEFAULT current_timestamp,
  executed_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_e4b_generator_selection_process
  ON framework_e4b_generator_selection(process_code,step_code,selected_at DESC);
