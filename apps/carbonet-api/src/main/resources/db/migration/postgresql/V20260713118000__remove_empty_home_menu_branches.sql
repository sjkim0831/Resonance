-- Remove empty duplicate branches below the Home top-level menu.
UPDATE comtnmenuinfo
SET use_at='N',
    expsr_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('H10102','H10103');

UPDATE comtccmmndetailcode
SET use_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP,
    last_updusr_id='MENU_HOME_FIX'
WHERE code IN ('H10102','H10103')
  AND code_id IN ('HMENU1','MENU');
