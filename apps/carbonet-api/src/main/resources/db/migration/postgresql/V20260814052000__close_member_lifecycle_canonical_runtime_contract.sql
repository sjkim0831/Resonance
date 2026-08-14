-- MEMBER_LIFECYCLE acquired its shared USER work route after the original
-- screen-blueprint and runtime-contract backfills had already completed.  Keep
-- the existing (audience, route_path) uniqueness contract by registering the
-- exact query-bearing process_step.user_path for each step.  Canonical identity
-- remains the normalized route plus process, step, and audience.
WITH target AS (
  SELECT step.process_code,step.step_code,step.actor_code,step.user_path,
         contract.contract_id,contract.screen_name,contract.business_purpose,
         contract.entry_condition,contract.exit_condition,contract.kpi_contract,
         contract.section_contract,contract.field_contract,contract.command_contract,
         contract.state_contract,contract.api_contract,contract.data_contract,
         contract.evidence_contract,definition.process_version
    FROM framework_process_step step
    JOIN framework_process_definition definition
      ON definition.process_code=step.process_code
    JOIN framework_professional_screen_contract contract
      ON contract.process_code=step.process_code
     AND contract.step_code=step.step_code
     AND contract.audience='USER'
     AND lower(split_part(contract.route_path,'?',1))=
         lower(split_part(step.user_path,'?',1))
   WHERE step.process_code='MEMBER_LIFECYCLE'
     AND lower(split_part(step.user_path,'?',1))='/work/execution'
)
INSERT INTO framework_screen_blueprint(
  blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
  route_path,screen_type,template_code,specification_json,traceability_json,
  validation_status,validation_message,generated_source_path,created_by,
  implementation_strategy,source_reference,transition_status
)
SELECT 'BP_MEMBER_LIFECYCLE_'||
         upper(substr(md5(step_code||'|USER|'||user_path),1,24)),
       process_code,step_code,actor_code,'USER',
       'MEMBER_LIFECYCLE_'||
         upper(regexp_replace(step_code,'^MEMBER_LIFECYCLE_','','g'))||'_USER',
       screen_name,user_path,'CONTENT','KRDS_CONTENT',
       jsonb_build_object(
         'schemaVersion','2.0.0',
         'designSystem','KRDS_GOV',
         'businessPurpose',business_purpose,
         'actorResponsibilities',jsonb_build_array(
           actor_code||' 액터가 권한, 업무분리, 테넌트 및 프로젝트 범위에 따라 '||
           screen_name||' 업무를 수행한다.'
         ),
         'entryConditions',jsonb_build_array(entry_condition),
         'exitConditions',jsonb_build_array(exit_condition),
         'states',framework_try_jsonb(state_contract),
         'kpis',framework_try_jsonb(kpi_contract),
         'sections',framework_try_jsonb(section_contract),
         'fields',framework_try_jsonb(field_contract),
         'actions',framework_try_jsonb(command_contract),
         'apiContracts',framework_try_jsonb(api_contract),
         'dataContracts',framework_try_jsonb(data_contract),
         'permissions',jsonb_build_array(jsonb_build_object(
           'code',actor_code,'scope','TENANT_PROJECT','serverAuthorization',true,
           'segregationOfDuties',true
         )),
         'validations',jsonb_build_array(
           jsonb_build_object('code','ENTRY_AND_REQUIRED_FIELDS','type','CONTRACT'),
           jsonb_build_object('code','STATE_AND_VERSION','type','CONCURRENCY')
         ),
         'errors',jsonb_build_array(
           jsonb_build_object('code','FORBIDDEN','recovery','권한 및 업무분리 확인'),
           jsonb_build_object('code','CONFLICT','recovery','최신 버전 재조회'),
           jsonb_build_object('code','DEPENDENCY_FAILURE','recovery','멱등키로 안전 재시도')
         ),
         'responsive',jsonb_build_object(
           'mobile','single-column-actions-bottom','tablet','adaptive-grid',
           'desktop','list-detail-workspace'
         ),
         'accessibility',jsonb_build_object(
           'standard','WCAG_2_1_AA','keyboard',true,'labels',true,
           'focusManagement',true,'nonColorStatus',true
         ),
         'completionRule',exit_condition,
         'extensions',jsonb_build_object(
           'contractId',contract_id,'sharedRuntime',true,
           'routeSource','framework_process_step.user_path',
           'processVersion',process_version
         )
       )::text,
       jsonb_build_object(
         'requirementIds',jsonb_build_array(
           process_code||':'||step_code||':USER'
         ),
         'requiredScenarioTypes',jsonb_build_array(
           'HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'
         ),
         'contractId',contract_id,
         'designReadinessScore',100,
         'routeSource','framework_process_step.user_path'
       )::text,
       'VALID','',
       'projects/carbonet-frontend/source/src/features/work-execution/WorkExecutionPage.tsx',
       'MEMBER_LIFECYCLE_CANONICAL_RECONCILER','ADOPT_EXISTING',
       'framework_professional_screen_contract:'||contract_id,'CONTRACT_LINKED'
  FROM target
