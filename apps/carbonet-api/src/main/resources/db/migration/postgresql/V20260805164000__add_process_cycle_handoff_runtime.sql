ALTER TABLE framework_process_execution
  ADD COLUMN IF NOT EXISTS cycle_type varchar(20) NOT NULL DEFAULT 'ONCE',
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS site_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS boundary_version varchar(80) NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS methodology_version varchar(80) NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS data_cutoff_at timestamp,
  ADD COLUMN IF NOT EXISTS execution_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_execution_id uuid,
  ADD COLUMN IF NOT EXISTS handoff_status varchar(30) NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN IF NOT EXISTS snapshot_ref varchar(160);

ALTER TABLE framework_process_execution
  DROP CONSTRAINT IF EXISTS ck_framework_process_execution_cycle;
ALTER TABLE framework_process_execution
  ADD CONSTRAINT ck_framework_process_execution_cycle CHECK
    (cycle_type IN ('ONCE','MONTHLY','QUARTERLY','HALF_YEARLY','ANNUAL','AD_HOC'));
ALTER TABLE framework_process_execution
  DROP CONSTRAINT IF EXISTS ck_framework_process_execution_period;
ALTER TABLE framework_process_execution
  ADD CONSTRAINT ck_framework_process_execution_period CHECK
    ((cycle_type='ONCE' AND period_start IS NULL AND period_end IS NULL)
      OR (cycle_type<>'ONCE' AND period_start IS NOT NULL AND period_end IS NOT NULL AND period_start<=period_end));
ALTER TABLE framework_process_execution
  DROP CONSTRAINT IF EXISTS ck_framework_process_execution_handoff;
ALTER TABLE framework_process_execution
  ADD CONSTRAINT ck_framework_process_execution_handoff CHECK
    (handoff_status IN ('NOT_READY','READY','HANDED_OFF','CORRECTION_REQUIRED','NOT_APPLICABLE','BLOCKED','CANCELLED'));
ALTER TABLE framework_process_execution
  DROP CONSTRAINT IF EXISTS ck_framework_process_execution_version;
ALTER TABLE framework_process_execution
  ADD CONSTRAINT ck_framework_process_execution_version CHECK (execution_version>0);

DROP INDEX IF EXISTS ux_process_execution_running;
CREATE UNIQUE INDEX IF NOT EXISTS ux_process_execution_running_scope
  ON framework_process_execution(
    tenant_id,project_id,process_code,cycle_type,
    coalesce(period_start,date '0001-01-01'),coalesce(period_end,date '9999-12-31'),
    boundary_version,methodology_version,execution_version
  ) WHERE execution_status='RUNNING';

CREATE TABLE IF NOT EXISTS framework_step_completion_policy (
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  completion_type varchar(20) NOT NULL,
  completion_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_result_states jsonb NOT NULL DEFAULT '["DONE","HANDOFF_READY","CORRECTION_REQUIRED","NOT_APPLICABLE","BLOCKED","CANCELLED"]'::jsonb,
  cycle_policy jsonb NOT NULL DEFAULT '{"allowed":["ONCE","MONTHLY","QUARTERLY","HALF_YEARLY","ANNUAL","AD_HOC"]}'::jsonb,
  join_strategy varchar(20) NOT NULL DEFAULT 'ALL',
  quorum_percent numeric(5,2),
  next_actor_code varchar(60),
  snapshot_required boolean NOT NULL DEFAULT true,
  snapshot_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  use_at char(1) NOT NULL DEFAULT 'Y',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(process_code,step_code),
  CONSTRAINT ck_step_completion_type CHECK (completion_type IN ('EXPLICIT','AUTOMATIC','CONTINUOUS','CONDITIONAL')),
  CONSTRAINT ck_step_completion_join CHECK (join_strategy IN ('ALL','ANY','QUORUM','MANUAL','DATE')),
  CONSTRAINT ck_step_completion_quorum CHECK ((join_strategy<>'QUORUM') OR (quorum_percent>0 AND quorum_percent<=100))
);

