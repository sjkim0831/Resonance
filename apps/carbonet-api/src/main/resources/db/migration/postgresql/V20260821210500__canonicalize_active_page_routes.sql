CREATE TABLE IF NOT EXISTS framework_page_route_canonicalization_audit (
  audit_id bigserial PRIMARY KEY,
  normalized_route varchar(600) NOT NULL,
  canonical_page_id varchar(180) NOT NULL,
  retired_page_id varchar(180) NOT NULL,
  retired_page_name varchar(300),
  retired_version_status varchar(40),
  reason_code varchar(80) NOT NULL,
  executed_by varchar(100) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(normalized_route,retired_page_id)
);

LOCK TABLE ui_page_manifest IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
  SELECT p.page_id,p.page_name,p.version_status,
         lower(regexp_replace(split_part(trim(p.route_path),'?',1),'/+$','')) normalized_route,
         first_value(p.page_id) OVER (
           PARTITION BY lower(regexp_replace(split_part(trim(p.route_path),'?',1),'/+$',''))
           ORDER BY CASE WHEN left(p.page_id,6)='ADOPT_' THEN 1 ELSE 0 END,
                    CASE p.version_status WHEN 'PUBLISHED' THEN 0 WHEN 'ACTIVE' THEN 1
                         WHEN 'VALID' THEN 2 WHEN 'DRAFT' THEN 3 ELSE 4 END,
                    (SELECT count(*) FROM ui_page_component_map m WHERE m.page_id=p.page_id) DESC,
                    p.page_id
         ) canonical_page_id,
         count(*) OVER (
           PARTITION BY lower(regexp_replace(split_part(trim(p.route_path),'?',1),'/+$',''))
         ) route_count
    FROM ui_page_manifest p
   WHERE p.active_yn='Y' AND nullif(trim(p.route_path),'') IS NOT NULL
), duplicates AS (
  SELECT * FROM ranked WHERE route_count>1 AND page_id<>canonical_page_id
)
INSERT INTO framework_page_route_canonicalization_audit(
  normalized_route,canonical_page_id,retired_page_id,retired_page_name,
  retired_version_status,reason_code,executed_by
)
SELECT normalized_route,canonical_page_id,page_id,page_name,version_status,
       'DUPLICATE_ACTIVE_ROUTE','FLYWAY_V20260821210500'
  FROM duplicates
ON CONFLICT(normalized_route,retired_page_id) DO NOTHING;

UPDATE ui_page_manifest page
   SET active_yn='N',updated_at=current_timestamp
  FROM framework_page_route_canonicalization_audit audit
 WHERE audit.executed_by='FLYWAY_V20260821210500'
   AND page.page_id=audit.retired_page_id
   AND page.active_yn='Y';

UPDATE framework_unified_asset asset
   SET active_yn='N',updated_at=current_timestamp
 WHERE asset.asset_type='PAGE'
   AND asset.active_yn='Y'
   AND asset.asset_id LIKE 'PAGE:%'
   AND EXISTS (
     SELECT 1 FROM ui_page_manifest page
      WHERE page.page_id=substring(asset.asset_id from 6) AND page.active_yn='N'
   );

UPDATE framework_unified_asset_relation relation
   SET active_yn='N',updated_at=current_timestamp
 WHERE relation.active_yn='Y'
   AND (EXISTS (SELECT 1 FROM framework_unified_asset asset
                WHERE asset.asset_id=relation.source_asset_id AND asset.active_yn='N')
     OR EXISTS (SELECT 1 FROM framework_unified_asset asset
                WHERE asset.asset_id=relation.target_asset_id AND asset.active_yn='N'));

DO $$
DECLARE duplicate_routes integer;
BEGIN
  SELECT count(*) INTO duplicate_routes
    FROM (
      SELECT lower(regexp_replace(split_part(trim(route_path),'?',1),'/+$',''))
        FROM ui_page_manifest
       WHERE active_yn='Y' AND nullif(trim(route_path),'') IS NOT NULL
       GROUP BY 1 HAVING count(*)>1
    ) duplicate;
  IF duplicate_routes<>0 THEN
    RAISE EXCEPTION 'active page route canonicalization incomplete: % duplicate routes',duplicate_routes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ui_page_manifest_active_route
  ON ui_page_manifest(lower(regexp_replace(split_part(trim(route_path),'?',1),'/+$','')))
  WHERE active_yn='Y' AND nullif(trim(route_path),'') IS NOT NULL;

SELECT * FROM framework_refresh_unified_asset_catalog('FLYWAY_V20260821210500');
