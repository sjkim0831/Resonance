CREATE OR REPLACE FUNCTION framework_normalize_step_guide_contract(contract jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'contractType','STEP_GUIDE',
    'processCode',contract->'processCode',
    'stepCode',contract->'stepCode',
    'stepOrder',contract->'stepOrder',
    'workTypeCode',contract->'workTypeCode',
    'actorCode',contract->'actorCode',
    'title',contract->'title',
    'purpose',contract->'purpose',
    'entryCondition',contract->'entryCondition',
    'completionCondition',to_jsonb(coalesce(nullif(contract->>'completionCondition',''),nullif(contract->>'completion',''))),
    'userPath',contract->'userPath',
    'adminPath',contract->'adminPath',
    'relatedBusinessRoute',contract->'relatedBusinessRoute',
    'nextStepCode',to_jsonb(coalesce(nullif(contract->>'nextStepCode',''),nullif(nullif(contract->>'nextStep',''),'runtime-resolved'))),
    'nextAction',contract->'nextAction',
    'actions',CASE WHEN jsonb_typeof(contract->'actions')='array' THEN contract->'actions' ELSE '[]'::jsonb END,
    'help',CASE WHEN jsonb_typeof(contract->'help')='object' THEN contract->'help' ELSE '{}'::jsonb END,
    'policy',CASE WHEN jsonb_typeof(contract->'policy')='object' THEN contract->'policy' ELSE '{}'::jsonb END,
    'extensions',CASE
      WHEN contract->>'contractType'='STEP_GUIDE' AND jsonb_typeof(contract->'extensions')='object'
        THEN contract->'extensions'
      ELSE contract-ARRAY[
        'schemaVersion','contractType','processCode','stepCode','stepOrder','workTypeCode','actorCode',
        'title','purpose','entryCondition','completionCondition','completion','userPath','adminPath',
        'relatedBusinessRoute','nextStepCode','nextStep','nextAction','actions','help','policy','extensions'
      ]::text[]
    END
  );
$$;

