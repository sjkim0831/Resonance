\set ON_ERROR_STOP on

DO $$
DECLARE
  step_count integer;
  case_count integer;
  component_count integer;
  section_count integer;
BEGIN
  IF to_regclass('public.emission_site_registry') IS NULL THEN
    RAISE EXCEPTION 'emission_site_registry is missing';
  END IF;

  SELECT count(*) INTO step_count
    FROM framework_process_step
   WHERE process_code='COMPANY_ONBOARDING';
  IF step_count <> 5 THEN
    RAISE EXCEPTION 'COMPANY_ONBOARDING requires 5 ordered steps, found %', step_count;
  END IF;

  SELECT count(*) INTO case_count
    FROM framework_simulation_case
   WHERE process_code='COMPANY_ONBOARDING'
     AND case_type IN ('HAPPY_PATH','VALIDATION','AUTHORITY','ISOLATION','RECOVERY');
  IF case_count <> 7 THEN
    RAISE EXCEPTION 'COMPANY_ONBOARDING requires 7 scenarios, found %', case_count;
  END IF;

  SELECT count(*) INTO component_count FROM ui_component_registry
   WHERE component_id='EmissionSiteRegistry' AND active_yn='Y';
  SELECT count(*) INTO section_count FROM ui_section_registry
   WHERE section_id='SEC_EMISSION_SITE_REGISTRY' AND active_yn='Y';
  IF component_count <> 1 OR section_count <> 1 THEN
    RAISE EXCEPTION 'site registry design assets are incomplete';
  END IF;
END $$;

BEGIN;
INSERT INTO emission_site_registry
  (tenant_id,site_code,site_name,address,created_by,updated_by)
VALUES
  ('VERIFY-TENANT-A','VERIFY-SITE','검증용 사업장','검증 주소','verification','verification'),
  ('VERIFY-TENANT-B','VERIFY-SITE','검증용 사업장','검증 주소','verification','verification');

DO $$
BEGIN
  IF (SELECT count(*) FROM emission_site_registry WHERE site_code='VERIFY-SITE') <> 2 THEN
    RAISE EXCEPTION 'tenant-scoped site codes are not isolated';
  END IF;
END $$;
ROLLBACK;

SELECT 'PASS emission company onboarding database contract' AS result;
