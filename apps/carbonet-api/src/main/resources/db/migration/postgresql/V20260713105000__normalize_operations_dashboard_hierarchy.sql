CREATE TEMP TABLE operations_dashboard_leaf (
  code varchar(20) PRIMARY KEY, name_ko varchar(200), name_en varchar(200), menu_url varchar(500), sort_order integer
) ON COMMIT DROP;

INSERT INTO operations_dashboard_leaf VALUES
('A1010101','관리자 홈','Admin Home','/admin/',1010101),
('A1010102','전체 업무 현황','All Work Overview','/admin/monitoring/center',1010102),
('A1010103','프로젝트 진행 현황','Project Progress','/admin/emission/management',1010103),
('A1010104','승인 대기','Pending Approvals','/admin/emission/approval-workflow',1010104),
('A1010105','마감·지연 현황','Deadlines & Delays','/admin/emission/management',1010105),
('A1010106','데이터 품질 현황','Data Quality','/admin/emission/validate',1010106),
('A1010107','사용자 활동','User Activity','/admin/system/access_history',1010107),
('A1010108','시스템 상태','System Status','/admin/system/monitoring-dashboard',1010108),
('A1010109','주요 장애·경보','Major Incidents & Alerts','/admin/system/error-log',1010109);

UPDATE comtccmmndetailcode SET code_nm='운영 대시보드',code_dc='Operations Dashboard',use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_FINAL_IA'
WHERE code_id='AMENU1' AND code='A10101';
UPDATE comtnmenuinfo SET menu_nm='운영 대시보드',menu_nm_en='Operations Dashboard',menu_url='/admin/',use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code='A10101';

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
SELECT 'AMENU1',code,name_ko,name_en,'Y',CURRENT_TIMESTAMP,'MENU_FINAL_IA',CURRENT_TIMESTAMP,'MENU_FINAL_IA' FROM operations_dashboard_leaf
ON CONFLICT(code_id,code) DO UPDATE SET code_nm=EXCLUDED.code_nm,code_dc=EXCLUDED.code_dc,use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_FINAL_IA';
INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
SELECT code,name_ko,name_en,menu_url,'dashboard','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y' FROM operations_dashboard_leaf
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm,menu_nm_en=EXCLUDED.menu_nm_en,menu_url=EXCLUDED.menu_url,use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP;
INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
SELECT code,sort_order,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM operations_dashboard_leaf
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;

UPDATE comtnmenuinfo SET use_at='N',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE (menu_code BETWEEN 'A10102' AND 'A10109' AND length(menu_code)=6)
   OR (left(menu_code,6) BETWEEN 'A10102' AND 'A10109' AND length(menu_code)=8);
UPDATE comtccmmndetailcode SET use_at='N',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_FINAL_IA'
WHERE code_id='AMENU1' AND ((code BETWEEN 'A10102' AND 'A10109' AND length(code)=6)
   OR (left(code,6) BETWEEN 'A10102' AND 'A10109' AND length(code)=8));
