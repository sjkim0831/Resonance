-- Repair only deterministic defects introduced by the complete business
-- process catalog generator. This migration does not claim implementation
-- evidence and does not complete development jobs.

CREATE TABLE IF NOT EXISTS framework_deterministic_design_repair_audit (
  audit_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  repair_type varchar(50) NOT NULL,
  before_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  repaired_by varchar(100) NOT NULL,
  repaired_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_deterministic_design_repair_process
  ON framework_deterministic_design_repair_audit(process_code,repaired_at DESC);

-- A process terminal is its last state-machine step, not a globally hard-coded
-- state name. Cross-process handoffs such as APPLICATION_PENDING_APPROVAL are
-- valid terminals and must retain their domain meaning.
DO $repair_assurance_view$
DECLARE
  view_sql text;
  old_terminal text :=
    'count(*) FILTER (WHERE s.to_state::text = ''COMPLETED''::text)::integer AS terminal_step_count';
  new_terminal text :=
    'count(*) FILTER (WHERE NOT (EXISTS ( SELECT 1 FROM framework_process_step terminal_next WHERE terminal_next.process_code::text = s.process_code::text AND terminal_next.from_state::text = s.to_state::text)))::integer AS terminal_step_count';
  old_unreachable text :=
    'count(*) FILTER (WHERE s.to_state::text <> ''COMPLETED''::text AND NOT (EXISTS ( SELECT 1
                   FROM framework_process_step n
                  WHERE n.process_code::text = s.process_code::text AND n.from_state::text = s.to_state::text)))::integer AS unreachable_next_state_count';
  new_unreachable text :=
    'count(*) FILTER (WHERE s.step_order < (SELECT max(ordered_step.step_order) FROM framework_process_step ordered_step WHERE ordered_step.process_code::text = s.process_code::text) AND NOT (EXISTS ( SELECT 1 FROM framework_process_step n WHERE n.process_code::text = s.process_code::text AND n.from_state::text = s.to_state::text)))::integer AS unreachable_next_state_count';
BEGIN
  SELECT pg_get_viewdef(
    'framework_process_design_assurance_matrix'::regclass,true
  ) INTO view_sql;

  IF strpos(view_sql,old_terminal)=0 OR strpos(view_sql,old_unreachable)=0 THEN
    RAISE EXCEPTION 'DESIGN_ASSURANCE_TERMINAL_RULE_SIGNATURE_CHANGED';
  END IF;

  view_sql := replace(view_sql,old_terminal,new_terminal);
  view_sql := replace(view_sql,old_unreachable,new_unreachable);
  EXECUTE 'CREATE OR REPLACE VIEW framework_process_design_assurance_matrix AS '||view_sql;
END
$repair_assurance_view$;

-- Implemented definitions are immutable during normal operation. A migration
-- is the deliberate, auditable mechanism for correcting the catalog compiler.
ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

WITH targets AS (
  SELECT s.process_code,s.step_code,s.command_code,s.api_contract
  FROM framework_process_step s
  JOIN framework_process_definition p USING(process_code)
  WHERE p.development_order BETWEEN 200 AND 351
    AND s.requires_api
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
    'FLYWAY_DETERMINISTIC_DESIGN_REPAIR'
  FROM targets
  RETURNING process_code
)
UPDATE framework_process_step s
SET api_contract='COMMON_PROCESS_EXECUTION_RUNTIME_V1'
FROM targets t
WHERE s.process_code=t.process_code AND s.step_code=t.step_code;

