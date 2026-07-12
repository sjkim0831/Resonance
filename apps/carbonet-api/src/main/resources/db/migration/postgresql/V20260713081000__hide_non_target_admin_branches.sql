UPDATE comtnmenuinfo
SET use_at='N', expsr_at='N', last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code LIKE 'A1%'
  AND left(menu_code,4) NOT IN ('A101','A102','A103','A104','A105','A106','A107','A108','A109','A110','A111','A112');

UPDATE comtccmmndetailcode
SET use_at='N', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='MENU_REORG'
WHERE code_id='AMENU1' AND code LIKE 'A1%'
  AND left(code,4) NOT IN ('A101','A102','A103','A104','A105','A106','A107','A108','A109','A110','A111','A112');
