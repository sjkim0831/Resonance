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

CREATE TABLE IF NOT EXISTS framework_common_design_source_receipt (
    receipt_id        char(64)     PRIMARY KEY,
    asset_type        varchar(20)  NOT NULL,
    asset_id          varchar(200) NOT NULL,
    base_fingerprint  char(64)     NOT NULL,
    asset_fingerprint char(64)     NOT NULL,
    source_snapshots  jsonb        NOT NULL,
    created_by        varchar(300) NOT NULL,
    created_at        timestamptz  NOT NULL DEFAULT current_timestamp,
    CONSTRAINT framework_common_design_receipt_type_ck
        CHECK (asset_type IN ('THEME','SECTION','COMPONENT','SCREEN')),
    CONSTRAINT framework_common_design_receipt_id_ck
        CHECK (receipt_id ~ '^[0-9a-f]{64}$'),
    CONSTRAINT framework_common_design_receipt_base_ck
        CHECK (base_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT framework_common_design_receipt_after_ck
        CHECK (asset_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT framework_common_design_receipt_snapshots_ck
        CHECK (jsonb_typeof(source_snapshots)='array')
);

CREATE INDEX IF NOT EXISTS framework_common_design_source_receipt_target_ix
    ON framework_common_design_source_receipt(asset_type,asset_id,created_at DESC);

COMMENT ON TABLE framework_common_design_source_receipt IS
    'Durable exact target and dependency-cascade snapshot batch for idempotent source replay.';

CREATE OR REPLACE FUNCTION framework_common_design_stable_json(value jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE kind text:=jsonb_typeof(value); result text;
BEGIN
  IF kind='object' THEN
    SELECT '{'||coalesce(string_agg(
      '"'||encode(convert_to(entry.key,'UTF8'),'hex')||'":'||
      framework_common_design_stable_json(entry.value),
      ',' ORDER BY entry.key COLLATE "C"),'')||'}'
      INTO result FROM jsonb_each(value) entry;
    RETURN result;
  ELSIF kind='array' THEN
    SELECT '['||coalesce(string_agg(
      framework_common_design_stable_json(item.value),
      ',' ORDER BY item.ordinality),'')||']'
      INTO result FROM jsonb_array_elements(value)
        WITH ORDINALITY item(value,ordinality);
    RETURN result;
  ELSIF kind='string' THEN
    RETURN '"'||encode(convert_to(value#>>'{}','UTF8'),'hex')||'"';
  ELSIF kind='number' THEN
    RETURN '@'||encode(float8send((value#>>'{}')::float8),'hex');
  ELSIF kind='boolean' THEN
    RETURN lower(value#>>'{}');
  ELSIF kind='null' THEN
    RETURN 'null';
  END IF;
  RAISE EXCEPTION 'unsupported common-design JSON type: %',kind;
END
$$;

CREATE OR REPLACE FUNCTION framework_common_design_asset_fingerprint(value jsonb)
RETURNS char(64) LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT encode(sha256(convert_to(
    framework_common_design_stable_json(value),'UTF8')),'hex')::char(64)
$$;

CREATE OR REPLACE FUNCTION framework_common_design_screen_composition_exact(composition jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  IF jsonb_typeof(composition)<>'object'
     OR composition->>'schema'<>'carbonet.screen-composition/v1'
     OR coalesce(composition->>'layout','')!~'^[A-Z][A-Z0-9_]{1,79}$'
     OR coalesce(composition->>'theme','')!~'^[A-Z][A-Z0-9_]{1,79}$'
     OR jsonb_typeof(composition->'sections')<>'array'
     OR jsonb_typeof(composition->'components')<>'array'
     OR (SELECT count(*) FROM jsonb_object_keys(composition))<>5
     OR EXISTS(SELECT 1 FROM jsonb_object_keys(composition) key
                WHERE key NOT IN('schema','layout','theme','sections','components'))
  THEN RETURN false; END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(composition->'sections') item
     WHERE jsonb_typeof(item)<>'object'
        OR (SELECT count(*) FROM jsonb_object_keys(item))<>4
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) key
                   WHERE key NOT IN('sectionId','zone','displayOrder','props'))
        OR jsonb_typeof(item->'sectionId')<>'string'
        OR jsonb_typeof(item->'zone')<>'string'
        OR jsonb_typeof(item->'displayOrder')<>'number'
        OR jsonb_typeof(item->'props')<>'object'
        OR coalesce(item->>'sectionId','')!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
        OR coalesce(item->>'zone','')!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{1,119}$')
  THEN RETURN false; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(composition->'sections') item
     WHERE (item->>'displayOrder')::numeric<0
        OR (item->>'displayOrder')::numeric<>trunc((item->>'displayOrder')::numeric)
        OR (item->>'displayOrder')::numeric>2147483647)
  THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(composition->'sections'))<>
     (SELECT count(DISTINCT item->>'sectionId') FROM jsonb_array_elements(composition->'sections') item)
     OR (SELECT count(*) FROM jsonb_array_elements(composition->'sections'))<>
        (SELECT count(DISTINCT item->>'displayOrder') FROM jsonb_array_elements(composition->'sections') item)
     OR EXISTS(SELECT 1 FROM (
          SELECT (item->>'displayOrder')::numeric current_order,
                 lag((item->>'displayOrder')::numeric) OVER(ORDER BY ordinality) previous_order
            FROM jsonb_array_elements(composition->'sections') WITH ORDINALITY section(item,ordinality)
        ) ordered WHERE previous_order IS NOT NULL AND current_order<=previous_order)
  THEN RETURN false; END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(composition->'components') item
     WHERE jsonb_typeof(item)<>'object'
        OR (SELECT count(*) FROM jsonb_object_keys(item))<>6
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) key WHERE key NOT IN(
             'componentId','sectionId','instanceKey','displayOrder','props','condition'))
        OR jsonb_typeof(item->'componentId')<>'string'
        OR jsonb_typeof(item->'sectionId')<>'string'
        OR jsonb_typeof(item->'instanceKey')<>'string'
        OR jsonb_typeof(item->'displayOrder')<>'number'
        OR jsonb_typeof(item->'props')<>'object'
        OR jsonb_typeof(item->'condition')<>'string'
        OR coalesce(item->>'componentId','')!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
        OR coalesce(item->>'sectionId','')!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
        OR coalesce(item->>'instanceKey','')!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
        OR item->>'condition'<>btrim(item->>'condition')
        OR length(btrim(coalesce(item->>'condition',''))) NOT BETWEEN 1 AND 1000)
  THEN RETURN false; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(composition->'components') item
     WHERE (item->>'displayOrder')::numeric<0
        OR (item->>'displayOrder')::numeric<>trunc((item->>'displayOrder')::numeric)
        OR (item->>'displayOrder')::numeric>2147483647
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(composition->'sections') section
                       WHERE section->>'sectionId'=item->>'sectionId'))
  THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(composition->'components'))<>
     (SELECT count(DISTINCT item->>'instanceKey') FROM jsonb_array_elements(composition->'components') item)
     OR (SELECT count(*) FROM jsonb_array_elements(composition->'components'))<>
        (SELECT count(DISTINCT item->>'displayOrder') FROM jsonb_array_elements(composition->'components') item)
     OR EXISTS(SELECT 1 FROM (
          SELECT (item->>'displayOrder')::numeric current_order,
                 lag((item->>'displayOrder')::numeric) OVER(ORDER BY ordinality) previous_order
            FROM jsonb_array_elements(composition->'components') WITH ORDINALITY component(item,ordinality)
        ) ordered WHERE previous_order IS NOT NULL AND current_order<=previous_order)
  THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END
