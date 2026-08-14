-- Make professional screen previews compile the same canonical bundle that a
-- subsequent save/publish compiles, without updating the live design row.
-- The 4-argument API remains backward compatible and delegates to an empty
-- projection, so all callers share one compiler after this migration.

-- Read-only professional screen contract projection.  The persisted row is
-- never mutated: only a composite value is overlaid and passed to the canonical
-- compiler used by both preview and publish.
CREATE OR REPLACE FUNCTION framework_project_professional_screen_contract(
  persisted public.framework_professional_screen_contract,
  proposed jsonb
) RETURNS public.framework_professional_screen_contract
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  allowed_keys constant text[] := ARRAY[
    'businessPurpose','entryCondition','exitCondition','sectionContract',
    'fieldContract','commandContract','stateContract','apiContract',
    'dataContract','evidenceContract','responsiveContract',
    'accessibilityContract','securityContract','apiVerified',
    'databaseVerified','authorityVerified','responsiveVerified',
    'accessibilityVerified','exceptionStatesVerified','auditEvidenceRef',
    'contractStatus'
  ];
  boolean_keys constant text[] := ARRAY[
    'apiVerified','databaseVerified','authorityVerified',
    'responsiveVerified','accessibilityVerified','exceptionStatesVerified'
  ];
  contract_statuses constant text[] := ARRAY[
    'DRAFT','REVIEW_REQUIRED','DESIGN_COMPLETE','APPROVED','VERIFIED'
  ];
  json_array_keys constant text[] := ARRAY[
    'sectionContract','fieldContract','commandContract','stateContract',
    'apiContract','dataContract','evidenceContract'
  ];
  unsupported text[];
  malformed text[];
  overlay jsonb;
BEGIN
  IF persisted IS NULL THEN
    RAISE EXCEPTION 'professional screen contract projection source is required'
      USING ERRCODE='22023';
  END IF;
  IF proposed IS NULL OR jsonb_typeof(proposed)<>'object' THEN
    RAISE EXCEPTION 'professional screen contract projection must be a JSON object'
      USING ERRCODE='22023';
  END IF;
  SELECT array_agg(key ORDER BY key)
    INTO unsupported
    FROM jsonb_object_keys(proposed) key
   WHERE NOT key=ANY(allowed_keys);
  IF unsupported IS NOT NULL THEN
    RAISE EXCEPTION 'unsupported professional screen projection fields: %',
      array_to_string(unsupported,', ')
      USING ERRCODE='22023';
  END IF;
  SELECT array_agg(entry.key ORDER BY entry.key)
    INTO malformed
    FROM jsonb_each(proposed) entry
   WHERE entry.value='null'::jsonb
      OR (entry.key=ANY(boolean_keys) AND jsonb_typeof(entry.value)<>'boolean')
      OR (NOT entry.key=ANY(boolean_keys) AND jsonb_typeof(entry.value)<>'string')
      OR (entry.key=ANY(json_array_keys) AND (
            jsonb_typeof(entry.value)<>'string'
            OR public.framework_strict_jsonb_array(entry.value#>>'{}') IS NULL
          ));
  IF malformed IS NOT NULL THEN
    RAISE EXCEPTION 'malformed professional screen projection fields: %',
      array_to_string(malformed,', ')
      USING ERRCODE='22023';
  END IF;
  IF proposed ? 'contractStatus'
     AND NOT (proposed->>'contractStatus'=ANY(contract_statuses)) THEN
    RAISE EXCEPTION 'unsupported professional screen projection contractStatus: %',
      proposed->>'contractStatus'
      USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_object_agg(
           CASE entry.key
             WHEN 'businessPurpose' THEN 'business_purpose'
             WHEN 'entryCondition' THEN 'entry_condition'
             WHEN 'exitCondition' THEN 'exit_condition'
             WHEN 'sectionContract' THEN 'section_contract'
             WHEN 'fieldContract' THEN 'field_contract'
             WHEN 'commandContract' THEN 'command_contract'
             WHEN 'stateContract' THEN 'state_contract'
             WHEN 'apiContract' THEN 'api_contract'
             WHEN 'dataContract' THEN 'data_contract'
             WHEN 'evidenceContract' THEN 'evidence_contract'
             WHEN 'responsiveContract' THEN 'responsive_contract'
             WHEN 'accessibilityContract' THEN 'accessibility_contract'
             WHEN 'securityContract' THEN 'security_contract'
             WHEN 'apiVerified' THEN 'api_verified'
             WHEN 'databaseVerified' THEN 'database_verified'
             WHEN 'authorityVerified' THEN 'authority_verified'
             WHEN 'responsiveVerified' THEN 'responsive_verified'
             WHEN 'accessibilityVerified' THEN 'accessibility_verified'
             WHEN 'exceptionStatesVerified' THEN 'exception_states_verified'
             WHEN 'auditEvidenceRef' THEN 'audit_evidence_ref'
             WHEN 'contractStatus' THEN 'contract_status'
           END,
           entry.value
         ),'{}'::jsonb)
    INTO overlay
    FROM jsonb_each(proposed) entry;
  RETURN jsonb_populate_record(persisted,overlay);
