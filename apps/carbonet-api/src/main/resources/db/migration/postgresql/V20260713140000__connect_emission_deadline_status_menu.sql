UPDATE comtnmenuinfo
SET menu_nm='마감·지연 현황',menu_nm_en='Deadline & Delay Status',menu_url='/emission/deadline-status',menu_icon='event_busy',use_at='Y',expsr_at='Y',last_updt_pnttm=current_timestamp
WHERE menu_code='H1020104';

UPDATE comtccmmndetailcode
SET code_nm='마감·지연 현황',code_dc='/emission/deadline-status',use_at='Y',last_updt_pnttm=current_timestamp,last_updusr_id='DEADLINE_STATUS_MENU'
WHERE code_id='HMENU1' AND code='H1020104';
