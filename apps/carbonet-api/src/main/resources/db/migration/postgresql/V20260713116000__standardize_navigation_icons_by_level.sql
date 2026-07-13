-- A large navigation tree is easier to scan when icons communicate hierarchy,
-- rather than assigning arbitrary semantic icons to hundreds of entries.
UPDATE comtnmenuinfo
SET menu_icon = CASE
        WHEN menu_code ~ '^[HA][0-9]{3}$' THEN 'folder'
        WHEN menu_code ~ '^[HA][0-9]{5}$' THEN 'folder'
        WHEN menu_code ~ '^[HA][0-9]{7}$' THEN 'article'
        ELSE menu_icon
    END,
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE use_at='Y'
  AND expsr_at='Y'
  AND menu_code ~ '^[HA][0-9]{3}([0-9]{2})?([0-9]{2})?$';
