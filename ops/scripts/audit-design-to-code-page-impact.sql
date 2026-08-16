-- Read-only, one-statement DB core for the design-to-code page impact ledger.
--
-- Route totals are deliberately separate from the executable screen identity:
--   upper(process_code) | upper(step_code) | upper(audience) |
--   lower(split_part(route, '?', 1))
--
-- The query scans each source once through MATERIALIZED CTEs. Existing unique
-- and lookup indexes cover route_key, process/step/audience, and professional
-- contract identity joins. It never creates a temp object or mutates a row.
WITH
audit_parameter AS NOT MATERIALIZED (
  SELECT /*__PROCESS_CODE__*/NULL::text AS process_code,
         /*__STEP_CODE__*/NULL::text AS step_code,
         /*__AUDIENCE__*/NULL::text AS audience,
         /*__ROUTE_PATH__*/NULL::text AS route_path
),
required_direct AS MATERIALIZED (
  SELECT DISTINCT upper(step.process_code) AS process_code,
         upper(step.step_code) AS step_code,
         lane.audience,
         lower(split_part(btrim(lane.route_path),'?',1)) AS route_path
   FROM public.framework_process_step step
   CROSS JOIN LATERAL (VALUES
     ('USER'::text,nullif(btrim(step.user_path),''),step.requires_user_page),
     ('ADMIN'::text,nullif(btrim(step.admin_path),''),step.requires_admin_page)
   ) lane(audience,route_path,screen_required)
   WHERE lane.route_path IS NOT NULL
     AND coalesce(lane.screen_required,false)
     AND lane.route_path ~ '^/'
),
required_bound AS MATERIALIZED (
  SELECT DISTINCT upper(binding.process_code) AS process_code,
         upper(binding.step_code) AS step_code,
         upper(binding.audience) AS audience,
         lower(split_part(btrim(resource.route_key),'?',1)) AS route_path
    FROM public.framework_process_step_screen_binding binding
    JOIN public.framework_screen_resource resource
      ON resource.screen_resource_id=binding.screen_resource_id
   WHERE binding.binding_status='ACTIVE'
     AND nullif(btrim(binding.audience),'') IS NOT NULL
     AND btrim(resource.route_key) ~ '^/'
),
required_identity_all AS MATERIALIZED (
  SELECT process_code,step_code,audience,route_path,
         true AS from_direct,false AS from_active_binding
    FROM required_direct
  UNION ALL
  SELECT process_code,step_code,audience,route_path,
         false AS from_direct,true AS from_active_binding
    FROM required_bound
),
required_identity AS MATERIALIZED (
  SELECT required.process_code,required.step_code,required.audience,
         required.route_path,bool_or(required.from_direct) AS from_direct,
         bool_or(required.from_active_binding) AS from_active_binding
    FROM required_identity_all required
   CROSS JOIN audit_parameter parameter
   WHERE (parameter.process_code IS NULL
          OR required.process_code=parameter.process_code)
     AND (parameter.step_code IS NULL
          OR required.step_code=parameter.step_code)
     AND (parameter.audience IS NULL
          OR required.audience=parameter.audience)
     AND (parameter.route_path IS NULL
          OR required.route_path=parameter.route_path)
   GROUP BY required.process_code,required.step_code,required.audience,
            required.route_path
),
resource_row AS MATERIALIZED (
  SELECT resource.screen_resource_id,
         lower(split_part(btrim(resource.route_key),'?',1)) AS route_path,
         resource.implementation_status
    FROM public.framework_screen_resource resource
   WHERE btrim(resource.route_key) ~ '^/'
),
resource_rollup AS MATERIALIZED (
  SELECT route_path,count(*)::integer AS physical_count
    FROM resource_row
   GROUP BY route_path
),
contract_row AS MATERIALIZED (
  SELECT contract.contract_id,
         upper(contract.process_code) AS process_code,
         upper(contract.step_code) AS step_code,
         upper(contract.audience) AS audience,
         lower(split_part(btrim(contract.route_path),'?',1)) AS route_path,
         (
           contract.api_contract IS JSON ARRAY
           AND jsonb_array_length(contract.api_contract::jsonb)>0
           AND contract.data_contract IS JSON ARRAY
           AND jsonb_array_length(contract.data_contract::jsonb)>0
           AND contract.section_contract IS JSON ARRAY
           AND jsonb_array_length(contract.section_contract::jsonb)>0
           AND contract.field_contract IS JSON ARRAY
           AND jsonb_array_length(contract.field_contract::jsonb)>0
         ) AS complete_lanes,
         CASE WHEN contract.api_contract IS JSON ARRAY
              THEN jsonb_array_length(contract.api_contract::jsonb)
              ELSE 0 END AS endpoint_operation_count
    FROM public.framework_professional_screen_contract contract
),
contract_rollup AS MATERIALIZED (
  SELECT process_code,step_code,audience,route_path,
         count(*)::integer AS physical_count,
         count(*) FILTER(WHERE complete_lanes)::integer AS complete_lane_count,
         sum(endpoint_operation_count)::integer AS endpoint_operation_count
    FROM contract_row
   GROUP BY process_code,step_code,audience,route_path
),
contract_authority_reference AS MATERIALIZED (
  SELECT contract_id,process_code,step_code,audience,route_path,
         'professional_screen_contract:'||contract_id::text AS source_reference
    FROM contract_row
  UNION ALL
  SELECT contract_id,process_code,step_code,audience,route_path,
         'framework_professional_screen_contract:'||contract_id::text
    FROM contract_row
),
blueprint_source AS MATERIALIZED (
  SELECT blueprint.blueprint_id,
         upper(blueprint.process_code) AS process_code,
         upper(blueprint.step_code) AS step_code,
         upper(blueprint.audience) AS audience,
         lower(split_part(btrim(blueprint.route_path),'?',1)) AS route_path,
         blueprint.implementation_strategy,
         blueprint.generated_source_path,
         blueprint.template_code,
         blueprint.specification_json,
         blueprint.transition_status,
         lower(btrim(coalesce(blueprint.source_reference,''))) AS source_reference
    FROM public.framework_screen_blueprint blueprint
   WHERE blueprint.validation_status='VALID'
),
blueprint_row AS MATERIALIZED (
  SELECT blueprint.*,
         authority.contract_id IS NOT NULL AS explicit_contract_authority
    FROM blueprint_source blueprint
    LEFT JOIN contract_authority_reference authority
      ON blueprint.transition_status='CONTRACT_LINKED'
     AND authority.process_code=blueprint.process_code
     AND authority.step_code=blueprint.step_code
     AND authority.audience=blueprint.audience
     AND authority.route_path=blueprint.route_path
     AND authority.source_reference=blueprint.source_reference
),
blueprint_rollup AS MATERIALIZED (
  SELECT blueprint.process_code,blueprint.step_code,blueprint.audience,
         blueprint.route_path,
         count(*)::integer AS physical_count,
         count(DISTINCT blueprint.implementation_strategy)::integer AS strategy_count,
         count(*) FILTER(
           WHERE blueprint.implementation_strategy='GENERATED_RUNTIME'
         )::integer AS generated_runtime_count,
         count(*) FILTER(
           WHERE blueprint.implementation_strategy='ADOPT_EXISTING'
         )::integer AS adopt_existing_count,
         count(*) FILTER(
           WHERE blueprint.implementation_strategy NOT IN (
             'GENERATED_RUNTIME','ADOPT_EXISTING'
           )
         )::integer AS manual_strategy_count,
         count(*) FILTER(
           WHERE blueprint.generated_source_path IS NOT NULL
             AND btrim(blueprint.generated_source_path)<>''
         )::integer AS generated_source_path_count,
         count(*) FILTER(
           WHERE upper(blueprint.template_code) LIKE '%KRDS%'
              OR upper(blueprint.specification_json) LIKE '%KRDS%'
         )::integer AS krds_count,
         count(*) FILTER(
           WHERE upper(blueprint.template_code) LIKE '%SDUI%'
              OR upper(blueprint.specification_json) LIKE '%SDUI%'
              OR upper(blueprint.specification_json) LIKE '%JSON FORM%'
              OR upper(blueprint.specification_json) LIKE '%JSON_FORM%'
         )::integer AS sdui_count,
         count(*) FILTER(
           WHERE blueprint.explicit_contract_authority
         )::integer AS explicit_authority_count
         ,count(*) FILTER(
           WHERE blueprint.explicit_contract_authority
             AND blueprint.implementation_strategy='GENERATED_RUNTIME'
         )::integer AS explicit_generated_runtime_count
         ,count(*) FILTER(
           WHERE blueprint.explicit_contract_authority
             AND blueprint.implementation_strategy='ADOPT_EXISTING'
         )::integer AS explicit_adopt_existing_count
         ,count(*) FILTER(
           WHERE blueprint.explicit_contract_authority
             AND blueprint.implementation_strategy NOT IN (
               'GENERATED_RUNTIME','ADOPT_EXISTING'
             )
         )::integer AS explicit_manual_strategy_count
         ,count(*) FILTER(
           WHERE blueprint.explicit_contract_authority
             AND blueprint.generated_source_path IS NOT NULL
             AND btrim(blueprint.generated_source_path)<>''
         )::integer AS explicit_generated_source_path_count
         ,count(*) FILTER(
           WHERE blueprint.explicit_contract_authority
             AND (upper(blueprint.template_code) LIKE '%KRDS%'
               OR upper(blueprint.specification_json) LIKE '%KRDS%')
         )::integer AS explicit_krds_count
         ,count(*) FILTER(
           WHERE blueprint.explicit_contract_authority
             AND (upper(blueprint.template_code) LIKE '%SDUI%'
               OR upper(blueprint.specification_json) LIKE '%SDUI%'
               OR upper(blueprint.specification_json) LIKE '%JSON FORM%'
               OR upper(blueprint.specification_json) LIKE '%JSON_FORM%')
         )::integer AS explicit_sdui_count
    FROM blueprint_row blueprint
   GROUP BY blueprint.process_code,blueprint.step_code,blueprint.audience,
            blueprint.route_path
),
identity_status AS MATERIALIZED (
  SELECT required.process_code,required.step_code,required.audience,
         required.route_path,
         required.from_direct,required.from_active_binding,
         coalesce(resource.physical_count,0) AS resource_count,
         coalesce(contract.physical_count,0) AS contract_count,
         coalesce(contract.complete_lane_count,0) AS complete_lane_count,
         coalesce(contract.endpoint_operation_count,0) AS endpoint_operation_count,
         coalesce(blueprint.physical_count,0) AS blueprint_count,
         coalesce(blueprint.strategy_count,0) AS strategy_count,
         coalesce(blueprint.generated_runtime_count,0) AS generated_runtime_count,
         coalesce(blueprint.adopt_existing_count,0) AS adopt_existing_count,
         coalesce(blueprint.manual_strategy_count,0) AS manual_strategy_count,
         coalesce(blueprint.generated_source_path_count,0) AS generated_source_path_count,
         coalesce(blueprint.krds_count,0) AS krds_count,
         coalesce(blueprint.sdui_count,0) AS sdui_count,
         coalesce(blueprint.explicit_authority_count,0) AS explicit_authority_count,
         CASE
           WHEN coalesce(blueprint.physical_count,0)=1
             THEN coalesce(blueprint.generated_source_path_count,0)
           WHEN coalesce(blueprint.physical_count,0)>1
            AND coalesce(blueprint.explicit_authority_count,0)=1
             THEN coalesce(blueprint.explicit_generated_source_path_count,0)
           ELSE 0
         END AS canonical_generated_source_path_count,
         CASE
           WHEN coalesce(blueprint.physical_count,0)=1
             THEN coalesce(blueprint.krds_count,0)
           WHEN coalesce(blueprint.physical_count,0)>1
            AND coalesce(blueprint.explicit_authority_count,0)=1
             THEN coalesce(blueprint.explicit_krds_count,0)
           ELSE 0
         END AS canonical_krds_count,
         CASE
           WHEN coalesce(blueprint.physical_count,0)=1
             THEN coalesce(blueprint.sdui_count,0)
           WHEN coalesce(blueprint.physical_count,0)>1
            AND coalesce(blueprint.explicit_authority_count,0)=1
             THEN coalesce(blueprint.explicit_sdui_count,0)
           ELSE 0
         END AS canonical_sdui_count,
         (
           coalesce(blueprint.physical_count,0)=1
           OR (
             coalesce(blueprint.physical_count,0)>1
             AND coalesce(blueprint.explicit_authority_count,0)=1
           )
         ) AS blueprint_authority_resolved,
         CASE
           WHEN coalesce(blueprint.physical_count,0)=0 THEN 'UNCLASSIFIED'
           WHEN NOT (
             coalesce(blueprint.physical_count,0)=1
             OR (coalesce(blueprint.physical_count,0)>1
                 AND coalesce(blueprint.explicit_authority_count,0)=1)
           ) THEN 'AMBIGUOUS'
           WHEN (blueprint.physical_count=1
                 AND blueprint.generated_runtime_count=1)
             OR (blueprint.physical_count>1
                 AND blueprint.explicit_generated_runtime_count=1)
             THEN 'GENERATED'
           WHEN ((blueprint.physical_count=1
                  AND blueprint.adopt_existing_count=1)
                 OR (blueprint.physical_count>1
                     AND blueprint.explicit_adopt_existing_count=1))
                AND coalesce(contract.physical_count,0)>0 THEN 'HYBRID'
           ELSE 'MANUAL'
         END AS ownership_mode
    FROM required_identity required
    LEFT JOIN resource_rollup resource USING(route_path)
    LEFT JOIN contract_rollup contract
      USING(process_code,step_code,audience,route_path)
    LEFT JOIN blueprint_rollup blueprint
      USING(process_code,step_code,audience,route_path)
),
step_rollup AS MATERIALIZED (
  SELECT count(*)::integer AS total_step_count,
         count(*) FILTER(
           WHERE EXISTS (
             SELECT 1 FROM required_identity required
              WHERE required.process_code=upper(step.process_code)
                AND required.step_code=upper(step.step_code)
           )
         )::integer AS screen_required_step_count,
         count(*) FILTER(
           WHERE NOT EXISTS (
             SELECT 1 FROM required_identity required
              WHERE required.process_code=upper(step.process_code)
                AND required.step_code=upper(step.step_code)
           )
         )::integer AS steps_without_screen_requirement
    FROM public.framework_process_step step
   CROSS JOIN audit_parameter parameter
   WHERE (parameter.process_code IS NULL
          OR upper(step.process_code)=parameter.process_code)
     AND (parameter.step_code IS NULL
          OR upper(step.step_code)=parameter.step_code)
),
step_audience_route_rollup AS MATERIALIZED (
  SELECT process_code,step_code,audience,count(*)::integer AS route_count
    FROM required_identity
   GROUP BY process_code,step_code,audience
),
route_rollup AS MATERIALIZED (
  SELECT count(*)::integer AS physical_resource_rows,
         count(DISTINCT route_path)::integer AS normalized_route_count,
         count(*) FILTER(WHERE implementation_status='VERIFIED')::integer AS verified_rows,
         count(*) FILTER(WHERE implementation_status='IMPLEMENTED')::integer AS implemented_rows,
         count(*) FILTER(WHERE implementation_status='DESIGN_ONLY')::integer AS design_only_rows
    FROM resource_row
),
contract_global AS MATERIALIZED (
  SELECT count(*)::integer AS physical_rows,
         count(*) FILTER(WHERE physical_count=1)::integer AS logical_exact_groups,
         count(*) FILTER(WHERE physical_count>1)::integer AS duplicate_groups
    FROM contract_rollup
),
blueprint_global AS MATERIALIZED (
  SELECT (SELECT count(*) FROM public.framework_screen_blueprint)::integer AS physical_rows,
         count(*)::integer AS valid_logical_identities,
         coalesce(sum(physical_count),0)::integer AS valid_physical_rows,
         count(*) FILTER(WHERE physical_count>1)::integer AS duplicate_groups,
         coalesce(sum(generated_runtime_count),0)::integer AS generated_runtime_physical,
         coalesce(sum(adopt_existing_count),0)::integer AS adopt_existing_physical,
         coalesce(sum(manual_strategy_count),0)::integer AS manual_strategy_physical
    FROM blueprint_rollup
),
identity_rollup AS MATERIALIZED (
  SELECT count(*)::integer AS required_exact_identities,
         count(*) FILTER(WHERE from_direct)::integer AS direct_required_identities,
         count(*) FILTER(WHERE from_active_binding)::integer AS active_binding_identities,
         count(*) FILTER(
           WHERE from_direct AND from_active_binding
         )::integer AS direct_active_overlap_identities,
         count(*) FILTER(
           WHERE from_direct AND NOT from_active_binding
         )::integer AS direct_only_identities,
         count(*) FILTER(
           WHERE from_active_binding AND NOT from_direct
         )::integer AS active_binding_only_identities,
         count(*) FILTER(WHERE resource_count=1)::integer AS resource_exact,
         count(*) FILTER(WHERE resource_count=0)::integer AS resource_missing,
         count(*) FILTER(WHERE resource_count>1)::integer AS resource_duplicate_groups,
         count(*) FILTER(WHERE contract_count=1)::integer AS contract_exact,
         count(*) FILTER(WHERE contract_count>0)::integer AS contract_matched,
         count(*) FILTER(WHERE contract_count=0)::integer AS contract_missing,
         count(*) FILTER(WHERE contract_count>1)::integer AS contract_duplicate_groups,
         count(*) FILTER(WHERE blueprint_count=1)::integer AS blueprint_exact,
         count(*) FILTER(WHERE blueprint_count=0)::integer AS blueprint_missing,
         count(*) FILTER(WHERE blueprint_count>1)::integer AS blueprint_duplicate_groups,
         count(*) FILTER(
           WHERE blueprint_count>1 AND blueprint_authority_resolved
         )::integer AS blueprint_duplicate_authority_resolved,
         count(*) FILTER(
           WHERE blueprint_count>1 AND NOT blueprint_authority_resolved
         )::integer AS blueprint_duplicate_ambiguous,
         count(*) FILTER(
           WHERE contract_count>1
              OR (blueprint_count>1 AND NOT blueprint_authority_resolved)
              OR ownership_mode='AMBIGUOUS'
         )::integer AS ambiguous_identities,
         count(*) FILTER(WHERE ownership_mode='GENERATED')::integer AS generated_ownership,
         count(*) FILTER(WHERE ownership_mode='HYBRID')::integer AS hybrid_ownership,
         count(*) FILTER(WHERE ownership_mode='MANUAL')::integer AS manual_ownership,
         count(*) FILTER(WHERE ownership_mode='AMBIGUOUS')::integer AS ambiguous_ownership,
         count(*) FILTER(WHERE ownership_mode='UNCLASSIFIED')::integer AS unclassified_ownership,
         count(*) FILTER(
           WHERE resource_count=1 AND contract_count=1 AND blueprint_count=1
         )::integer AS exact_resource_contract_blueprint,
         count(*) FILTER(
           WHERE contract_count=1 AND complete_lane_count=1
             AND resource_count=1 AND blueprint_authority_resolved
         )::integer AS compiler_ready,
         count(*) FILTER(
           WHERE contract_count=1 AND complete_lane_count=1
             AND resource_count=1 AND blueprint_authority_resolved
         )::integer AS source_emitted_ready,
         count(*) FILTER(
           WHERE contract_count=1 AND complete_lane_count=1
             AND blueprint_authority_resolved
         )::integer AS source_catalog_eligible,
         count(*) FILTER(
           WHERE contract_count=1 AND complete_lane_count=1
             AND blueprint_authority_resolved
             AND canonical_generated_source_path_count>0
         )::integer AS generated_source_path_ready,
         count(*) FILTER(
           WHERE contract_count=1 AND endpoint_operation_count>0
         )::integer AS endpoint_expected_screens,
         coalesce(sum(endpoint_operation_count) FILTER(
           WHERE contract_count=1
         ),0)::integer AS endpoint_expected_operations,
         count(*) FILTER(WHERE canonical_krds_count>0)::integer AS krds_identities,
         count(*) FILTER(WHERE canonical_sdui_count>0)::integer AS sdui_identities,
         count(*) FILTER(
           WHERE resource_count<>1 OR contract_count<>1 OR complete_lane_count<>1
              OR NOT blueprint_authority_resolved
         )::integer AS incomplete_identities
    FROM identity_status
)
SELECT jsonb_build_object(
  'schema','carbonet.design-to-code-page-impact-db-core/v1',
  'identityContract',jsonb_build_object(
    'fields',jsonb_build_array('processCode','stepCode','audience','normalizedRoute'),
    'normalization','upper(process,step,audience)+lower(path-before-query)',
    'authoritativeSelection',
      'DIRECT_REQUIRED_USER_ADMIN_UNION_ACTIVE_SCREEN_BINDING'
  ),
  'routeTotals',jsonb_build_object(
    'screenResourcePhysicalRows',route.physical_resource_rows,
    'normalizedRouteCount',route.normalized_route_count,
    'verifiedRows',route.verified_rows,
    'implementedRows',route.implemented_rows,
    'designOnlyRows',route.design_only_rows
  ),
  'stepScreens',jsonb_build_object(
    'totalSteps',step.total_step_count,
    'stepsWithScreenRequirement',step.screen_required_step_count,
    'stepsWithoutScreenRequirement',step.steps_without_screen_requirement,
    'requiredExactIdentities',identity.required_exact_identities,
    'directRequiredExactIdentities',identity.direct_required_identities,
    'activeBindingExactIdentities',identity.active_binding_identities,
    'authoritativeUnionExactIdentities',identity.required_exact_identities,
    'directAndActiveOverlapExactIdentities',
      identity.direct_active_overlap_identities,
    'directOnlyExactIdentities',identity.direct_only_identities,
    'activeBindingOnlyExactIdentities',identity.active_binding_only_identities,
    'multiRouteStepAudienceGroups',(
      SELECT count(*)::integer FROM step_audience_route_rollup
       WHERE route_count>1
    ),
    'multiRouteStepAudienceExactIdentities',coalesce((
      SELECT sum(route_count)::integer FROM step_audience_route_rollup
       WHERE route_count>1
    ),0),
    'multiRouteAdditionalExactIdentities',coalesce((
      SELECT sum(route_count-1)::integer FROM step_audience_route_rollup
       WHERE route_count>1
    ),0)
  ),
  'screenResource',jsonb_build_object(
    'exactRequiredIdentities',identity.resource_exact,
    'missingRequiredIdentities',identity.resource_missing,
    'duplicateRequiredIdentityGroups',identity.resource_duplicate_groups
  ),
  'professionalContract',jsonb_build_object(
    'physicalRows',contract.physical_rows,
    'logicalExactGroups',contract.logical_exact_groups,
    'globalDuplicateGroups',contract.duplicate_groups,
    'targetExactIdentities',identity.required_exact_identities,
    'targetContractMatchedExactIdentities',identity.contract_matched,
    'targetContractMissingExactIdentities',identity.contract_missing,
    'exactRequiredIdentities',identity.contract_exact,
    'missingRequiredIdentities',identity.contract_missing,
    'duplicateRequiredIdentityGroups',identity.contract_duplicate_groups
  ),
  'blueprint',jsonb_build_object(
    'physicalRows',blueprint.physical_rows,
    'validPhysicalRows',blueprint.valid_physical_rows,
    'validLogicalIdentities',blueprint.valid_logical_identities,
    'globalDuplicateGroups',blueprint.duplicate_groups,
    'exactRequiredIdentities',identity.blueprint_exact,
    'missingRequiredIdentities',identity.blueprint_missing,
    'duplicateRequiredIdentityGroups',identity.blueprint_duplicate_groups,
    'duplicateAuthorityResolved',identity.blueprint_duplicate_authority_resolved,
    'duplicateAmbiguous',identity.blueprint_duplicate_ambiguous
  ),
  'strategy',jsonb_build_object(
    'generatedRuntimePhysicalRows',blueprint.generated_runtime_physical,
    'adoptExistingPhysicalRows',blueprint.adopt_existing_physical,
    'manualStrategyPhysicalRows',blueprint.manual_strategy_physical,
    'ownershipGeneratedExactIdentities',identity.generated_ownership,
    'ownershipHybridExactIdentities',identity.hybrid_ownership,
    'ownershipManualExactIdentities',identity.manual_ownership,
    'ownershipAmbiguousExactIdentities',identity.ambiguous_ownership,
    'ownershipUnclassifiedExactIdentities',identity.unclassified_ownership
  ),
  'source',jsonb_build_object(
    'compilerReadyExactIdentities',identity.compiler_ready,
    'emittedReadyExactIdentities',identity.source_emitted_ready,
    'sourceCatalogEligibleExactIdentities',identity.source_catalog_eligible,
    'generatedSourcePathReadyExactIdentities',identity.generated_source_path_ready
  ),
  'endpoint',jsonb_build_object(
    'expectedScreenIdentities',identity.endpoint_expected_screens,
    'expectedOperationCount',identity.endpoint_expected_operations
  ),
  'designSystem',jsonb_build_object(
    'krdsExactIdentities',identity.krds_identities,
    'sduiOrJsonFormExactIdentities',identity.sdui_identities
  ),
  'quality',jsonb_build_object(
    'exactResourceContractBlueprintIdentities',
      identity.exact_resource_contract_blueprint,
    'physicalSingleClosureExactIdentities',
      identity.exact_resource_contract_blueprint,
    'ambiguousExactIdentities',identity.ambiguous_identities,
    'incompleteExactIdentities',identity.incomplete_identities
  ),
  'designMutationImpact',jsonb_build_object(
    'scope',CASE
      WHEN parameter.process_code IS NOT NULL
       AND parameter.step_code IS NOT NULL
       AND parameter.audience IS NOT NULL
       AND parameter.route_path IS NOT NULL THEN 'SCREEN_IDENTITY_EXACT'
      WHEN parameter.route_path IS NOT NULL THEN 'ROUTE_FANOUT'
      WHEN parameter.step_code IS NOT NULL THEN 'STEP_AXIS'
      WHEN parameter.process_code IS NOT NULL THEN 'PROCESS_AXIS'
      WHEN parameter.audience IS NOT NULL THEN 'AUDIENCE_AXIS'
      ELSE 'ALL_COMPILER_READY_MAXIMUM' END,
    'selector',jsonb_strip_nulls(jsonb_build_object(
      'processCode',parameter.process_code,'stepCode',parameter.step_code,
      'audience',parameter.audience,'routePath',parameter.route_path
    )),
    'selectorMatchedExactIdentityCount',identity.required_exact_identities,
    'compilerAffectedExactIdentityCount',identity.compiler_ready,
    'sourceGenerationAffectedExactIdentityCount',identity.source_emitted_ready
  )
)
FROM route_rollup route
CROSS JOIN step_rollup step
CROSS JOIN contract_global contract
CROSS JOIN blueprint_global blueprint
CROSS JOIN identity_rollup identity
CROSS JOIN audit_parameter parameter;
