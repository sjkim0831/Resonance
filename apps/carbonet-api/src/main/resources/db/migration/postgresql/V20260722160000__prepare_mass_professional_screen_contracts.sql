-- Complete every required user/admin screen contract without duplicating shared
-- pages. Existing reviewed contracts and implemented routes are preserved.

CREATE OR REPLACE FUNCTION framework_infer_professional_screen_type(
  requested_name text,
  requested_route text,
  requested_audience text
) RETURNS varchar
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN requested_audience='ADMIN' THEN 'ADMIN'
    WHEN lower(requested_name||' '||requested_route) ~ '로그인|인증|비밀번호|login|auth' THEN 'AUTH'
    WHEN lower(requested_name||' '||requested_route) ~ '보고서|인증서|report|certificate' THEN 'REPORT'
    WHEN lower(requested_name||' '||requested_route) ~ '업로드|수집|upload|import' THEN 'UPLOAD'
    WHEN lower(requested_name||' '||requested_route) ~ '검색|search' THEN 'SEARCH'
    WHEN lower(requested_name||' '||requested_route) ~ '승인|신청|검증|이의|workflow|approve' THEN 'WORKFLOW'
    WHEN lower(requested_name||' '||requested_route) ~ '통계|모니터|현황|dashboard|monitor' THEN 'DASHBOARD'
    WHEN lower(requested_name||' '||requested_route) ~ '등록|작성|설정|create|edit|form' THEN 'FORM'
    WHEN lower(requested_name||' '||requested_route) ~ '상세|확인|detail|view' THEN 'DETAIL'
    WHEN lower(requested_name||' '||requested_route) ~ '목록|내역|list' THEN 'LIST'
    WHEN lower(requested_name||' '||requested_route) ~ '메인|홈|home' THEN 'HOME'
    ELSE 'CONTENT'
  END::varchar;
$$;

-- Normalize the established simulation taxonomy into the five professional
-- safety lanes. This reuses verified evidence instead of fabricating duplicate
-- cases for locked, implemented process definitions.
CREATE OR REPLACE FUNCTION framework_canonical_professional_scenario_type(
  requested_type text
) RETURNS varchar
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE upper(coalesce(requested_type,''))
    WHEN 'TENANT_ISOLATION' THEN 'ISOLATION'
    WHEN 'PROJECT_ISOLATION' THEN 'ISOLATION'
    WHEN 'VALIDATION' THEN 'EXCEPTION'
    WHEN 'INVALID_STATE' THEN 'EXCEPTION'
    ELSE upper(coalesce(requested_type,''))
  END::varchar;
$$;

