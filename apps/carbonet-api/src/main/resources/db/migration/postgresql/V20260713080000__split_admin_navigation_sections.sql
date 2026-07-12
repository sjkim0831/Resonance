-- Split each administration domain into three functional sections while
-- preserving the destination URL and labels of every existing page menu.
CREATE TEMP TABLE admin_sections (
  code varchar(20) PRIMARY KEY, name_ko varchar(200), name_en varchar(200), sort_order integer
) ON COMMIT DROP;

INSERT INTO admin_sections VALUES
('A10101','통합 현황','Integrated Overview',10101),('A10102','업무 모니터링','Work Monitoring',10102),('A10103','시스템 상태','System Status',10103),
('A10201','회원 관리','Member Management',10201),('A10202','기업 관리','Company Management',10202),('A10203','권한·보안','Authority & Security',10203),
('A10301','설문·수집','Survey & Collection',10301),('A10302','산정·기준','Calculation & Factors',10302),('A10303','검증·보고','Validation & Reporting',10303),
('A10401','LCA 설문','LCA Survey',10401),('A10402','LCI·영향평가','LCI & Impact Assessment',10402),('A10403','LCA 보고·인증','LCA Reporting & Certification',10403),
('A10501','감축 정의·목표','Reduction Definition & Targets',10501),('A10502','감축 과제','Reduction Initiatives',10502),('A10503','성과·이력','Performance & History',10503),
('A10601','공통 기준정보','Common Master Data',10601),('A10602','화면·컴포넌트','Pages & Components',10602),('A10603','테마·레이아웃','Theme & Layout',10603),
('A10701','검증 관리','Validation Management',10701),('A10702','승인 워크플로','Approval Workflow',10702),('A10703','감사·이력','Audit & History',10703),
('A10801','게시·콘텐츠','Publishing & Content',10801),('A10802','교육·안내','Education & Guidance',10802),('A10803','문의·지원','Inquiry & Support',10803),
('A10901','거래 운영','Trade Operations',10901),('A10902','정산 관리','Settlement Management',10902),('A10903','인증·통계','Certification & Statistics',10903),
('A11001','연계 설정','Integration Configuration',11001),('A11002','동기화·웹훅','Sync & Webhooks',11002),('A11003','연계 모니터링','Integration Monitoring',11003),
('A11101','메뉴·권한','Menu & Authority',11101),('A11102','개발·빌더','Development & Builder',11102),('A11103','운영·보안','Operations & Security',11103),
('A11201','기존 메뉴','Legacy Menus',11201),('A11202','화면 인벤토리','Screen Inventory',11202),('A11203','전체 스택 현황','Full-stack Inventory',11203);

INSERT INTO comtccmmndetailcode
  (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm, frst_register_id, last_updt_pnttm, last_updusr_id)
SELECT 'AMENU1', code, name_ko, name_en, 'Y', CURRENT_TIMESTAMP, 'MENU_REORG', CURRENT_TIMESTAMP, 'MENU_REORG'
FROM admin_sections
ON CONFLICT (code_id, code) DO UPDATE SET code_nm=EXCLUDED.code_nm, code_dc=EXCLUDED.code_dc,
  use_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='MENU_REORG';

INSERT INTO comtnmenuinfo
  (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at)
