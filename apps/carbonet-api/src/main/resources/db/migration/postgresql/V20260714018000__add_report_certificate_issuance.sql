ALTER TABLE emission_project_report
  ADD COLUMN IF NOT EXISTS certificate_id varchar(100),
  ADD COLUMN IF NOT EXISTS integrity_hash varchar(128),
  ADD COLUMN IF NOT EXISTS issued_by varchar(100),
  ADD COLUMN IF NOT EXISTS issued_at timestamp,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS uq_emission_report_certificate ON emission_project_report(certificate_id) WHERE certificate_id IS NOT NULL;
