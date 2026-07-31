-- Keep the executable screen graph synchronized with the professional screen
-- contracts.  Contract generation is intentionally independent from page
-- design generation, so every contract route must be projected into the same
-- canonical screen/resource graph before quality and runtime automation runs.

CREATE OR REPLACE FUNCTION framework_sync_professional_contract_screen_graph(
  requested_process varchar DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  resource_count integer;
  binding_count integer;
  data_binding_count integer;
BEGIN
  INSERT INTO framework_screen_resource(
    route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
    responsive_contract,accessibility_contract,security_contract
  )
  SELECT DISTINCT ON (lower(split_part(c.route_path,'?',1)))
    lower(split_part(c.route_path,'?',1)),
    c.screen_name,
    CASE
      WHEN c.screen_usage_type IN ('POPUP','TAB','LIST','DETAIL','WORKSPACE')
        THEN c.screen_usage_type
      ELSE 'WORKSPACE'
    END,
    CASE
      WHEN c.contract_status='VERIFIED'
       AND c.api_verified AND c.database_verified AND c.authority_verified
       AND c.responsive_verified AND c.accessibility_verified
       AND c.exception_states_verified THEN 'VERIFIED'
      ELSE 'IMPLEMENTED'
    END,
    'PROFESSIONAL_SCREEN_CONTRACT',
    'contract:'||c.contract_id,
    framework_try_jsonb(c.responsive_contract,'{}'::jsonb),
    framework_try_jsonb(c.accessibility_contract,'{}'::jsonb),
    framework_try_jsonb(c.security_contract,'{}'::jsonb)
  FROM framework_professional_screen_contract c
  WHERE nullif(split_part(c.route_path,'?',1),'') IS NOT NULL
    AND (requested_process IS NULL OR c.process_code=requested_process)
  ORDER BY lower(split_part(c.route_path,'?',1)),
    CASE WHEN c.contract_status='VERIFIED' THEN 0 ELSE 1 END,
    c.contract_id
  ON CONFLICT(route_key) DO UPDATE SET
    screen_name=excluded.screen_name,
    screen_type=excluded.screen_type,
    implementation_status=CASE
      WHEN framework_screen_resource.implementation_status='VERIFIED' THEN 'VERIFIED'
      ELSE excluded.implementation_status
    END,
    responsive_contract=excluded.responsive_contract,
    accessibility_contract=excluded.accessibility_contract,
    security_contract=excluded.security_contract,
    updated_at=current_timestamp;

  GET DIAGNOSTICS resource_count = ROW_COUNT;

  INSERT INTO framework_process_step_screen_binding(
    process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
    context_contract,visibility_contract,completion_contract,guide_contract,
    binding_status
  )
  SELECT DISTINCT ON (
    c.process_code,c.step_code,r.screen_resource_id,c.audience
  )
    c.process_code,c.step_code,r.screen_resource_id,c.audience,c.actor_code,
    CASE WHEN c.screen_usage_type IN ('POPUP','TAB','READ_ONLY')
      THEN c.screen_usage_type ELSE 'PRIMARY' END,
    jsonb_build_object(
      'tenantId',c.tenant_context_required,
      'projectId',c.project_context_required,
      'processCode',c.process_code,
      'stepCode',c.step_code,
      'contractId',c.contract_id
    ),
    jsonb_build_object(
      'audience',c.audience,
      'permissionCodes',coalesce(c.permission_codes,'[]'::jsonb),
      'serverAuthorization',true,
      'tenantIsolation',c.tenant_context_required,
      'projectIsolation',c.project_context_required
    ),
    jsonb_build_object(
      'entryCondition',c.entry_condition,
      'exitCondition',c.exit_condition,
      'stateContract',framework_try_jsonb(c.state_contract)
    ),
    jsonb_build_object(
      'title',c.screen_name,
      'purpose',c.business_purpose,
      'route',r.route_key,
      'processSequence',c.process_sequence,
      'stepSequence',c.step_sequence,
      'screenSequence',c.screen_sequence
    ),
    'ACTIVE'
  FROM framework_professional_screen_contract c
  JOIN framework_screen_resource r
    ON r.route_key=lower(split_part(c.route_path,'?',1))
  JOIN framework_process_step s
    ON s.process_code=c.process_code AND s.step_code=c.step_code
  JOIN framework_actor_definition a ON a.actor_code=c.actor_code
  WHERE nullif(split_part(c.route_path,'?',1),'') IS NOT NULL
    AND c.audience IN ('USER','ADMIN','PUBLIC')
    AND (requested_process IS NULL OR c.process_code=requested_process)
  ORDER BY c.process_code,c.step_code,r.screen_resource_id,c.audience,
    CASE WHEN c.contract_status='VERIFIED' THEN 0 ELSE 1 END,
    c.contract_id
  ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET
    actor_code=excluded.actor_code,
    entry_mode=excluded.entry_mode,
    context_contract=excluded.context_contract,
    visibility_contract=excluded.visibility_contract,
    completion_contract=excluded.completion_contract,
    guide_contract=excluded.guide_contract,
    binding_status='ACTIVE',
    updated_at=current_timestamp;

  GET DIAGNOSTICS binding_count = ROW_COUNT;

  INSERT INTO framework_screen_capability(
    screen_resource_id,capability_code,capability_name,capability_type,
    command_contract,error_contract,evidence_contract,implementation_status
  )
  SELECT
    r.screen_resource_id,
    'SCREEN_CONTRACT_'||c.contract_id,
    c.screen_name||' 실행',
    'COMMAND',
    jsonb_build_object(
      'contractId',c.contract_id,
      'commands',framework_try_jsonb(c.command_contract),
      'apis',framework_try_jsonb(c.api_contract),
      'idempotencyRequired',true
    ),
    jsonb_build_object(
      'states',framework_try_jsonb(c.state_contract),
      'exceptionStatesVerified',c.exception_states_verified
    ),
    jsonb_build_object(
      'contract',framework_try_jsonb(c.evidence_contract),
      'auditEvidenceRef',c.audit_evidence_ref
    ),
    CASE WHEN c.contract_status='VERIFIED' THEN 'VERIFIED' ELSE 'IMPLEMENTED' END
  FROM framework_professional_screen_contract c
  JOIN framework_screen_resource r
    ON r.route_key=lower(split_part(c.route_path,'?',1))
  WHERE nullif(split_part(c.route_path,'?',1),'') IS NOT NULL
    AND (requested_process IS NULL OR c.process_code=requested_process)
  ON CONFLICT(screen_resource_id,capability_code) DO UPDATE SET
    capability_name=excluded.capability_name,
    command_contract=excluded.command_contract,
    error_contract=excluded.error_contract,
    evidence_contract=excluded.evidence_contract,
    implementation_status=excluded.implementation_status,
    updated_at=current_timestamp;

  INSERT INTO framework_step_capability_binding(
    process_code,step_code,capability_id,actor_code,required,
    permission_contract,completion_effect
  )
  SELECT
    c.process_code,c.step_code,cap.capability_id,c.actor_code,true,
    jsonb_build_object(
      'permissionCodes',coalesce(c.permission_codes,'[]'::jsonb),
      'dataScope',coalesce(c.data_scope_contract,'{}'::jsonb),
      'serverAuthorization',true
    ),
    jsonb_build_object(
      'exitCondition',c.exit_condition,
      'transitionType',c.transition_type,
      'nextStepCodes',coalesce(c.next_step_codes,'[]'::jsonb)
    )
  FROM framework_professional_screen_contract c
  JOIN framework_screen_resource r
    ON r.route_key=lower(split_part(c.route_path,'?',1))
  JOIN framework_screen_capability cap
    ON cap.screen_resource_id=r.screen_resource_id
   AND cap.capability_code='SCREEN_CONTRACT_'||c.contract_id
  JOIN framework_process_step s
    ON s.process_code=c.process_code AND s.step_code=c.step_code
  JOIN framework_actor_definition a ON a.actor_code=c.actor_code
  WHERE nullif(split_part(c.route_path,'?',1),'') IS NOT NULL
    AND (requested_process IS NULL OR c.process_code=requested_process)
  ON CONFLICT(process_code,step_code,capability_id) DO UPDATE SET
    actor_code=excluded.actor_code,
    permission_contract=excluded.permission_contract,
    completion_effect=excluded.completion_effect;

  INSERT INTO framework_data_element(
    data_element_code,domain_code,logical_name,data_type,semantic_definition,
    privacy_class,canonical_validation
  )
  SELECT DISTINCT ON (
    'PSC_'||upper(substr(md5(c.process_code||':'||coalesce(f.value->>'fieldCode','')),1,24))
  )
    'PSC_'||upper(substr(md5(c.process_code||':'||coalesce(f.value->>'fieldCode','')),1,24)),
    coalesce(nullif(s.domain_code,''),'COMMON'),
    coalesce(nullif(f.value->>'fieldName',''),f.value->>'fieldCode'),
    coalesce(nullif(f.value->>'dataType',''),'STRING'),
    coalesce(nullif(f.value->>'helpText',''),c.business_purpose,c.screen_name),
    coalesce(nullif(f.value->>'privacyClass',''),'INTERNAL'),
    coalesce(f.value->'validation','{}'::jsonb)
  FROM framework_professional_screen_contract c
  JOIN framework_process_definition s ON s.process_code=c.process_code
  CROSS JOIN LATERAL jsonb_array_elements(framework_try_jsonb(c.field_contract)) f(value)
  WHERE jsonb_typeof(f.value)='object'
    AND nullif(f.value->>'fieldCode','') IS NOT NULL
    AND (requested_process IS NULL OR c.process_code=requested_process)
  ORDER BY
    'PSC_'||upper(substr(md5(c.process_code||':'||coalesce(f.value->>'fieldCode','')),1,24)),
    c.contract_id
  ON CONFLICT(data_element_code) DO UPDATE SET
    logical_name=excluded.logical_name,
    data_type=excluded.data_type,
    semantic_definition=excluded.semantic_definition,
    privacy_class=excluded.privacy_class,
    canonical_validation=excluded.canonical_validation,
    updated_at=current_timestamp;

  INSERT INTO framework_screen_data_binding(
    screen_resource_id,data_element_code,field_code,field_name,control_type,
    api_property,source_table,source_column,required,editable,
    validation_contract,lineage_status
  )
  SELECT DISTINCT ON (r.screen_resource_id,f.value->>'fieldCode')
    r.screen_resource_id,
    'PSC_'||upper(substr(md5(c.process_code||':'||coalesce(f.value->>'fieldCode','')),1,24)),
    f.value->>'fieldCode',
    coalesce(nullif(f.value->>'fieldName',''),f.value->>'fieldCode'),
    coalesce(nullif(f.value->>'controlType',''),'TEXT'),
    coalesce(nullif(f.value->>'apiProperty',''),f.value->>'fieldCode'),
    nullif(f.value->>'sourceTable',''),
    nullif(f.value->>'sourceColumn',''),
    coalesce((f.value->>'required')::boolean,false),
    coalesce((f.value->>'editable')::boolean,false),
    coalesce(f.value->'validation','{}'::jsonb),
    CASE
      WHEN f.value->>'mappingStatus' IN ('DB_RESOLVED','IMPLEMENTATION_VERIFIED')
        THEN f.value->>'mappingStatus'
      WHEN nullif(f.value->>'sourceTable','') IS NOT NULL
       AND nullif(f.value->>'sourceColumn','') IS NOT NULL THEN 'DB_RESOLVED'
      ELSE 'LOGICAL_CONTRACT'
    END
  FROM framework_professional_screen_contract c
  JOIN framework_screen_resource r
    ON r.route_key=lower(split_part(c.route_path,'?',1))
  CROSS JOIN LATERAL jsonb_array_elements(framework_try_jsonb(c.field_contract)) f(value)
  WHERE jsonb_typeof(f.value)='object'
    AND nullif(f.value->>'fieldCode','') IS NOT NULL
    AND (requested_process IS NULL OR c.process_code=requested_process)
  ORDER BY r.screen_resource_id,f.value->>'fieldCode',
    CASE WHEN f.value->>'mappingStatus' IN ('DB_RESOLVED','IMPLEMENTATION_VERIFIED') THEN 0 ELSE 1 END,
    c.contract_id
  ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET
    field_name=excluded.field_name,
    control_type=excluded.control_type,
    api_property=excluded.api_property,
    source_table=excluded.source_table,
    source_column=excluded.source_column,
    required=excluded.required,
    editable=excluded.editable,
    validation_contract=excluded.validation_contract,
    lineage_status=excluded.lineage_status;

  GET DIAGNOSTICS data_binding_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'resources',resource_count,
    'bindings',binding_count,
    'dataBindings',data_binding_count
  );
