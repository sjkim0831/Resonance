INSERT INTO framework_screen_contract_binding(
  screen_key,contract_id,route_path,active_version_id,updated_by)
SELECT upper(c.process_code||'__'||c.step_code||'__'||c.audience||'__'||c.contract_id||'__'||substr(md5(lower(split_part(c.route_path,'?',1))),1,12)),
       c.contract_id,lower(split_part(c.route_path,'?',1)),v.version_id,'SYSTEM'
  FROM framework_professional_screen_contract c
  JOIN framework_screen_contract_version v ON v.contract_id=c.contract_id AND v.version_no=1
ON CONFLICT(screen_key) DO UPDATE SET
  contract_id=excluded.contract_id,
  route_path=excluded.route_path,
  active_version_id=coalesce(framework_screen_contract_binding.active_version_id,excluded.active_version_id),
  updated_at=current_timestamp;

DO $$
DECLARE
  contract_count integer;
  binding_count integer;
BEGIN
  SELECT count(*) INTO contract_count FROM framework_professional_screen_contract;
  SELECT count(*) INTO binding_count
    FROM framework_screen_contract_binding
   WHERE screen_key <> 'EMISSION_PROJECT_CREATE_V1';
  IF binding_count <> contract_count THEN
    RAISE EXCEPTION 'Screen contract binding closure failed: contracts=%, bindings=%', contract_count, binding_count;
  END IF;
END $$;
