-- Bind navigation to the business meaning of a screen, not merely to a URL
-- substring or a historical menu-code prefix.

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_step
SET user_path='/emission/calculation'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CALCULATE';

UPDATE framework_process_step SET
 user_path=CASE step_code
   WHEN 'REDUCTION_EXECUTION_01_PLAN' THEN '/emission/reduction'
   WHEN 'REDUCTION_EXECUTION_02_WORK' THEN '/emission/simulate'
   WHEN 'REDUCTION_EXECUTION_03_VERIFY' THEN '/emission/reduction?tab=verification'
   WHEN 'REDUCTION_EXECUTION_04_APPROVE' THEN '/emission/reduction?tab=approval' END,
 admin_path=CASE step_code
   WHEN 'REDUCTION_EXECUTION_01_PLAN' THEN '/admin/reduction/target'
   WHEN 'REDUCTION_EXECUTION_02_WORK' THEN '/admin/reduction/task'
   WHEN 'REDUCTION_EXECUTION_03_VERIFY' THEN '/admin/reduction/result'
   WHEN 'REDUCTION_EXECUTION_04_APPROVE' THEN '/admin/reduction/result?tab=approval' END
WHERE process_code='REDUCTION_EXECUTION';

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_professional_screen_contract SET
 route_path='/emission/calculation',
 screen_name='배출계수 매핑·배출량 산정',
 updated_by='FLYWAY_SEMANTIC_ROUTE_RECONCILIATION',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CALCULATE' AND audience='USER';

INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,
 api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,exception_states_verified,
 audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT 'REDUCTION_EXECUTION','REDUCTION_EXECUTION_02_WORK','USER','/emission/simulate',
 '감축 전략 시나리오','REDUCTION_MANAGER',
 '기술 투자, 공정 효율, 재생에너지 및 CCUS 변수를 비교하여 실행 가능한 감축 경로를 수립한다.',
 '감축 기준연도와 목표 및 비교 가능한 배출량 기준선이 존재한다.',
 '선택한 시나리오의 감축량, 비용, 목표 격차와 저장 버전이 기록된다.',
 '예상 감축량; 목표 격차; 투자 대비 효과',
 '전략 제언; 배출 추세; 시나리오 빌더; 예상 효과; 저장 이력',
 '기술 투자; 효율 개선률; 재생에너지 비율; CCUS 적용률',
 '시나리오 계산; 저장; 비교; 검증 요청','READY; SIMULATED; SAVED; SUBMITTED',
 'reduction-scenario-workflow','reduction scenario; emission baseline; reduction target',
 '입력 변수와 계산 결과 및 저장 버전 감사 증적',
 '모바일 단일열; 데스크톱 차트와 조정 패널 2열','WCAG 2.1 AA; 키보드 슬라이더; 비색상 상태표시',
 'REDUCTION_MANAGER 프로젝트 범위; 테넌트 격리; 저장 멱등성',
 false,false,false,true,true,true,'design:semantic-route-reconciliation','DESIGN_COMPLETE','FLYWAY_SEMANTIC_ROUTE_RECONCILIATION','HIDDEN',false
WHERE NOT EXISTS (
 SELECT 1 FROM framework_professional_screen_contract
 WHERE process_code='REDUCTION_EXECUTION' AND step_code='REDUCTION_EXECUTION_02_WORK' AND audience='USER'
   AND lower(split_part(route_path,'?',1))='/emission/simulate'
);

