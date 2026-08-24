-- The runtime needs only the irreversible dependency hash. Keep the underlying
-- permission-grant rows inaccessible to carbonet_app and expose the hash through
-- one owner-bound function with a fixed lookup path.
ALTER FUNCTION public.framework_composite_dependency_fingerprint(varchar)
  SECURITY DEFINER;
ALTER FUNCTION public.framework_composite_dependency_fingerprint(varchar)
  SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.framework_composite_dependency_fingerprint(varchar)
  FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('carbonet_app') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION
      public.framework_composite_dependency_fingerprint(varchar)
      TO carbonet_app;
  END IF;
END
$$;

DO $postcondition$
DECLARE fingerprint_function oid:=to_regprocedure(
  'public.framework_composite_dependency_fingerprint(character varying)');
BEGIN
  IF fingerprint_function IS NULL OR EXISTS(
    SELECT 1 FROM pg_proc
     WHERE oid=fingerprint_function
       AND (NOT prosecdef
         OR proowner<>(current_user::regrole)::oid
         OR NOT coalesce(proconfig,'{}'::text[]) @>
           ARRAY['search_path=pg_catalog, public']::text[])
  ) OR EXISTS(
    SELECT 1
      FROM pg_proc function_row
      CROSS JOIN LATERAL aclexplode(
        coalesce(function_row.proacl,acldefault('f',function_row.proowner))) acl
     WHERE function_row.oid=fingerprint_function
       AND acl.grantee=0
       AND acl.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'composite dependency fingerprint security boundary failed'
      USING ERRCODE='42501';
  END IF;
  IF to_regrole('carbonet_app') IS NOT NULL AND (
       NOT has_function_privilege('carbonet_app',fingerprint_function,'EXECUTE')
       OR has_table_privilege('carbonet_app',
            'public.framework_permission_grant_v1','SELECT')
     ) THEN
    RAISE EXCEPTION 'carbonet_app composite fingerprint ACL failed'
      USING ERRCODE='42501';
  END IF;
END
$postcondition$;
