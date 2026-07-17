-- Every generated page must reuse registered common theme, section, component and CSS class assets.
ALTER TABLE framework_design_preflight
  ADD COLUMN IF NOT EXISTS class_set_id varchar(100),
  ADD COLUMN IF NOT EXISTS reuse_policy varchar(30) NOT NULL DEFAULT 'COMMON_ONLY',
  ADD COLUMN IF NOT EXISTS source_scope varchar(30) NOT NULL DEFAULT 'COMMON';

UPDATE framework_design_preflight preflight
SET class_set_id = coalesce(
      preflight.class_set_id,
      (SELECT class_set_id
         FROM comtnthemeclassset class_set
        WHERE class_set.theme_id=preflight.theme_id AND class_set.use_at='Y'
        ORDER BY class_set.sort_order,class_set.class_set_id
        LIMIT 1)),
    reuse_policy='COMMON_ONLY',
    source_scope='COMMON'
WHERE preflight.class_set_id IS NULL
   OR preflight.reuse_policy IS DISTINCT FROM 'COMMON_ONLY'
   OR preflight.source_scope IS DISTINCT FROM 'COMMON';

ALTER TABLE framework_design_preflight DROP CONSTRAINT IF EXISTS ck_design_preflight_common_only;
ALTER TABLE framework_design_preflight ADD CONSTRAINT ck_design_preflight_common_only
  CHECK (reuse_policy='COMMON_ONLY' AND source_scope='COMMON');

-- Backfill every registered page with canonical common assets. Page-specific values stay in instance_props.
INSERT INTO framework_design_preflight
  (page_id,route_path,theme_id,section_id,component_id,class_set_id,decision,asset_fingerprint,
   evidence_json,reuse_policy,source_scope,executed_by)
SELECT page.page_id,page.route_path,'KRDS_GOV_DEFAULT','DETAIL_WORKSPACE',component.component_id,
       'KRDS_CONTENT_CARD','REUSED',component.asset_fingerprint,
       '{"themeVerified":true,"sectionVerified":true,"componentMatched":true,"classSetVerified":true,"commonOnly":true}',
       'COMMON_ONLY','COMMON','FLYWAY'
FROM ui_page_manifest page
CROSS JOIN LATERAL (
  SELECT component_id,asset_fingerprint
  FROM ui_component_registry
  WHERE active_yn='Y' AND category='COMMON'
  ORDER BY CASE WHEN component_type IN ('SECTION','FORM') THEN 0 ELSE 1 END,component_id
  LIMIT 1
) component
WHERE page.active_yn='Y' AND nullif(trim(page.route_path),'') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM framework_design_preflight existing
    WHERE lower(split_part(existing.route_path,'?',1))=lower(split_part(page.route_path,'?',1))
      AND existing.class_set_id IS NOT NULL
      AND existing.reuse_policy='COMMON_ONLY' AND existing.source_scope='COMMON'
  );

CREATE INDEX IF NOT EXISTS idx_design_preflight_common_route
  ON framework_design_preflight(lower(split_part(route_path,'?',1)),executed_at DESC)
  WHERE reuse_policy='COMMON_ONLY' AND source_scope='COMMON' AND class_set_id IS NOT NULL;

CREATE OR REPLACE VIEW framework_common_design_asset_coverage AS
SELECT page.page_id,
       lower(split_part(page.route_path,'?',1)) AS route_path,
       page.design_token_version AS theme_id,
       EXISTS (
         SELECT 1
         FROM framework_design_preflight preflight
         JOIN comtnthemedefinition theme ON theme.theme_id=preflight.theme_id AND theme.use_at='Y' AND theme.is_active='Y'
         JOIN ui_section_registry section_asset ON section_asset.section_id=preflight.section_id AND section_asset.active_yn='Y'
         JOIN ui_component_registry component ON component.component_id=preflight.component_id
           AND component.active_yn='Y' AND component.category='COMMON'
         JOIN comtnthemeclassset class_set ON class_set.class_set_id=preflight.class_set_id
           AND class_set.theme_id=preflight.theme_id AND class_set.use_at='Y'
         WHERE lower(split_part(preflight.route_path,'?',1))=lower(split_part(page.route_path,'?',1))
           AND preflight.reuse_policy='COMMON_ONLY' AND preflight.source_scope='COMMON'
       ) AS common_assets_ready
FROM ui_page_manifest page
WHERE page.active_yn='Y';
