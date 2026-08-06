CREATE OR REPLACE FUNCTION framework_normalize_step_collection_contract(contract jsonb,collection_key text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE jsonb_typeof(contract)
    WHEN 'array' THEN contract
    WHEN 'object' THEN
      CASE
        WHEN collection_key IS NOT NULL AND jsonb_typeof(contract->collection_key)='array'
          THEN contract->collection_key
        WHEN contract='{}'::jsonb THEN '[]'::jsonb
        ELSE jsonb_build_array(contract)
      END
    ELSE '[]'::jsonb
  END;
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_collection_contracts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.screen_contract := framework_normalize_step_collection_contract(NEW.screen_contract,'screens');
  NEW.command_contract := framework_normalize_step_collection_contract(NEW.command_contract,'commands');
  NEW.api_contract := framework_normalize_step_collection_contract(NEW.api_contract,'apis');
  NEW.test_contract := framework_normalize_step_collection_contract(NEW.test_contract,'tests');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_collection_contracts ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_collection_contracts
BEFORE INSERT OR UPDATE OF screen_contract,command_contract,api_contract,test_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_collection_contracts();

CREATE TEMP TABLE step_collection_contract_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       coalesce(sum(jsonb_array_length(framework_normalize_step_collection_contract(screen_contract,'screens'))),0)::bigint AS screen_count,
       coalesce(sum(jsonb_array_length(framework_normalize_step_collection_contract(command_contract,'commands'))),0)::bigint AS command_count,
       coalesce(sum(jsonb_array_length(framework_normalize_step_collection_contract(api_contract,'apis'))),0)::bigint AS api_count,
       coalesce(sum(jsonb_array_length(framework_normalize_step_collection_contract(test_contract,'tests'))),0)::bigint AS test_count
FROM framework_step_execution_spec;

UPDATE framework_step_execution_spec
SET screen_contract=framework_normalize_step_collection_contract(screen_contract,'screens'),
    command_contract=framework_normalize_step_collection_contract(command_contract,'commands'),
    api_contract=framework_normalize_step_collection_contract(api_contract,'apis'),
    test_contract=framework_normalize_step_collection_contract(test_contract,'tests'),
    updated_at=current_timestamp
WHERE jsonb_typeof(screen_contract)<>'array'
   OR jsonb_typeof(command_contract)<>'array'
   OR jsonb_typeof(api_contract)<>'array'
   OR jsonb_typeof(test_contract)<>'array';

ALTER TABLE framework_step_execution_spec
  DROP CONSTRAINT IF EXISTS ck_framework_step_collection_contracts_v1;
ALTER TABLE framework_step_execution_spec
  ADD CONSTRAINT ck_framework_step_collection_contracts_v1 CHECK (
    jsonb_typeof(screen_contract)='array'
    AND jsonb_typeof(command_contract)='array'
    AND jsonb_typeof(api_contract)='array'
    AND jsonb_typeof(test_contract)='array'
  ) NOT VALID;
ALTER TABLE framework_step_execution_spec
  VALIDATE CONSTRAINT ck_framework_step_collection_contracts_v1;

DO $$
DECLARE
  expected record;
  actual record;
  invalid_count integer;
BEGIN
  SELECT * INTO expected FROM step_collection_contract_normalization_audit;
  SELECT count(*)::bigint AS spec_count,
         coalesce(sum(jsonb_array_length(screen_contract)),0)::bigint AS screen_count,
         coalesce(sum(jsonb_array_length(command_contract)),0)::bigint AS command_count,
         coalesce(sum(jsonb_array_length(api_contract)),0)::bigint AS api_count,
         coalesce(sum(jsonb_array_length(test_contract)),0)::bigint AS test_count
    INTO actual
  FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count
  FROM framework_step_execution_spec
  WHERE jsonb_typeof(screen_contract)<>'array'
     OR jsonb_typeof(command_contract)<>'array'
     OR jsonb_typeof(api_contract)<>'array'
     OR jsonb_typeof(test_contract)<>'array';
  IF invalid_count<>0 THEN
    RAISE EXCEPTION 'STEP_COLLECTION_CONTRACT_NORMALIZATION_FAILED invalid=%',invalid_count;
  END IF;
  IF actual.spec_count<>expected.spec_count
     OR actual.screen_count<>expected.screen_count
     OR actual.command_count<>expected.command_count
     OR actual.api_count<>expected.api_count
     OR actual.test_count<>expected.test_count THEN
    RAISE EXCEPTION 'STEP_COLLECTION_CONTRACT_CARDINALITY_CHANGED expected=% actual=%',row_to_json(expected),row_to_json(actual);
  END IF;
END $$;
