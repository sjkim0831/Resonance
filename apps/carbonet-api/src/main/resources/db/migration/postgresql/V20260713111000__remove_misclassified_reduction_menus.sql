-- These existing emission result/history screens were incorrectly classified as reduction menus.
UPDATE comtnmenuinfo
SET use_at='N',
    expsr_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('A10502','A1050203','A10503','A1050304');

UPDATE comtccmmndetailcode
SET use_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP,
    last_updusr_id='MENU_REDUCTION_FIX'
WHERE code IN ('A10502','A1050203','A10503','A1050304')
  AND code_id IN ('AMENU1','MENU');