CREATE TABLE IF NOT EXISTS framework_menu_route_semantic_audit (
 menu_code varchar(20) PRIMARY KEY REFERENCES comtnmenuinfo(menu_code) ON DELETE CASCADE,
 menu_url varchar(500) NOT NULL,
 resolved_process_code varchar(80),
 resolved_step_code varchar(80),
 resolved_actor_code varchar(60),
 resolution_source varchar(30) NOT NULL,
 confidence_score integer NOT NULL DEFAULT 0,
 semantic_status varchar(30) NOT NULL,
 detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
 checked_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE OR REPLACE FUNCTION framework_refresh_menu_semantic_binding(p_menu_code varchar)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
 v_menu record;
 v_expected_process varchar(80);
 v_preferred_actor varchar(60);
 v_resolved record;
 v_audience varchar(20);
BEGIN
 SELECT * INTO v_menu FROM comtnmenuinfo WHERE menu_code=p_menu_code;
 IF NOT FOUND OR v_menu.use_at<>'Y' OR coalesce(v_menu.expsr_at,'Y')<>'Y'
    OR btrim(coalesce(v_menu.menu_url,'')) IN ('','#') OR v_menu.menu_url NOT LIKE '/%' THEN
   DELETE FROM framework_process_menu_binding WHERE menu_code=p_menu_code;
   DELETE FROM framework_menu_route_semantic_audit WHERE menu_code=p_menu_code;
   RETURN;
 END IF;

 v_audience:=CASE WHEN v_menu.menu_code LIKE 'H%' THEN 'USER' ELSE 'ADMIN' END;
 v_expected_process:=CASE
   WHEN v_menu.menu_code LIKE 'H101%' THEN 'CUSTOMER_WORK_COORDINATION'
   WHEN v_menu.menu_code LIKE 'H102%' OR v_menu.menu_code LIKE 'A103%' THEN 'EMISSION_PROJECT'
   WHEN v_menu.menu_code LIKE 'H103%' OR v_menu.menu_code LIKE 'A104%' THEN 'LCA_EXECUTION'
   WHEN v_menu.menu_code LIKE 'H104%' OR v_menu.menu_code LIKE 'A105%' THEN 'REDUCTION_EXECUTION'
   WHEN v_menu.menu_code LIKE 'H105%' THEN 'MONITORING_ANALYSIS'
   WHEN v_menu.menu_code LIKE 'H106%' OR v_menu.menu_code LIKE 'A109%' THEN 'TRADE_EXECUTION'
   WHEN v_menu.menu_code LIKE 'H107%' OR v_menu.menu_code LIKE 'A108%' THEN 'CONTENT_OPERATION'
   WHEN v_menu.menu_code LIKE 'H108%' OR v_menu.menu_code LIKE 'A102%' THEN 'MEMBER_LIFECYCLE'
   WHEN v_menu.menu_code LIKE 'A106%' OR v_menu.menu_code LIKE 'A107%' THEN 'GOVERNANCE_CHANGE'
   WHEN v_menu.menu_code LIKE 'A110%' THEN 'DATA_INTEGRATION'
   WHEN lower(v_menu.menu_url) ~ '(lca|lci|ecoinvent|survey-admin)' THEN 'LCA_EXECUTION'
   WHEN lower(v_menu.menu_url) ~ '(reduction|target|scenario)' THEN 'REDUCTION_EXECUTION'
   WHEN lower(v_menu.menu_url) ~ '(certificate|report)' THEN 'REPORT_CERTIFICATION'
   WHEN lower(v_menu.menu_url) ~ '(monitoring|statistics|analysis)' THEN 'MONITORING_ANALYSIS'
   WHEN lower(v_menu.menu_url) ~ '(external|webhook|sync|connection)' THEN 'DATA_INTEGRATION'
   WHEN lower(v_menu.menu_url) ~ '(trade|co2|credit|payment|settle|refund)' THEN 'TRADE_EXECUTION'
   WHEN lower(v_menu.menu_url) ~ '(emission|activity|factor|gwp|calculation)' THEN 'EMISSION_PROJECT'
   ELSE 'PLATFORM_OPERATION' END;
 v_preferred_actor:=CASE
   WHEN lower(v_menu.menu_url||' '||v_menu.menu_nm) ~ '(approval|approve|승인)' THEN 'APPROVER'
   WHEN lower(v_menu.menu_url||' '||v_menu.menu_nm) ~ '(audit|감사)' THEN 'AUDITOR'
   WHEN lower(v_menu.menu_url||' '||v_menu.menu_nm) ~ '(validation|validate|verify|quality|검증)' THEN 'VERIFIER'
   WHEN lower(v_menu.menu_url||' '||v_menu.menu_nm) ~ '(upload|data_input|activity|evidence|자료|증빙)' THEN 'SITE_DATA_OWNER'
   WHEN lower(v_menu.menu_url||' '||v_menu.menu_nm) ~ '(calculate|calculation|factor|gwp|산정|계수)' THEN 'CALCULATOR'
   WHEN v_expected_process='LCA_EXECUTION' THEN 'LCA_PRACTITIONER'
   WHEN v_expected_process='REDUCTION_EXECUTION' THEN 'REDUCTION_MANAGER'
   WHEN v_expected_process='DATA_INTEGRATION' THEN 'SYSTEM_INTEGRATOR'
   WHEN v_audience='ADMIN' THEN 'PLATFORM_OPERATOR'
   ELSE 'COMPANY_MANAGER' END;

 WITH candidates AS (
   SELECT s.process_code,s.step_code,s.actor_code,'STEP_ROUTE'::varchar source,
          500 + CASE WHEN s.process_code=v_expected_process THEN 80 ELSE 0 END
              + CASE WHEN s.actor_code=v_preferred_actor THEN 20 ELSE 0 END score
   FROM framework_process_step s
   WHERE lower(split_part(CASE WHEN v_audience='USER' THEN s.user_path ELSE s.admin_path END,'?',1))
         =lower(split_part(v_menu.menu_url,'?',1))
   UNION ALL
   SELECT c.process_code,c.step_code,c.actor_code,'SCREEN_CONTRACT'::varchar,
          350 + CASE WHEN c.process_code=v_expected_process THEN 80 ELSE 0 END
              + CASE WHEN c.actor_code=v_preferred_actor THEN 20 ELSE 0 END
              + CASE WHEN c.contract_status='VERIFIED' THEN 20 ELSE 0 END
   FROM framework_professional_screen_contract c
   WHERE c.audience=v_audience
     AND lower(split_part(c.route_path,'?',1))=lower(split_part(v_menu.menu_url,'?',1))
   UNION ALL
   SELECT s.process_code,s.step_code,s.actor_code,'DOMAIN_FALLBACK'::varchar,
          100 + CASE WHEN s.actor_code=v_preferred_actor THEN 20 ELSE 0 END - s.step_order
   FROM framework_process_step s WHERE s.process_code=v_expected_process
 ), ranked AS (
   SELECT *,row_number() over(order by score desc,process_code,step_code) rn FROM candidates
 ) SELECT process_code,step_code,actor_code,source,score INTO v_resolved FROM ranked WHERE rn=1;

 IF NOT FOUND THEN
   DELETE FROM framework_process_menu_binding WHERE menu_code=p_menu_code;
   INSERT INTO framework_menu_route_semantic_audit(menu_code,menu_url,resolution_source,semantic_status,detail_json)
   VALUES(p_menu_code,v_menu.menu_url,'NO_PROCESS_STEP','UNRESOLVED',jsonb_build_object('expectedProcess',v_expected_process))
   ON CONFLICT(menu_code) DO UPDATE SET menu_url=excluded.menu_url,resolution_source=excluded.resolution_source,
     semantic_status=excluded.semantic_status,detail_json=excluded.detail_json,checked_at=current_timestamp;
   RETURN;
 END IF;

 INSERT INTO framework_process_menu_binding
 (menu_code,process_code,step_code,actor_code,audience,menu_url,binding_source,binding_status,verified_at,updated_at)
 VALUES(p_menu_code,v_resolved.process_code,v_resolved.step_code,v_resolved.actor_code,v_audience,v_menu.menu_url,
        v_resolved.source,'ACTIVE',CASE WHEN v_resolved.score>=350 THEN current_timestamp ELSE null END,current_timestamp)
 ON CONFLICT(menu_code) DO UPDATE SET process_code=excluded.process_code,step_code=excluded.step_code,
   actor_code=excluded.actor_code,audience=excluded.audience,menu_url=excluded.menu_url,
   binding_source=excluded.binding_source,binding_status='ACTIVE',verified_at=excluded.verified_at,updated_at=current_timestamp;

 INSERT INTO framework_menu_route_semantic_audit
 (menu_code,menu_url,resolved_process_code,resolved_step_code,resolved_actor_code,resolution_source,
  confidence_score,semantic_status,detail_json,checked_at)
 VALUES(p_menu_code,v_menu.menu_url,v_resolved.process_code,v_resolved.step_code,v_resolved.actor_code,v_resolved.source,
        v_resolved.score,CASE WHEN v_resolved.score>=500 THEN 'EXACT_STEP'
                             WHEN v_resolved.score>=350 THEN 'SCREEN_CONTRACT'
                             ELSE 'FALLBACK_REVIEW' END,
        jsonb_build_object('expectedProcess',v_expected_process,'preferredActor',v_preferred_actor),current_timestamp)
 ON CONFLICT(menu_code) DO UPDATE SET menu_url=excluded.menu_url,resolved_process_code=excluded.resolved_process_code,
   resolved_step_code=excluded.resolved_step_code,resolved_actor_code=excluded.resolved_actor_code,
   resolution_source=excluded.resolution_source,confidence_score=excluded.confidence_score,
   semantic_status=excluded.semantic_status,detail_json=excluded.detail_json,checked_at=current_timestamp;
END $fn$;

SELECT framework_refresh_menu_semantic_binding(menu_code) FROM comtnmenuinfo;

CREATE OR REPLACE FUNCTION framework_menu_semantic_binding_trigger()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 PERFORM framework_refresh_menu_semantic_binding(NEW.menu_code);
 RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_framework_menu_semantic_binding ON comtnmenuinfo;
CREATE TRIGGER trg_framework_menu_semantic_binding
AFTER INSERT OR UPDATE OF menu_nm,menu_url,use_at,expsr_at ON comtnmenuinfo
FOR EACH ROW EXECUTE FUNCTION framework_menu_semantic_binding_trigger();

CREATE OR REPLACE VIEW framework_menu_route_semantic_summary AS
SELECT count(*) total_menu_routes,
 count(*) FILTER(WHERE semantic_status='EXACT_STEP') exact_step_routes,
 count(*) FILTER(WHERE semantic_status='SCREEN_CONTRACT') screen_contract_routes,
 count(*) FILTER(WHERE semantic_status='FALLBACK_REVIEW') review_routes,
 count(*) FILTER(WHERE semantic_status='UNRESOLVED') unresolved_routes
FROM framework_menu_route_semantic_audit;
