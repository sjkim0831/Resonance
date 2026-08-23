-- Each generated screen owns one immutable command-adapter route.  Include the
-- process, step, and audience identity so USER/ADMIN lanes and adjacent steps
-- cannot collide in the global endpoint catalog.
DO $migration$
DECLARE original_definition text;
DECLARE patched_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.framework_normalize_generated_composite_design(jsonb)'::regprocedure)
    INTO original_definition;
  patched_definition:=replace(original_definition,
    $$'path', '/home/api/process-executions/{executionId}/commands'$$,
    $$'path', '/home/api/process-executions/{executionId}/commands/'||lower(identity->>'processCode')||'/'||lower(identity->>'stepCode')||'/'||lower(identity->>'audience')$$);
  IF patched_definition=original_definition THEN
    RAISE EXCEPTION 'generated command route patch target is not exact'
      USING ERRCODE='55000';
  END IF;
  EXECUTE patched_definition;
END
$migration$;

DO $postcondition$
DECLARE definition text:=pg_get_functiondef(
  'public.framework_normalize_generated_composite_design(jsonb)'::regprocedure);
BEGIN
  IF position($$lower(identity ->> 'processCode'::text)$$ in definition)=0
     OR position($$lower(identity ->> 'stepCode'::text)$$ in definition)=0
     OR position($$lower(identity ->> 'audience'::text)$$ in definition)=0 THEN
    RAISE EXCEPTION 'generated command route postcondition failed'
      USING ERRCODE='55000';
  END IF;
END
$postcondition$;
