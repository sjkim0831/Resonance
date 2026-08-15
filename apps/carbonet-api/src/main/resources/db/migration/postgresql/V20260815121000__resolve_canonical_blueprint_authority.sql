-- Resolve legacy query-variant blueprint duplicates without choosing an
-- arbitrary surrogate id or timestamp. A normalized identity is compilable
-- when it has one VALID blueprint, or when exactly one duplicate explicitly
-- links the exact professional contract and is CONTRACT_LINKED. Every other
-- duplicate remains a fail-closed publication blocker.

DO $$
DECLARE compiler_owner name;
BEGIN
  SELECT pg_get_userbyid(proowner) INTO compiler_owner
    FROM pg_proc
   WHERE oid='public.framework_canonical_screen_design(character varying,character varying,character varying,character varying,jsonb)'::regprocedure;
  IF compiler_owner IS NULL OR compiler_owner<>current_user
     OR current_user='carbonet_app' THEN
    RAISE EXCEPTION
      'canonical blueprint authority migration role % does not own compiler (owner=%)',
      current_user,coalesce(compiler_owner::text,'MISSING')
      USING ERRCODE='42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_blueprint_authority(
  requested_process_code varchar,
  requested_step_code varchar,
  requested_audience varchar,
  requested_route_path varchar,
  requested_contract_id bigint
) RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  normalized_process varchar(80):=upper(btrim(requested_process_code));
  normalized_step varchar(100):=upper(btrim(requested_step_code));
  normalized_audience varchar(20):=upper(btrim(requested_audience));
  normalized_route varchar(400):=lower(split_part(btrim(requested_route_path),'?',1));
  source_count integer;
  linked_count integer;
  selected_blueprint_id bigint;
  sole_blueprint_id bigint;
BEGIN
  IF requested_contract_id IS NULL OR normalized_process=''
     OR normalized_step='' OR normalized_route='' OR normalized_route!~'^/'
     OR normalized_audience NOT IN ('USER','ADMIN') THEN
    RAISE EXCEPTION 'invalid canonical blueprint authority identity'
      USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(
       SELECT 1
         FROM public.framework_professional_screen_contract contract
        WHERE contract.contract_id=requested_contract_id
          AND upper(contract.process_code)=normalized_process
          AND upper(contract.step_code)=normalized_step
          AND upper(contract.audience)=normalized_audience
          AND lower(split_part(contract.route_path,'?',1))=normalized_route
     ) THEN
    RAISE EXCEPTION 'canonical professional contract does not match identity'
      USING ERRCODE='22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT blueprint.blueprint_id,
           blueprint.transition_status='CONTRACT_LINKED'
           AND lower(btrim(coalesce(blueprint.source_reference,'')))=ANY(ARRAY[
             'professional_screen_contract:'||requested_contract_id::text,
             'framework_professional_screen_contract:'||requested_contract_id::text
           ]) explicitly_linked
      FROM public.framework_screen_blueprint blueprint
     WHERE blueprint.validation_status='VALID'
       AND upper(blueprint.process_code)=normalized_process
       AND upper(blueprint.step_code)=normalized_step
       AND upper(blueprint.audience)=normalized_audience
       AND lower(split_part(blueprint.route_path,'?',1))=normalized_route
  )
  SELECT count(*)::integer,
         count(*) FILTER(WHERE explicitly_linked)::integer,
         min(blueprint_id) FILTER(WHERE explicitly_linked),
         CASE WHEN count(*)=1 THEN min(blueprint_id) END
    INTO source_count,linked_count,selected_blueprint_id,sole_blueprint_id
    FROM candidates;

  IF source_count=0 THEN
    RAISE EXCEPTION 'canonical blueprint authority has no VALID source'
      USING ERRCODE='P0002';
  END IF;
  IF source_count=1 THEN RETURN sole_blueprint_id; END IF;
  IF linked_count<>1 THEN
    RAISE EXCEPTION
      'canonical blueprint duplicate conflict for %|%|%|%: rows=%, explicitLinked=%',
      normalized_process,normalized_step,normalized_audience,normalized_route,
      source_count,linked_count
      USING ERRCODE='P0003';
  END IF;
  RETURN selected_blueprint_id;
END
$$;

COMMENT ON FUNCTION public.framework_canonical_blueprint_authority(
  varchar,varchar,varchar,varchar,bigint
) IS 'Returns one exact VALID blueprint; duplicate identities require exactly one CONTRACT_LINKED professional-contract source reference';