$$;

-- Build exact initial heads only from server-owned runtime registries. Stable
-- fingerprints are required before SCREEN dependency edges can be declared.
UPDATE comtnthemedefinition
   SET theme_nm=coalesce(nullif(trim(theme_nm),''),theme_id),
       theme_dc=coalesce(nullif(trim(theme_dc),''),theme_id),
       theme_type=coalesce(nullif(trim(theme_type),''),'CUSTOM'),
       color_config=case when nullif(trim(color_config::text),'') is null
                         then '{}' else color_config end,
       typography_config=case when nullif(trim(typography_config::text),'') is null
                              then '{}' else typography_config end,
       spacing_config=case when nullif(trim(spacing_config::text),'') is null
                           then '{}' else spacing_config end,
       border_config=case when nullif(trim(border_config::text),'') is null
                          then '{}' else border_config end,
       shadow_config=case when nullif(trim(shadow_config::text),'') is null
                          then '{}' else shadow_config end,
       class_prefix=coalesce(nullif(trim(class_prefix),''),'theme')
 WHERE theme_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
   AND (theme_nm IS DISTINCT FROM coalesce(nullif(trim(theme_nm),''),theme_id)
     OR theme_dc IS DISTINCT FROM coalesce(nullif(trim(theme_dc),''),theme_id)
     OR theme_type IS DISTINCT FROM coalesce(nullif(trim(theme_type),''),'CUSTOM')
     OR nullif(trim(color_config::text),'') IS NULL
     OR nullif(trim(typography_config::text),'') IS NULL
     OR nullif(trim(spacing_config::text),'') IS NULL
     OR nullif(trim(border_config::text),'') IS NULL
     OR nullif(trim(shadow_config::text),'') IS NULL
     OR class_prefix IS DISTINCT FROM coalesce(nullif(trim(class_prefix),''),'theme'));

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

