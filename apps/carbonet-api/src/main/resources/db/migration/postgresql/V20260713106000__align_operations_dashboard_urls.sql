CREATE TEMP TABLE operations_dashboard_url(code varchar(20) PRIMARY KEY, menu_url varchar(500));
INSERT INTO operations_dashboard_url VALUES
('A1010101','/admin/'),
('A1010102','/admin/monitoring/center'),
('A1010103','/admin/emission/site-management'),
('A1010104','/admin/certificate/pending_list'),
('A1010105','/admin/emission/management'),
('A1010106','/admin/emission/validate'),
('A1010107','/admin/system/access_history'),
('A1010108','/admin/system/monitoring-dashboard'),
('A1010109','/admin/system/error-log');

UPDATE comtnmenuinfo m
SET menu_url=u.menu_url,last_updt_pnttm=CURRENT_TIMESTAMP
FROM operations_dashboard_url u
WHERE m.menu_code=u.code;