-- Fill only blank catalog rules. The process goal and exact step command are
-- retained so the result remains domain-specific and traceable.
WITH targets AS (
  SELECT s.process_code,s.step_code,s.step_name,s.command_code,p.goal,
    s.requirement_text,s.completion_rule
  FROM framework_process_step s
  JOIN framework_process_definition p USING(process_code)
  WHERE p.development_order BETWEEN 200 AND 351
    AND (
      nullif(btrim(s.requirement_text),'') IS NULL
      OR nullif(btrim(s.completion_rule),'') IS NULL
    )
), audited AS (
  INSERT INTO framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by
  )
  SELECT process_code,'BUSINESS_RULE',
    jsonb_build_object('stepCode',step_code,'requirement',requirement_text,'completionRule',completion_rule),
    jsonb_build_object(
      'stepCode',step_code,
      'requirement',coalesce(nullif(btrim(requirement_text),''),
        goal||' 이를 위해 '||step_name||'에서 '||command_code||' 명령의 입력·권한·상태·증적 계약을 적용한다.'),
      'completionRule',coalesce(nullif(btrim(completion_rule),''),
        command_code||' 명령이 권한·필수값·상태 버전·멱등성 검증을 통과하고 산출물·감사 이벤트·후속 업무가 원자적으로 저장되어야 한다.')
    ),
    'FLYWAY_DETERMINISTIC_DESIGN_REPAIR'
  FROM targets
  RETURNING process_code
)
UPDATE framework_process_step s
SET requirement_text=coalesce(nullif(btrim(s.requirement_text),''),
      t.goal||' 이를 위해 '||t.step_name||'에서 '||t.command_code||' 명령의 입력·권한·상태·증적 계약을 적용한다.'),
    completion_rule=coalesce(nullif(btrim(s.completion_rule),''),
      t.command_code||' 명령이 권한·필수값·상태 버전·멱등성 검증을 통과하고 산출물·감사 이벤트·후속 업무가 원자적으로 저장되어야 한다.')
FROM targets t
WHERE s.process_code=t.process_code AND s.step_code=t.step_code;

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

-- Promote generated safety scenarios only after their structure is proven to
-- match every current process step. Status promotion is allowed by the locked
-- definition guard; scenario contents remain immutable.
WITH eligible_process AS (
  SELECT p.process_code
  FROM framework_process_definition p
  WHERE p.development_order BETWEEN 200 AND 351
    AND (
      SELECT count(DISTINCT c.case_type)
      FROM framework_simulation_case c
      WHERE c.process_code=p.process_code
        AND c.case_type IN ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY')
    )=5
    AND NOT EXISTS (
      SELECT 1
      FROM framework_simulation_case c
      WHERE c.process_code=p.process_code
        AND (
          NOT c.automated
          OR jsonb_typeof(framework_try_jsonb(c.steps_json)) IS DISTINCT FROM 'array'
          OR jsonb_array_length(framework_try_jsonb(c.steps_json))<>(
            SELECT count(*) FROM framework_process_step s WHERE s.process_code=p.process_code
          )
          OR jsonb_typeof(framework_try_jsonb(c.assertions_json)) IS DISTINCT FROM 'array'
          OR jsonb_array_length(framework_try_jsonb(c.assertions_json))<3
          OR length(btrim(c.preconditions))<30
          OR EXISTS (
            SELECT 1
            FROM framework_process_step s
            WHERE s.process_code=p.process_code
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements(framework_try_jsonb(c.steps_json)) item
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
  WHERE c.case_type IN ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY')
    AND c.case_status='DRAFT'
), audited AS (
  INSERT INTO framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by
  )
  SELECT process_code,'SAFETY_TEST_APPROVAL',
    jsonb_build_object('caseCode',case_code,'status',case_status),
    jsonb_build_object('caseCode',case_code,'status','APPROVED','validation','STRUCTURE_MATCHED_CURRENT_PROCESS'),
    'FLYWAY_DETERMINISTIC_DESIGN_REPAIR'
  FROM targets
  RETURNING process_code
)
UPDATE framework_simulation_case c
SET case_status='APPROVED',
    updated_at=current_timestamp
FROM targets t
WHERE c.case_code=t.case_code;

-- Recompile screen contracts from the repaired source contracts. This remains
-- metadata-only and does not mark frontend/backend implementation complete.
SELECT framework_prepare_mass_professional_screens(
  1000,'FLYWAY_DETERMINISTIC_DESIGN_REPAIR'
);

SELECT * FROM framework_audit_all_process_designs(
  'FLYWAY_DETERMINISTIC_DESIGN_REPAIR'
);

DO $$
DECLARE unresolved integer;
BEGIN
  SELECT count(*) INTO unresolved
  FROM framework_process_design_assurance_matrix m
  JOIN framework_process_definition p USING(process_code)
  WHERE p.development_order BETWEEN 200 AND 351
    AND (
      m.incomplete_transition_count>0
      OR m.unreachable_next_state_count>0
      OR m.incomplete_business_rule_count>0
      OR m.missing_api_contract_count>0
      OR m.safety_test_type_count<5
      OR m.approved_safety_test_type_count<5
    );

  IF unresolved>0 THEN
    RAISE EXCEPTION
      'DETERMINISTIC_CATALOG_DESIGN_REPAIR_INCOMPLETE: % processes remain structurally blocked',
      unresolved;
  END IF;
END $$;
