-- Keep ordinary deploys below one minute by accepting the runtime-identity-only
-- operational gate. Full process/actor/authorization E2E remains an explicit
-- design/QA activity. Replace only the exact previously promoted contract.
DO $migration$
DECLARE
  function_body text;
  old_contract constant text := $old$
  IF usage_gate->>'allowedRole' IS DISTINCT FROM 'SYSTEM_ADMIN_FAMILY'
     OR usage_gate->>'anonymousDenied' IS DISTINCT FROM '2'
     OR usage_gate->>'ordinaryDenied' IS DISTINCT FROM '7'
     OR usage_gate->>'browserViewports' IS DISTINCT FROM '2'
     OR usage_gate->>'persistentFixtures' IS DISTINCT FROM '0'
     OR usage_gate->>'reviewCreateReloadIdempotencyCleanup' IS DISTINCT FROM 'true'
     OR coalesce(usage_gate->>'totalSteps','') !~ '^[1-9][0-9]*$'
     OR coalesce(usage_gate->>'pages','') !~ '^[1-9][0-9]*$'
     OR coalesce(usage_gate->>'durationSeconds','') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'operational usage-ledger live gate evidence contract mismatch';
  END IF;
$old$;
  new_contract constant text := $new$
  IF usage_gate->>'scope' = 'DEPLOY_RUNTIME_IDENTITY_ONLY' THEN
    IF usage_gate->>'runtimeIdentityExact' IS DISTINCT FROM 'true'
       OR usage_gate->>'fullProcessAuthorizationE2e' IS DISTINCT FROM 'DEFERRED_TO_DESIGN_QA'
       OR usage_gate->>'persistentFixtures' IS DISTINCT FROM '0' THEN
      RAISE EXCEPTION 'operational usage-ledger deploy identity evidence contract mismatch';
    END IF;
  ELSIF usage_gate->>'allowedRole' IS DISTINCT FROM 'SYSTEM_ADMIN_FAMILY'
     OR usage_gate->>'anonymousDenied' IS DISTINCT FROM '2'
     OR usage_gate->>'ordinaryDenied' IS DISTINCT FROM '7'
     OR usage_gate->>'browserViewports' IS DISTINCT FROM '2'
     OR usage_gate->>'persistentFixtures' IS DISTINCT FROM '0'
     OR usage_gate->>'reviewCreateReloadIdempotencyCleanup' IS DISTINCT FROM 'true'
     OR coalesce(usage_gate->>'totalSteps','') !~ '^[1-9][0-9]*$'
     OR coalesce(usage_gate->>'pages','') !~ '^[1-9][0-9]*$'
     OR coalesce(usage_gate->>'durationSeconds','') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'operational usage-ledger live gate evidence contract mismatch';
  END IF;
$new$;
BEGIN
  SELECT proc.prosrc
    INTO function_body
    FROM pg_proc proc
   WHERE proc.oid = 'framework_promote_postdeploy_evidence_candidate_v1(character varying,character varying,character varying)'::regprocedure;

  IF function_body IS NULL
     OR position(old_contract IN function_body) = 0
     OR position(new_contract IN function_body) > 0
     OR length(function_body) - length(replace(function_body, old_contract, '')) <> length(old_contract) THEN
    RAISE EXCEPTION 'postdeploy promoter predecessor contract mismatch';
  END IF;

  function_body := replace(function_body, old_contract, new_contract);
  IF position(old_contract IN function_body) > 0
     OR position(new_contract IN function_body) = 0 THEN
    RAISE EXCEPTION 'postdeploy promoter contract replacement failed';
  END IF;

  EXECUTE 'CREATE OR REPLACE FUNCTION framework_promote_postdeploy_evidence_candidate_v1('
       || 'p_candidate_id character varying,p_source_commit character varying,'
       || 'p_runtime_identity_hash character varying) RETURNS jsonb LANGUAGE plpgsql AS '
       || quote_literal(function_body);
END
$migration$;

COMMENT ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1(character varying,character varying,character varying)
  IS 'Atomically promotes exact candidate evidence; ordinary deploys accept exact runtime identity while full process authorization E2E runs in design QA.';
