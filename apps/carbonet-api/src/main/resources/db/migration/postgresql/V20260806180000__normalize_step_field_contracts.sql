CREATE OR REPLACE FUNCTION framework_normalize_step_field_contract(contract jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'contractType', 'STEP_FIELDS',
    'fields', coalesce((
      SELECT jsonb_agg(
        CASE
          WHEN nullif(field.value->>'audience','') IS NULL
               AND nullif(group_item.value->>'audience','') IS NOT NULL
            THEN field.value || jsonb_build_object('audience',group_item.value->>'audience')
          ELSE field.value
        END
        ORDER BY group_item.ordinality,field.ordinality
      )
      FROM jsonb_array_elements(
        CASE jsonb_typeof(contract)
          WHEN 'array' THEN contract
          WHEN 'object' THEN coalesce(contract->'fields','[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY group_item(value,ordinality)
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(group_item.value)='object'
               AND jsonb_typeof(group_item.value->'fields')='array'
            THEN group_item.value->'fields'
          WHEN jsonb_typeof(group_item.value)='object' THEN jsonb_build_array(group_item.value)
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY field(value,ordinality)
      WHERE jsonb_typeof(field.value)='object'
    ),'[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_field_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.field_contract := framework_normalize_step_field_contract(NEW.field_contract);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_field_contract ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_field_contract
BEFORE INSERT OR UPDATE OF field_contract ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_field_contract();

CREATE TEMP TABLE step_field_contract_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       coalesce(sum(jsonb_array_length(framework_normalize_step_field_contract(field_contract)->'fields')),0)::bigint AS field_count
FROM framework_step_execution_spec;

UPDATE framework_step_execution_spec
SET field_contract=framework_normalize_step_field_contract(field_contract),
    updated_at=current_timestamp
WHERE field_contract IS DISTINCT FROM framework_normalize_step_field_contract(field_contract);

ALTER TABLE framework_step_execution_spec
  DROP CONSTRAINT IF EXISTS ck_framework_step_field_contract_v1;
ALTER TABLE framework_step_execution_spec
  ADD CONSTRAINT ck_framework_step_field_contract_v1 CHECK (
    jsonb_typeof(field_contract)='object'
    AND field_contract->>'contractType'='STEP_FIELDS'
    AND jsonb_typeof(field_contract->'fields')='array'
  ) NOT VALID;
ALTER TABLE framework_step_execution_spec
  VALIDATE CONSTRAINT ck_framework_step_field_contract_v1;

CREATE OR REPLACE VIEW framework_step_generation_readiness AS
SELECT e.process_code,p.process_name,p.domain_code,p.domain_code AS work_type_code,
       e.step_code,s.step_name,s.step_order,s.actor_code,e.spec_version,
       e.design_status,e.approval_status,e.generation_status,e.blocker_codes,e.source_hash,
       CASE WHEN jsonb_typeof(e.screen_contract)='array' THEN jsonb_array_length(e.screen_contract) ELSE 0 END AS page_count,
       jsonb_array_length(coalesce(e.field_contract->'fields','[]'::jsonb)) AS field_count,
       CASE WHEN jsonb_typeof(e.test_contract)='array' THEN jsonb_array_length(e.test_contract) ELSE 0 END AS test_count,
       count(*) FILTER(WHERE d.route_status='IMPLEMENTED')::integer AS implemented_page_count,
       count(*) FILTER(WHERE d.route_status='DESIGN_ONLY')::integer AS planned_page_count
FROM framework_step_execution_spec e
JOIN framework_process_definition p USING(process_code)
JOIN framework_process_step s USING(process_code,step_code)
LEFT JOIN framework_page_design d USING(process_code,step_code)
GROUP BY e.process_code,p.process_name,p.domain_code,e.step_code,s.step_name,s.step_order,s.actor_code,
         e.spec_version,e.design_status,e.approval_status,e.generation_status,e.blocker_codes,e.source_hash,
         e.screen_contract,e.field_contract,e.test_contract;

DO $$
DECLARE invalid_count integer; expected_specs bigint; expected_fields bigint; actual_specs bigint; actual_fields bigint;
BEGIN
  SELECT spec_count,field_count INTO expected_specs,expected_fields FROM step_field_contract_normalization_audit;
  SELECT count(*),coalesce(sum(jsonb_array_length(field_contract->'fields')),0)
    INTO actual_specs,actual_fields FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count
  FROM framework_step_execution_spec
  WHERE jsonb_typeof(field_contract)<>'object'
     OR field_contract->>'contractType'<>'STEP_FIELDS'
     OR jsonb_typeof(field_contract->'fields')<>'array';
  IF invalid_count<>0 THEN
    RAISE EXCEPTION 'STEP_FIELD_CONTRACT_NORMALIZATION_FAILED invalid=%',invalid_count;
  END IF;
  IF actual_specs<>expected_specs OR actual_fields<>expected_fields THEN
    RAISE EXCEPTION 'STEP_FIELD_CONTRACT_CARDINALITY_CHANGED specs=%/% fields=%/%',actual_specs,expected_specs,actual_fields,expected_fields;
  END IF;
END $$;