CREATE OR REPLACE FUNCTION framework_effective_step_guide_contract(
  target_process_code text,target_step_code text,guide jsonb,business jsonb,actor jsonb,transition jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT framework_normalize_step_guide_contract(
    guide||jsonb_strip_nulls(jsonb_build_object(
      'processCode',target_process_code,
      'stepCode',target_step_code,
      'stepOrder',s.step_order,
      'actorCode',actor->>'actorCode',
      'title',business->>'stepName',
      'purpose',business->>'requirement',
      'entryCondition',transition->>'fromState',
      'completionCondition',business->>'completionRule',
      'userPath',coalesce(nullif(guide->>'userPath',''),nullif(s.user_path,'')),
      'adminPath',coalesce(nullif(guide->>'adminPath',''),nullif(s.admin_path,'')),
      'nextStepCode',coalesce(
        nullif(guide->>'nextStepCode',''),
        nullif(nullif(guide->>'nextStep',''),'runtime-resolved'),
        (SELECT n.step_code FROM framework_process_step n
         WHERE n.process_code=s.process_code AND n.step_order>s.step_order
         ORDER BY n.step_order LIMIT 1)),
      'nextAction',coalesce(nullif(guide->>'nextAction',''),transition->>'toState'))))
  FROM framework_process_step s
  WHERE s.process_code=target_process_code AND s.step_code=target_step_code;
$$;

CREATE OR REPLACE FUNCTION framework_enforce_step_guide_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.guide_contract := framework_effective_step_guide_contract(
    NEW.process_code,NEW.step_code,NEW.guide_contract,NEW.business_contract,NEW.actor_contract,NEW.transition_contract);
  IF NEW.guide_contract IS NULL THEN
    RAISE EXCEPTION 'STEP_GUIDE_SOURCE_MISSING process=% step=%',NEW.process_code,NEW.step_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_normalize_step_guide_contract ON framework_step_execution_spec;
CREATE TRIGGER trg_framework_normalize_step_guide_contract
BEFORE INSERT OR UPDATE OF guide_contract,business_contract,actor_contract,transition_contract
ON framework_step_execution_spec
FOR EACH ROW EXECUTE FUNCTION framework_enforce_step_guide_contract();

CREATE TEMP TABLE step_guide_normalization_audit ON COMMIT DROP AS
SELECT count(*)::bigint AS spec_count,
       count(*) FILTER(WHERE length(coalesce(e.guide_contract->>'userPath',''))=0
                         AND length(coalesce(e.guide_contract->>'adminPath',''))=0
                         AND (length(coalesce(s.user_path,''))>0 OR length(coalesce(s.admin_path,''))>0))::bigint AS enriched_route_count,
       md5(string_agg(
         (framework_effective_step_guide_contract(e.process_code,e.step_code,e.guide_contract,e.business_contract,e.actor_contract,e.transition_contract)->>'title')||'|'||
         (framework_effective_step_guide_contract(e.process_code,e.step_code,e.guide_contract,e.business_contract,e.actor_contract,e.transition_contract)->>'purpose')||'|'||
         (framework_effective_step_guide_contract(e.process_code,e.step_code,e.guide_contract,e.business_contract,e.actor_contract,e.transition_contract)->>'completionCondition')||'|'||
         coalesce(framework_effective_step_guide_contract(e.process_code,e.step_code,e.guide_contract,e.business_contract,e.actor_contract,e.transition_contract)->>'userPath','')||'|'||
         coalesce(framework_effective_step_guide_contract(e.process_code,e.step_code,e.guide_contract,e.business_contract,e.actor_contract,e.transition_contract)->>'adminPath',''),
         '||' ORDER BY e.process_code,e.step_code)) AS semantic_hash
FROM framework_step_execution_spec e JOIN framework_process_step s USING(process_code,step_code);

UPDATE framework_step_execution_spec e
SET guide_contract=framework_effective_step_guide_contract(
      e.process_code,e.step_code,e.guide_contract,e.business_contract,e.actor_contract,e.transition_contract),
    updated_at=current_timestamp
WHERE e.guide_contract IS DISTINCT FROM framework_effective_step_guide_contract(
      e.process_code,e.step_code,e.guide_contract,e.business_contract,e.actor_contract,e.transition_contract);

ALTER TABLE framework_step_execution_spec DROP CONSTRAINT IF EXISTS ck_framework_step_guide_contract_v1;
ALTER TABLE framework_step_execution_spec ADD CONSTRAINT ck_framework_step_guide_contract_v1 CHECK (
  jsonb_typeof(guide_contract)='object'
  AND guide_contract->>'contractType'='STEP_GUIDE'
  AND length(coalesce(guide_contract->>'processCode',''))>0
  AND length(coalesce(guide_contract->>'stepCode',''))>0
  AND length(coalesce(guide_contract->>'actorCode',''))>0
  AND length(coalesce(guide_contract->>'title',''))>0
  AND length(coalesce(guide_contract->>'purpose',''))>0
  AND length(coalesce(guide_contract->>'entryCondition',''))>0
  AND length(coalesce(guide_contract->>'completionCondition',''))>0
  AND jsonb_typeof(guide_contract->'actions')='array'
  AND jsonb_typeof(guide_contract->'help')='object'
  AND jsonb_typeof(guide_contract->'policy')='object'
  AND jsonb_typeof(guide_contract->'extensions')='object'
) NOT VALID;
ALTER TABLE framework_step_execution_spec VALIDATE CONSTRAINT ck_framework_step_guide_contract_v1;

DO $$
DECLARE expected record; actual record; invalid_count integer;
BEGIN
  SELECT * INTO expected FROM step_guide_normalization_audit;
  SELECT count(*)::bigint AS spec_count,
         md5(string_agg(
           (guide_contract->>'title')||'|'||(guide_contract->>'purpose')||'|'||
           (guide_contract->>'completionCondition')||'|'||coalesce(guide_contract->>'userPath','')||'|'||
           coalesce(guide_contract->>'adminPath',''),'||' ORDER BY process_code,step_code)) AS semantic_hash
    INTO actual FROM framework_step_execution_spec;
  SELECT count(*) INTO invalid_count FROM framework_step_execution_spec
  WHERE guide_contract->>'contractType'<>'STEP_GUIDE'
     OR length(coalesce(guide_contract->>'processCode',''))=0
     OR length(coalesce(guide_contract->>'stepCode',''))=0
     OR length(coalesce(guide_contract->>'actorCode',''))=0
     OR length(coalesce(guide_contract->>'title',''))=0
     OR length(coalesce(guide_contract->>'purpose',''))=0
     OR length(coalesce(guide_contract->>'entryCondition',''))=0
     OR length(coalesce(guide_contract->>'completionCondition',''))=0
     OR jsonb_typeof(guide_contract->'actions')<>'array'
     OR jsonb_typeof(guide_contract->'help')<>'object'
     OR jsonb_typeof(guide_contract->'policy')<>'object'
     OR jsonb_typeof(guide_contract->'extensions')<>'object';
  IF invalid_count<>0 THEN RAISE EXCEPTION 'STEP_GUIDE_NORMALIZATION_FAILED invalid=%',invalid_count; END IF;
  IF actual.spec_count<>expected.spec_count OR actual.semantic_hash<>expected.semantic_hash THEN
    RAISE EXCEPTION 'STEP_GUIDE_SEMANTICS_CHANGED expected=% actual=%',row_to_json(expected),row_to_json(actual);
  END IF;
END $$;
