UPDATE framework_step_execution_spec
SET screen_contract=jsonb_build_array(
      jsonb_build_object(
        'pageCode','EMISSION_PROJECT_PORTFOLIO_LIST_USER','audience','USER','screenType','LIST_DASHBOARD',
        'title','배출량 프로젝트 포트폴리오','purpose','프로젝트를 검색하고 다음 실행 가능한 업무를 선택한다.',
        'plannedRoute','/emission/project-portfolio','actualRoute','/emission/project-portfolio','routeStatus','IMPLEMENTED',
        'exceptions',jsonb_build_array('LOADING','EMPTY','FORBIDDEN','ERROR'),
        'responsive',jsonb_build_object('mobile',true,'tablet',true,'desktop',true),
        'accessibility',jsonb_build_object('standard','WCAG_2_1_AA_KRDS','keyboard',true)
      ),
      jsonb_build_object(
        'pageCode','EMISSION_PROJECT_PORTFOLIO_LIST_ADMIN','audience','ADMIN','screenType','LIST_DASHBOARD',
        'title','배출량 프로젝트 운영 포트폴리오','purpose','권한 범위의 프로젝트 현황과 다음 업무를 운영한다.',
        'plannedRoute','/admin/emission/project-operations','actualRoute','/admin/emission/project-operations','routeStatus','IMPLEMENTED',
        'exceptions',jsonb_build_array('LOADING','EMPTY','FORBIDDEN','ERROR'),
        'responsive',jsonb_build_object('mobile',true,'tablet',true,'desktop',true),
        'accessibility',jsonb_build_object('standard','WCAG_2_1_AA_KRDS','keyboard',true)
      )
    ),
    command_contract=jsonb_build_array(
      jsonb_build_object('commandCode','LOAD_PORTFOLIO_PREFERENCE','method','GET','idempotencyRequired',true),
      jsonb_build_object('commandCode','SAVE_PORTFOLIO_PREFERENCE','method','PUT','idempotencyRequired',true),
      jsonb_build_object('commandCode','SELECT_PROJECT','method','POST','idempotencyRequired',true)
    ),
    api_contract=jsonb_build_array(
      jsonb_build_object('method','GET','path','/home/api/emission-projects','authority','COMPANY_MANAGER'),
      jsonb_build_object('method','GET','path','/home/api/emission-project-portfolio/preference','authority','COMPANY_MANAGER'),
      jsonb_build_object('method','PUT','path','/home/api/emission-project-portfolio/preference','authority','COMPANY_MANAGER')
    ),
    test_contract=jsonb_build_array(
      jsonb_build_object(
        'caseCode','TC_EMISSION_PORTFOLIO_PREFERENCE_HAPPY_PATH','status','APPROVED','caseType','HAPPY_PATH',
        'steps',jsonb_build_array('로그인','환경설정 조회','프로젝트와 필터 변경','환경설정 저장','재조회'),
        'assertions',jsonb_build_array('tenant isolated','account isolated','version incremented','selection restored')
      ),
      jsonb_build_object(
        'caseCode','TC_EMISSION_PORTFOLIO_PREFERENCE_STALE_VERSION','status','APPROVED','caseType','CONFLICT',
        'steps',jsonb_build_array('동일 버전 조회','첫 번째 수정','같은 구버전으로 두 번째 수정'),
        'assertions',jsonb_build_array('HTTP 409','no lost update','current version returned')
      )
    ),
    approval_status='APPROVED',
    generation_status='READY',
    blocker_codes='[]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST';

CREATE OR REPLACE VIEW framework_step_generation_readiness AS
SELECT e.process_code,p.process_name,p.domain_code,p.domain_code AS work_type_code,
  e.step_code,s.step_name,s.step_order,s.actor_code,e.spec_version,e.design_status,
  e.approval_status,e.generation_status,e.blocker_codes,e.source_hash,
  CASE WHEN jsonb_typeof(e.screen_contract)='array' THEN jsonb_array_length(e.screen_contract) ELSE 0 END AS page_count,
  (SELECT coalesce(sum(
     CASE WHEN jsonb_typeof(a.value->'fields')='array' THEN jsonb_array_length(a.value->'fields')
          WHEN jsonb_typeof(a.value)='object' AND a.value ? 'fieldCode' THEN 1 ELSE 0 END
   ),0)::integer
   FROM jsonb_array_elements(
     CASE WHEN jsonb_typeof(e.field_contract)='array' THEN e.field_contract ELSE '[]'::jsonb END
   ) a(value)) AS field_count,
  CASE WHEN jsonb_typeof(e.test_contract)='array' THEN jsonb_array_length(e.test_contract) ELSE 0 END AS test_count,
  count(*) FILTER(WHERE d.route_status='IMPLEMENTED')::integer AS implemented_page_count,
  count(*) FILTER(WHERE d.route_status='DESIGN_ONLY')::integer AS planned_page_count
FROM framework_step_execution_spec e
JOIN framework_process_definition p USING(process_code)
JOIN framework_process_step s USING(process_code,step_code)
LEFT JOIN framework_page_design d USING(process_code,step_code)
GROUP BY e.process_code,p.process_name,p.domain_code,e.step_code,s.step_name,s.step_order,s.actor_code,
  e.spec_version,e.design_status,e.approval_status,e.generation_status,e.blocker_codes,e.source_hash,
  e.screen_contract,e.field_contract,e.test_contract;

DO $$
DECLARE snapshot jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM framework_step_execution_spec
    WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
      AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
      AND (
        jsonb_typeof(screen_contract)<>'array'
        OR jsonb_typeof(command_contract)<>'array'
        OR jsonb_typeof(api_contract)<>'array'
        OR jsonb_typeof(test_contract)<>'array'
        OR approval_status<>'APPROVED'
      )
  ) THEN
    RAISE EXCEPTION 'portfolio generation contract normalization failed';
  END IF;
  snapshot:=framework_process_generation_snapshot('EMISSION_PROJECT_PORTFOLIO');
  IF jsonb_array_length(snapshot->'processes')<>1 THEN
    RAISE EXCEPTION 'portfolio generation snapshot failed';
  END IF;
END $$;
