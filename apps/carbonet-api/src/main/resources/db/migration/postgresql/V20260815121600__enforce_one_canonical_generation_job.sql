-- A deterministic FULL_STACK publication renders the whole process snapshot.
-- Therefore one mutable queue row and one immutable input head are owned by a
-- process, never by an individual trigger step. Historical/noncanonical jobs
-- keep their existing keys.

CREATE OR REPLACE FUNCTION public.framework_process_generation_input(
  requested_process text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  process_payload jsonb;
  steps_payload jsonb;
  screens_payload jsonb;
  stable_input jsonb;
  process_input_hash text;
  design_set_hash text;
  design_catalog jsonb;
  endpoint_catalog jsonb;
  design_catalog_hash text;
  design_catalog_text_hash text;
  endpoint_catalog_hash text;
  endpoint_catalog_text_hash text;
  coordinator_step text;
  defined_step_count integer;
  process_step_count integer;
  generation_ready_step_count integer;
  process_endpoint_expected integer;
  screen_count integer;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$' THEN
    RAISE EXCEPTION 'invalid process generation identity'
      USING ERRCODE='22023';
  END IF;

  SELECT to_jsonb(process)-'created_at'-'updated_at'
    INTO process_payload
    FROM public.framework_process_definition process
   WHERE process.process_code=requested_process;
  IF process_payload IS NULL THEN
    RAISE EXCEPTION 'process generation identity not found: %',requested_process
      USING ERRCODE='P0002';
  END IF;

  SELECT count(*) INTO defined_step_count
    FROM public.framework_process_step step
   WHERE step.process_code=requested_process;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'definition',step_payload,
           'designStatus',design_status,
           'approvalStatus',approval_status,
           'contracts',contracts_payload)
         ORDER BY step_order,step_code COLLATE "C"),'[]'::jsonb),
         count(*)::integer,
         count(*) FILTER(WHERE generation_eligible)::integer,
         (array_agg(step_code ORDER BY step_order,step_code COLLATE "C")
           FILTER(WHERE generation_eligible))[1]
    INTO steps_payload,process_step_count,generation_ready_step_count,
         coordinator_step
    FROM (
      SELECT step.step_order,step.step_code,
             to_jsonb(step)-'step_id'-'created_at'-'updated_at' step_payload,
             spec.design_status,spec.approval_status,
             spec.design_status='DESIGN_COMPLETE'
               AND spec.approval_status='APPROVED'
               AND spec.generation_status IN ('READY','GENERATED') generation_eligible,
             jsonb_build_object(
               'actor',spec.actor_contract,
               'business',spec.business_contract,
               'transition',spec.transition_contract,
               'input',spec.input_contract,
               'output',spec.output_contract,
               'screen',spec.screen_contract,
               'field',spec.field_contract,
               'command',spec.command_contract,
               'api',spec.api_contract,
               'persistence',spec.persistence_contract,
               'handoff',spec.handoff_contract,
               'test',spec.test_contract,
               'guide',spec.guide_contract,
               'nonfunctional',spec.nonfunctional_contract
             ) contracts_payload
        FROM public.framework_process_step step
        JOIN public.framework_step_execution_spec spec
          USING(process_code,step_code)
       WHERE step.process_code=requested_process
    ) ordered_steps;

  IF process_step_count<>defined_step_count THEN
    RAISE EXCEPTION 'process generation spec coverage is not exact: % / % / %',
      requested_process,defined_step_count,process_step_count
      USING ERRCODE='55000';
  END IF;

  -- Compile each expensive canonical catalog once. The endpoint compiler is
  -- itself fail-closed on readiness, so a separate readiness compilation here
  -- would only duplicate the same process scan.
  design_catalog:=public.framework_canonical_design_catalog(5000,requested_process);
  endpoint_catalog:=public.framework_canonical_endpoint_catalog(
    5000,requested_process);
  design_catalog_hash:=design_catalog->>'catalogHash';
  endpoint_catalog_hash:=endpoint_catalog->>'catalogHash';
  design_catalog_text_hash:=encode(sha256(convert_to(
    design_catalog::text,'UTF8')),'hex');
  endpoint_catalog_text_hash:=encode(sha256(convert_to(
    endpoint_catalog::text,'UTF8')),'hex');
  IF jsonb_typeof(endpoint_catalog->'endpoints')<>'array' THEN
    RAISE EXCEPTION 'process canonical endpoint catalog is malformed: %',
      requested_process USING ERRCODE='22023';
  END IF;
  process_endpoint_expected:=jsonb_array_length(endpoint_catalog->'endpoints');
  IF design_catalog_hash!~'^[0-9a-f]{64}$'
     OR endpoint_catalog_hash!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'process generator catalog hash is invalid: %',
      requested_process USING ERRCODE='22023';
  END IF;

  WITH screen_rows AS MATERIALIZED (
    SELECT screen->>'stepCode' step_code,screen->>'audience' audience,
           screen->>'routePath' route_path,screen->>'screenKey' screen_key,
           screen->>'designHash' design_hash
      FROM jsonb_array_elements(design_catalog->'screens') screen
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'screenKey',screen_key,'stepCode',step_code,'audience',audience,
           'routePath',route_path,'designHash',design_hash)
         ORDER BY screen_key COLLATE "C"),'[]'::jsonb),
         encode(sha256(convert_to(coalesce(string_agg(
           screen_key||E'\\x1f'||design_hash,E'\\n'
           ORDER BY screen_key COLLATE "C"),''),'UTF8')),'hex'),
         count(*)::integer
    INTO screens_payload,design_set_hash,screen_count
    FROM screen_rows;

  IF process_endpoint_expected<>screen_count THEN
    RAISE EXCEPTION 'process canonical endpoint coverage is not exact: % / % / %',
      requested_process,process_endpoint_expected,screen_count
      USING ERRCODE='55000';
  END IF;

  IF EXISTS(
    SELECT 1
      FROM jsonb_array_elements(screens_payload) screen
     WHERE screen->>'designHash'!~'^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'process canonical screen design hash is invalid: %',
      requested_process USING ERRCODE='22023';
  END IF;

  stable_input:=jsonb_build_object(
    'schema','carbonet.process-generation-input/v1',
    'generatorContract',jsonb_build_object(
      'fullStackPackageSchema','2.0.0',
      'designCatalogSchema',design_catalog->>'schema',
      'endpointCatalogSchema',endpoint_catalog->>'schema'),
    'process',process_payload,
    'steps',steps_payload,
    'screens',screens_payload,
    'catalogs',jsonb_build_object(
      'designCatalogHash',design_catalog_hash,
      'designCatalogTextHash',design_catalog_text_hash,
      'endpointCatalogHash',endpoint_catalog_hash,
      'endpointCatalogTextHash',endpoint_catalog_text_hash)
  );
  process_input_hash:=encode(sha256(convert_to(stable_input::text,'UTF8')),'hex');

  RETURN jsonb_build_object(
    'schema','carbonet.process-generation-head/v1',
    'processCode',requested_process,
    'processInputHash',process_input_hash,
    'processStepCount',process_step_count,
    'generationReadyStepCount',generation_ready_step_count,
    'coordinatorStep',coordinator_step,
    'processEndpointExpected',process_endpoint_expected,
    'screenCount',screen_count,
    'designSetHash',design_set_hash,
    'designCatalogHash',design_catalog_hash,
    'designCatalogTextHash',design_catalog_text_hash,
    'endpointCatalogHash',endpoint_catalog_hash,
    'endpointCatalogTextHash',endpoint_catalog_text_hash,
    'input',stable_input
  );
END
$$;

COMMENT ON FUNCTION public.framework_process_generation_input(text) IS
  'Versioned process-wide generator head over process/step contracts and exact canonical screen design hashes';

REVOKE ALL ON FUNCTION public.framework_process_generation_input(text)
  FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    GRANT EXECUTE ON FUNCTION public.framework_process_generation_input(text)
      TO carbonet_app;
  END IF;
END
$$;

DO $$
DECLARE input_api oid:=to_regprocedure(
  'public.framework_process_generation_input(text)');
DECLARE input_namespace text;
BEGIN
  SELECT namespace.nspname INTO input_namespace
    FROM pg_proc function_row
    JOIN pg_namespace namespace ON namespace.oid=function_row.pronamespace
   WHERE function_row.oid=input_api;
  IF input_api IS NULL OR EXISTS(
    SELECT 1 FROM pg_proc function_row
    CROSS JOIN LATERAL aclexplode(
      coalesce(function_row.proacl,acldefault('f',function_row.proowner))) acl
     WHERE function_row.oid=input_api
       AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
  ) OR EXISTS(
    SELECT 1 FROM pg_proc
     WHERE oid=input_api AND (NOT prosecdef
       OR NOT EXISTS(
         SELECT 1 FROM unnest(coalesce(proconfig,'{}'::text[])) setting
          WHERE setting='search_path=pg_catalog, '||input_namespace))
  ) THEN
    RAISE EXCEPTION 'process generation input API ACL postcondition failed'
      USING ERRCODE='42501';
  END IF;
END
$$;

DO $$
DECLARE duplicate_group record;
BEGIN
  SELECT process_code,count(*) job_count
    INTO duplicate_group
    FROM framework_development_job
   WHERE job_type='FULL_STACK_GENERATION'
     AND job_group_code=process_code||'_CANONICAL_PUBLICATION'
   GROUP BY process_code
  HAVING count(*)>1
   ORDER BY process_code
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'duplicate canonical process generation jobs: % / %',
      duplicate_group.process_code,duplicate_group.job_count
      USING ERRCODE='23505';
  END IF;
END
$$;

CREATE UNIQUE INDEX uq_framework_development_job_canonical_group
  ON framework_development_job(process_code)
  WHERE job_type='FULL_STACK_GENERATION'
    AND job_group_code=process_code||'_CANONICAL_PUBLICATION';

DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1
      FROM pg_index index_contract
     WHERE index_contract.indexrelid=to_regclass(
             'uq_framework_development_job_canonical_group')
       AND index_contract.indisunique
       AND index_contract.indisvalid
  ) THEN
    RAISE EXCEPTION 'canonical process generation job unique index is not valid'
      USING ERRCODE='55000';
  END IF;
END
$$;
