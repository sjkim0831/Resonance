CREATE OR REPLACE FUNCTION framework_install_common_feature(p_feature_code text,p_project_scope text,p_actor text,p_configuration jsonb DEFAULT '{}')
RETURNS TABLE(feature_code text,installed_version text,installation_status text) LANGUAGE plpgsql AS $$
DECLARE v_version text;
BEGIN
 SELECT p.feature_version INTO v_version FROM framework_common_feature_package p
 WHERE p.feature_code=p_feature_code AND p.active_yn='Y';
 IF v_version IS NULL THEN RAISE EXCEPTION 'ACTIVE_FEATURE_PACKAGE_NOT_FOUND:%',p_feature_code; END IF;
 IF EXISTS(
   SELECT 1 FROM framework_common_feature_dependency d
   LEFT JOIN framework_feature_installation i ON i.feature_code=d.depends_on_feature_code AND i.project_scope=p_project_scope AND i.installation_status='INSTALLED'
   WHERE d.feature_code=p_feature_code AND d.required_yn='Y' AND i.installation_id IS NULL
 ) THEN RAISE EXCEPTION 'REQUIRED_FEATURE_DEPENDENCY_NOT_INSTALLED:%',p_feature_code; END IF;
 INSERT INTO framework_feature_installation(project_scope,feature_code,installed_version,configuration,evidence_ref,installed_by)
 VALUES(p_project_scope,p_feature_code,v_version,coalesce(p_configuration,'{}'),'feature-package:'||p_feature_code||':'||v_version,p_actor)
 ON CONFLICT ON CONSTRAINT framework_feature_installation_project_scope_feature_code_key DO UPDATE SET
  installed_version=excluded.installed_version,installation_status='INSTALLED',configuration=excluded.configuration,
  evidence_ref=excluded.evidence_ref,installed_by=excluded.installed_by,updated_at=current_timestamp;
 RETURN QUERY SELECT p_feature_code,v_version,'INSTALLED'::text;
END $$;

DO $$ DECLARE r record;
BEGIN
 FOR r IN SELECT feature_code FROM framework_common_feature_package
   ORDER BY CASE WHEN feature_code IN ('FILE_EVIDENCE','UNIT_CONVERSION','SEARCH_INDEX') THEN 0 WHEN feature_code='PDF_REPORT' THEN 1 WHEN feature_code='CERTIFICATE_VERIFY' THEN 2 ELSE 1 END,feature_code
 LOOP
   PERFORM * FROM framework_install_common_feature(r.feature_code,'PLATFORM','MIGRATION','{}');
 END LOOP;
END $$;
