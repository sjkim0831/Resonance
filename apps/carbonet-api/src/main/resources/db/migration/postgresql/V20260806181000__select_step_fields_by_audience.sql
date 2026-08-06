CREATE OR REPLACE FUNCTION framework_step_contract_fields(contract jsonb,preferred_audience text DEFAULT 'USER')
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  WITH fields AS (
    SELECT field.value,field.ordinality,
           nullif(field.value->>'fieldCode','') AS field_code,
           nullif(field.value->>'audience','') AS audience
    FROM jsonb_array_elements(coalesce(framework_normalize_step_field_contract(contract)->'fields','[]'::jsonb))
         WITH ORDINALITY field(value,ordinality)
    WHERE jsonb_typeof(field.value)='object' AND nullif(field.value->>'fieldCode','') IS NOT NULL
  ), ranked AS (
    SELECT DISTINCT ON(field_code) value,ordinality
    FROM fields
    ORDER BY field_code,
      CASE WHEN audience=preferred_audience THEN 0 WHEN audience IS NULL THEN 1 ELSE 2 END,
      ordinality
  )
  SELECT coalesce(jsonb_agg(value ORDER BY coalesce((value->>'fieldOrder')::integer,9999),ordinality),'[]'::jsonb)
  FROM ranked;
$$;

DO $$
DECLARE invalid_count integer;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM framework_step_execution_spec
  WHERE jsonb_typeof(framework_step_contract_fields(field_contract,'USER'))<>'array';
  IF invalid_count<>0 THEN
    RAISE EXCEPTION 'STEP_FIELD_AUDIENCE_SELECTION_FAILED invalid=%',invalid_count;
  END IF;
END $$;
