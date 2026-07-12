-- Final IA approved by the operator on 2026-07-13.
-- This migration replaces temporary three-section scaffolding. Existing page
-- routes remain stored as inactive legacy rows until mapped to a final leaf.
CREATE TEMP TABLE final_menu (
 code varchar(20) PRIMARY KEY, code_id varchar(20), name_ko varchar(200), name_en varchar(200), sort_order integer
) ON COMMIT DROP;

INSERT INTO final_menu VALUES
('H101','HMENU1','홈','Home',101),
('H10101','HMENU1','통합 홈','Integrated Home',10101),('H10102','HMENU1','내 업무·일정','My Work & Schedule',10102),('H10103','HMENU1','지표·알림·소식','Metrics, Alerts & News',10103),
('H102','HMENU1','탄소배출 관리','Carbon Emissions',102),
('H10201','HMENU1','현황·프로젝트','Overview & Projects',10201),('H10202','HMENU1','활동자료','Activity Data',10202),('H10203','HMENU1','산정·검증','Calculation & Validation',10203),('H10204','HMENU1','확정·보고','Finalization & Reporting',10204),
('H103','HMENU1','제품 LCA','Product LCA',103),
('H10301','HMENU1','LCA 프로젝트','LCA Projects',10301),('H10302','HMENU1','인벤토리','Inventory',10302),('H10303','HMENU1','산정·분석','Calculation & Analysis',10303),('H10304','HMENU1','보고','Reporting',10304),
('H104','HMENU1','감축 관리','Reduction Management',104),
('H10401','HMENU1','목표·계획','Targets & Planning',10401),('H10402','HMENU1','감축 과제','Reduction Initiatives',10402),('H10403','HMENU1','성과 관리','Performance Management',10403),('H10404','HMENU1','포트폴리오','Portfolio',10404),
('H105','HMENU1','모니터링·분석','Monitoring & Analytics',105),
('H10501','HMENU1','통합 모니터링','Integrated Monitoring',10501),('H10502','HMENU1','데이터 품질·경보','Data Quality & Alerts',10502),('H10503','HMENU1','분석·공유','Analytics & Sharing',10503),
('H106','HMENU1','탄소·자원 거래','Carbon & Resource Trading',106),
('H10601','HMENU1','공급·수요','Supply & Demand',10601),('H10602','HMENU1','거래','Trading',10602),('H10603','HMENU1','추적·무결성','Traceability & Integrity',10603),('H10604','HMENU1','크레딧·인증','Credits & Certification',10604),
('H107','HMENU1','교육·지원','Education & Support',107),
('H10701','HMENU1','교육','Education',10701),('H10702','HMENU1','정보','Information',10702),('H10703','HMENU1','지원','Support',10703),
('H108','HMENU1','마이페이지','My Page',108),
('H10801','HMENU1','내 정보·소속','Profile & Organization',10801),('H10802','HMENU1','업무·승인','Work & Approvals',10802),('H10803','HMENU1','알림·보안·연계','Notifications, Security & API',10803),