END
$$;

COMMENT ON FUNCTION framework_project_professional_screen_contract(
  public.framework_professional_screen_contract,jsonb
) IS 'Pure camelCase-to-column projection used by canonical preview compilation; rejects identity, null, type and JSON-array drift';

CREATE OR REPLACE FUNCTION framework_canonical_screen_design(
  requested_process_code varchar,
  requested_step_code varchar,
  requested_audience varchar,
  requested_route_path varchar,
  proposed_values jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  normalized_process varchar(80) := upper(btrim(requested_process_code));
  normalized_step varchar(100) := upper(btrim(requested_step_code));
  normalized_audience varchar(20) := upper(btrim(requested_audience));
  normalized_route varchar(400) := lower(split_part(btrim(requested_route_path),'?',1));
  canonical_design jsonb;
  projected_source public.framework_professional_screen_contract%ROWTYPE;
BEGIN
  IF normalized_process='' OR normalized_step='' OR normalized_route=''
     OR normalized_route !~ '^/'
     OR normalized_audience NOT IN ('USER','ADMIN') THEN
    RAISE EXCEPTION 'invalid canonical screen identity'
      USING ERRCODE='22023';
  END IF;

  SELECT (public.framework_project_professional_screen_contract(
           persisted,proposed_values
         )).*
    INTO STRICT projected_source
    FROM public.framework_professional_screen_contract persisted
   WHERE upper(persisted.process_code)=normalized_process
     AND upper(persisted.step_code)=normalized_step
     AND upper(persisted.audience)=normalized_audience
     AND lower(split_part(persisted.route_path,'?',1))=normalized_route;

  SELECT jsonb_build_object(
    'identity',jsonb_build_object(
      'screenKey',upper(b.process_code)||'|'||upper(b.step_code)||'|'||
                  upper(b.audience)||'|'||lower(split_part(b.route_path,'?',1)),
      'blueprintCode',b.blueprint_code,
      'processCode',upper(b.process_code),
      'stepCode',upper(b.step_code),
      'audience',upper(b.audience),
      'routePath',lower(split_part(b.route_path,'?',1)),
      'pageId',b.page_id,
      'actorCode',upper(b.actor_code)
    ),
    'process',jsonb_build_object(
      'processName',p.process_name,
      'domainCode',p.domain_code,
      'processVersion',p.process_version,
      'goal',p.goal,
      'startCondition',p.start_condition,
      'completionCondition',p.completion_condition,
      'ownerActorCode',coalesce(p.owner_actor_code,''),
      'riskLevel',p.risk_level,
      'slaHours',p.sla_hours,
      'lifecycleStatus',p.lifecycle_status
    ),
    'step',jsonb_build_object(
      'stepName',s.step_name,
      'stepOrder',s.step_order,
      'stepType',s.step_type,
      'actorCode',s.actor_code,
      'fromState',s.from_state,
      'commandCode',s.command_code,
      'toState',s.to_state,
      'requirement',s.requirement_text,
      'completionRule',s.completion_rule,
      'inputContract',public.framework_try_jsonb(s.input_contract,'{}'::jsonb),
      'outputContract',public.framework_try_jsonb(s.output_contract,'{}'::jsonb),
      'evidenceRequired',s.evidence_required,
      'evidenceTypes',s.evidence_types,
      'segregationActorCodes',s.segregation_actor_codes,
      'rollbackCommandCode',s.rollback_command_code,
      'decisionRule',s.decision_rule
    ),
    'lanes',jsonb_build_object(
      'HELP',jsonb_build_object(
        'title',projected_source.screen_name,
        'summary',projected_source.business_purpose,
        'entryCondition',projected_source.entry_condition,
        'exitCondition',projected_source.exit_condition,
        'exceptionStates',public.framework_try_jsonb(projected_source.state_contract),
        'evidence',public.framework_try_jsonb(projected_source.evidence_contract),
        'items',(
          SELECT jsonb_agg(jsonb_build_object(
            'id',lower(source_kind)||'-'||lpad(ordinality::text,3,'0'),
            'title',case jsonb_typeof(contract)
              when 'string' then contract#>>'{}'
              when 'object' then coalesce(
                contract->>'title',contract->>'label',contract->>'name',
                source_kind||' '||ordinality::text)
              else source_kind||' '||ordinality::text end,
            'body',case jsonb_typeof(contract)
              when 'string' then contract#>>'{}'
              else contract::text end,
            'anchorSelector','[data-help-id="generated-'||
              trim(both '-' from regexp_replace(
                lower(b.page_id),'[^a-z0-9]+','-','g'
              ))||'-'||lower(source_kind)||'-'||
              lpad(ordinality::text,3,'0')||'"]'
          ) ORDER BY source_order,ordinality)
          FROM (
            SELECT 0 source_order,'SECTION'::text source_kind,section.ordinality,
                   section.contract
              FROM jsonb_array_elements(
                     public.framework_strict_jsonb_array(projected_source.section_contract)
                   ) WITH ORDINALITY section(contract,ordinality)
            UNION ALL
            SELECT 1,'FIELD',field.ordinality,field.contract
              FROM jsonb_array_elements(
                     public.framework_strict_jsonb_array(projected_source.field_contract)
                   ) WITH ORDINALITY field(contract,ordinality)
          ) help_item
        )
      ),
      'WORK_GUIDE',jsonb_build_object(
        'processCode',upper(b.process_code),
        'stepCode',upper(b.step_code),
        'stepOrder',s.step_order,
        'actorCode',s.actor_code,
        'requirement',s.requirement_text,
        'fromState',s.from_state,
        'commandCode',s.command_code,
        'toState',s.to_state,
        'completionRule',s.completion_rule,
        'inputContract',public.framework_try_jsonb(s.input_contract,'{}'::jsonb),
        'outputContract',public.framework_try_jsonb(s.output_contract,'{}'::jsonb),
        'steps',jsonb_build_array(jsonb_build_object(
          'order',s.step_order,
          'code',upper(s.step_code),
          'name',s.step_name,
          'actorCode',s.actor_code,
          'fromState',s.from_state,
          'commandCode',s.command_code,
          'toState',s.to_state,
          'completionRule',s.completion_rule
        )),
        'nextAction',jsonb_build_object(
          'commandCode',s.command_code,
          'label',s.command_code,
          'toState',s.to_state,
          'completionRule',s.completion_rule,
          'routePath',lower(split_part(b.route_path,'?',1))
        )
      ),
      'QA',jsonb_build_object(
        'validationStatus',b.validation_status,
        'contractStatus',projected_source.contract_status,
        'requiredScenarioTypes',jsonb_build_array(
          'HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'
        ),
        'traceability',public.framework_try_jsonb(b.traceability_json,'{}'::jsonb),
        'evidence',public.framework_try_jsonb(projected_source.evidence_contract),
        'apiVerified',projected_source.api_verified,
        'databaseVerified',projected_source.database_verified,
        'authorityVerified',projected_source.authority_verified,
        'responsiveVerified',projected_source.responsive_verified,
        'accessibilityVerified',projected_source.accessibility_verified,
        'exceptionStatesVerified',projected_source.exception_states_verified,
        'auditEvidenceRef',projected_source.audit_evidence_ref,
        'checks',jsonb_build_array(
          jsonb_build_object('code','API_CONTRACT','passed',projected_source.api_verified),
          jsonb_build_object('code','DATABASE_PERSISTENCE','passed',projected_source.database_verified),
          jsonb_build_object('code','ACTOR_AUTHORITY','passed',projected_source.authority_verified),
          jsonb_build_object('code','RESPONSIVE','passed',projected_source.responsive_verified),
          jsonb_build_object('code','ACCESSIBILITY','passed',projected_source.accessibility_verified),
          jsonb_build_object('code','EXCEPTION_STATES','passed',projected_source.exception_states_verified)
        )
      ),
      'DESIGN_CARD',jsonb_build_object(
        'designSystem','KRDS',
        'pageId',b.page_id,
        'pageName',b.page_name,
        'screenType',b.screen_type,
        'templateCode',b.template_code,
        'specification',public.framework_try_jsonb(b.specification_json,'{}'::jsonb),
        'traceability',public.framework_try_jsonb(b.traceability_json,'{}'::jsonb),
        'sections',public.framework_try_jsonb(projected_source.section_contract),
        'assetBindings',case
          when jsonb_typeof(public.framework_try_jsonb(b.specification_json,'{}'::jsonb)
                            ->'assetBindings')='array'
               and jsonb_array_length(
                 public.framework_try_jsonb(b.specification_json,'{}'::jsonb)
                 ->'assetBindings'
               )>0
          then (
            SELECT jsonb_agg(jsonb_build_object(
              'assetType',upper(coalesce(
                nullif(asset->>'assetType',''),
                nullif(asset->>'type',''),
                'COMPONENT'
              )),
              'assetCode',coalesce(
                nullif(asset->>'assetCode',''),
                nullif(asset->>'asset',''),
                nullif(asset->>'registryKey',''),
                upper(b.template_code)||':COMPONENT:'||
                  lpad(ordinality::text,3,'0')
              ),
              'slot',coalesce(
                nullif(asset->>'slot',''),
                'component-'||lpad(ordinality::text,3,'0')
              ),
              'registryKey',coalesce(
                nullif(asset->>'registryKey',''),
                nullif(asset->>'assetCode',''),
                nullif(asset->>'asset',''),
                upper(b.template_code)||':COMPONENT:'||
                  lpad(ordinality::text,3,'0')
              )
            ) ORDER BY ordinality)
              FROM jsonb_array_elements(
                public.framework_try_jsonb(b.specification_json,'{}'::jsonb)
                ->'assetBindings'
              ) WITH ORDINALITY explicit_asset(asset,ordinality)
          )
          else (
            SELECT jsonb_agg(jsonb_build_object(
              'assetType',source_kind,
              'assetCode',upper(b.template_code)||':'||
                          upper(source_kind)||':'||lpad(ordinality::text,3,'0'),
              'slot',lower(source_kind)||'-'||lpad(ordinality::text,3,'0'),
              'registryKey',upper(b.template_code)||':'||
                            upper(source_kind)||':'||lpad(ordinality::text,3,'0')
            ) ORDER BY source_order,ordinality)
            FROM (
              SELECT 0 source_order,'SECTION'::text source_kind,section.ordinality,
                     section.contract
                FROM jsonb_array_elements(
                       public.framework_strict_jsonb_array(projected_source.section_contract)
                     ) WITH ORDINALITY section(contract,ordinality)
              UNION ALL
              SELECT 1,'COMPONENT',field.ordinality,field.contract
                FROM jsonb_array_elements(
                       public.framework_strict_jsonb_array(projected_source.field_contract)
                     ) WITH ORDINALITY field(contract,ordinality)
            ) derived_asset
          ) end,
        'responsive',projected_source.responsive_contract,
        'accessibility',projected_source.accessibility_contract,
        'security',projected_source.security_contract
      ),
      'FRONTEND',jsonb_build_object(
        'routePath',lower(split_part(b.route_path,'?',1)),
        'pageId',b.page_id,
        'screenType',b.screen_type,
        'templateCode',b.template_code,
        'sections',public.framework_try_jsonb(projected_source.section_contract),
        'fields',public.framework_try_jsonb(projected_source.field_contract),
        'actions',public.framework_try_jsonb(projected_source.command_contract),
        'states',public.framework_try_jsonb(projected_source.state_contract),
        'responsive',projected_source.responsive_contract,
        'accessibility',projected_source.accessibility_contract
      ),
      'API',public.framework_strict_jsonb_array(projected_source.api_contract),
      'DATABASE',public.framework_strict_jsonb_array(projected_source.data_contract)
    )
  )
    INTO STRICT canonical_design
    FROM public.framework_screen_blueprint b
    JOIN public.framework_process_definition p
      ON p.process_code=b.process_code
    JOIN public.framework_process_step s
      ON s.process_code=b.process_code AND s.step_code=b.step_code
   WHERE b.validation_status='VALID'
     AND upper(b.process_code)=normalized_process
     AND upper(b.step_code)=normalized_step
     AND upper(b.audience)=normalized_audience
     AND lower(split_part(b.route_path,'?',1))=normalized_route;
  IF (SELECT array_agg(key ORDER BY key)
        FROM jsonb_object_keys(canonical_design) key)
       <>ARRAY['identity','lanes','process','step']
     OR jsonb_typeof(canonical_design->'identity')<>'object'
     OR jsonb_typeof(canonical_design->'process')<>'object'
     OR jsonb_typeof(canonical_design->'step')<>'object'
     OR jsonb_typeof(canonical_design->'lanes')<>'object'
     OR (SELECT array_agg(key ORDER BY key)
           FROM jsonb_object_keys(canonical_design->'lanes') key)
          <>ARRAY['API','DATABASE','DESIGN_CARD','FRONTEND','HELP','QA','WORK_GUIDE']
     OR jsonb_typeof(canonical_design#>'{lanes,HELP}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,WORK_GUIDE}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,QA}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,DESIGN_CARD}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,FRONTEND}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,API}')<>'array'
     OR jsonb_array_length(canonical_design#>'{lanes,API}')=0
     OR jsonb_typeof(canonical_design#>'{lanes,DATABASE}')<>'array'
     OR jsonb_array_length(canonical_design#>'{lanes,DATABASE}')=0
     OR jsonb_typeof(canonical_design#>'{lanes,HELP,items}')<>'array'
     OR jsonb_array_length(canonical_design#>'{lanes,HELP,items}')=0
     OR jsonb_typeof(canonical_design#>'{lanes,WORK_GUIDE,steps}')<>'array'
     OR jsonb_array_length(canonical_design#>'{lanes,WORK_GUIDE,steps}')=0
     OR jsonb_typeof(canonical_design#>'{lanes,WORK_GUIDE,nextAction}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,QA,requiredScenarioTypes}')<>'array'
     OR jsonb_array_length(canonical_design#>'{lanes,QA,requiredScenarioTypes}')<>5
     OR jsonb_typeof(canonical_design#>'{lanes,QA,checks}')<>'array'
     OR jsonb_array_length(canonical_design#>'{lanes,QA,checks}')=0
     OR jsonb_typeof(canonical_design#>'{lanes,DESIGN_CARD,specification}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,DESIGN_CARD,traceability}')<>'object'
     OR jsonb_typeof(canonical_design#>'{lanes,DESIGN_CARD,assetBindings}')<>'array'
     OR jsonb_array_length(
          canonical_design#>'{lanes,DESIGN_CARD,assetBindings}'
        )=0
     OR (
       (canonical_design#>'{lanes,DESIGN_CARD,specification}') ? 'assetBindings'
       AND jsonb_typeof(
         canonical_design#>'{lanes,DESIGN_CARD,specification,assetBindings}'
       )<>'array'
     ) THEN
    RAISE EXCEPTION 'canonical screen % lane contract is incomplete or malformed',
      canonical_design#>>'{identity,screenKey}' USING ERRCODE='22023';
  END IF;
  RETURN canonical_design;
END
$$;

CREATE OR REPLACE FUNCTION framework_canonical_screen_design(
  requested_process_code varchar,
  requested_step_code varchar,
  requested_audience varchar,
  requested_route_path varchar
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_canonical_screen_design($1,$2,$3,$4,'{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION framework_canonical_screen_bundle(
  process_code varchar,
  step_code varchar,
  audience varchar,
  route_path varchar,
  proposed_values jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  canonical_design jsonb;
  canonical_text text;
  design_hash text;
  published_catalog_hash text;
BEGIN
  canonical_design:=public.framework_canonical_screen_design(
    process_code,step_code,audience,route_path,proposed_values
  );
  canonical_text:=canonical_design::text;
  design_hash:=encode(sha256(convert_to(canonical_text,'UTF8')),'hex');
  published_catalog_hash:=
    public.framework_latest_canonical_design_release_hash(
      canonical_design#>>'{identity,screenKey}',design_hash
    );
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-design/v1',
    'catalogHash',published_catalog_hash,
    'designHash',design_hash,
    'canonicalText',canonical_text,
    'canonicalDesign',canonical_design
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_canonical_screen_bundle(
  process_code varchar,
  step_code varchar,
  audience varchar,
  route_path varchar
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_canonical_screen_bundle($1,$2,$3,$4,'{}'::jsonb)
$$;

COMMENT ON FUNCTION framework_canonical_screen_design(
  varchar,varchar,varchar,varchar,jsonb
) IS 'Side-effect-free canonical compiler over a validated professional-contract projection';
COMMENT ON FUNCTION framework_canonical_screen_bundle(
  varchar,varchar,varchar,varchar,jsonb
) IS 'Projected canonical bundle; hashes exactly the proposed design and resolves immutable release membership without DML';