-- Legacy manifests stored only page-component zones. Preserve those real zones
-- with deterministic governed section identities so the migrated SCREEN head
-- is valid and can subsequently be edited through the source endpoint.
WITH legacy_zones AS (
  SELECT DISTINCT page.page_id,page.page_name,page.design_token_version,
         mapping.layout_zone,
         'MIG_ZONE_'||upper(md5(page.page_id||chr(31)||mapping.layout_zone)) section_id
    FROM ui_page_manifest page
    JOIN ui_page_component_map mapping ON mapping.page_id=page.page_id
   WHERE NOT coalesce(framework_common_design_screen_composition_exact(
     framework_try_jsonb(page.component_schema)),false)
)
INSERT INTO ui_section_registry(
  section_id,section_name,section_type,layout_contract,responsive_contract,
  accessibility_contract,design_reference,asset_fingerprint,active_yn)
SELECT section_id,left(coalesce(nullif(trim(page_name),''),page_id)||' / '||layout_zone,180),
       'MIGRATED_ZONE',layout_zone,'PRESERVE_RUNTIME_ORDER',
       'MIGRATED_RUNTIME_ZONE',left(coalesce(nullif(trim(design_token_version),''),
       'KRDS_GOV_DEFAULT'),200),NULL,'Y'
  FROM legacy_zones
ON CONFLICT (section_id) DO NOTHING;

UPDATE ui_section_registry
   SET section_name=coalesce(nullif(trim(section_name),''),section_id),
       section_type=coalesce(nullif(trim(section_type),''),'CONTENT'),
       layout_contract=coalesce(nullif(trim(layout_contract),''),'KRDS_GRID'),
       responsive_contract=coalesce(nullif(trim(responsive_contract),''),'MOBILE_FIRST'),
       accessibility_contract=coalesce(nullif(trim(accessibility_contract),''),'KRDS_A11Y'),
       design_reference=coalesce(nullif(trim(design_reference),''),'KRDS_GOV_DEFAULT')
 WHERE section_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
   AND (section_name IS DISTINCT FROM coalesce(nullif(trim(section_name),''),section_id)
     OR section_type IS DISTINCT FROM coalesce(nullif(trim(section_type),''),'CONTENT')
     OR layout_contract IS DISTINCT FROM coalesce(nullif(trim(layout_contract),''),'KRDS_GRID')
     OR responsive_contract IS DISTINCT FROM coalesce(nullif(trim(responsive_contract),''),'MOBILE_FIRST')
     OR accessibility_contract IS DISTINCT FROM coalesce(nullif(trim(accessibility_contract),''),'KRDS_A11Y')
     OR design_reference IS DISTINCT FROM coalesce(nullif(trim(design_reference),''),'KRDS_GOV_DEFAULT'));

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

UPDATE ui_component_registry
   SET component_name=coalesce(nullif(trim(component_name),''),component_id),
       component_type=coalesce(nullif(trim(component_type),''),'DISPLAY'),
       owner_domain=coalesce(nullif(trim(owner_domain),''),'COMMON'),
       props_schema_json=case when nullif(trim(props_schema_json::text),'') is null
                              then '{}' else props_schema_json end,
       design_reference=coalesce(nullif(trim(design_reference),''),'KRDS_GOV_DEFAULT'),
       default_props=case when nullif(trim(default_props::text),'') is null
                          then '{}' else default_props end,
       category=coalesce(nullif(trim(category),''),'COMMON')
 WHERE component_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
   AND (component_name IS DISTINCT FROM coalesce(nullif(trim(component_name),''),component_id)
     OR component_type IS DISTINCT FROM coalesce(nullif(trim(component_type),''),'DISPLAY')
     OR owner_domain IS DISTINCT FROM coalesce(nullif(trim(owner_domain),''),'COMMON')
     OR nullif(trim(props_schema_json::text),'') IS NULL
     OR design_reference IS DISTINCT FROM coalesce(nullif(trim(design_reference),''),'KRDS_GOV_DEFAULT')
     OR nullif(trim(default_props::text),'') IS NULL
     OR category IS DISTINCT FROM coalesce(nullif(trim(category),''),'COMMON'));

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

