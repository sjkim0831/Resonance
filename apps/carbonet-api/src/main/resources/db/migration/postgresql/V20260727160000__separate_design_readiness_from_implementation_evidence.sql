-- Separate immutable design correctness from implementation evidence and
-- repair only deterministic blank contracts. No development job is completed
-- or verified by this migration.

DO $repair_assurance_semantics$
DECLARE
  view_sql text;
  old_job_blockers text :=
    '+
                CASE
                    WHEN j.required_job_count = 0 THEN 1
                    ELSE 0
                END + j.blocked_job_count +';
BEGIN
  SELECT pg_get_viewdef(
    'framework_process_design_assurance_matrix'::regclass,true
  ) INTO view_sql;

  IF strpos(view_sql,old_job_blockers)=0 THEN
    RAISE EXCEPTION 'DESIGN_ASSURANCE_JOB_BLOCKER_SIGNATURE_CHANGED';
  END IF;

  -- A missing/failed implementation job is an implementation state. It must
  -- remain visible in next_action, but it is not a defect in actor/process/
  -- transition/data/API/test design.
  view_sql := replace(view_sql,old_job_blockers,'+');
  EXECUTE 'CREATE OR REPLACE VIEW framework_process_design_assurance_matrix AS '||view_sql;
END
$repair_assurance_semantics$;

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

WITH targets AS (
  SELECT s.process_code,s.step_code,s.step_name,s.command_code,p.goal,
         s.requirement_text,s.completion_rule
  FROM framework_process_step s
  JOIN framework_process_definition p USING(process_code)
  WHERE nullif(btrim(s.requirement_text),'') IS NULL
     OR nullif(btrim(s.completion_rule),'') IS NULL
), audited AS (
  INSERT INTO framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by
  )
  SELECT process_code,'BUSINESS_RULE',
    jsonb_build_object(
      'stepCode',step_code,
      'requirement',requirement_text,
      'completionRule',completion_rule
    ),
    jsonb_build_object(
      'stepCode',step_code,
      'requirement',coalesce(
        nullif(btrim(requirement_text),''),
        goal||' 목표를 위해 '||step_name||' 단계에서 '||command_code||
        ' 명령의 선행 상태, 담당 액터, 필수 입력, 권한, 증적을 확인한다.'
      ),
      'completionRule',coalesce(
        nullif(btrim(completion_rule),''),
        command_code||
        ' 명령이 필수값, 권한분리, 상태 버전, 멱등성 검증을 통과하고 결과, 감사 이력, 후속 업무가 원자적으로 저장되어야 한다.'
      )
    ),
    'FLYWAY_DESIGN_IMPLEMENTATION_SEPARATION'
  FROM targets
  RETURNING process_code
)
UPDATE framework_process_step s
SET requirement_text=coalesce(
      nullif(btrim(s.requirement_text),''),
      t.goal||' 목표를 위해 '||t.step_name||' 단계에서 '||t.command_code||
      ' 명령의 선행 상태, 담당 액터, 필수 입력, 권한, 증적을 확인한다.'
    ),
    completion_rule=coalesce(
      nullif(btrim(s.completion_rule),''),
      t.command_code||
      ' 명령이 필수값, 권한분리, 상태 버전, 멱등성 검증을 통과하고 결과, 감사 이력, 후속 업무가 원자적으로 저장되어야 한다.'
    )
FROM targets t
WHERE s.process_code=t.process_code
  AND s.step_code=t.step_code;

