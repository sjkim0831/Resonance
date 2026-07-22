CREATE TABLE IF NOT EXISTS framework_organizational_boundary_runtime_validation_run (
  validation_run_id bigserial PRIMARY KEY,
  validation_status varchar(20) NOT NULL CHECK(validation_status IN('PASSED','FAILED')),
  project_id varchar(80) NOT NULL,
  authenticated_api_count integer NOT NULL CHECK(authenticated_api_count>=0),
  protected_api_count integer NOT NULL CHECK(protected_api_count>=0),
  page_count integer NOT NULL CHECK(page_count>=0),
  p95_millis integer NOT NULL CHECK(p95_millis>=0),
  ready_replicas integer NOT NULL CHECK(ready_replicas>0),
  runtime_evidence_ref text NOT NULL,
  source_commit char(40) NOT NULL,
  executed_by varchar(100) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_org_boundary_runtime_validation_latest
  ON framework_organizational_boundary_runtime_validation_run(executed_at DESC,validation_status);

COMMENT ON TABLE framework_organizational_boundary_runtime_validation_run IS
  '조직경계 구현 완료를 판정한 실제 API, 권한, 롤백, 화면, 성능 및 배포 증빙';
