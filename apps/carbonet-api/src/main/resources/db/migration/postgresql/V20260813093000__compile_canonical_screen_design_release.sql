-- Compile the mutable design source of truth into a deterministic, code-ready
-- contract.  IDs, timestamps and generated file locations are deliberately
-- excluded: changing operational metadata must never rebuild a screen.

DO $$
DECLARE
  object_owner name;
  object_name text;
BEGIN
  IF current_user='carbonet_app' THEN
    RAISE EXCEPTION 'canonical design compiler migration must run as the object owner'
      USING ERRCODE='42501';
  END IF;
  FOREACH object_name IN ARRAY ARRAY[
    'framework_screen_blueprint',
    'framework_process_definition',
    'framework_process_step',
    'framework_professional_screen_contract'
  ] LOOP
    SELECT pg_get_userbyid(relowner) INTO object_owner
      FROM pg_class
     WHERE oid=to_regclass('public.'||object_name);
    IF object_owner IS NULL OR object_owner<>current_user THEN
      RAISE EXCEPTION 'migration role % does not own public.% (owner=%)',
        current_user,object_name,coalesce(object_owner::text,'MISSING')
        USING ERRCODE='42501';
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION framework_strict_jsonb_array(source text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  parsed jsonb;
BEGIN
  parsed:=source::jsonb;
  IF jsonb_typeof(parsed)<>'array' THEN RETURN NULL; END IF;
  RETURN parsed;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION framework_canonical_screen_design(
  requested_process_code varchar,
  requested_step_code varchar,
  requested_audience varchar,
  requested_route_path varchar
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
BEGIN
  IF normalized_process='' OR normalized_step='' OR normalized_route=''
     OR normalized_route !~ '^/'
     OR normalized_audience NOT IN ('USER','ADMIN') THEN
    RAISE EXCEPTION 'invalid canonical screen identity'
      USING ERRCODE='22023';
  END IF;

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
        'title',c.screen_name,
        'summary',c.business_purpose,
        'entryCondition',c.entry_condition,
        'exitCondition',c.exit_condition,
        'exceptionStates',public.framework_try_jsonb(c.state_contract),
        'evidence',public.framework_try_jsonb(c.evidence_contract),
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
                     public.framework_strict_jsonb_array(c.section_contract)
                   ) WITH ORDINALITY section(contract,ordinality)
            UNION ALL
            SELECT 1,'FIELD',field.ordinality,field.contract
              FROM jsonb_array_elements(
                     public.framework_strict_jsonb_array(c.field_contract)
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
        'contractStatus',c.contract_status,
        'requiredScenarioTypes',jsonb_build_array(
          'HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'
        ),
        'traceability',public.framework_try_jsonb(b.traceability_json,'{}'::jsonb),
        'evidence',public.framework_try_jsonb(c.evidence_contract),
        'apiVerified',c.api_verified,
        'databaseVerified',c.database_verified,
        'authorityVerified',c.authority_verified,
        'responsiveVerified',c.responsive_verified,
        'accessibilityVerified',c.accessibility_verified,
        'exceptionStatesVerified',c.exception_states_verified,
        'auditEvidenceRef',c.audit_evidence_ref,
        'checks',jsonb_build_array(
          jsonb_build_object('code','API_CONTRACT','passed',c.api_verified),
          jsonb_build_object('code','DATABASE_PERSISTENCE','passed',c.database_verified),
          jsonb_build_object('code','ACTOR_AUTHORITY','passed',c.authority_verified),
          jsonb_build_object('code','RESPONSIVE','passed',c.responsive_verified),
          jsonb_build_object('code','ACCESSIBILITY','passed',c.accessibility_verified),
          jsonb_build_object('code','EXCEPTION_STATES','passed',c.exception_states_verified)
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
        'sections',public.framework_try_jsonb(c.section_contract),
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
                       public.framework_strict_jsonb_array(c.section_contract)
                     ) WITH ORDINALITY section(contract,ordinality)
              UNION ALL
              SELECT 1,'COMPONENT',field.ordinality,field.contract
                FROM jsonb_array_elements(
                       public.framework_strict_jsonb_array(c.field_contract)
                     ) WITH ORDINALITY field(contract,ordinality)
            ) derived_asset
          ) end,
        'responsive',c.responsive_contract,
        'accessibility',c.accessibility_contract,
        'security',c.security_contract
      ),
      'FRONTEND',jsonb_build_object(
        'routePath',lower(split_part(b.route_path,'?',1)),
        'pageId',b.page_id,
        'screenType',b.screen_type,
        'templateCode',b.template_code,
        'sections',public.framework_try_jsonb(c.section_contract),
        'fields',public.framework_try_jsonb(c.field_contract),
        'actions',public.framework_try_jsonb(c.command_contract),
        'states',public.framework_try_jsonb(c.state_contract),
        'responsive',c.responsive_contract,
        'accessibility',c.accessibility_contract
      ),
      'API',public.framework_strict_jsonb_array(c.api_contract),
      'DATABASE',public.framework_strict_jsonb_array(c.data_contract)
    )
  )
    INTO STRICT canonical_design
    FROM public.framework_screen_blueprint b
    JOIN public.framework_process_definition p
      ON p.process_code=b.process_code
    JOIN public.framework_process_step s
      ON s.process_code=b.process_code AND s.step_code=b.step_code
    JOIN public.framework_professional_screen_contract c
      ON c.process_code=b.process_code
     AND c.step_code=b.step_code
     AND c.audience=b.audience
     AND lower(split_part(c.route_path,'?',1))=lower(split_part(b.route_path,'?',1))
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

