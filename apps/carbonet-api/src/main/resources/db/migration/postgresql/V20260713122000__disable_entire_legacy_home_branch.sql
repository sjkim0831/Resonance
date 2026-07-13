-- Prevent orphan legacy-home children from being promoted into visible navigation.
UPDATE comtnmenuinfo
SET use_at='N',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code LIKE 'H109%';

UPDATE comtccmmndetailcode
SET use_at='N',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_LEGACY_HOME_FIX'
WHERE code LIKE 'H109%'
  AND code_id IN ('HMENU1','MENU');
