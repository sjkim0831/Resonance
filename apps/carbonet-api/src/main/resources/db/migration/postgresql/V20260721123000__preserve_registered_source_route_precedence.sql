-- A generated runtime is a fallback. It must never replace an active source
-- implementation registered in both the page manifest and design asset registry.

CREATE OR REPLACE FUNCTION framework_preserve_registered_source_route()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    registered_source varchar(500);
BEGIN
    IF NEW.implementation_strategy = 'GENERATED_RUNTIME' THEN
        SELECT asset.source_path
          INTO registered_source
          FROM framework_design_asset_registry asset
          JOIN ui_page_manifest page
            ON lower(split_part(page.route_path, '?', 1)) = lower(split_part(asset.route_path, '?', 1))
           AND page.active_yn = 'Y'
         WHERE asset.active_yn = 'Y'
           AND trim(asset.source_path) <> ''
           AND lower(split_part(asset.route_path, '?', 1)) = lower(split_part(NEW.route_path, '?', 1))
         ORDER BY asset.updated_at DESC
         LIMIT 1;

        IF registered_source IS NOT NULL THEN
            NEW.implementation_strategy := 'ADOPT_EXISTING';
            NEW.source_reference := registered_source;
            NEW.transition_status := 'CONTRACT_LINKED';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_registered_source_route ON framework_screen_blueprint;
CREATE TRIGGER trg_preserve_registered_source_route
BEFORE INSERT OR UPDATE OF route_path, implementation_strategy
ON framework_screen_blueprint
FOR EACH ROW
EXECUTE FUNCTION framework_preserve_registered_source_route();

WITH registered_source AS (
    SELECT DISTINCT ON (lower(split_part(asset.route_path, '?', 1)))
           lower(split_part(asset.route_path, '?', 1)) AS normalized_route,
           asset.source_path
      FROM framework_design_asset_registry asset
      JOIN ui_page_manifest page
        ON lower(split_part(page.route_path, '?', 1)) = lower(split_part(asset.route_path, '?', 1))
       AND page.active_yn = 'Y'
     WHERE asset.active_yn = 'Y'
       AND trim(asset.source_path) <> ''
     ORDER BY lower(split_part(asset.route_path, '?', 1)), asset.updated_at DESC
)
UPDATE framework_screen_blueprint blueprint
   SET implementation_strategy = 'ADOPT_EXISTING',
       source_reference = source.source_path,
       transition_status = 'CONTRACT_LINKED',
       updated_at = CURRENT_TIMESTAMP
  FROM registered_source source
 WHERE blueprint.implementation_strategy = 'GENERATED_RUNTIME'
   AND source.normalized_route = lower(split_part(blueprint.route_path, '?', 1));

CREATE OR REPLACE VIEW framework_registered_source_route_conflict AS
SELECT blueprint.blueprint_id,
       blueprint.audience,
       blueprint.route_path,
       blueprint.implementation_strategy,
       asset.source_path
  FROM framework_screen_blueprint blueprint
  JOIN framework_design_asset_registry asset
    ON lower(split_part(asset.route_path, '?', 1)) = lower(split_part(blueprint.route_path, '?', 1))
   AND asset.active_yn = 'Y'
   AND trim(asset.source_path) <> ''
  JOIN ui_page_manifest page
    ON lower(split_part(page.route_path, '?', 1)) = lower(split_part(blueprint.route_path, '?', 1))
   AND page.active_yn = 'Y'
 WHERE blueprint.implementation_strategy = 'GENERATED_RUNTIME';
