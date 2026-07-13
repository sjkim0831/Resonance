-- Remove duplicate external-integration branches; canonical items under A11001 remain active.
UPDATE comtnmenuinfo
SET use_at='N',
    expsr_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('A11002','A1100205','A1100206','A11003','A1100304');

UPDATE comtccmmndetailcode
SET use_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP,
    last_updusr_id='MENU_EXTERNAL_FIX'
WHERE code IN ('A11002','A1100205','A1100206','A11003','A1100304')
  AND code_id IN ('AMENU1','MENU');