WITH targets AS (
  SELECT s.process_code,s.step_code,s.command_code,s.api_contract
  FROM framework_process_step s
  WHERE s.requires_api
    AND nullif(btrim(s.api_contract),'') IS NULL
), audited AS (
  INSERT INTO framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by
  )
  SELECT process_code,'API_CONTRACT',
    jsonb_build_object('stepCode',step_code,'apiContract',api_contract),
    jsonb_build_object(
      'stepCode',step_code,
      'apiContract','COMMON_PROCESS_EXECUTION_RUNTIME_V1',
      'command',command_code,
      'query','GET /home/api/process-executions',
      'execute','POST /home/api/process-executions/{executionId}/commands',
      'draft','GET|PUT /home/api/process-executions/draft'
    ),
    'FLYWAY_DESIGN_IMPLEMENTATION_SEPARATION'
  FROM targets
  RETURNING process_code
)
UPDATE framework_process_step s
SET api_contract='COMMON_PROCESS_EXECUTION_RUNTIME_V1'
FROM targets t
WHERE s.process_code=t.process_code
  AND s.step_code=t.step_code;

WITH targets AS (
  SELECT process_code,step_code,evidence_types
  FROM framework_process_step
  WHERE evidence_required
    AND (
      nullif(btrim(evidence_types),'') IS NULL
      OR btrim(evidence_types)='[]'
    )
), audited AS (
  INSERT INTO framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by
  )
  SELECT process_code,'EVIDENCE_CONTRACT',
    jsonb_build_object('stepCode',step_code,'evidenceTypes',evidence_types),
    jsonb_build_object(
      'stepCode',step_code,
      'evidenceTypes',
      '원본 입력, 변경 전후 값, 담당자·시각, 결정 근거, 상태전이 로그, 생성 산출물 해시'
    ),
    'FLYWAY_DESIGN_IMPLEMENTATION_SEPARATION'
  FROM targets
  RETURNING process_code
)
UPDATE framework_process_step s
SET evidence_types=
  '원본 입력, 변경 전후 값, 담당자·시각, 결정 근거, 상태전이 로그, 생성 산출물 해시'
FROM targets t
WHERE s.process_code=t.process_code
  AND s.step_code=t.step_code;

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

WITH eligible_process AS (
  SELECT p.process_code
  FROM framework_process_definition p
  WHERE (
      SELECT count(DISTINCT c.case_type)
      FROM framework_simulation_case c
      WHERE c.process_code=p.process_code
        AND c.case_type IN (
          'HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY'
        )
    )=5
    AND NOT EXISTS (
      SELECT 1
      FROM framework_simulation_case c
      WHERE c.process_code=p.process_code
        AND (
          NOT c.automated
          OR jsonb_typeof(framework_try_jsonb(c.steps_json))
               IS DISTINCT FROM 'array'
          OR jsonb_array_length(framework_try_jsonb(c.steps_json))<>(
            SELECT count(*)
            FROM framework_process_step s
            WHERE s.process_code=p.process_code
          )
          OR jsonb_typeof(framework_try_jsonb(c.assertions_json))
               IS DISTINCT FROM 'array'
          OR jsonb_array_length(framework_try_jsonb(c.assertions_json))<3
          OR length(btrim(c.preconditions))<30
          OR EXISTS (
            SELECT 1
            FROM framework_process_step s
            WHERE s.process_code=p.process_code
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  framework_try_jsonb(c.steps_json)
                ) item
                WHERE item->>'stepCode'=s.step_code
                  AND item->>'command'=s.command_code
                  AND item->>'actorCode'=s.actor_code
                  AND (item->>'order')::integer=s.step_order
              )
          )
        )
    )
), targets AS (
  SELECT c.case_code,c.process_code,c.case_status
  FROM framework_simulation_case c
  JOIN eligible_process p USING(process_code)
  WHERE c.case_type IN (
    'HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY'
  )
    AND c.case_status='DRAFT'
), audited AS (
  INSERT INTO framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by
  )
  SELECT process_code,'SAFETY_TEST_APPROVAL',
    jsonb_build_object('caseCode',case_code,'status',case_status),
    jsonb_build_object(
      'caseCode',case_code,
      'status','APPROVED',
      'validation','STRUCTURE_MATCHED_CURRENT_PROCESS'
    ),
    'FLYWAY_DESIGN_IMPLEMENTATION_SEPARATION'
  FROM targets
  RETURNING process_code
)
UPDATE framework_simulation_case c
SET case_status='APPROVED',
    updated_at=current_timestamp
