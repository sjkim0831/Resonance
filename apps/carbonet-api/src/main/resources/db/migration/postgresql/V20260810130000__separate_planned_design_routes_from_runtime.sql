-- A /planned route is a reviewable design asset, never an executable runtime
-- entry point.  The professional screen graph synchronizer historically
-- projected both real and planned routes as IMPLEMENTED/ACTIVE, allowing a
-- design preview to compete with the real screen during workflow resolution.

CREATE OR REPLACE FUNCTION framework_guard_planned_screen_resource()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF lower(NEW.route_key) LIKE '/planned/%'
     OR lower(NEW.route_key) LIKE '/admin/planned/%' THEN
    NEW.implementation_status := 'DESIGN_ONLY';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_planned_screen_resource
  ON framework_screen_resource;
CREATE TRIGGER trg_guard_planned_screen_resource
BEFORE INSERT OR UPDATE OF route_key,implementation_status
ON framework_screen_resource
FOR EACH ROW EXECUTE FUNCTION framework_guard_planned_screen_resource();

CREATE OR REPLACE FUNCTION framework_guard_planned_step_binding()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_route varchar;
BEGIN
  SELECT route_key INTO target_route
  FROM framework_screen_resource
  WHERE screen_resource_id=NEW.screen_resource_id;

  IF lower(coalesce(target_route,'')) LIKE '/planned/%'
     OR lower(coalesce(target_route,'')) LIKE '/admin/planned/%' THEN
    NEW.binding_status := 'DRAFT';
    NEW.contract_status := 'DESIGNED';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_planned_step_binding
  ON framework_process_step_screen_binding;
CREATE TRIGGER trg_guard_planned_step_binding
BEFORE INSERT OR UPDATE OF screen_resource_id,binding_status,contract_status
ON framework_process_step_screen_binding
FOR EACH ROW EXECUTE FUNCTION framework_guard_planned_step_binding();

UPDATE framework_screen_resource
SET implementation_status='DESIGN_ONLY',updated_at=current_timestamp
WHERE (lower(route_key) LIKE '/planned/%'
       OR lower(route_key) LIKE '/admin/planned/%')
  AND implementation_status<>'DESIGN_ONLY';

UPDATE framework_process_step_screen_binding binding
SET binding_status='DRAFT',contract_status='DESIGNED',updated_at=current_timestamp
FROM framework_screen_resource resource
WHERE resource.screen_resource_id=binding.screen_resource_id
  AND (lower(resource.route_key) LIKE '/planned/%'
       OR lower(resource.route_key) LIKE '/admin/planned/%')
  AND (binding.binding_status<>'DRAFT'
       OR binding.contract_status<>'DESIGNED');

DO $$
DECLARE active_planned integer;
DECLARE implemented_planned integer;
BEGIN
  SELECT count(*) INTO active_planned
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource resource USING(screen_resource_id)
  WHERE binding.binding_status='ACTIVE'
    AND (lower(resource.route_key) LIKE '/planned/%'
         OR lower(resource.route_key) LIKE '/admin/planned/%');

  SELECT count(*) INTO implemented_planned
  FROM framework_screen_resource
  WHERE implementation_status<>'DESIGN_ONLY'
    AND (lower(route_key) LIKE '/planned/%'
         OR lower(route_key) LIKE '/admin/planned/%');

  IF active_planned<>0 OR implemented_planned<>0 THEN
    RAISE EXCEPTION 'PLANNED_RUNTIME_SEPARATION_FAILED active=% implemented=%',
      active_planned,implemented_planned;
  END IF;
END $$;