INSERT INTO framework_step_completion_policy(
  process_code,step_code,completion_type,completion_rule,join_strategy,next_actor_code,snapshot_required,snapshot_contract
)
SELECT s.process_code,s.step_code,
       CASE
         WHEN s.step_code LIKE '%COLLECT%' OR s.step_code LIKE '%WORK%' THEN 'CONTINUOUS'
         WHEN s.step_code LIKE '%CALCULATE%' OR s.step_code LIKE '%VERIFY%' THEN 'AUTOMATIC'
         WHEN s.step_code LIKE '%VALIDATE%' OR s.step_code LIKE '%CORRECT%' OR s.step_code LIKE '%APPROVE%' THEN 'CONDITIONAL'
         ELSE 'EXPLICIT'
       END,
       jsonb_build_object(
         'requiredState',s.to_state,
         'requiredCommand',s.command_code,
         'requiresAcceptedRequiredData',s.step_code LIKE '%COLLECT%',
         'requiresZeroBlockingErrors',s.step_code LIKE '%VALIDATE%' OR s.step_code LIKE '%VERIFY%',
         'supportsNotApplicable',s.step_code LIKE '%CORRECT%'
       ),
       CASE WHEN s.step_code LIKE '%COLLECT%' THEN 'ALL' WHEN s.step_code LIKE '%APPROVE%' THEN 'MANUAL' ELSE 'ALL' END,
       n.actor_code,
       s.step_code NOT LIKE '%PORTFOLIO%',
       jsonb_build_object(
         'locksInput',s.step_code LIKE '%CALCULATE%' OR s.step_code LIKE '%APPROVE%' OR s.step_code LIKE '%REPORT%',
         'preservesSourceVersion',true,
         'recordsActor',true,
         'recordsTimestamp',true,
         'recordsEvidenceHash',s.step_code LIKE '%COLLECT%' OR s.step_code LIKE '%VERIFY%' OR s.step_code LIKE '%APPROVE%' OR s.step_code LIKE '%REPORT%'
       )
  FROM framework_process_step s
  LEFT JOIN LATERAL (
    SELECT ns.actor_code
      FROM framework_process_step ns
     WHERE ns.process_code=s.process_code AND ns.step_order>s.step_order
     ORDER BY ns.step_order LIMIT 1
  ) n ON true
 WHERE s.process_code IN ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','EMISSION_CALCULATION')
ON CONFLICT(process_code,step_code) DO UPDATE SET
  completion_type=excluded.completion_type,
  completion_rule=excluded.completion_rule,
  join_strategy=excluded.join_strategy,
  next_actor_code=excluded.next_actor_code,
  snapshot_required=excluded.snapshot_required,
  snapshot_contract=excluded.snapshot_contract,
  use_at='Y',updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_process_cycle_handoff_audit AS
SELECT e.execution_id,e.tenant_id,e.project_id,e.process_code,e.current_step_code,
       e.cycle_type,e.period_start,e.period_end,e.execution_version,e.execution_status,e.handoff_status,
       p.completion_type,p.join_strategy,p.next_actor_code,p.snapshot_required,
       array_remove(ARRAY[
         CASE WHEN p.step_code IS NULL THEN 'COMPLETION_POLICY_MISSING' END,
         CASE WHEN e.cycle_type<>'ONCE' AND (e.period_start IS NULL OR e.period_end IS NULL) THEN 'PERIOD_MISSING' END,
         CASE WHEN e.period_start>e.period_end THEN 'PERIOD_INVALID' END,
         CASE WHEN e.handoff_status='HANDED_OFF' AND p.snapshot_required AND nullif(e.snapshot_ref,'') IS NULL THEN 'SNAPSHOT_MISSING' END
       ],NULL) AS blocker_codes
  FROM framework_process_execution e
  LEFT JOIN framework_step_completion_policy p
    ON p.process_code=e.process_code AND p.step_code=e.current_step_code AND p.use_at='Y';

COMMENT ON TABLE framework_step_completion_policy IS '단계별 종료·인계·분기·합류·스냅샷 실행 계약';
COMMENT ON VIEW framework_process_cycle_handoff_audit IS '기간별 실행 인스턴스와 단계 인계 계약의 실시간 무결성 점검';
