INSERT INTO framework_process_definition
(process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,process_status,created_at,updated_at)
VALUES
('CUSTOMER_WORK_COORDINATION','통합 업무 조정','CUSTOMER_HOME','1.0.0','고객에게 현재 업무·마감·알림·다음 행동을 통합 제공한다.','인증된 계정에 하나 이상의 업무 또는 프로젝트가 배정되어 있다.','고객이 다음 업무 화면에 진입하고 처리 결과가 Task에 반영된다.','DEVELOPMENT_READY',current_timestamp,current_timestamp),
('MONITORING_ANALYSIS','모니터링·분석','MONITORING','1.0.0','배출·LCA·감축 데이터를 품질과 목표 관점에서 분석하고 공유한다.','조회 권한과 분석 대상 조직·기간이 정해져 있다.','분석 결과·이상치·내보내기 이력이 감사 가능하게 저장된다.','DEVELOPMENT_READY',current_timestamp,current_timestamp),
('PLATFORM_OPERATION','플랫폼 운영','PLATFORM','1.0.0','메뉴·화면·권한·배포·감사를 안정적으로 운영한다.','플랫폼 운영 권한과 변경 요청이 승인되어 있다.','변경이 검증·배포되고 감사 및 복구 증적이 남는다.','DEVELOPMENT_READY',current_timestamp,current_timestamp)
ON CONFLICT(process_code) DO UPDATE SET
 process_name=excluded.process_name,domain_code=excluded.domain_code,goal=excluded.goal,
 start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,
 process_status=excluded.process_status,updated_at=current_timestamp;

INSERT INTO framework_process_step
(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule,user_path,admin_path,api_contract)
VALUES
('CUSTOMER_WORK_COORDINATION',1,'CUSTOMER_WORK_DISCOVER','내 업무·알림 조회','COMPANY_MANAGER','READY','DISCOVER_WORK','WORK_SELECTED','권한과 프로젝트 상태에 맞는 업무만 표시된다.','/emission/my-tasks','/admin/emission/project-operations','GET /home/api/emission-tasks'),
('CUSTOMER_WORK_COORDINATION',2,'CUSTOMER_WORK_PRIORITIZE','마감·우선순위 확인','COMPANY_MANAGER','WORK_SELECTED','PRIORITIZE_WORK','WORK_PRIORITIZED','지연·오늘 마감·차단 업무와 선행조건이 표시된다.','/emission/deadline-status','/admin/emission/project-operations','GET /home/api/emission-tasks'),
('CUSTOMER_WORK_COORDINATION',3,'CUSTOMER_WORK_OPEN','실제 업무 화면 진입','COMPANY_MANAGER','WORK_PRIORITIZED','OPEN_WORKSPACE','WORK_IN_PROGRESS','Task의 프로젝트·단계·액터와 일치하는 업무 화면이 열린다.','/emission/my-tasks','/admin/system/actor-process','POST /home/api/emission-tasks/{id}/status'),
('CUSTOMER_WORK_COORDINATION',4,'CUSTOMER_WORK_CONTINUE','완료 결과·다음 업무 연결','COMPANY_MANAGER','WORK_IN_PROGRESS','CONTINUE_WORK','COMPLETED','실제 업무 결과로 현재 Task가 완료되고 후속 Task가 활성화된다.','/emission/my-tasks','/admin/system/actor-process','GET /home/api/emission-tasks'),
('MONITORING_ANALYSIS',1,'MONITORING_SCOPE','분석 범위 선택','COMPANY_MANAGER','READY','SELECT_SCOPE','SCOPED','조직·사업장·Scope·기간과 데이터 권한이 적용된다.','/monitoring','/admin/system/monitoring-dashboard','GET /home/api/monitoring'),
('MONITORING_ANALYSIS',2,'MONITORING_REVIEW','지표·품질·이상치 분석','VERIFIER','SCOPED','ANALYZE','ANALYZED','지표 근거와 품질·이상치가 원본 데이터까지 추적된다.','/monitoring/statistics','/admin/emission/validation-rule','GET /home/api/monitoring'),
('MONITORING_ANALYSIS',3,'MONITORING_EXPORT','분석 결과 내보내기','COMPANY_MANAGER','ANALYZED','EXPORT','EXPORTED','내보낸 데이터의 범위·버전·행위자가 기록된다.','/monitoring/export','/admin/system/audit-log','POST /home/api/monitoring/export'),
('MONITORING_ANALYSIS',4,'MONITORING_SHARE','이해관계자 공유','APPROVER','EXPORTED','SHARE','COMPLETED','승인된 대상과 기간에만 분석 결과가 공유된다.','/monitoring/share','/admin/permissions','POST /home/api/monitoring/share'),
('PLATFORM_OPERATION',1,'PLATFORM_DESIGN','메뉴·화면·권한 설계','PLATFORM_OPERATOR','READY','DESIGN_CHANGE','DESIGNED','변경 대상과 액터·프로세스·권한·완료 기준이 정의된다.',null,'/admin/system/actor-process','POST /admin/api/system/actor-process'),
('PLATFORM_OPERATION',2,'PLATFORM_VALIDATE','코드·계약·고객 여정 검증','PLATFORM_OPERATOR','DESIGNED','VALIDATE_CHANGE','VALIDATED','컴파일·권한·메뉴·Task·모바일·복구 게이트를 통과한다.',null,'/admin/system/actor-process','GET /admin/api/system/actor-process'),
('PLATFORM_OPERATION',3,'PLATFORM_DEPLOY','무중단 배포','PLATFORM_OPERATOR','VALIDATED','DEPLOY','DEPLOYED','DB 백업 후 두 Pod가 순차 교체되고 상태가 UP이다.',null,'/admin/system/deployment','POST /admin/api/system/deployment'),
('PLATFORM_OPERATION',4,'PLATFORM_AUDIT','운영·감사·복구 확인','AUDITOR','DEPLOYED','AUDIT_RELEASE','COMPLETED','커밋·DB 마이그레이션·배포·복구 증적이 연결된다.',null,'/admin/system/audit-log','GET /admin/api/system/audit-log')
ON CONFLICT(process_code,step_code) DO UPDATE SET
 step_name=excluded.step_name,actor_code=excluded.actor_code,from_state=excluded.from_state,
 command_code=excluded.command_code,to_state=excluded.to_state,completion_rule=excluded.completion_rule,
 user_path=excluded.user_path,admin_path=excluded.admin_path,api_contract=excluded.api_contract;

