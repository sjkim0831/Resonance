-- Bind editable professional-screen permissions to the canonical design,
-- generator input, and the central runtime authorization decision.

DO $$
DECLARE relation_name text; relation_owner name;
BEGIN
  IF current_user='carbonet_app' THEN
    RAISE EXCEPTION 'professional permission API migration must run as table owner'
      USING ERRCODE='42501';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY[
    'framework_professional_screen_contract',
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

-- The exact authority wrapper is the common source for the screen bundle and
-- process catalog. Adding the canonical permission set here makes a
-- permission-only save change the same designHash everywhere.
CREATE OR REPLACE FUNCTION public.framework_canonical_screen_design(
  requested_process_code varchar,
  requested_step_code varchar,
  requested_audience varchar,
  requested_route_path varchar,
  proposed_values jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  normalized_process varchar(80):=upper(btrim(requested_process_code));
  normalized_step varchar(100):=upper(btrim(requested_step_code));
  normalized_audience varchar(20):=upper(btrim(requested_audience));
  normalized_route varchar(400):=lower(split_part(btrim(requested_route_path),'?',1));
  selected_contract_id bigint;
  selected_blueprint_id bigint;
  persisted_permissions jsonb;
  projected_permissions jsonb;
  clean_proposed jsonb:=coalesce(proposed_values,'{}'::jsonb);
  canonical_permissions jsonb;
  canonical_design jsonb;
BEGIN
  IF normalized_process='' OR normalized_step='' OR normalized_route=''
     OR normalized_route!~'^/' OR normalized_audience NOT IN ('USER','ADMIN')
     OR jsonb_typeof(clean_proposed)<>'object' THEN
    RAISE EXCEPTION 'invalid canonical screen identity or projection'
      USING ERRCODE='22023';
  END IF;
  SELECT contract.contract_id,contract.permission_codes
    INTO STRICT selected_contract_id,persisted_permissions
    FROM public.framework_professional_screen_contract contract
   WHERE upper(contract.process_code)=normalized_process
     AND upper(contract.step_code)=normalized_step
     AND upper(contract.audience)=normalized_audience
     AND lower(split_part(contract.route_path,'?',1))=normalized_route;
  selected_blueprint_id:=public.framework_canonical_blueprint_authority(
    normalized_process,normalized_step,normalized_audience,normalized_route,
    selected_contract_id
  );
  IF clean_proposed ? 'permissionCodes' THEN
    projected_permissions:=CASE jsonb_typeof(clean_proposed->'permissionCodes')
      WHEN 'array' THEN clean_proposed->'permissionCodes'
      WHEN 'string' THEN (clean_proposed->>'permissionCodes')::jsonb
      ELSE NULL END;
    IF projected_permissions IS NULL OR jsonb_typeof(projected_permissions)<>'array' THEN
      RAISE EXCEPTION 'permissionCodes projection must be a JSON array'
        USING ERRCODE='22023';
    END IF;
    clean_proposed:=clean_proposed-'permissionCodes';
  ELSE
    projected_permissions:=persisted_permissions;
  END IF;
  canonical_permissions:=public.framework_design_causality_json_set(
    projected_permissions
  );
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(canonical_permissions) permission
     WHERE permission#>>'{}'!~'^[A-Z][A-Z0-9_:-]{1,119}$'
  ) THEN
    RAISE EXCEPTION 'professional permission code is invalid'
      USING ERRCODE='22023';
  END IF;
  canonical_design:=public.framework_canonical_screen_design_exact(
    selected_blueprint_id,selected_contract_id,clean_proposed
  );
  canonical_design:=jsonb_set(
    canonical_design,'{lanes,DESIGN_CARD,permissionCodes}',
    canonical_permissions,true
  );
  canonical_design:=jsonb_set(
    canonical_design,'{lanes,FRONTEND,permissionCodes}',
    canonical_permissions,true
  );
  RETURN canonical_design;
END
$$;

COMMENT ON FUNCTION public.framework_canonical_screen_design(
  varchar,varchar,varchar,varchar,jsonb
) IS 'Exact canonical compiler with authoritative professional permissionCodes in DESIGN_CARD and FRONTEND lanes';

CREATE OR REPLACE FUNCTION public.framework_step_permission_requirements(
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
  IF EXISTS(
    SELECT 1
     FROM public.framework_professional_screen_contract contract
     WHERE contract.process_code=requested_process
       AND contract.step_code=requested_step
       AND (jsonb_typeof(contract.permission_codes)<>'array' OR EXISTS(
         SELECT 1 FROM jsonb_array_elements(CASE
                    WHEN jsonb_typeof(contract.permission_codes)='array'
                    THEN contract.permission_codes ELSE '[]'::jsonb END) member
          WHERE jsonb_typeof(member)<>'string'
             OR btrim(member#>>'{}')=''
             OR member#>>'{}'<>upper(btrim(member#>>'{}'))
             OR upper(btrim(member#>>'{}'))!~'^[A-Z][A-Z0-9_:-]{1,119}$'
       ))
  ) THEN
    RAISE EXCEPTION 'malformed professional permissionCodes for % / %',
      requested_process,requested_step USING ERRCODE='22023';
  END IF;
  WITH requirement_rows AS (
    SELECT 0 source_order,requirement.permission_code,
           requirement.scope_type,
           requirement.resource_contract resource_value,
           requirement.guard_contract guard_value,
           '' route_path,'' audience,'' actor_code,0::bigint contract_id
      FROM public.framework_permission_requirement_v1 requirement
     WHERE requirement.process_code=requested_process
       AND requirement.step_code=requested_step
       AND requirement.use_at='Y'
    UNION ALL
    SELECT 1,upper(btrim(permission.value)),'PROJECT',
           jsonb_build_object(
             'routePath',lower(split_part(contract.route_path,'?',1)),
             'audience',upper(contract.audience),
             'contractId',contract.contract_id),
           jsonb_build_object(
             'actorCode',upper(contract.actor_code),
             'source','PROFESSIONAL_SCREEN_CONTRACT'),
           lower(split_part(contract.route_path,'?',1)),
           upper(contract.audience),upper(contract.actor_code),contract.contract_id
      FROM public.framework_professional_screen_contract contract
      CROSS JOIN LATERAL jsonb_array_elements_text(
        contract.permission_codes) permission(value)
     WHERE contract.process_code=requested_process
       AND contract.step_code=requested_step
       AND NOT EXISTS(
         SELECT 1 FROM public.framework_permission_requirement_v1 normalized
          WHERE normalized.process_code=requested_process
            AND normalized.step_code=requested_step
            AND normalized.permission_code=upper(btrim(permission.value))
            AND normalized.scope_type='PROJECT' AND normalized.use_at='Y'
       )
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'permissionCode',permission_code,
           'scope',scope_type,
           'resource',resource_value,
           'guard',guard_value)
         ORDER BY source_order,permission_code COLLATE "C",
                  scope_type COLLATE "C",route_path COLLATE "C",
                  audience COLLATE "C",actor_code COLLATE "C",contract_id),
         '[]'::jsonb)
    INTO result
    FROM requirement_rows;
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_authorize_step_permissions(
  requested_process text,requested_step text,requested_actor text,
  requested_route_path text,requested_audience text
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  route_supplied boolean:=coalesce(requested_route_path,'')<>'';
  audience_supplied boolean:=coalesce(requested_audience,'')<>'';
  normalized_route text:=lower(split_part(coalesce(requested_route_path,''),'?',1));
  normalized_audience text:=upper(coalesce(requested_audience,''));
  exact_contract_count integer;
  has_bound_contract boolean;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$'
     OR requested_step IS NULL OR requested_step<>btrim(requested_step)
     OR requested_step!~'^[A-Z][A-Z0-9_:-]{1,99}$'
     OR requested_actor IS NULL OR requested_actor<>btrim(requested_actor)
     OR requested_actor!~'^[A-Z][A-Z0-9_:-]{1,59}$'
     OR route_supplied<>audience_supplied
     OR (route_supplied AND (
       requested_route_path<>btrim(requested_route_path)
       OR normalized_route!~'^/' OR length(normalized_route)>400
       OR requested_audience<>normalized_audience
       OR normalized_audience NOT IN ('USER','ADMIN')
     )) THEN
    RAISE EXCEPTION 'invalid step permission authorization identity'
      USING ERRCODE='22023';
  END IF;
  IF EXISTS(
    SELECT 1
      FROM public.framework_professional_screen_contract contract
     WHERE contract.process_code=requested_process
       AND contract.step_code=requested_step
       AND (jsonb_typeof(contract.permission_codes)<>'array' OR EXISTS(
         SELECT 1 FROM jsonb_array_elements(CASE
                    WHEN jsonb_typeof(contract.permission_codes)='array'
                    THEN contract.permission_codes ELSE '[]'::jsonb END) member
          WHERE jsonb_typeof(member)<>'string'
             OR btrim(member#>>'{}')=''
             OR member#>>'{}'<>upper(btrim(member#>>'{}'))
             OR upper(btrim(member#>>'{}'))!~'^[A-Z][A-Z0-9_:-]{1,119}$'
       ))
  ) THEN
    RAISE EXCEPTION 'malformed professional permissionCodes for % / %',
      requested_process,requested_step USING ERRCODE='22023';
  END IF;
  IF route_supplied THEN
    SELECT count(*) INTO exact_contract_count
      FROM public.framework_professional_screen_contract contract
     WHERE contract.process_code=requested_process
       AND contract.step_code=requested_step
       AND upper(contract.audience)=normalized_audience
       AND lower(split_part(contract.route_path,'?',1))=normalized_route;
    IF exact_contract_count<>1 THEN RETURN false; END IF;
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.framework_professional_screen_contract contract
     WHERE contract.process_code=requested_process
       AND contract.step_code=requested_step
       AND upper(contract.actor_code)=requested_actor
  ) INTO has_bound_contract;

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
  ) AND NOT EXISTS(
    SELECT 1
      FROM public.framework_professional_screen_contract contract
      CROSS JOIN LATERAL jsonb_array_elements_text(
        contract.permission_codes) permission(value)
     WHERE contract.process_code=requested_process
       AND contract.step_code=requested_step
       AND NOT EXISTS(
         SELECT 1 FROM public.framework_permission_requirement_v1 normalized
          WHERE normalized.process_code=requested_process
            AND normalized.step_code=requested_step
            AND normalized.permission_code=upper(btrim(permission.value))
            AND normalized.scope_type='PROJECT' AND normalized.use_at='Y'
       )
       AND (CASE WHEN route_supplied THEN
              upper(contract.audience)=normalized_audience
              AND lower(split_part(contract.route_path,'?',1))=normalized_route
            ELSE upper(contract.actor_code)=requested_actor
              OR NOT has_bound_contract END)
       AND (EXISTS(
         SELECT 1 FROM public.framework_permission_grant_v1 denied_grant
          WHERE denied_grant.actor_code=requested_actor
            AND denied_grant.permission_code=upper(btrim(permission.value))
            AND denied_grant.scope_type='PROJECT'
            AND denied_grant.effect='DENY' AND denied_grant.use_at='Y'
       ) OR (upper(contract.actor_code)<>requested_actor AND NOT EXISTS(
         SELECT 1 FROM public.framework_permission_grant_v1 allowed_grant
          WHERE allowed_grant.actor_code=requested_actor
            AND allowed_grant.permission_code=upper(btrim(permission.value))
            AND allowed_grant.scope_type='PROJECT'
            AND allowed_grant.effect='ALLOW' AND allowed_grant.use_at='Y'
       )))
  );
END
$$;

CREATE OR REPLACE FUNCTION public.framework_authorize_step_permissions(
  requested_process text,requested_step text,requested_actor text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_authorize_step_permissions($1,$2,$3,'','')
$$;

REVOKE ALL ON FUNCTION public.framework_step_permission_requirements(text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_authorize_step_permissions(
  text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_authorize_step_permissions(text,text,text)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON FUNCTION public.framework_step_permission_requirements(text,text),
      public.framework_authorize_step_permissions(text,text,text),
      public.framework_authorize_step_permissions(text,text,text,text,text)
      FROM carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_step_permission_requirements(text,text),
      public.framework_authorize_step_permissions(text,text,text),
      public.framework_authorize_step_permissions(text,text,text,text,text)
      TO carbonet_app;
  END IF;
END
$$;

DO $$
DECLARE requirement_api oid:=to_regprocedure(
          'public.framework_step_permission_requirements(text,text)');
        authorize_compat_api oid:=to_regprocedure(
          'public.framework_authorize_step_permissions(text,text,text)');
        authorize_screen_api oid:=to_regprocedure(
          'public.framework_authorize_step_permissions(text,text,text,text,text)');
BEGIN
  IF requirement_api IS NULL OR authorize_compat_api IS NULL
     OR authorize_screen_api IS NULL OR EXISTS(
    SELECT 1 FROM pg_proc
     WHERE oid=ANY(ARRAY[requirement_api,authorize_compat_api,authorize_screen_api])
       AND (NOT prosecdef OR proowner<>(current_user::regrole)::oid
         OR NOT coalesce(proconfig,'{}'::text[]) @>
           ARRAY['search_path=pg_catalog, public']::text[])
  ) OR EXISTS(
    SELECT 1 FROM pg_proc function_row
    CROSS JOIN LATERAL aclexplode(
      coalesce(function_row.proacl,acldefault('f',function_row.proowner))) acl
     WHERE function_row.oid=ANY(
       ARRAY[requirement_api,authorize_compat_api,authorize_screen_api])
       AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'professional permission SECURITY DEFINER API postcondition failed'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') AND (
       NOT has_function_privilege('carbonet_app',requirement_api,'EXECUTE')
       OR NOT has_function_privilege('carbonet_app',authorize_compat_api,'EXECUTE')
       OR NOT has_function_privilege('carbonet_app',authorize_screen_api,'EXECUTE')
       OR has_table_privilege('carbonet_app',
            'public.framework_permission_requirement_v1','SELECT')
       OR has_table_privilege('carbonet_app',
            'public.framework_permission_grant_v1','SELECT')
     ) THEN
    RAISE EXCEPTION 'carbonet_app professional permission ACL postcondition failed'
      USING ERRCODE='42501';
  END IF;
END
$$;
