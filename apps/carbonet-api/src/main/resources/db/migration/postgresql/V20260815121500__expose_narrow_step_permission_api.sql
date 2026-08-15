-- Least-privilege runtime/codegen access to normalized step permissions.
-- Raw requirement and grant tables remain unavailable to carbonet_app.

DO $$
DECLARE relation_name text; relation_owner name;
BEGIN
  IF current_user='carbonet_app' THEN
    RAISE EXCEPTION 'step permission API migration must run as table owner'
      USING ERRCODE='42501';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY[
    'framework_permission_requirement_v1','framework_permission_grant_v1'
  ] LOOP
    SELECT pg_get_userbyid(relowner) INTO relation_owner
      FROM pg_class WHERE oid=to_regclass('public.'||relation_name);
    IF relation_owner IS NULL OR relation_owner<>current_user THEN
      RAISE EXCEPTION 'migration role % does not own public.% (owner=%)',
        current_user,relation_name,coalesce(relation_owner::text,'MISSING')
        USING ERRCODE='42501';
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION framework_step_permission_requirements(
  requested_process text,requested_step text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$'
     OR requested_step IS NULL OR requested_step<>btrim(requested_step)
     OR requested_step!~'^[A-Z][A-Z0-9_:-]{1,99}$' THEN
    RAISE EXCEPTION 'invalid process or step permission identity'
      USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'permissionCode',requirement.permission_code,
           'scope',requirement.scope_type,
           'resource',requirement.resource_contract,
           'guard',requirement.guard_contract)
         ORDER BY requirement.permission_code COLLATE "C",
                  requirement.scope_type COLLATE "C"),'[]'::jsonb)
    INTO result
    FROM public.framework_permission_requirement_v1 requirement
   WHERE requirement.process_code=requested_process
     AND requirement.step_code=requested_step
     AND requirement.use_at='Y';
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION framework_authorize_step_permissions(
  requested_process text,requested_step text,requested_actor text
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$'
     OR requested_step IS NULL OR requested_step<>btrim(requested_step)
     OR requested_step!~'^[A-Z][A-Z0-9_:-]{1,99}$'
     OR requested_actor IS NULL OR requested_actor<>btrim(requested_actor)
     OR requested_actor!~'^[A-Z][A-Z0-9_:-]{1,59}$' THEN
    RAISE EXCEPTION 'invalid step permission authorization identity'
      USING ERRCODE='22023';
  END IF;
  RETURN NOT EXISTS(
    SELECT 1
      FROM public.framework_permission_requirement_v1 requirement
     WHERE requirement.process_code=requested_process
       AND requirement.step_code=requested_step
       AND requirement.use_at='Y'
       AND (EXISTS(
         SELECT 1 FROM public.framework_permission_grant_v1 denied_grant
          WHERE denied_grant.actor_code=requested_actor
            AND denied_grant.permission_code=requirement.permission_code
            AND denied_grant.scope_type=requirement.scope_type
            AND denied_grant.effect='DENY' AND denied_grant.use_at='Y'
       ) OR NOT EXISTS(
         SELECT 1 FROM public.framework_permission_grant_v1 allowed_grant
          WHERE allowed_grant.actor_code=requested_actor
            AND allowed_grant.permission_code=requirement.permission_code
            AND allowed_grant.scope_type=requirement.scope_type
            AND allowed_grant.effect='ALLOW' AND allowed_grant.use_at='Y'
       ))
  );
END
$$;

REVOKE ALL ON FUNCTION framework_step_permission_requirements(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION framework_authorize_step_permissions(text,text,text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON TABLE framework_permission_requirement_v1,
      framework_permission_grant_v1 FROM carbonet_app;
    REVOKE ALL ON FUNCTION framework_step_permission_requirements(text,text),
      framework_authorize_step_permissions(text,text,text) FROM carbonet_app;
    GRANT EXECUTE ON FUNCTION framework_step_permission_requirements(text,text),
      framework_authorize_step_permissions(text,text,text) TO carbonet_app;
  END IF;
END
$$;

DO $$
DECLARE requirement_api oid:=to_regprocedure(
          'public.framework_step_permission_requirements(text,text)');
        authorize_api oid:=to_regprocedure(
          'public.framework_authorize_step_permissions(text,text,text)');
BEGIN
  IF requirement_api IS NULL OR authorize_api IS NULL OR EXISTS(
    SELECT 1 FROM pg_proc
     WHERE oid=ANY(ARRAY[requirement_api,authorize_api])
       AND (NOT prosecdef OR proowner<>(current_user::regrole)::oid
         OR NOT coalesce(proconfig,'{}'::text[]) @>
           ARRAY['search_path=pg_catalog, public']::text[])
  ) OR EXISTS(
    SELECT 1 FROM pg_proc function_row
    CROSS JOIN LATERAL aclexplode(
      coalesce(function_row.proacl,acldefault('f',function_row.proowner))) acl
     WHERE function_row.oid=ANY(ARRAY[requirement_api,authorize_api])
       AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'step permission SECURITY DEFINER API postcondition failed'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') AND (
       NOT has_function_privilege('carbonet_app',requirement_api,'EXECUTE')
       OR NOT has_function_privilege('carbonet_app',authorize_api,'EXECUTE')
       OR has_table_privilege('carbonet_app',
            'public.framework_permission_requirement_v1','SELECT')
       OR has_table_privilege('carbonet_app',
            'public.framework_permission_grant_v1','SELECT')
     ) THEN
    RAISE EXCEPTION 'carbonet_app step permission ACL postcondition failed'
      USING ERRCODE='42501';
  END IF;
END
$$;
