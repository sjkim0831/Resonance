CREATE OR REPLACE FUNCTION framework_normalize_step_handoff_contract(contract jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'contractType','STEP_HANDOFF',
    'policy',CASE
      WHEN jsonb_typeof(contract)='object' AND contract->>'contractType'='STEP_HANDOFF'
        THEN coalesce(contract->'policy','{}'::jsonb)
      WHEN jsonb_typeof(contract)='object' AND contract<>'{}'::jsonb THEN contract
      ELSE '{}'::jsonb
    END,
    'transitions',CASE
      WHEN jsonb_typeof(contract)='array' THEN contract
      WHEN jsonb_typeof(contract)='object' AND contract->>'contractType'='STEP_HANDOFF'
           AND jsonb_typeof(contract->'transitions')='array' THEN contract->'transitions'
      ELSE '[]'::jsonb
    END
  );
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_handoff_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.handoff_contract := framework_normalize_step_handoff_contract(NEW.handoff_contract);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_handoff_contract ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_handoff_contract
BEFORE INSERT OR UPDATE OF handoff_contract ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_handoff_contract();

CREATE OR REPLACE FUNCTION framework_refresh_step_execution_source_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.source_hash := md5(
    NEW.actor_contract::text||NEW.business_contract::text||NEW.transition_contract::text||
    NEW.input_contract::text||NEW.output_contract::text||NEW.screen_contract::text||
    NEW.field_contract::text||NEW.command_contract::text||NEW.api_contract::text||
    NEW.persistence_contract::text||NEW.handoff_contract::text||NEW.test_contract::text||
    NEW.guide_contract::text||NEW.nonfunctional_contract::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zzz_framework_refresh_step_execution_source_hash ON framework_step_execution_spec;
CREATE TRIGGER trg_zzz_framework_refresh_step_execution_source_hash
BEFORE INSERT OR UPDATE OF actor_contract,business_contract,transition_contract,input_contract,output_contract,
  screen_contract,field_contract,command_contract,api_contract,persistence_contract,handoff_contract,test_contract,
  guide_contract,nonfunctional_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_refresh_step_execution_source_hash();

CREATE TEMP TABLE step_handoff_contract_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       count(*) FILTER(WHERE jsonb_typeof(handoff_contract)='object' AND handoff_contract<>'{}'::jsonb)::bigint AS policy_count,
       coalesce(sum(CASE WHEN jsonb_typeof(handoff_contract)='array' THEN jsonb_array_length(handoff_contract) ELSE 0 END),0)::bigint AS transition_count
FROM framework_step_execution_spec;

UPDATE framework_step_execution_spec
SET handoff_contract=framework_normalize_step_handoff_contract(handoff_contract),
    updated_at=current_timestamp
WHERE handoff_contract IS DISTINCT FROM framework_normalize_step_handoff_contract(handoff_contract);

ALTER TABLE framework_step_execution_spec
  DROP CONSTRAINT IF EXISTS ck_framework_step_handoff_contract_v1;
ALTER TABLE framework_step_execution_spec
  ADD CONSTRAINT ck_framework_step_handoff_contract_v1 CHECK (
    jsonb_typeof(handoff_contract)='object'
    AND handoff_contract->>'contractType'='STEP_HANDOFF'
    AND jsonb_typeof(handoff_contract->'policy')='object'
    AND jsonb_typeof(handoff_contract->'transitions')='array'
  ) NOT VALID;
ALTER TABLE framework_step_execution_spec
  VALIDATE CONSTRAINT ck_framework_step_handoff_contract_v1;

DO $$
DECLARE expected record; actual record; invalid_count integer;
BEGIN
  SELECT * INTO expected FROM step_handoff_contract_normalization_audit;
  SELECT count(*)::bigint AS spec_count,
         count(*) FILTER(WHERE handoff_contract->'policy'<>'{}'::jsonb)::bigint AS policy_count,
         coalesce(sum(jsonb_array_length(handoff_contract->'transitions')),0)::bigint AS transition_count
    INTO actual
  FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count
  FROM framework_step_execution_spec
  WHERE jsonb_typeof(handoff_contract)<>'object'
     OR handoff_contract->>'contractType'<>'STEP_HANDOFF'
     OR jsonb_typeof(handoff_contract->'policy')<>'object'
     OR jsonb_typeof(handoff_contract->'transitions')<>'array';
  IF invalid_count<>0 THEN
    RAISE EXCEPTION 'STEP_HANDOFF_CONTRACT_NORMALIZATION_FAILED invalid=%',invalid_count;
  END IF;
  IF actual.spec_count<>expected.spec_count
     OR actual.policy_count<>expected.policy_count
     OR actual.transition_count<>expected.transition_count THEN
    RAISE EXCEPTION 'STEP_HANDOFF_CONTRACT_CARDINALITY_CHANGED expected=% actual=%',row_to_json(expected),row_to_json(actual);
  END IF;
END $$;
