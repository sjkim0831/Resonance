BEGIN;
ALTER TABLE emission_activity_data ADD COLUMN IF NOT EXISTS site_id bigint REFERENCES emission_site_registry(site_id);
UPDATE emission_activity_data a SET site_id=s.site_id FROM emission_project_site s WHERE s.project_id=a.project_id AND a.site_id IS NULL AND (SELECT count(*) FROM emission_project_site x WHERE x.project_id=a.project_id)=1;
CREATE INDEX IF NOT EXISTS ix_emission_activity_project_site ON emission_activity_data(project_id,site_id);
CREATE TABLE IF NOT EXISTS emission_activity_import (
 import_id bigserial PRIMARY KEY,
 project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
 site_id bigint NOT NULL REFERENCES emission_site_registry(site_id),
 import_key varchar(64) NOT NULL,
 file_name text NOT NULL,
 original_file bytea NOT NULL,
 column_mapping jsonb NOT NULL,
 row_count integer NOT NULL,
 created_by varchar(100) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,import_key)
);
DO $$ DECLARE owner_name text; BEGIN
 SELECT tableowner INTO owner_name FROM pg_tables WHERE schemaname='public' AND tablename='emission_activity_data';
 EXECUTE format('ALTER TABLE emission_activity_import OWNER TO %I',owner_name);
END $$;
COMMIT;
