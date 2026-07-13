-- Remove empty My Page branches and the orphaned legacy emission entry.
UPDATE comtnmenuinfo
SET use_at='N',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('H10802','H10803','H1090101');

UPDATE comtccmmndetailcode
SET use_at='N',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_HOME_CLEANUP'
WHERE code IN ('H10802','H10803','H1090101')
  AND code_id IN ('HMENU1','MENU');
