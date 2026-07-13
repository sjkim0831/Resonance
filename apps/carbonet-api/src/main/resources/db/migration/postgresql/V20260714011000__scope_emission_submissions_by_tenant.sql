ALTER TABLE emission_activity_submission
 DROP CONSTRAINT IF EXISTS emission_activity_submission_project_id_idempotency_key_key,
 DROP CONSTRAINT IF EXISTS emission_activity_submission_project_id_version_no_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_emission_submission_tenant_request
 ON emission_activity_submission(tenant_id,project_id,idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS ux_emission_submission_tenant_version
 ON emission_activity_submission(tenant_id,project_id,version_no);
CREATE INDEX IF NOT EXISTS ix_emission_submission_scope
 ON emission_activity_submission(tenant_id,project_id,submission_state);

COMMENT ON COLUMN emission_activity_submission.tenant_id IS '서버 인증 컨텍스트에서 결정된 기관·테넌트 식별자';
