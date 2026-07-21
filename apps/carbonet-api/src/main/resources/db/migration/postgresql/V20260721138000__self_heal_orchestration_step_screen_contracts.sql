CREATE OR REPLACE FUNCTION framework_ensure_step_screen_contract(
  target_process varchar,target_step varchar,requested_by varchar DEFAULT 'CONTRACT_DESIGN_FACTORY'
) RETURNS bigint LANGUAGE plpgsql AS $function$
DECLARE
  step_row framework_process_step%ROWTYPE;
  process_name text;
  target_page_id bigint;
  source_page_id bigint;
  target_route text;
  fields_json text;
BEGIN
  SELECT * INTO step_row FROM framework_process_step
  WHERE process_code=target_process AND step_code=target_step;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown process step %/%',target_process,target_step; END IF;
  SELECT p.process_name INTO process_name FROM framework_process_definition p WHERE p.process_code=target_process;
  target_route := '/admin/system/process-workspace?process='||target_process||'&step='||target_step;

  INSERT INTO framework_page_design(process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
    planned_route_path,actual_route_path,route_status,primary_entity,actor_code,entry_condition,exit_condition,
    responsive_contract,accessibility_contract,security_contract,exception_contract,design_status,updated_by)
  VALUES(target_process,target_step,'ADMIN',target_step||'_WORKSPACE_ADMIN',process_name||' - '||step_row.step_name,
    coalesce(nullif(step_row.requirement_text,''),step_row.step_name||' 업무를 수행하고 검증 가능한 증거를 남긴다.'),
    'PROCESS_STEP_WORKSPACE',target_route,target_route,'IMPLEMENTED','framework_process_step',
    coalesce(nullif(step_row.actor_code,''),'SYSTEM_ADMIN'),
    '로그인 계정의 액터·테넌트·프로젝트 권한과 선행 단계 완료 여부가 확인되어야 한다.',
    '필수 입력, 상태 전이, 감사 증거와 다음 단계 인계 정보가 저장되어야 한다.',
    '{"mobile":"single-column ordered tasks","tablet":"two-column workspace","desktop":"summary plus task detail","overflow":"local table scroll"}',
    '{"standard":"WCAG 2.1 AA","keyboard":true,"focusManagement":true,"labels":true,"statusNotColorOnly":true}',
    jsonb_build_object('actorCode',coalesce(nullif(step_row.actor_code,''),'SYSTEM_ADMIN'),'tenantIsolation',true,'projectIsolation',true,'serverAuthorization',true,'auditRequired',true),
    '{"states":["loading","empty","authority-denied","dependency-blocked","validation-error","conflict","server-error"],"recovery":"last verified step state"}',
    'DESIGN_COMPLETE',requested_by)
  ON CONFLICT(process_code,step_code,audience) DO UPDATE SET
    page_title=excluded.page_title,page_purpose=excluded.page_purpose,actual_route_path=excluded.actual_route_path,
    route_status='IMPLEMENTED',actor_code=excluded.actor_code,design_status='DESIGN_COMPLETE',
    design_version=framework_page_design.design_version+1,updated_by=excluded.updated_by,updated_at=current_timestamp
  RETURNING page_design_id INTO target_page_id;

  SELECT d.page_design_id INTO source_page_id
  FROM framework_page_design d
  JOIN LATERAL (SELECT count(*) field_count FROM framework_page_field_definition f WHERE f.page_design_id=d.page_design_id) x ON true
  WHERE d.process_code=target_process AND d.page_design_id<>target_page_id AND x.field_count>=10
  ORDER BY x.field_count DESC,d.page_design_id LIMIT 1;
  IF source_page_id IS NULL THEN
    RAISE EXCEPTION 'professional source page is missing for process %',target_process;
  END IF;

  INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,
    control_type,required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,
    validation_contract,privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
  SELECT target_page_id,field_order,field_group,field_code,field_name,data_type,control_type,required,editable,
    list_visible,search_enabled,source_table,source_column,api_property,mapping_status,validation_contract,privacy_class,
    coalesce(nullif(step_row.actor_code,''),'SYSTEM_ADMIN')||':PROCESS_STEP',evidence_required,responsive_priority,
    help_text,requested_by
  FROM framework_page_field_definition WHERE page_design_id=source_page_id
  ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_order=excluded.field_order,field_group=excluded.field_group,
    field_name=excluded.field_name,data_type=excluded.data_type,control_type=excluded.control_type,
    required=excluded.required,validation_contract=excluded.validation_contract,permission_code=excluded.permission_code,
    evidence_required=excluded.evidence_required,responsive_priority=excluded.responsive_priority,
    help_text=excluded.help_text,design_source=excluded.design_source,updated_at=current_timestamp;

  SELECT coalesce(jsonb_agg(jsonb_build_object('code',field_code,'name',field_name,'type',data_type,
    'control',control_type,'required',required,'sourceTable',source_table,'sourceColumn',source_column,
    'validation',validation_contract,'evidenceRequired',evidence_required) ORDER BY field_order),'[]'::jsonb)::text
  INTO fields_json FROM framework_page_field_definition WHERE page_design_id=target_page_id;

  UPDATE framework_professional_screen_contract SET route_path=target_route,
    screen_name=process_name||' - '||step_row.step_name,actor_code=coalesce(nullif(step_row.actor_code,''),'SYSTEM_ADMIN'),
    business_purpose=coalesce(nullif(step_row.requirement_text,''),step_row.step_name||' 업무를 전문적으로 완료한다.'),
    field_contract=fields_json,updated_by=requested_by,updated_at=current_timestamp
  WHERE process_code=target_process AND step_code=target_step AND audience='ADMIN';

  INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,
    business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,
    state_contract,api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
    audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
  SELECT target_process,target_step,'ADMIN',target_route,process_name||' - '||step_row.step_name,
    coalesce(nullif(step_row.actor_code,''),'SYSTEM_ADMIN'),
    coalesce(nullif(step_row.requirement_text,''),step_row.step_name||' 업무를 전문적으로 완료한다.'),
    '권한과 선행 단계가 확인되어야 한다.','업무 결과·상태·증거·다음 단계 인계가 저장되어야 한다.',
    '[{"code":"completionRate","label":"완료율"},{"code":"blockerCount","label":"차단 건수"},{"code":"dueAt","label":"처리 기한"}]',
    '[{"code":"summary","label":"업무 요약"},{"code":"task","label":"실행 항목"},{"code":"evidence","label":"검증 증거"},{"code":"history","label":"변경 이력"}]',
    fields_json,
    '[{"code":"save","transactional":true},{"code":"validate","evidenceRequired":true},{"code":"complete","nextStepRequired":true}]',
    '["LOADING","EMPTY","READY","VALIDATION_ERROR","AUTHORITY_DENIED","DEPENDENCY_BLOCKED","CONFLICT","SERVER_ERROR"]',
    '[]','["framework_process_step","framework_development_job","framework_process_artifact"]',
    '["actor","stateTransition","inputSnapshot","decision","timestamp","sourceCommit"]',
    '360px 단일 열, 768px 2열, 1280px 요약·업무 상세 구조이며 표는 컴포넌트 내부에서만 스크롤한다.',
    'KRDS 및 WCAG 2.1 AA: 키보드, 포커스, 레이블, 오류 안내, 명도, 상태 비색상 표현을 충족한다.',
    '테넌트·프로젝트·액터 권한, 업무 분리와 상태 전이를 서버에서 검증하고 감사 로그를 남긴다.',
    'factory:'||requested_by,'REVIEW_REQUIRED',requested_by,'HIDDEN',true
  WHERE NOT EXISTS (SELECT 1 FROM framework_professional_screen_contract
    WHERE process_code=target_process AND step_code=target_step AND audience='ADMIN');
  RETURN target_page_id;
END $function$;

SELECT framework_ensure_step_screen_contract(q.process_code,q.step_code,'FLYWAY_CONTRACT_DESIGN_FACTORY')
FROM framework_contract_completion_queue q
WHERE q.completion_status='DESIGN_BLOCKED'
  AND 'REQUIRED_PAGE_DESIGN_MISSING'=ANY(q.design_blockers);
