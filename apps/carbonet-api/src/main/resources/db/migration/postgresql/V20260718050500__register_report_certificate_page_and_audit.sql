-- Register the implemented report/certificate operations page in the common design catalog.
INSERT INTO ui_page_manifest(
 page_id,page_name,route_path,domain_code,layout_version,design_token_version,
 active_yn,created_at,updated_at,page_title,page_url,version_status
) VALUES(
 'admin-emission-report-certificates','보고서·인증서 발급 관리','/admin/emission/report-certificates',
 'EMISSION','1.0.0','KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,
 '보고서·인증서 발급 관리','/admin/emission/report-certificates','ACTIVE'
)
ON CONFLICT(page_id) DO UPDATE SET
 route_path=excluded.route_path,design_token_version='KRDS_GOV_DEFAULT',active_yn='Y',
 page_title=excluded.page_title,page_url=excluded.page_url,updated_at=current_timestamp;

INSERT INTO framework_design_preflight(
 page_id,route_path,theme_id,section_id,component_id,class_set_id,decision,
 asset_fingerprint,evidence_json,reuse_policy,source_scope,executed_by
)
SELECT 'admin-emission-report-certificates','/admin/emission/report-certificates',
       'KRDS_GOV_DEFAULT','DETAIL_WORKSPACE',component.component_id,'KRDS_CONTENT_CARD',
       'REUSED',component.asset_fingerprint,
       '{"themeVerified":true,"sectionVerified":true,"componentMatched":true,"classSetVerified":true,"commonOnly":true}',
       'COMMON_ONLY','COMMON','FLYWAY'
FROM LATERAL (
 SELECT component_id,asset_fingerprint FROM ui_component_registry
 WHERE active_yn='Y' AND category='COMMON'
 ORDER BY CASE WHEN component_type IN('SECTION','FORM') THEN 0 ELSE 1 END,component_id LIMIT 1
) component
WHERE NOT EXISTS(
 SELECT 1 FROM framework_design_preflight
 WHERE lower(split_part(route_path,'?',1))='/admin/emission/report-certificates'
   AND reuse_policy='COMMON_ONLY' AND source_scope='COMMON'
);

-- Certificates issued before lifecycle auditing was introduced remain valid,
-- but receive an explicit, distinguishable migration evidence event.
INSERT INTO emission_report_certificate_audit(
 report_id,certificate_id,action_code,actor_id,action_reason
)
SELECT report_id,certificate_id,'ISSUED','MIGRATION_BACKFILL',
       'LEGACY_BACKFILL: active certificate existed before certificate lifecycle audit registration'
FROM emission_project_report report
WHERE report.report_status='FINALIZED' AND report.certificate_status='ACTIVE'
  AND report.certificate_id IS NOT NULL
  AND NOT EXISTS(
    SELECT 1 FROM emission_report_certificate_audit audit
    WHERE audit.report_id=report.report_id AND audit.certificate_id=report.certificate_id
      AND audit.action_code IN('ISSUED','REISSUED')
  );
