-- Home navigation exposes only independent pages. Summary data remains in /home sections.
UPDATE comtnmenuinfo
SET use_at='N',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('H1010102','H1010103','H1010104','H1010105','H1010106','H1010108');

UPDATE comtccmmndetailcode
SET use_at='N',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_HOME_NORMALIZE'
WHERE code_id IN ('HMENU1','MENU')
  AND code IN ('H1010102','H1010103','H1010104','H1010105','H1010106','H1010108');

UPDATE comtnmenuinfo
SET menu_url='/home/certificate-verify',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code='H1010107';

UPDATE comtnmenuorder SET sort_ordr=1010101,last_updt_pnttm=CURRENT_TIMESTAMP WHERE menu_code='H1010101';
UPDATE comtnmenuorder SET sort_ordr=1010102,last_updt_pnttm=CURRENT_TIMESTAMP WHERE menu_code='H1010107';
