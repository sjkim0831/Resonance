CREATE OR REPLACE FUNCTION framework_normalize_step_nonfunctional_contract(
  contract jsonb,actor jsonb,business jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  WITH source AS (
    SELECT coalesce(contract,'{}'::jsonb) c,
           coalesce(actor,'{}'::jsonb) a,
           coalesce(business,'{}'::jsonb) b
  ), parts AS (
    SELECT c,a,b,
      CASE WHEN jsonb_typeof(c->'security')='object' THEN c->'security' ELSE '{}'::jsonb END security,
      CASE WHEN jsonb_typeof(c->'performance')='object' THEN c->'performance' ELSE '{}'::jsonb END performance,
      CASE WHEN jsonb_typeof(c->'accessibility')='object' THEN c->'accessibility' ELSE '{}'::jsonb END accessibility,
      CASE WHEN jsonb_typeof(c->'responsive')='object' THEN c->'responsive' ELSE '{}'::jsonb END responsive,
      CASE WHEN jsonb_typeof(c->'recovery')='object' THEN c->'recovery' ELSE '{}'::jsonb END recovery,
      CASE WHEN jsonb_typeof(c->'audit')='object' THEN c->'audit' ELSE '{}'::jsonb END audit,
      CASE WHEN jsonb_typeof(c->'sla')='object' THEN c->'sla' ELSE '{}'::jsonb END sla
    FROM source
  )
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'contractType','STEP_NONFUNCTIONAL',
    'security',jsonb_build_object(
      'tenantIsolation',coalesce((security->>'tenantIsolation')::boolean,(a->'policy'->>'tenantIsolation')::boolean,false),
      'projectIsolation',coalesce((security->>'projectIsolation')::boolean,(a->'policy'->>'projectIsolation')::boolean,false),
      'serverAuthorization',coalesce((security->>'serverAuthorization')::boolean,(a->'policy'->>'serverAuthorization')::boolean,true),
      'segregationOfDuties',coalesce((security->>'segregationOfDuties')::boolean,(a->'policy'->>'segregationOfDuties')::boolean,false),
      'rateLimitRequired',coalesce((security->>'rateLimitRequired')::boolean,(c->>'rateLimitRequired')::boolean,false),
      'secretLoggingForbidden',coalesce((security->>'secretLoggingForbidden')::boolean,(c->>'secretLoggingForbidden')::boolean,true),
      'sensitiveValueMasking',coalesce((security->>'sensitiveValueMasking')::boolean,(c->>'sensitiveValueMasking')::boolean,true)),
    'performance',jsonb_build_object(
      'targetP95Ms',coalesce((performance->>'targetP95Ms')::integer,500),
      'paginationRequired',coalesce((performance->>'paginationRequired')::boolean,true),
      'searchIndexRequired',coalesce((performance->>'searchIndexRequired')::boolean,true)),
    'accessibility',jsonb_build_object(
      'standard',coalesce(nullif(accessibility->>'standard',''),nullif(c->>'accessibility',''),nullif(c->>'wcag',''),'WCAG 2.1 AA'),
      'keyboard',coalesce((accessibility->>'keyboard')::boolean,true),
      'focus',coalesce((accessibility->>'focus')::boolean,true),
      'errorSummary',coalesce((accessibility->>'errorSummary')::boolean,true)),
    'responsive',jsonb_build_object(
      'mobile',coalesce(nullif(responsive->>'mobile',''),'single-column'),
      'tablet',coalesce(nullif(responsive->>'tablet',''),'adaptive-two-column'),
      'desktop',coalesce(nullif(responsive->>'desktop',''),'task-optimized'),
      'noTextOverflow',coalesce((responsive->>'noTextOverflow')::boolean,true)),
    'recovery',jsonb_build_object(
      'retry',coalesce(nullif(recovery->>'retry',''),'idempotent-only'),
      'resumeFromLastVerifiedState',coalesce((recovery->>'resumeFromLastVerifiedState')::boolean,true),
      'idempotencyRequired',coalesce((recovery->>'idempotencyRequired')::boolean,true)),
    'audit',jsonb_build_object(
      'required',coalesce((audit->>'required')::boolean,(security->>'auditRequired')::boolean,(security->>'audit')::boolean,(c->>'auditRequired')::boolean,true),
      'actorRecorded',coalesce((audit->>'actorRecorded')::boolean,true),
      'beforeAfterRecorded',coalesce((audit->>'beforeAfterRecorded')::boolean,true),
      'correlationIdRequired',coalesce((audit->>'correlationIdRequired')::boolean,true)),
    'sla',jsonb_build_object(
      'configured',coalesce(nullif(b->>'slaHours','') IS NOT NULL,false),
      'targetHours',CASE WHEN nullif(b->>'slaHours','') IS NOT NULL THEN to_jsonb((b->>'slaHours')::numeric) ELSE 'null'::jsonb END,
      'timerStartsAt','STEP_ASSIGNED',
      'timerStopsAt','STEP_COMPLETED',
      'breachAlertRequired',true),
    'policy',CASE WHEN jsonb_typeof(c->'policy')='object' THEN c->'policy' ELSE '{}'::jsonb END,
    'extensions',CASE
      WHEN c->>'contractType'='STEP_NONFUNCTIONAL' AND jsonb_typeof(c->'extensions')='object' THEN c->'extensions'
      ELSE c-ARRAY['schemaVersion','contractType','security','performance','accessibility','responsive','recovery','audit','sla','policy','extensions','auditRequired','wcag','genericResponseTiming','rateLimitRequired','secretLoggingForbidden','sensitiveValueMasking']::text[]
    END)
  FROM parts;
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_nonfunctional_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nonfunctional_contract := framework_normalize_step_nonfunctional_contract(
    NEW.nonfunctional_contract,NEW.actor_contract,NEW.business_contract);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_nonfunctional_contract ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_nonfunctional_contract
