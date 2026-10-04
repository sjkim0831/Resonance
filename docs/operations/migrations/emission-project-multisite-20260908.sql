BEGIN;
CREATE TABLE IF NOT EXISTS emission_project_site (
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
  site_id bigint NOT NULL REFERENCES emission_site_registry(site_id),
  site_name varchar(160) NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id,site_id)
);
INSERT INTO emission_project_site(project_id,site_id,site_name)
SELECT p.project_id,s.site_id,s.site_name FROM emission_project_registry p
JOIN emission_site_registry s ON s.tenant_id=p.tenant_id AND lower(trim(s.site_name))=lower(trim(p.site_name)) AND s.site_status='ACTIVE'
ON CONFLICT DO NOTHING;
DO $$ DECLARE owner_name text; BEGIN
 SELECT tableowner INTO owner_name FROM pg_tables WHERE schemaname='public' AND tablename='emission_project_registry';
 EXECUTE format('ALTER TABLE public.emission_project_site OWNER TO %I', owner_name);
END $$;
COMMIT;
