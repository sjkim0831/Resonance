CREATE TEMP TABLE member_company_authority_leaf(
 code varchar(20) PRIMARY KEY,name_ko varchar(200),name_en varchar(200),menu_url varchar(500),sort_order integer
) ON COMMIT DROP;
INSERT INTO member_company_authority_leaf VALUES
('A1020101','회원 목록','Member List','/admin/member/list',1020101),
('A1020102','회원 상세','Member Detail','/admin/member/detail',1020102),
('A1020103','가입 승인','Registration Approval','/admin/member/approve',1020103),
('A1020104','휴면·잠금·탈퇴','Dormant, Locked & Withdrawn','/admin/member/withdrawn',1020104),
('A1020105','로그인 이력','Login History','/admin/member/login_history',1020105),
('A1020201','기업 목록','Company List','/admin/member/company_list',1020201),
('A1020202','기업 등록·승인','Company Registration & Approval','/admin/member/company-approve',1020202),
('A1020203','조직·부서','Organization & Departments','/admin/member/dept-role-mapping',1020203),
('A1020204','사업장','Sites','/admin/emission/site-management',1020204),
('A1020205','담당자','Contacts','/admin/member/company_account',1020205),
('A1020301','역할 관리','Role Management','/admin/system/authority-management',1020301),
('A1020302','권한 그룹','Authority Groups','/admin/auth/group',1020302),
('A1020303','사용자별 권한','User Authorities','/admin/member/dept-role-mapping',1020303),
('A1020304','메뉴 접근 권한','Menu Access Authority','/admin/system/menu-management',1020304),
('A1020305','데이터 범위 권한','Data Scope Authority','/admin/member/dept-role-mapping',1020305),
('A1020306','승인 권한','Approval Authority','/admin/emission/approval-workflow',1020306);

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
SELECT 'AMENU1',code,name_ko,name_en,'Y',CURRENT_TIMESTAMP,'MENU_FINAL_IA',CURRENT_TIMESTAMP,'MENU_FINAL_IA' FROM member_company_authority_leaf
ON CONFLICT(code_id,code) DO UPDATE SET code_nm=EXCLUDED.code_nm,code_dc=EXCLUDED.code_dc,use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_FINAL_IA';
INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
SELECT code,name_ko,name_en,menu_url,'manage_accounts','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y' FROM member_company_authority_leaf
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm,menu_nm_en=EXCLUDED.menu_nm_en,menu_url=EXCLUDED.menu_url,use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP;
INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
SELECT code,sort_order,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM member_company_authority_leaf
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;

UPDATE comtnmenuinfo SET use_at='N',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP
WHERE left(menu_code,4)='A102' AND length(menu_code)=8 AND menu_code NOT IN(SELECT code FROM member_company_authority_leaf);
UPDATE comtccmmndetailcode SET use_at='N',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_FINAL_IA'
WHERE code_id='AMENU1' AND left(code,4)='A102' AND length(code)=8 AND code NOT IN(SELECT code FROM member_company_authority_leaf);
