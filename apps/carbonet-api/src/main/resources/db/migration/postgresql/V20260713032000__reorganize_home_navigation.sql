CREATE TEMP TABLE target_home_menu (
  code varchar(32) PRIMARY KEY,
  name_ko varchar(200) NOT NULL,
  name_en varchar(200) NOT NULL,
  menu_url varchar(500) NOT NULL,
  menu_icon varchar(100) NOT NULL,
  sort_order integer NOT NULL
) ON COMMIT DROP;

INSERT INTO target_home_menu VALUES
('H101','홈','Home','/home','home',101000),
('H10101','업무 시작','Start','/home','dashboard',101100),
('H1010101','통합 홈','Home Dashboard','/home','home',101101),
('H1010102','내 업무 요약','My Work Summary','/emission/my-tasks','task',101102),
('H1010103','인증서 진위 확인','Certificate Verification','/home/certificate-verify','verified',101103),

('H102','탄소배출 관리','Carbon Emissions','/emission/index','co2',102000),
('H10201','현황·프로젝트','Status & Projects','/emission/index','dashboard',102100),
('H1020101','배출량 현황','Emission Status','/emission/index','monitoring',102101),
('H1020102','배출량 프로젝트','Emission Projects','/emission/project_list','account_tree',102102),
('H1020103','내 업무','My Tasks','/emission/my-tasks','assignment_ind',102103),
('H10202','입력·산정','Input & Calculation','/emission/data_input','edit_note',102200),
('H1020201','활동자료 관리','Activity Data','/emission/data_input','dataset',102201),
('H1020202','배출량 산정','Emission Calculation','/emission/simulate','calculate',102202),
('H10203','검증·보고','Validation & Report','/emission/validate','fact_check',102300),
('H1020301','검증 및 보완','Validation & Correction','/emission/validate','rule',102301),
('H1020302','보고 및 확정','Report & Finalize','/emission/report_submit','description',102302),

('H103','제품 LCA','Product LCA','/emission/lca','science',103000),
('H10301','LCA 업무','LCA Work','/emission/lca','account_tree',103100),
('H1030101','LCA 현황·분석','LCA Status & Analysis','/emission/lca','analytics',103101),
('H1030102','LCI 데이터 조회','LCI Database','/emission/lci','database',103102),
('H1030103','LCA 데이터 수집','LCA Data Collection','/admin/emission/survey-admin','assignment',103103),

('H104','감축 관리','Reduction Management','/emission/reduction','trending_down',104000),
('H10401','목표·성과','Targets & Performance','/emission/reduction','flag',104100),
('H1040101','감축 목표·과제','Reduction Targets & Initiatives','/emission/reduction','task_alt',104101),
('H1040102','감축 성과 추이','Reduction Performance','/monitoring/reduction_trend','timeline',104102),

('H105','모니터링·분석','Monitoring & Analytics','/monitoring/index','monitoring',105000),
('H10501','통합 관제','Monitoring','/monitoring/index','dashboard',105100),
('H1050101','통합 모니터링','Monitoring Dashboard','/monitoring/dashboard','dashboard',105101),
('H1050102','실시간 현황','Realtime Status','/monitoring/realtime','sensors',105102),
('H1050103','경보 현황','Alerts','/monitoring/alerts','notifications',105103),
('H10502','분석·공유','Analytics & Sharing','/monitoring/statistics','analytics',105200),
('H1050201','통계·분석','Statistics & Analytics','/monitoring/statistics','bar_chart',105201),
('H1050202','이해관계자 공유','Stakeholder Sharing','/monitoring/share','share',105202),
('H1050203','분석 내보내기','Analytics Export','/monitoring/export','download',105203),

('H106','탄소·자원 거래','Carbon & Resource Trading','/co2/index','sync_alt',106000),
('H10601','공급·수요','Supply & Demand','/co2/index','hub',106100),
('H1060101','CO2 공급 정보','CO2 Supply','/co2/production_list','factory',106101),
('H1060102','CO2 수요 정보','CO2 Demand','/co2/demand_list','domain',106102),
('H1060103','거래 검색','Trading Search','/co2/search','search',106103),
('H10602','추적·인증','Traceability & Credit','/co2/integrity','verified',106200),
('H1060201','무결성 추적','Integrity Tracking','/co2/integrity','fact_check',106201),
('H1060202','탄소 크레딧','Carbon Credits','/co2/credit','workspace_premium',106202),
('H1060203','입지 분석','Location Analysis','/co2/analysis','travel_explore',106203),