UPDATE framework_common_design_asset_source_state
   SET asset_fingerprint=framework_common_design_asset_fingerprint(canonical_asset)
 WHERE asset_type IN ('THEME','SECTION','COMPONENT')
   AND asset_fingerprint IS NULL;

-- An exact manifest composition is authoritative during bootstrap. Rebuild its
-- page map now so manifest, renderer input and source head cannot drift.
UPDATE ui_page_manifest page
   SET layout_version=framework_try_jsonb(page.component_schema)->>'layout',
       design_token_version=framework_try_jsonb(page.component_schema)->>'theme',
       updated_at=current_timestamp
 WHERE framework_common_design_screen_composition_exact(
       framework_try_jsonb(page.component_schema))
   AND EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
        WHERE source.asset_type='THEME'
          AND source.asset_id=framework_try_jsonb(page.component_schema)->>'theme'
          AND source.asset_fingerprint IS NOT NULL)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        framework_try_jsonb(page.component_schema)->'sections') section
        WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
           WHERE source.asset_type='SECTION' AND source.asset_id=section->>'sectionId'
             AND source.asset_fingerprint IS NOT NULL))
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        framework_try_jsonb(page.component_schema)->'components') component
        WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
           WHERE source.asset_type='COMPONENT' AND source.asset_id=component->>'componentId'
             AND source.asset_fingerprint IS NOT NULL));

WITH exact_pages AS (
  SELECT page.page_id,framework_try_jsonb(page.component_schema) composition
    FROM ui_page_manifest page
   WHERE framework_common_design_screen_composition_exact(
           framework_try_jsonb(page.component_schema))
     AND EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
          WHERE source.asset_type='THEME'
            AND source.asset_id=framework_try_jsonb(page.component_schema)->>'theme'
            AND source.asset_fingerprint IS NOT NULL)
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
          framework_try_jsonb(page.component_schema)->'sections') section
          WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
             WHERE source.asset_type='SECTION' AND source.asset_id=section->>'sectionId'
               AND source.asset_fingerprint IS NOT NULL))
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
          framework_try_jsonb(page.component_schema)->'components') component
          WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
             WHERE source.asset_type='COMPONENT' AND source.asset_id=component->>'componentId'
               AND source.asset_fingerprint IS NOT NULL))
)
DELETE FROM ui_page_component_map mapping USING exact_pages page
 WHERE mapping.page_id=page.page_id;

WITH exact_pages AS (
  SELECT page.page_id,framework_try_jsonb(page.component_schema) composition
    FROM ui_page_manifest page
   WHERE framework_common_design_screen_composition_exact(
           framework_try_jsonb(page.component_schema))
     AND EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
          WHERE source.asset_type='THEME'
            AND source.asset_id=framework_try_jsonb(page.component_schema)->>'theme'
            AND source.asset_fingerprint IS NOT NULL)
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
          framework_try_jsonb(page.component_schema)->'sections') section
          WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
             WHERE source.asset_type='SECTION' AND source.asset_id=section->>'sectionId'
               AND source.asset_fingerprint IS NOT NULL))
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
          framework_try_jsonb(page.component_schema)->'components') component
          WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
             WHERE source.asset_type='COMPONENT' AND source.asset_id=component->>'componentId'
               AND source.asset_fingerprint IS NOT NULL))
)
INSERT INTO ui_page_component_map(
  map_id,page_id,layout_zone,component_id,instance_key,display_order,
  conditional_rule_summary,instance_props,created_at,updated_at)
SELECT 'MIG_MAP_'||upper(md5(page.page_id||chr(31)||
       (component->>'instanceKey'))),
       page.page_id,section->>'zone',component->>'componentId',
       component->>'instanceKey',(component->>'displayOrder')::integer,
       component->>'condition',(component->'props')::text,
       current_timestamp,current_timestamp
  FROM exact_pages page
 CROSS JOIN LATERAL jsonb_array_elements(page.composition->'components') component
 JOIN LATERAL (
   SELECT section FROM jsonb_array_elements(page.composition->'sections') section
    WHERE section->>'sectionId'=component->>'sectionId'
 ) exact_section ON true;