CREATE OR REPLACE FUNCTION framework_prepare_mass_professional_screens(
  requested_limit integer DEFAULT 1000,
  requested_by varchar DEFAULT 'SYSTEM_MASS_SCREEN_DESIGNER'
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  effective_limit integer := greatest(1,least(coalesce(requested_limit,1000),1000));
  paths_filled integer := 0;
  cases_created integer := 0;
  contracts_changed integer := 0;
  notes_changed integer := 0;
  mockups_created integer := 0;
  contract_bindings integer := 0;
  ready_contracts integer := 0;
  routable_screens integer := 0;
  batch_key bigint;
  batch_reused boolean := false;
  contract_hash text;
BEGIN
  UPDATE framework_process_step
     SET user_path='/generated/'||regexp_replace(lower(process_code),'[^a-z0-9]+','-','g')||'/'||regexp_replace(lower(step_code),'[^a-z0-9]+','-','g')
   WHERE requires_user_page AND nullif(trim(user_path),'') IS NULL;
  GET DIAGNOSTICS paths_filled = ROW_COUNT;

  WITH updated AS (
    UPDATE framework_process_step
       SET admin_path='/admin/generated/'||regexp_replace(lower(process_code),'[^a-z0-9]+','-','g')||'/'||regexp_replace(lower(step_code),'[^a-z0-9]+','-','g')
     WHERE requires_admin_page AND nullif(trim(admin_path),'') IS NULL
     RETURNING 1
  ) SELECT paths_filled+count(*)::integer INTO paths_filled FROM updated;

  -- Simulation contracts of implemented processes are protected by a database
  -- trigger. Missing safety scenarios remain explicit quality blockers and are
  -- never fabricated or unlocked by this preparation function.
  cases_created := 0;

  WITH required_screens AS (
    SELECT s.*,p.process_name,p.goal,p.start_condition,p.completion_condition,x.audience,x.route_path
    FROM framework_process_step s
    JOIN framework_process_definition p USING(process_code)
    CROSS JOIN LATERAL (VALUES
      ('USER'::varchar,CASE WHEN s.requires_user_page THEN nullif(trim(s.user_path),'') END),
      ('ADMIN'::varchar,CASE WHEN s.requires_admin_page THEN nullif(trim(s.admin_path),'') END)
    ) x(audience,route_path)
    WHERE x.route_path IS NOT NULL
  ), changed AS (
    INSERT INTO framework_professional_screen_contract(
      process_code,step_code,audience,route_path,screen_name,actor_code,
      business_purpose,entry_condition,exit_condition,kpi_contract,
      section_contract,field_contract,command_contract,state_contract,
      api_contract,data_contract,evidence_contract,responsive_contract,
      accessibility_contract,security_contract,contract_status,updated_by
    )
    SELECT process_code,step_code,audience,route_path,
      step_name||CASE audience WHEN 'ADMIN' THEN ' 관리자 업무 화면' ELSE ' 사용자 업무 화면' END,
      actor_code,
      process_name||' 프로세스의 '||step_name||' 단계에서 '||actor_code||' 액터가 '||command_code||' 명령을 안전하게 수행하여 다음 완료 기준을 달성한다: '||regexp_replace(coalesce(nullif(completion_rule,''),to_state||' 상태 전이'),'[[:space:].]+$',''),
      '다음 프로세스 시작 조건을 충족한다: '||regexp_replace(coalesce(nullif(start_condition,''),process_name||' 프로세스 시작 조건'),'[[:space:].]+$','')||'. 현재 상태는 '||from_state||'이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에만 진입한다.',
      '다음 완료 기준을 검증한다: '||regexp_replace(coalesce(nullif(completion_rule,''),step_name||' 완료 조건'),'[[:space:].]+$','')||'. 결과·버전·감사 증적을 저장한 뒤 '||to_state||' 상태로 원자적으로 전이한다.',
      jsonb_build_array(
        jsonb_build_object('code','COMPLETION_RATE','label',step_name||' 완료율','unit','PERCENT'),
        jsonb_build_object('code','SLA_REMAINING','label','처리 기한 잔여시간','unit','MINUTE'),
        jsonb_build_object('code','BLOCKING_ERROR','label','차단 오류 수','unit','COUNT'),
        jsonb_build_object('code','RECOVERY_RATE','label','오류 복구 성공률','unit','PERCENT')
      )::text,
      jsonb_build_array(
        jsonb_build_object('code','TASK_CONTEXT','label','업무 문맥·진행 상태'),
        jsonb_build_object('code','SEARCH_FILTER','label','검색·필터'),
        jsonb_build_object('code','WORKSPACE','label','핵심 데이터 작업공간'),
        jsonb_build_object('code','EVIDENCE_HISTORY','label','증적·변경 이력'),
        jsonb_build_object('code','NEXT_TASK','label','다음 업무')
      )::text,
      jsonb_build_array(
        jsonb_build_object('code','TENANT_ID','label','테넌트','required',true,'editable',false),
        jsonb_build_object('code','PROJECT_ID','label','프로젝트','required',true,'editable',false),
        jsonb_build_object('code','PROCESS_CODE','label','프로세스','required',true,'editable',false),
        jsonb_build_object('code','STEP_CODE','label','업무 단계','required',true,'editable',false),
        jsonb_build_object('code','ACTOR_CODE','label','담당 액터','required',true,'editable',false),
        jsonb_build_object('code','ROW_VERSION','label','버전','required',true,'editable',false),
        jsonb_build_object('code','INPUT_CONTRACT','label','입력 계약','required',true,'contract',framework_try_jsonb(input_contract)),
        jsonb_build_object('code','OUTPUT_CONTRACT','label','산출물 계약','required',true,'contract',framework_try_jsonb(output_contract))
      )::text,
      jsonb_build_array(
        jsonb_build_object('code',command_code,'label',step_name||' 실행','transactional',true,'idempotencyRequired',true),
        jsonb_build_object('code','SAVE_DRAFT','label','임시저장','transactional',true),
        jsonb_build_object('code','ATTACH_EVIDENCE','label','증적 연결','auditRequired',true),
        jsonb_build_object('code','MOVE_NEXT_TASK','label','다음 업무 이동','completionRequired',true)
      )::text,
      (SELECT jsonb_agg(value ORDER BY first_order) FROM (
        SELECT value,min(item_order) first_order
        FROM unnest(ARRAY[from_state,'LOADING','EMPTY','READY','SAVING','ERROR','FORBIDDEN','CONFLICT','RECOVERY',to_state]) WITH ORDINALITY item(value,item_order)
        WHERE value IS NOT NULL AND value<>'' GROUP BY value
      ) unique_states)::text,
      jsonb_build_array(
        jsonb_build_object('code','SCREEN_CONTRACT','method','GET','path','/home/api/process-executions/screen-contract','purpose','라우트별 실행 계약 조회'),
        jsonb_build_object('code','LOAD_EXECUTION','method','GET','path','/home/api/process-executions','purpose','프로세스 실행 문맥 조회'),
        jsonb_build_object('code',command_code,'method','POST','path','/home/api/process-executions/{executionId}/commands','purpose',step_name||' 상태 명령 실행'),
        jsonb_build_object('code','LOAD_DRAFT','method','GET','path','/home/api/process-executions/draft','purpose','업무 임시저장 조회'),
        jsonb_build_object('code','SAVE_DRAFT','method','PUT','path','/home/api/process-executions/draft','purpose','업무 임시저장')
      )::text,
      jsonb_build_array(
        jsonb_build_object('entity','PROCESS_EXECUTION','keys',jsonb_build_array('tenantId','projectId','processCode'),'versioned',true,'tenantScoped',true),
        jsonb_build_object('entity','PROCESS_STEP','keys',jsonb_build_array('processCode','stepCode'),'stateTransition',jsonb_build_object('from',from_state,'to',to_state)),
        jsonb_build_object('entity','WORK_DRAFT','keys',jsonb_build_array('tenantId','projectId','processCode','stepCode','actorCode'),'versioned',true),
        jsonb_build_object('entity','AUDIT_EVENT','appendOnly',true,'beforeAfterRequired',true)
      )::text,
      jsonb_build_array(
        jsonb_build_object('scenarioType','HAPPY_PATH','required',true,'evidence',jsonb_build_array('request','response','stateTransition')),
        jsonb_build_object('scenarioType','AUTHORITY','required',true,'evidence',jsonb_build_array('actorDecision','forbiddenResponse')),
        jsonb_build_object('scenarioType','ISOLATION','required',true,'evidence',jsonb_build_array('tenantBoundary','projectBoundary')),
        jsonb_build_object('scenarioType','EXCEPTION','required',true,'evidence',jsonb_build_array('validationError','rollbackState')),
        jsonb_build_object('scenarioType','RECOVERY','required',true,'evidence',jsonb_build_array('retry','idempotency','auditEvent'))
      )::text,
      '360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약·작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하고 표는 열 우선순위와 가로 스크롤을 적용한다.',
      'KRDS와 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약·필드 연결, 비색상 상태 표현과 표 머리글 연결을 보장한다.',
      '서버가 tenantId·projectId·actorCode·commandCode·rowVersion을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금, 멱등성과 감사 이벤트를 적용한다.',
      'DESIGN_COMPLETE',requested_by
    FROM required_screens
    ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
      screen_name=excluded.screen_name,actor_code=excluded.actor_code,
      business_purpose=CASE WHEN length(trim(framework_professional_screen_contract.business_purpose))>=20 AND framework_professional_screen_contract.business_purpose NOT LIKE '%명령을 안전하게 수행하고 %를 완료한다.' THEN framework_professional_screen_contract.business_purpose ELSE excluded.business_purpose END,
      entry_condition=CASE WHEN length(trim(framework_professional_screen_contract.entry_condition))>=10 AND framework_professional_screen_contract.entry_condition NOT LIKE '%이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우 진입한다.' AND framework_professional_screen_contract.entry_condition NOT LIKE '%.. 현재 상태는%' THEN framework_professional_screen_contract.entry_condition ELSE excluded.entry_condition END,
      exit_condition=CASE WHEN length(trim(framework_professional_screen_contract.exit_condition))>=20 AND framework_professional_screen_contract.exit_condition NOT LIKE '%을 검증하고 결과·버전·감사 증적을 저장한 뒤%' AND framework_professional_screen_contract.exit_condition NOT LIKE '%.. 결과·버전%' THEN framework_professional_screen_contract.exit_condition ELSE excluded.exit_condition END,
      kpi_contract=CASE WHEN jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.kpi_contract))='array' AND framework_try_jsonb(framework_professional_screen_contract.kpi_contract)<>'[]'::jsonb THEN framework_professional_screen_contract.kpi_contract ELSE excluded.kpi_contract END,
      section_contract=CASE WHEN jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.section_contract))='array' AND framework_try_jsonb(framework_professional_screen_contract.section_contract)<>'[]'::jsonb THEN framework_professional_screen_contract.section_contract ELSE excluded.section_contract END,
      field_contract=CASE WHEN jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.field_contract))='array' AND framework_try_jsonb(framework_professional_screen_contract.field_contract)<>'[]'::jsonb THEN framework_professional_screen_contract.field_contract ELSE excluded.field_contract END,
      command_contract=CASE WHEN jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.command_contract))='array' AND framework_try_jsonb(framework_professional_screen_contract.command_contract)<>'[]'::jsonb THEN framework_professional_screen_contract.command_contract ELSE excluded.command_contract END,
      state_contract=CASE WHEN framework_professional_screen_contract.state_contract LIKE '%LOADING%' AND framework_professional_screen_contract.state_contract LIKE '%EMPTY%' AND framework_professional_screen_contract.state_contract LIKE '%ERROR%' AND framework_professional_screen_contract.state_contract LIKE '%FORBIDDEN%' AND jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.state_contract))='array' AND jsonb_array_length(framework_try_jsonb(framework_professional_screen_contract.state_contract))=(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(framework_try_jsonb(framework_professional_screen_contract.state_contract)) state(value)) THEN framework_professional_screen_contract.state_contract ELSE excluded.state_contract END,
      api_contract=CASE WHEN jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.api_contract))='array' AND framework_try_jsonb(framework_professional_screen_contract.api_contract)<>'[]'::jsonb THEN framework_professional_screen_contract.api_contract ELSE excluded.api_contract END,
      data_contract=CASE WHEN jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.data_contract))='array' AND framework_try_jsonb(framework_professional_screen_contract.data_contract)<>'[]'::jsonb THEN framework_professional_screen_contract.data_contract ELSE excluded.data_contract END,
      evidence_contract=CASE WHEN jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.evidence_contract))='array' AND framework_try_jsonb(framework_professional_screen_contract.evidence_contract)<>'[]'::jsonb THEN framework_professional_screen_contract.evidence_contract ELSE excluded.evidence_contract END,
      responsive_contract=CASE WHEN length(trim(framework_professional_screen_contract.responsive_contract))>=20 THEN framework_professional_screen_contract.responsive_contract ELSE excluded.responsive_contract END,
      accessibility_contract=CASE WHEN length(trim(framework_professional_screen_contract.accessibility_contract))>=20 THEN framework_professional_screen_contract.accessibility_contract ELSE excluded.accessibility_contract END,
      security_contract=CASE WHEN length(trim(framework_professional_screen_contract.security_contract))>=20 THEN framework_professional_screen_contract.security_contract ELSE excluded.security_contract END,
      contract_status=CASE WHEN framework_professional_screen_contract.contract_status='VERIFIED' THEN 'VERIFIED' ELSE 'DESIGN_COMPLETE' END,
      updated_by=excluded.updated_by,updated_at=current_timestamp
    WHERE length(trim(framework_professional_screen_contract.business_purpose))<20
       OR length(trim(framework_professional_screen_contract.entry_condition))<10
       OR length(trim(framework_professional_screen_contract.exit_condition))<20
       OR jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.kpi_contract)) IS DISTINCT FROM 'array'
       OR framework_try_jsonb(framework_professional_screen_contract.kpi_contract)='[]'::jsonb
       OR jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.section_contract)) IS DISTINCT FROM 'array'
       OR framework_try_jsonb(framework_professional_screen_contract.section_contract)='[]'::jsonb
       OR jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.field_contract)) IS DISTINCT FROM 'array'
       OR framework_try_jsonb(framework_professional_screen_contract.field_contract)='[]'::jsonb
       OR jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.command_contract)) IS DISTINCT FROM 'array'
       OR framework_try_jsonb(framework_professional_screen_contract.command_contract)='[]'::jsonb
       OR framework_professional_screen_contract.state_contract NOT LIKE '%LOADING%'
       OR framework_professional_screen_contract.state_contract NOT LIKE '%EMPTY%'
       OR framework_professional_screen_contract.state_contract NOT LIKE '%ERROR%'
       OR framework_professional_screen_contract.state_contract NOT LIKE '%FORBIDDEN%'
       OR jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.api_contract)) IS DISTINCT FROM 'array'
       OR framework_try_jsonb(framework_professional_screen_contract.api_contract)='[]'::jsonb
       OR jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.data_contract)) IS DISTINCT FROM 'array'
       OR framework_try_jsonb(framework_professional_screen_contract.data_contract)='[]'::jsonb
       OR jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.evidence_contract)) IS DISTINCT FROM 'array'
       OR framework_try_jsonb(framework_professional_screen_contract.evidence_contract)='[]'::jsonb
       OR length(trim(framework_professional_screen_contract.responsive_contract))<20
       OR length(trim(framework_professional_screen_contract.accessibility_contract))<20
       OR length(trim(framework_professional_screen_contract.security_contract))<20
       OR framework_professional_screen_contract.business_purpose LIKE '%명령을 안전하게 수행하고 %를 완료한다.'
       OR framework_professional_screen_contract.entry_condition LIKE '%이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우 진입한다.'
       OR framework_professional_screen_contract.entry_condition LIKE '%.. 현재 상태는%'
       OR framework_professional_screen_contract.exit_condition LIKE '%을 검증하고 결과·버전·감사 증적을 저장한 뒤%'
       OR framework_professional_screen_contract.exit_condition LIKE '%.. 결과·버전%'
       OR (jsonb_typeof(framework_try_jsonb(framework_professional_screen_contract.state_contract))='array' AND jsonb_array_length(framework_try_jsonb(framework_professional_screen_contract.state_contract))>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(framework_try_jsonb(framework_professional_screen_contract.state_contract)) state(value)))
    RETURNING 1
  ) SELECT count(*)::integer INTO contracts_changed FROM changed;

  -- Repair only missing shared-workspace API metadata and the three legacy
  -- state contracts that predate the professional LOADING/EMPTY/ERROR/
  -- FORBIDDEN readiness rule. Reviewed business semantics remain untouched.
  WITH repaired AS (
    UPDATE framework_professional_screen_contract c SET
      api_contract=CASE
        WHEN c.api_contract='[]'
          AND lower(split_part(c.route_path,'?',1))='/admin/system/process-workspace'
        THEN jsonb_build_array(
          jsonb_build_object('method','GET','path','/admin/api/system/actor-process','scope','actor and process governance'),
          jsonb_build_object('method','GET','path','/home/api/process-executions','scope','tenant, project and actor'),
          jsonb_build_object('method','POST','path','/home/api/process-executions/start','guard','first step actor'),
          jsonb_build_object('method','POST','path','/home/api/process-executions/{executionId}/commands','idempotency','required')
        )::text
        ELSE c.api_contract
      END,
      state_contract=CASE
        WHEN c.contract_id=251
          AND NOT (c.state_contract LIKE '%LOADING%' AND c.state_contract LIKE '%EMPTY%'
            AND c.state_contract LIKE '%ERROR%' AND c.state_contract LIKE '%FORBIDDEN%')
        THEN jsonb_build_array('LOADING','READY','EMPTY','SIMULATED','SAVED','SUBMITTED','ERROR','FORBIDDEN')::text
        WHEN c.contract_id IN (742,744) AND c.state_contract NOT LIKE '%"EMPTY"%'
        THEN (framework_try_jsonb(c.state_contract)||jsonb_build_array('EMPTY'))::text
        ELSE c.state_contract
      END,
      updated_by=requested_by,updated_at=current_timestamp
    WHERE (c.api_contract='[]' AND lower(split_part(c.route_path,'?',1))='/admin/system/process-workspace')
       OR (c.contract_id=251 AND NOT (c.state_contract LIKE '%LOADING%' AND c.state_contract LIKE '%EMPTY%'
         AND c.state_contract LIKE '%ERROR%' AND c.state_contract LIKE '%FORBIDDEN%'))
       OR (c.contract_id IN (742,744) AND c.state_contract NOT LIKE '%"EMPTY"%')
    RETURNING 1
  ) SELECT contracts_changed+count(*)::integer INTO contracts_changed FROM repaired;

  SELECT count(*)::integer,count(*) FILTER(WHERE design_readiness_score=100)::integer
    INTO contract_bindings,ready_contracts
    FROM framework_professional_screen_design_readiness;

  WITH source AS (
    SELECT DISTINCT ON(lower(split_part(route_path,'?',1)))
      lower(split_part(route_path,'?',1)) route_key,split_part(route_path,'?',1) route_path,
      'PG_'||upper(substr(md5(lower(split_part(route_path,'?',1))),1,16)) page_id,
      screen_name,business_purpose,command_contract,api_contract,data_contract,exit_condition
    FROM framework_professional_screen_design_readiness
    WHERE design_readiness_score=100
    ORDER BY lower(split_part(route_path,'?',1)),CASE audience WHEN 'USER' THEN 0 ELSE 1 END,contract_id
  ), upserted AS (
    INSERT INTO framework_screen_development_note(
      route_key,route_path,page_id,page_title,design_note,function_note,
      acceptance_note,development_status,updated_by
    )
    SELECT route_key,route_path,page_id,screen_name,
      'KRDS 공통 헤더 아래 업무 문맥, KPI, 검색·필터, 핵심 작업공간, 증적·이력과 다음 업무를 배치한다. 모바일은 단일 열, 데스크톱은 목록·상세 2열을 적용한다.',
      business_purpose||' 명령='||command_contract||' API='||api_contract||' 데이터='||data_contract,
      exit_condition||' 및 정상·권한·격리·예외·복구 시나리오를 통과하고 상태·버전·감사 증적이 일치해야 한다.',
      'READY',requested_by
    FROM source
    ON CONFLICT(route_key) DO UPDATE SET
      page_id=coalesce(framework_screen_development_note.page_id,excluded.page_id),
      page_title=coalesce(nullif(framework_screen_development_note.page_title,''),excluded.page_title),
      design_note=coalesce(nullif(framework_screen_development_note.design_note,''),excluded.design_note),
      function_note=CASE WHEN framework_screen_development_note.updated_by=requested_by THEN excluded.function_note ELSE coalesce(nullif(framework_screen_development_note.function_note,''),excluded.function_note) END,
      acceptance_note=CASE WHEN framework_screen_development_note.updated_by=requested_by THEN excluded.acceptance_note ELSE coalesce(nullif(framework_screen_development_note.acceptance_note,''),excluded.acceptance_note) END,
      development_status=CASE WHEN framework_screen_development_note.development_status='DRAFT' THEN 'READY' ELSE framework_screen_development_note.development_status END,
      updated_by=excluded.updated_by,updated_at=current_timestamp
    WHERE framework_screen_development_note.page_id IS NULL
       OR nullif(framework_screen_development_note.page_title,'') IS NULL
       OR nullif(framework_screen_development_note.design_note,'') IS NULL
       OR nullif(framework_screen_development_note.function_note,'') IS NULL
       OR nullif(framework_screen_development_note.acceptance_note,'') IS NULL
       OR framework_screen_development_note.development_status='DRAFT'
       OR (framework_screen_development_note.updated_by=requested_by AND (
         framework_screen_development_note.function_note IS DISTINCT FROM excluded.function_note
         OR framework_screen_development_note.acceptance_note IS DISTINCT FROM excluded.acceptance_note
       ))
    RETURNING 1
  ) SELECT count(*)::integer INTO notes_changed FROM upserted;

  WITH inserted AS (
    INSERT INTO framework_screen_html_mockup(
      route_key,route_path,page_id,slot_no,mockup_title,prompt_text,
      html_content,mockup_status,selected,updated_by
    )
    SELECT route_key,route_path,page_id,1,page_title||' 메타데이터 업무 시안',
      '액터가 진입 조건, 핵심 데이터, 명령, 예외·복구 상태, 증적과 다음 업무를 한 화면에서 판단하는 KRDS 반응형 시안',
      '<main class="krds-page" data-route="'||route_key||'"><header class="krds-page-header"><p class="krds-eyebrow" data-bind="processName"></p><h1 data-bind="screenName"></h1></header><section class="krds-summary" aria-label="업무 요약" data-bind="kpis"></section><section class="krds-filter" aria-label="검색과 필터"></section><div class="krds-workspace"><section class="krds-list" aria-label="업무 목록"></section><section class="krds-detail" aria-label="상세 작업" data-bind="fields"></section></div><section class="krds-evidence" aria-label="증적과 이력"></section><nav class="krds-next-task" aria-label="다음 업무"></nav></main>',
      'SELECTED',true,requested_by
    FROM framework_screen_development_note
    ON CONFLICT(route_key,slot_no) DO NOTHING
    RETURNING 1
  ) SELECT count(*)::integer INTO mockups_created FROM inserted;

  WITH candidates AS (
    SELECT DISTINCT ON(lower(split_part(c.route_path,'?',1)))
      c.*,lower(split_part(c.route_path,'?',1)) route_key,p.development_order,s.step_order,
      framework_infer_professional_screen_type(c.screen_name,c.route_path,c.audience) inferred_type
    FROM framework_professional_screen_design_readiness c
    JOIN framework_process_definition p USING(process_code)
    JOIN framework_process_step s USING(process_code,step_code)
    WHERE c.design_readiness_score=100
      AND (SELECT count(DISTINCT framework_canonical_professional_scenario_type(case_type)) FROM framework_simulation_case test
            WHERE test.process_code=c.process_code
              AND framework_canonical_professional_scenario_type(test.case_type) IN ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'))=5
    ORDER BY lower(split_part(c.route_path,'?',1)),
      CASE WHEN lower(split_part(c.route_path,'?',1)) LIKE '/admin/%' AND c.audience='ADMIN' THEN 0
           WHEN lower(split_part(c.route_path,'?',1)) NOT LIKE '/admin/%' AND c.audience='USER' THEN 0 ELSE 1 END,
      p.development_order,s.step_order,c.contract_id
  ), selected AS (
    SELECT * FROM candidates ORDER BY development_order,process_code,step_order,audience,route_key LIMIT effective_limit
  )
  SELECT count(*)::integer,
    md5(string_agg(
      audience||'|'||route_key||'|'||process_code||'|'||step_code||'|'||
      md5(business_purpose||entry_condition||exit_condition||kpi_contract||section_contract||field_contract||command_contract||state_contract||api_contract||data_contract||evidence_contract),
      E'\n' ORDER BY development_order,process_code,step_order,audience,route_key
    )) INTO routable_screens,contract_hash FROM selected;

  SELECT batch_id INTO batch_key
  FROM framework_screen_generation_batch
  WHERE framework_try_jsonb(summary_json)->>'contractHash'=contract_hash
    AND framework_try_jsonb(summary_json)->>'generator'='MASS_PROFESSIONAL_SCREEN_DESIGNER'
  ORDER BY batch_id DESC LIMIT 1;

  IF batch_key IS NULL THEN
    INSERT INTO framework_screen_generation_batch(
      batch_code,batch_name,requested_count,dry_run,requested_by
    ) VALUES(
      'MASS_PRO_'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'),
      '전문가 화면 계약 대량 컴파일',effective_limit,false,requested_by
    ) RETURNING batch_id INTO batch_key;

    WITH candidates AS (
      SELECT DISTINCT ON(lower(split_part(c.route_path,'?',1)))
        c.*,lower(split_part(c.route_path,'?',1)) route_key,p.development_order,s.step_order,
        framework_infer_professional_screen_type(c.screen_name,c.route_path,c.audience) inferred_type
      FROM framework_professional_screen_design_readiness c
      JOIN framework_process_definition p USING(process_code)
      JOIN framework_process_step s USING(process_code,step_code)
      WHERE c.design_readiness_score=100
        AND (SELECT count(DISTINCT framework_canonical_professional_scenario_type(case_type)) FROM framework_simulation_case test
              WHERE test.process_code=c.process_code
                AND framework_canonical_professional_scenario_type(test.case_type) IN ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'))=5
      ORDER BY lower(split_part(c.route_path,'?',1)),
        CASE WHEN lower(split_part(c.route_path,'?',1)) LIKE '/admin/%' AND c.audience='ADMIN' THEN 0
             WHEN lower(split_part(c.route_path,'?',1)) NOT LIKE '/admin/%' AND c.audience='USER' THEN 0 ELSE 1 END,
        p.development_order,s.step_order,c.contract_id
    ), selected AS (
      SELECT * FROM candidates ORDER BY development_order,process_code,step_order,audience,route_key LIMIT effective_limit
    )
    INSERT INTO framework_screen_blueprint(
      blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
      route_path,screen_type,template_code,specification_json,traceability_json,
      validation_status,validation_message,created_by,implementation_strategy,
      source_reference,transition_status
    )
    SELECT 'BP_AUTO_'||upper(substr(md5(audience||':'||route_key),1,24)),
      process_code,step_code,actor_code,audience,
      'AUTO_'||upper(substr(md5(audience||':'||route_key),1,20)),screen_name,route_key,
      inferred_type,'KRDS_'||inferred_type,
      jsonb_build_object(
        'schemaVersion','2.0.0','designSystem','KRDS_GOV','businessPurpose',business_purpose,
        'actorResponsibilities',jsonb_build_array(actor_code||' 액터가 권한·업무분리 정책에 따라 '||screen_name||' 업무를 수행한다.'),
        'entryConditions',jsonb_build_array(entry_condition),'exitConditions',jsonb_build_array(exit_condition),
        'states',framework_try_jsonb(state_contract),'kpis',framework_try_jsonb(kpi_contract),
        'sections',framework_try_jsonb(section_contract),'fields',framework_try_jsonb(field_contract),
        'actions',framework_try_jsonb(command_contract),'apiContracts',framework_try_jsonb(api_contract),
        'dataContracts',framework_try_jsonb(data_contract),
        'permissions',jsonb_build_array(jsonb_build_object('code',actor_code,'scope','TENANT_PROJECT','serverAuthorization',true,'segregationOfDuties',true)),
        'validations',jsonb_build_array(jsonb_build_object('code','ENTRY_AND_REQUIRED_FIELDS','type','CONTRACT'),jsonb_build_object('code','STATE_AND_VERSION','type','CONCURRENCY')),
        'errors',jsonb_build_array(jsonb_build_object('code','FORBIDDEN','recovery','권한·업무분리 확인'),jsonb_build_object('code','CONFLICT','recovery','최신 버전 재조회'),jsonb_build_object('code','DEPENDENCY_FAILURE','recovery','멱등키로 안전 재시도')),
        'responsive',jsonb_build_object('mobile','single-column-actions-bottom','tablet','adaptive-grid','desktop','list-detail-workspace'),
        'accessibility',jsonb_build_object('standard','WCAG_2_1_AA','keyboard',true,'labels',true,'focusManagement',true,'nonColorStatus',true),
        'completionRule',exit_condition,'extensions',jsonb_build_object('contractId',contract_id,'sharedRuntime',true)
      )::text,
      jsonb_build_object(
        'requirementIds',jsonb_build_array(process_code||':'||step_code||':'||audience),
        'requiredScenarioTypes',jsonb_build_array('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'),
        'contractId',contract_id,'designReadinessScore',100,'generationBatchId',batch_key
      )::text,
      'VALID','',requested_by,
      CASE WHEN route_key LIKE '/generated/%' OR route_key LIKE '/admin/generated/%' THEN 'GENERATED_RUNTIME' ELSE 'ADOPT_EXISTING' END,
      'framework_professional_screen_contract:'||contract_id,
      CASE WHEN route_key LIKE '/generated/%' OR route_key LIKE '/admin/generated/%' THEN 'RUNTIME_ACTIVE' ELSE 'CONTRACT_LINKED' END
    FROM selected
    ON CONFLICT(audience,route_path) DO UPDATE SET
      process_code=excluded.process_code,step_code=excluded.step_code,actor_code=excluded.actor_code,
      page_id=excluded.page_id,page_name=excluded.page_name,screen_type=excluded.screen_type,
      template_code=excluded.template_code,specification_json=excluded.specification_json,
      traceability_json=excluded.traceability_json,validation_status='VALID',validation_message='',
      implementation_strategy=CASE WHEN framework_screen_blueprint.implementation_strategy='ADOPT_EXISTING' THEN 'ADOPT_EXISTING' ELSE excluded.implementation_strategy END,
      source_reference=excluded.source_reference,
      transition_status=CASE WHEN framework_screen_blueprint.implementation_strategy='ADOPT_EXISTING' THEN 'CONTRACT_LINKED' ELSE excluded.transition_status END,
      updated_at=current_timestamp;

    WITH candidates AS (
      SELECT DISTINCT ON(lower(split_part(c.route_path,'?',1)))
        c.audience,lower(split_part(c.route_path,'?',1)) route_key,p.development_order,s.step_order,c.process_code
      FROM framework_professional_screen_design_readiness c
      JOIN framework_process_definition p USING(process_code)
      JOIN framework_process_step s USING(process_code,step_code)
      WHERE c.design_readiness_score=100
        AND (SELECT count(DISTINCT framework_canonical_professional_scenario_type(case_type)) FROM framework_simulation_case test
              WHERE test.process_code=c.process_code
                AND framework_canonical_professional_scenario_type(test.case_type) IN ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'))=5
      ORDER BY lower(split_part(c.route_path,'?',1)),
        CASE WHEN lower(split_part(c.route_path,'?',1)) LIKE '/admin/%' AND c.audience='ADMIN' THEN 0
             WHEN lower(split_part(c.route_path,'?',1)) NOT LIKE '/admin/%' AND c.audience='USER' THEN 0 ELSE 1 END,
        p.development_order,s.step_order,c.contract_id
    ), selected AS (
      SELECT *,row_number() OVER(ORDER BY development_order,process_code,step_order,audience,route_key)::integer item_order
      FROM candidates ORDER BY development_order,process_code,step_order,audience,route_key LIMIT effective_limit
    )
    INSERT INTO framework_screen_generation_batch_item(
      batch_id,blueprint_id,item_order,item_status,validation_message
    )
    SELECT batch_key,b.blueprint_id,s.item_order,'COMPILED',''
    FROM selected s JOIN framework_screen_blueprint b
      ON b.audience=s.audience AND b.route_path=s.route_key
    ON CONFLICT(batch_id,blueprint_id) DO NOTHING;

    UPDATE framework_screen_generation_batch SET
      compiled_count=routable_screens,valid_count=routable_screens,invalid_count=0,
      batch_status='COMPILED',
      summary_json=jsonb_build_object(
        'generator','MASS_PROFESSIONAL_SCREEN_DESIGNER','schemaVersion','3.0.0',
        'contractBindings',contract_bindings,'readyContracts',ready_contracts,
        'routableScreens',routable_screens,'sharedScreenBindings',contract_bindings-routable_screens,
        'pathsFilled',paths_filled,'casesCreated',cases_created,'contractHash',contract_hash,
        'sourceFilesPerScreen',0,'runtime','COMMON_GENERATED_SCREEN'
      )::text,
      completed_at=current_timestamp
    WHERE batch_id=batch_key;
  ELSE
    batch_reused=true;
  END IF;

  RETURN jsonb_build_object(
    'success',true,'schemaVersion','3.0.0','pathsFilled',paths_filled,
    'casesCreated',cases_created,'contractsChanged',contracts_changed,
    'contractBindings',contract_bindings,'readyContracts',ready_contracts,
    'routableScreens',routable_screens,'sharedScreenBindings',contract_bindings-routable_screens,
    'notesChanged',notes_changed,'mockupsCreated',mockups_created,
    'batchId',batch_key,'batchReused',batch_reused,'contractHash',contract_hash,
    'runtime','COMMON_GENERATED_SCREEN','sourceFilesPerScreen',0
  );
END $$;

SELECT framework_prepare_mass_professional_screens(1000,'SYSTEM_MASS_SCREEN_DESIGNER');