ON CONFLICT(audience,route_path) DO NOTHING;

-- Fail closed on the four exact source identities and their targeted canonical
-- bundles.  This deliberately does not publish runtime versions: publication
-- stays in the authenticated professional-contract save transaction so the
-- Java eight-layer projection, validation, hash, version, and binding cannot
-- drift from the production implementation.
DO $$
DECLARE
  source_count integer;
  distinct_route_count integer;
  row record;
  bundle jsonb;
  lane_keys text[];
  expected_screen_key text;
BEGIN
  SELECT count(*),count(DISTINCT blueprint.route_path)
    INTO source_count,distinct_route_count
    FROM framework_screen_blueprint blueprint
    JOIN framework_process_step step
      ON step.process_code=blueprint.process_code
     AND step.step_code=blueprint.step_code
     AND step.user_path=blueprint.route_path
    JOIN framework_professional_screen_contract contract
      ON contract.process_code=blueprint.process_code
     AND contract.step_code=blueprint.step_code
     AND contract.audience=blueprint.audience
     AND lower(split_part(contract.route_path,'?',1))=
         lower(split_part(blueprint.route_path,'?',1))
     AND blueprint.source_reference=
         'framework_professional_screen_contract:'||contract.contract_id
   WHERE blueprint.process_code='MEMBER_LIFECYCLE'
     AND blueprint.audience='USER'
     AND blueprint.validation_status='VALID'
     AND blueprint.implementation_strategy='ADOPT_EXISTING'
     AND blueprint.transition_status='CONTRACT_LINKED'
     AND lower(split_part(blueprint.route_path,'?',1))='/work/execution';

  IF source_count<>4 OR distinct_route_count<>4 THEN
    RAISE EXCEPTION
      'MEMBER_LIFECYCLE canonical blueprint closure failed: sources=% distinctRoutes=%',
      source_count,distinct_route_count;
  END IF;

  FOR row IN
    SELECT step.step_code,step.user_path
      FROM framework_process_step step
     WHERE step.process_code='MEMBER_LIFECYCLE'
       AND lower(split_part(step.user_path,'?',1))='/work/execution'
     ORDER BY step.step_order,step.step_code
  LOOP
    IF (SELECT count(*)
          FROM framework_professional_screen_contract contract
         WHERE contract.process_code='MEMBER_LIFECYCLE'
           AND contract.step_code=row.step_code
           AND contract.audience='USER'
           AND lower(split_part(contract.route_path,'?',1))='/work/execution')<>1 THEN
      RAISE EXCEPTION
        'MEMBER_LIFECYCLE professional contract identity is not exact: step=%',
        row.step_code;
    END IF;

    bundle:=framework_canonical_screen_bundle(
      'MEMBER_LIFECYCLE',row.step_code,'USER',row.user_path
    );
    expected_screen_key:=
      'MEMBER_LIFECYCLE|'||upper(row.step_code)||'|USER|/work/execution';

    SELECT array_agg(key ORDER BY key)
      INTO lane_keys
      FROM jsonb_object_keys(bundle#>'{canonicalDesign,lanes}') key;

    IF bundle#>>'{canonicalDesign,identity,screenKey}'<>expected_screen_key
       OR bundle#>>'{canonicalDesign,identity,routePath}'<>'/work/execution'
       OR bundle#>>'{canonicalDesign,identity,audience}'<>'USER'
       OR lane_keys<>ARRAY[
         'API','DATABASE','DESIGN_CARD','FRONTEND','HELP','QA','WORK_GUIDE'
       ]::text[]
       OR jsonb_typeof(
            bundle#>'{canonicalDesign,lanes,DESIGN_CARD,assetBindings}'
          )<>'array'
       OR jsonb_array_length(
            bundle#>'{canonicalDesign,lanes,DESIGN_CARD,assetBindings}'
          )=0
       OR coalesce(bundle->>'designHash','') !~ '^[0-9a-f]{64}$'
       OR bundle->>'canonicalText'<>(bundle->'canonicalDesign')::text
       OR bundle->>'designHash'<>
          encode(sha256(convert_to(bundle->>'canonicalText','UTF8')),'hex') THEN
      RAISE EXCEPTION
        'MEMBER_LIFECYCLE canonical bundle closure failed: step=%',row.step_code;
    END IF;
  END LOOP;
END $$;