INSERT INTO framework_common_design_asset_source_state(
    asset_type, asset_id, canonical_asset, asset_fingerprint, updated_by)
WITH runtime_composition AS (
SELECT page.*,
       coalesce(case when framework_common_design_screen_composition_exact(existing.value)
                     then existing.value->'sections' end,
                section.sections,'[]'::jsonb) AS sections,
       coalesce(case when framework_common_design_screen_composition_exact(existing.value)
                     then existing.value->'components' end,
                component.components,'[]'::jsonb) AS components,
       coalesce(case when framework_common_design_screen_composition_exact(existing.value)
                     then nullif(existing.value->>'layout','') end,
                nullif(trim(page.layout_version),''),'KRDS_WORKSPACE') AS exact_layout,
       coalesce(case when framework_common_design_screen_composition_exact(existing.value)
                     then nullif(existing.value->>'theme','') end,
                nullif(trim(page.design_token_version),''),'KRDS_GOV_DEFAULT') AS exact_theme
  FROM ui_page_manifest page
  LEFT JOIN LATERAL (
      SELECT framework_try_jsonb(page.component_schema) value
  ) existing ON true
  LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'sectionId','MIG_ZONE_'||upper(md5(
                   page.page_id||chr(31)||mapping.layout_zone)),
               'zone',mapping.layout_zone,
               'displayOrder',mapping.display_order,
               'props','{}'::jsonb)
             ORDER BY mapping.display_order,mapping.layout_zone COLLATE "C") AS sections
        FROM (SELECT layout_zone,min(display_order) display_order
                FROM ui_page_component_map WHERE page_id=page.page_id
               GROUP BY layout_zone) mapping
  ) section ON true
  LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'componentId',mapping.component_id,
               'sectionId','MIG_ZONE_'||upper(md5(
                   page.page_id||chr(31)||mapping.layout_zone)),
               'instanceKey',coalesce(nullif(trim(mapping.instance_key),''),
                   mapping.component_id||'-'||mapping.display_order),
               'displayOrder',mapping.display_order,
               'props',coalesce(framework_try_jsonb(mapping.instance_props),'{}'::jsonb),
               'condition',coalesce(nullif(trim(mapping.conditional_rule_summary),''),'always'))
             ORDER BY mapping.display_order,mapping.map_id COLLATE "C") AS components
        FROM ui_page_component_map mapping WHERE mapping.page_id=page.page_id
  ) component ON true
), screen_assets AS (
SELECT page.page_id,
       jsonb_build_object(
           'assetType','SCREEN','assetId',page.page_id,
           'assetName',coalesce(nullif(trim(page.page_name),''),page.page_id),
           'routePath',case when coalesce(trim(page.route_path),'')='' then ''
             else coalesce(nullif(regexp_replace(split_part(split_part(
               trim(page.route_path),'?',1),'#',1),'/{2,}','/','g'),''),'/') end,
           'version',coalesce(nullif(trim(page.version_id),''),
               nullif(trim(page.layout_version),''),'v1'),
           'active',(page.active_yn='Y'),
           'payload',jsonb_build_object(
               'schemaVersion','1.0.0',
               'pageName',coalesce(nullif(trim(page.page_name),''),page.page_id),
               'layout',page.exact_layout,
               'theme',page.exact_theme,
               'sections',page.sections,
               'components',page.components,
               'dependencies',coalesce(dependency.dependencies,'[]'::jsonb)))
         AS canonical_asset
  FROM runtime_composition page
  LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'assetType',edge.asset_type,'assetId',edge.asset_id,
               'fingerprint',trim(source.asset_fingerprint))
             ORDER BY edge.asset_type COLLATE "C",edge.asset_id COLLATE "C")
               AS dependencies
        FROM (
          SELECT 'THEME'::text asset_type,page.exact_theme::text asset_id
          UNION
          SELECT 'SECTION',section->>'sectionId'
            FROM jsonb_array_elements(page.sections) section
          UNION
          SELECT 'COMPONENT',component->>'componentId'
            FROM jsonb_array_elements(page.components) component
        ) edge
        JOIN framework_common_design_asset_source_state source
          ON source.asset_type=edge.asset_type AND source.asset_id=edge.asset_id
         AND source.asset_fingerprint IS NOT NULL
  ) dependency ON true
 WHERE page.page_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,199}$'
   AND framework_common_design_screen_composition_exact(jsonb_build_object(
       'schema','carbonet.screen-composition/v1','layout',page.exact_layout,
       'theme',page.exact_theme,'sections',page.sections,
       'components',page.components))
   AND EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
       WHERE source.asset_type='THEME' AND source.asset_id=page.exact_theme
         AND source.asset_fingerprint IS NOT NULL)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page.sections) section
       WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
          WHERE source.asset_type='SECTION' AND source.asset_id=section->>'sectionId'
            AND source.asset_fingerprint IS NOT NULL))
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page.components) component
       WHERE NOT EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
          WHERE source.asset_type='COMPONENT' AND source.asset_id=component->>'componentId'
            AND source.asset_fingerprint IS NOT NULL))
) SELECT 'SCREEN',page_id,canonical_asset,
         framework_common_design_asset_fingerprint(canonical_asset),
         'MIGRATION_RUNTIME_BACKFILL'
    FROM screen_assets