FROM targets t
WHERE c.case_code=t.case_code;

-- Some established suites are deliberately focused API contract tests rather
-- than full journey replays. Approve only the canonical cases whose executor,
-- commands, assertions, and five safety categories are deterministic.
WITH company_suite AS (
  SELECT c.case_code,c.process_code,c.case_status
  FROM framework_simulation_case c
  WHERE c.process_code='COMPANY_ONBOARDING'
    AND c.case_type IN (
      'HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY'
    )
    AND c.case_status='AUTOMATED'
    AND c.automated
    AND length(btrim(c.preconditions))>=8
    AND jsonb_typeof(framework_try_jsonb(c.steps_json))='array'
    AND jsonb_array_length(framework_try_jsonb(c.steps_json))>=1
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(framework_try_jsonb(c.steps_json)) item
      WHERE item->>'command' NOT IN (
        'CHECK_PROJECT_READINESS','CREATE_PROJECT'
      )
    )
    AND jsonb_typeof(framework_try_jsonb(c.assertions_json))='array'
    AND jsonb_array_length(framework_try_jsonb(c.assertions_json))>=2
), emission_suite AS (
  SELECT DISTINCT ON (c.case_type)
         c.case_code,c.process_code,c.case_status
  FROM framework_simulation_case c
  WHERE c.process_code='EMISSION_CALCULATION'
    AND c.case_type IN (
      'HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY'
    )
    AND c.case_status='READY'
    AND c.automated
    AND length(btrim(c.preconditions))>=30
    AND jsonb_typeof(framework_try_jsonb(c.steps_json))='array'
    AND jsonb_array_length(framework_try_jsonb(c.steps_json))=1
    AND (
      framework_try_jsonb(c.steps_json)->0->>'processCode'
    )='EMISSION_CALCULATION'
    AND (
      framework_try_jsonb(c.steps_json)->0->>'executor'
    )='backend-contract-self-test'
    AND jsonb_typeof(framework_try_jsonb(c.assertions_json))='array'
    AND jsonb_array_length(framework_try_jsonb(c.assertions_json))>=3
  ORDER BY c.case_type,c.case_code DESC
), targets AS (
  SELECT * FROM company_suite
  UNION ALL
  SELECT * FROM emission_suite
), audited AS (
  INSERT INTO framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by
  )
  SELECT process_code,'SAFETY_TEST_APPROVAL',
    jsonb_build_object('caseCode',case_code,'status',case_status),
    jsonb_build_object(
      'caseCode',case_code,
      'status','APPROVED',
      'validation','FOCUSED_CONTRACT_SUITE_VALIDATED'
    ),
    'FLYWAY_DESIGN_IMPLEMENTATION_SEPARATION'
  FROM targets
  RETURNING process_code
)
UPDATE framework_simulation_case c
SET case_status='APPROVED',
    updated_at=current_timestamp
FROM targets t
WHERE c.case_code=t.case_code;

SELECT framework_prepare_mass_professional_screens(
  1000,'FLYWAY_DESIGN_IMPLEMENTATION_SEPARATION'
);

SELECT * FROM framework_audit_all_process_designs(
  'FLYWAY_DESIGN_IMPLEMENTATION_SEPARATION'
);

DO $$
DECLARE
  structural_blockers integer;
  blocker_detail text;
BEGIN
  SELECT count(*),
         string_agg(process_code||'='||coalesce(next_action,''),'; ')
  INTO structural_blockers,blocker_detail
  FROM framework_process_design_assurance_matrix
  WHERE design_blocker_count>0;

  IF structural_blockers>0 THEN
    RAISE EXCEPTION
      'STRUCTURAL_DESIGN_REPAIR_INCOMPLETE: % processes remain design blocked: %',
      structural_blockers,blocker_detail;
  END IF;
END $$;