UPDATE framework_process_step SET actor_code='LCA_PRACTITIONER'
WHERE process_code='LCA_EXECUTION' AND step_order<4;
UPDATE framework_process_step SET actor_code='REDUCTION_MANAGER'
WHERE process_code='REDUCTION_EXECUTION' AND step_order<4;
UPDATE framework_process_step SET actor_code='SYSTEM_INTEGRATOR'
WHERE process_code='DATA_INTEGRATION' AND step_order<4;

CREATE TABLE IF NOT EXISTS framework_process_menu_binding (
 menu_code varchar(20) PRIMARY KEY REFERENCES comtnmenuinfo(menu_code) ON DELETE CASCADE,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code),
 step_code varchar(80) NOT NULL,
 actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
 audience varchar(20) NOT NULL CHECK(audience IN ('USER','ADMIN')),
 menu_url varchar(500) NOT NULL,
 binding_source varchar(30) NOT NULL DEFAULT 'AUTO_CLASSIFIED',
 binding_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
 verified_at timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code)
);

WITH classified AS (
 SELECT m.menu_code,m.menu_url,
   CASE
    WHEN m.menu_code LIKE 'H101%' THEN 'CUSTOMER_WORK_COORDINATION'
    WHEN m.menu_code LIKE 'H102%' OR m.menu_code LIKE 'A103%' THEN 'EMISSION_PROJECT'
    WHEN m.menu_code LIKE 'H103%' OR m.menu_code LIKE 'A104%' THEN 'LCA_EXECUTION'
    WHEN m.menu_code LIKE 'H104%' OR m.menu_code LIKE 'A105%' THEN 'REDUCTION_EXECUTION'
    WHEN m.menu_code LIKE 'H105%' THEN 'MONITORING_ANALYSIS'
    WHEN m.menu_code LIKE 'H106%' THEN 'TRADE_EXECUTION'
    WHEN m.menu_code LIKE 'H107%' OR m.menu_code LIKE 'A108%' THEN 'CONTENT_OPERATION'
    WHEN m.menu_code LIKE 'H108%' OR m.menu_code LIKE 'A102%' THEN 'MEMBER_LIFECYCLE'
    WHEN m.menu_code LIKE 'A106%' OR m.menu_code LIKE 'A107%' THEN 'GOVERNANCE_CHANGE'
    WHEN m.menu_code LIKE 'A110%' THEN 'DATA_INTEGRATION'
    WHEN m.menu_code LIKE 'A101%' OR m.menu_code LIKE 'A111%' THEN 'PLATFORM_OPERATION'
    WHEN m.menu_code LIKE 'A109%' AND lower(m.menu_url) ~ '(payment|settle|refund|account)' THEN 'PAYMENT_SETTLEMENT'
    WHEN m.menu_code LIKE 'A109%' AND lower(m.menu_url) ~ '(certificate|verify|issu)' THEN 'CERTIFICATE_ISSUANCE'
    WHEN m.menu_code LIKE 'A109%' THEN 'TRADE_EXECUTION'
    WHEN lower(m.menu_url) ~ '(lca|lci|ecoinvent)' THEN 'LCA_EXECUTION'
    WHEN lower(m.menu_url) ~ '(reduction|target|scenario)' THEN 'REDUCTION_EXECUTION'
    WHEN lower(m.menu_url) ~ '(certificate|report)' THEN 'REPORT_CERTIFICATION'
    WHEN lower(m.menu_url) ~ '(member|company|auth|permission)' THEN 'MEMBER_LIFECYCLE'
    WHEN lower(m.menu_url) ~ '(external|api|webhook|sync)' THEN 'DATA_INTEGRATION'
    WHEN lower(m.menu_url) ~ '(trade|co2|credit)' THEN 'TRADE_EXECUTION'
    WHEN lower(m.menu_url) ~ '(emission|survey|factor|gwp)' THEN 'EMISSION_PROJECT'
    ELSE 'PLATFORM_OPERATION' END AS process_code,
   CASE WHEN m.menu_code LIKE 'H%' THEN 'USER' ELSE 'ADMIN' END AS audience,
   CASE
    WHEN lower(m.menu_url) ~ '(approval|approve|승인)' THEN 'APPROVER'
    WHEN lower(m.menu_url) ~ '(audit|감사)' THEN 'AUDITOR'
    WHEN lower(m.menu_url) ~ '(validation|validate|verify|quality|검증)' THEN 'VERIFIER'
    WHEN lower(m.menu_url) ~ '(upload|data_input|activity|evidence|survey-admin-data)' THEN 'SITE_DATA_OWNER'
    WHEN lower(m.menu_url) ~ '(calculate|calculation|factor|gwp|simulate|result)' THEN 'CALCULATOR'
    WHEN lower(m.menu_url) ~ '(lca|lci|ecoinvent)' THEN 'LCA_PRACTITIONER'
    WHEN lower(m.menu_url) ~ '(reduction|target|scenario)' THEN 'REDUCTION_MANAGER'
    WHEN lower(m.menu_url) ~ '(external|webhook|sync|connection|api-management)' THEN 'SYSTEM_INTEGRATOR'
    WHEN m.menu_code LIKE 'A%' THEN 'PLATFORM_OPERATOR'
    ELSE 'COMPANY_MANAGER' END AS preferred_actor
 FROM comtnmenuinfo m
 WHERE m.use_at='Y' AND coalesce(m.expsr_at,'Y')='Y'
   AND btrim(coalesce(m.menu_url,'')) NOT IN ('','#') AND m.menu_url LIKE '/%'
), resolved AS (
 SELECT c.*,s.step_code,s.actor_code
 FROM classified c
 JOIN LATERAL (
   SELECT step_code,actor_code FROM framework_process_step
   WHERE process_code=c.process_code
   ORDER BY CASE WHEN actor_code=c.preferred_actor THEN 0 ELSE 1 END,step_order LIMIT 1
 ) s ON true
)
INSERT INTO framework_process_menu_binding
(menu_code,process_code,step_code,actor_code,audience,menu_url,binding_source,binding_status,verified_at,updated_at)
SELECT menu_code,process_code,step_code,actor_code,audience,menu_url,'AUTO_CLASSIFIED','ACTIVE',current_timestamp,current_timestamp
FROM resolved
ON CONFLICT(menu_code) DO UPDATE SET
 process_code=excluded.process_code,step_code=excluded.step_code,actor_code=excluded.actor_code,
 audience=excluded.audience,menu_url=excluded.menu_url,binding_source=excluded.binding_source,
 binding_status='ACTIVE',verified_at=current_timestamp,updated_at=current_timestamp;

