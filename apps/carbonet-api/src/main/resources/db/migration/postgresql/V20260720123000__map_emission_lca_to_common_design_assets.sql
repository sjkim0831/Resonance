-- Bind Product LCA to existing reusable KRDS assets without creating duplicates.
INSERT INTO ui_page_component_map
  (map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at)
SELECT values_row.*
FROM (VALUES
  ('EMISSION_LCA_COMMON_01','emission-lca','header','COMMON_STEP_FLOW','emission-lca-workflow',5,'always',current_timestamp,current_timestamp),
  ('EMISSION_LCA_COMMON_02','emission-lca','actions','COMMON_ACTION_BAR','emission-lca-workflow-actions',6,'always',current_timestamp,current_timestamp),
  ('EMISSION_LCA_COMMON_03','emission-lca','content','COMMON_CONTENT_CARD','emission-lca-workflow-evidence',7,'always',current_timestamp,current_timestamp)
) AS values_row(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at)
WHERE EXISTS (SELECT 1 FROM ui_page_manifest page WHERE page.page_id='emission-lca')
  AND EXISTS (SELECT 1 FROM ui_component_registry component WHERE component.component_id=values_row.component_id AND component.category='COMMON' AND component.active_yn='Y')
ON CONFLICT(map_id) DO UPDATE SET
  page_id=excluded.page_id, layout_zone=excluded.layout_zone, component_id=excluded.component_id,
  instance_key=excluded.instance_key, display_order=excluded.display_order,
  conditional_rule_summary=excluded.conditional_rule_summary, updated_at=current_timestamp;

UPDATE ui_page_manifest SET design_token_version='KRDS_GOV_DEFAULT', updated_at=current_timestamp
WHERE page_id='emission-lca';
