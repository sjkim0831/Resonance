-- Process execution is a DAG. workflow_order remains a presentation order only.
CREATE TABLE IF NOT EXISTS framework_process_execution_topology (
    process_code varchar(80) PRIMARY KEY REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
    work_type_code varchar(40) NOT NULL REFERENCES framework_business_work_type(work_type_code),
    stage_code varchar(100) NOT NULL,
    execution_wave integer NOT NULL,
    lane_code varchar(80) NOT NULL,
    lane_order integer NOT NULL DEFAULT 1,
    execution_mode varchar(20) NOT NULL DEFAULT 'SEQUENTIAL',
    join_strategy varchar(10) NOT NULL DEFAULT 'ALL',
    predecessor_process_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
    successor_process_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
    shared_milestone_code varchar(120) NOT NULL,
    required_for_join boolean NOT NULL DEFAULT true,
    applicability_rule text NOT NULL DEFAULT 'ALWAYS',
    topology_status varchar(20) NOT NULL DEFAULT 'DESIGN_COMPLETE',
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT ck_process_topology_wave CHECK(execution_wave > 0),
    CONSTRAINT ck_process_topology_mode CHECK(execution_mode IN ('SEQUENTIAL','PARALLEL','CONDITIONAL')),
    CONSTRAINT ck_process_topology_join CHECK(join_strategy IN ('ALL','ANY','NONE')),
    CONSTRAINT ck_process_topology_status CHECK(topology_status IN ('DRAFT','DESIGN_COMPLETE','RETIRED'))
);

CREATE INDEX IF NOT EXISTS idx_process_topology_workflow
  ON framework_process_execution_topology(work_type_code,execution_wave,lane_order,process_code);

WITH ordered AS (
  SELECT s.*,
         sum(CASE WHEN s.process_role IN ('BRANCH','SUPPORT') THEN 0 ELSE 1 END)
           OVER(PARTITION BY s.work_type_code ORDER BY s.workflow_order,s.process_code) AS execution_wave
  FROM framework_business_process_sequence s
  WHERE s.sequence_status='ACTIVE'
), normalized AS (
  SELECT o.*,
         row_number() OVER(PARTITION BY o.work_type_code,o.execution_wave ORDER BY o.workflow_order,o.process_code) AS lane_order,
         count(*) OVER(PARTITION BY o.work_type_code,o.execution_wave) AS wave_size
  FROM ordered o
), topology AS (
  SELECT n.*,
         coalesce((
           SELECT jsonb_agg(p.process_code ORDER BY p.workflow_order,p.process_code)
           FROM normalized p
           WHERE p.work_type_code=n.work_type_code
             AND p.execution_wave=n.execution_wave-1
             AND p.process_role NOT IN ('BRANCH','SUPPORT')
         ),'[]'::jsonb) AS predecessors
  FROM normalized n
)
INSERT INTO framework_process_execution_topology(
  process_code,work_type_code,stage_code,execution_wave,lane_code,lane_order,
  execution_mode,join_strategy,predecessor_process_codes,shared_milestone_code,
  required_for_join,applicability_rule,topology_status
)
SELECT process_code,work_type_code,workflow_phase,execution_wave,
       CASE WHEN process_role='BRANCH' THEN 'EXCEPTION'
            WHEN process_role='SUPPORT' THEN 'SUPPORT'
            ELSE 'PRIMARY' END,
       lane_order,
       CASE WHEN process_role IN ('BRANCH','SUPPORT') THEN 'CONDITIONAL'
            WHEN wave_size>1 THEN 'PARALLEL' ELSE 'SEQUENTIAL' END,
       CASE WHEN execution_wave=1 THEN 'NONE' ELSE 'ALL' END,
       predecessors,
       work_type_code||'_'||workflow_phase||'_W'||execution_wave,
       process_role NOT IN ('BRANCH','SUPPORT'),
       CASE WHEN process_role='BRANCH' THEN 'INCIDENT_OR_EXCEPTION'
            WHEN process_role='SUPPORT' THEN 'ON_DEMAND'
            ELSE 'ALWAYS' END,
       'DESIGN_COMPLETE'
FROM topology
ON CONFLICT(process_code) DO UPDATE SET
  work_type_code=excluded.work_type_code,stage_code=excluded.stage_code,
  execution_wave=excluded.execution_wave,lane_code=excluded.lane_code,
  lane_order=excluded.lane_order,execution_mode=excluded.execution_mode,
  join_strategy=excluded.join_strategy,
  predecessor_process_codes=excluded.predecessor_process_codes,
  shared_milestone_code=excluded.shared_milestone_code,
  required_for_join=excluded.required_for_join,
  applicability_rule=excluded.applicability_rule,
  topology_status='DESIGN_COMPLETE',updated_at=current_timestamp;

