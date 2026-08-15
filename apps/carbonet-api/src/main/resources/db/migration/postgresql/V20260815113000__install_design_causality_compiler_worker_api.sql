-- Milestone 2: least-privilege post-commit compiler invocation API.
--
-- Deployment ordering/lock wiring is intentionally not claimed here. The
-- dedicated role cannot log in, inherits nothing, owns no object, and receives
-- only EXECUTE on the narrow SECURITY DEFINER API. The API itself insists that
-- the caller used SET LOCAL ROLE inside a REPEATABLE READ transaction.

DO $$
DECLARE compiler_owner name;
BEGIN
  SELECT pg_get_userbyid(p.proowner) INTO compiler_owner
    FROM pg_proc p
   WHERE p.oid=to_regprocedure(
     'public.framework_compile_design_changes(character varying,bigint,character varying)'
   );
  IF compiler_owner IS NULL OR compiler_owner<>current_user THEN
    RAISE EXCEPTION 'design compiler worker API must be installed by compiler owner %, current=%',
      coalesce(compiler_owner::text,'MISSING'),current_user
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_design_compiler') THEN
    IF EXISTS(
      SELECT 1 FROM pg_roles
       WHERE rolname='carbonet_design_compiler'
         AND (rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin
              OR rolreplication OR rolbypassrls OR rolconnlimit<>-1
              OR rolvaliduntil IS NOT NULL OR rolconfig IS NOT NULL
             )
    ) OR EXISTS(
      SELECT 1 FROM pg_authid
       WHERE rolname='carbonet_design_compiler' AND rolpassword IS NOT NULL
    ) OR EXISTS(
      SELECT 1 FROM pg_auth_members
       WHERE member='carbonet_design_compiler'::regrole
    ) THEN
      RAISE EXCEPTION 'existing carbonet_design_compiler role is not least privilege'
        USING ERRCODE='42501';
    END IF;
  ELSE
    CREATE ROLE carbonet_design_compiler
      NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOLOGIN
      NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION framework_run_design_causality_compiler_worker()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  compiler_result jsonb;
  compiler_status text;
  observed_stage text;
  before_revision bigint;
  dirty_signal_count bigint;
  head_row public.framework_design_causality_head%ROWTYPE;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'carbonet_design_compiler' THEN
    RAISE EXCEPTION 'design compiler worker API requires SET LOCAL ROLE carbonet_design_compiler'
      USING ERRCODE='42501';
  END IF;
  IF current_setting('transaction_isolation') NOT IN ('repeatable read','serializable') THEN
    RAISE EXCEPTION 'design compiler worker API requires REPEATABLE READ or SERIALIZABLE'
      USING ERRCODE='25001';
  END IF;

  SELECT * INTO STRICT head_row
    FROM public.framework_design_causality_head
   WHERE scope_key='GLOBAL';
  before_revision:=head_row.revision;
  compiler_result:=public.framework_compile_design_changes(
    'project-auto-completion-compiler',head_row.revision,head_row.canonical_hash
  );
  compiler_status:=compiler_result->>'status';
  IF compiler_status NOT IN ('BUSY','NO_WORK','NO_SEMANTIC_CHANGE','COMPILED') THEN
    RAISE EXCEPTION 'invalid internal design compiler status'
      USING ERRCODE='55000';
  END IF;

  SELECT coalesce(s.current_stage,'BASELINE') INTO observed_stage
    FROM public.framework_design_causality_head h
    LEFT JOIN public.framework_design_causality_stage s
      ON s.event_id=h.current_event_id
   WHERE h.scope_key='GLOBAL';
  SELECT * INTO STRICT head_row
    FROM public.framework_design_causality_head
   WHERE scope_key='GLOBAL';
  SELECT count(*) INTO dirty_signal_count
    FROM public.framework_design_change_signal
   WHERE signal_status='DIRTY';
  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-compiler-worker-result/v1',
    'status',compiler_status,
    'currentStage',observed_stage,
    'beforeRevision',before_revision,
    'headRevision',head_row.revision,
    'currentEventId',head_row.current_event_id,
    'canonicalHash',head_row.canonical_hash,
    'dirtySignalCount',dirty_signal_count
  );
END
$$;

