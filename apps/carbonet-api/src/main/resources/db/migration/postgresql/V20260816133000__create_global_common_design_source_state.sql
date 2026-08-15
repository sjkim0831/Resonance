CREATE TABLE IF NOT EXISTS framework_common_design_asset_source_state (
    asset_type         varchar(20)  NOT NULL,
    asset_id           varchar(200) NOT NULL,
    canonical_asset    jsonb        NOT NULL,
    asset_fingerprint  char(64),
    updated_by         varchar(300) NOT NULL,
    created_at         timestamptz  NOT NULL DEFAULT current_timestamp,
    updated_at         timestamptz  NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (asset_type, asset_id),
    CONSTRAINT framework_common_design_source_type_ck
        CHECK (asset_type IN ('THEME', 'SECTION', 'COMPONENT', 'SCREEN')),
    CONSTRAINT framework_common_design_source_payload_ck
        CHECK (jsonb_typeof(canonical_asset) = 'object'),
    CONSTRAINT framework_common_design_source_fingerprint_ck
        CHECK (asset_fingerprint IS NULL OR asset_fingerprint ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE framework_common_design_asset_source_state IS
    'Global SOURCE_IMMEDIATE_V1 CAS head for common design assets; project snapshots are read projections only.';

-- Build the initial head only from server-owned runtime registries. The Java
-- service initializes each NULL fingerprint under the same global advisory
-- and row locks used by mutations, after re-reading and verifying the registry.
INSERT INTO framework_common_design_asset_source_state(
    asset_type, asset_id, canonical_asset, asset_fingerprint, updated_by)
SELECT 'THEME', theme_id,
       jsonb_build_object(
           'assetType','THEME','assetId',theme_id,
           'assetName',coalesce(nullif(trim(theme_nm),''),theme_id),
           'routePath','','version','v1',
           'active',(use_at='Y' AND is_active='Y'),
           'payload',jsonb_build_object(
               'schemaVersion','1.0.0',
               'themeName',coalesce(nullif(trim(theme_nm),''),theme_id),
               'description',coalesce(nullif(trim(theme_dc),''),theme_id),
               'themeType',coalesce(nullif(trim(theme_type),''),'CUSTOM'),
               'colorConfig',coalesce(nullif(trim(color_config::text),''),'{}')::jsonb,
               'typographyConfig',coalesce(nullif(trim(typography_config::text),''),'{}')::jsonb,
               'spacingConfig',coalesce(nullif(trim(spacing_config::text),''),'{}')::jsonb,
               'borderConfig',coalesce(nullif(trim(border_config::text),''),'{}')::jsonb,
               'shadowConfig',coalesce(nullif(trim(shadow_config::text),''),'{}')::jsonb,
               'classPrefix',coalesce(nullif(trim(class_prefix),''),'theme'),
               'isDefault',(is_default='Y'),'dependencies','[]'::jsonb)),
       NULL,'MIGRATION_RUNTIME_BACKFILL'
  FROM comtnthemedefinition
 WHERE theme_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
ON CONFLICT (asset_type,asset_id) DO NOTHING;

INSERT INTO framework_common_design_asset_source_state(
    asset_type, asset_id, canonical_asset, asset_fingerprint, updated_by)
SELECT 'SECTION', section_id,
       jsonb_build_object(
           'assetType','SECTION','assetId',section_id,
           'assetName',coalesce(nullif(trim(section_name),''),section_id),
           'routePath','','version','v1','active',(active_yn='Y'),
           'payload',jsonb_build_object(
               'schemaVersion','1.0.0',
               'sectionName',coalesce(nullif(trim(section_name),''),section_id),
               'sectionType',coalesce(nullif(trim(section_type),''),'CONTENT'),
               'layoutContract',coalesce(nullif(trim(layout_contract),''),'KRDS_GRID'),
               'responsiveContract',coalesce(nullif(trim(responsive_contract),''),'MOBILE_FIRST'),
               'accessibilityContract',coalesce(nullif(trim(accessibility_contract),''),'KRDS_A11Y'),
               'designReference',coalesce(nullif(trim(design_reference),''),'KRDS_GOV_DEFAULT'),
               'dependencies','[]'::jsonb)),
       NULL,'MIGRATION_RUNTIME_BACKFILL'
  FROM ui_section_registry
 WHERE section_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
ON CONFLICT (asset_type,asset_id) DO NOTHING;

INSERT INTO framework_common_design_asset_source_state(
    asset_type, asset_id, canonical_asset, asset_fingerprint, updated_by)
SELECT 'COMPONENT', component_id,
       jsonb_build_object(
           'assetType','COMPONENT','assetId',component_id,
           'assetName',coalesce(nullif(trim(component_name),''),component_id),
           'routePath','','version','v1','active',(active_yn='Y'),
           'payload',jsonb_build_object(
               'schemaVersion','1.0.0',
               'componentName',coalesce(nullif(trim(component_name),''),component_id),
               'componentType',coalesce(nullif(trim(component_type),''),'DISPLAY'),
               'ownerDomain',coalesce(nullif(trim(owner_domain),''),'COMMON'),
               'propsSchema',coalesce(nullif(trim(props_schema_json::text),''),'{}')::jsonb,
               'designReference',coalesce(nullif(trim(design_reference),''),'KRDS_GOV_DEFAULT'),
               'defaultProps',coalesce(nullif(trim(default_props::text),''),'{}')::jsonb,
               'category',coalesce(nullif(trim(category),''),'COMMON'),
               'dependencies','[]'::jsonb)),
       NULL,'MIGRATION_RUNTIME_BACKFILL'
  FROM ui_component_registry
 WHERE component_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
ON CONFLICT (asset_type,asset_id) DO NOTHING;

INSERT INTO framework_common_design_asset_source_state(
    asset_type, asset_id, canonical_asset, asset_fingerprint, updated_by)
SELECT 'SCREEN', page.page_id,
       jsonb_build_object(
           'assetType','SCREEN','assetId',page.page_id,
           'assetName',coalesce(nullif(trim(page.page_name),''),page.page_id),
           'routePath',coalesce(page.route_path,''),
           'version',coalesce(nullif(trim(page.layout_version),''),'v1'),
           'active',(page.active_yn='Y'),
           'payload',jsonb_build_object(
               'schemaVersion','1.0.0',
               'pageName',coalesce(nullif(trim(page.page_name),''),page.page_id),
               'layout','KRDS_WORKSPACE',
               'theme',coalesce(nullif(trim(page.design_token_version),''),'KRDS_GOV_DEFAULT'),
               'sections','[]'::jsonb,
               'components',coalesce(component.components,'[]'::jsonb),
               'dependencies','[]'::jsonb)),
       NULL,'MIGRATION_RUNTIME_BACKFILL'
  FROM ui_page_manifest page
  LEFT JOIN LATERAL (
      SELECT jsonb_agg(mapping.component_id ORDER BY mapping.component_id) AS components
        FROM (SELECT DISTINCT component_id
                FROM ui_page_component_map
               WHERE page_id=page.page_id) mapping
  ) component ON true
 WHERE page.page_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
ON CONFLICT (asset_type,asset_id) DO NOTHING;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
    ON framework_common_design_asset_source_state FROM PUBLIC;
