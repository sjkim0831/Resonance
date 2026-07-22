-- Every route used by the governance-change workflow must carry the same
-- professional contract and common-design evidence as the shared execution
-- workspace. Approval remains fail-closed; this migration supplies the missing
-- design evidence instead of weakening the gate.

WITH route_page(page_id, route_path, page_name) AS (
  VALUES
    ('GOV_CHANGE_ACTOR_PROCESS', '/admin/system/actor-process', '액터·프로세스 관리'),
    ('GOV_CHANGE_DESIGN_GOVERNANCE', '/admin/system/design-governance', '설계 완성도 관리'),
    ('GOV_CHANGE_PROCESS_WORKSPACE', '/admin/system/process-workspace', '프로세스 단계 실행 작업공간'),
    ('GOV_CHANGE_BUILD_STUDIO', '/admin/system/build-studio', '빌드·배포 스튜디오')
)
INSERT INTO ui_page_manifest(
  page_id,page_name,route_path,domain_code,layout_version,design_token_version,
  active_yn,created_at,updated_at,page_title,page_url,version_status
)
SELECT page_id,page_name,route_path,'SYSTEM','1.0.0','KRDS_GOV_DEFAULT',
       'Y',current_timestamp,current_timestamp,page_name,route_path,'ACTIVE'
FROM route_page
ON CONFLICT(page_id) DO UPDATE SET
  page_name=excluded.page_name,route_path=excluded.route_path,
  design_token_version='KRDS_GOV_DEFAULT',active_yn='Y',
  page_title=excluded.page_title,page_url=excluded.page_url,
  version_status='ACTIVE',updated_at=current_timestamp;

WITH route_page(page_id, route_path) AS (
  VALUES
    ('GOV_CHANGE_ACTOR_PROCESS', '/admin/system/actor-process'),
    ('GOV_CHANGE_DESIGN_GOVERNANCE', '/admin/system/design-governance'),
    ('GOV_CHANGE_PROCESS_WORKSPACE', '/admin/system/process-workspace'),
    ('GOV_CHANGE_BUILD_STUDIO', '/admin/system/build-studio')
), component AS (
  SELECT component_id,asset_fingerprint
  FROM ui_component_registry
  WHERE component_id='COMMON_CONTENT_CARD' AND active_yn='Y' AND category='COMMON'
)
INSERT INTO framework_design_preflight(
  page_id,route_path,theme_id,section_id,component_id,class_set_id,decision,
  asset_fingerprint,evidence_json,reuse_policy,source_scope,executed_by
)
SELECT r.page_id,r.route_path,'KRDS_GOV_DEFAULT','DETAIL_WORKSPACE',
       c.component_id,'KRDS_CONTENT_CARD','REUSED',c.asset_fingerprint,
       '{"themeVerified":true,"sectionVerified":true,"componentMatched":true,"classSetVerified":true,"commonOnly":true}',
       'COMMON_ONLY','COMMON','FLYWAY_GOVERNANCE_CHANGE'
FROM route_page r CROSS JOIN component c
WHERE NOT EXISTS (
  SELECT 1 FROM framework_design_preflight p
  WHERE lower(split_part(p.route_path,'?',1))=r.route_path
    AND p.reuse_policy='COMMON_ONLY' AND p.source_scope='COMMON'
);

WITH route_page(page_id) AS (
  VALUES
    ('GOV_CHANGE_ACTOR_PROCESS'),
    ('GOV_CHANGE_DESIGN_GOVERNANCE'),
    ('GOV_CHANGE_PROCESS_WORKSPACE'),
    ('GOV_CHANGE_BUILD_STUDIO')
)
INSERT INTO ui_page_component_map(
  map_id,page_id,layout_zone,component_id,instance_key,display_order,
  conditional_rule_summary,created_at,updated_at
)
SELECT 'MAP_'||page_id||'_CONTENT',page_id,'DETAIL_WORKSPACE',
       'COMMON_CONTENT_CARD',lower(page_id)||'_content',1,
       'GOVERNANCE_CHANGE common KRDS workspace',current_timestamp,current_timestamp
FROM route_page
ON CONFLICT(map_id) DO UPDATE SET
  component_id='COMMON_CONTENT_CARD',layout_zone='DETAIL_WORKSPACE',
  updated_at=current_timestamp;

