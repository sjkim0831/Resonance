ALTER TABLE emission_project_report
 ADD COLUMN IF NOT EXISTS certificate_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
 ADD COLUMN IF NOT EXISTS revoked_by varchar(100),
 ADD COLUMN IF NOT EXISTS revoked_at timestamp,
 ADD COLUMN IF NOT EXISTS revocation_reason text,
 ADD COLUMN IF NOT EXISTS previous_certificate_id varchar(100);
CREATE TABLE IF NOT EXISTS emission_report_certificate_audit (
 audit_id bigserial PRIMARY KEY, report_id bigint NOT NULL REFERENCES emission_project_report(report_id) ON DELETE CASCADE,
 certificate_id varchar(100), action_code varchar(30) NOT NULL, actor_id varchar(100) NOT NULL,
 action_reason text, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
