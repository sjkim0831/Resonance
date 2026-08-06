-- COMPANY_ONBOARDING 2.0.1 binds the design ledger to the routes that are
-- actually implemented.  This migration deliberately does not create QA
-- evidence or promote development jobs; a fresh authenticated BUSINESS_E2E
-- run is required after the contract fingerprint changes.

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_definition
SET definition_locked=false,
    definition_lock_reason='VERSIONED_MAINTENANCE_2.0.1_RUNTIME_CONTRACT_ALIGNMENT',
    updated_at=current_timestamp
WHERE process_code='COMPANY_ONBOARDING';

UPDATE framework_process_definition
SET process_name='기업·사업장 온보딩',
    process_version='2.0.1',
    owner_actor_code='COMPANY_MANAGER',
    goal='승인된 기업, 활성 사업장, 책임 액터와 업무분리를 갖춰 배출량 프로젝트를 안전하게 시작한다.',
    start_condition='기업 등록 신청 정보와 법적 증빙이 제출되어 있다.',
    completion_condition='기업 승인, 활성 사업장, 필수 액터, 업무분리 및 프로젝트 착수 준비 진단이 모두 통과한다.',
    process_status='ACTIVE',
    lifecycle_status='ACTIVE',
    definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: authenticated onboarding E2E required',
    last_reviewed_at=current_timestamp,
    next_review_at=current_timestamp+interval '90 days',
    updated_at=current_timestamp
WHERE process_code='COMPANY_ONBOARDING';

UPDATE framework_actor_definition
SET actor_name=CASE actor_code
      WHEN 'COMPANY_MANAGER' THEN '기업 업무 책임자'
      WHEN 'VERIFIER' THEN '검증 담당자'
      ELSE actor_name END,
    use_at='Y',
    updated_at=current_timestamp
WHERE actor_code IN ('COMPANY_MANAGER','VERIFIER');

UPDATE framework_process_step
SET api_contract=CASE step_code
      WHEN 'COMPANY_ONBOARDING_APPROVE' THEN 'POST /admin/api/admin/member/company-approve/action'
      WHEN 'COMPANY_ONBOARDING_ACTORS' THEN 'POST /admin/api/system/actor-process/assignments'
      ELSE api_contract END
WHERE process_code='COMPANY_ONBOARDING'
  AND step_code IN ('COMPANY_ONBOARDING_APPROVE','COMPANY_ONBOARDING_ACTORS');

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

-- The endpoint registry is implementation inventory.  Stale aliases are kept
-- for history but cannot satisfy current design validation.
UPDATE framework_api_endpoint_registry
SET active_yn='N'
WHERE http_method='POST'
  AND route_path IN (
    '/api/admin/member/company-approve/action',
    '/api/admin/system/actor-process/assign'
  );

INSERT INTO framework_api_endpoint_registry(
  endpoint_key,http_method,route_path,implementation_ref,active_yn,verified_at
)
VALUES
  ('ONBOARDING:COMPANY:APPROVE','POST','/admin/api/admin/member/company-approve/action',
   'AdminApprovalController#companyApproveSubmitApi','Y',current_timestamp),
  ('ONBOARDING:ACTOR:ASSIGN','POST','/admin/api/system/actor-process/assignments',
   'ActorProcessGovernanceApiController#assignment','Y',current_timestamp)
ON CONFLICT(http_method,route_path) DO UPDATE SET
  implementation_ref=excluded.implementation_ref,
  active_yn='Y',
  verified_at=current_timestamp;

UPDATE framework_professional_screen_contract
SET api_contract=CASE step_code
      WHEN 'COMPANY_ONBOARDING_APPROVE' THEN
        jsonb_build_array(jsonb_build_object('method','POST','path','/admin/api/admin/member/company-approve/action'))::text
      WHEN 'COMPANY_ONBOARDING_ACTORS' THEN
        jsonb_build_array(jsonb_build_object('method','POST','path','/admin/api/system/actor-process/assignments'))::text
      ELSE api_contract END,
    api_verified=false,
    database_verified=false,
    authority_verified=false,
    responsive_verified=false,
    accessibility_verified=false,
    exception_states_verified=false,
    audit_evidence_ref='',
    contract_status='REVIEW_REQUIRED',
    updated_by='COMPANY_ONBOARDING_2_0_1_ALIGNMENT',
    updated_at=current_timestamp
