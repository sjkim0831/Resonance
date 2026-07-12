-- Make the reorganized IA authoritative for both public and admin navigation.
-- Existing routes remain in the database and backups, but old top-level branches
-- are inactive and recoverable through the legacy archive entry.

UPDATE comtnmenuinfo
SET use_at = 'N', expsr_at = 'N', last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code ~ '^H00[1-9]';

UPDATE comtccmmndetailcode
SET use_at = 'N', last_updt_pnttm = CURRENT_TIMESTAMP, last_updusr_id = 'MENU_REORG'
WHERE code_id = 'HMENU1' AND code ~ '^H00[1-9]';

CREATE TEMP TABLE target_admin_menu (
  code varchar(20) PRIMARY KEY,
  name_ko varchar(200) NOT NULL,
  name_en varchar(200) NOT NULL,
  menu_url varchar(500),
  menu_icon varchar(100),
  sort_order integer NOT NULL
) ON COMMIT DROP;

INSERT INTO target_admin_menu VALUES
('A101','운영 대시보드','Operations Dashboard','/admin/dashboard','dashboard',101),
('A10101','운영 현황','Operations Overview','/admin/dashboard','monitoring',10101),
('A1010101','통합 운영 대시보드','Integrated Operations Dashboard','/admin/dashboard','dashboard',1010101),
('A102','회원·기업·권한','Members, Companies & Authority','/admin/member/member_list','groups',102),
('A10201','회원 및 권한 관리','Member & Authority Management','/admin/member/member_list','manage_accounts',10201),
('A1020101','회원 관리','Member Management','/admin/member/member_list','person_search',1020101),
('A1020102','권한 관리','Authority Management','/admin/system/authority-management','security',1020102),
('A103','탄소배출 운영','Carbon Emission Operations','/admin/emission/survey-admin','co2',103),
('A10301','배출량 업무','Emission Work','/admin/emission/survey-admin','inventory',10301),
('A1030101','배출량 설문 관리','Emission Survey Management','/admin/emission/survey-admin','assignment',1030101),
('A1030102','설문 데이터 관리','Survey Data Management','/admin/emission/survey-admin-data','dataset',1030102),
('A1030103','배출량 보고서','Emission Reports','/admin/emission/survey-report','description',1030103),
('A104','LCA 운영','LCA Operations','/admin/emission/survey-admin','science',104),
('A10401','LCA 업무','LCA Work','/admin/emission/survey-admin','account_tree',10401),
('A1040101','LCA 설문 관리','LCA Survey Management','/admin/emission/survey-admin','assignment',1040101),
('A1040102','인증서 진위 확인','Certificate Verification','/admin/emission/survey-report-verify','verified',1040102),
('A105','감축 운영','Reduction Operations','/admin/reduction','trending_down',105),
('A10501','감축 업무','Reduction Work','/admin/reduction','task',10501),
('A1050101','감축 관리','Reduction Management','/admin/reduction','trending_down',1050101),
('A106','기준정보','Master Data','/admin/system/code','database',106),
('A10601','기준정보 관리','Master Data Management','/admin/system/code','storage',10601),
('A1060101','공통코드 관리','Common Code Management','/admin/system/code','database',1060101),
('A107','검증·워크플로','Validation & Workflow','/admin/workflow','fact_check',107),
('A10701','검증 및 승인','Validation & Approval','/admin/workflow','rule',10701),
('A1070101','워크플로 관리','Workflow Management','/admin/workflow','account_tree',1070101),
('A108','콘텐츠·교육·지원','Content, Education & Support','/admin/content','school',108),
('A10801','콘텐츠 운영','Content Operations','/admin/content','article',10801),
('A1080101','콘텐츠 관리','Content Management','/admin/content','article',1080101),
('A109','거래·정산·인증','Trade, Settlement & Certification','/admin/trade','payments',109),
('A10901','거래 운영','Trade Operations','/admin/trade','currency_exchange',10901),
('A1090101','거래 관리','Trade Management','/admin/trade','currency_exchange',1090101),
('A110','외부 연계','External Integration','/admin/system/external-integration','hub',110),
('A11001','연계 관리','Integration Management','/admin/system/external-integration','api',11001),
('A1100101','외부 연계 관리','External Integration Management','/admin/system/external-integration','hub',1100101),
('A111','시스템 관리','System Management','/admin/system/menu-management','settings',111),
('A11101','시스템 구성','System Configuration','/admin/system/menu-management','settings_applications',11101),
('A1110101','메뉴 관리','Menu Management','/admin/system/menu-management','menu',1110101),
('A112','기존 관리자 화면 보관함','Legacy Admin Screen Archive','/admin/system/menu-management?menuType=ADMIN','inventory',112),
('A11201','기존 화면 조회','Legacy Screen Inventory','/admin/system/menu-management?menuType=ADMIN','history',11201),
('A1120101','기존 메뉴 전체 조회','All Legacy Menus','/admin/system/menu-management?menuType=ADMIN','view_list',1120101);

INSERT INTO comtccmmndetailcode
  (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm, frst_register_id, last_updt_pnttm, last_updusr_id)
SELECT 'AMENU1', code, name_ko, name_en, 'Y', CURRENT_TIMESTAMP, 'MENU_REORG', CURRENT_TIMESTAMP, 'MENU_REORG'
FROM target_admin_menu
ON CONFLICT (code_id, code) DO UPDATE SET
  code_nm = EXCLUDED.code_nm, code_dc = EXCLUDED.code_dc, use_at = 'Y',
  last_updt_pnttm = CURRENT_TIMESTAMP, last_updusr_id = 'MENU_REORG';

INSERT INTO comtnmenuinfo
  (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at)
SELECT code, name_ko, name_en, menu_url, menu_icon, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y'
FROM target_admin_menu
ON CONFLICT (menu_code) DO UPDATE SET
  menu_nm = EXCLUDED.menu_nm, menu_nm_en = EXCLUDED.menu_nm_en,
  menu_url = EXCLUDED.menu_url, menu_icon = EXCLUDED.menu_icon,
  use_at = 'Y', expsr_at = 'Y', last_updt_pnttm = CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
SELECT code, sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM target_admin_menu
ON CONFLICT (menu_code) DO UPDATE SET sort_ordr = EXCLUDED.sort_ordr, last_updt_pnttm = CURRENT_TIMESTAMP;

UPDATE comtnmenuinfo
SET use_at = 'N', expsr_at = 'N', last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code ~ '^A00[1-9]';

UPDATE comtccmmndetailcode
SET use_at = 'N', last_updt_pnttm = CURRENT_TIMESTAMP, last_updusr_id = 'MENU_REORG'
WHERE code_id = 'AMENU1' AND code ~ '^A00[1-9]';
