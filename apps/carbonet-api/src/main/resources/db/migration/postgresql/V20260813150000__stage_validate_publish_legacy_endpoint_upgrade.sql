-- Stage legacy API/DATABASE lanes as an immutable, derived endpoint overlay.
-- The mutable design source is read but is never updated by this migration.

DO $$
DECLARE compiler_owner name;
BEGIN
  SELECT pg_get_userbyid(proowner) INTO compiler_owner
    FROM pg_proc
   WHERE oid='public.framework_canonical_endpoint_diagnostic(jsonb)'::regprocedure;
  IF compiler_owner IS NULL OR compiler_owner<>current_user
     OR current_user='carbonet_app' THEN
    RAISE EXCEPTION 'endpoint upgrade migration role % does not own endpoint compiler (owner=%)',
      current_user,coalesce(compiler_owner::text,'MISSING')
      USING ERRCODE='42501';
  END IF;
END
$$;

CREATE TABLE public.framework_canonical_endpoint_upgrade_proposal (
  proposal_id bigserial PRIMARY KEY,
  schema_id varchar(80) NOT NULL
    CHECK (schema_id='carbonet.endpoint-upgrade-proposal/v1'),
  scope_process varchar(80) NOT NULL
    CHECK (scope_process='*' OR scope_process ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  source_design_catalog_text text NOT NULL,
  source_design_catalog_text_hash varchar(64) NOT NULL
    CHECK (source_design_catalog_text_hash ~ '^[0-9a-f]{64}$'),
  source_design_catalog_hash varchar(64) NOT NULL
    CHECK (source_design_catalog_hash ~ '^[0-9a-f]{64}$'),
  source_design_count integer NOT NULL CHECK (source_design_count>0),
  canonical_screen_count integer NOT NULL CHECK (canonical_screen_count>0),
  missing_contract_count integer NOT NULL CHECK (missing_contract_count>=0),
  duplicate_blueprint_count integer NOT NULL CHECK (duplicate_blueprint_count>=0),
  duplicate_contract_count integer NOT NULL CHECK (duplicate_contract_count>=0),
  incomplete_lane_count integer NOT NULL CHECK (incomplete_lane_count>=0),
  coverage_status varchar(20) NOT NULL CHECK (coverage_status IN ('COMPLETE','PARTIAL')),
  policy_text text NOT NULL,
  policy_hash varchar(64) NOT NULL CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  projected_design_catalog_hash varchar(64) NOT NULL
    CHECK (projected_design_catalog_hash ~ '^[0-9a-f]{64}$'),
  proposal_catalog_hash varchar(64) NOT NULL
    CHECK (proposal_catalog_hash ~ '^[0-9a-f]{64}$'),
  proposal_hash varchar(64) NOT NULL UNIQUE CHECK (proposal_hash ~ '^[0-9a-f]{64}$'),
  member_count integer NOT NULL CHECK (member_count>0 AND member_count<=5000),
  proposed_by varchar(100) NOT NULL CHECK (btrim(proposed_by)<>''),
  proposed_at timestamp NOT NULL DEFAULT current_timestamp,
  CHECK (source_design_count=canonical_screen_count+missing_contract_count+
    duplicate_blueprint_count+duplicate_contract_count+incomplete_lane_count),
  UNIQUE(scope_process,source_design_catalog_text_hash,policy_hash,proposal_catalog_hash),
  CHECK (encode(sha256(convert_to(source_design_catalog_text,'UTF8')),'hex')=
         source_design_catalog_text_hash),
  CHECK (encode(sha256(convert_to(policy_text,'UTF8')),'hex')=policy_hash),
  CHECK (canonical_screen_count=member_count),
  CHECK (
    (coverage_status='COMPLETE' AND
      source_design_count=canonical_screen_count AND
      missing_contract_count+duplicate_blueprint_count+
        duplicate_contract_count+incomplete_lane_count=0)
    OR
    (coverage_status='PARTIAL' AND
      (source_design_count<>canonical_screen_count OR
       missing_contract_count+duplicate_blueprint_count+
         duplicate_contract_count+incomplete_lane_count>0))
  )
);

CREATE TABLE public.framework_canonical_endpoint_upgrade_member (
  proposal_id bigint NOT NULL REFERENCES
    public.framework_canonical_endpoint_upgrade_proposal(proposal_id),
  ordinal integer NOT NULL CHECK (ordinal>0 AND ordinal<=5000),
  source_contract_id bigint NOT NULL,
  process_code varchar(80) NOT NULL CHECK (process_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  step_code varchar(100) NOT NULL CHECK (step_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  screen_key varchar(600) NOT NULL CHECK (btrim(screen_key)<>''),
  source_design_hash varchar(64) NOT NULL CHECK (source_design_hash ~ '^[0-9a-f]{64}$'),
  source_api_raw_text text NOT NULL,
  source_api_raw_hash varchar(64) NOT NULL CHECK (source_api_raw_hash ~ '^[0-9a-f]{64}$'),
  source_api_parsed_canonical_text text NOT NULL,
  source_api_parsed_hash varchar(64) NOT NULL CHECK (source_api_parsed_hash ~ '^[0-9a-f]{64}$'),
  source_database_raw_text text NOT NULL,
  source_database_raw_hash varchar(64) NOT NULL
    CHECK (source_database_raw_hash ~ '^[0-9a-f]{64}$'),
  source_database_parsed_canonical_text text NOT NULL,
  source_database_parsed_hash varchar(64) NOT NULL
    CHECK (source_database_parsed_hash ~ '^[0-9a-f]{64}$'),
  projected_design_text text NOT NULL,
  projected_design_hash varchar(64) NOT NULL
    CHECK (projected_design_hash ~ '^[0-9a-f]{64}$'),
  endpoint_text text NOT NULL,
  endpoint_hash varchar(64) NOT NULL CHECK (endpoint_hash ~ '^[0-9a-f]{64}$'),
  operation jsonb NOT NULL,
  member_hash varchar(64) NOT NULL CHECK (member_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(proposal_id,screen_key),
  UNIQUE(proposal_id,ordinal),
  UNIQUE(proposal_id,member_hash),
  CHECK (encode(sha256(convert_to(source_api_raw_text,'UTF8')),'hex')=
         source_api_raw_hash),
  CHECK (encode(sha256(convert_to(source_api_parsed_canonical_text,'UTF8')),'hex')=
         source_api_parsed_hash),
  CHECK (encode(sha256(convert_to(source_database_raw_text,'UTF8')),'hex')=
         source_database_raw_hash),
  CHECK (encode(sha256(convert_to(source_database_parsed_canonical_text,'UTF8')),'hex')=
         source_database_parsed_hash),
  CHECK (encode(sha256(convert_to(projected_design_text,'UTF8')),'hex')=
         projected_design_hash),
  CHECK (encode(sha256(convert_to(endpoint_text,'UTF8')),'hex')=endpoint_hash),
  CHECK (jsonb_typeof(operation)='object')
);

CREATE TABLE public.framework_canonical_endpoint_upgrade_validation (
  validation_id bigserial PRIMARY KEY,
  proposal_id bigint NOT NULL UNIQUE REFERENCES
    public.framework_canonical_endpoint_upgrade_proposal(proposal_id),
  proposal_hash varchar(64) NOT NULL CHECK (proposal_hash ~ '^[0-9a-f]{64}$'),
  validation_status varchar(20) NOT NULL CHECK (validation_status IN ('VALIDATED','REJECTED')),
  ready_count integer NOT NULL CHECK (ready_count>=0),
  blocker_count integer NOT NULL CHECK (blocker_count>=0),
  validation_text text NOT NULL,
  validation_hash varchar(64) NOT NULL UNIQUE CHECK (validation_hash ~ '^[0-9a-f]{64}$'),
  validated_by varchar(100) NOT NULL CHECK (btrim(validated_by)<>''),
  validated_at timestamp NOT NULL DEFAULT current_timestamp,
  CHECK (encode(sha256(convert_to(validation_text,'UTF8')),'hex')=validation_hash),
  CHECK ((validation_status='VALIDATED' AND blocker_count=0) OR
         (validation_status='REJECTED' AND blocker_count>0))
);

CREATE TABLE public.framework_canonical_endpoint_upgrade_release (
  release_id bigserial PRIMARY KEY,
  proposal_id bigint NOT NULL UNIQUE REFERENCES
    public.framework_canonical_endpoint_upgrade_proposal(proposal_id),
  validation_id bigint NOT NULL UNIQUE REFERENCES
    public.framework_canonical_endpoint_upgrade_validation(validation_id),
  proposal_hash varchar(64) NOT NULL CHECK (proposal_hash ~ '^[0-9a-f]{64}$'),
  source_design_catalog_text_hash varchar(64) NOT NULL
    CHECK (source_design_catalog_text_hash ~ '^[0-9a-f]{64}$'),
  validation_hash varchar(64) NOT NULL CHECK (validation_hash ~ '^[0-9a-f]{64}$'),
  source_design_catalog_hash varchar(64) NOT NULL
    CHECK (source_design_catalog_hash ~ '^[0-9a-f]{64}$'),
  projected_design_catalog_hash varchar(64) NOT NULL
    CHECK (projected_design_catalog_hash ~ '^[0-9a-f]{64}$'),
  endpoint_catalog_hash varchar(64) NOT NULL
    CHECK (endpoint_catalog_hash ~ '^[0-9a-f]{64}$'),
  proposal_catalog_hash varchar(64) NOT NULL
    CHECK (proposal_catalog_hash ~ '^[0-9a-f]{64}$'),
  coverage_hash varchar(64) NOT NULL CHECK (coverage_hash ~ '^[0-9a-f]{64}$'),
  release_hash varchar(64) NOT NULL UNIQUE CHECK (release_hash ~ '^[0-9a-f]{64}$'),
  member_count integer NOT NULL CHECK (member_count>0 AND member_count<=5000),
  coverage_status varchar(20) NOT NULL CHECK (coverage_status IN ('COMPLETE','PARTIAL')),
  published_by varchar(100) NOT NULL CHECK (btrim(published_by)<>''),
  idempotency_key varchar(200) NOT NULL CHECK (btrim(idempotency_key)<>''),
  evidence jsonb NOT NULL,
  eligibility varchar(20) NOT NULL CHECK (eligibility IN ('VALIDATED_ONLY','PUBLISHABLE')),
  published_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(idempotency_key),
  UNIQUE(proposal_hash,validation_hash)
);

CREATE TABLE public.framework_canonical_endpoint_upgrade_release_member (
  release_id bigint NOT NULL REFERENCES
    public.framework_canonical_endpoint_upgrade_release(release_id),
  ordinal integer NOT NULL CHECK (ordinal>0 AND ordinal<=5000),
  screen_key varchar(600) NOT NULL CHECK (btrim(screen_key)<>''),
  projected_design_hash varchar(64) NOT NULL
    CHECK (projected_design_hash ~ '^[0-9a-f]{64}$'),
  endpoint_hash varchar(64) NOT NULL CHECK (endpoint_hash ~ '^[0-9a-f]{64}$'),
  member_hash varchar(64) NOT NULL CHECK (member_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(release_id,screen_key),
  UNIQUE(release_id,ordinal)
);

CREATE TABLE public.framework_canonical_endpoint_upgrade_delivery_evidence (
  delivery_evidence_id bigserial PRIMARY KEY,
  proposal_id bigint NOT NULL REFERENCES
    public.framework_canonical_endpoint_upgrade_proposal(proposal_id),
  validation_id bigint NOT NULL REFERENCES
    public.framework_canonical_endpoint_upgrade_validation(validation_id),
  evidence_kind varchar(30) NOT NULL CHECK (evidence_kind IN (
    'ACCOUNT_RELAY','BUSINESS_E2E','VISUAL_QA')),
  evidence_hash varchar(64) NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  recorded_by varchar(100) NOT NULL CHECK (btrim(recorded_by)<>''),
  recorded_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(proposal_id,validation_id,evidence_kind)
);

CREATE TABLE public.framework_canonical_endpoint_upgrade_activation_event (
  activation_event_id bigserial PRIMARY KEY,
  release_id bigint NOT NULL REFERENCES
    public.framework_canonical_endpoint_upgrade_release(release_id),
  previous_release_id bigint REFERENCES
    public.framework_canonical_endpoint_upgrade_release(release_id),
  action varchar(20) NOT NULL CHECK (action IN ('ACTIVATE','ROLLBACK')),
  scope_process varchar(80) NOT NULL,
  idempotency_key varchar(200) NOT NULL UNIQUE CHECK (btrim(idempotency_key)<>''),
  payload_hash varchar(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  activated_by varchar(100) NOT NULL CHECK (btrim(activated_by)<>''),
  activated_at timestamp NOT NULL DEFAULT current_timestamp,
  CHECK (release_id IS DISTINCT FROM previous_release_id)
);

CREATE INDEX idx_endpoint_upgrade_member_proposal_ordinal
  ON public.framework_canonical_endpoint_upgrade_member(proposal_id,ordinal);
CREATE INDEX idx_endpoint_upgrade_evidence_proposal_validation
  ON public.framework_canonical_endpoint_upgrade_delivery_evidence(proposal_id,validation_id);
CREATE INDEX idx_endpoint_upgrade_member_process_ordinal
  ON public.framework_canonical_endpoint_upgrade_member(proposal_id,process_code,ordinal);
CREATE INDEX idx_endpoint_upgrade_release_member_ordinal
  ON public.framework_canonical_endpoint_upgrade_release_member(release_id,ordinal);
CREATE INDEX idx_endpoint_upgrade_activation_scope_latest
  ON public.framework_canonical_endpoint_upgrade_activation_event(
    scope_process,activation_event_id DESC);

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_upgrade_policy()
RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.endpoint-upgrade-policy/v1',
    'operationIdAlgorithm','Ep+sha256(screenKey)',
    'pathAlgorithm','/api/generated/canonical/{sha256(screenKey)}/{executionId}/command',
    'requestPolicy','RUNTIME_CONTEXT_ONLY_V1',
    'responsePolicy','PROCESS_COMMAND_RESULT_V1',
    'persistencePolicy','PROCESS_EXECUTION_AGGREGATE_V1',
    'rollbackPolicy','TRANSACTION_SAME_COMMAND_V1')
$$;

CREATE OR REPLACE FUNCTION public.framework_reject_canonical_endpoint_upgrade_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'canonical endpoint upgrade evidence is append-only'
    USING ERRCODE='55000';
END
$$;
CREATE OR REPLACE FUNCTION public.framework_project_legacy_endpoint_v1(
  screen jsonb
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE screen_key text:=screen->>'screenKey';
DECLARE canonical jsonb:=screen->'canonicalDesign';
DECLARE identity jsonb:=canonical->'identity';
DECLARE command_code text:=canonical#>>'{step,commandCode}';
DECLARE digest text;
DECLARE operation_id text;
DECLARE endpoint_path text;
DECLARE api jsonb;
DECLARE persistence jsonb;
DECLARE projected jsonb;
BEGIN
  IF jsonb_typeof(screen) IS DISTINCT FROM 'object'
     OR jsonb_typeof(canonical) IS DISTINCT FROM 'object'
     OR screen_key IS NULL
     OR screen->>'canonicalText' IS DISTINCT FROM canonical::text
     OR encode(sha256(convert_to(canonical::text,'UTF8')),'hex')
          IS DISTINCT FROM screen->>'designHash'
     OR NOT coalesce(command_code ~ '^[A-Z][A-Z0-9_]{1,79}$',false) THEN
    RAISE EXCEPTION 'legacy projection canonical source is malformed'
      USING ERRCODE='22023';
  END IF;
  digest:=encode(sha256(convert_to(screen_key,'UTF8')),'hex');
  operation_id:='Ep'||digest;
  endpoint_path:='/api/generated/canonical/'||digest||'/{executionId}/command';
  persistence:=jsonb_build_object(
    'persistenceId','PROCESS_EXECUTION_AGGREGATE',
    'entity','framework_process_execution',
    'operation','UPDATE',
    'primaryKey',jsonb_build_array('execution_id'),
    'tenantColumn','tenant_id',
    'projectColumn','project_id',
    'versionColumn','execution_version',
    'transactional',true);
  api:=jsonb_build_object(
    'authority',jsonb_build_object(
      'actorCodes',jsonb_build_array(identity->>'actorCode'),
      'audience',identity->>'audience',
      'authenticated',true,'projectScoped',true,'tenantScoped',true),
    'commandCode',command_code,
    'idempotencyRequired',true,
    'implementationKind','PROCESS_COMMAND_ADAPTER',
    'method','POST',
    'operationId',operation_id,
    'path',endpoint_path,
    'persistenceRef','PROCESS_EXECUTION_AGGREGATE',
    'processCode',identity->>'processCode',
    'request',jsonb_build_object(
      'contentType','application/json',
      'schema',jsonb_build_object(
        'properties',jsonb_build_object(
          'actorCode',jsonb_build_object('type','string'),
          'idempotencyKey',jsonb_build_object('type','string'),
          'projectId',jsonb_build_object('type','string'),
          'tenantId',jsonb_build_object('type','string')),
        'required',jsonb_build_array(
          'tenantId','projectId','actorCode','idempotencyKey'),
        'type','object')),
    'response',jsonb_build_object(
      'errors',jsonb_build_array(
        jsonb_build_object('code','INVALID_REQUEST','status',400),
        jsonb_build_object('code','AUTHENTICATION_REQUIRED','status',401),
        jsonb_build_object('code','ACCESS_DENIED','status',403),
        jsonb_build_object('code','INTERNAL_ERROR','status',500)),
      'schema',jsonb_build_object(
        'properties',jsonb_build_object(
          'eventId',jsonb_build_object('type','integer'),
          'idempotent',jsonb_build_object('type','boolean'),
          'success',jsonb_build_object('type','boolean'),
          'toState',jsonb_build_object('type','string')),
        'required',jsonb_build_array(
          'success','idempotent','eventId','toState'),
        'type','object'),
      'successStatus',200),
    'rollback',jsonb_build_object(
      'commandCode',command_code,'strategy','TRANSACTION'),
    'stepCode',identity->>'stepCode',
    'transactionPolicy','REQUIRED');
  projected:=jsonb_set(
    jsonb_set(canonical,'{lanes,API}',jsonb_build_array(api),false),
    '{lanes,DATABASE}',jsonb_build_array(persistence),false);
  RETURN jsonb_build_object(
    'screenKey',screen_key,
    'processCode',screen->>'processCode',
    'stepCode',screen->>'stepCode',
    'audience',screen->>'audience',
    'routePath',screen->>'routePath',
    'designHash',encode(sha256(convert_to(projected::text,'UTF8')),'hex'),
    'canonicalText',projected::text,
    'canonicalDesign',projected);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_upgrade_coverage(
  requested_process varchar DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
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
                   normalized_route)::integer blueprint_count
      FROM raw_blueprints
  ), contracts AS MATERIALIZED (
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
           )::integer complete_count
      FROM public.framework_professional_screen_contract c
     WHERE requested_process IS NULL OR c.process_code=requested_process
     GROUP BY c.process_code,c.step_code,c.audience,
              lower(split_part(c.route_path,'?',1))
  ), joined AS MATERIALIZED (
    SELECT b.*,coalesce(c.contract_count,0) contract_count,
           coalesce(c.complete_count,0) complete_count
      FROM scoped_blueprints b LEFT JOIN contracts c
        ON c.process_code=b.process_code
       AND c.step_code=b.step_code
       AND c.audience=b.audience
       AND c.normalized_route=b.normalized_route
  ), summary AS (
    SELECT count(*)::integer source_count,
      count(*) FILTER (
        WHERE blueprint_count=1 AND contract_count=1 AND complete_count=1
      )::integer member_count,
      count(*) FILTER (
        WHERE blueprint_count=1 AND contract_count=0
      )::integer missing_count,
      count(*) FILTER (WHERE blueprint_count>1)::integer blueprint_duplicate_count,
      count(*) FILTER (
        WHERE blueprint_count=1 AND contract_count>1
      )::integer contract_duplicate_count,
      count(*) FILTER (
        WHERE blueprint_count=1 AND contract_count=1 AND complete_count<>1
      )::integer incomplete_count
    FROM joined
  )
  SELECT jsonb_build_object(
    'status',case when source_count=member_count
      and missing_count+blueprint_duplicate_count+
          contract_duplicate_count+incomplete_count=0
      then 'COMPLETE' else 'PARTIAL' end,
    'sourceDesignCount',source_count,
    'memberCount',member_count,
    'missingContractCount',missing_count,
    'duplicateBlueprintCount',blueprint_duplicate_count,
    'duplicateContractCount',contract_duplicate_count,
    'incompleteLaneCount',incomplete_count,
    'blockerCount',missing_count+blueprint_duplicate_count+
      contract_duplicate_count+incomplete_count)
    INTO result FROM summary;
  RETURN result||jsonb_build_object(
    'coverageHash',encode(sha256(convert_to(concat_ws(E'\x1f',
      result->>'status',result->>'sourceDesignCount',result->>'memberCount',
      result->>'missingContractCount',result->>'duplicateBlueprintCount',
      result->>'duplicateContractCount',result->>'incompleteLaneCount',
      result->>'blockerCount'
    ),'UTF8')),'hex'));
END
$$;

CREATE OR REPLACE FUNCTION public.framework_strict_legacy_design_catalog(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
DECLARE compiled_count integer;
BEGIN
  IF requested_limit IS NULL OR requested_limit<1 OR requested_limit>5000
     OR (requested_process IS NOT NULL
       AND requested_process !~ '^[A-Z][A-Z0-9_]{1,79}$') THEN
    RAISE EXCEPTION 'strict legacy catalog scope is invalid'
      USING ERRCODE='22023';
  END IF;
  WITH raw_blueprints AS MATERIALIZED (
    SELECT b.*,
      count(*) OVER (
        PARTITION BY upper(b.process_code),upper(b.step_code),upper(b.audience),
          lower(split_part(b.route_path,'?',1)))::integer blueprint_count
      FROM public.framework_screen_blueprint b
     WHERE b.validation_status='VALID'
       AND (requested_process IS NULL OR b.process_code=requested_process)
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
      )::integer complete_count
    FROM public.framework_professional_screen_contract c
   WHERE requested_process IS NULL OR c.process_code=requested_process
   GROUP BY c.process_code,c.step_code,c.audience,
            lower(split_part(c.route_path,'?',1))
  ), compiled AS MATERIALIZED (
    SELECT p.development_order,b.process_code,s.step_order,b.audience,
      lower(split_part(b.route_path,'?',1)) route_path,b.blueprint_code,
      public.framework_canonical_screen_design(
        b.process_code,b.step_code,b.audience,b.route_path) canonical_design
    FROM raw_blueprints b
    JOIN contract_counts c
      ON c.process_code=b.process_code AND c.step_code=b.step_code
     AND c.audience=b.audience
     AND c.normalized_route=lower(split_part(b.route_path,'?',1))
    JOIN public.framework_process_definition p ON p.process_code=b.process_code
    JOIN public.framework_process_step s
      ON s.process_code=b.process_code AND s.step_code=b.step_code
   WHERE b.blueprint_count=1 AND c.contract_count=1 AND c.complete_count=1
  ), screens AS MATERIALIZED (
    SELECT row_number() OVER (
      ORDER BY development_order,process_code,step_order,audience,
               route_path,blueprint_code)::integer ordinal,
      jsonb_build_object(
        'screenKey',canonical_design#>>'{identity,screenKey}',
        'processCode',canonical_design#>>'{identity,processCode}',
        'stepCode',canonical_design#>>'{identity,stepCode}',
        'audience',canonical_design#>>'{identity,audience}',
        'routePath',canonical_design#>>'{identity,routePath}',
        'designHash',encode(sha256(convert_to(canonical_design::text,'UTF8')),'hex'),
        'canonicalText',canonical_design::text,
        'canonicalDesign',canonical_design) screen
    FROM compiled
  ), aggregate AS (
    SELECT count(*)::integer screen_count,
      jsonb_agg(screen ORDER BY ordinal) screens,
      encode(sha256(convert_to(string_agg(
        (screen->>'screenKey')||E'\x1f'||(screen->>'designHash'),E'\n'
        ORDER BY ordinal),'UTF8')),'hex') catalog_hash
    FROM screens
  )
  SELECT screen_count,jsonb_build_object(
    'schema','carbonet.canonical-design/v1',
    'catalogHash',catalog_hash,'screenCount',screen_count,'screens',screens)
    INTO compiled_count,result FROM aggregate;
  IF compiled_count=0 THEN
    RAISE EXCEPTION 'strict legacy catalog has no compilable screens'
      USING ERRCODE='P0002';
  END IF;
  IF compiled_count>requested_limit THEN
    RAISE EXCEPTION 'strict legacy catalog has % rows and exceeds limit %',
      compiled_count,requested_limit USING ERRCODE='54000';
  END IF;
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_upgrade_source(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE catalog jsonb;
DECLARE raw_catalog jsonb;
DECLARE coverage jsonb;
DECLARE projected_screens jsonb;
DECLARE projected_hash text;
DECLARE endpoint_rows jsonb;
DECLARE endpoint_hash text;
BEGIN
  IF requested_limit IS NULL OR requested_limit<1 OR requested_limit>5000 THEN
    RAISE EXCEPTION 'endpoint upgrade limit must be between 1 and 5000'
      USING ERRCODE='22023';
  END IF;
  coverage:=public.framework_canonical_endpoint_upgrade_coverage(requested_process);
  IF (coverage->>'memberCount')::integer=0 THEN
    RAISE EXCEPTION 'endpoint upgrade has no compilable screens'
      USING ERRCODE='P0002';
  END IF;
  IF (coverage->>'memberCount')::integer>requested_limit THEN
    RAISE EXCEPTION 'endpoint upgrade has % members and exceeds limit %',
      coverage->>'memberCount',requested_limit USING ERRCODE='54000';
  END IF;
  raw_catalog:=public.framework_strict_legacy_design_catalog(
    5000,requested_process);
  WITH source AS MATERIALIZED (
    SELECT ordinal,screen,
      count(*) OVER (PARTITION BY screen->>'screenKey') screen_key_count
      FROM jsonb_array_elements(raw_catalog->'screens')
           WITH ORDINALITY source(screen,ordinal)
  ), eligible AS MATERIALIZED (
    SELECT ordinal,screen FROM source WHERE screen_key_count=1
  ), aggregate AS (
    SELECT count(*)::integer screen_count,
      jsonb_agg(screen ORDER BY ordinal) screens,
      encode(sha256(convert_to(string_agg(
        (screen->>'screenKey')||E'\x1f'||(screen->>'designHash'),E'\n'
        ORDER BY ordinal),'UTF8')),'hex') catalog_hash
    FROM eligible
  )
  SELECT jsonb_build_object(
    'schema','carbonet.canonical-design/v1',
    'catalogHash',catalog_hash,'screenCount',screen_count,'screens',screens)
    INTO catalog FROM aggregate;
  IF (catalog->>'screenCount')::integer<>(coverage->>'memberCount')::integer THEN
    RAISE EXCEPTION 'strict eligible catalog has % members but coverage expects %',
      catalog->>'screenCount',coverage->>'memberCount' USING ERRCODE='55000';
  END IF;
  WITH projected AS MATERIALIZED (
    SELECT ordinal,screen source_screen,
           public.framework_project_legacy_endpoint_v1(screen) screen
      FROM jsonb_array_elements(catalog->'screens')
           WITH ORDINALITY source(screen,ordinal)
  ), diagnosed AS MATERIALIZED (
    SELECT ordinal,source_screen,screen,
           public.framework_canonical_endpoint_diagnostic(screen) diagnostic
      FROM projected
  ), endpoint_contracts AS MATERIALIZED (
    SELECT ordinal,source_screen,screen,diagnostic,
      jsonb_build_object(
        'screenKey',screen->>'screenKey',
        'routePath',screen->>'routePath',
        'audience',screen->>'audience',
        'source',jsonb_build_object(
          'schema','carbonet.canonical-design/v1',
          'designHash',screen->>'designHash'),
        'operations',jsonb_build_array(diagnostic->'operation')) endpoint_contract
      FROM diagnosed
  ), rows AS MATERIALIZED (
    SELECT *,endpoint_contract::text endpoint_text,
      encode(sha256(convert_to(endpoint_contract::text,'UTF8')),'hex') row_endpoint_hash
    FROM endpoint_contracts
  )
  SELECT jsonb_agg(screen ORDER BY ordinal),
    encode(sha256(convert_to(string_agg(
      (screen->>'screenKey')||E'\x1f'||(screen->>'designHash'),E'\n'
      ORDER BY ordinal),'UTF8')),'hex'),
    jsonb_agg(jsonb_build_object(
      'ordinal',ordinal,'sourceScreen',source_screen,
      'screen',screen,'diagnostic',diagnostic,
      'endpointContract',endpoint_contract,
      'endpointText',endpoint_text,'endpointHash',row_endpoint_hash)
      ORDER BY ordinal),
    encode(sha256(convert_to(string_agg(
      (screen->>'screenKey')||E'\x1f'||row_endpoint_hash,E'\n'
      ORDER BY ordinal),'UTF8')),'hex')
    INTO projected_screens,projected_hash,endpoint_rows,endpoint_hash
    FROM rows;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(endpoint_rows) row
     WHERE row#>>'{diagnostic,reason}'<>'READY'
  ) THEN
    RAISE EXCEPTION 'projected endpoint diagnostic rejected a member'
      USING ERRCODE='55000';
  END IF;
  IF EXISTS(
    SELECT 1 FROM (
      SELECT lower(row#>>'{diagnostic,operationId}') collision_key
        FROM jsonb_array_elements(endpoint_rows) row GROUP BY 1 HAVING count(*)>1
      UNION ALL
      SELECT lower(row#>>'{diagnostic,artifactName}')
        FROM jsonb_array_elements(endpoint_rows) row GROUP BY 1 HAVING count(*)>1
      UNION ALL
      SELECT lower(row#>>'{diagnostic,routeSignature}')
        FROM jsonb_array_elements(endpoint_rows) row GROUP BY 1 HAVING count(*)>1
    ) collision
  ) THEN
    RAISE EXCEPTION 'projected endpoint has a global artifact or route collision'
      USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object(
    'coverage',coverage,
    'sourceCatalog',catalog,
    'projectedDesignCatalog',jsonb_build_object(
      'schema','carbonet.canonical-design/v1',
      'catalogHash',projected_hash,
      'screenCount',jsonb_array_length(projected_screens),
      'screens',projected_screens),
    'endpointCatalog',jsonb_build_object(
      'schema','carbonet.canonical-endpoint-catalog/v1',
      'catalogHash',endpoint_hash,
      'endpoints',(
        SELECT jsonb_agg(jsonb_build_object(
          'screenKey',row#>>'{screen,screenKey}',
          'routePath',row#>>'{screen,routePath}',
          'audience',row#>>'{screen,audience}',
          'designHash',row#>>'{screen,designHash}',
          'canonicalText',row#>>'{screen,canonicalText}',
          'endpointHash',row->>'endpointHash',
          'endpointText',row->>'endpointText',
          'endpointContract',row->'endpointContract')
          ORDER BY (row->>'ordinal')::integer)
        FROM jsonb_array_elements(endpoint_rows) row)),
    'rows',endpoint_rows);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_upgrade_source(
  requested_limit integer DEFAULT 5000
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_canonical_endpoint_upgrade_source(
    requested_limit,NULL::varchar)
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_upgrade_member_hashes(
  source jsonb
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH rows AS MATERIALIZED (
    SELECT (row->>'ordinal')::integer ordinal,row,
      (
        SELECT c.contract_id
          FROM public.framework_professional_screen_contract c
         WHERE c.process_code=row#>>'{screen,processCode}'
           AND c.step_code=row#>>'{screen,stepCode}'
           AND c.audience=row#>>'{screen,audience}'
           AND lower(split_part(c.route_path,'?',1))=row#>>'{screen,routePath}'
      ) contract_id
      FROM jsonb_array_elements(source->'rows') row
  ), contract_source AS MATERIALIZED (
    SELECT rows.*,c.api_contract,c.data_contract
      FROM rows JOIN public.framework_professional_screen_contract c
        ON c.contract_id=rows.contract_id
  ), hashed AS MATERIALIZED (
    SELECT *,
      encode(sha256(convert_to(api_contract,'UTF8')),'hex') api_raw_hash,
      encode(sha256(convert_to(
        public.framework_strict_jsonb_array(api_contract)::text,'UTF8')),'hex')
        api_parsed_hash,
      encode(sha256(convert_to(data_contract,'UTF8')),'hex') db_raw_hash,
      encode(sha256(convert_to(
        public.framework_strict_jsonb_array(data_contract)::text,'UTF8')),'hex')
        db_parsed_hash
    FROM contract_source
  ), members AS MATERIALIZED (
    SELECT ordinal,encode(sha256(convert_to(concat_ws(E'\x1f',
      ordinal::text,contract_id::text,row#>>'{screen,processCode}',
      row#>>'{screen,stepCode}',row#>>'{screen,screenKey}',
      row#>>'{sourceScreen,designHash}',api_raw_hash,api_parsed_hash,
      db_raw_hash,db_parsed_hash,row#>>'{screen,designHash}',
      row->>'endpointHash'),'UTF8')),'hex') member_hash
    FROM hashed
  )
  SELECT jsonb_build_object(
    'memberCount',count(*)::integer,
    'memberHashes',jsonb_agg(member_hash ORDER BY ordinal),
    'proposalCatalogHash',encode(sha256(convert_to(
      string_agg(member_hash,E'\n' ORDER BY ordinal),'UTF8')),'hex'))
  FROM members
$$;

CREATE OR REPLACE FUNCTION public.framework_propose_canonical_endpoint_upgrade(
  request jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE actor text;
DECLARE requested_process varchar;
DECLARE requested_limit integer;
DECLARE scope_code varchar;
DECLARE source jsonb;
DECLARE coverage jsonb;
DECLARE policy jsonb;
DECLARE computed_policy_text text;
DECLARE computed_policy_hash text;
DECLARE computed_proposal_catalog_hash text;
DECLARE computed_projected_hash text;
DECLARE computed_source_hash text;
DECLARE computed_source_text text;
DECLARE computed_source_text_hash text;
DECLARE computed_proposal_hash text;
DECLARE candidate_id bigint;
DECLARE inserted_count integer;
DECLARE persisted public.framework_canonical_endpoint_upgrade_proposal%ROWTYPE;
BEGIN
  IF NOT public.framework_canonical_endpoint_exact_keys(
      request,ARRAY['policy','requestedBy','requestedLimit','requestedProcess','schema'])
     OR jsonb_typeof(request->'requestedBy') IS DISTINCT FROM 'string'
     OR request->>'schema' IS DISTINCT FROM 'carbonet.endpoint-upgrade-request/v1'
     OR request->>'policy' IS DISTINCT FROM 'RUNTIME_CONTEXT_ONLY_V1'
     OR jsonb_typeof(request->'requestedLimit') IS DISTINCT FROM 'number'
     OR (request->'requestedLimit')::text !~ '^[1-9][0-9]{0,3}$'
     OR (request->>'requestedLimit')::integer>5000
     OR (request->'requestedProcess'<>'null'::jsonb
       AND jsonb_typeof(request->'requestedProcess') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'endpoint upgrade proposal request is invalid'
      USING ERRCODE='22023';
  END IF;
  actor:=btrim(coalesce(request->>'requestedBy',''));
  requested_process:=request->>'requestedProcess';
  requested_limit:=(request->>'requestedLimit')::integer;
  IF actor='' OR (requested_process IS NOT NULL
     AND requested_process !~ '^[A-Z][A-Z0-9_]{1,79}$') THEN
    RAISE EXCEPTION 'endpoint upgrade actor/process is invalid'
      USING ERRCODE='22023';
  END IF;
  scope_code:=coalesce(requested_process,'*');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'canonical-endpoint-upgrade:'||scope_code,0));
  source:=public.framework_canonical_endpoint_upgrade_source(
    requested_limit,requested_process);
  coverage:=source->'coverage';
  policy:=public.framework_canonical_endpoint_upgrade_policy();
  computed_policy_text:=policy::text;
  computed_source_text:=(source->'sourceCatalog')::text;
  computed_source_text_hash:=encode(
    sha256(convert_to(computed_source_text,'UTF8')),'hex');
  computed_policy_hash:=encode(sha256(convert_to(computed_policy_text,'UTF8')),'hex');
  computed_source_hash:=source#>>'{sourceCatalog,catalogHash}';
  computed_projected_hash:=source#>>'{projectedDesignCatalog,catalogHash}';
  WITH rows AS MATERIALIZED (
    SELECT (row->>'ordinal')::integer ordinal,row,
      (
        SELECT c.contract_id
          FROM public.framework_professional_screen_contract c
         WHERE c.process_code=row#>>'{screen,processCode}'
           AND c.step_code=row#>>'{screen,stepCode}'
           AND c.audience=row#>>'{screen,audience}'
           AND lower(split_part(c.route_path,'?',1))=row#>>'{screen,routePath}'
      ) contract_id
      FROM jsonb_array_elements(source->'rows') row
  ), contract_source AS MATERIALIZED (
    SELECT rows.*,c.api_contract,c.data_contract
      FROM rows JOIN public.framework_professional_screen_contract c
        ON c.contract_id=rows.contract_id
  ), hashed AS MATERIALIZED (
    SELECT *,
      encode(sha256(convert_to(api_contract,'UTF8')),'hex') api_raw_hash,
      encode(sha256(convert_to(
        public.framework_strict_jsonb_array(api_contract)::text,'UTF8')),'hex')
        api_parsed_hash,
      encode(sha256(convert_to(data_contract,'UTF8')),'hex') db_raw_hash,
      encode(sha256(convert_to(
        public.framework_strict_jsonb_array(data_contract)::text,'UTF8')),'hex')
        db_parsed_hash
    FROM contract_source
  ), members AS MATERIALIZED (
    SELECT *,encode(sha256(convert_to(concat_ws(E'\x1f',
      ordinal::text,contract_id::text,row#>>'{screen,processCode}',
      row#>>'{screen,stepCode}',row#>>'{screen,screenKey}',
      row#>>'{sourceScreen,designHash}',api_raw_hash,api_parsed_hash,
      db_raw_hash,db_parsed_hash,row#>>'{screen,designHash}',
      row->>'endpointHash'),'UTF8')),'hex') member_hash
    FROM hashed
  )
  SELECT encode(sha256(convert_to(string_agg(
           member_hash,E'\n' ORDER BY ordinal),'UTF8')),'hex')
    INTO computed_proposal_catalog_hash FROM members;
  SELECT * INTO persisted
    FROM public.framework_canonical_endpoint_upgrade_proposal proposal
   WHERE proposal.scope_process=scope_code
     AND proposal.source_design_catalog_hash=computed_source_hash
     AND proposal.source_design_catalog_text_hash=computed_source_text_hash
     AND proposal.policy_hash=computed_policy_hash
     AND proposal.proposal_catalog_hash=computed_proposal_catalog_hash;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'proposalId',persisted.proposal_id,'status','DRAFT',
      'proposalHash',persisted.proposal_hash,
      'sourceDesignCatalogHash',persisted.source_design_catalog_hash,
      'projectedDesignCatalogHash',persisted.projected_design_catalog_hash,
      'sourceDesignCatalogTextHash',persisted.source_design_catalog_text_hash,
      'proposalCatalogHash',persisted.proposal_catalog_hash,
      'memberCount',persisted.member_count,
      'coverageStatus',persisted.coverage_status);
  END IF;
  candidate_id:=nextval(pg_get_serial_sequence(
    'public.framework_canonical_endpoint_upgrade_proposal','proposal_id'));
  computed_proposal_hash:=encode(sha256(convert_to(concat_ws(E'\x1f',
    candidate_id::text,computed_policy_hash,computed_source_text_hash,
    computed_source_hash,computed_projected_hash,coverage->>'memberCount',
    computed_proposal_catalog_hash),'UTF8')),'hex');
  INSERT INTO public.framework_canonical_endpoint_upgrade_proposal(
    proposal_id,schema_id,scope_process,source_design_catalog_text,
    source_design_catalog_text_hash,source_design_catalog_hash,
    source_design_count,canonical_screen_count,missing_contract_count,
    duplicate_blueprint_count,duplicate_contract_count,incomplete_lane_count,
    coverage_status,policy_text,policy_hash,projected_design_catalog_hash,
    proposal_catalog_hash,proposal_hash,member_count,proposed_by)
  VALUES(candidate_id,'carbonet.endpoint-upgrade-proposal/v1',scope_code,
    computed_source_text,computed_source_text_hash,computed_source_hash,
    (coverage->>'sourceDesignCount')::integer,(coverage->>'memberCount')::integer,
    (coverage->>'missingContractCount')::integer,
    (coverage->>'duplicateBlueprintCount')::integer,
    (coverage->>'duplicateContractCount')::integer,
    (coverage->>'incompleteLaneCount')::integer,
    coverage->>'status',computed_policy_text,computed_policy_hash,
    computed_projected_hash,computed_proposal_catalog_hash,
    computed_proposal_hash,(coverage->>'memberCount')::integer,actor)
  RETURNING * INTO persisted;
  WITH rows AS MATERIALIZED (
    SELECT (row->>'ordinal')::integer ordinal,row,
      (
        SELECT c.contract_id
          FROM public.framework_professional_screen_contract c
         WHERE c.process_code=row#>>'{screen,processCode}'
           AND c.step_code=row#>>'{screen,stepCode}'
           AND c.audience=row#>>'{screen,audience}'
           AND lower(split_part(c.route_path,'?',1))=row#>>'{screen,routePath}'
      ) contract_id
      FROM jsonb_array_elements(source->'rows') row
  ), contract_source AS MATERIALIZED (
    SELECT rows.*,c.api_contract,c.data_contract
      FROM rows JOIN public.framework_professional_screen_contract c
        ON c.contract_id=rows.contract_id
  ), hashed AS MATERIALIZED (
    SELECT *,
      encode(sha256(convert_to(api_contract,'UTF8')),'hex') api_raw_hash,
      encode(sha256(convert_to(
        public.framework_strict_jsonb_array(api_contract)::text,'UTF8')),'hex')
        api_parsed_hash,
      encode(sha256(convert_to(data_contract,'UTF8')),'hex') db_raw_hash,
      encode(sha256(convert_to(
        public.framework_strict_jsonb_array(data_contract)::text,'UTF8')),'hex')
        db_parsed_hash
    FROM contract_source
  )
  INSERT INTO public.framework_canonical_endpoint_upgrade_member(
    proposal_id,ordinal,source_contract_id,process_code,step_code,screen_key,
    source_design_hash,source_api_raw_text,source_api_raw_hash,
    source_api_parsed_canonical_text,source_api_parsed_hash,
    source_database_raw_text,source_database_raw_hash,
    source_database_parsed_canonical_text,source_database_parsed_hash,
    projected_design_text,projected_design_hash,endpoint_text,endpoint_hash,
    operation,member_hash)
  SELECT candidate_id,ordinal,contract_id,row#>>'{screen,processCode}',
    row#>>'{screen,stepCode}',row#>>'{screen,screenKey}',
    row#>>'{sourceScreen,designHash}',api_contract,api_raw_hash,
    public.framework_strict_jsonb_array(api_contract)::text,api_parsed_hash,
    data_contract,db_raw_hash,
    public.framework_strict_jsonb_array(data_contract)::text,db_parsed_hash,
    row#>>'{screen,canonicalText}',row#>>'{screen,designHash}',
    row->>'endpointText',row->>'endpointHash',row#>'{diagnostic,operation}',
    encode(sha256(convert_to(concat_ws(E'\x1f',
      ordinal::text,contract_id::text,row#>>'{screen,processCode}',
      row#>>'{screen,stepCode}',row#>>'{screen,screenKey}',
      row#>>'{sourceScreen,designHash}',api_raw_hash,api_parsed_hash,
      db_raw_hash,db_parsed_hash,row#>>'{screen,designHash}',
      row->>'endpointHash'),'UTF8')),'hex')
  FROM hashed ORDER BY ordinal;
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  IF inserted_count<>persisted.member_count
     OR public.framework_canonical_endpoint_upgrade_member_hashes(source)
          ->>'proposalCatalogHash'<>persisted.proposal_catalog_hash THEN
    RAISE EXCEPTION 'endpoint upgrade proposal member persistence mismatch'
      USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object(
    'proposalId',candidate_id,'status','DRAFT','proposalHash',computed_proposal_hash,
    'sourceDesignCatalogHash',computed_source_hash,
    'sourceDesignCatalogTextHash',computed_source_text_hash,
    'projectedDesignCatalogHash',computed_projected_hash,
    'proposalCatalogHash',computed_proposal_catalog_hash,
    'memberCount',persisted.member_count,'coverageStatus',persisted.coverage_status);
END
$$;
CREATE OR REPLACE FUNCTION public.framework_validate_canonical_endpoint_upgrade(
  request jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE actor text;
DECLARE requested_proposal_id bigint;
DECLARE expected_hash text;
DECLARE proposal public.framework_canonical_endpoint_upgrade_proposal%ROWTYPE;
DECLARE current_source jsonb;
DECLARE current_text_hash text;
DECLARE computed_members integer;
DECLARE computed_ready integer;
DECLARE computed_blockers integer;
DECLARE status_value text;
DECLARE candidate_id bigint;
DECLARE computed_validation_hash text;
DECLARE validation_text_value text;
DECLARE persisted public.framework_canonical_endpoint_upgrade_validation%ROWTYPE;
BEGIN
  IF NOT public.framework_canonical_endpoint_exact_keys(
       request,ARRAY['expectedProposalHash','proposalId','schema','validatedBy'])
     OR request->>'schema' IS DISTINCT FROM
          'carbonet.endpoint-upgrade-validation-request/v1'
     OR jsonb_typeof(request->'proposalId') IS DISTINCT FROM 'number'
     OR (request->'proposalId')::text !~ '^[1-9][0-9]*$'
     OR jsonb_typeof(request->'expectedProposalHash') IS DISTINCT FROM 'string'
     OR NOT coalesce(request->>'expectedProposalHash' ~ '^[0-9a-f]{64}$',false)
     OR jsonb_typeof(request->'validatedBy') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'endpoint upgrade validation request is invalid'
      USING ERRCODE='22023';
  END IF;
  actor:=btrim(request->>'validatedBy');
  requested_proposal_id:=(request->>'proposalId')::bigint;
  expected_hash:=request->>'expectedProposalHash';
  IF actor='' THEN
    RAISE EXCEPTION 'endpoint upgrade validator is required'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'canonical-endpoint-upgrade:proposal:'||requested_proposal_id,0));
  SELECT * INTO STRICT proposal
    FROM public.framework_canonical_endpoint_upgrade_proposal
   WHERE proposal_id=requested_proposal_id;
  IF proposal.proposal_hash<>expected_hash THEN
    RAISE EXCEPTION 'endpoint upgrade proposal hash changed'
      USING ERRCODE='40001';
  END IF;
  current_source:=public.framework_canonical_endpoint_upgrade_source(
    5000,nullif(proposal.scope_process,'*'));
  current_text_hash:=encode(sha256(convert_to(
    (current_source->'sourceCatalog')::text,'UTF8')),'hex');
  IF current_text_hash<>proposal.source_design_catalog_text_hash
     OR current_source#>>'{sourceCatalog,catalogHash}'<>
          proposal.source_design_catalog_hash
     OR current_source#>>'{projectedDesignCatalog,catalogHash}'<>
          proposal.projected_design_catalog_hash
     OR public.framework_canonical_endpoint_upgrade_member_hashes(current_source)
          ->>'proposalCatalogHash'<>proposal.proposal_catalog_hash THEN
    RAISE EXCEPTION 'endpoint upgrade source changed after proposal'
      USING ERRCODE='40001';
  END IF;
  WITH checked AS MATERIALIZED (
    SELECT member.*,
      public.framework_canonical_endpoint_diagnostic(jsonb_build_object(
        'screenKey',member.screen_key,
        'processCode',member.process_code,
        'stepCode',member.step_code,
        'audience',(member.projected_design_text::jsonb)#>>'{identity,audience}',
        'routePath',(member.projected_design_text::jsonb)#>>'{identity,routePath}',
        'designHash',member.projected_design_hash,
        'canonicalText',member.projected_design_text,
        'canonicalDesign',member.projected_design_text::jsonb)) diagnostic
    FROM public.framework_canonical_endpoint_upgrade_member member
    WHERE member.proposal_id=requested_proposal_id
  ), summary AS (
    SELECT count(*)::integer member_count,
      count(*) FILTER (WHERE diagnostic->>'reason'='READY')::integer ready_count,
      count(*) FILTER (WHERE diagnostic->>'reason'<>'READY')::integer blocker_count
    FROM checked
  )
  SELECT member_count,ready_count,
    blocker_count+CASE WHEN member_count<>proposal.member_count THEN 1 ELSE 0 END
    INTO computed_members,computed_ready,computed_blockers
    FROM summary;
  IF computed_blockers=0 AND (
    EXISTS(
      SELECT 1 FROM public.framework_canonical_endpoint_upgrade_member member
      WHERE member.proposal_id=requested_proposal_id
      GROUP BY lower(member.operation->>'operationId') HAVING count(*)>1
    ) OR EXISTS(
      SELECT 1 FROM public.framework_canonical_endpoint_upgrade_member member
      WHERE member.proposal_id=requested_proposal_id
      GROUP BY lower(public.framework_canonical_endpoint_java_name(
        member.operation->>'operationId')) HAVING count(*)>1
    ) OR EXISTS(
      SELECT 1 FROM public.framework_canonical_endpoint_upgrade_member member
      WHERE member.proposal_id=requested_proposal_id
      GROUP BY lower((member.operation->>'method')||' '||
                     (member.operation->>'path')) HAVING count(*)>1
    )) THEN
    computed_blockers:=computed_blockers+1;
  END IF;
  status_value:=case when computed_blockers=0
    and computed_ready=proposal.member_count then 'VALIDATED' else 'REJECTED' end;
  SELECT * INTO persisted
    FROM public.framework_canonical_endpoint_upgrade_validation validation
   WHERE validation.proposal_id=requested_proposal_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'validationId',persisted.validation_id,
      'proposalId',persisted.proposal_id,
      'status',persisted.validation_status,
      'readyCount',persisted.ready_count,
      'blockerCount',persisted.blocker_count,
      'validationHash',persisted.validation_hash);
  END IF;
  candidate_id:=nextval(pg_get_serial_sequence(
    'public.framework_canonical_endpoint_upgrade_validation','validation_id'));
  computed_validation_hash:=encode(sha256(convert_to(concat_ws(E'\x1f',
    candidate_id::text,requested_proposal_id::text,status_value,
    computed_ready::text,computed_blockers::text,proposal.proposal_hash
  ),'UTF8')),'hex');
  validation_text_value:=concat_ws(E'\x1f',
    candidate_id::text,requested_proposal_id::text,status_value,
    computed_ready::text,computed_blockers::text,proposal.proposal_hash);
  INSERT INTO public.framework_canonical_endpoint_upgrade_validation(
    validation_id,proposal_id,proposal_hash,validation_status,
    ready_count,blocker_count,validation_text,validation_hash,validated_by)
  VALUES(candidate_id,requested_proposal_id,proposal.proposal_hash,status_value,
    computed_ready,computed_blockers,validation_text_value,
    computed_validation_hash,actor)
  RETURNING * INTO persisted;
  RETURN jsonb_build_object(
    'validationId',persisted.validation_id,'proposalId',persisted.proposal_id,
    'status',persisted.validation_status,'readyCount',persisted.ready_count,
    'blockerCount',persisted.blocker_count,
    'validationHash',persisted.validation_hash);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_record_canonical_endpoint_upgrade_evidence(
  request jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE actor text;
DECLARE requested_proposal_id bigint;
DECLARE requested_validation_id bigint;
DECLARE requested_kind text;
DECLARE requested_hash text;
DECLARE persisted public.framework_canonical_endpoint_upgrade_delivery_evidence%ROWTYPE;
BEGIN
  IF NOT public.framework_canonical_endpoint_exact_keys(
       request,ARRAY[
         'evidenceHash','evidenceKind','proposalId','recordedBy','schema','validationId'])
     OR request->>'schema' IS DISTINCT FROM
          'carbonet.endpoint-upgrade-evidence-request/v1'
     OR jsonb_typeof(request->'proposalId') IS DISTINCT FROM 'number'
     OR jsonb_typeof(request->'validationId') IS DISTINCT FROM 'number'
     OR (request->'proposalId')::text !~ '^[1-9][0-9]*$'
     OR (request->'validationId')::text !~ '^[1-9][0-9]*$'
     OR jsonb_typeof(request->'evidenceKind') IS DISTINCT FROM 'string'
     OR request->>'evidenceKind' NOT IN
          ('ACCOUNT_RELAY','BUSINESS_E2E','VISUAL_QA')
     OR jsonb_typeof(request->'evidenceHash') IS DISTINCT FROM 'string'
     OR NOT coalesce(request->>'evidenceHash' ~ '^[0-9a-f]{64}$',false)
     OR jsonb_typeof(request->'recordedBy') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'endpoint upgrade evidence request is invalid'
      USING ERRCODE='22023';
  END IF;
  actor:=btrim(request->>'recordedBy');
  requested_proposal_id:=(request->>'proposalId')::bigint;
  requested_validation_id:=(request->>'validationId')::bigint;
  requested_kind:=request->>'evidenceKind';
  requested_hash:=request->>'evidenceHash';
  IF actor='' OR NOT EXISTS(
    SELECT 1 FROM public.framework_canonical_endpoint_upgrade_validation validation
     WHERE validation.validation_id=requested_validation_id
       AND validation.proposal_id=requested_proposal_id
       AND validation.validation_status='VALIDATED'
       AND validation.blocker_count=0
  ) THEN
    RAISE EXCEPTION 'validated endpoint upgrade evidence target is required'
      USING ERRCODE='55000';
  END IF;
  INSERT INTO public.framework_canonical_endpoint_upgrade_delivery_evidence(
    proposal_id,validation_id,evidence_kind,evidence_hash,recorded_by)
  VALUES(requested_proposal_id,requested_validation_id,requested_kind,
         requested_hash,actor)
  ON CONFLICT(proposal_id,validation_id,evidence_kind) DO NOTHING;
  SELECT * INTO STRICT persisted
    FROM public.framework_canonical_endpoint_upgrade_delivery_evidence evidence
   WHERE evidence.proposal_id=requested_proposal_id
     AND evidence.validation_id=requested_validation_id
     AND evidence.evidence_kind=requested_kind;
  IF persisted.evidence_hash<>requested_hash THEN
    RAISE EXCEPTION 'endpoint upgrade evidence idempotency conflict'
      USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object(
    'deliveryEvidenceId',persisted.delivery_evidence_id,
    'proposalId',persisted.proposal_id,'validationId',persisted.validation_id,
    'evidenceKind',persisted.evidence_kind,
    'evidenceHash',persisted.evidence_hash,'status','VERIFIED');
END
$$;


CREATE OR REPLACE FUNCTION public.framework_publish_canonical_endpoint_upgrade(
  request jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE actor text;
DECLARE requested_proposal_id bigint;
DECLARE expected_proposal_hash text;
DECLARE expected_validation_hash text;
DECLARE requested_idempotency_key text;
DECLARE proposal public.framework_canonical_endpoint_upgrade_proposal%ROWTYPE;
DECLARE validation public.framework_canonical_endpoint_upgrade_validation%ROWTYPE;
DECLARE current_source jsonb;
DECLARE endpoint_catalog_hash_value text;
DECLARE coverage_hash_value text;
DECLARE evidence_value jsonb;
DECLARE eligibility_value text;
DECLARE candidate_id bigint;
DECLARE computed_release_hash text;
DECLARE persisted public.framework_canonical_endpoint_upgrade_release%ROWTYPE;
BEGIN
  IF NOT public.framework_canonical_endpoint_exact_keys(
       request,ARRAY[
         'expectedProposalHash','expectedValidationHash','idempotencyKey',
         'proposalId','publishedBy','schema'])
     OR request->>'schema' IS DISTINCT FROM
          'carbonet.endpoint-upgrade-publish-request/v1'
     OR jsonb_typeof(request->'proposalId') IS DISTINCT FROM 'number'
     OR (request->'proposalId')::text !~ '^[1-9][0-9]*$'
     OR jsonb_typeof(request->'expectedProposalHash') IS DISTINCT FROM 'string'
     OR jsonb_typeof(request->'expectedValidationHash') IS DISTINCT FROM 'string'
     OR NOT coalesce(request->>'expectedProposalHash' ~ '^[0-9a-f]{64}$',false)
     OR NOT coalesce(request->>'expectedValidationHash' ~ '^[0-9a-f]{64}$',false)
     OR jsonb_typeof(request->'idempotencyKey') IS DISTINCT FROM 'string'
     OR jsonb_typeof(request->'publishedBy') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'endpoint upgrade publish request is invalid'
      USING ERRCODE='22023';
  END IF;
  actor:=btrim(request->>'publishedBy');
  requested_idempotency_key:=btrim(request->>'idempotencyKey');
  requested_proposal_id:=(request->>'proposalId')::bigint;
  expected_proposal_hash:=request->>'expectedProposalHash';
  expected_validation_hash:=request->>'expectedValidationHash';
  IF actor='' OR requested_idempotency_key='' THEN
    RAISE EXCEPTION 'endpoint upgrade publisher/idempotency key is required'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'canonical-endpoint-upgrade:proposal:'||requested_proposal_id,0));
  SELECT * INTO persisted
    FROM public.framework_canonical_endpoint_upgrade_release release
   WHERE release.idempotency_key=requested_idempotency_key;
  IF FOUND THEN
    IF persisted.idempotency_key<>requested_idempotency_key
       OR persisted.proposal_id<>requested_proposal_id
       OR persisted.proposal_hash<>expected_proposal_hash
       OR persisted.validation_hash<>expected_validation_hash
       OR persisted.published_by<>actor
       OR NOT EXISTS(
         SELECT 1
           FROM public.framework_canonical_endpoint_upgrade_proposal existing_proposal
           JOIN public.framework_canonical_endpoint_upgrade_validation existing_validation
             ON existing_validation.proposal_id=existing_proposal.proposal_id
          WHERE existing_proposal.proposal_id=persisted.proposal_id
            AND existing_proposal.proposal_hash=expected_proposal_hash
            AND existing_validation.validation_id=persisted.validation_id
            AND existing_validation.validation_hash=expected_validation_hash
            AND existing_validation.validation_status='VALIDATED'
            AND existing_validation.blocker_count=0
       ) THEN
      RAISE EXCEPTION 'endpoint upgrade publish idempotency conflict'
        USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'releaseId',persisted.release_id,'status','PUBLISHED',
      'coverageStatus',persisted.coverage_status,
      'memberCount',persisted.member_count,'proposalHash',persisted.proposal_hash,
      'validationHash',persisted.validation_hash,
      'sourceDesignCatalogHash',persisted.source_design_catalog_hash,
      'sourceDesignCatalogTextHash',persisted.source_design_catalog_text_hash,
      'projectedDesignCatalogHash',persisted.projected_design_catalog_hash,
      'endpointCatalogHash',persisted.endpoint_catalog_hash,
      'proposalCatalogHash',persisted.proposal_catalog_hash,
      'coverageHash',persisted.coverage_hash,
      'releaseHash',persisted.release_hash,'evidence',persisted.evidence,
      'eligibility',persisted.eligibility);
  END IF;
  SELECT * INTO STRICT proposal
    FROM public.framework_canonical_endpoint_upgrade_proposal
   WHERE proposal_id=requested_proposal_id;
  SELECT * INTO STRICT validation
    FROM public.framework_canonical_endpoint_upgrade_validation
   WHERE proposal_id=requested_proposal_id;
  IF proposal.proposal_hash<>expected_proposal_hash
     OR validation.validation_hash<>expected_validation_hash
     OR validation.validation_status<>'VALIDATED'
     OR validation.blocker_count<>0
     OR validation.ready_count<>proposal.member_count THEN
    RAISE EXCEPTION 'endpoint upgrade publish validation binding failed'
      USING ERRCODE='55000';
  END IF;
  current_source:=public.framework_canonical_endpoint_upgrade_source(
    5000,nullif(proposal.scope_process,'*'));
  IF encode(sha256(convert_to((current_source->'sourceCatalog')::text,'UTF8')),'hex')
       <>proposal.source_design_catalog_text_hash
     OR current_source#>>'{sourceCatalog,catalogHash}'<>
          proposal.source_design_catalog_hash
     OR current_source#>>'{projectedDesignCatalog,catalogHash}'<>
          proposal.projected_design_catalog_hash
     OR public.framework_canonical_endpoint_upgrade_member_hashes(current_source)
          ->>'proposalCatalogHash'<>proposal.proposal_catalog_hash THEN
    RAISE EXCEPTION 'endpoint upgrade source changed before publish'
      USING ERRCODE='40001';
  END IF;
  endpoint_catalog_hash_value:=current_source#>>'{endpointCatalog,catalogHash}';
  coverage_hash_value:=current_source#>>'{coverage,coverageHash}';
  SELECT jsonb_build_object(
    'accountRelay',jsonb_build_object(
      'status',case when count(*) FILTER (WHERE evidence_kind='ACCOUNT_RELAY')=1
        then 'VERIFIED' else 'ABSENT' end,
      'evidenceHash',max(evidence_hash) FILTER (WHERE evidence_kind='ACCOUNT_RELAY')),
    'businessE2E',jsonb_build_object(
      'status',case when count(*) FILTER (WHERE evidence_kind='BUSINESS_E2E')=1
        then 'VERIFIED' else 'ABSENT' end,
      'evidenceHash',max(evidence_hash) FILTER (WHERE evidence_kind='BUSINESS_E2E')),
    'visualQA',jsonb_build_object(
      'status',case when count(*) FILTER (WHERE evidence_kind='VISUAL_QA')=1
        then 'VERIFIED' else 'ABSENT' end,
      'evidenceHash',max(evidence_hash) FILTER (WHERE evidence_kind='VISUAL_QA')))
    INTO evidence_value
    FROM public.framework_canonical_endpoint_upgrade_delivery_evidence evidence
   WHERE evidence.proposal_id=proposal.proposal_id
     AND evidence.validation_id=validation.validation_id;
  eligibility_value:=case
    when proposal.coverage_status='COMPLETE'
     and evidence_value#>>'{accountRelay,status}'='VERIFIED'
     and evidence_value#>>'{businessE2E,status}'='VERIFIED'
     and evidence_value#>>'{visualQA,status}'='VERIFIED'
    then 'PUBLISHABLE' else 'VALIDATED_ONLY' end;
  IF proposal.coverage_status='COMPLETE'
     AND eligibility_value<>'PUBLISHABLE' THEN
    RAISE EXCEPTION 'complete endpoint release requires all delivery evidence'
      USING ERRCODE='55000';
  END IF;
  SELECT * INTO persisted
    FROM public.framework_canonical_endpoint_upgrade_release release
   WHERE release.idempotency_key=requested_idempotency_key;
  IF FOUND THEN
    IF persisted.proposal_id<>proposal.proposal_id
       OR persisted.validation_id<>validation.validation_id
       OR persisted.idempotency_key<>requested_idempotency_key
       OR persisted.proposal_hash<>expected_proposal_hash
       OR persisted.validation_hash<>expected_validation_hash
       OR persisted.published_by<>actor THEN
      RAISE EXCEPTION 'endpoint upgrade publish idempotency conflict'
        USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'releaseId',persisted.release_id,'status','PUBLISHED',
      'coverageStatus',persisted.coverage_status,
      'memberCount',persisted.member_count,'proposalHash',persisted.proposal_hash,
      'validationHash',persisted.validation_hash,
      'sourceDesignCatalogHash',persisted.source_design_catalog_hash,
      'sourceDesignCatalogTextHash',persisted.source_design_catalog_text_hash,
      'projectedDesignCatalogHash',persisted.projected_design_catalog_hash,
      'endpointCatalogHash',persisted.endpoint_catalog_hash,
      'proposalCatalogHash',persisted.proposal_catalog_hash,
      'coverageHash',persisted.coverage_hash,
      'releaseHash',persisted.release_hash,'evidence',persisted.evidence,
      'eligibility',persisted.eligibility);
  END IF;
  candidate_id:=nextval(pg_get_serial_sequence(
    'public.framework_canonical_endpoint_upgrade_release','release_id'));
  computed_release_hash:=encode(sha256(convert_to(concat_ws(E'\x1f',
    candidate_id::text,'PUBLISHED',proposal.coverage_status,
    proposal.member_count::text,proposal.proposal_hash,validation.validation_hash,
    proposal.source_design_catalog_text_hash,proposal.source_design_catalog_hash,
    proposal.projected_design_catalog_hash,endpoint_catalog_hash_value,
    proposal.proposal_catalog_hash,coverage_hash_value,
    evidence_value#>>'{accountRelay,status}',
    coalesce(evidence_value#>>'{accountRelay,evidenceHash}',''),
    evidence_value#>>'{businessE2E,status}',
    coalesce(evidence_value#>>'{businessE2E,evidenceHash}',''),
    evidence_value#>>'{visualQA,status}',
    coalesce(evidence_value#>>'{visualQA,evidenceHash}',''),
    eligibility_value),'UTF8')),'hex');
  INSERT INTO public.framework_canonical_endpoint_upgrade_release(
    release_id,proposal_id,validation_id,proposal_hash,
    source_design_catalog_text_hash,validation_hash,source_design_catalog_hash,
    projected_design_catalog_hash,endpoint_catalog_hash,proposal_catalog_hash,
    coverage_hash,release_hash,member_count,coverage_status,published_by,
    idempotency_key,evidence,eligibility)
  VALUES(candidate_id,proposal.proposal_id,validation.validation_id,
    proposal.proposal_hash,proposal.source_design_catalog_text_hash,
    validation.validation_hash,proposal.source_design_catalog_hash,
    proposal.projected_design_catalog_hash,endpoint_catalog_hash_value,
    proposal.proposal_catalog_hash,coverage_hash_value,computed_release_hash,
    proposal.member_count,proposal.coverage_status,actor,
    requested_idempotency_key,evidence_value,eligibility_value)
  RETURNING * INTO persisted;
  INSERT INTO public.framework_canonical_endpoint_upgrade_release_member(
    release_id,ordinal,screen_key,projected_design_hash,endpoint_hash,member_hash)
  SELECT persisted.release_id,member.ordinal,member.screen_key,
    member.projected_design_hash,member.endpoint_hash,member.member_hash
    FROM public.framework_canonical_endpoint_upgrade_member member
   WHERE member.proposal_id=proposal.proposal_id ORDER BY member.ordinal;
  RETURN jsonb_build_object(
    'releaseId',persisted.release_id,'status','PUBLISHED',
    'coverageStatus',persisted.coverage_status,'memberCount',persisted.member_count,
    'proposalHash',persisted.proposal_hash,'validationHash',persisted.validation_hash,
    'sourceDesignCatalogHash',persisted.source_design_catalog_hash,
    'sourceDesignCatalogTextHash',persisted.source_design_catalog_text_hash,
    'projectedDesignCatalogHash',persisted.projected_design_catalog_hash,
    'endpointCatalogHash',persisted.endpoint_catalog_hash,
    'proposalCatalogHash',persisted.proposal_catalog_hash,
    'coverageHash',persisted.coverage_hash,'releaseHash',persisted.release_hash,
    'evidence',persisted.evidence,'eligibility',persisted.eligibility);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_active_hash(
  release public.framework_canonical_endpoint_upgrade_release
) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT encode(sha256(convert_to(concat_ws(E'\x1f',
    release.release_id::text,'ACTIVE',release.coverage_status,
    release.member_count::text,release.proposal_hash,release.validation_hash,
    release.source_design_catalog_text_hash,release.source_design_catalog_hash,
    release.projected_design_catalog_hash,release.endpoint_catalog_hash,
    release.proposal_catalog_hash,release.coverage_hash,
    release.evidence#>>'{accountRelay,status}',
    coalesce(release.evidence#>>'{accountRelay,evidenceHash}',''),
    release.evidence#>>'{businessE2E,status}',
    coalesce(release.evidence#>>'{businessE2E,evidenceHash}',''),
    release.evidence#>>'{visualQA,status}',
    coalesce(release.evidence#>>'{visualQA,evidenceHash}',''),
    release.eligibility),'UTF8')),'hex')
$$;

CREATE OR REPLACE FUNCTION public.framework_activate_canonical_endpoint_upgrade(
  request jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE actor text;
DECLARE requested_release_id bigint;
DECLARE requested_idempotency_key text;
DECLARE release public.framework_canonical_endpoint_upgrade_release%ROWTYPE;
DECLARE scope_value text;
DECLARE previous_id bigint;
DECLARE active_hash text;
DECLARE persisted public.framework_canonical_endpoint_upgrade_activation_event%ROWTYPE;
BEGIN
  IF NOT public.framework_canonical_endpoint_exact_keys(
       request,ARRAY['activatedBy','idempotencyKey','releaseId','schema'])
     OR request->>'schema' IS DISTINCT FROM
          'carbonet.endpoint-upgrade-activation-request/v1'
     OR jsonb_typeof(request->'releaseId') IS DISTINCT FROM 'number'
     OR (request->'releaseId')::text !~ '^[1-9][0-9]*$'
     OR jsonb_typeof(request->'idempotencyKey') IS DISTINCT FROM 'string'
     OR jsonb_typeof(request->'activatedBy') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'endpoint upgrade activation request is invalid'
      USING ERRCODE='22023';
  END IF;
  actor:=btrim(request->>'activatedBy');
  requested_idempotency_key:=btrim(request->>'idempotencyKey');
  requested_release_id:=(request->>'releaseId')::bigint;
  SELECT * INTO STRICT release
    FROM public.framework_canonical_endpoint_upgrade_release
   WHERE release_id=requested_release_id;
  SELECT proposal.scope_process INTO STRICT scope_value
    FROM public.framework_canonical_endpoint_upgrade_proposal proposal
   WHERE proposal.proposal_id=release.proposal_id;
  IF actor='' OR requested_idempotency_key='' OR release.eligibility<>'PUBLISHABLE'
     OR release.coverage_status<>'COMPLETE'
     OR scope_value='*' THEN
    RAISE EXCEPTION 'only a complete publishable endpoint release can activate'
      USING ERRCODE='55000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'canonical-endpoint-upgrade:activate:'||scope_value,0));
  active_hash:=public.framework_canonical_endpoint_active_hash(release);
  SELECT * INTO persisted
    FROM public.framework_canonical_endpoint_upgrade_activation_event event
   WHERE event.idempotency_key=requested_idempotency_key;
  IF FOUND THEN
    IF persisted.release_id<>release.release_id
       OR persisted.action<>'ACTIVATE'
       OR persisted.scope_process<>scope_value
       OR persisted.payload_hash<>active_hash
       OR persisted.activated_by<>actor THEN
      RAISE EXCEPTION 'endpoint upgrade activation idempotency conflict'
        USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'activationEventId',persisted.activation_event_id,
      'action',persisted.action,'releaseId',persisted.release_id,
      'previousReleaseId',persisted.previous_release_id,
      'scopeProcess',persisted.scope_process,'status','ACTIVE',
      'releaseHash',persisted.payload_hash);
  END IF;
  SELECT event.release_id INTO previous_id
    FROM public.framework_canonical_endpoint_upgrade_activation_event event
   WHERE event.scope_process=scope_value
   ORDER BY event.activation_event_id DESC LIMIT 1;
  INSERT INTO public.framework_canonical_endpoint_upgrade_activation_event(
    release_id,previous_release_id,action,scope_process,idempotency_key,
    payload_hash,activated_by)
  VALUES(release.release_id,previous_id,'ACTIVATE',scope_value,
         requested_idempotency_key,active_hash,actor)
  ON CONFLICT(idempotency_key) DO NOTHING;
  SELECT * INTO STRICT persisted
    FROM public.framework_canonical_endpoint_upgrade_activation_event event
   WHERE event.idempotency_key=requested_idempotency_key;
  IF persisted.release_id<>release.release_id OR persisted.action<>'ACTIVATE'
     OR persisted.scope_process<>scope_value
     OR persisted.payload_hash<>active_hash
     OR persisted.activated_by<>actor THEN
    RAISE EXCEPTION 'endpoint upgrade activation idempotency conflict'
      USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object(
    'activationEventId',persisted.activation_event_id,
    'action',persisted.action,'releaseId',persisted.release_id,
    'previousReleaseId',persisted.previous_release_id,
    'scopeProcess',persisted.scope_process,'status','ACTIVE',
    'releaseHash',persisted.payload_hash);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_rollback_canonical_endpoint_upgrade(
  request jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE actor text;
DECLARE target_release_id bigint;
DECLARE requested_idempotency_key text;
DECLARE target public.framework_canonical_endpoint_upgrade_release%ROWTYPE;
DECLARE current_release_id bigint;
DECLARE active_hash text;
DECLARE scope_value text;
DECLARE persisted public.framework_canonical_endpoint_upgrade_activation_event%ROWTYPE;
BEGIN
  IF NOT public.framework_canonical_endpoint_exact_keys(
       request,ARRAY['activatedBy','idempotencyKey','releaseId','schema'])
     OR request->>'schema' IS DISTINCT FROM
          'carbonet.endpoint-upgrade-rollback-request/v1'
     OR jsonb_typeof(request->'releaseId') IS DISTINCT FROM 'number'
     OR (request->'releaseId')::text !~ '^[1-9][0-9]*$'
     OR jsonb_typeof(request->'idempotencyKey') IS DISTINCT FROM 'string'
     OR jsonb_typeof(request->'activatedBy') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'endpoint upgrade rollback request is invalid'
      USING ERRCODE='22023';
  END IF;
  actor:=btrim(request->>'activatedBy');
  requested_idempotency_key:=btrim(request->>'idempotencyKey');
  target_release_id:=(request->>'releaseId')::bigint;
  SELECT release.* INTO STRICT target
    FROM public.framework_canonical_endpoint_upgrade_release release
   WHERE release.release_id=target_release_id;
  SELECT proposal.scope_process INTO STRICT scope_value
    FROM public.framework_canonical_endpoint_upgrade_proposal proposal
   WHERE proposal.proposal_id=target.proposal_id;
  IF actor='' OR requested_idempotency_key='' OR target.eligibility<>'PUBLISHABLE'
     OR target.coverage_status<>'COMPLETE' OR scope_value='*' THEN
    RAISE EXCEPTION 'rollback target must be a complete publishable release'
      USING ERRCODE='55000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'canonical-endpoint-upgrade:activate:'||scope_value,0));
  SELECT release.* INTO STRICT target
    FROM public.framework_canonical_endpoint_upgrade_release release
   WHERE release.release_id=target_release_id;
  active_hash:=public.framework_canonical_endpoint_active_hash(target);
  SELECT * INTO persisted
    FROM public.framework_canonical_endpoint_upgrade_activation_event event
   WHERE event.idempotency_key=requested_idempotency_key;
  IF FOUND THEN
    IF persisted.release_id<>target_release_id OR persisted.action<>'ROLLBACK'
       OR persisted.scope_process<>scope_value
       OR persisted.payload_hash<>active_hash
       OR persisted.activated_by<>actor THEN
      RAISE EXCEPTION 'endpoint upgrade rollback idempotency conflict'
        USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'activationEventId',persisted.activation_event_id,
      'action',persisted.action,'releaseId',persisted.release_id,
      'previousReleaseId',persisted.previous_release_id,
      'scopeProcess',persisted.scope_process,'status','ACTIVE',
      'releaseHash',persisted.payload_hash);
  END IF;
  SELECT event.release_id INTO current_release_id
    FROM public.framework_canonical_endpoint_upgrade_activation_event event
   WHERE event.scope_process=scope_value
   ORDER BY event.activation_event_id DESC LIMIT 1;
  IF current_release_id IS NULL OR current_release_id=target_release_id THEN
    RAISE EXCEPTION 'rollback target must differ from current active release'
      USING ERRCODE='55000';
  END IF;
  INSERT INTO public.framework_canonical_endpoint_upgrade_activation_event(
    release_id,previous_release_id,action,scope_process,idempotency_key,
    payload_hash,activated_by)
  VALUES(target_release_id,current_release_id,'ROLLBACK',scope_value,
         requested_idempotency_key,active_hash,actor)
  ON CONFLICT(idempotency_key) DO NOTHING;
  SELECT * INTO STRICT persisted
    FROM public.framework_canonical_endpoint_upgrade_activation_event event
   WHERE event.idempotency_key=requested_idempotency_key;
  IF persisted.release_id<>target_release_id OR persisted.action<>'ROLLBACK'
     OR persisted.scope_process<>scope_value
     OR persisted.payload_hash<>active_hash
     OR persisted.activated_by<>actor THEN
    RAISE EXCEPTION 'endpoint upgrade rollback idempotency conflict'
      USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object(
    'activationEventId',persisted.activation_event_id,
    'action',persisted.action,'releaseId',persisted.release_id,
    'previousReleaseId',persisted.previous_release_id,
    'scopeProcess',persisted.scope_process,'status','ACTIVE',
    'releaseHash',persisted.payload_hash);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_upgrade_export(
  requested_release_id bigint, requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE release public.framework_canonical_endpoint_upgrade_release%ROWTYPE;
DECLARE proposal public.framework_canonical_endpoint_upgrade_proposal%ROWTYPE;
DECLARE validation public.framework_canonical_endpoint_upgrade_validation%ROWTYPE;
DECLARE active_event public.framework_canonical_endpoint_upgrade_activation_event%ROWTYPE;
DECLARE selected_members jsonb;
DECLARE selected_count integer;
DECLARE selected_member_hashes jsonb;
DECLARE selected_catalog_hash text;
DECLARE design_screens jsonb;
DECLARE selected_design_catalog_hash text;
DECLARE endpoint_rows jsonb;
DECLARE selected_endpoint_catalog_hash text;
DECLARE coverage jsonb;
DECLARE status_value text;
DECLARE release_hash_value text;
BEGIN
  IF requested_release_id IS NULL OR requested_release_id<1
     OR requested_limit IS NULL OR requested_limit<1 OR requested_limit>5000
     OR (requested_process IS NOT NULL
       AND requested_process !~ '^[A-Z][A-Z0-9_]{1,79}$') THEN
    RAISE EXCEPTION 'endpoint upgrade export scope is invalid'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT release
    FROM public.framework_canonical_endpoint_upgrade_release
   WHERE release_id=requested_release_id;
  SELECT * INTO STRICT proposal
    FROM public.framework_canonical_endpoint_upgrade_proposal
   WHERE proposal_id=release.proposal_id;
  IF requested_process IS NOT NULL AND
     (proposal.scope_process='*' OR proposal.scope_process<>requested_process) THEN
    RAISE EXCEPTION 'endpoint upgrade export process must equal proposal scope'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT validation
    FROM public.framework_canonical_endpoint_upgrade_validation
   WHERE validation_id=release.validation_id
     AND validation_status='VALIDATED' AND blocker_count=0;
  SELECT * INTO active_event
    FROM public.framework_canonical_endpoint_upgrade_activation_event event
   WHERE event.scope_process=proposal.scope_process
   ORDER BY event.activation_event_id DESC LIMIT 1;
  status_value:=case when active_event.release_id=release.release_id
    then 'ACTIVE' else 'PUBLISHED' end;
  release_hash_value:=case when status_value='ACTIVE'
    then active_event.payload_hash else release.release_hash end;
  WITH selected AS MATERIALIZED (
    SELECT member.* FROM public.framework_canonical_endpoint_upgrade_member member
     WHERE member.proposal_id=proposal.proposal_id
     ORDER BY member.ordinal
  )
  SELECT count(*)::integer,
    jsonb_agg(jsonb_build_object(
      'ordinal',over_order,
      'sourceContractId',source_contract_id,
      'processCode',process_code,'stepCode',step_code,'screenKey',screen_key,
      'sourceDesignHash',source_design_hash,
      'sourceApiRawText',source_api_raw_text,
      'sourceApiRawHash',source_api_raw_hash,
      'sourceApiParsedCanonicalText',source_api_parsed_canonical_text,
      'sourceApiParsedHash',source_api_parsed_hash,
      'sourceDatabaseRawText',source_database_raw_text,
      'sourceDatabaseRawHash',source_database_raw_hash,
      'sourceDatabaseParsedCanonicalText',source_database_parsed_canonical_text,
      'sourceDatabaseParsedHash',source_database_parsed_hash,
      'projectedDesignCanonicalText',projected_design_text,
      'projectedDesignHash',projected_design_hash,
      'endpointCanonicalText',endpoint_text,'endpointHash',endpoint_hash,
      'operation',operation,'memberHash',member_hash) ORDER BY over_order),
    jsonb_agg(member_hash ORDER BY over_order),
    encode(sha256(convert_to(string_agg(
      member_hash,E'\n' ORDER BY over_order),'UTF8')),'hex'),
    jsonb_agg(jsonb_build_object(
      'screenKey',screen_key,'processCode',process_code,'stepCode',step_code,
      'audience',projected_design_text::jsonb#>>'{identity,audience}',
      'routePath',projected_design_text::jsonb#>>'{identity,routePath}',
      'designHash',projected_design_hash,
      'canonicalText',projected_design_text,
      'canonicalDesign',projected_design_text::jsonb) ORDER BY over_order),
    encode(sha256(convert_to(string_agg(
      screen_key||E'\x1f'||projected_design_hash,E'\n' ORDER BY over_order
    ),'UTF8')),'hex'),
    jsonb_agg(jsonb_build_object(
      'screenKey',screen_key,
      'routePath',projected_design_text::jsonb#>>'{identity,routePath}',
      'audience',projected_design_text::jsonb#>>'{identity,audience}',
      'designHash',projected_design_hash,
      'canonicalText',projected_design_text,
      'endpointHash',endpoint_hash,'endpointText',endpoint_text,
      'endpointContract',endpoint_text::jsonb) ORDER BY over_order),
    encode(sha256(convert_to(string_agg(
      screen_key||E'\x1f'||endpoint_hash,E'\n' ORDER BY over_order
    ),'UTF8')),'hex')
    INTO selected_count,selected_members,selected_member_hashes,
         selected_catalog_hash,design_screens,selected_design_catalog_hash,
         endpoint_rows,selected_endpoint_catalog_hash
    FROM (
      SELECT selected.*,row_number() OVER (ORDER BY ordinal)::integer over_order
        FROM selected
    ) numbered;
  IF selected_count=0 OR selected_count>requested_limit OR selected_count<>proposal.member_count THEN
    RAISE EXCEPTION 'endpoint upgrade export has % members for limit %',
      selected_count,requested_limit USING ERRCODE='54000';
  END IF;
  coverage:=jsonb_build_object(
    'status',proposal.coverage_status,
    'sourceDesignCount',proposal.source_design_count,
    'memberCount',proposal.member_count,
    'missingContractCount',proposal.missing_contract_count,
    'duplicateBlueprintCount',proposal.duplicate_blueprint_count,
    'duplicateContractCount',proposal.duplicate_contract_count,
    'incompleteLaneCount',proposal.incomplete_lane_count,
    'blockerCount',proposal.missing_contract_count+
      proposal.duplicate_blueprint_count+proposal.duplicate_contract_count+
      proposal.incomplete_lane_count);
  coverage:=coverage||jsonb_build_object('coverageHash',release.coverage_hash);
  RETURN jsonb_build_object(
    'schemaVersion','canonical-endpoint-upgrade-release/v1',
    'source',jsonb_build_object(
      'scopeProcess',case when requested_process IS NULL
        then proposal.scope_process else requested_process end,
      'sourceDesignCatalogText',proposal.source_design_catalog_text,
      'sourceDesignCatalogTextHash',proposal.source_design_catalog_text_hash,
      'sourceDesignCatalogHash',proposal.source_design_catalog_hash,
      'sourceDesignCount',proposal.source_design_count,
      'policyText',proposal.policy_text,'policyHash',proposal.policy_hash),
    'coverage',coverage,
    'members',selected_members,
    'catalog',jsonb_build_object(
      'memberCount',selected_count,'memberHashes',selected_member_hashes,
      'catalogHash',selected_catalog_hash,
      'design',jsonb_build_object(
        'schema','carbonet.canonical-design/v1','catalogHash',selected_design_catalog_hash,
        'screenCount',selected_count,'screens',design_screens),
      'endpoint',jsonb_build_object(
        'schema','carbonet.canonical-endpoint-catalog/v1',
        'catalogHash',selected_endpoint_catalog_hash,'endpoints',endpoint_rows)),
    'proposals',jsonb_build_array(jsonb_build_object(
      'proposalId',proposal.proposal_id,'status','PUBLISHED',
      'proposalHash',proposal.proposal_hash,'policyHash',proposal.policy_hash,
      'sourceDesignCatalogTextHash',proposal.source_design_catalog_text_hash,
      'sourceDesignCatalogHash',proposal.source_design_catalog_hash,
      'projectedDesignCatalogHash',proposal.projected_design_catalog_hash,
      'proposalCatalogHash',proposal.proposal_catalog_hash,
      'memberCount',proposal.member_count)),
    'validations',jsonb_build_array(jsonb_build_object(
      'validationId',validation.validation_id,'proposalId',proposal.proposal_id,
      'status','VALIDATED','readyCount',proposal.member_count,
      'blockerCount',0,'validationHash',validation.validation_hash)),
    'release',jsonb_build_object(
      'releaseId',release.release_id,'status',status_value,
      'coverageStatus',release.coverage_status,'memberCount',release.member_count,
      'proposalHash',release.proposal_hash,'validationHash',release.validation_hash,
      'sourceDesignCatalogTextHash',release.source_design_catalog_text_hash,
      'sourceDesignCatalogHash',release.source_design_catalog_hash,
      'projectedDesignCatalogHash',release.projected_design_catalog_hash,
      'endpointCatalogHash',release.endpoint_catalog_hash,
      'proposalCatalogHash',release.proposal_catalog_hash,
      'coverageHash',release.coverage_hash,'releaseHash',release_hash_value,
      'evidence',release.evidence,'eligibility',release.eligibility));
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_upgrade_export(
  requested_release_id bigint, requested_limit integer DEFAULT 5000
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_canonical_endpoint_upgrade_export(
    requested_release_id,requested_limit,NULL::varchar)
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_effective_binding(
  requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE event public.framework_canonical_endpoint_upgrade_activation_event%ROWTYPE;
DECLARE release public.framework_canonical_endpoint_upgrade_release%ROWTYPE;
BEGIN
  IF requested_process IS NULL
     OR requested_process !~ '^[A-Z][A-Z0-9_]{1,79}$' THEN
    RAISE EXCEPTION 'effective binding requires an exact process CODE'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO event
    FROM public.framework_canonical_endpoint_upgrade_activation_event latest
   WHERE latest.scope_process=requested_process
   ORDER BY latest.activation_event_id DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status','SOURCE','processCode',requested_process,'releaseId',NULL,
      'endpointCatalogHash',NULL,'designCatalogHash',NULL,
      'coverageStatus',NULL,'eligibility','VALIDATED_ONLY');
  END IF;
  SELECT * INTO STRICT release
    FROM public.framework_canonical_endpoint_upgrade_release
   WHERE release_id=event.release_id;
  IF release.eligibility<>'PUBLISHABLE' OR release.coverage_status<>'COMPLETE'
     OR event.payload_hash<>public.framework_canonical_endpoint_active_hash(release)
     OR (SELECT scope_process FROM public.framework_canonical_endpoint_upgrade_proposal
          WHERE proposal_id=release.proposal_id)<>requested_process THEN
    RAISE EXCEPTION 'active endpoint upgrade binding is corrupt'
      USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object(
    'status','ACTIVE','processCode',requested_process,
    'releaseId',release.release_id,
    'endpointCatalogHash',release.endpoint_catalog_hash,
    'designCatalogHash',release.projected_design_catalog_hash,
    'coverageStatus',release.coverage_status,'eligibility',release.eligibility);
END
$$;

ALTER FUNCTION public.framework_canonical_design_catalog(integer,varchar)
  RENAME TO framework_source_canonical_design_catalog;
ALTER FUNCTION public.framework_canonical_endpoint_readiness(integer,varchar)
  RENAME TO framework_source_canonical_endpoint_readiness;
ALTER FUNCTION public.framework_canonical_endpoint_catalog(integer,varchar)
  RENAME TO framework_source_canonical_endpoint_catalog;

CREATE OR REPLACE FUNCTION public.framework_canonical_design_catalog(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE binding jsonb;
DECLARE exported jsonb;
BEGIN
  IF requested_process IS NULL THEN
    RETURN public.framework_canonical_design_catalog(requested_limit);
  END IF;
  binding:=public.framework_canonical_endpoint_effective_binding(requested_process);
  IF binding->>'status'='SOURCE' THEN
    RETURN public.framework_source_canonical_design_catalog(
      requested_limit,requested_process);
  END IF;
  exported:=public.framework_canonical_endpoint_upgrade_export(
    (binding->>'releaseId')::bigint,requested_limit,requested_process);
  IF exported#>>'{catalog,design,catalogHash}'<>binding->>'designCatalogHash' THEN
    RAISE EXCEPTION 'active design catalog binding hash mismatch'
      USING ERRCODE='55000';
  END IF;
  RETURN exported#>'{catalog,design}';
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_readiness(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE binding jsonb;
DECLARE exported jsonb;
DECLARE member_count integer;
BEGIN
  IF requested_process IS NULL THEN
    RETURN public.framework_source_canonical_endpoint_readiness(
      requested_limit,NULL::varchar);
  END IF;
  binding:=public.framework_canonical_endpoint_effective_binding(requested_process);
  IF binding->>'status'='SOURCE' THEN
    RETURN public.framework_source_canonical_endpoint_readiness(
      requested_limit,requested_process);
  END IF;
  exported:=public.framework_canonical_endpoint_upgrade_export(
    (binding->>'releaseId')::bigint,requested_limit,requested_process);
  member_count:=(exported#>>'{catalog,memberCount}')::integer;
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-endpoint-readiness/v1',
    'authority','active-derived-overlay-release',
    'requestedProcess',requested_process,
    'totalCount',member_count,'sourceDesignCount',member_count,
    'canonicalScreenCount',member_count,'designBlockerCount',0,
    'sourceReadyCount',member_count,'globalCollisionCount',0,
    'blockerCount',0,'status','COMPLETE','reasonCounts','{}'::jsonb);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_canonical_endpoint_catalog(
  requested_limit integer, requested_process varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE binding jsonb;
DECLARE exported jsonb;
BEGIN
  IF requested_process IS NULL THEN
    RETURN public.framework_source_canonical_endpoint_catalog(
      requested_limit,NULL::varchar);
  END IF;
  binding:=public.framework_canonical_endpoint_effective_binding(requested_process);
  IF binding->>'status'='SOURCE' THEN
    RETURN public.framework_source_canonical_endpoint_catalog(
      requested_limit,requested_process);
  END IF;
  exported:=public.framework_canonical_endpoint_upgrade_export(
    (binding->>'releaseId')::bigint,requested_limit,requested_process);
  IF exported#>>'{catalog,endpoint,catalogHash}'<>
       binding->>'endpointCatalogHash' THEN
    RAISE EXCEPTION 'active endpoint catalog binding hash mismatch'
      USING ERRCODE='55000';
  END IF;
  RETURN exported#>'{catalog,endpoint}';
END
$$;

DO $$
DECLARE table_name text;
DECLARE table_index integer:=0;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'framework_canonical_endpoint_upgrade_proposal',
    'framework_canonical_endpoint_upgrade_member',
    'framework_canonical_endpoint_upgrade_validation',
    'framework_canonical_endpoint_upgrade_delivery_evidence',
    'framework_canonical_endpoint_upgrade_release',
    'framework_canonical_endpoint_upgrade_release_member',
    'framework_canonical_endpoint_upgrade_activation_event'
  ] LOOP
    table_index:=table_index+1;
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.framework_reject_canonical_endpoint_upgrade_mutation()',
      'trg_ceup_'||table_index||'_row',table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I
       FOR EACH STATEMENT EXECUTE FUNCTION public.framework_reject_canonical_endpoint_upgrade_mutation()',
      'trg_ceup_'||table_index||'_trunc',table_name);
  END LOOP;
END
$$;

REVOKE ALL ON TABLE
  public.framework_canonical_endpoint_upgrade_proposal,
  public.framework_canonical_endpoint_upgrade_member,
  public.framework_canonical_endpoint_upgrade_validation,
  public.framework_canonical_endpoint_upgrade_delivery_evidence,
  public.framework_canonical_endpoint_upgrade_release,
  public.framework_canonical_endpoint_upgrade_release_member,
  public.framework_canonical_endpoint_upgrade_activation_event
FROM PUBLIC;
DO $$
DECLARE sequence_name text;
BEGIN
  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('public.framework_canonical_endpoint_upgrade_proposal','proposal_id'),
    pg_get_serial_sequence('public.framework_canonical_endpoint_upgrade_validation','validation_id'),
    pg_get_serial_sequence('public.framework_canonical_endpoint_upgrade_delivery_evidence','delivery_evidence_id'),
    pg_get_serial_sequence('public.framework_canonical_endpoint_upgrade_release','release_id'),
    pg_get_serial_sequence('public.framework_canonical_endpoint_upgrade_activation_event','activation_event_id')
  ] LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC',sequence_name);
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.framework_source_canonical_design_catalog(
  integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_readiness(
  integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_catalog(
  integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_design_catalog(
  integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_readiness(
  integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_catalog(
  integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_propose_canonical_endpoint_upgrade(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_validate_canonical_endpoint_upgrade(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_record_canonical_endpoint_upgrade_evidence(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_publish_canonical_endpoint_upgrade(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_activate_canonical_endpoint_upgrade(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_rollback_canonical_endpoint_upgrade(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_upgrade_export(
  bigint,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_upgrade_export(
  bigint,integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_effective_binding(varchar)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON TABLE
      public.framework_canonical_endpoint_upgrade_proposal,
      public.framework_canonical_endpoint_upgrade_member,
      public.framework_canonical_endpoint_upgrade_validation,
      public.framework_canonical_endpoint_upgrade_delivery_evidence,
      public.framework_canonical_endpoint_upgrade_release,
      public.framework_canonical_endpoint_upgrade_release_member,
      public.framework_canonical_endpoint_upgrade_activation_event
    FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_propose_canonical_endpoint_upgrade(jsonb)
      FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_validate_canonical_endpoint_upgrade(jsonb)
      FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_record_canonical_endpoint_upgrade_evidence(jsonb)
      FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_publish_canonical_endpoint_upgrade(jsonb)
      FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_activate_canonical_endpoint_upgrade(jsonb)
      FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_rollback_canonical_endpoint_upgrade(jsonb)
      FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_upgrade_export(
      bigint,integer) FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_canonical_endpoint_upgrade_export(
      bigint,integer,varchar) FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_source_canonical_design_catalog(
      integer,varchar) FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_readiness(
      integer,varchar) FROM carbonet_app;
    REVOKE ALL ON FUNCTION public.framework_source_canonical_endpoint_catalog(
      integer,varchar) FROM carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_effective_binding(
      varchar) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_design_catalog(
      integer,varchar) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_readiness(
      integer,varchar) TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_canonical_endpoint_catalog(
      integer,varchar) TO carbonet_app;
  END IF;
END
$$;

COMMENT ON FUNCTION public.framework_propose_canonical_endpoint_upgrade(jsonb)
  IS 'Stages an immutable derived overlay; writes no blueprint or professional contract';
COMMENT ON FUNCTION public.framework_canonical_endpoint_upgrade_export(
  bigint,integer,varchar)
  IS 'Exports exact immutable lineage and frozen generator catalogs for verification';
COMMENT ON FUNCTION public.framework_canonical_endpoint_effective_binding(varchar)
  IS 'Returns SOURCE or the exact active, publishable process-scoped overlay binding';
