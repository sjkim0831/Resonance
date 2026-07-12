-- Expand every reorganized admin branch with real task destinations.
CREATE TEMP TABLE expanded_admin_menu (
  code varchar(20) PRIMARY KEY, name_ko varchar(200), name_en varchar(200),
  menu_url varchar(500), menu_icon varchar(100), sort_order integer
) ON COMMIT DROP;

INSERT INTO expanded_admin_menu VALUES
('A1010102','배출량 운영 현황','Emission Operations','/admin/emission/management','co2',1010102),
('A1010103','시스템 모니터링','System Monitoring','/admin/system/monitoring-dashboard','monitoring',1010103),
('A1010104','오류 로그','Error Logs','/admin/system/error-log','error',1010104),
('A1020103','기업 관리','Company Management','/admin/member/company_list','apartment',1020103),
('A1020104','관리자 계정','Administrator Accounts','/admin/member/admin_list','admin_panel_settings',1020104),
('A1020105','부서·역할 매핑','Department & Role Mapping','/admin/member/dept-role-mapping','account_tree',1020105),
('A1020106','로그인 이력','Login History','/admin/member/login_history','history',1020106),
('A1030104','배출계수 관리','Emission Factor Management','/admin/emission/factor-management','dataset',1030104),
('A1030105','계산 규칙','Calculation Rules','/admin/emission/calculation-rule','rule',1030105),
('A1030106','입력 양식','Input Templates','/admin/emission/input-template','upload_file',1030106),
('A1030107','검증 규칙','Validation Rules','/admin/emission/validation-rule','fact_check',1030107),
('A1030108','증빙 관리','Evidence Management','/admin/emission/evidence-management','attach_file',1030108),
('A1040103','LCI 분류 관리','LCI Classification','/admin/emission/lci-classification','category',1040103),
('A1040104','Ecoinvent 관리','Ecoinvent Management','/admin/emission/ecoinvent','science',1040104),
('A1040105','LCA 요약 보고서','LCA Summary Report','/admin/emission/survey-report-lca-summary','description',1040105),
('A1040106','GWP 값 관리','GWP Values','/admin/emission/gwp-values','public',1040106),
('A1050102','감축 정의 관리','Reduction Definition','/admin/emission/definition-studio','task',1050102),
('A1050103','감축 결과 관리','Reduction Results','/admin/emission/result_list','flag',1050103),
('A1050104','감축 데이터 이력','Reduction Data History','/admin/emission/data_history','insights',1050104),
('A1060102','페이지 관리','Page Management','/admin/system/page-management','web',1060102),
('A1060103','컬럼 관리','Column Management','/admin/system/column-management','table_rows',1060103),
('A1060104','컴포넌트 관리','Component Management','/admin/system/component-management','widgets',1060104),
('A1060105','테마 관리','Theme Management','/admin/system/theme-management','palette',1060105),
('A1060106','섹션 관리','Section Management','/admin/system/section-management','view_list',1060106),
('A1070102','승인 워크플로','Approval Workflow','/admin/emission/approval-workflow','approval',1070102),
('A1070103','배출량 검증','Emission Validation','/admin/emission/validate','verified',1070103),
('A1070104','감사 로그','Audit Log','/admin/emission/audit-log','history',1070104),
('A1080102','게시판 관리','Board Management','/admin/content/board_list','article',1080102),
('A1080103','FAQ 관리','FAQ Management','/admin/content/faq_list','help',1080103),
('A1080104','문의 관리','Inquiry Management','/admin/content/qna','support_agent',1080104),
('A1080105','배너 관리','Banner Management','/admin/content/banner_list','campaign',1080105),
('A1080106','사이트맵 관리','Sitemap Management','/admin/content/sitemap','account_tree',1080106),
('A1090102','거래 승인','Trade Approval','/admin/trade/approve','check_circle',1090102),
('A1090103','거래 통계','Trade Statistics','/admin/trade/statistics','bar_chart',1090103),
('A1090104','정산 관리','Settlement Management','/admin/payment/settlement','payments',1090104),
('A1090105','인증서 심사','Certificate Review','/admin/certificate/review','verified',1090105),
('A1090106','인증서 통계','Certificate Statistics','/admin/certificate/statistics','insights',1090106),
('A1100102','연계 목록','Connection List','/admin/external/connection_list','hub',1100102),
('A1100103','API 키 관리','API Key Management','/admin/external/keys','key',1100103),
('A1100104','연계 모니터링','Integration Monitoring','/admin/external/monitoring','monitoring',1100104),
('A1100105','동기화 관리','Synchronization','/admin/external/sync','sync',1100105),
('A1100106','웹훅 관리','Webhook Management','/admin/external/webhooks','api',1100106),
('A1110102','기능 관리','Feature Management','/admin/system/feature-management','extension',1110102),
('A1110103','화면 관리','Screen Management','/admin/system/screen-management','desktop_windows',1110103),
('A1110104','빌더 스튜디오','Builder Studio','/admin/system/builder-studio','build',1110104),
('A1110105','배치 관리','Batch Management','/admin/system/batch','schedule',1110105),
('A1110106','백업 관리','Backup Management','/admin/system/backup','backup',1110106),
('A1110107','보안 정책','Security Policy','/admin/system/security-policy','shield',1110107),
('A1120102','기존 화면 WBS','Legacy Screen WBS','/admin/system/wbs-management','inventory',1120102),
('A1120103','전체 스택 현황','Full-stack Inventory','/admin/system/full-stack-management','account_tree',1120103);