('A101','AMENU1','운영 대시보드','Operations Dashboard',101),
('A10101','AMENU1','관리자 홈','Admin Home',10101),('A10102','AMENU1','업무 현황','Work Overview',10102),('A10103','AMENU1','데이터·사용자 현황','Data & User Activity',10103),('A10104','AMENU1','시스템 상태','System Status',10104),
('A102','AMENU1','회원·기업·권한','Members, Companies & Authority',102),
('A10201','AMENU1','회원 관리','Member Management',10201),('A10202','AMENU1','기업 관리','Company Management',10202),('A10203','AMENU1','권한 관리','Authority Management',10203),
('A103','AMENU1','탄소배출 운영','Carbon Emission Operations',103),
('A10301','AMENU1','프로젝트 운영','Project Operations',10301),('A10302','AMENU1','자료 수집','Data Collection',10302),('A10303','AMENU1','검증·승인','Validation & Approval',10303),('A10304','AMENU1','결과·보고','Results & Reporting',10304),
('A104','AMENU1','LCA 운영','LCA Operations',104),
('A10401','AMENU1','LCA 프로젝트','LCA Projects',10401),('A10402','AMENU1','LCA 데이터','LCA Data',10402),('A10403','AMENU1','LCA 산정·보고','LCA Calculation & Reporting',10403),
('A105','AMENU1','감축 운영','Reduction Operations',105),
('A10501','AMENU1','목표·과제','Targets & Initiatives',10501),('A10502','AMENU1','검토·성과','Review & Performance',10502),('A10503','AMENU1','기준·비용·보고','Factors, Cost & Reporting',10503),
('A106','AMENU1','기준정보','Master Data',106),
('A10601','AMENU1','조직·배출원','Organizations & Emission Sources',10601),('A10602','AMENU1','산정 기준','Calculation Standards',10602),('A10603','AMENU1','데이터 기준','Data Standards',10603),('A10604','AMENU1','코드·분류','Codes & Classifications',10604),
('A107','AMENU1','검증·워크플로','Validation & Workflow',107),
('A10701','AMENU1','검증 규칙','Validation Rules',10701),('A10702','AMENU1','승인선·워크플로','Approval & Workflow',10702),('A10703','AMENU1','Task·완료 조건','Tasks & Completion Rules',10703),('A10704','AMENU1','마감·자동화 정책','Deadline & Automation Policies',10704),
('A108','AMENU1','콘텐츠·교육·지원','Content, Education & Support',108),
('A10801','AMENU1','콘텐츠','Content',10801),('A10802','AMENU1','교육','Education',10802),('A10803','AMENU1','고객지원','Customer Support',10803),('A10804','AMENU1','사용자 도움말','User Help',10804),
('A109','AMENU1','거래·정산·인증','Trade, Settlement & Certification',109),
('A10901','AMENU1','거래','Trading',10901),('A10902','AMENU1','정산·결제','Settlement & Payment',10902),('A10903','AMENU1','인증서','Certificates',10903),
('A110','AMENU1','외부 연계','External Integration',110),
('A11001','AMENU1','연계 시스템','Connected Systems',11001),('A11002','AMENU1','동기화·웹훅','Sync & Webhooks',11002),('A11003','AMENU1','모니터링·로그','Monitoring & Logs',11003),
('A111','AMENU1','시스템 관리','System Management',111),
('A11101','AMENU1','메뉴·화면','Menus & Screens',11101),('A11102','AMENU1','기능·API','Functions & APIs',11102),('A11103','AMENU1','보안·감사','Security & Audit',11103),('A11104','AMENU1','운영·배포','Operations & Deployment',11104);

UPDATE comtnmenuinfo SET use_at='N', expsr_at='N', last_updt_pnttm=CURRENT_TIMESTAMP
WHERE length(menu_code) <= 6
  AND (menu_code LIKE 'H1%' OR menu_code LIKE 'A1%')
  AND menu_code NOT IN (SELECT code FROM final_menu);
UPDATE comtccmmndetailcode SET use_at='N', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='MENU_FINAL_IA'
WHERE length(code) <= 6 AND code_id IN ('HMENU1','AMENU1')
  AND (code LIKE 'H1%' OR code LIKE 'A1%') AND code NOT IN (SELECT code FROM final_menu);

INSERT INTO comtccmmndetailcode
 (code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
SELECT code_id,code,name_ko,name_en,'Y',CURRENT_TIMESTAMP,'MENU_FINAL_IA',CURRENT_TIMESTAMP,'MENU_FINAL_IA' FROM final_menu
ON CONFLICT (code_id,code) DO UPDATE SET code_nm=EXCLUDED.code_nm,code_dc=EXCLUDED.code_dc,use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_FINAL_IA';

INSERT INTO comtnmenuinfo
 (menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
SELECT code,name_ko,name_en,'#',CASE WHEN length(code)=4 THEN 'category' ELSE 'folder' END,'Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y' FROM final_menu
ON CONFLICT (menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm,menu_nm_en=EXCLUDED.menu_nm_en,use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
SELECT code,sort_order,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM final_menu
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;
