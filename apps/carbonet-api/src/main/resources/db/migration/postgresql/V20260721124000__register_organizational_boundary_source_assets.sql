-- Register the source-backed routes completed after the last bulk design asset
-- inventory snapshot. The generic precedence trigger can then protect them.

INSERT INTO framework_design_asset_registry
    (design_asset_id, page_id, route_path, menu_code, domain_code,
     layout_version, design_token_version, composition_json, source_path,
     asset_fingerprint, active_yn, created_at, updated_at)
VALUES
    ('SCREEN_EMISSION_ORG_BOUNDARY_USER', 'EMISSION_ORG_BOUNDARY_USER',
     '/emission/organizational-boundary', NULL, 'EMISSION', '1.0.0',
     'KRDS_GOV_DEFAULT',
     '{"layout":"DETAIL_WORKSPACE","component":"COMMON_CONTENT_CARD","sourceBacked":true,"audience":"USER"}'::jsonb,
     'projects/carbonet-frontend/source/src/features/organizational-boundary/OrganizationalBoundaryPage.tsx',
     md5('EMISSION_ORG_BOUNDARY_USER|features/organizational-boundary/OrganizationalBoundaryPage.tsx'),
     'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('SCREEN_EMISSION_ORG_BOUNDARY_ADMIN', 'EMISSION_ORG_BOUNDARY_ADMIN',
     '/admin/emission/organizational-boundary', NULL, 'EMISSION_ADMIN', '1.0.0',
     'KRDS_GOV_DEFAULT',
     '{"layout":"DETAIL_WORKSPACE","component":"COMMON_CONTENT_CARD","sourceBacked":true,"audience":"ADMIN"}'::jsonb,
     'projects/carbonet-frontend/source/src/features/organizational-boundary/OrganizationalBoundaryPage.tsx',
     md5('EMISSION_ORG_BOUNDARY_ADMIN|features/organizational-boundary/OrganizationalBoundaryPage.tsx'),
     'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (design_asset_id) DO UPDATE
SET page_id = EXCLUDED.page_id,
    route_path = EXCLUDED.route_path,
    domain_code = EXCLUDED.domain_code,
    layout_version = EXCLUDED.layout_version,
    design_token_version = EXCLUDED.design_token_version,
    composition_json = EXCLUDED.composition_json,
    source_path = EXCLUDED.source_path,
    asset_fingerprint = EXCLUDED.asset_fingerprint,
    active_yn = 'Y',
    updated_at = CURRENT_TIMESTAMP;

UPDATE framework_screen_blueprint blueprint
   SET implementation_strategy = 'ADOPT_EXISTING',
       source_reference = asset.source_path,
       transition_status = 'CONTRACT_LINKED',
       updated_at = CURRENT_TIMESTAMP
  FROM framework_design_asset_registry asset
 WHERE asset.active_yn = 'Y'
   AND lower(split_part(asset.route_path, '?', 1)) = lower(split_part(blueprint.route_path, '?', 1))
   AND lower(split_part(blueprint.route_path, '?', 1)) IN (
       '/emission/organizational-boundary',
       '/admin/emission/organizational-boundary'
   );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM framework_screen_blueprint
         WHERE lower(split_part(route_path, '?', 1)) IN (
             '/emission/organizational-boundary',
             '/admin/emission/organizational-boundary'
         )
           AND implementation_strategy <> 'ADOPT_EXISTING'
    ) THEN
        RAISE EXCEPTION 'organizational boundary source route precedence was not applied';
    END IF;
END;
$$;
