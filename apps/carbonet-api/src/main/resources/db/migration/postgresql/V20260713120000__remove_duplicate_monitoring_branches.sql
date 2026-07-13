-- Remove duplicate monitoring branches; canonical items under H10501 remain active.
UPDATE comtnmenuinfo
SET use_at='N',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('H10502','H1050201','H1050202','H1050203','H10503');

UPDATE comtccmmndetailcode
SET use_at='N',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_MONITORING_FIX'
WHERE code IN ('H10502','H1050201','H1050202','H1050203','H10503')
  AND code_id IN ('HMENU1','MENU');
