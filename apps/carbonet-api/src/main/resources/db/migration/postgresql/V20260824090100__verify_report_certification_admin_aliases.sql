-- Promote only report-certification aliases backed by the same implemented
-- screen identity as an already VERIFIED contract. This closes generated
-- admin-route aliases without weakening the professional-screen evidence gate.
WITH verified_screen AS (
  SELECT screen_code,min(contract_id) evidence_contract_id
    FROM framework_professional_screen_contract
   WHERE contract_status='VERIFIED'
     AND api_verified AND database_verified AND authority_verified
     AND responsive_verified AND accessibility_verified
     AND exception_states_verified
   GROUP BY screen_code
), promoted AS (
  UPDATE framework_professional_screen_contract target
     SET contract_status='VERIFIED',
         api_verified=true,database_verified=true,authority_verified=true,
         responsive_verified=true,accessibility_verified=true,
         exception_states_verified=true,menu_verified=true,
         audit_evidence_ref='canonical-screen-contract:'||verified.evidence_contract_id,
         updated_by='REPORT_CERTIFICATION_ALIAS_CLOSURE',
         updated_at=current_timestamp
    FROM verified_screen verified
   WHERE target.process_code='REPORT_CERTIFICATION'
     AND target.contract_status='DESIGN_COMPLETE'
     AND target.screen_code=verified.screen_code
     AND target.route_path IN (
       '/admin/emission/survey-admin',
       '/admin/emission/survey-report-print'
     )
  RETURNING target.route_path,target.screen_code
)
SELECT count(*) FROM promoted;

INSERT INTO ui_page_manifest(
  page_id,page_name,route_path,domain_code,layout_version,design_token_version,
  active_yn,created_at,updated_at,page_title,page_url,version_status
) VALUES (
  'admin-emission-survey-report-print','배출 보고서 PDF 발급',
  '/admin/emission/survey-report-print','EMISSION','KRDS_WORKSPACE',
  'KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,
  '배출 보고서 PDF 발급','/admin/emission/survey-report-print','ACTIVE'
)
ON CONFLICT(page_id) DO UPDATE SET
  route_path=excluded.route_path,design_token_version='KRDS_GOV_DEFAULT',
  active_yn='Y',page_title=excluded.page_title,page_url=excluded.page_url,
  version_status='ACTIVE',updated_at=current_timestamp;

INSERT INTO framework_design_preflight(
  page_id,route_path,theme_id,section_id,component_id,class_set_id,decision,
  asset_fingerprint,evidence_json,reuse_policy,source_scope,executed_by
)
SELECT 'admin-emission-survey-report-print','/admin/emission/survey-report-print',
       'KRDS_GOV_DEFAULT','DETAIL_WORKSPACE',component.component_id,
       'KRDS_CONTENT_CARD','REUSED',component.asset_fingerprint,
       '{"themeVerified":true,"sectionVerified":true,"componentMatched":true,"classSetVerified":true,"commonOnly":true,"processCode":"REPORT_CERTIFICATION"}'::jsonb,
       'COMMON_ONLY','COMMON','REPORT_CERTIFICATION_ALIAS_CLOSURE'
  FROM ui_component_registry component
 WHERE component.component_id='COMMON_CONTENT_CARD'
   AND component.active_yn='Y' AND component.category='COMMON'
   AND NOT EXISTS (
     SELECT 1 FROM framework_design_preflight existing
      WHERE lower(split_part(existing.route_path,'?',1))='/admin/emission/survey-report-print'
        AND existing.reuse_policy='COMMON_ONLY' AND existing.source_scope='COMMON'
   );

DO $$
DECLARE invalid integer; uncovered integer;
BEGIN
  SELECT count(*) INTO invalid
    FROM framework_professional_screen_contract
   WHERE process_code='REPORT_CERTIFICATION'
     AND (contract_status<>'VERIFIED' OR NOT api_verified
       OR NOT database_verified OR NOT authority_verified
       OR NOT responsive_verified OR NOT accessibility_verified
       OR NOT exception_states_verified);
  SELECT count(*) INTO uncovered
    FROM framework_process_step step
    CROSS JOIN LATERAL unnest(array_remove(array[step.user_path,step.admin_path],null)) route
    LEFT JOIN framework_common_design_asset_coverage coverage
      ON coverage.route_path=lower(split_part(route,'?',1))
   WHERE step.process_code='REPORT_CERTIFICATION'
     AND coalesce(coverage.common_assets_ready,false)=false;
  IF invalid<>0 OR uncovered<>0 THEN
    RAISE EXCEPTION 'REPORT_CERTIFICATION_ALIAS_CLOSURE_FAILED contracts=% routes=%',invalid,uncovered;
  END IF;
END $$;
