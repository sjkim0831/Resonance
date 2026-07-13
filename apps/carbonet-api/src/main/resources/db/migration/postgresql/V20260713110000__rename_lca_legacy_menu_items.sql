CREATE TEMP TABLE lca_menu_name_fix(
    menu_code varchar(20) PRIMARY KEY,
    menu_nm varchar(200) NOT NULL,
    menu_nm_en varchar(200) NOT NULL,
    menu_url varchar(500) NOT NULL
) ON COMMIT DROP;

INSERT INTO lca_menu_name_fix VALUES
('A0020501','LCA 데이터 수집','LCA Data Collection','/admin/emission/survey-admin'),
('A0020502','LCA 업로드 데이터','LCA Upload Data','/admin/emission/survey-admin-data'),
('A0020503','LCI 분류 관리','LCI Classification Management','/admin/emission/lci-classification'),
('A0020504','LCA 데이터 정의','LCA Data Definition','/admin/emission/definition-studio'),
('A1040307','LCA 데이터 수집','LCA Data Collection','/admin/emission/survey-admin'),
('A1040308','LCA 업로드 데이터','LCA Upload Data','/admin/emission/survey-admin-data'),
('A1040309','LCI 분류 관리','LCI Classification Management','/admin/emission/lci-classification'),
('A1040310','LCA 데이터 정의','LCA Data Definition','/admin/emission/definition-studio');

UPDATE comtnmenuinfo m
SET menu_nm=f.menu_nm,
    menu_nm_en=f.menu_nm_en,
    menu_url=f.menu_url,
    last_updt_pnttm=CURRENT_TIMESTAMP
FROM lca_menu_name_fix f
WHERE m.menu_code=f.menu_code;

UPDATE comtccmmndetailcode d
SET code_nm=f.menu_nm,
    code_dc=f.menu_nm,
    last_updt_pnttm=CURRENT_TIMESTAMP,
    last_updusr_id='LCA_MENU_NAME_FIX'
FROM lca_menu_name_fix f
WHERE d.code=f.menu_code
  AND d.code_id IN ('AMENU1','MENU');