REVOKE ALL ON FUNCTION framework_run_design_causality_compiler_worker()
  FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON FUNCTION framework_run_design_causality_compiler_worker()
      FROM carbonet_app;
  END IF;
END
$$;
REVOKE ALL ON FUNCTION framework_mark_design_causality_dirty(integer),
  framework_capture_design_causality_dirty(),
  framework_design_causality_snapshot(),
  framework_design_causality_process_component(),
  framework_design_causality_actor_component(),
  framework_design_causality_account_component(),
  framework_design_causality_permission_requirement_component(),
  framework_design_causality_permission_grant_component(),
  framework_compile_design_changes(varchar,bigint,varchar),
  framework_cas_design_causality_stage(
    bigint,varchar,bigint,varchar,varchar,jsonb
  ),framework_design_causality_status()
  FROM carbonet_design_compiler;
REVOKE ALL ON TABLE framework_design_change_signal,
  framework_design_causality_head,framework_design_causality_event,
  framework_design_causality_event_signal,framework_design_causality_stage,
  framework_design_causality_stage_transition,
  framework_permission_requirement_v1,framework_permission_grant_v1,
  framework_permission_mapping_control_v1,
  framework_process_definition,framework_process_step,
  framework_actor_definition,framework_account_actor_assignment,
  framework_page_design,framework_page_field_definition,
  framework_professional_screen_contract,comtnmenufunctioninfo,
  comtnauthorfunctionrelate,comtnuserfeatureoverride,comtnemplyrscrtyestbs
  FROM carbonet_design_compiler;
REVOKE ALL ON SEQUENCE framework_design_change_signal_signal_id_seq,
  framework_design_causality_event_event_id_seq
  FROM carbonet_design_compiler;
REVOKE CREATE ON SCHEMA public FROM carbonet_design_compiler;
GRANT USAGE ON SCHEMA public TO carbonet_design_compiler;
GRANT EXECUTE ON FUNCTION framework_run_design_causality_compiler_worker()
  TO carbonet_design_compiler;

DO $$
BEGIN
  EXECUTE format(
    'GRANT carbonet_design_compiler TO %I WITH INHERIT FALSE, SET TRUE',
    current_user
  );
END
$$;

DO $$
DECLARE role_oid oid:='carbonet_design_compiler'::regrole;
        worker_oid oid:=to_regprocedure(
          'public.framework_run_design_causality_compiler_worker()'
        );
        compiler_oid oid:=to_regprocedure(
          'public.framework_compile_design_changes(character varying,bigint,character varying)'
        );
        owner_oid oid:=(SELECT proowner FROM pg_proc WHERE oid=compiler_oid);
