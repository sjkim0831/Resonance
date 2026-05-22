-- Carbonet ecoinvent row-level product-name Korean/English exact mapping.
-- This patch intentionally maps only ecoinvent_master.product_name, not
-- activity, geography, indicator, or legacy classification aliases.

DELETE FROM emission_material_translation
WHERE raw_name LIKE 'ecoinvent:%';

INSERT INTO emission_material_translation (
  raw_name,
  ecoinvent_master_id,
  korean_name,
  english_name,
  english_exact_name,
  source_type,
  mapping_status,
  mapping_note
)
SELECT
  'ecoinvent:' || CAST(m.id AS VARCHAR(40)) AS raw_name,
  m.id AS ecoinvent_master_id,
  SUBSTR(COALESCE(m.product_name, m.material_name, 'ecoinvent dataset'), 1, 1000) AS korean_name,
  SUBSTR(COALESCE(m.product_name, m.material_name, 'ecoinvent dataset'), 1, 1000) AS english_name,
  SUBSTR(COALESCE(m.product_name, m.material_name, 'ecoinvent dataset'), 1, 2000) AS english_exact_name,
  'ECOINVENT_PRODUCT_EXACT' AS source_type,
  'PRODUCT_KO_PENDING_AI' AS mapping_status,
  'ecoinvent_master product_name exact row mapping only' AS mapping_note
FROM ecoinvent_master m;

COMMIT;
