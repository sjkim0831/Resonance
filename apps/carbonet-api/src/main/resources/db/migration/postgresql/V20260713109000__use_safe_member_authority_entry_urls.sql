CREATE TEMP TABLE safe_member_authority_url(code varchar(20) PRIMARY KEY,menu_url varchar(500));
INSERT INTO safe_member_authority_url VALUES
('A1020102','/admin/member/list'),
('A1020301','/admin/auth/group'),
('A1020306','/admin/auth/group');
UPDATE comtnmenuinfo m SET menu_url=u.menu_url,last_updt_pnttm=CURRENT_TIMESTAMP
FROM safe_member_authority_url u WHERE m.menu_code=u.code;
