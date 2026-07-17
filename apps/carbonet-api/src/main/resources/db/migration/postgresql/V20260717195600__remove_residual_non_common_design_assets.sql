-- Preserve page bindings while removing every residual non-common component asset.
UPDATE ui_page_component_map m
SET component_id = CASE
  WHEN c.component_id IN ('DYN_OVERVIEW_HEADER','ManagedPageHeader') THEN 'COMMON_PAGE_HEADER'
  WHEN c.component_id = 'DYN_OVERVIEW_KPI' THEN 'COMMON_SUMMARY_METRIC'
  WHEN c.component_id = 'DYN_OVERVIEW_STEPS' THEN 'COMMON_STEP_FLOW'
  WHEN c.component_id IN ('DYN_OVERVIEW_TABLE','TABLE_BASIC','TraceEventTable') THEN 'COMMON_DATA_TABLE'
  WHEN c.component_id IN ('BTN_PRIMARY','ManagedPageActions') THEN 'COMMON_ACTION_BAR'
  WHEN c.component_id IN ('INPUT_TEXT','UNIT_CATEGORY_SELECT_PAIR') THEN 'COMMON_FORM_FIELD'
  ELSE 'COMMON_DETAIL_PANEL'
END
FROM ui_component_registry c
WHERE c.component_id = m.component_id
  AND coalesce(c.category, '') <> 'COMMON';

DELETE FROM ui_component_registry WHERE coalesce(category, '') <> 'COMMON';
DELETE FROM comtncomponentinfo WHERE component_id NOT IN (
  SELECT left(component_id, 50) FROM ui_component_registry WHERE category = 'COMMON'
);

INSERT INTO framework_asset_sync_run
  (asset_type,source_path,discovered_count,registered_count,duplicate_count,sync_status,executed_by,executed_at)
VALUES('COMMON_COMPONENT_CLEANUP','residual-component-normalization',15,20,15,'COMPLETED','FLYWAY',current_timestamp);