ON CONFLICT (asset_type,asset_id) DO NOTHING;

UPDATE ui_page_manifest page
   SET page_name=source.canonical_asset->>'assetName',
       version_id=source.canonical_asset->>'version',
       layout_version=source.canonical_asset#>>'{payload,layout}',
       design_token_version=source.canonical_asset#>>'{payload,theme}',
       updated_at=current_timestamp
  FROM framework_common_design_asset_source_state source
 WHERE source.asset_type='SCREEN' AND source.asset_id=page.page_id
   AND (page.page_name IS DISTINCT FROM source.canonical_asset->>'assetName'
     OR page.version_id IS DISTINCT FROM source.canonical_asset->>'version'
     OR page.layout_version IS DISTINCT FROM source.canonical_asset#>>'{payload,layout}'
     OR page.design_token_version IS DISTINCT FROM source.canonical_asset#>>'{payload,theme}');

-- Finish the one-time legacy projection so the runtime registry and its new
-- source head describe the same exact composition. Subsequent writes are made
-- only by the globally authorized source transaction.
WITH legacy_composition AS (
  SELECT page.page_id,
         jsonb_build_object(
           'schema','carbonet.screen-composition/v1',
           'layout',coalesce(nullif(trim(page.layout_version),''),'KRDS_WORKSPACE'),
           'theme',coalesce(nullif(trim(page.design_token_version),''),'KRDS_GOV_DEFAULT'),
           'sections',coalesce(section.sections,'[]'::jsonb),
           'components',coalesce(component.components,'[]'::jsonb)) composition
    FROM ui_page_manifest page
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'sectionId','MIG_ZONE_'||upper(md5(
                   page.page_id||chr(31)||mapping.layout_zone)),
               'zone',mapping.layout_zone,'displayOrder',mapping.display_order,
               'props','{}'::jsonb)
             ORDER BY mapping.display_order,mapping.layout_zone COLLATE "C") sections
        FROM (SELECT layout_zone,min(display_order) display_order
                FROM ui_page_component_map WHERE page_id=page.page_id
               GROUP BY layout_zone) mapping
    ) section ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'componentId',mapping.component_id,
               'sectionId','MIG_ZONE_'||upper(md5(
                   page.page_id||chr(31)||mapping.layout_zone)),
               'instanceKey',coalesce(nullif(trim(mapping.instance_key),''),
                   mapping.component_id||'-'||mapping.display_order),
               'displayOrder',mapping.display_order,
               'props',coalesce(framework_try_jsonb(mapping.instance_props),'{}'::jsonb),
               'condition',coalesce(nullif(trim(mapping.conditional_rule_summary),''),'always'))
             ORDER BY mapping.display_order,mapping.map_id COLLATE "C") components
        FROM ui_page_component_map mapping WHERE mapping.page_id=page.page_id
    ) component ON true
   WHERE NOT coalesce(framework_common_design_screen_composition_exact(
     framework_try_jsonb(page.component_schema)),false)
)
UPDATE ui_page_manifest page
   SET component_schema=legacy.composition::text,updated_at=current_timestamp
  FROM legacy_composition legacy
 WHERE page.page_id=legacy.page_id
   AND EXISTS(SELECT 1 FROM framework_common_design_asset_source_state source
       WHERE source.asset_type='SCREEN' AND source.asset_id=page.page_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
    ON framework_common_design_asset_source_state FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
    ON framework_common_design_source_receipt FROM PUBLIC;
REVOKE ALL ON FUNCTION framework_common_design_stable_json(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION framework_common_design_asset_fingerprint(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION framework_common_design_screen_composition_exact(jsonb) FROM PUBLIC;
