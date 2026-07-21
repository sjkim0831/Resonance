CREATE TABLE IF NOT EXISTS framework_page_development_plan (
  plan_code varchar(80) PRIMARY KEY,
  plan_name varchar(200) NOT NULL,
  plan_version varchar(30) NOT NULL DEFAULT '1.0',
  plan_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  ordering_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_page_development_item (
  item_id bigserial PRIMARY KEY,
  plan_code varchar(80) NOT NULL REFERENCES framework_page_development_plan(plan_code) ON DELETE CASCADE,
  screen_resource_id bigint NOT NULL REFERENCES framework_screen_resource(screen_resource_id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  priority_score integer NOT NULL DEFAULT 50,
  manual_lock boolean NOT NULL DEFAULT false,
  design_status varchar(30) NOT NULL DEFAULT 'REVIEW_REQUIRED',
  frontend_status varchar(30) NOT NULL DEFAULT 'PLANNED',
  backend_status varchar(30) NOT NULL DEFAULT 'PLANNED',
  test_status varchar(30) NOT NULL DEFAULT 'PLANNED',
  deployment_status varchar(30) NOT NULL DEFAULT 'PLANNED',
  menu_code varchar(30),
  menu_name varchar(200),
  menu_status varchar(30) NOT NULL DEFAULT 'NOT_CONNECTED',
  permission_code varchar(100) NOT NULL,
  permission_name varchar(200) NOT NULL,
  permission_status varchar(30) NOT NULL DEFAULT 'DEFINED',
  blocker_reason text,
  next_action text,
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(plan_code,screen_resource_id),
  UNIQUE(plan_code,sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_page_development_item_next
  ON framework_page_development_item(plan_code,sequence_no,design_status,frontend_status,backend_status,test_status);
CREATE INDEX IF NOT EXISTS idx_page_development_item_screen
  ON framework_page_development_item(screen_resource_id);

INSERT INTO framework_page_development_plan(plan_code,plan_name,plan_version,ordering_policy)
VALUES('SERVICE_PAGE_MASTER','서비스 페이지 순차 개발 마스터','1.0',
  '{"order":["ENTRY","IDENTITY","TENANT","PROJECT","COLLECTION","CALCULATION","VERIFICATION","APPROVAL","REPORT","LCA","REDUCTION","MONITORING","TRADE","SUPPORT","ADMIN"],"rule":"dependency-first, customer-journey-first, fail-closed"}'::jsonb)
ON CONFLICT(plan_code) DO UPDATE SET plan_name=excluded.plan_name,ordering_policy=excluded.ordering_policy,updated_at=current_timestamp;

WITH ranked AS (
  SELECT r.screen_resource_id,
    row_number() over(order by
      CASE
        WHEN r.route_key LIKE '/join/%' THEN 10
        WHEN r.route_key IN('/login','/uat/uia/egovLoginUsr.do') OR r.route_key LIKE '%login%' THEN 20
        WHEN r.route_key LIKE '/emission/project%' THEN 40
        WHEN r.route_key LIKE '/emission/%' THEN 50
        WHEN r.route_key LIKE '/home/%' THEN 60
        WHEN r.route_key LIKE '/admin/%' THEN 80
        ELSE 70 END,
      coalesce((SELECT min(p.development_order*1000+s.step_order)
        FROM framework_process_step_screen_binding b
        JOIN framework_process_definition p USING(process_code)
        JOIN framework_process_step s USING(process_code,step_code)
        WHERE b.screen_resource_id=r.screen_resource_id AND b.binding_status='ACTIVE'),999999),
      r.route_key) AS seq
  FROM framework_screen_resource r
), menu_match AS (
  SELECT r.screen_resource_id,m.menu_code,m.menu_nm,
    row_number() over(partition by r.screen_resource_id order by length(m.menu_code) desc,m.menu_code) rn
  FROM framework_screen_resource r
  JOIN comtnmenuinfo m ON lower(split_part(m.menu_url,'?',1))=r.route_key
)
INSERT INTO framework_page_development_item(
  plan_code,screen_resource_id,sequence_no,priority_score,design_status,frontend_status,backend_status,test_status,deployment_status,
  menu_code,menu_name,menu_status,permission_code,permission_name,permission_status,next_action)
SELECT 'SERVICE_PAGE_MASTER',r.screen_resource_id,ranked.seq::integer,
  CASE WHEN r.route_key LIKE '/join/%' OR r.route_key LIKE '/emission/%' THEN 100 WHEN r.route_key LIKE '/home/%' THEN 90 ELSE 70 END,
  CASE WHEN q.customer_readiness='CUSTOMER_READY' THEN 'VERIFIED' WHEN q.professional_score>=70 THEN 'DESIGNED' ELSE 'REVIEW_REQUIRED' END,
  CASE WHEN r.implementation_status='VERIFIED' THEN 'VERIFIED' WHEN r.implementation_status='IMPLEMENTED' THEN 'IMPLEMENTED' ELSE 'PLANNED' END,
  CASE WHEN coalesce((SELECT count(*) FROM framework_screen_capability c WHERE c.screen_resource_id=r.screen_resource_id),0)>0 THEN 'IMPLEMENTED' ELSE 'PLANNED' END,
  CASE WHEN q.screen_resource_id IS NOT NULL AND NOT ('TEST_MISSING'=ANY(q.gap_codes) OR 'SAFETY_TEST_INCOMPLETE'=ANY(q.gap_codes)) THEN 'VERIFIED' ELSE 'PLANNED' END,
  CASE WHEN r.implementation_status='VERIFIED' THEN 'DEPLOYED' ELSE 'PLANNED' END,
  mm.menu_code,mm.menu_nm,CASE WHEN mm.menu_code IS NULL THEN 'NOT_CONNECTED' ELSE 'CONNECTED' END,
  'PAGE_'||upper(substr(md5(r.route_key),1,16)),r.screen_name||' 접근','DEFINED',
  CASE WHEN q.customer_readiness='CUSTOMER_READY' THEN '완료 상태 유지 및 회귀 테스트' ELSE '설계 계약 보완 후 프론트·백엔드·테스트 순차 개발' END
FROM framework_screen_resource r
JOIN ranked USING(screen_resource_id)
LEFT JOIN framework_screen_professional_quality q USING(screen_resource_id)
LEFT JOIN menu_match mm ON mm.screen_resource_id=r.screen_resource_id AND mm.rn=1
ON CONFLICT(plan_code,screen_resource_id) DO UPDATE SET
  priority_score=excluded.priority_score,menu_code=excluded.menu_code,menu_name=excluded.menu_name,menu_status=excluded.menu_status,
  permission_name=excluded.permission_name,next_action=excluded.next_action,updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_page_development_master AS
SELECT i.item_id,i.plan_code,i.sequence_no,i.priority_score,i.manual_lock,
  r.screen_resource_id,r.route_key,r.screen_name,r.screen_type,r.implementation_status,r.source_ref,
  i.design_status,i.frontend_status,i.backend_status,i.test_status,i.deployment_status,
  i.menu_code,i.menu_name,i.menu_status,i.permission_code,i.permission_name,i.permission_status,
  i.blocker_reason,i.next_action,i.updated_at,
  coalesce(q.professional_score,0) quality_score,coalesce(q.customer_readiness,'IMPLEMENTATION_REQUIRED') customer_readiness,
  coalesce((SELECT string_agg(DISTINCT b.actor_code,', ' ORDER BY b.actor_code) FROM framework_process_step_screen_binding b WHERE b.screen_resource_id=r.screen_resource_id AND b.binding_status='ACTIVE'),'') actor_codes,
  coalesce((SELECT string_agg(DISTINCT b.process_code,', ' ORDER BY b.process_code) FROM framework_process_step_screen_binding b WHERE b.screen_resource_id=r.screen_resource_id AND b.binding_status='ACTIVE'),'') process_codes,
  coalesce((SELECT count(DISTINCT (b.process_code,b.step_code)) FROM framework_process_step_screen_binding b WHERE b.screen_resource_id=r.screen_resource_id AND b.binding_status='ACTIVE'),0) process_step_count,
  coalesce((SELECT count(*) FROM framework_screen_capability c WHERE c.screen_resource_id=r.screen_resource_id),0) capability_count,
  coalesce((SELECT count(*) FROM framework_screen_data_binding d WHERE d.screen_resource_id=r.screen_resource_id),0) field_count
FROM framework_page_development_item i
JOIN framework_screen_resource r USING(screen_resource_id)
LEFT JOIN framework_screen_professional_quality q USING(screen_resource_id);

COMMENT ON TABLE framework_page_development_item IS '페이지별 순차 개발 정본. 액터·프로세스 관계와 구현·메뉴·권한 상태를 추적한다.';
