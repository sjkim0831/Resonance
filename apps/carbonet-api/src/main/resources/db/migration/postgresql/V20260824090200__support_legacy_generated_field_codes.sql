-- Existing professional contracts use `code`; generated contracts use
-- `fieldCode`. Normalize both at the compiler boundary so reviewed legacy
-- contracts remain executable without rewriting their persisted evidence.
DO $patch$
DECLARE original_definition text;
DECLARE patched_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.framework_normalize_generated_composite_design(jsonb)'::regprocedure)
    INTO original_definition;
  patched_definition:=replace(original_definition,
    $$field->>'fieldCode'$$,
    $$coalesce(field->>'fieldCode',field->>'code')$$);
  IF patched_definition=original_definition THEN
    RAISE EXCEPTION 'generated legacy field-code compatibility target is not exact'
      USING ERRCODE='55000';
  END IF;
  EXECUTE patched_definition;
END
$patch$;

DO $postcondition$
DECLARE definition text:=pg_get_functiondef(
  'public.framework_normalize_generated_composite_design(jsonb)'::regprocedure);
DECLARE legacy_probe jsonb;
BEGIN
  IF position($$field->>'code'$$ in definition)=0 THEN
    RAISE EXCEPTION 'generated legacy field-code compatibility postcondition failed'
      USING ERRCODE='55000';
  END IF;
  legacy_probe:=public.framework_normalize_generated_composite_design(
    '{"identity":{"processCode":"LEGACY_PROCESS","stepCode":"LEGACY_STEP","audience":"USER","actorCode":"OPERATOR"},"step":{"commandCode":"SAVE_LEGACY"},"lanes":{"FRONTEND":{"fields":[{"code":"businessValue","editable":true,"required":true,"dataType":"STRING"}],"permissionCodes":["OPERATOR:USER"]}}}'::jsonb
  );
  IF legacy_probe#>>'{lanes,FRONTEND,fields,0,fieldCode}'<>'businessValue'
     OR legacy_probe#>>'{lanes,API,0,requestFields,0}'<>'businessValue' THEN
    RAISE EXCEPTION 'generated legacy field-code compatibility probe failed'
      USING ERRCODE='55000';
  END IF;
END
$postcondition$;

REVOKE ALL ON FUNCTION public.framework_normalize_generated_composite_design(jsonb) FROM PUBLIC;
DO $$ BEGIN
  IF to_regrole('carbonet_app') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.framework_normalize_generated_composite_design(jsonb) TO carbonet_app;
  END IF;
END $$;