CREATE OR REPLACE FUNCTION framework_canonical_design_readiness(
  requested_identity_limit integer DEFAULT 200
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  source_count integer;
  exact_contract_count integer;
  compilable_count integer;
  missing_count integer;
  duplicate_count integer;
  incomplete_lane_count integer;
  blockers jsonb;
BEGIN
  IF requested_identity_limit IS NULL
     OR requested_identity_limit<0 OR requested_identity_limit>500 THEN
    RAISE EXCEPTION 'readiness identity limit must be between 0 and 500'
      USING ERRCODE='22023';
  END IF;
  WITH scoped AS MATERIALIZED (
    SELECT b.blueprint_code,b.process_code,b.step_code,b.audience,
           lower(split_part(b.route_path,'?',1)) route_path,
           upper(b.process_code)||'|'||upper(b.step_code)||'|'||
             upper(b.audience)||'|'||lower(split_part(b.route_path,'?',1)) screen_key,
           (
             SELECT count(*)::integer
               FROM public.framework_professional_screen_contract c
              WHERE c.process_code=b.process_code
                AND c.step_code=b.step_code
                AND c.audience=b.audience
                AND lower(split_part(c.route_path,'?',1))=
                    lower(split_part(b.route_path,'?',1))
           ) contract_count,
           (
             SELECT count(*)::integer
               FROM public.framework_professional_screen_contract c
              WHERE c.process_code=b.process_code
                AND c.step_code=b.step_code
                AND c.audience=b.audience
                AND lower(split_part(c.route_path,'?',1))=
                    lower(split_part(b.route_path,'?',1))
                AND jsonb_array_length(
                      public.framework_strict_jsonb_array(c.api_contract))>0
                AND jsonb_array_length(
                      public.framework_strict_jsonb_array(c.data_contract))>0
                AND jsonb_array_length(
                      public.framework_strict_jsonb_array(c.section_contract))>0
                AND jsonb_array_length(
                      public.framework_strict_jsonb_array(c.field_contract))>0
           ) complete_lane_count
      FROM public.framework_screen_blueprint b
     WHERE b.validation_status='VALID'
  ), summary AS (
    SELECT count(*)::integer source_count,
           count(*) FILTER (WHERE contract_count=1)::integer exact_contract_count,
           count(*) FILTER (
             WHERE contract_count=1 AND complete_lane_count=1
           )::integer compilable_count,
           count(*) FILTER (WHERE contract_count=0)::integer missing_count,
           count(*) FILTER (WHERE contract_count>1)::integer duplicate_count,
           count(*) FILTER (
             WHERE contract_count=1 AND complete_lane_count<>1
           )::integer incomplete_lane_count
      FROM scoped
  ), reported AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'screenKey',screen_key,
             'blueprintCode',blueprint_code,
             'processCode',upper(process_code),
             'stepCode',upper(step_code),
             'audience',upper(audience),
             'routePath',route_path,
             'contractCount',contract_count,
             'reason',case when contract_count=0
                       then 'PROFESSIONAL_CONTRACT_MISSING'
                       when contract_count>1
                       then 'PROFESSIONAL_CONTRACT_DUPLICATE'
                       else 'INCOMPLETE_LANE_CONTRACT' end
           ) ORDER BY process_code,step_code,audience,route_path,blueprint_code),
           '[]'::jsonb) blockers
      FROM (
        SELECT *
          FROM scoped
         WHERE contract_count<>1 OR complete_lane_count<>1
         ORDER BY process_code,step_code,audience,route_path,blueprint_code
         LIMIT requested_identity_limit
      ) bounded
  )
  SELECT summary.source_count,summary.exact_contract_count,
         summary.compilable_count,summary.missing_count,
         summary.duplicate_count,summary.incomplete_lane_count,reported.blockers
    INTO source_count,exact_contract_count,compilable_count,missing_count,
         duplicate_count,incomplete_lane_count,blockers
    FROM summary,reported;
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-design-readiness/v1',
    'sourceCount',source_count,
    'exactContractCount',exact_contract_count,
    'compilableCount',compilable_count,
    'missingCount',missing_count,
    'duplicateCount',duplicate_count,
    'incompleteLaneCount',incomplete_lane_count,
    'blockerCount',missing_count+duplicate_count+incomplete_lane_count,
    'reportedBlockerCount',jsonb_array_length(blockers),
    'blockersTruncated',
      jsonb_array_length(blockers)<
        missing_count+duplicate_count+incomplete_lane_count,
    'blockers',blockers
  );
