UPDATE comtnmenuinfo
SET menu_url = '/admin/system/menu-management?menuType=LEGACY_ADMIN',
    last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code IN ('A112','A11201','A1120101');
