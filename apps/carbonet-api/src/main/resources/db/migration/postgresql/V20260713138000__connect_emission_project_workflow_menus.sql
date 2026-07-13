UPDATE comtnmenuinfo SET menu_url='/emission/data_input',last_updt_pnttm=current_timestamp WHERE menu_code='H1020201';
UPDATE comtnmenuinfo SET menu_url='/emission/data_input?mode=upload',last_updt_pnttm=current_timestamp WHERE menu_code IN ('H1020203','H102020301');
UPDATE comtnmenuinfo SET menu_url='/emission/data_input?tab=mapping',last_updt_pnttm=current_timestamp WHERE menu_code IN ('H1020408','H102040801');
UPDATE comtnmenuinfo SET menu_url='/emission/result',last_updt_pnttm=current_timestamp WHERE menu_code='H1020302';
UPDATE comtccmmndetailcode d SET code_dc=m.menu_url,last_updt_pnttm=current_timestamp FROM comtnmenuinfo m WHERE d.code=m.menu_code AND d.code_id='HMENU1' AND m.menu_code IN ('H1020201','H1020203','H102020301','H1020408','H102040801','H1020302');
