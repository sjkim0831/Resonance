-- Remove duplicate/misclassified workflow and audit branches only.
-- Canonical approval workflow and system audit-log menus remain active.
UPDATE comtnmenuinfo
SET use_at='N',
    expsr_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('A10702','A1070201','A1070202','A10703','A1070304');

UPDATE comtccmmndetailcode
SET use_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP,
    last_updusr_id='MENU_WORKFLOW_FIX'
WHERE code IN ('A10702','A1070201','A1070202','A10703','A1070304')
  AND code_id IN ('AMENU1','MENU');
