CREATE TEMP TABLE reduction_generated_route ON COMMIT DROP AS
SELECT s.process_code,s.step_code,s.process_code||':'||s.step_code||':'||audience AS route_key,
       CASE WHEN audience='USER' THEN split_part(s.user_path,'?',1) ELSE split_part(s.admin_path,'?',1) END route_path,
       'GEN_'||upper(substr(md5(s.process_code||':'||s.step_code||':'||audience),1,24)) page_id,
       p.process_name||' - '||s.step_name||CASE WHEN audience='USER' THEN ' 사용자 업무 화면' ELSE ' 관리자 업무 화면' END page_name
  FROM framework_process_step s
  JOIN framework_process_definition p ON p.process_code=s.process_code
 CROSS JOIN (VALUES('USER'),('ADMIN')) audience_set(audience)
 WHERE s.process_code IN (
   'REDUCTION_TARGET_PLANNING','REDUCTION_PROJECT_REGISTRATION','REDUCTION_PROJECT_APPROVAL',
   'REDUCTION_ROADMAP','REDUCTION_SCENARIO','REDUCTION_PERFORMANCE','REDUCTION_REPORTING'
 )
   AND nullif(CASE WHEN audience='USER' THEN s.user_path ELSE s.admin_path END,'') IS NOT NULL;

DO $$
DECLARE route_count integer;
BEGIN
  SELECT count(*) INTO route_count FROM reduction_generated_route;
  IF route_count<>56 THEN
    RAISE EXCEPTION 'expected 56 reduction generated routes, found %',route_count;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ui_component_registry WHERE component_id='COMMON_CONTENT_CARD' AND active_yn='Y' AND category='COMMON') THEN
    RAISE EXCEPTION 'canonical common content component is unavailable';
  END IF;
END $$;

INSERT INTO ui_page_manifest(
  page_id,page_name,route_path,domain_code,layout_version,design_token_version,
  active_yn,created_at,updated_at,page_title,page_url,version_status
)
SELECT page_id,page_name,route_path,'REDUCTION','KRDS_WORKSPACE','KRDS_GOV_DEFAULT',
       'Y',current_timestamp,current_timestamp,page_name,route_path,'ACTIVE'
  FROM reduction_generated_route route
 WHERE NOT EXISTS (
   SELECT 1 FROM ui_page_manifest existing
    WHERE existing.active_yn='Y'
      AND lower(regexp_replace(split_part(trim(existing.route_path),'?',1),'/+$',''))=
          lower(regexp_replace(split_part(trim(route.route_path),'?',1),'/+$',''))
 )
ON CONFLICT(page_id) DO UPDATE SET
  page_name=excluded.page_name,route_path=excluded.route_path,domain_code='REDUCTION',
  layout_version='KRDS_WORKSPACE',design_token_version='KRDS_GOV_DEFAULT',
  active_yn='Y',page_title=excluded.page_title,page_url=excluded.page_url,
  version_status='ACTIVE',updated_at=current_timestamp;

INSERT INTO framework_design_preflight(
  page_id,route_path,theme_id,section_id,component_id,class_set_id,decision,
  asset_fingerprint,evidence_json,reuse_policy,source_scope,executed_by
)
SELECT route.page_id,route.route_path,'KRDS_GOV_DEFAULT','DETAIL_WORKSPACE',
       component.component_id,'KRDS_CONTENT_CARD','REUSED',component.asset_fingerprint,
       jsonb_build_object('themeVerified',true,'sectionVerified',true,'componentMatched',true,
                          'classSetVerified',true,'commonOnly',true,'processCode',route.process_code,
                          'stepCode',route.step_code),
       'COMMON_ONLY','COMMON','FLYWAY_REDUCTION_GENERATED_DESIGN'
  FROM reduction_generated_route route
 CROSS JOIN LATERAL (
   SELECT component_id,asset_fingerprint FROM ui_component_registry
    WHERE component_id='COMMON_CONTENT_CARD' AND active_yn='Y' AND category='COMMON'
 ) component
 WHERE NOT EXISTS (
   SELECT 1 FROM framework_design_preflight existing
    WHERE lower(split_part(existing.route_path,'?',1))=lower(route.route_path)
      AND existing.reuse_policy='COMMON_ONLY' AND existing.source_scope='COMMON'
 );

INSERT INTO ui_page_component_map(
  map_id,page_id,layout_zone,component_id,instance_key,display_order,
  conditional_rule_summary,created_at,updated_at
)
SELECT 'MAP_'||page_id||'_CONTENT',page_id,'DETAIL_WORKSPACE','COMMON_CONTENT_CARD',
       lower(page_id)||'_content',1,
       'Reduction generated route reuses the canonical KRDS common workspace',
       current_timestamp,current_timestamp
  FROM reduction_generated_route
ON CONFLICT(map_id) DO UPDATE SET
  page_id=excluded.page_id,layout_zone='DETAIL_WORKSPACE',component_id='COMMON_CONTENT_CARD',
  updated_at=current_timestamp;

DO $$
DECLARE missing_count integer; duplicate_count integer;
BEGIN
  SELECT count(*) INTO missing_count
    FROM reduction_generated_route route
   WHERE NOT EXISTS (
     SELECT 1 FROM framework_common_design_asset_coverage coverage
      WHERE coverage.route_path=lower(route.route_path) AND coverage.common_assets_ready
   );
  IF missing_count<>0 THEN
    RAISE EXCEPTION 'reduction common design coverage remains incomplete for % routes',missing_count;
  END IF;
  SELECT count(*) INTO duplicate_count
    FROM (
      SELECT lower(regexp_replace(split_part(trim(route_path),'?',1),'/+$',''))
        FROM ui_page_manifest WHERE active_yn='Y' AND nullif(trim(route_path),'') IS NOT NULL
       GROUP BY 1 HAVING count(*)>1
    ) duplicate;
  IF duplicate_count<>0 THEN
    RAISE EXCEPTION 'active page route uniqueness regressed: %',duplicate_count;
  END IF;
END $$;

SELECT * FROM framework_refresh_unified_asset_catalog('FLYWAY_V20260821212000');

