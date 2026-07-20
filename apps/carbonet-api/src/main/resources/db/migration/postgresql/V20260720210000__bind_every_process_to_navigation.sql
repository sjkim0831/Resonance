-- Every active process must have a safe navigation target. A design workspace
-- is not an implemented business screen and is explicitly classified as such.
CREATE TABLE IF NOT EXISTS framework_process_navigation_binding (
  process_code varchar(80) PRIMARY KEY REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  menu_code varchar(20) NOT NULL REFERENCES comtnmenuinfo(menu_code) ON DELETE RESTRICT,
  step_code varchar(100) NOT NULL,
  actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
  audience varchar(20) NOT NULL CHECK(audience IN ('USER','ADMIN')),
  navigation_type varchar(30) NOT NULL CHECK(navigation_type IN ('IMPLEMENTED_SCREEN','DESIGN_WORKSPACE','INTERNAL_TAB','HIDDEN_ROUTE')),
  target_path varchar(500) NOT NULL,
  business_screen_implemented boolean NOT NULL DEFAULT false,
  binding_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  binding_source varchar(40) NOT NULL DEFAULT 'PROCESS_NAVIGATION_FACTORY',
  verified_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code)
);

CREATE INDEX IF NOT EXISTS ix_process_navigation_menu
  ON framework_process_navigation_binding(menu_code,binding_status,process_code);
CREATE INDEX IF NOT EXISTS ix_process_navigation_type
  ON framework_process_navigation_binding(navigation_type,business_screen_implemented,binding_status);

WITH active_process AS (
  SELECT p.*,
    CASE upper(p.domain_code)
      WHEN 'MEMBER' THEN 'H108%'
      WHEN 'EMISSION' THEN 'H102%'
      WHEN 'LCA' THEN 'H103%'
      WHEN 'REDUCTION' THEN 'H104%'
      WHEN 'MONITORING' THEN 'H105%'
      WHEN 'TRADE' THEN 'H106%'
      WHEN 'CERTIFICATE' THEN 'H106%'
      WHEN 'EDUCATION' THEN 'H107%'
      WHEN 'PORTFOLIO' THEN 'H102%'
      WHEN 'FACILITY_OPERATION' THEN 'H102%'
      WHEN 'MRV' THEN 'H106%'
      WHEN 'COMPLIANCE' THEN 'H102%'
      WHEN 'DATA_GOVERNANCE' THEN 'A106%'
      WHEN 'SYSTEM' THEN 'A111%'
      ELSE 'H101%' END AS preferred_menu_prefix
  FROM framework_process_definition p
  JOIN framework_business_work_type w ON w.work_type_code=upper(p.domain_code) AND w.use_at='Y'
), resolved AS (
  SELECT p.process_code,step.step_code,step.actor_code,
    coalesce(screen.audience,CASE WHEN p.preferred_menu_prefix LIKE 'H%' THEN 'USER' ELSE 'ADMIN' END) AS audience,
    CASE WHEN screen.route_path IS NOT NULL THEN 'IMPLEMENTED_SCREEN' ELSE 'DESIGN_WORKSPACE' END AS navigation_type,
    coalesce(screen.route_path,'/admin/system/actor-process?process='||p.process_code) AS target_path,
    (screen.route_path IS NOT NULL) AS business_screen_implemented,
    menu.menu_code
  FROM active_process p
  JOIN LATERAL (
    SELECT s.step_code,s.actor_code FROM framework_process_step s
    WHERE s.process_code=p.process_code ORDER BY s.step_order LIMIT 1
  ) step ON true
  LEFT JOIN LATERAL (
    SELECT d.audience,coalesce(nullif(d.actual_route_path,''),nullif(d.planned_route_path,'')) AS route_path
    FROM framework_page_design d
    WHERE d.process_code=p.process_code AND d.route_status='IMPLEMENTED'
      AND coalesce(nullif(d.actual_route_path,''),nullif(d.planned_route_path,'')) IS NOT NULL
    ORDER BY CASE d.audience WHEN 'USER' THEN 0 ELSE 1 END,d.page_design_id LIMIT 1
  ) screen ON true
  JOIN LATERAL (
    SELECT m.menu_code FROM comtnmenuinfo m
    WHERE m.use_at='Y' AND coalesce(m.expsr_at,'Y')='Y'
      AND btrim(coalesce(m.menu_url,'')) NOT IN ('','#') AND m.menu_url LIKE '/%'
      AND (m.menu_code LIKE p.preferred_menu_prefix OR m.menu_code LIKE 'A111%')
    ORDER BY CASE WHEN m.menu_code LIKE p.preferred_menu_prefix THEN 0 ELSE 1 END,
      length(m.menu_code),m.menu_code LIMIT 1
  ) menu ON true
)
INSERT INTO framework_process_navigation_binding(
 process_code,menu_code,step_code,actor_code,audience,navigation_type,target_path,
 business_screen_implemented,binding_status,binding_source,verified_at)