BEFORE INSERT OR UPDATE OF nonfunctional_contract,actor_contract,business_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_nonfunctional_contract();

CREATE TEMP TABLE step_nonfunctional_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint spec_count,
       md5(string_agg(process_code||'|'||step_code||'|'||coalesce(nonfunctional_contract::text,''),'||' ORDER BY process_code,step_code)) source_hash
FROM framework_step_execution_spec;

UPDATE framework_step_execution_spec
SET nonfunctional_contract=framework_normalize_step_nonfunctional_contract(nonfunctional_contract,actor_contract,business_contract),
    updated_at=current_timestamp
WHERE nonfunctional_contract IS DISTINCT FROM framework_normalize_step_nonfunctional_contract(nonfunctional_contract,actor_contract,business_contract);

ALTER TABLE framework_step_execution_spec DROP CONSTRAINT IF EXISTS ck_framework_step_nonfunctional_contract_v1;
ALTER TABLE framework_step_execution_spec ADD CONSTRAINT ck_framework_step_nonfunctional_contract_v1 CHECK (
  nonfunctional_contract->>'contractType'='STEP_NONFUNCTIONAL'
  AND jsonb_typeof(nonfunctional_contract->'security')='object'
  AND jsonb_typeof(nonfunctional_contract->'performance')='object'
  AND (nonfunctional_contract->'performance'->>'targetP95Ms')::integer>0
  AND jsonb_typeof(nonfunctional_contract->'accessibility')='object'
  AND length(coalesce(nonfunctional_contract->'accessibility'->>'standard',''))>0
  AND jsonb_typeof(nonfunctional_contract->'responsive')='object'
  AND jsonb_typeof(nonfunctional_contract->'recovery')='object'
  AND jsonb_typeof(nonfunctional_contract->'audit')='object'
  AND jsonb_typeof(nonfunctional_contract->'sla')='object'
  AND jsonb_typeof(nonfunctional_contract->'policy')='object'
  AND jsonb_typeof(nonfunctional_contract->'extensions')='object'
) NOT VALID;
ALTER TABLE framework_step_execution_spec VALIDATE CONSTRAINT ck_framework_step_nonfunctional_contract_v1;

DO $$
DECLARE expected_count bigint; actual_count bigint; invalid_count bigint;
BEGIN
  SELECT spec_count INTO expected_count FROM step_nonfunctional_normalization_audit;
  SELECT count(*) INTO actual_count FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count FROM framework_step_execution_spec
  WHERE nonfunctional_contract->>'contractType'<>'STEP_NONFUNCTIONAL'
     OR jsonb_typeof(nonfunctional_contract->'security')<>'object'
     OR jsonb_typeof(nonfunctional_contract->'performance')<>'object'
     OR jsonb_typeof(nonfunctional_contract->'accessibility')<>'object'
     OR jsonb_typeof(nonfunctional_contract->'responsive')<>'object'
     OR jsonb_typeof(nonfunctional_contract->'recovery')<>'object'
     OR jsonb_typeof(nonfunctional_contract->'audit')<>'object'
     OR jsonb_typeof(nonfunctional_contract->'sla')<>'object';
  IF actual_count<>expected_count THEN RAISE EXCEPTION 'STEP_NONFUNCTIONAL_CARDINALITY_CHANGED expected=% actual=%',expected_count,actual_count; END IF;
  IF invalid_count<>0 THEN RAISE EXCEPTION 'STEP_NONFUNCTIONAL_NORMALIZATION_FAILED invalid=%',invalid_count; END IF;
END $$;