UPDATE framework_process_execution_topology current_node
SET successor_process_codes=coalesce((
  SELECT jsonb_agg(next_node.process_code ORDER BY next_node.lane_order,next_node.process_code)
  FROM framework_process_execution_topology next_node
  WHERE next_node.work_type_code=current_node.work_type_code
    AND current_node.process_code IN (
      SELECT jsonb_array_elements_text(next_node.predecessor_process_codes)
    )
),'[]'::jsonb),updated_at=current_timestamp;

-- Actual project tasks use their predecessor graph, not their display order.
CREATE OR REPLACE VIEW framework_project_task_execution_wave AS
WITH RECURSIVE edges AS (
  SELECT child.task_id,child.project_id,child.task_code,parent.task_id AS predecessor_task_id
  FROM emission_project_task child
  CROSS JOIN LATERAL unnest(string_to_array(nullif(child.predecessor_codes,''),',')) predecessor_code
  LEFT JOIN emission_project_task parent
    ON parent.project_id=child.project_id AND parent.task_code=btrim(predecessor_code)
), roots AS (
  SELECT t.task_id,t.project_id,1 AS execution_wave,ARRAY[t.task_id]::bigint[] AS path
  FROM emission_project_task t
  WHERE nullif(btrim(t.predecessor_codes),'') IS NULL
), walk AS (
  SELECT * FROM roots
  UNION ALL
  SELECT child.task_id,child.project_id,parent.execution_wave+1,parent.path||child.task_id
  FROM walk parent
  JOIN edges edge ON edge.predecessor_task_id=parent.task_id
  JOIN emission_project_task child ON child.task_id=edge.task_id
  WHERE NOT child.task_id=ANY(parent.path)
)
SELECT t.task_id,t.project_id,t.task_code,
       coalesce(max(w.execution_wave),1)::integer AS execution_wave,
       (count(*) FILTER(WHERE edge.predecessor_task_id IS NULL AND nullif(btrim(t.predecessor_codes),'') IS NOT NULL)
        + CASE WHEN max(w.execution_wave) IS NULL AND nullif(btrim(t.predecessor_codes),'') IS NOT NULL THEN 1 ELSE 0 END)::integer AS missing_predecessor_count
FROM emission_project_task t
LEFT JOIN walk w ON w.task_id=t.task_id
LEFT JOIN edges edge ON edge.task_id=t.task_id
GROUP BY t.task_id,t.project_id,t.task_code;

CREATE OR REPLACE VIEW framework_process_execution_topology_audit AS
SELECT
  (SELECT count(*) FROM framework_process_definition) AS process_count,
  (SELECT count(*) FROM framework_process_execution_topology WHERE topology_status='DESIGN_COMPLETE') AS designed_count,
  (SELECT count(*) FROM framework_process_execution_topology t
    CROSS JOIN LATERAL jsonb_array_elements_text(t.predecessor_process_codes) predecessor(code)
    LEFT JOIN framework_process_execution_topology p ON p.process_code=predecessor.code
    WHERE p.process_code IS NULL OR p.work_type_code<>t.work_type_code OR p.execution_wave>=t.execution_wave) AS invalid_predecessor_count,
  (SELECT count(*) FROM framework_project_task_execution_wave WHERE missing_predecessor_count>0) AS runtime_missing_predecessor_count,
  (SELECT count(*) FROM emission_project_task child
    WHERE child.task_status='DONE' AND EXISTS(
      SELECT 1 FROM emission_project_task parent
      WHERE parent.project_id=child.project_id
        AND parent.task_code=ANY(string_to_array(nullif(child.predecessor_codes,''),','))
        AND parent.task_status<>'DONE')) AS invalid_completed_task_count;

COMMENT ON TABLE framework_process_execution_topology IS '프로세스 병렬 레인, 실행 파동, 합류 조건을 정의하는 정규화 DAG 원장';
COMMENT ON COLUMN framework_process_execution_topology.execution_wave IS '동일 값은 동시에 진행 가능한 업무 열';
COMMENT ON COLUMN framework_process_execution_topology.required_for_join IS '다음 파동 진입을 위해 완료가 필수인지 여부';
