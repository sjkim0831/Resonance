-- Design-only manifests without a route are reusable templates, not deployable pages.
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
WHERE page.active_yn='Y'
  AND nullif(trim(page.route_path),'') IS NOT NULL
  AND page.route_path LIKE '/%';
