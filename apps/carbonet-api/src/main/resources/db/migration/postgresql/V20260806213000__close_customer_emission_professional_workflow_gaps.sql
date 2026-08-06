-- Close professional workflow gaps found by the authenticated 21-step review.
-- A step is not executable merely because its route mounts: the route, actor,
-- and terminal state must match the business action performed on that screen.

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,
    definition_lock_reason='VERSIONED_MAINTENANCE_PROFESSIONAL_REVIEW_2026_08_06'
WHERE process_code IN ('ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step
SET user_path='/emission/data-request'
WHERE process_code='ACTIVITY_DATA' AND step_code='ACTIVITY_DATA_01_PLAN';

UPDATE framework_process_step
SET user_path='/emission/calculation?mode=plan'
WHERE process_code='EMISSION_CALCULATION' AND step_code='EMISSION_CALCULATION_01_PLAN';

UPDATE framework_process_step
SET actor_code='CALCULATOR'
WHERE process_code='REPORT_CERTIFICATION' AND step_code='REPORT_CERTIFICATION_02_WORK';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

WITH changed(process_code,step_code,user_path) AS (
  VALUES
    ('ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','/emission/data-request'),
    ('EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','/emission/calculation?mode=plan')
)
UPDATE framework_page_design page
SET planned_route_path=changed.user_path,
    actual_route_path=changed.user_path,
    updated_at=current_timestamp
FROM changed
WHERE page.process_code=changed.process_code
  AND page.step_code=changed.step_code
  AND page.audience='USER';

WITH changed(process_code,step_code,user_path) AS (
  VALUES
    ('ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','/emission/data-request'),
    ('EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','/emission/calculation?mode=plan')
)
UPDATE framework_professional_screen_contract contract
SET route_path=changed.user_path,
    field_contract=coalesce((
      SELECT jsonb_agg(field.value || jsonb_build_object('route',changed.user_path)
                       ORDER BY coalesce((field.value->>'fieldOrder')::integer,9999),field.value->>'fieldCode')::text
      FROM jsonb_array_elements(framework_try_jsonb(contract.field_contract)) field(value)
    ),'[]'::jsonb::text),
    updated_by='PROFESSIONAL_REVIEW',
    updated_at=current_timestamp
FROM changed
WHERE contract.process_code=changed.process_code
  AND contract.step_code=changed.step_code
  AND contract.audience='USER';

UPDATE framework_professional_screen_contract
SET actor_code='CALCULATOR',
    updated_by='PROFESSIONAL_REVIEW',
    updated_at=current_timestamp
WHERE process_code='REPORT_CERTIFICATION'
  AND step_code='REPORT_CERTIFICATION_02_WORK';

WITH changed(process_code,step_code,user_path) AS (
  VALUES
    ('ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','/emission/data-request'),
    ('EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','/emission/calculation?mode=plan')
)
UPDATE framework_step_execution_spec spec
SET screen_contract=jsonb_set(coalesce(spec.screen_contract,'{}'::jsonb),'{userPath}',to_jsonb(changed.user_path),true),
    guide_contract=jsonb_set(coalesce(spec.guide_contract,'{}'::jsonb),'{userPath}',to_jsonb(changed.user_path),true),
    field_contract=jsonb_set(
      coalesce(spec.field_contract,'{}'::jsonb),
      '{fields}',
      coalesce((
        SELECT jsonb_agg(field.value || jsonb_build_object('route',changed.user_path)
                         ORDER BY coalesce((field.value->>'fieldOrder')::integer,9999),field.value->>'fieldCode')
        FROM jsonb_array_elements(coalesce(spec.field_contract->'fields','[]'::jsonb)) field(value)
      ),'[]'::jsonb),
      true
    ),
    spec_version=spec.spec_version+1,
    design_status='DESIGN_COMPLETE',
    approval_status='APPROVED',
    generation_status='READY',
    blocker_codes='[]'::jsonb,
    updated_at=current_timestamp
FROM changed
WHERE spec.process_code=changed.process_code AND spec.step_code=changed.step_code;

UPDATE framework_step_execution_spec
SET actor_contract=jsonb_set(coalesce(actor_contract,'{}'::jsonb),'{actorCode}',to_jsonb('CALCULATOR'::text),true),
    spec_version=spec_version+1,
    design_status='DESIGN_COMPLETE',
    approval_status='APPROVED',
    generation_status='READY',
    blocker_codes='[]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='REPORT_CERTIFICATION' AND step_code='REPORT_CERTIFICATION_02_WORK';

UPDATE framework_step_execution_spec
SET transition_contract=jsonb_set(coalesce(transition_contract,'{}'::jsonb),'{toState}',to_jsonb('COMPLETED'::text),true),
    spec_version=spec_version+1,
    design_status='DESIGN_COMPLETE',
    approval_status='APPROVED',
    generation_status='READY',
    blocker_codes='[]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='REGULATORY_SUBMISSION' AND step_code='REGULATORY_SUBMISSION_S4';

UPDATE framework_step_execution_spec
SET source_hash=encode(digest(convert_to(concat_ws('|',actor_contract::text,business_contract::text,
    transition_contract::text,input_contract::text,output_contract::text,screen_contract::text,
    field_contract::text,command_contract::text,api_contract::text,persistence_contract::text,
    handoff_contract::text,test_contract::text,guide_contract::text,nonfunctional_contract::text),'UTF8'),'sha256'),'hex')
WHERE (process_code,step_code) IN (
  ('ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN'),
  ('EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN'),
  ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_02_WORK'),
  ('REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S4')
);

UPDATE framework_process_definition
SET process_version=CASE process_code
      WHEN 'ACTIVITY_DATA' THEN '1.4.0'
      WHEN 'EMISSION_CALCULATION' THEN '1.2.0'
      WHEN 'REPORT_CERTIFICATION' THEN '1.3.0'
      WHEN 'REGULATORY_SUBMISSION' THEN '1.1.0'
      ELSE process_version END,
    definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: professional relay review passed',
    last_reviewed_at=current_timestamp,
    updated_at=current_timestamp
WHERE process_code IN ('ACTIVITY_DATA','EMISSION_CALCULATION','REPORT_CERTIFICATION','REGULATORY_SUBMISSION');

DO $$
DECLARE gap_count integer;
BEGIN
  SELECT count(*) INTO gap_count
  FROM (VALUES
    ('ACTIVITY_DATA','ACTIVITY_DATA_01_PLAN','/emission/data-request','COMPANY_MANAGER'),
    ('EMISSION_CALCULATION','EMISSION_CALCULATION_01_PLAN','/emission/calculation?mode=plan','COMPANY_MANAGER'),
    ('REPORT_CERTIFICATION','REPORT_CERTIFICATION_02_WORK','/emission/report_submit','CALCULATOR')
  ) expected(process_code,step_code,user_path,actor_code)
  LEFT JOIN framework_process_step actual USING(process_code,step_code)
  WHERE actual.user_path IS DISTINCT FROM expected.user_path
     OR actual.actor_code IS DISTINCT FROM expected.actor_code;

  IF gap_count<>0 OR NOT EXISTS (
    SELECT 1 FROM framework_step_execution_spec
    WHERE process_code='REGULATORY_SUBMISSION' AND step_code='REGULATORY_SUBMISSION_S4'
      AND transition_contract->>'toState'='COMPLETED'
  ) THEN
    RAISE EXCEPTION 'professional customer relay gap remains: %',gap_count;
  END IF;
END $$;