BEGIN
  IF role_oid IS NULL OR worker_oid IS NULL OR compiler_oid IS NULL THEN
    RAISE EXCEPTION 'design compiler worker contract object missing'
      USING ERRCODE='55000';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_roles
     WHERE oid=role_oid
       AND (rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin
            OR rolreplication OR rolbypassrls OR rolconnlimit<>-1
            OR rolvaliduntil IS NOT NULL OR rolconfig IS NOT NULL)
  ) OR EXISTS(
    SELECT 1 FROM pg_authid
     WHERE oid=role_oid AND rolpassword IS NOT NULL
  ) OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_oid) THEN
    RAISE EXCEPTION 'design compiler worker role attribute postcondition failed'
      USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM pg_auth_members WHERE roleid=role_oid)<>1 OR
     (SELECT count(*) FROM pg_auth_members
       WHERE roleid=role_oid AND member=(current_user::regrole)::oid
         AND NOT admin_option AND NOT inherit_option AND set_option)<>1 THEN
    RAISE EXCEPTION 'migration owner SET-only compiler membership missing'
      USING ERRCODE='42501';
  END IF;
  IF NOT has_function_privilege(role_oid,worker_oid,'EXECUTE')
     OR EXISTS(
       SELECT 1 FROM unnest(ARRAY[
         to_regprocedure('public.framework_mark_design_causality_dirty(integer)'),
         to_regprocedure('public.framework_capture_design_causality_dirty()'),
         to_regprocedure('public.framework_design_causality_snapshot()'),
         to_regprocedure('public.framework_design_causality_process_component()'),
         to_regprocedure('public.framework_design_causality_actor_component()'),
         to_regprocedure('public.framework_design_causality_account_component()'),
         to_regprocedure('public.framework_design_causality_permission_requirement_component()'),
         to_regprocedure('public.framework_design_causality_permission_grant_component()'),
         to_regprocedure('public.framework_compile_design_changes(character varying,bigint,character varying)'),
         to_regprocedure('public.framework_cas_design_causality_stage(bigint,character varying,bigint,character varying,character varying,jsonb)'),
         to_regprocedure('public.framework_design_causality_status()')
       ]) protected_oid
       WHERE protected_oid IS NULL OR
         has_function_privilege(role_oid,protected_oid,'EXECUTE')
     )
     OR EXISTS(
       SELECT 1 FROM pg_proc p
       CROSS JOIN LATERAL aclexplode(
         coalesce(p.proacl,acldefault('f',p.proowner))
       ) acl
       WHERE p.oid=worker_oid AND acl.grantee=0
         AND acl.privilege_type='EXECUTE'
     )
     THEN
    RAISE EXCEPTION 'design compiler worker function ACL postcondition failed'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') AND
     has_function_privilege('carbonet_app',worker_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'carbonet_app can execute design compiler worker API'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_proc
     WHERE oid=worker_oid AND (
       NOT prosecdef OR proowner<>owner_oid OR
       NOT coalesce(proconfig,'{}'::text[]) @>
         ARRAY['search_path=pg_catalog, public']::text[]
     )
  ) THEN
    RAISE EXCEPTION 'design compiler worker SECURITY DEFINER postcondition failed'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(
    SELECT 1 FROM unnest(ARRAY[
      'public.framework_permission_requirement_v1'::regclass,
      'public.framework_permission_grant_v1'::regclass,
      'public.framework_permission_mapping_control_v1'::regclass,
      'public.framework_design_change_signal'::regclass,
      'public.framework_design_causality_head'::regclass,
      'public.framework_design_causality_event'::regclass,
      'public.framework_design_causality_event_signal'::regclass,
      'public.framework_design_causality_stage'::regclass,
      'public.framework_design_causality_stage_transition'::regclass,
      'public.framework_process_definition'::regclass,
      'public.framework_process_step'::regclass,
      'public.framework_actor_definition'::regclass,
      'public.framework_account_actor_assignment'::regclass,
      'public.framework_page_design'::regclass,
      'public.framework_page_field_definition'::regclass,
      'public.framework_professional_screen_contract'::regclass,
      'public.comtnmenufunctioninfo'::regclass,
      'public.comtnauthorfunctionrelate'::regclass,
      'public.comtnuserfeatureoverride'::regclass,
      'public.comtnemplyrscrtyestbs'::regclass
    ]) relation_oid
    WHERE has_table_privilege(
      role_oid,relation_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
  ) THEN
    RAISE EXCEPTION 'design compiler worker has direct source/causality table privilege'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(
    SELECT 1 FROM unnest(ARRAY[
      'public.framework_design_change_signal_signal_id_seq'::regclass,
      'public.framework_design_causality_event_event_id_seq'::regclass
    ]) sequence_oid
    WHERE has_sequence_privilege(role_oid,sequence_oid,'USAGE,SELECT,UPDATE')
  ) OR NOT has_schema_privilege(role_oid,'public','USAGE')
     OR has_schema_privilege(role_oid,'public','CREATE') THEN
    RAISE EXCEPTION 'design compiler worker sequence/schema privilege mismatch'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE relowner=role_oid)
     OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=role_oid)
     OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=role_oid)
     OR EXISTS(SELECT 1 FROM pg_type WHERE typowner=role_oid) THEN
    RAISE EXCEPTION 'design compiler worker role owns database objects'
      USING ERRCODE='42501';
  END IF;
END
$$;

COMMENT ON ROLE carbonet_design_compiler IS
  'NOLOGIN SET-only role for the bounded design causality compiler worker API';
COMMENT ON FUNCTION framework_run_design_causality_compiler_worker() IS
  'Sanitized post-commit compiler result; requires SET LOCAL ROLE and REPEATABLE READ';