END
$$;

CREATE INDEX idx_canonical_blueprint_identity_v1
  ON framework_screen_blueprint(
    process_code,step_code,audience,
    (lower(split_part(route_path,'?',1)))
  ) WHERE validation_status='VALID';
CREATE INDEX idx_canonical_blueprint_normalized_identity_v1
  ON framework_screen_blueprint(
    (upper(process_code)),(upper(step_code)),(upper(audience)),
    (lower(split_part(route_path,'?',1)))
  ) WHERE validation_status='VALID';
CREATE INDEX idx_canonical_professional_contract_identity_v1
  ON framework_professional_screen_contract(
    process_code,step_code,audience,
    (lower(split_part(route_path,'?',1)))
  );

CREATE OR REPLACE FUNCTION framework_canonical_design_catalog(
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
  SELECT count(*)::integer INTO compilable_count
    FROM public.framework_screen_blueprint b
   WHERE b.validation_status='VALID'
     AND (
       SELECT count(*)
         FROM public.framework_professional_screen_contract c
        WHERE c.process_code=b.process_code
          AND c.step_code=b.step_code
          AND c.audience=b.audience
          AND lower(split_part(c.route_path,'?',1))=
              lower(split_part(b.route_path,'?',1))
     )=1
     AND (
       SELECT count(*)
         FROM public.framework_professional_screen_contract c
        WHERE c.process_code=b.process_code
          AND c.step_code=b.step_code
          AND c.audience=b.audience
          AND lower(split_part(c.route_path,'?',1))=
              lower(split_part(b.route_path,'?',1))
          AND jsonb_array_length(
                public.framework_strict_jsonb_array(c.api_contract))>0
          AND jsonb_array_length(
                public.framework_strict_jsonb_array(c.data_contract))>0
          AND jsonb_array_length(
                public.framework_strict_jsonb_array(c.section_contract))>0
          AND jsonb_array_length(
                public.framework_strict_jsonb_array(c.field_contract))>0
     )=1;
  IF compilable_count=0 THEN
    RAISE EXCEPTION 'canonical catalog has no compilable screens'
      USING ERRCODE='P0002';
  END IF;
  IF compilable_count>requested_limit THEN
    RAISE EXCEPTION 'canonical catalog has % compilable rows and exceeds limit %',
      compilable_count,requested_limit USING ERRCODE='54000';
  END IF;

  WITH compiled AS MATERIALIZED (
    SELECT p.development_order,b.process_code,s.step_order,b.audience,
           lower(split_part(b.route_path,'?',1)) route_path,b.blueprint_code,
           b.step_code,
           upper(b.process_code)||'|'||upper(b.step_code)||'|'||
             upper(b.audience)||'|'||lower(split_part(b.route_path,'?',1)) screen_key,
           public.framework_canonical_screen_design(
             b.process_code,b.step_code,b.audience,b.route_path
           ) canonical_design
      FROM public.framework_screen_blueprint b
      JOIN public.framework_process_definition p USING(process_code)
      JOIN public.framework_process_step s
        ON s.process_code=b.process_code AND s.step_code=b.step_code
     WHERE b.validation_status='VALID'
       AND (
         SELECT count(*)
           FROM public.framework_professional_screen_contract c
          WHERE c.process_code=b.process_code
            AND c.step_code=b.step_code
            AND c.audience=b.audience
            AND lower(split_part(c.route_path,'?',1))=
                lower(split_part(b.route_path,'?',1))
       )=1
       AND (
         SELECT count(*)
           FROM public.framework_professional_screen_contract c
          WHERE c.process_code=b.process_code
            AND c.step_code=b.step_code
            AND c.audience=b.audience
            AND lower(split_part(c.route_path,'?',1))=
                lower(split_part(b.route_path,'?',1))
            AND jsonb_array_length(
                  public.framework_strict_jsonb_array(c.api_contract))>0
            AND jsonb_array_length(
                  public.framework_strict_jsonb_array(c.data_contract))>0
            AND jsonb_array_length(
                  public.framework_strict_jsonb_array(c.section_contract))>0
            AND jsonb_array_length(
                  public.framework_strict_jsonb_array(c.field_contract))>0
       )=1
  ), hashed AS MATERIALIZED (
    SELECT *,canonical_design::text canonical_text,
           encode(sha256(convert_to(canonical_design::text,'UTF8')),'hex') design_hash
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
             'processCode',upper(process_code),
             'stepCode',upper(step_code),
             'audience',upper(audience),
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
    RAISE EXCEPTION 'canonical catalog compiled % of % eligible rows',
      compiled_count,compilable_count USING ERRCODE='55000';
  END IF;
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION framework_canonical_screen_bundle(
  process_code varchar,
  step_code varchar,
  audience varchar,
  route_path varchar
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
    process_code,step_code,audience,route_path
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

CREATE TABLE framework_canonical_design_release_evidence (
  release_id bigserial PRIMARY KEY,
  schema_id varchar(80) NOT NULL DEFAULT 'carbonet.canonical-design/v1'
    CHECK (schema_id='carbonet.canonical-design/v1'),
  catalog_hash varchar(64) NOT NULL CHECK (catalog_hash ~ '^[0-9a-f]{64}$'),
  readiness_hash varchar(64) NOT NULL CHECK (readiness_hash ~ '^[0-9a-f]{64}$'),
  screen_count integer NOT NULL CHECK (screen_count>0 AND screen_count<=5000),
  release_status varchar(20) NOT NULL
    CHECK (release_status IN ('COMPLETE','PARTIAL')),
  blocker_count integer NOT NULL CHECK (blocker_count>=0),
  catalog_json jsonb NOT NULL,
  readiness_json jsonb NOT NULL,
  published_by varchar(100) NOT NULL CHECK (btrim(published_by)<>''),
  published_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(schema_id,catalog_hash,readiness_hash),
  CHECK (catalog_json->>'schema'=schema_id),
  CHECK (catalog_json->>'catalogHash'=catalog_hash),
  CHECK ((catalog_json->>'screenCount')::integer=screen_count),
  CHECK (jsonb_array_length(catalog_json->'screens')=screen_count),
  CHECK (readiness_json->>'schema'='carbonet.canonical-design-readiness/v1'),
  CHECK (
    encode(sha256(convert_to(readiness_json::text,'UTF8')),'hex')=readiness_hash
  ),
  CHECK ((readiness_json->>'compilableCount')::integer=screen_count),
  CHECK ((readiness_json->>'blockerCount')::integer=blocker_count),
  CHECK (
    (release_status='COMPLETE' AND blocker_count=0)
    OR (release_status='PARTIAL' AND blocker_count>0)
  )
);

CREATE TABLE framework_canonical_design_release_member (
  release_id bigint NOT NULL REFERENCES framework_canonical_design_release_evidence(release_id),
  screen_key varchar(600) NOT NULL CHECK (btrim(screen_key)<>''),
  design_hash varchar(64) NOT NULL CHECK (design_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(release_id,screen_key)
);

CREATE OR REPLACE FUNCTION framework_latest_canonical_design_release_hash(
  requested_screen_key text,
  requested_design_hash text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH latest AS MATERIALIZED (
    SELECT evidence.release_id,evidence.catalog_hash
      FROM public.framework_canonical_design_release_evidence evidence
     ORDER BY evidence.release_id DESC
     LIMIT 1
  )
  SELECT latest.catalog_hash
    FROM latest
    JOIN public.framework_canonical_design_release_member member
      ON member.release_id=latest.release_id
     AND member.screen_key=requested_screen_key
     AND member.design_hash=requested_design_hash
$$;

COMMENT ON FUNCTION framework_latest_canonical_design_release_hash(text,text)
  IS 'Returns the latest immutable catalog hash only for an exact released screenKey/designHash member; otherwise null';

CREATE OR REPLACE FUNCTION framework_reject_canonical_design_release_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'canonical design release evidence and membership are append-only'
    USING ERRCODE='55000';
END
$$;

DROP TRIGGER IF EXISTS trg_canonical_design_release_reject_row_mutation
  ON framework_canonical_design_release_evidence;
CREATE TRIGGER trg_canonical_design_release_reject_row_mutation
BEFORE UPDATE OR DELETE ON framework_canonical_design_release_evidence
FOR EACH ROW EXECUTE FUNCTION framework_reject_canonical_design_release_mutation();

DROP TRIGGER IF EXISTS trg_canonical_design_release_reject_truncate
  ON framework_canonical_design_release_evidence;
CREATE TRIGGER trg_canonical_design_release_reject_truncate
BEFORE TRUNCATE ON framework_canonical_design_release_evidence
FOR EACH STATEMENT EXECUTE FUNCTION framework_reject_canonical_design_release_mutation();

DROP TRIGGER IF EXISTS trg_canonical_design_release_member_reject_row_mutation
  ON framework_canonical_design_release_member;
CREATE TRIGGER trg_canonical_design_release_member_reject_row_mutation
BEFORE UPDATE OR DELETE ON framework_canonical_design_release_member
FOR EACH ROW EXECUTE FUNCTION framework_reject_canonical_design_release_mutation();

DROP TRIGGER IF EXISTS trg_canonical_design_release_member_reject_truncate
  ON framework_canonical_design_release_member;
CREATE TRIGGER trg_canonical_design_release_member_reject_truncate
BEFORE TRUNCATE ON framework_canonical_design_release_member
FOR EACH STATEMENT EXECUTE FUNCTION framework_reject_canonical_design_release_mutation();

CREATE OR REPLACE FUNCTION framework_publish_canonical_design_release(
  requested_by varchar DEFAULT 'SYSTEM'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor varchar(100) := btrim(coalesce(requested_by,''));
  catalog jsonb;
  readiness jsonb;
  computed_readiness_hash text;
  persisted framework_canonical_design_release_evidence%ROWTYPE;
BEGIN
  IF actor='' THEN
    RAISE EXCEPTION 'canonical design release actor is required'
      USING ERRCODE='22023';
  END IF;
  catalog:=public.framework_canonical_design_catalog(5000);
  readiness:=public.framework_canonical_design_readiness(200);
  computed_readiness_hash:=
    encode(sha256(convert_to(readiness::text,'UTF8')),'hex');
  INSERT INTO public.framework_canonical_design_release_evidence(
    schema_id,catalog_hash,readiness_hash,screen_count,release_status,blocker_count,
    catalog_json,readiness_json,published_by
  ) VALUES (
    catalog->>'schema',catalog->>'catalogHash',computed_readiness_hash,
    (catalog->>'screenCount')::integer,
    case when (readiness->>'blockerCount')::integer=0
      then 'COMPLETE' else 'PARTIAL' end,
    (readiness->>'blockerCount')::integer,catalog,readiness,actor
  )
  ON CONFLICT(schema_id,catalog_hash,readiness_hash) DO NOTHING;
  SELECT * INTO STRICT persisted
    FROM public.framework_canonical_design_release_evidence
   WHERE schema_id=catalog->>'schema'
     AND catalog_hash=catalog->>'catalogHash'
     AND readiness_hash=computed_readiness_hash;
  INSERT INTO public.framework_canonical_design_release_member(
    release_id,screen_key,design_hash
  )
  SELECT persisted.release_id,screen->>'screenKey',screen->>'designHash'
    FROM jsonb_array_elements(catalog->'screens') screen
  ON CONFLICT(release_id,screen_key) DO NOTHING;
  IF (
    SELECT count(*)
      FROM public.framework_canonical_design_release_member member
     WHERE member.release_id=persisted.release_id
  )<>persisted.screen_count THEN
    RAISE EXCEPTION 'canonical release % membership count mismatch',
      persisted.release_id USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object(
    'releaseId',persisted.release_id,
    'schema',persisted.schema_id,
    'catalogHash',persisted.catalog_hash,
    'readinessHash',persisted.readiness_hash,
    'screenCount',persisted.screen_count,
    'releaseStatus',persisted.release_status,
    'blockerCount',persisted.blocker_count,
    'publishedBy',persisted.published_by,
    'publishedAt',persisted.published_at
  );
END
$$;

REVOKE ALL ON TABLE framework_canonical_design_release_evidence FROM PUBLIC;
REVOKE ALL ON TABLE framework_canonical_design_release_member FROM PUBLIC;
REVOKE ALL ON SEQUENCE framework_canonical_design_release_evidence_release_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION framework_publish_canonical_design_release(varchar) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON TABLE framework_canonical_design_release_evidence FROM carbonet_app;
    REVOKE ALL ON TABLE framework_canonical_design_release_member FROM carbonet_app;
    REVOKE ALL ON SEQUENCE framework_canonical_design_release_evidence_release_id_seq
      FROM carbonet_app;
    REVOKE ALL ON FUNCTION framework_publish_canonical_design_release(varchar)
      FROM carbonet_app;
  END IF;
END
$$;

COMMENT ON FUNCTION framework_canonical_screen_bundle(varchar,varchar,varchar,varchar)
  IS 'O(log S) exact-screen compiler; catalogHash is present only for exact membership in the latest immutable release';
COMMENT ON TABLE framework_canonical_design_release_evidence
  IS 'Append-only immutable snapshots of the canonical screen design catalog';
COMMENT ON TABLE framework_canonical_design_release_member
  IS 'Indexed append-only screenKey/designHash provenance for each immutable canonical release';