INSERT INTO comtccmmndetailcode
  (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm, frst_register_id, last_updt_pnttm, last_updusr_id)
SELECT 'AMENU1', code, name_ko, name_en, 'Y', CURRENT_TIMESTAMP, 'MENU_REORG', CURRENT_TIMESTAMP, 'MENU_REORG'
FROM expanded_admin_menu
ON CONFLICT (code_id, code) DO UPDATE SET code_nm=EXCLUDED.code_nm, code_dc=EXCLUDED.code_dc,
  use_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='MENU_REORG';

INSERT INTO comtnmenuinfo
  (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at, frst_regist_pnttm, last_updt_pnttm, expsr_at)
SELECT code, name_ko, name_en, menu_url, menu_icon, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y'
FROM expanded_admin_menu
ON CONFLICT (menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm, menu_nm_en=EXCLUDED.menu_nm_en,
  menu_url=EXCLUDED.menu_url, menu_icon=EXCLUDED.menu_icon, use_at='Y', expsr_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
SELECT code, sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM expanded_admin_menu
ON CONFLICT (menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr, last_updt_pnttm=CURRENT_TIMESTAMP;

-- Correct representative group links to registered runtime routes.
UPDATE comtnmenuinfo SET menu_url='/admin/system/monitoring-dashboard' WHERE menu_code IN ('A101','A10101','A1010101');
UPDATE comtnmenuinfo SET menu_url='/admin/member/list' WHERE menu_code IN ('A102','A10201','A1020101');
UPDATE comtnmenuinfo SET menu_url='/admin/emission/definition-studio' WHERE menu_code IN ('A105','A10501','A1050101');
UPDATE comtnmenuinfo SET menu_url='/admin/emission/approval-workflow' WHERE menu_code IN ('A107','A10701','A1070101');
UPDATE comtnmenuinfo SET menu_url='/admin/content/board_list' WHERE menu_code IN ('A108','A10801','A1080101');
UPDATE comtnmenuinfo SET menu_url='/admin/trade/list' WHERE menu_code IN ('A109','A10901','A1090101');
UPDATE comtnmenuinfo SET menu_url='/admin/external/connection_list' WHERE menu_code IN ('A110','A11001','A1100101');
