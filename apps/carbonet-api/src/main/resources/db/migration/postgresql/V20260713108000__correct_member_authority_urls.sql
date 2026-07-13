CREATE TEMP TABLE corrected_member_authority_url(code varchar(20) PRIMARY KEY, menu_url varchar(500));
INSERT INTO corrected_member_authority_url VALUES
('A1020104','/admin/member/list'),
('A1020301','/admin/member/admin_account/permissions'),
('A1020303','/admin/member/admin_account/permissions'),
('A1020304','/admin/system/menu'),
('A1020305','/admin/member/dept-role-mapping'),
('A1020306','/admin/member/auth-change');

UPDATE comtnmenuinfo m
SET menu_url=u.menu_url,last_updt_pnttm=CURRENT_TIMESTAMP
FROM corrected_member_authority_url u
WHERE m.menu_code=u.code;
