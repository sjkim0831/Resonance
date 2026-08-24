-- REQUEST projections are executable only when every echoed business field is
-- part of the required request schema. Generated composite commands therefore
-- publish editable business fields as required inputs.
DO $patch$
DECLARE original_definition text;
DECLARE patched_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.framework_normalize_generated_composite_design(jsonb)'::regprocedure)
    INTO original_definition;
  patched_definition:=replace(original_definition,
    $$'required',coalesce((field->>'required')::boolean,false)$$,
    $$'required', true$$);
  IF patched_definition=original_definition THEN
    RAISE EXCEPTION 'generated command required-field patch target is not exact'
      USING ERRCODE='55000';
  END IF;
  EXECUTE patched_definition;
END
$patch$;

REVOKE ALL ON FUNCTION public.framework_normalize_generated_composite_design(jsonb) FROM PUBLIC;
DO $$ BEGIN
  IF to_regrole('carbonet_app') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.framework_normalize_generated_composite_design(jsonb) TO carbonet_app;
  END IF;
END $$;