WHERE process_code='COMPANY_ONBOARDING'
  AND step_code IN ('COMPANY_ONBOARDING_APPROVE','COMPANY_ONBOARDING_ACTORS');

UPDATE framework_process_step_screen_binding
SET api_contract=replace(
      replace(api_contract::text,
        '/api/admin/member/company-approve/action',
        '/admin/api/admin/member/company-approve/action'),
        '/api/admin/system/actor-process/assign',
        '/admin/api/system/actor-process/assignments')::jsonb,
    context_contract=replace(
      replace(context_contract::text,
        '/api/admin/member/company-approve/action',
        '/admin/api/admin/member/company-approve/action'),
        '/api/admin/system/actor-process/assign',
        '/admin/api/system/actor-process/assignments')::jsonb,
    guide_contract=replace(
      replace(guide_contract::text,
        '/api/admin/member/company-approve/action',
        '/admin/api/admin/member/company-approve/action'),
        '/api/admin/system/actor-process/assign',
        '/admin/api/system/actor-process/assignments')::jsonb,
    contract_status='DESIGNED',
    updated_at=current_timestamp
WHERE process_code='COMPANY_ONBOARDING'
  AND step_code IN ('COMPANY_ONBOARDING_APPROVE','COMPANY_ONBOARDING_ACTORS');

UPDATE framework_step_execution_spec spec
SET actor_contract=jsonb_set(
      spec.actor_contract,
      '{ownerActorCode}',
      to_jsonb('COMPANY_MANAGER'::text),
      true),
    api_contract=CASE spec.step_code
      WHEN 'COMPANY_ONBOARDING_APPROVE' THEN
        CASE WHEN jsonb_array_length(spec.api_contract)>0
          THEN jsonb_set(spec.api_contract,'{0,declaredContract}',
            to_jsonb('POST /admin/api/admin/member/company-approve/action'::text),true)
          ELSE jsonb_build_array(jsonb_build_object(
            'declaredContract','POST /admin/api/admin/member/company-approve/action',
            'transactional',true,'tenantGuard',true,'projectGuard',true,
            'actorGuard',true,'idempotencyKey',true,'rowVersion',true,
            'errorContract',jsonb_build_array(
              'VALIDATION_ERROR','FORBIDDEN','CONFLICT','DEPENDENCY_BLOCKED','SERVER_ERROR')))
        END
      WHEN 'COMPANY_ONBOARDING_ACTORS' THEN
        CASE WHEN jsonb_array_length(spec.api_contract)>0
          THEN jsonb_set(spec.api_contract,'{0,declaredContract}',
            to_jsonb('POST /admin/api/system/actor-process/assignments'::text),true)
          ELSE jsonb_build_array(jsonb_build_object(
            'declaredContract','POST /admin/api/system/actor-process/assignments',
            'transactional',true,'tenantGuard',true,'projectGuard',true,
            'actorGuard',true,'idempotencyKey',true,'rowVersion',true,
            'errorContract',jsonb_build_array(
              'VALIDATION_ERROR','FORBIDDEN','CONFLICT','DEPENDENCY_BLOCKED','SERVER_ERROR')))
        END
      ELSE spec.api_contract END,
    approval_status='REVIEW_REQUIRED',
    approved_by=null,
    approved_at=null,
    updated_at=current_timestamp
WHERE spec.process_code='COMPANY_ONBOARDING';

UPDATE framework_step_execution_spec
SET source_hash=md5(
      actor_contract::text||business_contract::text||transition_contract::text||input_contract::text||
      output_contract::text||screen_contract::text||field_contract::text||command_contract::text||
      api_contract::text||persistence_contract::text||handoff_contract::text||test_contract::text||
      guide_contract::text||nonfunctional_contract::text),
    spec_version=spec_version+1,
    updated_at=current_timestamp
WHERE process_code='COMPANY_ONBOARDING';

UPDATE framework_screen_resource
SET source_kind='REACT_SOURCE',
    source_ref='projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx',
    implementation_status='IMPLEMENTED',
    updated_at=current_timestamp
WHERE lower(split_part(route_key,'?',1))='/admin/emission/project-operations';

UPDATE framework_design_asset_registry
SET source_path='projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx',
    asset_fingerprint=md5(
      design_asset_id||'|projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx'),
    updated_at=current_timestamp
