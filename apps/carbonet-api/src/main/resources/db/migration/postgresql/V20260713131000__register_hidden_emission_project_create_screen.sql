-- Dependent screen: available to screen-flow/menu management, hidden from GNB.
INSERT INTO comtnmenuinfo (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at)
VALUES ('H102010201', '새 프로젝트 등록', 'New Emission Project', '/emission/project/create', 'add_circle', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'N')
ON CONFLICT (menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm, menu_nm_en=EXCLUDED.menu_nm_en, menu_url=EXCLUDED.menu_url, menu_icon=EXCLUDED.menu_icon, use_at='Y', expsr_at='N', last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
VALUES ('H102010201', 10210201, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr, last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtccmmndetailcode (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm, last_updt_pnttm, last_updusr_id)
VALUES ('HMENU1', 'H102010201', '새 프로젝트 등록', '/emission/project/create', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PROJECT_SCREEN')
ON CONFLICT (code_id, code) DO UPDATE SET code_nm=EXCLUDED.code_nm, code_dc=EXCLUDED.code_dc, use_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='PROJECT_SCREEN';
