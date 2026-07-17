CREATE TABLE IF NOT EXISTS framework_design_delivery_revision (
  process_code varchar(80) PRIMARY KEY REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  design_hash varchar(64) NOT NULL,
  delivery_status varchar(30) NOT NULL,
  step_count integer NOT NULL DEFAULT 0,
  development_job_count integer NOT NULL DEFAULT 0,
  generation_batch_id bigint,
  result_json text NOT NULL DEFAULT '{}',
  executed_by varchar(100) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_design_delivery_revision_status
  ON framework_design_delivery_revision(delivery_status,executed_at DESC);

COMMENT ON TABLE framework_design_delivery_revision IS
  '프로세스 설계 지문과 액터·테스트·개발 작업·화면 생성 결과를 하나의 증분 실행 단위로 관리';
