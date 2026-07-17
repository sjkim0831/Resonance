-- Remove duplicate draft page assets and archive incomplete drafts without a mapped replacement.
DELETE FROM ui_page_manifest p
WHERE p.active_yn = 'Y'
  AND p.version_status = 'DRAFT'
  AND NOT EXISTS (
    SELECT 1 FROM ui_page_component_map m WHERE m.page_id = p.page_id
  )
  AND EXISTS (
    SELECT 1
    FROM ui_page_manifest replacement
    JOIN ui_page_component_map mapped ON mapped.page_id = replacement.page_id
    WHERE replacement.route_path = p.route_path
      AND replacement.page_id <> p.page_id
      AND replacement.active_yn = 'Y'
  );

UPDATE ui_page_manifest p
SET active_yn = 'N', updated_at = current_timestamp
WHERE p.active_yn = 'Y'
  AND p.version_status = 'DRAFT'
  AND NOT EXISTS (
    SELECT 1 FROM ui_page_component_map m WHERE m.page_id = p.page_id
  );

INSERT INTO framework_asset_sync_run
  (asset_type,source_path,discovered_count,registered_count,duplicate_count,sync_status,executed_by,executed_at)
VALUES('DRAFT_PAGE_ASSET_CLEANUP','unmapped-draft-page-normalization',229,76,153,'COMPLETED','FLYWAY',current_timestamp);