SELECT code, name_ko, name_en, '#', 'folder', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y'
FROM admin_sections
ON CONFLICT (menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm, menu_nm_en=EXCLUDED.menu_nm_en,
  use_at='Y', expsr_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
SELECT code, sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM admin_sections
ON CONFLICT (menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr, last_updt_pnttm=CURRENT_TIMESTAMP;

CREATE TEMP TABLE admin_item_assignment (old_code varchar(20) PRIMARY KEY, new_parent varchar(20));
INSERT INTO admin_item_assignment VALUES
('A1010101','A10101'),('A1010102','A10101'),('A1010103','A10102'),('A1010104','A10103'),
('A1020101','A10201'),('A1020102','A10203'),('A1020103','A10202'),('A1020104','A10201'),('A1020105','A10203'),('A1020106','A10203'),
('A1030101','A10301'),('A1030102','A10301'),('A1030103','A10303'),('A1030104','A10302'),('A1030105','A10302'),('A1030106','A10301'),('A1030107','A10303'),('A1030108','A10303'),
('A1040101','A10401'),('A1040102','A10403'),('A1040103','A10402'),('A1040104','A10402'),('A1040105','A10403'),('A1040106','A10402'),
('A1050101','A10501'),('A1050102','A10501'),('A1050103','A10502'),('A1050104','A10503'),
('A1060101','A10601'),('A1060102','A10602'),('A1060103','A10601'),('A1060104','A10602'),('A1060105','A10603'),('A1060106','A10603'),
('A1070101','A10702'),('A1070102','A10702'),('A1070103','A10701'),('A1070104','A10703'),
('A1080101','A10801'),('A1080102','A10801'),('A1080103','A10802'),('A1080104','A10803'),('A1080105','A10801'),('A1080106','A10802'),
('A1090101','A10901'),('A1090102','A10901'),('A1090103','A10903'),('A1090104','A10902'),('A1090105','A10903'),('A1090106','A10903'),
('A1100101','A11001'),('A1100102','A11001'),('A1100103','A11001'),('A1100104','A11003'),('A1100105','A11002'),('A1100106','A11002'),
('A1110101','A11101'),('A1110102','A11101'),('A1110103','A11102'),('A1110104','A11102'),('A1110105','A11103'),('A1110106','A11103'),('A1110107','A11103'),
('A1120101','A11201'),('A1120102','A11202'),('A1120103','A11203');

CREATE TEMP TABLE admin_item_move AS
SELECT a.old_code, a.new_parent || right(a.old_code, 2) AS new_code
FROM admin_item_assignment a
JOIN comtccmmndetailcode d ON d.code_id='AMENU1' AND d.code=a.old_code;

INSERT INTO comtccmmndetailcode
  (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm, frst_register_id, last_updt_pnttm, last_updusr_id)
SELECT 'AMENU1', m.new_code, d.code_nm, d.code_dc, 'Y', CURRENT_TIMESTAMP, 'MENU_REORG', CURRENT_TIMESTAMP, 'MENU_REORG'
FROM admin_item_move m JOIN comtccmmndetailcode d ON d.code_id='AMENU1' AND d.code=m.old_code
ON CONFLICT (code_id, code) DO UPDATE SET code_nm=EXCLUDED.code_nm, code_dc=EXCLUDED.code_dc,
  use_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='MENU_REORG';

INSERT INTO comtnmenuinfo
  (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at)
SELECT m.new_code, i.menu_nm, i.menu_nm_en, i.menu_url, i.menu_icon, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y'
FROM admin_item_move m JOIN comtnmenuinfo i ON i.menu_code=m.old_code
ON CONFLICT (menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm, menu_nm_en=EXCLUDED.menu_nm_en,
  menu_url=EXCLUDED.menu_url, menu_icon=EXCLUDED.menu_icon, use_at='Y', expsr_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
SELECT m.new_code, coalesce(o.sort_ordr, right(m.old_code,2)::integer), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM admin_item_move m LEFT JOIN comtnmenuorder o ON o.menu_code=m.old_code
ON CONFLICT (menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr, last_updt_pnttm=CURRENT_TIMESTAMP;

UPDATE comtnmenuinfo i SET use_at='N', expsr_at='N', last_updt_pnttm=CURRENT_TIMESTAMP
FROM admin_item_move m WHERE i.menu_code=m.old_code AND m.old_code<>m.new_code;
UPDATE comtccmmndetailcode d SET use_at='N', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='MENU_REORG'
FROM admin_item_move m WHERE d.code_id='AMENU1' AND d.code=m.old_code AND m.old_code<>m.new_code;

-- A section opens its first active page, not a duplicate section placeholder.
UPDATE comtnmenuinfo section
SET menu_url = (
      SELECT i.menu_url FROM comtnmenuinfo i
      WHERE i.use_at='Y' AND i.expsr_at='Y' AND length(i.menu_code)=8
        AND left(i.menu_code,6)=section.menu_code
      ORDER BY i.menu_code LIMIT 1
    ),
    last_updt_pnttm=CURRENT_TIMESTAMP
WHERE section.menu_code IN (SELECT code FROM admin_sections)
  AND EXISTS (
    SELECT 1 FROM comtnmenuinfo i
    WHERE i.use_at='Y' AND i.expsr_at='Y' AND length(i.menu_code)=8
      AND left(i.menu_code,6)=section.menu_code
  );
