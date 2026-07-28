CREATE OR REPLACE FUNCTION refresh_integrated_design_documents(
  p_process_code varchar DEFAULT NULL,
  p_include_existing_draft boolean DEFAULT true
) RETURNS TABLE(inserted_count bigint, updated_count bigint, protected_count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted bigint := 0;
  v_updated bigint := 0;
  v_protected bigint := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS tmp_integrated_design_seed (
    process_code varchar(100),
    step_code varchar(100),
    route_path varchar(500),
    document_type varchar(50),
    title varchar(300),
    content text,
    status varchar(20)
  ) ON COMMIT DROP;
  TRUNCATE tmp_integrated_design_seed;

  WITH contexts AS (
    SELECT p.process_code, p.process_name, to_jsonb(p) AS process_contract,
           s.step_code, s.step_name, s.step_order, s.actor_code,
           to_jsonb(s) AS step_contract, r.route_path
      FROM framework_process_definition p
      JOIN framework_process_step s ON s.process_code=p.process_code
      CROSS JOIN LATERAL (
        SELECT DISTINCT route_path
          FROM (VALUES (coalesce(s.user_path,'')),(coalesce(s.admin_path,''))) x(route_path)
         WHERE route_path <> ''
      ) r
     WHERE p_process_code IS NULL OR p.process_code=p_process_code
  ), facts AS (
    SELECT c.*,
      coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.case_code)
                  FROM framework_simulation_case x
                 WHERE x.process_code=c.process_code),'[]'::jsonb) AS tests,
      coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.job_id)
                  FROM framework_development_job x
                 WHERE x.process_code=c.process_code
                   AND (x.step_code=c.step_code OR coalesce(x.step_code,'')='')),'[]'::jsonb) AS tasks,
      coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.menu_code)
                  FROM framework_process_menu_binding x
                 WHERE x.process_code=c.process_code
                   AND x.step_code=c.step_code),'[]'::jsonb) AS menus
      FROM contexts c
  ), documents(document_type,title,focus) AS (
    VALUES
      ('REQUIREMENT','업무·요구사항','requirement_text, goal, completion_rule'),
      ('ACTOR_RACI','액터·RACI','actor_code, owner_actor_code, segregation_actor_codes'),
      ('AUTHORITY','권한·데이터 범위','actor, audience, route and data scope'),
      ('PROCESS','프로세스·분기','step_order, state transition, command and decision rule'),
      ('STATE','상태 전이','from_state, command_code, to_state and rollback'),
      ('NAVIGATION','화면 흐름·라우팅','user_path, admin_path, menu bindings'),
      ('ACTIVE_UI','액티브 UI·레이아웃','route, required page flags and live screen context'),
      ('DESIGN_ASSET','테마·섹션·컴포넌트','shared design assets selected by the route contract'),
      ('FIELD_DICTIONARY','필드·데이터 사전','input_contract and output_contract fields'),
      ('DATA_HANDOFF','입출력·데이터 연계','upstream input and downstream output handoff'),
      ('DATABASE','DB·스키마','database requirement and persisted contract'),
      ('API','API·이벤트','api_contract, command and notification event'),
      ('BUSINESS_RULE','업무 규칙·계산식','completion_rule, decision_rule and SLA'),
      ('VALIDATION','검증·오류·예외','completion, evidence, rollback and validation cases'),
      ('NOTIFICATION','알림·기한·에스컬레이션','SLA, escalation actor and notification requirement'),
      ('TEST','테스트 시나리오·기대값','simulation cases and completion assertions'),
      ('TASK_EVIDENCE','개발 태스크·산출물·증적','development jobs and required evidence'),
      ('RELEASE_AUDIT','배포·감사·복구','automation status, evidence and rollback contract')
  )
  INSERT INTO tmp_integrated_design_seed
  SELECT f.process_code,f.step_code,f.route_path,d.document_type,d.title,
    concat(
      '# ',d.title,E'\n\n',
      '- 프로세스: ',f.process_name,' (`',f.process_code,'`)',E'\n',
      '- 단계: ',f.step_name,' (`',f.step_code,'`, 순서 ',f.step_order,')',E'\n',
      '- 담당 액터: `',f.actor_code,'`',E'\n',
      '- 적용 화면: `',f.route_path,'`',E'\n',
      '- 설계 초점: ',d.focus,E'\n',
      '- 생성 근거: LIVE_CONTRACT_SNAPSHOT',E'\n\n',
      '## 실행 가능한 계약 원본',E'\n\n```json\n',
      jsonb_pretty(jsonb_build_object(
        'process',f.process_contract,
        'step',f.step_contract,
        'routePath',f.route_path,
        'menuBindings',f.menus,
        'testScenarios',f.tests,
        'developmentTasks',f.tasks
      )),E'\n```\n'
    ),
    CASE
      WHEN jsonb_array_length(f.tests)>0 AND jsonb_array_length(f.menus)>0 THEN 'READY'
      ELSE 'IN_REVIEW'
    END
  FROM facts f CROSS JOIN documents d;

  SELECT count(*) INTO v_protected
    FROM integrated_design_document current
    JOIN tmp_integrated_design_seed seed USING(process_code,step_code,route_path,document_type)
   WHERE current.status IN ('APPROVED','VERIFIED');

  INSERT INTO integrated_design_document(
    process_code,step_code,route_path,document_type,title,content,status,updated_by)
  SELECT process_code,step_code,route_path,document_type,title,content,status,'LIVE_CONTRACT_BACKFILL'
    FROM tmp_integrated_design_seed seed
   WHERE NOT EXISTS (
     SELECT 1 FROM integrated_design_document current
      WHERE current.process_code=seed.process_code
        AND current.step_code=seed.step_code
        AND current.route_path=seed.route_path
        AND current.document_type=seed.document_type
   );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF p_include_existing_draft THEN
    UPDATE integrated_design_document current
       SET title=seed.title,content=seed.content,status=seed.status,
           updated_by='LIVE_CONTRACT_BACKFILL'
      FROM tmp_integrated_design_seed seed
     WHERE current.process_code=seed.process_code
       AND current.step_code=seed.step_code
       AND current.route_path=seed.route_path
       AND current.document_type=seed.document_type
       AND current.status IN ('DRAFT','IN_REVIEW')
       AND (current.content='' OR current.updated_by='LIVE_CONTRACT_BACKFILL')
       AND current.content IS DISTINCT FROM seed.content;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_inserted,v_updated,v_protected;
END $$;

COMMENT ON FUNCTION refresh_integrated_design_documents(varchar,boolean) IS
'현재 프로세스·단계·라우트·메뉴·테스트·태스크 계약에서 18종 통합 설계 문서를 증분 생성한다. APPROVED/VERIFIED 및 사용자가 작성한 초안은 보호한다.';

SELECT * FROM refresh_integrated_design_documents(NULL,true);