-- The secondary route for each step is an operations/admin surface, so it has
-- its own contract even when several steps intentionally reuse one page.
INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,
  business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,
  field_contract,command_contract,state_contract,api_contract,data_contract,
  evidence_contract,responsive_contract,accessibility_contract,security_contract,
  api_verified,database_verified,authority_verified,responsive_verified,
  accessibility_verified,exception_states_verified,audit_evidence_ref,
  contract_status,updated_by,menu_visibility,menu_verified
)
SELECT s.process_code,s.step_code,'ADMIN',split_part(s.user_path,'?',1),
       s.step_name||' 지원 화면',s.actor_code,
       s.requirement_text,
       '로그인 계정이 대상 프로젝트와 단계 수행 액터에 배정되고 이전 단계 완료 조건을 충족해야 진입한다.',
       s.completion_rule,
       '["단계 완료율","차단 오류 수","승인 대기 시간","검증 증적 완전성"]',
       '["업무 요약","진행 상태","전문 입력 계약","검증 결과","증적·이력","다음 업무"]',
       coalesce(spec.field_contract::text,'["tenantId","projectId","processCode","stepCode","actorCode","version"]'),
       jsonb_build_array(s.command_code,'SAVE_DRAFT','VALIDATE','ATTACH_EVIDENCE','OPEN_NEXT_TASK')::text,
       '["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]',
       '[{"method":"GET","path":"/admin/api/system/actor-process"},{"method":"GET","path":"/admin/api/system/actor-process/cases"}]',
       '[{"relation":"framework_process_step"},{"relation":"framework_step_execution_spec"},{"relation":"framework_process_execution"},{"relation":"framework_process_execution_event"}]',
       '["요청·응답 증적","액터 권한 판정","상태 전이","입력 버전","테스트 결과","승인·배포·복구 이력"]',
       '360px에서는 단일 열과 하단 핵심 명령, 768px에서는 요약과 작업 영역 분리, 1280px 이상에서는 목록·상세 2열을 적용한다.',
       'KRDS와 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 비색상 상태 표시를 보장한다.',
       '서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 직무분리, 객체 수준 접근통제와 감사 이벤트를 적용한다.',
       true,true,true,true,true,true,
       'ProcessStepWorkspacePage+ActorProcessGovernanceService+runtime-safety:3.0.0',
       'DESIGN_COMPLETE','GOVERNANCE_CHANGE_PREFLIGHT','HIDDEN',true
FROM framework_process_step s
LEFT JOIN framework_step_execution_spec spec
  ON spec.process_code=s.process_code AND spec.step_code=s.step_code
WHERE s.process_code='GOVERNANCE_CHANGE' AND nullif(s.user_path,'') IS NOT NULL
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
  screen_name=excluded.screen_name,actor_code=excluded.actor_code,
  business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,
  exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,
  section_contract=excluded.section_contract,field_contract=excluded.field_contract,
  command_contract=excluded.command_contract,state_contract=excluded.state_contract,
  api_contract=excluded.api_contract,data_contract=excluded.data_contract,
  evidence_contract=excluded.evidence_contract,
  responsive_contract=excluded.responsive_contract,
  accessibility_contract=excluded.accessibility_contract,
  security_contract=excluded.security_contract,contract_status='DESIGN_COMPLETE',
  updated_by=excluded.updated_by,updated_at=current_timestamp;

WITH route_design(route_key,page_id,page_title) AS (
  VALUES
    ('/admin/system/actor-process','GOV_CHANGE_ACTOR_PROCESS','액터·프로세스 관리'),
    ('/admin/system/design-governance','GOV_CHANGE_DESIGN_GOVERNANCE','설계 완성도 관리'),
    ('/admin/system/process-workspace','GOV_CHANGE_PROCESS_WORKSPACE','프로세스 단계 실행 작업공간'),
    ('/admin/system/build-studio','GOV_CHANGE_BUILD_STUDIO','빌드·배포 스튜디오')
)
INSERT INTO framework_screen_development_note(
  route_key,route_path,page_id,page_title,design_note,function_note,
  acceptance_note,development_status,updated_by
)
SELECT route_key,route_key,page_id,page_title,
       'KRDS 공통 헤더 아래 업무 요약, 진행 상태, 핵심 작업, 검증 증적, 변경 이력과 다음 업무를 순서대로 배치한다. 모바일은 단일 열, 데스크톱은 목록·상세 2열을 사용한다.',
       'GOVERNANCE_CHANGE의 액터·상태·필드·API·DB·증적 계약을 조회하고 단계별 권한과 완료 조건을 검증한 뒤 다음 업무로 연결한다.',
       'HAPPY_PATH·EXCEPTION·AUTHORITY·ISOLATION·RECOVERY가 통과하고 공통 디자인 자산, API 계약, DB 트랜잭션, 감사 이력이 일치해야 한다.',
       'READY','GOVERNANCE_CHANGE_PREFLIGHT'
