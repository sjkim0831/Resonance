-- FAQ and sitemap belong to content/system navigation, not the Education branch.
UPDATE comtnmenuinfo
SET use_at='N',
    expsr_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('A1080203','A1080206');

UPDATE comtccmmndetailcode
SET use_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP,
    last_updusr_id='MENU_EDUCATION_FIX'
WHERE code IN ('A1080203','A1080206')
  AND code_id IN ('AMENU1','MENU');
