-- Store reusable property contracts once and keep page-specific values on component instances.
CREATE TABLE IF NOT EXISTS ui_common_property_registry (
  property_id varchar(50) PRIMARY KEY,
  property_name varchar(120) NOT NULL,
  data_type varchar(30) NOT NULL,
  schema_json jsonb NOT NULL,
  asset_fingerprint varchar(64) NOT NULL UNIQUE,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS ui_component_property_map (
  component_id varchar(100) NOT NULL REFERENCES ui_component_registry(component_id) ON DELETE CASCADE,
  property_id varchar(50) NOT NULL REFERENCES ui_common_property_registry(property_id) ON DELETE RESTRICT,
  required_yn char(1) NOT NULL DEFAULT 'N',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(component_id, property_id)
);

ALTER TABLE ui_page_component_map ADD COLUMN IF NOT EXISTS instance_props text NOT NULL DEFAULT '{}';

WITH discovered AS (
  SELECT DISTINCT property.key AS property_name,
         property.value AS schema_json,
         md5(lower(property.key) || '|' || property.value::text) AS fingerprint
  FROM ui_component_registry component
  CROSS JOIN LATERAL jsonb_each(coalesce((component.props_schema_json::jsonb)->'properties','{}'::jsonb)) property
  WHERE component.active_yn = 'Y'
)
INSERT INTO ui_common_property_registry
  (property_id,property_name,data_type,schema_json,asset_fingerprint,active_yn)
SELECT 'PROP_' || upper(substr(fingerprint,1,16)), property_name,
       coalesce(schema_json->>'type','object'), schema_json, fingerprint, 'Y'
FROM discovered
ON CONFLICT(asset_fingerprint) DO UPDATE SET
  property_name=excluded.property_name,
  data_type=excluded.data_type,
  schema_json=excluded.schema_json,
  active_yn='Y',
  updated_at=current_timestamp;

INSERT INTO ui_component_property_map(component_id,property_id,required_yn,display_order)
SELECT component.component_id, property_registry.property_id,
       CASE WHEN coalesce((component.props_schema_json::jsonb)->'required','[]'::jsonb) ? property.key THEN 'Y' ELSE 'N' END,
       row_number() OVER (PARTITION BY component.component_id ORDER BY property.key)
FROM ui_component_registry component
CROSS JOIN LATERAL jsonb_each(coalesce((component.props_schema_json::jsonb)->'properties','{}'::jsonb)) property
JOIN ui_common_property_registry property_registry
  ON property_registry.asset_fingerprint=md5(lower(property.key) || '|' || property.value::text)
WHERE component.active_yn='Y'
ON CONFLICT(component_id,property_id) DO UPDATE SET
  required_yn=excluded.required_yn,
  display_order=excluded.display_order;

CREATE UNIQUE INDEX IF NOT EXISTS uq_common_property_name_schema
  ON ui_common_property_registry(lower(property_name), schema_json)
  WHERE active_yn='Y';
CREATE INDEX IF NOT EXISTS idx_component_property_property
  ON ui_component_property_map(property_id,component_id);

INSERT INTO framework_asset_sync_run
  (asset_type,source_path,discovered_count,registered_count,duplicate_count,sync_status,executed_by,executed_at)
SELECT 'COMMON_PROPERTY_REGISTRY','component-props-normalization',
       (SELECT count(*) FROM ui_component_property_map),
       (SELECT count(*) FROM ui_common_property_registry),0,'COMPLETED','FLYWAY',current_timestamp;