WHERE active_yn='Y'
  AND lower(split_part(route_path,'?',1))='/admin/emission/project-operations';

UPDATE framework_screen_blueprint
SET implementation_strategy='ADOPT_EXISTING',
    source_reference='projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx',
    transition_status='CONTRACT_LINKED',
    updated_at=current_timestamp
WHERE lower(split_part(route_path,'?',1))='/admin/emission/project-operations';

CREATE OR REPLACE VIEW framework_company_onboarding_e2e_readiness AS
SELECT s.step_order,
       s.step_code,
       s.step_name,
       s.actor_code,
       p.owner_actor_code,
       p.process_version,
       s.api_contract,
       count(DISTINCT binding.binding_id) FILTER (WHERE binding.binding_status='ACTIVE')::integer AS active_screen_bindings,
       count(DISTINCT contract.contract_id)::integer AS screen_contracts,
       count(DISTINCT contract.contract_id) FILTER (WHERE contract.contract_status='VERIFIED')::integer AS verified_screen_contracts,
       coalesce(evidence.business_test_result,'NOT_RUN') AS business_test_result,
       coalesce(evidence.business_evidence_status,'NO_CURRENT_VERSION_EVIDENCE') AS business_evidence_status
FROM framework_process_definition p
JOIN framework_process_step s USING(process_code)
LEFT JOIN framework_process_step_screen_binding binding
  ON binding.process_code=s.process_code AND binding.step_code=s.step_code
LEFT JOIN framework_professional_screen_contract contract
  ON contract.process_code=s.process_code AND contract.step_code=s.step_code
LEFT JOIN framework_current_business_e2e_evidence evidence
  ON evidence.process_code=s.process_code AND evidence.step_code=s.step_code
WHERE s.process_code='COMPANY_ONBOARDING'
GROUP BY s.step_order,s.step_code,s.step_name,s.actor_code,p.owner_actor_code,
         p.process_version,s.api_contract,evidence.business_test_result,evidence.business_evidence_status;

DO $$
DECLARE
  step_count integer;
  case_count integer;
  planned_job_count integer;
  invalid_count integer;
BEGIN
  SELECT count(*) INTO step_count
  FROM framework_process_step WHERE process_code='COMPANY_ONBOARDING';
  SELECT count(*) INTO case_count
  FROM framework_simulation_case
  WHERE process_code='COMPANY_ONBOARDING' AND automated=true;
  SELECT count(*) INTO planned_job_count
  FROM framework_development_job
  WHERE process_code='COMPANY_ONBOARDING' AND job_status='PLANNED';

  SELECT count(*) INTO invalid_count
  FROM framework_process_definition p
  WHERE p.process_code='COMPANY_ONBOARDING'
    AND (
      p.process_version<>'2.0.1'
      OR p.owner_actor_code<>'COMPANY_MANAGER'
      OR NOT EXISTS (
        SELECT 1 FROM framework_actor_definition a
        WHERE a.actor_code=p.owner_actor_code AND a.use_at='Y')
      OR EXISTS (
        SELECT 1 FROM framework_process_step s
        WHERE s.process_code=p.process_code
          AND ((s.step_code='COMPANY_ONBOARDING_APPROVE'
                AND s.api_contract<>'POST /admin/api/admin/member/company-approve/action')
            OR (s.step_code='COMPANY_ONBOARDING_ACTORS'
                AND s.api_contract<>'POST /admin/api/system/actor-process/assignments')))
    );

  IF step_count<>5 OR case_count<>7 OR planned_job_count<>60 OR invalid_count<>0 THEN
    RAISE EXCEPTION
      'COMPANY_ONBOARDING_RUNTIME_CONTRACT_INVALID steps=% cases=% plannedJobs=% invalid=%',
      step_count,case_count,planned_job_count,invalid_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM framework_screen_resource
    WHERE lower(split_part(route_key,'?',1))='/admin/emission/project-operations'
      AND source_ref='projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx'
      AND implementation_status='IMPLEMENTED'
  ) THEN
    RAISE EXCEPTION 'COMPANY_ONBOARDING_PROJECT_OPERATIONS_SOURCE_DRIFT';
  END IF;
END $$;

COMMENT ON VIEW framework_company_onboarding_e2e_readiness IS
  'Five-step COMPANY_ONBOARDING current-contract and immutable BUSINESS_E2E evidence readiness; NOT_RUN stays fail closed.';
