CREATE TABLE IF NOT EXISTS framework_process_step_revision_audit (
  revision_audit_id BIGSERIAL PRIMARY KEY,
  process_code VARCHAR(80) NOT NULL,
  step_code VARCHAR(80),
  change_type VARCHAR(20) NOT NULL,
  revision_reason TEXT NOT NULL,
  actor VARCHAR(100) NOT NULL,
  expected_process_version VARCHAR(40),
  before_process_version VARCHAR(40) NOT NULL,
  after_process_version VARCHAR(40) NOT NULL,
  expected_structure_hash VARCHAR(128),
  before_structure_hash VARCHAR(128) NOT NULL,
  after_structure_hash VARCHAR(128) NOT NULL,
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  before_snapshot JSONB NOT NULL,
  after_snapshot JSONB NOT NULL,
  impact_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  running_instance_count INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT,
  restore_source_revision_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_process_step_revision_audit_change_type CHECK (change_type IN ('UPDATE','DEACTIVATE','REACTIVATE','RETIRE','RESTORE')),
  CONSTRAINT ck_process_step_revision_audit_reason CHECK (length(btrim(revision_reason)) > 0),
  CONSTRAINT ck_process_step_revision_audit_actor CHECK (length(btrim(actor)) > 0),
  CONSTRAINT ck_process_step_revision_audit_running_count CHECK (running_instance_count >= 0),
  CONSTRAINT fk_process_step_revision_audit_restore_source FOREIGN KEY (restore_source_revision_id) REFERENCES framework_process_step_revision_audit(revision_audit_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_process_step_revision_audit_process_created ON framework_process_step_revision_audit(process_code, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_process_step_revision_audit_created ON framework_process_step_revision_audit(created_at DESC);
COMMENT ON TABLE framework_process_step_revision_audit IS 'Immutable process/step revision audit with canonical before/after snapshots';

CREATE OR REPLACE FUNCTION framework_process_step_revision_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_IMMUTABLE: revision audit rows cannot be updated or deleted'
    USING ERRCODE = '55006';
END;
$$;

DROP TRIGGER IF EXISTS trg_process_step_revision_audit_immutable
  ON framework_process_step_revision_audit;
CREATE TRIGGER trg_process_step_revision_audit_immutable
BEFORE UPDATE OR DELETE ON framework_process_step_revision_audit
FOR EACH ROW EXECUTE FUNCTION framework_process_step_revision_audit_immutable();