('H107','교육·지원','Education & Support','/edu/index','school',107000),
('H10701','교육','Education','/edu/index','school',107100),
('H1070101','교육 과정','Courses','/edu/course_list','menu_book',107101),
('H1070102','내 교육','My Courses','/edu/my_course','assignment_ind',107102),
('H1070103','진도·수료증','Progress & Certificates','/edu/progress','workspace_premium',107103),
('H10702','고객지원','Support','/support/index','support_agent',107200),
('H1070201','공지·자료','Notices & Resources','/support/notice','campaign',107201),
('H1070202','자주 묻는 질문','FAQ','/support/faq','help',107202),

('H108','마이페이지','My Page','/mypage/index','person',108000),
('H10801','내 정보·설정','Profile & Settings','/mypage/index','manage_accounts',108100),
('H1080101','내 정보','My Profile','/mypage/index','person',108101),
('H1080102','알림 설정','Notification Settings','/mypage/notification','notifications',108102),
('H1080103','뉴스레터 수신','Newsletter Preferences','/mypage/marketing','mail',108103),

('H109','기존 화면 보관함','Legacy Screen Archive','/home','inventory_2',109000),
('H10901','기존 대메뉴','Original Menus','/home','folder',109100),
('H1090101','기존 탄소배출','Legacy Carbon Emissions','/emission/index','co2',109101),
('H1090102','기존 보고서·인증서','Legacy Reports & Certificates','/certificate/index','verified',109102),
('H1090103','기존 탄소정보','Legacy Carbon Information','/co2/index','info',109103),
('H1090104','기존 거래','Legacy Trading','/trade/index','sync_alt',109104),
('H1090105','기존 모니터링','Legacy Monitoring','/monitoring/index','monitoring',109105),
('H1090106','기존 결제','Legacy Payments','/payment/index','payments',109106),
('H1090107','기존 교육','Legacy Education','/edu/index','school',109107),
('H1090108','기존 마이페이지','Legacy My Page','/mypage/index','person',109108),
('H1090109','기존 고객지원','Legacy Support','/support/index','support_agent',109109);

INSERT INTO comtccmmndetailcode
  (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm, frst_register_id, last_updt_pnttm, last_updusr_id)
SELECT 'HMENU1', code, name_ko, name_en, 'Y', CURRENT_TIMESTAMP, 'MENU_REORG', CURRENT_TIMESTAMP, 'MENU_REORG'
FROM target_home_menu
ON CONFLICT (code_id, code) DO UPDATE SET
  code_nm = EXCLUDED.code_nm, code_dc = EXCLUDED.code_dc, use_at = 'Y',
  last_updt_pnttm = CURRENT_TIMESTAMP, last_updusr_id = 'MENU_REORG';

INSERT INTO comtnmenuinfo
  (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at)
SELECT code, name_ko, name_en, menu_url, menu_icon, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y'
FROM target_home_menu
ON CONFLICT (menu_code) DO UPDATE SET
  menu_nm = EXCLUDED.menu_nm, menu_nm_en = EXCLUDED.menu_nm_en,
  menu_url = EXCLUDED.menu_url, menu_icon = EXCLUDED.menu_icon,
  use_at = 'Y', expsr_at = 'Y', last_updt_pnttm = CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
SELECT code, sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM target_home_menu
ON CONFLICT (menu_code) DO UPDATE SET sort_ordr = EXCLUDED.sort_ordr, last_updt_pnttm = CURRENT_TIMESTAMP;

-- Preserve the original hierarchy in the backups and archive entry points,
-- but remove duplicate original branches from primary navigation.
UPDATE comtnmenuinfo SET expsr_at = 'N', last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code ~ '^H00[1-9]';
