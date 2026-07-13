-- These are in-page emission workflow tabs, not home-navigation entries.
UPDATE comtnmenuinfo
SET use_at='N',
    expsr_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN (
  'H1020406','H1020407','H1020408','H1020409',
  'H1020410','H1020411','H1020412'
);

UPDATE comtccmmndetailcode
SET use_at='N',
    last_updt_pnttm=CURRENT_TIMESTAMP,
    last_updusr_id='MENU_HOME_TAB_FIX'
WHERE code IN (
  'H1020406','H1020407','H1020408','H1020409',
  'H1020410','H1020411','H1020412'
)
AND code_id IN ('HMENU1','MENU');