END
$function$;

-- Terms consent is one guided workflow using the existing registration and
-- consent-history workspaces.  Do not manufacture one route per step.
UPDATE framework_page_design
SET actual_route_path=CASE
      WHEN audience='ADMIN' THEN '/admin/system/consent-history'
      WHEN step_code='TERMS_CONSENT_S1' THEN '/join/step1'
      WHEN step_code IN ('TERMS_CONSENT_S2','TERMS_CONSENT_S3') THEN '/join/step2'
      ELSE '/join/step3'
    END,
    route_status='IMPLEMENTED',
    updated_at=current_timestamp
WHERE process_code='TERMS_CONSENT';

-- An older mass generator added a second DESIGN_ONLY user contract for each
-- step instead of adopting the already registered join screens.  Remove only
-- those redundant planned contracts; the canonical contracts (2970-2977) and
-- their distinct step1/step2/step3 routes remain the source of truth.
DELETE FROM framework_professional_screen_contract
WHERE process_code='TERMS_CONSENT'
  AND route_path LIKE '/planned/member/terms-consent/%';

-- Repair five legacy contracts whose synthetic step codes never existed.
-- The replacement steps are the canonical executable steps for each route.
UPDATE framework_professional_screen_contract
SET step_code='EMISSION_PROJECT_CALCULATE',
    updated_at=current_timestamp,
    updated_by='PROFESSIONAL_SCREEN_GRAPH_SYNC'
