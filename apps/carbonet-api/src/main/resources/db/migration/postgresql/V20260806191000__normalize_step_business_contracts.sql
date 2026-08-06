CREATE OR REPLACE FUNCTION framework_normalize_step_business_contract(
  contract jsonb,fallback_step_name text,fallback_requirement text,fallback_completion_rule text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'contractType','STEP_BUSINESS',
    'domainCode',contract->'domainCode',
    'processName',contract->'processName',
    'stepName',to_jsonb(coalesce(nullif(contract->>'stepName',''),nullif(fallback_step_name,''))),
    'goal',contract->'goal',
    'requirement',to_jsonb(coalesce(nullif(contract->>'requirement',''),nullif(contract->>'purpose',''),nullif(fallback_requirement,''))),
    'completionRule',to_jsonb(coalesce(nullif(contract->>'completionRule',''),nullif(fallback_completion_rule,''))),
    'riskLevel',contract->'riskLevel',
    'slaHours',contract->'slaHours',
    'regulationRefs',contract->'regulationRefs',
    'preconditions',CASE WHEN jsonb_typeof(contract->'preconditions')='array' THEN contract->'preconditions' ELSE '[]'::jsonb END,
    'deliverables',CASE WHEN jsonb_typeof(contract->'deliverables')='array' THEN contract->'deliverables' ELSE '[]'::jsonb END,
    'exceptions',CASE WHEN jsonb_typeof(contract->'exceptions')='array' THEN contract->'exceptions' ELSE '[]'::jsonb END,
    'policy',CASE
      WHEN contract->>'contractType'='STEP_BUSINESS' AND jsonb_typeof(contract->'policy')='object'
        THEN contract->'policy'
      ELSE jsonb_strip_nulls(jsonb_build_object(
        'deliveryAdapterRequired',contract->'deliveryAdapterRequired',
        'browserOnlyVerificationForbidden',contract->'browserOnlyVerificationForbidden'))
    END,
    'extensions',CASE
      WHEN contract->>'contractType'='STEP_BUSINESS' AND jsonb_typeof(contract->'extensions')='object'
        THEN contract->'extensions'
      ELSE contract-ARRAY[
        'schemaVersion','contractType','domainCode','processName','stepName','goal','requirement','purpose',
        'completionRule','riskLevel','slaHours','regulationRefs','preconditions','deliverables','exceptions',
        'deliveryAdapterRequired','browserOnlyVerificationForbidden','policy','extensions'
      ]::text[]
    END
  );
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_business_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE source_step framework_process_step%ROWTYPE;
BEGIN
  SELECT * INTO source_step FROM framework_process_step
  WHERE process_code=NEW.process_code AND step_code=NEW.step_code;
  NEW.business_contract := framework_normalize_step_business_contract(
    NEW.business_contract,source_step.step_name,source_step.requirement_text,source_step.completion_rule);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_business_contract ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_business_contract
BEFORE INSERT OR UPDATE OF business_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_business_contract();

CREATE TEMP TABLE step_business_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       count(*) FILTER(WHERE length(coalesce(e.business_contract->>'stepName',''))=0
                         OR length(coalesce(e.business_contract->>'requirement',''))=0)::bigint AS enriched_count,
       md5(string_agg(
         (framework_normalize_step_business_contract(e.business_contract,s.step_name,s.requirement_text,s.completion_rule)->>'stepName')||'|'||
         (framework_normalize_step_business_contract(e.business_contract,s.step_name,s.requirement_text,s.completion_rule)->>'requirement')||'|'||
         (framework_normalize_step_business_contract(e.business_contract,s.step_name,s.requirement_text,s.completion_rule)->>'completionRule'),
         '||' ORDER BY e.process_code,e.step_code)) AS semantic_hash
FROM framework_step_execution_spec e
JOIN framework_process_step s USING(process_code,step_code);

UPDATE framework_step_execution_spec e
SET business_contract=framework_normalize_step_business_contract(e.business_contract,s.step_name,s.requirement_text,s.completion_rule),
    updated_at=current_timestamp
FROM framework_process_step s
WHERE s.process_code=e.process_code AND s.step_code=e.step_code
  AND e.business_contract IS DISTINCT FROM framework_normalize_step_business_contract(e.business_contract,s.step_name,s.requirement_text,s.completion_rule);

ALTER TABLE framework_step_execution_spec DROP CONSTRAINT IF EXISTS ck_framework_step_business_contract_v1;
ALTER TABLE framework_step_execution_spec ADD CONSTRAINT ck_framework_step_business_contract_v1 CHECK (
  jsonb_typeof(business_contract)='object'
  AND business_contract->>'contractType'='STEP_BUSINESS'
  AND length(coalesce(business_contract->>'stepName',''))>0
  AND length(coalesce(business_contract->>'requirement',''))>0
  AND length(coalesce(business_contract->>'completionRule',''))>0
  AND jsonb_typeof(business_contract->'preconditions')='array'
  AND jsonb_typeof(business_contract->'deliverables')='array'
  AND jsonb_typeof(business_contract->'exceptions')='array'
  AND jsonb_typeof(business_contract->'policy')='object'
  AND jsonb_typeof(business_contract->'extensions')='object'
) NOT VALID;
ALTER TABLE framework_step_execution_spec VALIDATE CONSTRAINT ck_framework_step_business_contract_v1;

DO $$
DECLARE expected record; actual record; invalid_count integer;
BEGIN
  SELECT * INTO expected FROM step_business_normalization_audit;
  SELECT count(*)::bigint AS spec_count,
         md5(string_agg(
           (business_contract->>'stepName')||'|'||(business_contract->>'requirement')||'|'||(business_contract->>'completionRule'),
           '||' ORDER BY process_code,step_code)) AS semantic_hash
    INTO actual FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count FROM framework_step_execution_spec
  WHERE business_contract->>'contractType'<>'STEP_BUSINESS'
     OR length(coalesce(business_contract->>'stepName',''))=0
     OR length(coalesce(business_contract->>'requirement',''))=0
     OR length(coalesce(business_contract->>'completionRule',''))=0
     OR jsonb_typeof(business_contract->'preconditions')<>'array'
     OR jsonb_typeof(business_contract->'deliverables')<>'array'
     OR jsonb_typeof(business_contract->'exceptions')<>'array'
     OR jsonb_typeof(business_contract->'policy')<>'object'
     OR jsonb_typeof(business_contract->'extensions')<>'object';
  IF invalid_count<>0 THEN RAISE EXCEPTION 'STEP_BUSINESS_NORMALIZATION_FAILED invalid=%',invalid_count; END IF;
  IF actual.spec_count<>expected.spec_count OR actual.semantic_hash<>expected.semantic_hash THEN
    RAISE EXCEPTION 'STEP_BUSINESS_SEMANTICS_CHANGED expected=% actual=%',row_to_json(expected),row_to_json(actual);
  END IF;
END $$;