SELECT process_code,menu_code,step_code,actor_code,audience,navigation_type,target_path,
 business_screen_implemented,'ACTIVE','PROCESS_NAVIGATION_FACTORY',current_timestamp
FROM resolved
ON CONFLICT(process_code) DO UPDATE SET
 menu_code=excluded.menu_code,step_code=excluded.step_code,actor_code=excluded.actor_code,
 audience=excluded.audience,navigation_type=excluded.navigation_type,target_path=excluded.target_path,
 business_screen_implemented=excluded.business_screen_implemented,binding_status='ACTIVE',
 binding_source=excluded.binding_source,verified_at=current_timestamp,updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_process_navigation_coverage AS
SELECT p.process_code,p.process_name,p.domain_code,p.owner_actor_code,
       n.menu_code,m.menu_nm,m.menu_url,n.step_code,n.actor_code,n.audience,
       n.navigation_type,n.target_path,n.business_screen_implemented,
       CASE
         WHEN n.process_code IS NULL THEN 'NAVIGATION_MISSING'
         WHEN n.navigation_type='IMPLEMENTED_SCREEN' AND n.business_screen_implemented THEN 'BUSINESS_SCREEN_READY'
         WHEN n.navigation_type='DESIGN_WORKSPACE' THEN 'DESIGN_WORKSPACE_ONLY'
         ELSE 'NAVIGATION_REVIEW_REQUIRED' END AS navigation_status,
       (SELECT count(*) FROM framework_page_design d WHERE d.process_code=p.process_code) AS page_design_count,
       (SELECT count(*) FROM framework_page_design d WHERE d.process_code=p.process_code AND d.route_status='IMPLEMENTED') AS implemented_page_count
FROM framework_process_definition p
JOIN framework_business_work_type w ON w.work_type_code=upper(p.domain_code) AND w.use_at='Y'
LEFT JOIN framework_process_navigation_binding n ON n.process_code=p.process_code AND n.binding_status='ACTIVE'
LEFT JOIN comtnmenuinfo m ON m.menu_code=n.menu_code;

CREATE OR REPLACE VIEW framework_process_navigation_summary AS
SELECT count(*) AS process_count,
       count(*) FILTER(WHERE navigation_status<>'NAVIGATION_MISSING') AS navigation_bound_count,
       count(*) FILTER(WHERE navigation_status='NAVIGATION_MISSING') AS navigation_missing_count,
       count(*) FILTER(WHERE navigation_status='BUSINESS_SCREEN_READY') AS business_screen_ready_count,
       count(*) FILTER(WHERE navigation_status='DESIGN_WORKSPACE_ONLY') AS design_workspace_only_count,
       count(*) FILTER(WHERE page_design_count=0) AS page_design_missing_count
FROM framework_process_navigation_coverage;

DO $$
DECLARE audit framework_process_navigation_summary%ROWTYPE;
BEGIN
  SELECT * INTO audit FROM framework_process_navigation_summary;
  IF audit.navigation_bound_count<>audit.process_count OR audit.navigation_missing_count<>0 THEN
    RAISE EXCEPTION 'PROCESS_NAVIGATION_INCOMPLETE processes=% bound=% missing=%',
      audit.process_count,audit.navigation_bound_count,audit.navigation_missing_count;
  END IF;
END $$;
