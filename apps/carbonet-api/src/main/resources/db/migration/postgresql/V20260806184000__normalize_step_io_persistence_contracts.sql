CREATE OR REPLACE FUNCTION framework_normalize_step_data_contract(contract jsonb,contract_type text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'contractType',contract_type,
    'schema',CASE
      WHEN jsonb_typeof(contract)='object' AND contract->>'contractType'=contract_type
        THEN coalesce(contract->'schema','{}'::jsonb)
      WHEN jsonb_typeof(contract)='object' THEN contract
      ELSE '{}'::jsonb
    END
  );
$$;

CREATE OR REPLACE FUNCTION framework_normalize_step_persistence_contract(contract jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(contract)='object' AND contract->>'contractType'='STEP_PERSISTENCE' THEN
      jsonb_build_object(
        'schemaVersion',1,'contractType','STEP_PERSISTENCE',
        'schemaSetVersion',contract->'schemaSetVersion',
        'policy',coalesce(contract->'policy','{}'::jsonb),
        'mappings',CASE WHEN jsonb_typeof(contract->'mappings')='array' THEN contract->'mappings' ELSE '[]'::jsonb END,
        'extensions',coalesce(contract->'extensions','{}'::jsonb)
      )
    WHEN jsonb_typeof(contract)='object' THEN
      jsonb_strip_nulls(jsonb_build_object(
        'schemaVersion',1,'contractType','STEP_PERSISTENCE',
        'schemaSetVersion',contract->'schemaSetVersion',
        'policy',jsonb_strip_nulls(jsonb_build_object(
          'transactional',contract->'transactional','migrationRequired',contract->'migrationRequired',
          'optimisticLock',contract->'optimisticLock','tenantIsolated',contract->'tenantIsolated',
          'projectIsolated',contract->'projectIsolated')),
        'mappings',CASE WHEN jsonb_typeof(contract->'mappings')='array' THEN contract->'mappings' ELSE '[]'::jsonb END,
        'extensions',contract-ARRAY['schemaSetVersion','transactional','migrationRequired','optimisticLock','tenantIsolated','projectIsolated','mappings']::text[]
      ))
    ELSE jsonb_build_object('schemaVersion',1,'contractType','STEP_PERSISTENCE','policy','{}'::jsonb,'mappings','[]'::jsonb,'extensions','{}'::jsonb)
  END;
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_io_persistence_contracts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.input_contract := framework_normalize_step_data_contract(NEW.input_contract,'STEP_INPUT');
  NEW.output_contract := framework_normalize_step_data_contract(NEW.output_contract,'STEP_OUTPUT');
  NEW.persistence_contract := framework_normalize_step_persistence_contract(NEW.persistence_contract);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_io_persistence_contracts ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_io_persistence_contracts
BEFORE INSERT OR UPDATE OF input_contract,output_contract,persistence_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_io_persistence_contracts();

CREATE TEMP TABLE step_io_persistence_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       md5(string_agg((framework_normalize_step_data_contract(input_contract,'STEP_INPUT')->'schema')::text,'|' ORDER BY process_code,step_code)) AS input_hash,
       md5(string_agg((framework_normalize_step_data_contract(output_contract,'STEP_OUTPUT')->'schema')::text,'|' ORDER BY process_code,step_code)) AS output_hash,
       coalesce(sum(jsonb_array_length(framework_normalize_step_persistence_contract(persistence_contract)->'mappings')),0)::bigint AS mapping_count
FROM framework_step_execution_spec;

UPDATE framework_step_execution_spec
SET input_contract=framework_normalize_step_data_contract(input_contract,'STEP_INPUT'),
    output_contract=framework_normalize_step_data_contract(output_contract,'STEP_OUTPUT'),
    persistence_contract=framework_normalize_step_persistence_contract(persistence_contract),
    updated_at=current_timestamp
WHERE input_contract IS DISTINCT FROM framework_normalize_step_data_contract(input_contract,'STEP_INPUT')
   OR output_contract IS DISTINCT FROM framework_normalize_step_data_contract(output_contract,'STEP_OUTPUT')
   OR persistence_contract IS DISTINCT FROM framework_normalize_step_persistence_contract(persistence_contract);

ALTER TABLE framework_step_execution_spec DROP CONSTRAINT IF EXISTS ck_framework_step_io_persistence_contracts_v1;
ALTER TABLE framework_step_execution_spec ADD CONSTRAINT ck_framework_step_io_persistence_contracts_v1 CHECK (
  jsonb_typeof(input_contract)='object' AND input_contract->>'contractType'='STEP_INPUT'
  AND jsonb_typeof(input_contract->'schema')='object'
  AND jsonb_typeof(output_contract)='object' AND output_contract->>'contractType'='STEP_OUTPUT'
  AND jsonb_typeof(output_contract->'schema')='object'
  AND jsonb_typeof(persistence_contract)='object' AND persistence_contract->>'contractType'='STEP_PERSISTENCE'
  AND jsonb_typeof(persistence_contract->'policy')='object'
  AND jsonb_typeof(persistence_contract->'mappings')='array'
  AND jsonb_typeof(persistence_contract->'extensions')='object'
) NOT VALID;
ALTER TABLE framework_step_execution_spec VALIDATE CONSTRAINT ck_framework_step_io_persistence_contracts_v1;

DO $$
DECLARE expected record; actual record; invalid_count integer;
BEGIN
  SELECT * INTO expected FROM step_io_persistence_normalization_audit;
  SELECT count(*)::bigint AS spec_count,
         md5(string_agg((input_contract->'schema')::text,'|' ORDER BY process_code,step_code)) AS input_hash,
         md5(string_agg((output_contract->'schema')::text,'|' ORDER BY process_code,step_code)) AS output_hash,
         coalesce(sum(jsonb_array_length(persistence_contract->'mappings')),0)::bigint AS mapping_count
    INTO actual FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count FROM framework_step_execution_spec
  WHERE input_contract->>'contractType'<>'STEP_INPUT' OR jsonb_typeof(input_contract->'schema')<>'object'
     OR output_contract->>'contractType'<>'STEP_OUTPUT' OR jsonb_typeof(output_contract->'schema')<>'object'
     OR persistence_contract->>'contractType'<>'STEP_PERSISTENCE'
     OR jsonb_typeof(persistence_contract->'policy')<>'object'
     OR jsonb_typeof(persistence_contract->'mappings')<>'array'
     OR jsonb_typeof(persistence_contract->'extensions')<>'object';
  IF invalid_count<>0 THEN RAISE EXCEPTION 'STEP_IO_PERSISTENCE_NORMALIZATION_FAILED invalid=%',invalid_count; END IF;
  IF actual.spec_count<>expected.spec_count OR actual.input_hash<>expected.input_hash
     OR actual.output_hash<>expected.output_hash OR actual.mapping_count<>expected.mapping_count THEN
    RAISE EXCEPTION 'STEP_IO_PERSISTENCE_CARDINALITY_CHANGED expected=% actual=%',row_to_json(expected),row_to_json(actual);
  END IF;
END $$;