CREATE OR REPLACE FUNCTION public.framework_canonical_screen_design_exact(
  requested_blueprint_id bigint,
  requested_contract_id bigint,
  proposed_values jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  canonical_design jsonb;
  projected_source public.framework_professional_screen_contract%ROWTYPE;
BEGIN
  IF requested_blueprint_id IS NULL OR requested_contract_id IS NULL THEN
    RAISE EXCEPTION 'exact canonical screen source ids are required'
      USING ERRCODE='22023';
  END IF;

  SELECT (public.framework_project_professional_screen_contract(
           persisted,proposed_values
         )).*
    INTO STRICT projected_source
    FROM public.framework_professional_screen_contract persisted
   WHERE persisted.contract_id=requested_contract_id;

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
   WHERE b.blueprint_id=requested_blueprint_id
     AND b.validation_status='VALID'
     AND upper(b.process_code)=upper(projected_source.process_code)
     AND upper(b.step_code)=upper(projected_source.step_code)
     AND upper(b.audience)=upper(projected_source.audience)
     AND lower(split_part(b.route_path,'?',1))=
         lower(split_part(projected_source.route_path,'?',1));
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


COMMENT ON FUNCTION public.framework_canonical_screen_design_exact(
  bigint,bigint,jsonb
) IS 'Canonical compiler over one exact authority-resolved blueprint and professional contract pair';

CREATE OR REPLACE FUNCTION public.framework_canonical_screen_design(
  requested_process_code varchar,
  requested_step_code varchar,
  requested_audience varchar,
  requested_route_path varchar,
  proposed_values jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  normalized_process varchar(80):=upper(btrim(requested_process_code));
  normalized_step varchar(100):=upper(btrim(requested_step_code));
  normalized_audience varchar(20):=upper(btrim(requested_audience));
  normalized_route varchar(400):=lower(split_part(btrim(requested_route_path),'?',1));
  selected_contract_id bigint;
  selected_blueprint_id bigint;
BEGIN
  IF normalized_process='' OR normalized_step='' OR normalized_route=''
     OR normalized_route!~'^/' OR normalized_audience NOT IN ('USER','ADMIN') THEN
    RAISE EXCEPTION 'invalid canonical screen identity'
      USING ERRCODE='22023';
  END IF;
  SELECT contract.contract_id
    INTO STRICT selected_contract_id
    FROM public.framework_professional_screen_contract contract
   WHERE upper(contract.process_code)=normalized_process
     AND upper(contract.step_code)=normalized_step
     AND upper(contract.audience)=normalized_audience
     AND lower(split_part(contract.route_path,'?',1))=normalized_route;
  selected_blueprint_id:=public.framework_canonical_blueprint_authority(
    normalized_process,normalized_step,normalized_audience,normalized_route,
    selected_contract_id
  );
  RETURN public.framework_canonical_screen_design_exact(
    selected_blueprint_id,selected_contract_id,proposed_values
  );
END
$$;

-- Compile one row per normalized screen identity.  The original catalog
-- iterated physical blueprint rows, so an authority-resolvable query variant
-- was still compiled twice and could never agree with endpoint readiness.
CREATE OR REPLACE FUNCTION public.framework_canonical_design_catalog(
  requested_limit integer DEFAULT 5000
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  compilable_count integer;
  compiled_count integer;
  result jsonb;
BEGIN
  IF requested_limit IS NULL OR requested_limit<1 OR requested_limit>5000 THEN
    RAISE EXCEPTION 'canonical catalog limit must be between 1 and 5000'
      USING ERRCODE='22023';
  END IF;

  WITH blueprint_identities AS MATERIALIZED (
    SELECT upper(b.process_code) process_code,
           upper(b.step_code) step_code,
           upper(b.audience) audience,
           lower(split_part(b.route_path,'?',1)) route_path
      FROM public.framework_screen_blueprint b
     WHERE b.validation_status='VALID'
     GROUP BY upper(b.process_code),upper(b.step_code),upper(b.audience),
              lower(split_part(b.route_path,'?',1))
  ), contract_counts AS MATERIALIZED (
    SELECT upper(c.process_code) process_code,
           upper(c.step_code) step_code,
           upper(c.audience) audience,
           lower(split_part(c.route_path,'?',1)) route_path,
           count(*)::integer contract_count,
           count(*) FILTER (
             WHERE jsonb_array_length(
                     public.framework_strict_jsonb_array(c.api_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.data_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.section_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.field_contract))>0
           )::integer complete_lane_count
      FROM public.framework_professional_screen_contract c
     GROUP BY upper(c.process_code),upper(c.step_code),upper(c.audience),
              lower(split_part(c.route_path,'?',1))
  ), eligible AS MATERIALIZED (
    SELECT b.*
      FROM blueprint_identities b
      JOIN contract_counts c USING(process_code,step_code,audience,route_path)
     WHERE c.contract_count=1 AND c.complete_lane_count=1
  )
  SELECT count(*)::integer INTO compilable_count FROM eligible;

  IF compilable_count=0 THEN
    RAISE EXCEPTION 'canonical catalog has no compilable screens'
      USING ERRCODE='P0002';
  END IF;
  IF compilable_count>requested_limit THEN
    RAISE EXCEPTION 'canonical catalog has % compilable identities and exceeds limit %',
      compilable_count,requested_limit USING ERRCODE='54000';
  END IF;

  WITH blueprint_identities AS MATERIALIZED (
    SELECT upper(b.process_code) process_code,
           upper(b.step_code) step_code,
           upper(b.audience) audience,
           lower(split_part(b.route_path,'?',1)) route_path
      FROM public.framework_screen_blueprint b
     WHERE b.validation_status='VALID'
     GROUP BY upper(b.process_code),upper(b.step_code),upper(b.audience),
              lower(split_part(b.route_path,'?',1))
  ), contract_counts AS MATERIALIZED (
    SELECT upper(c.process_code) process_code,
           upper(c.step_code) step_code,
           upper(c.audience) audience,
           lower(split_part(c.route_path,'?',1)) route_path,
           count(*)::integer contract_count,
           count(*) FILTER (
             WHERE jsonb_array_length(
                     public.framework_strict_jsonb_array(c.api_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.data_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.section_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.field_contract))>0
           )::integer complete_lane_count
      FROM public.framework_professional_screen_contract c
     GROUP BY upper(c.process_code),upper(c.step_code),upper(c.audience),
              lower(split_part(c.route_path,'?',1))
  ), eligible AS MATERIALIZED (
    SELECT b.*
      FROM blueprint_identities b
      JOIN contract_counts c USING(process_code,step_code,audience,route_path)
     WHERE c.contract_count=1 AND c.complete_lane_count=1
  ), compiled AS MATERIALIZED (
    SELECT p.development_order,e.process_code,s.step_order,e.audience,
           e.route_path,e.step_code,
           e.process_code||'|'||e.step_code||'|'||e.audience||'|'||
             e.route_path screen_key,
           public.framework_canonical_screen_design(
             e.process_code,e.step_code,e.audience,e.route_path
           ) canonical_design
      FROM eligible e
      JOIN public.framework_process_definition p
        ON upper(p.process_code)=e.process_code
      JOIN public.framework_process_step s
        ON upper(s.process_code)=e.process_code
       AND upper(s.step_code)=e.step_code
  ), hashed AS MATERIALIZED (
    SELECT *,canonical_design#>>'{identity,blueprintCode}' blueprint_code,
           canonical_design::text canonical_text,
           encode(sha256(convert_to(canonical_design::text,'UTF8')),'hex')
             design_hash
      FROM compiled
  ), aggregate AS (
    SELECT count(*)::integer screen_count,
           encode(sha256(convert_to(string_agg(
             screen_key||E'\\x1f'||design_hash,E'\\n'
             ORDER BY development_order,process_code,step_order,
                      audience,route_path,blueprint_code
           ),'UTF8')),'hex') catalog_hash,
           jsonb_agg(jsonb_build_object(
             'screenKey',screen_key,
             'processCode',process_code,
             'stepCode',step_code,
             'audience',audience,
             'routePath',route_path,
             'designHash',design_hash,
             'canonicalText',canonical_text,
             'canonicalDesign',canonical_design
           ) ORDER BY development_order,process_code,step_order,
                      audience,route_path,blueprint_code) screens
      FROM hashed
  )
  SELECT screen_count,
         jsonb_build_object(
           'schema','carbonet.canonical-design/v1',
           'catalogHash',catalog_hash,
           'screenCount',screen_count,
           'screens',screens
         )
    INTO compiled_count,result
    FROM aggregate;
  IF compiled_count<>compilable_count THEN
    RAISE EXCEPTION 'canonical catalog compiled % of % eligible identities',
      compiled_count,compilable_count USING ERRCODE='55000';
  END IF;
  RETURN result;
END
$$;

COMMENT ON FUNCTION public.framework_canonical_design_catalog(integer)
  IS 'Compiles one deterministic authority-resolved screen per normalized eligible identity';

-- V20260813150000 renamed the SOURCE implementation.  Rebind it explicitly so
-- the full-stack process generator cannot retain the physical-row compiler
-- through the SOURCE branch while the global overload uses logical identities.
CREATE OR REPLACE FUNCTION public.framework_source_canonical_design_catalog(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  compilable_count integer;
  compiled_count integer;
  result jsonb;
BEGIN
  IF requested_limit IS NULL OR requested_limit<1 OR requested_limit>5000 THEN
    RAISE EXCEPTION 'canonical catalog limit must be between 1 and 5000'
      USING ERRCODE='22023';
  END IF;
  IF requested_process IS NULL
     OR requested_process !~ '^[A-Z][A-Z0-9_]{1,79}$' THEN
    RAISE EXCEPTION 'requested process must be an exact canonical CODE'
      USING ERRCODE='22023';
  END IF;

  WITH blueprint_identities AS MATERIALIZED (
    SELECT upper(b.process_code) process_code,
           upper(b.step_code) step_code,
           upper(b.audience) audience,
           lower(split_part(b.route_path,'?',1)) route_path
      FROM public.framework_screen_blueprint b
     WHERE b.validation_status='VALID'
       AND upper(b.process_code)=requested_process
     GROUP BY upper(b.process_code),upper(b.step_code),upper(b.audience),
              lower(split_part(b.route_path,'?',1))
  ), contract_counts AS MATERIALIZED (
    SELECT upper(c.process_code) process_code,
           upper(c.step_code) step_code,
           upper(c.audience) audience,
           lower(split_part(c.route_path,'?',1)) route_path,
           count(*)::integer contract_count,
           count(*) FILTER (
             WHERE jsonb_array_length(
                     public.framework_strict_jsonb_array(c.api_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.data_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.section_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.field_contract))>0
           )::integer complete_lane_count
      FROM public.framework_professional_screen_contract c
     WHERE upper(c.process_code)=requested_process
     GROUP BY upper(c.process_code),upper(c.step_code),upper(c.audience),
              lower(split_part(c.route_path,'?',1))
  ), eligible AS MATERIALIZED (
    SELECT b.*
      FROM blueprint_identities b
      JOIN contract_counts c USING(process_code,step_code,audience,route_path)
     WHERE c.contract_count=1 AND c.complete_lane_count=1
  )
  SELECT count(*)::integer INTO compilable_count FROM eligible;

  IF compilable_count=0 THEN
    RAISE EXCEPTION 'canonical catalog has no screens for process %',requested_process
      USING ERRCODE='P0002';
  END IF;
  IF compilable_count>requested_limit THEN
    RAISE EXCEPTION 'canonical process % has % logical screens and exceeds limit %',
      requested_process,compilable_count,requested_limit USING ERRCODE='54000';
  END IF;

  WITH blueprint_identities AS MATERIALIZED (
    SELECT upper(b.process_code) process_code,
           upper(b.step_code) step_code,
           upper(b.audience) audience,
           lower(split_part(b.route_path,'?',1)) route_path
      FROM public.framework_screen_blueprint b
     WHERE b.validation_status='VALID'
       AND upper(b.process_code)=requested_process
     GROUP BY upper(b.process_code),upper(b.step_code),upper(b.audience),
              lower(split_part(b.route_path,'?',1))
  ), contract_counts AS MATERIALIZED (
    SELECT upper(c.process_code) process_code,
           upper(c.step_code) step_code,
           upper(c.audience) audience,
           lower(split_part(c.route_path,'?',1)) route_path,
           count(*)::integer contract_count,
           count(*) FILTER (
             WHERE jsonb_array_length(
                     public.framework_strict_jsonb_array(c.api_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.data_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.section_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.field_contract))>0
           )::integer complete_lane_count
      FROM public.framework_professional_screen_contract c
     WHERE upper(c.process_code)=requested_process
     GROUP BY upper(c.process_code),upper(c.step_code),upper(c.audience),
              lower(split_part(c.route_path,'?',1))
  ), eligible AS MATERIALIZED (
    SELECT b.*
      FROM blueprint_identities b
      JOIN contract_counts c USING(process_code,step_code,audience,route_path)
     WHERE c.contract_count=1 AND c.complete_lane_count=1
  ), compiled AS MATERIALIZED (
    SELECT p.development_order,e.process_code,s.step_order,e.audience,
           e.route_path,e.step_code,
           e.process_code||'|'||e.step_code||'|'||e.audience||'|'||
             e.route_path screen_key,
           public.framework_canonical_screen_design(
             e.process_code,e.step_code,e.audience,e.route_path
           ) canonical_design
      FROM eligible e
      JOIN public.framework_process_definition p
        ON upper(p.process_code)=e.process_code
      JOIN public.framework_process_step s
        ON upper(s.process_code)=e.process_code
       AND upper(s.step_code)=e.step_code
  ), hashed AS MATERIALIZED (
    SELECT *,canonical_design#>>'{identity,blueprintCode}' blueprint_code,
           canonical_design::text canonical_text,
           encode(sha256(convert_to(canonical_design::text,'UTF8')),'hex')
             design_hash
      FROM compiled
  ), aggregate AS (
    SELECT count(*)::integer screen_count,
           encode(sha256(convert_to(string_agg(
             screen_key||E'\\x1f'||design_hash,E'\\n'
             ORDER BY development_order,process_code,step_order,
                      audience,route_path,blueprint_code
           ),'UTF8')),'hex') catalog_hash,
           jsonb_agg(jsonb_build_object(
             'screenKey',screen_key,
             'processCode',process_code,
             'stepCode',step_code,
             'audience',audience,
             'routePath',route_path,
             'designHash',design_hash,
             'canonicalText',canonical_text,
             'canonicalDesign',canonical_design
           ) ORDER BY development_order,process_code,step_order,
                      audience,route_path,blueprint_code) screens
      FROM hashed
  )
  SELECT screen_count,
         jsonb_build_object(
           'schema','carbonet.canonical-design/v1',
           'catalogHash',catalog_hash,
           'screenCount',screen_count,
           'screens',screens
         )
    INTO compiled_count,result
    FROM aggregate;
  IF compiled_count<>compilable_count THEN
    RAISE EXCEPTION 'canonical process % compiled % of % eligible identities',
      requested_process,compiled_count,compilable_count USING ERRCODE='55000';
  END IF;
  RETURN result;
END
$$;

COMMENT ON FUNCTION public.framework_source_canonical_design_catalog(
  integer,varchar
) IS 'SOURCE process catalog compiles only authority-resolved logical identities in the requested process';

-- The source endpoint gate must use the same logical-screen denominator as
-- the design catalog.  Resolvable duplicates count once; ambiguous duplicates
-- count once as a publication blocker and never enter eligible_screen_keys.
CREATE OR REPLACE FUNCTION public.framework_source_canonical_endpoint_readiness(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  design_catalog jsonb;
  source_design_count integer;
  canonical_screen_count integer;
  design_missing_count integer;
  design_blueprint_duplicate_count integer;
  design_contract_duplicate_count integer;
  design_incomplete_count integer;
  design_compiler_mismatch_count integer;
  design_blocker_count integer;
  eligible_screen_keys jsonb;
  total_count integer;
  source_ready_count integer;
  global_collision_count integer;
  blocker_count integer;
  reason_counts jsonb;
  result_status text;
BEGIN
  IF requested_limit IS NULL OR requested_limit<1 OR requested_limit>5000 THEN
    RAISE EXCEPTION 'canonical endpoint limit must be between 1 and 5000'
      USING ERRCODE='22023';
  END IF;
  IF requested_process IS NOT NULL
     AND requested_process !~ '^[A-Z][A-Z0-9_]{1,79}$' THEN
    RAISE EXCEPTION 'requested process must be an exact canonical CODE'
      USING ERRCODE='22023';
  END IF;

  WITH contract_counts AS MATERIALIZED (
    SELECT upper(c.process_code) process_code,
           upper(c.step_code) step_code,
           upper(c.audience) audience,
           lower(split_part(c.route_path,'?',1)) normalized_route,
           count(*)::integer contract_count,
           CASE WHEN count(*)=1 THEN min(c.contract_id) END contract_id,
           count(*) FILTER (
             WHERE jsonb_array_length(
                     public.framework_strict_jsonb_array(c.api_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.data_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.section_contract))>0
               AND jsonb_array_length(
                     public.framework_strict_jsonb_array(c.field_contract))>0
           )::integer complete_lane_count
      FROM public.framework_professional_screen_contract c
     WHERE requested_process IS NULL
        OR upper(c.process_code)=requested_process
     GROUP BY upper(c.process_code),upper(c.step_code),upper(c.audience),
              lower(split_part(c.route_path,'?',1))
  ), blueprint_rows AS MATERIALIZED (
    SELECT upper(b.process_code) process_code,
           upper(b.step_code) step_code,
           upper(b.audience) audience,
           lower(split_part(b.route_path,'?',1)) normalized_route,
           b.transition_status,b.source_reference,
           coalesce(c.contract_count,0) contract_count,c.contract_id,
           coalesce(c.complete_lane_count,0) complete_lane_count
      FROM public.framework_screen_blueprint b
      LEFT JOIN contract_counts c
        ON c.process_code=upper(b.process_code)
       AND c.step_code=upper(b.step_code)
       AND c.audience=upper(b.audience)
       AND c.normalized_route=lower(split_part(b.route_path,'?',1))
     WHERE b.validation_status='VALID'
       AND (requested_process IS NULL
            OR upper(b.process_code)=requested_process)
  ), logical_sources AS MATERIALIZED (
    SELECT process_code,step_code,audience,normalized_route,
           count(*)::integer blueprint_identity_count,
           max(contract_count)::integer contract_count,
           max(complete_lane_count)::integer complete_lane_count,
           count(*) FILTER (
             WHERE contract_id IS NOT NULL
               AND transition_status='CONTRACT_LINKED'
               AND lower(btrim(coalesce(source_reference,'')))=ANY(ARRAY[
                 'professional_screen_contract:'||contract_id::text,
                 'framework_professional_screen_contract:'||contract_id::text
               ])
           )::integer explicit_link_count
      FROM blueprint_rows
     GROUP BY process_code,step_code,audience,normalized_route
  ), scoped AS MATERIALIZED (
    SELECT *,
           blueprint_identity_count=1 OR (
             blueprint_identity_count>1 AND explicit_link_count=1
           ) authority_resolved
      FROM logical_sources
  )
  SELECT count(*)::integer,
         count(*) FILTER (
           WHERE authority_resolved AND contract_count=0
         )::integer,
         count(*) FILTER (WHERE NOT authority_resolved)::integer,
         count(*) FILTER (
           WHERE authority_resolved AND contract_count>1
         )::integer,
         count(*) FILTER (
           WHERE authority_resolved AND contract_count=1
             AND complete_lane_count<>1
         )::integer,
         coalesce(jsonb_agg(
           process_code||'|'||step_code||'|'||audience||'|'||normalized_route
         ) FILTER (
           WHERE authority_resolved AND contract_count=1
             AND complete_lane_count=1
         ),'[]'::jsonb)
    INTO source_design_count,design_missing_count,
         design_blueprint_duplicate_count,design_contract_duplicate_count,
         design_incomplete_count,eligible_screen_keys
    FROM scoped;

  BEGIN
    IF requested_process IS NULL THEN
      design_catalog:=public.framework_canonical_design_catalog(5000);
    ELSE
      design_catalog:=public.framework_source_canonical_design_catalog(
        5000,requested_process
      );
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0002' OR SQLSTATE 'P0003' THEN
    design_catalog:=jsonb_build_object(
      'schema','carbonet.canonical-design/v1','catalogHash',NULL,
      'screenCount',0,'screens','[]'::jsonb);
  END;

  WITH source AS MATERIALIZED (
    SELECT ordinal,screen,
           public.framework_canonical_endpoint_diagnostic(screen) diagnostic
      FROM jsonb_array_elements(design_catalog->'screens')
           WITH ORDINALITY source(screen,ordinal)
  ), ready_collision AS MATERIALIZED (
    SELECT ordinal,
           count(*) OVER (PARTITION BY diagnostic->>'operationId') operation_count,
           count(*) OVER (PARTITION BY diagnostic->>'artifactName') artifact_count,
           count(*) OVER (PARTITION BY diagnostic->>'routeSignature') route_count
      FROM source
     WHERE diagnostic->>'reason'='READY'
  ), classified AS MATERIALIZED (
    SELECT source.*,
           coalesce(ready_collision.operation_count,0) operation_count,
           coalesce(ready_collision.artifact_count,0) artifact_count,
           coalesce(ready_collision.route_count,0) route_count
      FROM source LEFT JOIN ready_collision USING(ordinal)
  ), scoped AS MATERIALIZED (
    SELECT * FROM classified
     WHERE requested_process IS NULL
        OR screen->>'processCode'=requested_process
  ), summary AS (
    SELECT count(*)::integer total_count,
           count(*) FILTER (
             WHERE diagnostic->>'reason'='READY'
           )::integer source_ready_count
      FROM scoped
  ), collision_summary AS (
    SELECT count(*) FILTER (
             WHERE operation_count>1 OR artifact_count>1 OR route_count>1
           )::integer global_collision_count
      FROM classified
     WHERE diagnostic->>'reason'='READY'
  ), reasons AS (
    SELECT reason,sum(reason_count)::integer reason_count
      FROM (
        SELECT diagnostic->>'reason' reason,count(*)::integer reason_count
          FROM scoped
         WHERE diagnostic->>'reason'<>'READY'
         GROUP BY diagnostic->>'reason'
        UNION ALL
        SELECT 'GLOBAL_OPERATION_ID_COLLISION',count(*)::integer
          FROM classified
         WHERE diagnostic->>'reason'='READY' AND operation_count>1
        UNION ALL
        SELECT 'GLOBAL_ARTIFACT_NAME_COLLISION',count(*)::integer
          FROM classified
         WHERE diagnostic->>'reason'='READY' AND artifact_count>1
        UNION ALL
        SELECT 'GLOBAL_ROUTE_COLLISION',count(*)::integer
          FROM classified
         WHERE diagnostic->>'reason'='READY' AND route_count>1
        UNION ALL
        SELECT 'EMPTY_SCOPE',1
         WHERE source_design_count=0 AND NOT EXISTS(SELECT 1 FROM scoped)
      ) reason_rows
     WHERE reason_count>0
     GROUP BY reason
  )
  SELECT summary.total_count,summary.source_ready_count,
         collision_summary.global_collision_count,
         coalesce((SELECT jsonb_object_agg(reason,reason_count ORDER BY reason)
                     FROM reasons),'{}'::jsonb)
    INTO total_count,source_ready_count,global_collision_count,reason_counts
    FROM summary,collision_summary;

  canonical_screen_count:=total_count;
  WITH expected AS MATERIALIZED (
    SELECT screen_key FROM jsonb_array_elements_text(eligible_screen_keys)
         expected(screen_key)
  ), actual AS MATERIALIZED (
    SELECT screen->>'screenKey' screen_key
      FROM jsonb_array_elements(design_catalog->'screens') actual(screen)
     WHERE requested_process IS NULL
        OR screen->>'processCode'=requested_process
  ), missing AS (
    SELECT screen_key FROM expected EXCEPT ALL SELECT screen_key FROM actual
  ), extra AS (
    SELECT screen_key FROM actual EXCEPT ALL SELECT screen_key FROM expected
  )
  SELECT (SELECT count(*) FROM missing)+(SELECT count(*) FROM extra)
    INTO design_compiler_mismatch_count;

  design_blocker_count:=design_missing_count+
    design_blueprint_duplicate_count+design_contract_duplicate_count+
    design_incomplete_count+design_compiler_mismatch_count;
  reason_counts:=reason_counts||jsonb_strip_nulls(jsonb_build_object(
    'DESIGN_CONTRACT_MISSING',
      CASE WHEN design_missing_count>0 THEN design_missing_count END,
    'DESIGN_BLUEPRINT_DUPLICATE',
      CASE WHEN design_blueprint_duplicate_count>0
           THEN design_blueprint_duplicate_count END,
    'DESIGN_CONTRACT_DUPLICATE',
      CASE WHEN design_contract_duplicate_count>0
           THEN design_contract_duplicate_count END,
    'DESIGN_LANES_INCOMPLETE',
      CASE WHEN design_incomplete_count>0 THEN design_incomplete_count END,
    'DESIGN_COMPILER_MISMATCH',
      CASE WHEN design_compiler_mismatch_count>0
           THEN design_compiler_mismatch_count END
  ));
  IF source_design_count>requested_limit THEN
    RAISE EXCEPTION 'canonical endpoint scope has % logical screens and exceeds limit %',
      source_design_count,requested_limit USING ERRCODE='54000';
  END IF;
  blocker_count:=design_blocker_count+(canonical_screen_count-source_ready_count)+
    global_collision_count;
  IF source_design_count=0 THEN blocker_count:=blocker_count+1; END IF;
  result_status:=CASE
    WHEN source_design_count>0
         AND design_blocker_count=0
         AND canonical_screen_count=source_design_count
         AND source_ready_count=canonical_screen_count
         AND global_collision_count=0 THEN 'COMPLETE'
    ELSE 'PARTIAL' END;
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-endpoint-readiness/v1',
    'authority','canonical-design-source-screens',
    'requestedProcess',requested_process,
    'totalCount',canonical_screen_count,
    'sourceDesignCount',source_design_count,
    'canonicalScreenCount',canonical_screen_count,
    'designBlockerCount',design_blocker_count,
    'sourceReadyCount',source_ready_count,
    'globalCollisionCount',global_collision_count,
    'blockerCount',blocker_count,
    'status',result_status,
    'reasonCounts',reason_counts
  );
END
$$;

COMMENT ON FUNCTION public.framework_source_canonical_endpoint_readiness(
  integer,varchar
) IS 'Endpoint gate over logical screen identities; process scope compiles and collision-checks only that process while global scope remains fail-closed';

-- Keep the generator catalog on the same scope used by readiness.  Otherwise
-- a process can pass its scoped gate and then be blocked while the catalog
-- recompiles an unrelated ambiguous process through the global overload.
CREATE OR REPLACE FUNCTION public.framework_source_canonical_endpoint_catalog(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  readiness jsonb;
  design_catalog jsonb;
  compiled_count integer;
  endpoints jsonb;
  catalog_hash text;
BEGIN
  readiness:=public.framework_source_canonical_endpoint_readiness(
    requested_limit,requested_process
  );
  IF readiness->>'status'<>'COMPLETE' THEN
    RAISE EXCEPTION 'canonical endpoint readiness is % (total=%, ready=%, blockers=%)',
      readiness->>'status',readiness->>'totalCount',
      readiness->>'sourceReadyCount',readiness->>'blockerCount'
      USING ERRCODE='P0002',DETAIL=readiness::text;
  END IF;
  IF requested_process IS NULL THEN
    design_catalog:=public.framework_canonical_design_catalog(5000);
  ELSE
    design_catalog:=public.framework_source_canonical_design_catalog(
      5000,requested_process
    );
  END IF;
  WITH source AS MATERIALIZED (
    SELECT ordinal,screen,
           public.framework_canonical_endpoint_diagnostic(screen) diagnostic
      FROM jsonb_array_elements(design_catalog->'screens')
           WITH ORDINALITY source(screen,ordinal)
     WHERE requested_process IS NULL
        OR screen->>'processCode'=requested_process
  ), contract_rows AS MATERIALIZED (
    SELECT ordinal,screen,
           jsonb_build_object(
             'screenKey',screen->>'screenKey',
             'routePath',screen->>'routePath',
             'audience',screen->>'audience',
             'source',jsonb_build_object(
               'schema','carbonet.canonical-design/v1',
               'designHash',screen->>'designHash'),
             'operations',jsonb_build_array(diagnostic->'operation')
           ) endpoint_contract
      FROM source
  ), text_rows AS MATERIALIZED (
    SELECT *,endpoint_contract::text endpoint_text FROM contract_rows
  ), endpoint_rows AS MATERIALIZED (
    SELECT *,encode(sha256(convert_to(endpoint_text,'UTF8')),'hex') endpoint_hash
      FROM text_rows
  )
  SELECT count(*)::integer,
         jsonb_agg(jsonb_build_object(
           'screenKey',screen->>'screenKey',
           'routePath',screen->>'routePath',
           'audience',screen->>'audience',
           'designHash',screen->>'designHash',
           'canonicalText',screen->>'canonicalText',
           'endpointHash',endpoint_hash,
           'endpointText',endpoint_text,
           'endpointContract',endpoint_contract
         ) ORDER BY ordinal),
         encode(sha256(convert_to(string_agg(
           (screen->>'screenKey')||E'\\x1f'||endpoint_hash,E'\\n'
           ORDER BY ordinal
         ),'UTF8')),'hex')
    INTO compiled_count,endpoints,catalog_hash
    FROM endpoint_rows;
  IF compiled_count<>(readiness->>'totalCount')::integer THEN
    RAISE EXCEPTION 'endpoint compiler produced % of % ready screens',
      compiled_count,readiness->>'totalCount' USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-endpoint-catalog/v1',
    'catalogHash',catalog_hash,'endpoints',endpoints
  );
END
$$;

COMMENT ON FUNCTION public.framework_source_canonical_endpoint_catalog(
  integer,varchar
) IS 'SOURCE endpoint generator catalog uses process-local logical authority when a process is requested and global fail-closed authority otherwise';

REVOKE ALL ON FUNCTION public.framework_canonical_blueprint_authority(
  varchar,varchar,varchar,varchar,bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_screen_design_exact(
  bigint,bigint,jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_source_canonical_design_catalog(
  integer,varchar
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_readiness(
  integer,varchar
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_catalog(
  integer,varchar
) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON FUNCTION public.framework_canonical_screen_design_exact(
      bigint,bigint,jsonb
    ) FROM carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_blueprint_authority(
      varchar,varchar,varchar,varchar,bigint
    ) TO carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_source_canonical_design_catalog(
      integer,varchar
    ) FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_readiness(
      integer,varchar
    ) FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_catalog(
      integer,varchar
    ) FROM carbonet_app;
  END IF;
END
$$;

DO $$
DECLARE source_api oid;
BEGIN
  FOREACH source_api IN ARRAY ARRAY[
    to_regprocedure('public.framework_source_canonical_design_catalog(integer,character varying)'),
    to_regprocedure('public.framework_source_canonical_endpoint_readiness(integer,character varying)'),
    to_regprocedure('public.framework_source_canonical_endpoint_catalog(integer,character varying)')
  ] LOOP
    IF source_api IS NULL OR EXISTS(
      SELECT 1 FROM pg_proc function_row
      CROSS JOIN LATERAL aclexplode(
        coalesce(function_row.proacl,acldefault('f',function_row.proowner))) acl
       WHERE function_row.oid=source_api
         AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
    ) OR (EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app')
      AND has_function_privilege('carbonet_app',source_api,'EXECUTE')) THEN
      RAISE EXCEPTION 'SOURCE canonical compiler ACL is not private: %',source_api
        USING ERRCODE='42501';
    END IF;
  END LOOP;
END
$$;
