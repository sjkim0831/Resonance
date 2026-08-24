-- Expose one process-scoped, read-only generation boundary to the runtime role.
-- The underlying SOURCE compilers remain private and cannot be called directly.
CREATE OR REPLACE FUNCTION public.framework_process_generation_bundle(
  requested_process text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  runtime_snapshot jsonb;
  design_catalog jsonb;
  endpoint_readiness jsonb;
  endpoint_catalog jsonb;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_]{1,79}$' THEN
    RAISE EXCEPTION 'process generation bundle scope is invalid'
      USING ERRCODE='22023';
  END IF;

  WITH source_snapshot AS MATERIALIZED (
    SELECT public.framework_process_generation_snapshot(requested_process) runtime,
           public.framework_source_canonical_design_catalog(5000,requested_process::varchar) design,
           public.framework_source_canonical_endpoint_readiness(5000,requested_process::varchar) readiness
  ), complete_snapshot AS MATERIALIZED (
    SELECT runtime,design,readiness,
           CASE WHEN readiness->>'status'='COMPLETE'
             THEN public.framework_source_canonical_endpoint_catalog(5000,requested_process::varchar)
           END endpoint
      FROM source_snapshot
  )
  SELECT runtime,design,readiness,endpoint
    INTO runtime_snapshot,design_catalog,endpoint_readiness,endpoint_catalog
    FROM complete_snapshot;

  RETURN jsonb_build_object(
    'runtime',runtime_snapshot,
    'design',design_catalog,
    'endpointReadiness',endpoint_readiness,
    'endpoint',endpoint_catalog
  );
END
$$;

COMMENT ON FUNCTION public.framework_process_generation_bundle(text) IS
  'Restricted single-snapshot process generation bundle; private SOURCE compilers remain ungranted';

REVOKE ALL ON FUNCTION public.framework_process_generation_bundle(text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    GRANT EXECUTE ON FUNCTION public.framework_process_generation_bundle(text) TO carbonet_app;
  END IF;
END
$$;

