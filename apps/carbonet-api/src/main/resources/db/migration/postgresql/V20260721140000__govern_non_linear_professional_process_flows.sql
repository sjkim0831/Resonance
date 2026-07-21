CREATE TABLE IF NOT EXISTS framework_process_flow_edge (
  edge_id bigserial PRIMARY KEY,
  process_code varchar(100) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  from_step_code varchar(100) NOT NULL,
  to_step_code varchar(100) NOT NULL,
  edge_type varchar(30) NOT NULL DEFAULT 'NEXT',
  condition_code varchar(120) NOT NULL DEFAULT 'ALWAYS',
  condition_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_code varchar(100),
  source_kind varchar(30) NOT NULL DEFAULT 'GENERATED',
  review_status varchar(30) NOT NULL DEFAULT 'VERIFIED',
  use_at char(1) NOT NULL DEFAULT 'Y',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT framework_process_flow_edge_type_ck CHECK(edge_type IN
    ('NEXT','BRANCH','REJECT','RETRY','PARALLEL','JOIN','SUBPROCESS','EVENT','EXTERNAL')),
  CONSTRAINT framework_process_flow_edge_review_ck CHECK(review_status IN
    ('VERIFIED','REVIEW_REQUIRED','REJECTED')),
  CONSTRAINT framework_process_flow_edge_uk UNIQUE(process_code,from_step_code,to_step_code,edge_type,condition_code)
);

CREATE INDEX IF NOT EXISTS idx_framework_process_flow_edge_from
  ON framework_process_flow_edge(process_code,from_step_code) WHERE use_at='Y';
CREATE INDEX IF NOT EXISTS idx_framework_process_flow_edge_to
  ON framework_process_flow_edge(process_code,to_step_code) WHERE use_at='Y';

CREATE OR REPLACE FUNCTION framework_refresh_process_flow_edges(requested_process varchar DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE result jsonb;
BEGIN
  DELETE FROM framework_process_flow_edge
   WHERE source_kind='GENERATED' AND (requested_process IS NULL OR process_code=requested_process);

  INSERT INTO framework_process_flow_edge(process_code,from_step_code,to_step_code,edge_type,
    condition_code,condition_contract,actor_code,source_kind,review_status)
  SELECT current_step.process_code,current_step.step_code,next_step.step_code,
    CASE WHEN coalesce(topology.execution_mode,'SEQUENTIAL')='PARALLEL' THEN 'PARALLEL' ELSE 'NEXT' END,
    'SUCCESS',jsonb_build_object('fromState',current_step.from_state,'commandCode',current_step.command_code,
      'toState',current_step.to_state,'completionRule',current_step.completion_rule),
    next_step.actor_code,'GENERATED','VERIFIED'
  FROM framework_process_step current_step
  JOIN framework_process_step next_step ON next_step.process_code=current_step.process_code
    AND next_step.step_order=(SELECT min(candidate.step_order) FROM framework_process_step candidate
      WHERE candidate.process_code=current_step.process_code AND candidate.step_order>current_step.step_order)
  LEFT JOIN framework_process_execution_topology topology ON topology.process_code=current_step.process_code
  WHERE requested_process IS NULL OR current_step.process_code=requested_process
  ON CONFLICT(process_code,from_step_code,to_step_code,edge_type,condition_code) DO UPDATE SET
    condition_contract=excluded.condition_contract,actor_code=excluded.actor_code,
    source_kind='GENERATED',review_status='VERIFIED',use_at='Y',updated_at=current_timestamp;

  INSERT INTO framework_process_flow_edge(process_code,from_step_code,to_step_code,edge_type,
    condition_code,condition_contract,actor_code,source_kind,review_status)
  SELECT DISTINCT design.process_code,design.step_code,design.downstream_step_code,'BRANCH',
    'DESIGN_DOWNSTREAM',jsonb_build_object('entryCondition',design.entry_condition,
      'exitCondition',design.exit_condition,'pageCode',design.page_code),target.actor_code,
    'PAGE_DESIGN','REVIEW_REQUIRED'
  FROM framework_page_design design
  JOIN framework_process_step source ON source.process_code=design.process_code AND source.step_code=design.step_code
  JOIN framework_process_step target ON target.process_code=design.process_code AND target.step_code=design.downstream_step_code
  WHERE nullif(design.downstream_step_code,'') IS NOT NULL
    AND target.step_order<>source.step_order+1
    AND (requested_process IS NULL OR design.process_code=requested_process)
  ON CONFLICT(process_code,from_step_code,to_step_code,edge_type,condition_code) DO UPDATE SET
    condition_contract=excluded.condition_contract,actor_code=excluded.actor_code,
    source_kind='PAGE_DESIGN',review_status='REVIEW_REQUIRED',use_at='Y',updated_at=current_timestamp;

  SELECT jsonb_build_object('processCount',count(DISTINCT process_code),'edgeCount',count(*),
    'verifiedCount',count(*) FILTER(WHERE review_status='VERIFIED'),
    'reviewRequiredCount',count(*) FILTER(WHERE review_status='REVIEW_REQUIRED'),
    'edgeTypes',coalesce(jsonb_object_agg(edge_type,type_count),'{}'::jsonb)) INTO result
  FROM (SELECT process_code,edge_type,review_status,count(*) OVER(PARTITION BY edge_type) type_count
    FROM framework_process_flow_edge WHERE use_at='Y'
      AND (requested_process IS NULL OR process_code=requested_process)) edge_rows;
  RETURN result;
END $function$;

CREATE OR REPLACE VIEW framework_professional_process_flow AS
SELECT edge.edge_id,sequence.work_type_code,sequence.workflow_order,edge.process_code,
  process.process_name,edge.from_step_code,source.step_name AS from_step_name,source.step_order AS from_step_order,
  edge.to_step_code,target.step_name AS to_step_name,target.step_order AS to_step_order,
  edge.edge_type,edge.condition_code,edge.condition_contract,edge.actor_code,edge.source_kind,edge.review_status
FROM framework_process_flow_edge edge
JOIN framework_process_definition process USING(process_code)
JOIN framework_process_step source ON source.process_code=edge.process_code AND source.step_code=edge.from_step_code
JOIN framework_process_step target ON target.process_code=edge.process_code AND target.step_code=edge.to_step_code
LEFT JOIN framework_business_process_sequence sequence ON sequence.process_code=edge.process_code
WHERE edge.use_at='Y';

SELECT framework_refresh_process_flow_edges(NULL);

DO $verification$
DECLARE missing integer; invalid integer;
BEGIN
  SELECT count(*) INTO missing FROM framework_process_definition process
   WHERE EXISTS(SELECT 1 FROM framework_process_step step WHERE step.process_code=process.process_code)
     AND NOT EXISTS(SELECT 1 FROM framework_process_flow_edge edge WHERE edge.process_code=process.process_code)
     AND (SELECT count(*) FROM framework_process_step step WHERE step.process_code=process.process_code)>1;
  SELECT count(*) INTO invalid FROM framework_process_flow_edge edge
   WHERE NOT EXISTS(SELECT 1 FROM framework_process_step step WHERE step.process_code=edge.process_code AND step.step_code=edge.from_step_code)
      OR NOT EXISTS(SELECT 1 FROM framework_process_step step WHERE step.process_code=edge.process_code AND step.step_code=edge.to_step_code);
  IF missing>0 THEN RAISE EXCEPTION '% multi-step processes have no governed flow edge',missing; END IF;
  IF invalid>0 THEN RAISE EXCEPTION '% flow edges reference a missing step',invalid; END IF;
END $verification$;
