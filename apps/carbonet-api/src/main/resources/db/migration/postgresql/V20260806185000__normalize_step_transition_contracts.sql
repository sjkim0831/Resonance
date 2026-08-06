CREATE OR REPLACE FUNCTION framework_normalize_step_transition_contract(contract jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'contractType','STEP_TRANSITION',
    'commandCode',contract->'commandCode',
    'fromState',to_jsonb(coalesce(contract->>'fromState',contract->>'from')),
    'toState',to_jsonb(coalesce(contract->>'toState',contract->>'to')),
    'stepOrder',contract->'stepOrder',
    'stepType',contract->'stepType',
    'parentStepCode',contract->'parentStepCode',
    'completionRule',contract->'completionRule',
    'policy',CASE
      WHEN contract->>'contractType'='STEP_TRANSITION' AND jsonb_typeof(contract->'policy')='object'
        THEN contract->'policy'
      ELSE jsonb_strip_nulls(jsonb_build_object(
        'optimisticLock',contract->'optimisticLock',
        'idempotencyRequired',contract->'idempotencyRequired',
        'auditRequired',contract->'auditRequired',
        'invalidStatesRejected',contract->'invalidStatesRejected'))
    END,
    'guards',CASE WHEN jsonb_typeof(contract->'guards')='array' THEN contract->'guards' ELSE '[]'::jsonb END,
    'sideEffects',CASE WHEN jsonb_typeof(contract->'sideEffects')='array' THEN contract->'sideEffects' ELSE '[]'::jsonb END,
    'extensions',CASE
      WHEN contract->>'contractType'='STEP_TRANSITION' AND jsonb_typeof(contract->'extensions')='object'
        THEN contract->'extensions'
      ELSE contract-ARRAY[
        'schemaVersion','contractType','commandCode','fromState','from','toState','to','stepOrder','stepType',
        'parentStepCode','completionRule','optimisticLock','idempotencyRequired','auditRequired',
        'invalidStatesRejected','policy','guards','sideEffects','extensions'
      ]::text[]
    END
  );
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_transition_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.transition_contract := framework_normalize_step_transition_contract(NEW.transition_contract);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_transition_contract ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_transition_contract
BEFORE INSERT OR UPDATE OF transition_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_transition_contract();

CREATE TEMP TABLE step_transition_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       md5(string_agg(
         coalesce(transition_contract->>'commandCode','')||'|'||
         coalesce(transition_contract->>'fromState',transition_contract->>'from','')||'|'||
         coalesce(transition_contract->>'toState',transition_contract->>'to',''),
         '||' ORDER BY process_code,step_code)) AS semantic_hash
FROM framework_step_execution_spec;

UPDATE framework_step_execution_spec
SET transition_contract=framework_normalize_step_transition_contract(transition_contract),
    updated_at=current_timestamp
WHERE transition_contract IS DISTINCT FROM framework_normalize_step_transition_contract(transition_contract);

ALTER TABLE framework_step_execution_spec DROP CONSTRAINT IF EXISTS ck_framework_step_transition_contract_v1;
ALTER TABLE framework_step_execution_spec ADD CONSTRAINT ck_framework_step_transition_contract_v1 CHECK (
  jsonb_typeof(transition_contract)='object'
  AND transition_contract->>'contractType'='STEP_TRANSITION'
  AND length(coalesce(transition_contract->>'fromState',''))>0
  AND length(coalesce(transition_contract->>'toState',''))>0
  AND jsonb_typeof(transition_contract->'policy')='object'
  AND jsonb_typeof(transition_contract->'guards')='array'
  AND jsonb_typeof(transition_contract->'sideEffects')='array'
  AND jsonb_typeof(transition_contract->'extensions')='object'
) NOT VALID;
ALTER TABLE framework_step_execution_spec VALIDATE CONSTRAINT ck_framework_step_transition_contract_v1;

DO $$
DECLARE expected record; actual record; invalid_count integer;
BEGIN
  SELECT * INTO expected FROM step_transition_normalization_audit;
  SELECT count(*)::bigint AS spec_count,
         md5(string_agg(
           coalesce(transition_contract->>'commandCode','')||'|'||
           coalesce(transition_contract->>'fromState','')||'|'||
           coalesce(transition_contract->>'toState',''),
           '||' ORDER BY process_code,step_code)) AS semantic_hash
    INTO actual FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count FROM framework_step_execution_spec
  WHERE transition_contract->>'contractType'<>'STEP_TRANSITION'
     OR length(coalesce(transition_contract->>'fromState',''))=0
     OR length(coalesce(transition_contract->>'toState',''))=0
     OR jsonb_typeof(transition_contract->'policy')<>'object'
     OR jsonb_typeof(transition_contract->'guards')<>'array'
     OR jsonb_typeof(transition_contract->'sideEffects')<>'array'
     OR jsonb_typeof(transition_contract->'extensions')<>'object';
  IF invalid_count<>0 THEN RAISE EXCEPTION 'STEP_TRANSITION_NORMALIZATION_FAILED invalid=%',invalid_count; END IF;
  IF actual.spec_count<>expected.spec_count OR actual.semantic_hash<>expected.semantic_hash THEN
    RAISE EXCEPTION 'STEP_TRANSITION_SEMANTICS_CHANGED expected=% actual=%',row_to_json(expected),row_to_json(actual);
  END IF;
END $$;