WHERE contract_id IN (26269,26271);

UPDATE framework_professional_screen_contract
SET step_code=CASE contract_id
      WHEN 26295 THEN 'MEMBER_LIFECYCLE_01_PLAN'
      ELSE 'MEMBER_LIFECYCLE_02_WORK'
    END,
    updated_at=current_timestamp,
    updated_by='PROFESSIONAL_SCREEN_GRAPH_SYNC'
WHERE contract_id IN (26295,26296);

UPDATE framework_professional_screen_contract
SET process_code='GOVERNANCE_CHANGE',
    step_code='GOV_REQUEST',
    actor_code='PLATFORM_OPERATOR',
    updated_at=current_timestamp,
    updated_by='PROFESSIONAL_SCREEN_GRAPH_SYNC'
WHERE contract_id=26313;

SELECT framework_generate_professional_design_graph('TERMS_CONSENT','PROFESSIONAL_SCREEN_GRAPH_SYNC');
SELECT framework_sync_professional_contract_screen_graph(NULL);

DELETE FROM framework_screen_resource
WHERE route_key LIKE '/admin/planned/member/terms-consent/%'
   OR route_key LIKE '/planned/member/terms-consent/%';

DO $block$
DECLARE
  missing integer;
  stale integer;
BEGIN
  SELECT count(*) INTO missing
  FROM framework_professional_screen_contract c
  LEFT JOIN framework_screen_resource r
    ON r.route_key=lower(split_part(c.route_path,'?',1))
  LEFT JOIN framework_process_step_screen_binding b
    ON b.screen_resource_id=r.screen_resource_id
   AND b.process_code=c.process_code
   AND b.step_code=c.step_code
   AND b.audience=c.audience
  WHERE nullif(split_part(c.route_path,'?',1),'') IS NOT NULL
    AND (r.screen_resource_id IS NULL OR b.binding_id IS NULL);

  SELECT count(*) INTO stale
  FROM framework_screen_resource
  WHERE route_key LIKE '/admin/planned/member/terms-consent/%'
     OR route_key LIKE '/planned/member/terms-consent/%';

  IF missing<>0 OR stale<>0 THEN
    RAISE EXCEPTION 'professional screen graph sync failed missing=% stale=%',
      missing,stale;
  END IF;
END
$block$;
