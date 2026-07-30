-- Every screen resource must remain addressable even when an older generator
-- only supplies the route. Keep the invariant at the database boundary so all
-- current and future generators receive the same deterministic screen code.
CREATE OR REPLACE FUNCTION framework_fill_screen_resource_code()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.screen_code IS NULL OR btrim(NEW.screen_code)='' THEN
    IF NEW.route_key IS NULL OR btrim(NEW.route_key)='' THEN
      RAISE EXCEPTION 'framework_screen_resource.route_key is required to derive screen_code';
    END IF;
    NEW.screen_code := 'SCR_'||upper(substr(md5(lower(split_part(NEW.route_key,'?',1))),1,20));
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_framework_screen_resource_code
  ON framework_screen_resource;
CREATE TRIGGER trg_framework_screen_resource_code
BEFORE INSERT OR UPDATE OF route_key,screen_code
ON framework_screen_resource
FOR EACH ROW
EXECUTE FUNCTION framework_fill_screen_resource_code();

-- Prove the guard without retaining test data.
DO $block$
DECLARE
  generated_code varchar(120);
BEGIN
  INSERT INTO framework_screen_resource(
    route_key,screen_name,screen_type,implementation_status,source_kind
  ) VALUES(
    '/__migration__/screen-code-guard',
    'Screen code guard verification',
    'DETAIL',
    'DESIGN_ONLY',
    'MIGRATION_TEST'
  )
  ON CONFLICT(route_key) DO UPDATE SET screen_code=NULL
  RETURNING screen_code INTO generated_code;

  IF generated_code IS NULL OR generated_code NOT LIKE 'SCR_%' THEN
    RAISE EXCEPTION 'screen resource code guard did not generate a code';
  END IF;

  DELETE FROM framework_screen_resource
  WHERE route_key='/__migration__/screen-code-guard';
END
$block$;
