CREATE OR REPLACE FUNCTION framework_normalize_step_actor_contract(contract jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'contractType','STEP_ACTOR_AUTHORITY',
    'actorCode',contract->'actorCode',
    'ownerActorCode',contract->'ownerActorCode',
    'scope',to_jsonb(coalesce(
      nullif(contract->>'scope',''),
      CASE
        WHEN coalesce((contract->>'tenantIsolation')::boolean,(contract->>'tenantScoped')::boolean,false)
         AND coalesce((contract->>'projectIsolation')::boolean,false) THEN 'TENANT_PROJECT'
        WHEN coalesce((contract->>'tenantIsolation')::boolean,(contract->>'tenantScoped')::boolean,false) THEN 'TENANT'
        WHEN coalesce((contract->>'projectIsolation')::boolean,false) THEN 'PROJECT'
        ELSE 'GLOBAL'
      END)),
    'policy',CASE
      WHEN contract->>'contractType'='STEP_ACTOR_AUTHORITY' AND jsonb_typeof(contract->'policy')='object'
        THEN contract->'policy'
      ELSE jsonb_strip_nulls(jsonb_build_object(
        'assignmentRequired',contract->'assignmentRequired',
        'serverAuthorization',contract->'serverAuthorization',
        'tenantIsolation',coalesce(contract->'tenantIsolation',contract->'tenantScoped'),
        'projectIsolation',contract->'projectIsolation',
        'delegationChecked',contract->'delegationChecked',
        'segregationOfDuties',coalesce(contract->'segregationOfDuties',contract->'segregationRequired')))
    END,
    'permissions',CASE WHEN jsonb_typeof(contract->'permissions')='array' THEN contract->'permissions' ELSE '[]'::jsonb END,
    'delegation',CASE WHEN jsonb_typeof(contract->'delegation')='object' THEN contract->'delegation' ELSE '{}'::jsonb END,
    'extensions',CASE
      WHEN contract->>'contractType'='STEP_ACTOR_AUTHORITY' AND jsonb_typeof(contract->'extensions')='object'
        THEN contract->'extensions'
      ELSE contract-ARRAY[
        'schemaVersion','contractType','actorCode','ownerActorCode','scope','assignmentRequired',
        'serverAuthorization','tenantIsolation','tenantScoped','projectIsolation','delegationChecked',
        'segregationOfDuties','segregationRequired','policy','permissions','delegation','extensions'
      ]::text[]
    END
  );
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_actor_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actor_contract := framework_normalize_step_actor_contract(NEW.actor_contract);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_actor_contract ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_actor_contract
BEFORE INSERT OR UPDATE OF actor_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_actor_contract();

CREATE TEMP TABLE step_actor_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       md5(string_agg(
         coalesce(actor_contract->>'actorCode','')||'|'||coalesce(actor_contract->>'ownerActorCode','')||'|'||
         coalesce(nullif(actor_contract->>'scope',''),CASE
           WHEN coalesce((actor_contract->>'tenantIsolation')::boolean,(actor_contract->>'tenantScoped')::boolean,false)
            AND coalesce((actor_contract->>'projectIsolation')::boolean,false) THEN 'TENANT_PROJECT'
           WHEN coalesce((actor_contract->>'tenantIsolation')::boolean,(actor_contract->>'tenantScoped')::boolean,false) THEN 'TENANT'
           WHEN coalesce((actor_contract->>'projectIsolation')::boolean,false) THEN 'PROJECT'
           ELSE 'GLOBAL' END)||'|'||
         coalesce(actor_contract->>'assignmentRequired','')||'|'||coalesce(actor_contract->>'serverAuthorization','')||'|'||
         coalesce(actor_contract->>'tenantIsolation',actor_contract->>'tenantScoped','')||'|'||
         coalesce(actor_contract->>'projectIsolation','')||'|'||coalesce(actor_contract->>'delegationChecked','')||'|'||
         coalesce(actor_contract->>'segregationOfDuties',actor_contract->>'segregationRequired',''),
         '||' ORDER BY process_code,step_code)) AS semantic_hash
FROM framework_step_execution_spec;

UPDATE framework_step_execution_spec
SET actor_contract=framework_normalize_step_actor_contract(actor_contract),updated_at=current_timestamp
WHERE actor_contract IS DISTINCT FROM framework_normalize_step_actor_contract(actor_contract);

ALTER TABLE framework_step_execution_spec DROP CONSTRAINT IF EXISTS ck_framework_step_actor_contract_v1;
ALTER TABLE framework_step_execution_spec ADD CONSTRAINT ck_framework_step_actor_contract_v1 CHECK (
  jsonb_typeof(actor_contract)='object'
  AND actor_contract->>'contractType'='STEP_ACTOR_AUTHORITY'
  AND length(coalesce(actor_contract->>'actorCode',''))>0
  AND actor_contract->>'scope' IN ('GLOBAL','TENANT','PROJECT','TENANT_PROJECT')
  AND jsonb_typeof(actor_contract->'policy')='object'
  AND jsonb_typeof(actor_contract->'permissions')='array'
  AND jsonb_typeof(actor_contract->'delegation')='object'
  AND jsonb_typeof(actor_contract->'extensions')='object'
) NOT VALID;
ALTER TABLE framework_step_execution_spec VALIDATE CONSTRAINT ck_framework_step_actor_contract_v1;

DO $$
DECLARE expected record; actual record; invalid_count integer;
BEGIN
  SELECT * INTO expected FROM step_actor_normalization_audit;
  SELECT count(*)::bigint AS spec_count,
         md5(string_agg(
           coalesce(actor_contract->>'actorCode','')||'|'||coalesce(actor_contract->>'ownerActorCode','')||'|'||
           coalesce(actor_contract->>'scope','')||'|'||
           coalesce(actor_contract->'policy'->>'assignmentRequired','')||'|'||
           coalesce(actor_contract->'policy'->>'serverAuthorization','')||'|'||
           coalesce(actor_contract->'policy'->>'tenantIsolation','')||'|'||
           coalesce(actor_contract->'policy'->>'projectIsolation','')||'|'||
           coalesce(actor_contract->'policy'->>'delegationChecked','')||'|'||
           coalesce(actor_contract->'policy'->>'segregationOfDuties',''),
           '||' ORDER BY process_code,step_code)) AS semantic_hash
    INTO actual FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count FROM framework_step_execution_spec
  WHERE actor_contract->>'contractType'<>'STEP_ACTOR_AUTHORITY'
     OR length(coalesce(actor_contract->>'actorCode',''))=0
     OR actor_contract->>'scope' NOT IN ('GLOBAL','TENANT','PROJECT','TENANT_PROJECT')
     OR jsonb_typeof(actor_contract->'policy')<>'object'
     OR jsonb_typeof(actor_contract->'permissions')<>'array'
     OR jsonb_typeof(actor_contract->'delegation')<>'object'
     OR jsonb_typeof(actor_contract->'extensions')<>'object';
  IF invalid_count<>0 THEN RAISE EXCEPTION 'STEP_ACTOR_AUTHORITY_NORMALIZATION_FAILED invalid=%',invalid_count; END IF;
  IF actual.spec_count<>expected.spec_count OR actual.semantic_hash<>expected.semantic_hash THEN
    RAISE EXCEPTION 'STEP_ACTOR_AUTHORITY_SEMANTICS_CHANGED expected=% actual=%',row_to_json(expected),row_to_json(actual);
  END IF;
END $$;