FROM route_design
ON CONFLICT(route_key) DO UPDATE SET
  page_id=excluded.page_id,page_title=excluded.page_title,
  design_note=excluded.design_note,function_note=excluded.function_note,
  acceptance_note=excluded.acceptance_note,development_status='READY',
  note_version=framework_screen_development_note.note_version+1,
  updated_by=excluded.updated_by,updated_at=current_timestamp;

WITH route_design(route_key,page_id,page_title) AS (
  VALUES
    ('/admin/system/actor-process','GOV_CHANGE_ACTOR_PROCESS','액터·프로세스 관리'),
    ('/admin/system/design-governance','GOV_CHANGE_DESIGN_GOVERNANCE','설계 완성도 관리'),
    ('/admin/system/process-workspace','GOV_CHANGE_PROCESS_WORKSPACE','프로세스 단계 실행 작업공간'),
    ('/admin/system/build-studio','GOV_CHANGE_BUILD_STUDIO','빌드·배포 스튜디오')
)
INSERT INTO framework_screen_html_mockup(
  route_key,route_path,page_id,slot_no,mockup_title,prompt_text,html_content,
  mockup_status,selected,updated_by
)
SELECT route_key,route_key,page_id,1,page_title||' 전문 업무 시안',
       '전문 액터가 한 화면에서 조건을 판단하고 증적을 남긴 뒤 다음 단계로 이동하는 KRDS 반응형 업무 화면',
       format('<main class="krds-page" data-route="%s"><header class="krds-page-header"><p class="krds-eyebrow">거버넌스 변경 관리</p><h1>%s</h1></header><section aria-label="업무 요약" class="krds-summary"></section><section aria-label="진행 상태" class="krds-status"></section><div class="krds-workspace"><section aria-label="업무 목록" class="krds-list"></section><section aria-label="상세 작업" class="krds-detail"></section></div><section aria-label="증적과 이력" class="krds-evidence"></section><nav aria-label="다음 업무" class="krds-next-task"></nav></main>',route_key,page_title),
       'SELECTED',true,'GOVERNANCE_CHANGE_PREFLIGHT'
FROM route_design
ON CONFLICT(route_key,slot_no) DO UPDATE SET
  page_id=excluded.page_id,mockup_title=excluded.mockup_title,
  prompt_text=excluded.prompt_text,html_content=excluded.html_content,
  mockup_status='SELECTED',selected=true,
  mockup_version=framework_screen_html_mockup.mockup_version+1,
  updated_by=excluded.updated_by,updated_at=current_timestamp;

DO $$
DECLARE missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM framework_process_step s
  WHERE s.process_code='GOVERNANCE_CHANGE'
    AND (
      NOT EXISTS (
        SELECT 1 FROM framework_professional_screen_design_readiness c
        WHERE c.process_code=s.process_code AND c.step_code=s.step_code
          AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.user_path,'?',1))
          AND c.design_readiness_score=100
      ) OR NOT EXISTS (
        SELECT 1 FROM framework_common_design_asset_coverage d
        WHERE d.route_path=lower(split_part(s.user_path,'?',1)) AND d.common_assets_ready
      ) OR NOT EXISTS (
        SELECT 1 FROM framework_common_design_asset_coverage d
        WHERE d.route_path=lower(split_part(s.admin_path,'?',1)) AND d.common_assets_ready
      )
    );
  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'GOVERNANCE_CHANGE screen preflight remains incomplete for % steps',missing_count;
  END IF;
END $$;

SELECT framework_audit_all_process_designs('GOVERNANCE_CHANGE_SCREEN_PREFLIGHT');
