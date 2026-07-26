INSERT INTO comtnmenuinfo (
    menu_code, menu_nm, menu_nm_en, menu_url, menu_icon,
    use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at
)
VALUES (
    'A1120162', 'Omniverse USD 작업실', 'Omniverse USD Workspace',
    '/admin/system/omniverse', 'view_in_ar', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y'
)
ON CONFLICT (menu_code) DO UPDATE
SET menu_nm = EXCLUDED.menu_nm,
    menu_nm_en = EXCLUDED.menu_nm_en,
    menu_url = EXCLUDED.menu_url,
    menu_icon = EXCLUDED.menu_icon,
    use_at = 'Y',
    expsr_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
VALUES ('A1120162', 1120162, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (menu_code) DO UPDATE
SET sort_ordr = EXCLUDED.sort_ordr,
    last_updt_pnttm = CURRENT_TIMESTAMP;
