-- Reverse-register implemented screens without replacing verified source pages.
-- Only exact route matches may inherit a professional process contract.

CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF source IS NULL OR btrim(source)='' THEN RETURN fallback; END IF;
  RETURN source::jsonb;
EXCEPTION WHEN others THEN
  RETURN jsonb_build_array(source);
END $$;

UPDATE framework_screen_blueprint b
SET specification_json = jsonb_build_object(
      'schemaVersion','2.0.0',
      'designSystem','KRDS_GOV',
      'businessPurpose',c.business_purpose,
      'actorResponsibilities',jsonb_build_array(c.actor_code || ' 역할로 계약된 업무를 수행한다.'),
      'entryConditions',jsonb_build_array(c.entry_condition),
      'exitConditions',jsonb_build_array(c.exit_condition),
      'states',framework_try_jsonb(c.state_contract),
      'kpis',framework_try_jsonb(c.kpi_contract),
      'sections',framework_try_jsonb(c.section_contract),
      'fields',framework_try_jsonb(c.field_contract),
      'actions',framework_try_jsonb(c.command_contract),
      'apiContracts',framework_try_jsonb(c.api_contract),
      'dataContracts',framework_try_jsonb(c.data_contract),
      'permissions',framework_try_jsonb(c.security_contract),
      'validations',framework_try_jsonb(c.evidence_contract),
      'errors',jsonb_build_array(jsonb_build_object(
        'code','PROCESS_OR_VALIDATION_ERROR',
        'recovery','오류 원인을 보존하고 동일 업무 단계에서 재시도한다.'
      )),
      'responsive',jsonb_build_object('contract',c.responsive_contract,'mobile','single-column','tablet','adaptive-grid','desktop','task-and-context'),
      'accessibility',jsonb_build_object('contract',c.accessibility_contract,'standard','WCAG_2_1_AA','keyboard',true,'labels',true,'focusManagement',true),
      'completionRule',c.exit_condition,
      'reverseRegistration',jsonb_build_object(
        'strategy','EXACT_ROUTE_PROFESSIONAL_CONTRACT',
        'contractId',c.contract_id,
        'sourcePreserved',true,
        'registeredAt',current_timestamp
      )
    )::text,
    traceability_json = (framework_try_jsonb(b.traceability_json,'{}'::jsonb) || jsonb_build_object(
      'professionalContractId',c.contract_id,
      'designReadinessScore',c.design_readiness_score,
      'requiredScenarioTypes',jsonb_build_array('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'),
      'reverseRegistered',true
    ))::text,
    validation_status = CASE WHEN c.design_readiness_score=100 THEN 'VALID' ELSE 'INVALID' END,
    validation_message = CASE WHEN c.design_readiness_score=100 THEN null ELSE '전문 화면 상세 설계 계약 보완 필요' END,
    implementation_strategy = CASE
      WHEN b.implementation_strategy='GENERATED_RUNTIME' AND c.design_readiness_score=100 THEN 'GENERATED_RUNTIME'
      ELSE 'ADOPT_EXISTING'
    END,
    transition_status = CASE WHEN c.design_readiness_score=100 THEN 'CONTRACT_LINKED' ELSE 'DESIGN_BLOCKED' END,
    source_reference = coalesce(b.source_reference,'PROFESSIONAL_SCREEN_CONTRACT:' || c.contract_id),
    updated_at=current_timestamp
FROM framework_professional_screen_design_readiness c
WHERE b.audience=c.audience
  AND lower(split_part(b.route_path,'?',1))=lower(split_part(c.route_path,'?',1));

CREATE OR REPLACE VIEW framework_existing_screen_reverse_design_coverage AS
SELECT p.page_id,p.page_name,p.route_path,p.domain_code,p.version_status,
       b.blueprint_id,b.blueprint_code,b.process_code,b.step_code,b.actor_code,b.audience,
       b.validation_status,b.validation_message,b.implementation_strategy,b.transition_status,
       b.source_reference,
       c.contract_id AS professional_contract_id,
       coalesce(c.design_readiness_score,0) AS design_readiness_score,
       d.design_asset_id,d.source_path,
       CASE
         WHEN b.blueprint_id IS NULL THEN 'BLUEPRINT_MISSING'
         WHEN c.contract_id IS NULL THEN 'PROFESSIONAL_CONTRACT_MISSING'
         WHEN c.design_readiness_score<100 THEN 'DETAIL_DESIGN_INCOMPLETE'
         WHEN d.design_asset_id IS NULL THEN 'SOURCE_ASSET_MISSING'
         ELSE 'GENERATOR_READY'
       END AS reverse_registration_status
FROM ui_page_manifest p
LEFT JOIN LATERAL (
  SELECT candidate.* FROM framework_screen_blueprint candidate
  WHERE lower(split_part(candidate.route_path,'?',1))=lower(split_part(p.route_path,'?',1))
  ORDER BY (candidate.validation_status='VALID') DESC,candidate.updated_at DESC,candidate.blueprint_id
  LIMIT 1
) b ON true
LEFT JOIN LATERAL (
  SELECT candidate.* FROM framework_professional_screen_design_readiness candidate
  WHERE candidate.audience=b.audience
    AND lower(split_part(candidate.route_path,'?',1))=lower(split_part(b.route_path,'?',1))
  ORDER BY candidate.design_readiness_score DESC,candidate.contract_id
  LIMIT 1
) c ON true
LEFT JOIN LATERAL (
  SELECT r.design_asset_id,r.source_path
  FROM framework_design_asset_registry r
  WHERE r.active_yn='Y'
    AND lower(split_part(r.route_path,'?',1))=lower(split_part(p.route_path,'?',1))
  ORDER BY r.updated_at DESC,r.design_asset_id
  LIMIT 1
) d ON true
WHERE p.active_yn='Y';

COMMENT ON VIEW framework_existing_screen_reverse_design_coverage IS
'기개발 화면의 URL, 전문 설계, 생성 청사진, 실제 소스 자산을 정확한 경로로 결합한 역등록 준비도';
