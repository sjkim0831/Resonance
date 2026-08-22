-- A professional screen contract is the canonical page authority.  Legacy page
-- design rows may remain for audit, but must not veto an exact professional
-- route or actor binding during executable-spec refresh.
DO $migration$
DECLARE
  original_definition text;
  patched_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.framework_refresh_process_execution_specs(text,text)'::regprocedure)
    INTO original_definition;

  patched_definition:=replace(original_definition,
    E'OR (page.process_code IS NOT NULL\n                    AND NOT coalesce(page.route_exact,false))',
    E'OR (professional.process_code IS NULL\n                    AND page.process_code IS NOT NULL\n                    AND NOT coalesce(page.route_exact,false))');
  patched_definition:=replace(patched_definition,
    E'OR (page.process_code IS NOT NULL\n                    AND NOT coalesce(page.actor_exact,false))',
    E'OR (professional.process_code IS NULL\n                    AND page.process_code IS NOT NULL\n                    AND NOT coalesce(page.actor_exact,false))');

  IF patched_definition=original_definition
     OR position(E'professional.process_code IS NULL\n                    AND page.process_code IS NOT NULL\n                    AND NOT coalesce(page.route_exact,false)' IN patched_definition)=0
     OR position(E'professional.process_code IS NULL\n                    AND page.process_code IS NOT NULL\n                    AND NOT coalesce(page.actor_exact,false)' IN patched_definition)=0 THEN
    RAISE EXCEPTION 'professional screen authority patch target is not exact'
      USING ERRCODE='55000';
  END IF;

  EXECUTE patched_definition;
END
$migration$;

DO $postcondition$
DECLARE definition text:=pg_get_functiondef(
  'public.framework_refresh_process_execution_specs(text,text)'::regprocedure);
BEGIN
  IF position(E'professional.process_code IS NULL\n                    AND page.process_code IS NOT NULL\n                    AND NOT coalesce(page.route_exact,false)' IN definition)=0
     OR position(E'professional.process_code IS NULL\n                    AND page.process_code IS NOT NULL\n                    AND NOT coalesce(page.actor_exact,false)' IN definition)=0 THEN
    RAISE EXCEPTION 'professional screen authority postcondition failed'
      USING ERRCODE='55000';
  END IF;
END
$postcondition$;
