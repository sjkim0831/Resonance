-- Compile canonical API/DATABASE lanes into deterministic generator input.
-- All functions are read-only SECURITY INVOKER and fail closed on partial input.
DO $$
DECLARE compiler_owner name;
BEGIN
  SELECT pg_get_userbyid(proowner) INTO compiler_owner
    FROM pg_proc
   WHERE oid='public.framework_canonical_design_catalog(integer)'::regprocedure;
  IF compiler_owner IS NULL OR compiler_owner<>current_user
     OR current_user='carbonet_app' THEN
    RAISE EXCEPTION 'endpoint compiler migration role % does not own design compiler (owner=%)',
      current_user,coalesce(compiler_owner::text,'MISSING') USING ERRCODE='42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_exact_keys(
  value jsonb, expected text[]
) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN jsonb_typeof(value)='object' THEN
    (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(value) key)
      IS NOT DISTINCT FROM expected
  ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_schema_valid(
  schema_value jsonb, request_context boolean
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE properties jsonb;
DECLARE required_fields jsonb;
BEGIN
  IF NOT public.framework_canonical_endpoint_exact_keys(
       schema_value,ARRAY['properties','required','type'])
     OR schema_value->>'type' IS DISTINCT FROM 'object'
     OR jsonb_typeof(schema_value->'properties') IS DISTINCT FROM 'object'
     OR jsonb_typeof(schema_value->'required') IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  properties:=schema_value->'properties';
  required_fields:=schema_value->'required';
  IF EXISTS(
       SELECT 1 FROM jsonb_each(properties) property
        WHERE property.key !~ '^[A-Za-z_][A-Za-z0-9_]*$'
           OR property.key=ANY(ARRAY[
             'abstract','assert','boolean','break','byte','case','catch','char',
             'class','const','continue','default','do','double','else','enum',
             'extends','final','finally','float','for','goto','if','implements',
             'import','instanceof','int','interface','long','native','new',
             'package','private','protected','public','record','return','sealed',
             'short','static','strictfp','super','switch','synchronized','this',
             'throw','throws','transient','try','var','void','volatile','while','yield'
           ])
           OR jsonb_typeof(property.value) IS DISTINCT FROM 'object'
           OR property.value->>'type' IS NULL
           OR property.value->>'type' NOT IN
                ('string','integer','number','boolean','object','array')
     )
     OR EXISTS(
       SELECT 1 FROM jsonb_array_elements(required_fields) required
        WHERE jsonb_typeof(required) IS DISTINCT FROM 'string'
     )
     OR (SELECT count(*) FROM jsonb_array_elements(required_fields))<>
        (SELECT count(DISTINCT required#>>'{}')
           FROM jsonb_array_elements(required_fields) required)
     OR EXISTS(
       SELECT 1 FROM jsonb_array_elements(required_fields) required
        WHERE NOT properties ? (required#>>'{}')
     ) THEN
    RETURN false;
  END IF;
  IF request_context AND (
       NOT required_fields @> jsonb_build_array(
         'tenantId','projectId','actorCode','idempotencyKey')
       OR properties#>>'{tenantId,type}' IS DISTINCT FROM 'string'
       OR properties#>>'{projectId,type}' IS DISTINCT FROM 'string'
       OR properties#>>'{actorCode,type}' IS DISTINCT FROM 'string'
       OR properties#>>'{idempotencyKey,type}' IS DISTINCT FROM 'string'
       OR properties ?| ARRAY[
         'executionId','processCode','stepCode','commandCode','requestJson',
         'resultJson','requireDraft'
       ]
     ) THEN
    RETURN false;
  END IF;
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_java_name(
  operation_id text
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT string_agg(
           upper(left(part,1))||substring(part from 2),''
           ORDER BY ordinal
         )
    FROM regexp_split_to_table(operation_id,'[^A-Za-z0-9]+')
         WITH ORDINALITY source(part,ordinal)
   WHERE part<>''
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_design_catalog(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE source_catalog jsonb;
DECLARE scoped_count integer;
DECLARE scoped_screens jsonb;
DECLARE scoped_hash text;
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
  source_catalog:=public.framework_canonical_design_catalog(5000);
  SELECT count(*)::integer,
         coalesce(jsonb_agg(screen ORDER BY ordinal),'[]'::jsonb),
         encode(sha256(convert_to(string_agg(
           (screen->>'screenKey')||E'\x1f'||(screen->>'designHash'),E'\n'
           ORDER BY ordinal
         ),'UTF8')),'hex')
    INTO scoped_count,scoped_screens,scoped_hash
    FROM jsonb_array_elements(source_catalog->'screens')
         WITH ORDINALITY source(screen,ordinal)
   WHERE screen->>'processCode'=requested_process;
  IF scoped_count=0 THEN
    RAISE EXCEPTION 'canonical catalog has no screens for process %',requested_process
      USING ERRCODE='P0002';
  END IF;
  IF scoped_count>requested_limit THEN
    RAISE EXCEPTION 'canonical process % has % rows and exceeds limit %',
      requested_process,scoped_count,requested_limit USING ERRCODE='54000';
  END IF;
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-design/v1','catalogHash',scoped_hash,
    'screenCount',scoped_count,'screens',scoped_screens
  );
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_has_forbidden_key(
  value jsonb
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE pair record;
DECLARE child jsonb;
BEGIN
  IF jsonb_typeof(value)='object' THEN
    FOR pair IN SELECT key,item FROM jsonb_each(value) item(key,item) LOOP
      IF lower(pair.key)=ANY(ARRAY[
           'sql','query','statement','ddl','dml','handlerclass','serviceclass',
           'repositoryclass','implementationclass'
         ])
         OR public.framework_canonical_endpoint_has_forbidden_key(pair.item) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(value)='array' THEN
    FOR child IN SELECT item FROM jsonb_array_elements(value) item LOOP
      IF public.framework_canonical_endpoint_has_forbidden_key(child) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_diagnostic(
  screen jsonb
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE canonical jsonb;
DECLARE identity jsonb;
DECLARE step_contract jsonb;
DECLARE api jsonb;
DECLARE persistence jsonb;
DECLARE response_schema jsonb;
DECLARE response_errors jsonb;
DECLARE operation jsonb;
DECLARE path text;
DECLARE runtime_response jsonb:=jsonb_build_object(
  'success',jsonb_build_object('type','boolean'),
  'idempotent',jsonb_build_object('type','boolean'),
  'eventId',jsonb_build_object('type','integer'),
  'toState',jsonb_build_object('type','string')
);
DECLARE runtime_persistence jsonb:=jsonb_build_object(
  'persistenceId','PROCESS_EXECUTION_AGGREGATE',
  'entity','framework_process_execution',
  'operation','UPDATE',
  'primaryKey',jsonb_build_array('execution_id'),
  'tenantColumn','tenant_id',
  'projectColumn','project_id',
  'versionColumn','execution_version',
  'transactional',true
);
BEGIN
  canonical:=screen->'canonicalDesign';
  IF jsonb_typeof(screen) IS DISTINCT FROM 'object'
     OR jsonb_typeof(canonical) IS DISTINCT FROM 'object'
     OR screen->>'canonicalText' IS NULL
     OR NOT coalesce(screen->>'designHash' ~ '^[0-9a-f]{64}$',false)
     OR screen->>'canonicalText' IS DISTINCT FROM canonical::text
     OR encode(sha256(convert_to(screen->>'canonicalText','UTF8')),'hex')
          IS DISTINCT FROM screen->>'designHash' THEN
    RETURN jsonb_build_object('reason','CANONICAL_PROVENANCE_INVALID');
  END IF;
  identity:=canonical->'identity';
  IF NOT public.framework_canonical_endpoint_exact_keys(
       identity,ARRAY[
         'actorCode','audience','blueprintCode','pageId','processCode',
         'routePath','screenKey','stepCode'])
     OR NOT coalesce(identity->>'processCode' ~ '^[A-Z][A-Z0-9_]{1,79}$',false)
     OR NOT coalesce(identity->>'stepCode' ~ '^[A-Z][A-Z0-9_]{1,79}$',false)
     OR NOT coalesce(identity->>'actorCode' ~ '^[A-Z][A-Z0-9_]{1,79}$',false)
     OR identity->>'screenKey' IS DISTINCT FROM screen->>'screenKey'
     OR identity->>'routePath' IS DISTINCT FROM screen->>'routePath'
     OR identity->>'audience' IS DISTINCT FROM screen->>'audience'
     OR identity->>'screenKey' IS DISTINCT FROM
       (identity->>'processCode')||'|'||(identity->>'stepCode')||'|'||
       (identity->>'audience')||'|'||(identity->>'routePath') THEN
    RETURN jsonb_build_object('reason','CANONICAL_IDENTITY_INVALID');
  END IF;
  step_contract:=canonical->'step';
  IF jsonb_typeof(step_contract) IS DISTINCT FROM 'object'
     OR NOT coalesce(
       step_contract->>'commandCode' ~ '^[A-Z][A-Z0-9_]{1,79}$',false) THEN
    RETURN jsonb_build_object('reason','CANONICAL_STEP_INVALID');
  END IF;
  IF jsonb_typeof(canonical#>'{lanes,API}') IS DISTINCT FROM 'array'
     OR jsonb_array_length(canonical#>'{lanes,API}')<>1 THEN
    RETURN jsonb_build_object('reason','API_COUNT_NOT_ONE');
  END IF;
  IF jsonb_typeof(canonical#>'{lanes,DATABASE}') IS DISTINCT FROM 'array'
     OR jsonb_array_length(canonical#>'{lanes,DATABASE}')<>1 THEN
    RETURN jsonb_build_object('reason','DATABASE_COUNT_NOT_ONE');
  END IF;
  api:=canonical#>'{lanes,API,0}';
  persistence:=canonical#>'{lanes,DATABASE,0}';
  IF NOT public.framework_canonical_endpoint_exact_keys(
       api,ARRAY[
         'authority','commandCode','idempotencyRequired','implementationKind',
         'method','operationId','path','persistenceRef','processCode','request',
         'response','rollback','stepCode','transactionPolicy']) THEN
    RETURN jsonb_build_object('reason','API_SOURCE_KEYS_INVALID');
  END IF;
  IF NOT coalesce(api->>'operationId' ~ '^[A-Za-z][A-Za-z0-9_]{1,79}$',false)
     OR api->>'implementationKind' IS DISTINCT FROM 'PROCESS_COMMAND_ADAPTER'
     OR api->>'method' IS DISTINCT FROM 'POST'
     OR NOT coalesce(api->>'processCode' ~ '^[A-Z][A-Z0-9_]{1,79}$',false)
     OR NOT coalesce(api->>'stepCode' ~ '^[A-Z][A-Z0-9_]{1,79}$',false)
     OR NOT coalesce(api->>'commandCode' ~ '^[A-Z][A-Z0-9_]{1,79}$',false)
     OR api->>'processCode' IS DISTINCT FROM identity->>'processCode'
     OR api->>'stepCode' IS DISTINCT FROM identity->>'stepCode'
     OR api->>'commandCode' IS DISTINCT FROM step_contract->>'commandCode'
     OR api->>'transactionPolicy' IS DISTINCT FROM 'REQUIRED'
     OR api->'idempotencyRequired' IS DISTINCT FROM 'true'::jsonb THEN
    RETURN jsonb_build_object('reason','COMMAND_BINDING_INVALID');
  END IF;
  path:=api->>'path';
  IF path IS NULL OR path !~ '^/[A-Za-z0-9_{}./-]+$'
     OR path='/' OR right(path,1)='/' OR path LIKE '//%'
     OR strpos(path,'//')>0 OR path ~ '[?#\\]'
     OR path ~ '(^|/)\.{1,2}(/|$)'
     OR (length(path)-length(replace(path,'{executionId}','')))
          /length('{executionId}')<>1
     OR regexp_replace(path,'\{executionId\}','','g') ~ '[{}]' THEN
    RETURN jsonb_build_object('reason','PATH_INVALID');
  END IF;
  IF NOT public.framework_canonical_endpoint_exact_keys(
       api->'authority',
       ARRAY['actorCodes','audience','authenticated','projectScoped','tenantScoped'])
     OR api#>>'{authority,audience}' IS DISTINCT FROM screen->>'audience'
     OR api#>'{authority,actorCodes}' IS DISTINCT FROM
          jsonb_build_array(identity->>'actorCode')
     OR api#>'{authority,authenticated}' IS DISTINCT FROM 'true'::jsonb
     OR api#>'{authority,tenantScoped}' IS DISTINCT FROM 'true'::jsonb
     OR api#>'{authority,projectScoped}' IS DISTINCT FROM 'true'::jsonb THEN
    RETURN jsonb_build_object('reason','AUTHORITY_INVALID');
  END IF;
  IF NOT public.framework_canonical_endpoint_exact_keys(
       api->'request',ARRAY['contentType','schema'])
     OR api#>>'{request,contentType}' IS DISTINCT FROM 'application/json'
     OR NOT public.framework_canonical_endpoint_schema_valid(
       api#>'{request,schema}',true) THEN
    RETURN jsonb_build_object('reason','REQUEST_SCHEMA_INVALID');
  END IF;
  IF NOT public.framework_canonical_endpoint_exact_keys(
       api->'response',ARRAY['errors','schema','successStatus'])
     OR (api#>'{response,successStatus}')::text IS DISTINCT FROM '200' THEN
    RETURN jsonb_build_object('reason','RESPONSE_INVALID');
  END IF;
  response_schema:=api#>'{response,schema}';
  IF NOT public.framework_canonical_endpoint_schema_valid(response_schema,false)
     OR response_schema->'properties' IS DISTINCT FROM runtime_response
     OR jsonb_array_length(response_schema->'required')<>4
     OR NOT response_schema->'required' @> jsonb_build_array(
       'success','idempotent','eventId','toState') THEN
    RETURN jsonb_build_object('reason','RESPONSE_SCHEMA_INVALID');
  END IF;
  response_errors:=api#>'{response,errors}';
  IF jsonb_typeof(response_errors) IS DISTINCT FROM 'array'
     OR jsonb_array_length(response_errors)<>4
     OR EXISTS(
       SELECT 1 FROM jsonb_array_elements(response_errors) error
        WHERE NOT public.framework_canonical_endpoint_exact_keys(
                    error,ARRAY['code','status'])
           OR error->>'status' IS NULL
           OR error->>'status' NOT IN ('400','401','403','500')
           OR NOT coalesce(error->>'code' ~ '^[A-Z][A-Z0-9_]{1,79}$',false)
     )
     OR NOT response_errors @> jsonb_build_array(
       jsonb_build_object('status',400,'code','INVALID_REQUEST'),
       jsonb_build_object('status',401,'code','AUTHENTICATION_REQUIRED'),
       jsonb_build_object('status',403,'code','ACCESS_DENIED'),
       jsonb_build_object('status',500,'code','INTERNAL_ERROR')) THEN
    RETURN jsonb_build_object('reason','RESPONSE_ERRORS_INVALID');
  END IF;
  IF NOT public.framework_canonical_endpoint_exact_keys(
       persistence,ARRAY[
         'entity','operation','persistenceId','primaryKey','projectColumn',
         'tenantColumn','transactional','versionColumn'])
     OR api->>'persistenceRef' IS DISTINCT FROM 'PROCESS_EXECUTION_AGGREGATE'
     OR persistence IS DISTINCT FROM runtime_persistence THEN
    RETURN jsonb_build_object('reason','PERSISTENCE_INVALID');
  END IF;
  IF NOT public.framework_canonical_endpoint_exact_keys(
       api->'rollback',ARRAY['commandCode','strategy'])
     OR api#>>'{rollback,strategy}' IS DISTINCT FROM 'TRANSACTION'
     OR api#>>'{rollback,commandCode}' IS DISTINCT FROM
          step_contract->>'commandCode' THEN
    RETURN jsonb_build_object('reason','ROLLBACK_INVALID');
  END IF;
  IF public.framework_canonical_endpoint_has_forbidden_key(api) THEN
    RETURN jsonb_build_object('reason','IMPLEMENTATION_KEY_FORBIDDEN');
  END IF;
  operation:=api-'persistenceRef'||jsonb_build_object('persistence',persistence);
  RETURN jsonb_build_object(
    'reason','READY','operationId',lower(api->>'operationId'),
    'artifactName',lower(public.framework_canonical_endpoint_java_name(
      api->>'operationId')),
    'routeSignature',lower((api->>'method')||' '||(api->>'path')),
    'operation',operation
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('reason','SOURCE_MALFORMED');
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_readiness(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE design_catalog jsonb;
DECLARE source_design_count integer;
DECLARE canonical_screen_count integer;
DECLARE design_missing_count integer;
DECLARE design_blueprint_duplicate_count integer;
DECLARE design_contract_duplicate_count integer;
DECLARE design_incomplete_count integer;
DECLARE design_compiler_mismatch_count integer;
DECLARE design_blocker_count integer;
DECLARE eligible_screen_keys jsonb;
DECLARE total_count integer;
DECLARE source_ready_count integer;
DECLARE global_collision_count integer;
DECLARE blocker_count integer;
DECLARE reason_counts jsonb;
DECLARE result_status text;
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
  WITH raw_blueprints AS MATERIALIZED (
    SELECT b.process_code,b.step_code,b.audience,
           lower(split_part(b.route_path,'?',1)) normalized_route
      FROM public.framework_screen_blueprint b
     WHERE b.validation_status='VALID'
       AND (requested_process IS NULL OR b.process_code=requested_process)
  ), scoped_blueprints AS MATERIALIZED (
    SELECT *,count(*) OVER (
             PARTITION BY upper(process_code),upper(step_code),upper(audience),
                          normalized_route
           )::integer blueprint_identity_count
      FROM raw_blueprints
  ), contract_counts AS MATERIALIZED (
    SELECT c.process_code,c.step_code,c.audience,
           lower(split_part(c.route_path,'?',1)) normalized_route,
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
     WHERE requested_process IS NULL OR c.process_code=requested_process
     GROUP BY c.process_code,c.step_code,c.audience,
              lower(split_part(c.route_path,'?',1))
  ), scoped AS MATERIALIZED (
    SELECT b.*,coalesce(c.contract_count,0) contract_count,
           coalesce(c.complete_lane_count,0) complete_lane_count
      FROM scoped_blueprints b
      LEFT JOIN contract_counts c
        ON c.process_code=b.process_code
       AND c.step_code=b.step_code
       AND c.audience=b.audience
       AND c.normalized_route=b.normalized_route
  )
  SELECT count(*)::integer,
         count(*) FILTER (
           WHERE blueprint_identity_count=1 AND contract_count=0
         )::integer,
         count(*) FILTER (WHERE blueprint_identity_count>1)::integer,
         count(*) FILTER (
           WHERE blueprint_identity_count=1 AND contract_count>1
         )::integer,
         count(*) FILTER (
           WHERE blueprint_identity_count=1 AND contract_count=1
             AND complete_lane_count<>1
         )::integer,
         coalesce(jsonb_agg(
           upper(process_code)||'|'||upper(step_code)||'|'||upper(audience)||'|'||
             normalized_route
         ) FILTER (
           WHERE blueprint_identity_count=1 AND contract_count=1
             AND complete_lane_count=1
         ),'[]'::jsonb)
    INTO source_design_count,design_missing_count,
         design_blueprint_duplicate_count,design_contract_duplicate_count,
         design_incomplete_count,eligible_screen_keys
    FROM scoped;
  BEGIN
    design_catalog:=public.framework_canonical_design_catalog(5000);
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
    RAISE EXCEPTION 'canonical endpoint scope has % rows and exceeds limit %',
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

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_readiness(
  requested_limit integer DEFAULT 5000
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_canonical_endpoint_readiness(
    requested_limit,NULL::varchar)
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_catalog(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE readiness jsonb;
DECLARE design_catalog jsonb;
DECLARE compiled_count integer;
DECLARE endpoints jsonb;
DECLARE catalog_hash text;
BEGIN
  readiness:=public.framework_canonical_endpoint_readiness(
    requested_limit,requested_process);
  IF readiness->>'status'<>'COMPLETE' THEN
    RAISE EXCEPTION 'canonical endpoint readiness is % (total=%, ready=%, blockers=%)',
      readiness->>'status',readiness->>'totalCount',
      readiness->>'sourceReadyCount',readiness->>'blockerCount'
      USING ERRCODE='P0002',DETAIL=readiness::text;
  END IF;
  design_catalog:=public.framework_canonical_design_catalog(5000);
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
           (screen->>'screenKey')||E'\x1f'||endpoint_hash,E'\n'
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
    'catalogHash',catalog_hash,'endpoints',endpoints);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_catalog(
  requested_limit integer DEFAULT 5000
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_canonical_endpoint_catalog(
    requested_limit,NULL::varchar)
$$;

COMMENT ON FUNCTION public.framework_canonical_endpoint_readiness(integer,varchar)
  IS 'Exact source readiness; global collisions are checked before process filtering';
COMMENT ON FUNCTION public.framework_canonical_endpoint_catalog(integer,varchar)
  IS 'Deterministic generator catalog that refuses PARTIAL readiness';

REVOKE ALL ON FUNCTION public.framework_canonical_design_catalog(integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_exact_keys(jsonb,text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_schema_valid(jsonb,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_java_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_has_forbidden_key(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_diagnostic(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_readiness(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_readiness(integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_catalog(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_catalog(integer,varchar) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    GRANT EXECUTE ON FUNCTION public.framework_canonical_design_catalog(integer,varchar) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_exact_keys(jsonb,text[]) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_schema_valid(jsonb,boolean) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_java_name(text) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_has_forbidden_key(jsonb) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_diagnostic(jsonb) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_readiness(integer) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_readiness(integer,varchar) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_catalog(integer) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_catalog(integer,varchar) TO carbonet_app;
  END IF;
END
$$;
