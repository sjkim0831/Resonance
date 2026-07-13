CREATE TEMP TABLE education_menu_fix(
    menu_code varchar(20) PRIMARY KEY,
    menu_nm varchar(200) NOT NULL,
    menu_nm_en varchar(200) NOT NULL,
    sort_ordr integer NOT NULL
) ON COMMIT DROP;

INSERT INTO education_menu_fix VALUES
('A1080201','과정 관리','Course Management',1080201),
('A1080202','교육 일정','Education Schedule',1080202),
('A1080203','신청자 관리','Applicant Management',1080203),
('A1080204','출석·진도','Attendance and Progress',1080204),
('A1080205','평가','Assessment',1080205),
('A1080206','수료증','Certificate',1080206);

INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
SELECT menu_code,menu_nm,menu_nm_en,'#','school','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y'
FROM education_menu_fix
ON CONFLICT(menu_code) DO UPDATE
SET menu_nm=EXCLUDED.menu_nm,menu_nm_en=EXCLUDED.menu_nm_en,menu_url='#',menu_icon='school',
    use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
SELECT menu_code,sort_ordr,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM education_menu_fix
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
SELECT 'AMENU1',menu_code,menu_nm,menu_nm,'Y',CURRENT_TIMESTAMP,'MENU_EDUCATION_FIX',CURRENT_TIMESTAMP,'MENU_EDUCATION_FIX'
FROM education_menu_fix
ON CONFLICT(code_id,code) DO UPDATE
SET code_nm=EXCLUDED.code_nm,code_dc=EXCLUDED.code_dc,use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_EDUCATION_FIX';

UPDATE comtnmenuinfo SET use_at='N',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code IN ('A1080108','A1080109','A1080110','A1080111','A1080112','A1080113');

UPDATE comtccmmndetailcode SET use_at='N',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_EDUCATION_FIX'
WHERE code_id='AMENU1' AND code IN ('A1080108','A1080109','A1080110','A1080111','A1080112','A1080113');

UPDATE comtnmenuinfo SET menu_url='#',last_updt_pnttm=CURRENT_TIMESTAMP WHERE menu_code='A10802';