UPDATE comtnmenuinfo m SET expsr_at='N',last_updt_pnttm=current_timestamp
WHERE m.use_at='Y' AND coalesce(m.expsr_at,'Y')='Y'
  AND btrim(coalesce(m.menu_url,'')) IN ('','#')
  AND NOT EXISTS (
    SELECT 1 FROM comtnmenuinfo child
    WHERE child.menu_code LIKE m.menu_code||'%'
      AND length(child.menu_code)>length(m.menu_code)
      AND child.use_at='Y' AND coalesce(child.expsr_at,'Y')='Y'
  );

CREATE OR REPLACE VIEW framework_actor_process_menu_coverage AS
SELECT m.menu_code,m.menu_nm,m.menu_url,
       CASE WHEN m.menu_code LIKE 'H%' THEN 'USER' ELSE 'ADMIN' END AS audience,
       b.process_code,b.step_code,b.actor_code,
       CASE WHEN b.menu_code IS NULL THEN 'MISSING' ELSE 'BOUND' END AS binding_status
FROM comtnmenuinfo m
LEFT JOIN framework_process_menu_binding b ON b.menu_code=m.menu_code AND b.binding_status='ACTIVE'
WHERE m.use_at='Y' AND coalesce(m.expsr_at,'Y')='Y'
  AND btrim(coalesce(m.menu_url,'')) NOT IN ('','#') AND m.menu_url LIKE '/%';

CREATE OR REPLACE VIEW framework_actor_process_menu_summary AS
SELECT count(*) AS navigable_menu_count,
       count(*) FILTER(WHERE binding_status='BOUND') AS bound_menu_count,
       count(*) FILTER(WHERE binding_status='MISSING') AS missing_menu_count,
       count(DISTINCT process_code) FILTER(WHERE process_code IS NOT NULL) AS connected_process_count,
       count(DISTINCT actor_code) FILTER(WHERE actor_code IS NOT NULL) AS connected_actor_count
FROM framework_actor_process_menu_coverage;
