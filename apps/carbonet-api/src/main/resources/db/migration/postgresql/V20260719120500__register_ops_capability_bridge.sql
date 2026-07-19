INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
VALUES('A1110198','Ops 통합 관제','Ops Capability Center','/admin/system/ops-bridge','hub','Y',current_timestamp,current_timestamp,'Y')
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=excluded.menu_nm,menu_nm_en=excluded.menu_nm_en,menu_url=excluded.menu_url,menu_icon=excluded.menu_icon,use_at='Y',expsr_at='Y',last_updt_pnttm=current_timestamp;

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
VALUES('AMENU1','A1110198','Ops 통합 관제','/admin/system/ops-bridge','Y',current_timestamp,'OPS_BRIDGE',current_timestamp,'OPS_BRIDGE')
ON CONFLICT(code_id,code) DO UPDATE SET code_nm=excluded.code_nm,code_dc=excluded.code_dc,use_at='Y',last_updt_pnttm=current_timestamp;

INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
VALUES('A1110198',398,current_timestamp,current_timestamp)
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=excluded.sort_ordr,last_updt_pnttm=current_timestamp;
