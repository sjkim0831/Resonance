-- Collapse structurally identical assets to one canonical common asset and prevent recurrence.
CREATE TEMP TABLE duplicate_component_asset ON COMMIT DROP AS
SELECT component_id,
       first_value(component_id) OVER (
         PARTITION BY component_type, props_schema_json, design_reference
         ORDER BY component_id
       ) AS canonical_component_id,
       row_number() OVER (
         PARTITION BY component_type, props_schema_json, design_reference
         ORDER BY component_id
       ) AS duplicate_order
FROM ui_component_registry
WHERE active_yn = 'Y';

UPDATE ui_page_component_map mapping
SET component_id = duplicate.canonical_component_id,
    updated_at = current_timestamp
FROM duplicate_component_asset duplicate
WHERE mapping.component_id = duplicate.component_id
  AND duplicate.duplicate_order > 1;

UPDATE comtnthemeclassset class_set
SET target_component = duplicate.canonical_component_id,
    updt_pnttm = current_timestamp,
    updt_user_id = 'COMMON_ASSET'
FROM duplicate_component_asset duplicate
WHERE class_set.target_component = duplicate.component_id
  AND duplicate.duplicate_order > 1;

DELETE FROM ui_component_registry component
USING duplicate_component_asset duplicate
WHERE component.component_id = duplicate.component_id
  AND duplicate.duplicate_order > 1;

DELETE FROM ui_section_registry section_asset
USING (
  SELECT section_id,
         row_number() OVER (
           PARTITION BY section_type, layout_contract, responsive_contract, accessibility_contract, design_reference
           ORDER BY section_id
         ) AS duplicate_order
  FROM ui_section_registry
  WHERE active_yn = 'Y'
) duplicate
WHERE section_asset.section_id = duplicate.section_id
  AND duplicate.duplicate_order > 1;

DELETE FROM comtnthemeclassset class_set
USING (
  SELECT class_set_id,
         row_number() OVER (
           PARTITION BY coalesce(target_component,''), base_classes, hover_classes, focus_classes,
                        active_classes, disabled_classes, responsive_classes
           ORDER BY class_set_id
         ) AS duplicate_order
  FROM comtnthemeclassset
  WHERE use_at = 'Y'
) duplicate
WHERE class_set.class_set_id = duplicate.class_set_id
  AND duplicate.duplicate_order > 1;

DELETE FROM framework_design_asset_registry design_asset
USING (
  SELECT design_asset_id,
         row_number() OVER (
           PARTITION BY composition_json, design_token_version
           ORDER BY design_asset_id
         ) AS duplicate_order
  FROM framework_design_asset_registry
  WHERE active_yn = 'Y'
) duplicate
WHERE design_asset.design_asset_id = duplicate.design_asset_id
  AND duplicate.duplicate_order > 1;

DELETE FROM comtncomponentinfo;
INSERT INTO comtncomponentinfo
  (component_id,component_nm,component_dc,component_type,category_cd,icon_nm,default_props,
   default_class_nm,is_container,is_reusable,sort_order,use_at,creat_pnttm,creat_user_id,asset_fingerprint)
SELECT left(component_id,50), left(component_name,100), 'Reusable KRDS common design asset', left(component_type,30),
       'COMMON', 'widgets', props_schema_json, '',
       CASE WHEN component_type IN ('SECTION','FORM') THEN 'Y' ELSE 'N' END,
       'Y', row_number() OVER (ORDER BY component_id), 'Y', current_timestamp, 'COMMON_ASSET', asset_fingerprint
FROM ui_component_registry
WHERE active_yn = 'Y'
ON CONFLICT (component_id) DO UPDATE SET
  component_nm = excluded.component_nm,
  component_dc = excluded.component_dc,
  component_type = excluded.component_type,
  category_cd = 'COMMON',
  default_props = excluded.default_props,
  is_reusable = 'Y',
  use_at = 'Y',
  asset_fingerprint = excluded.asset_fingerprint,
  updt_pnttm = current_timestamp,
  updt_user_id = 'COMMON_ASSET';

DROP INDEX IF EXISTS idx_ui_component_registry_fingerprint;
CREATE UNIQUE INDEX idx_ui_component_registry_fingerprint
  ON ui_component_registry(asset_fingerprint)
  WHERE active_yn = 'Y' AND asset_fingerprint IS NOT NULL;
CREATE UNIQUE INDEX uq_ui_component_common_structure
  ON ui_component_registry(component_type, props_schema_json, design_reference)
  WHERE active_yn = 'Y';
CREATE UNIQUE INDEX uq_ui_section_common_structure
  ON ui_section_registry(section_type, layout_contract, responsive_contract, accessibility_contract, design_reference)
  WHERE active_yn = 'Y';
CREATE UNIQUE INDEX uq_theme_classset_common_structure
  ON comtnthemeclassset(coalesce(target_component,''), base_classes, hover_classes, focus_classes,
                        active_classes, disabled_classes, responsive_classes)
  WHERE use_at = 'Y';
CREATE UNIQUE INDEX uq_design_asset_common_structure
  ON framework_design_asset_registry(composition_json, design_token_version)
  WHERE active_yn = 'Y';

INSERT INTO framework_asset_sync_run
  (asset_type,source_path,discovered_count,registered_count,duplicate_count,sync_status,executed_by,executed_at)
SELECT 'STRUCTURAL_DUPLICATE_GUARD','common-design-structure',
       (SELECT count(*) FROM ui_component_registry) +
       (SELECT count(*) FROM ui_section_registry) +
       (SELECT count(*) FROM comtnthemeclassset) +
       (SELECT count(*) FROM framework_design_asset_registry),
       (SELECT count(*) FROM ui_component_registry) +
       (SELECT count(*) FROM ui_section_registry) +
       (SELECT count(*) FROM comtnthemeclassset) +
       (SELECT count(*) FROM framework_design_asset_registry),
       0,'COMPLETED','FLYWAY',current_timestamp;
