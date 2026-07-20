-- Promote cross-cutting CCUS responsibilities to first-class work types.
INSERT INTO framework_business_work_type(
  work_type_code,work_type_name,work_type_name_en,description,sort_order,use_at
) VALUES
('MRV','CCUS MRV·추적성','CCUS MRV and Traceability','포집·운송·활용·저장 전 과정의 MRV, 이동 추적, 무결성 및 누출 대응',90,'Y'),
('COMPLIANCE','규제·공시 대응','Regulatory Compliance and Disclosure','규제기관 제출·접수·보완, 외부 검증 대응 및 공시 정정',100,'Y'),
('DATA_GOVERNANCE','데이터 거버넌스·품질','Data Governance and Quality','배출량·LCA·감축 공통 데이터 품질, 스키마, 버전, 증빙 및 이상치 관리',110,'Y')
ON CONFLICT(work_type_code) DO UPDATE SET
  work_type_name=excluded.work_type_name,work_type_name_en=excluded.work_type_name_en,
  description=excluded.description,sort_order=excluded.sort_order,use_at='Y',updated_at=current_timestamp;

UPDATE framework_business_work_type SET sort_order=CASE work_type_code
  WHEN 'MEMBER' THEN 10 WHEN 'EMISSION' THEN 20 WHEN 'LCA' THEN 30
  WHEN 'REDUCTION' THEN 40 WHEN 'MONITORING' THEN 50 WHEN 'TRADE' THEN 60
  WHEN 'CERTIFICATE' THEN 70 WHEN 'EDUCATION' THEN 80 WHEN 'MRV' THEN 90
  WHEN 'COMPLIANCE' THEN 100 WHEN 'DATA_GOVERNANCE' THEN 110
  WHEN 'SYSTEM' THEN 120 WHEN 'COMMON' THEN 130 ELSE sort_order END,
  updated_at=current_timestamp;

CREATE TEMP TABLE process_work_type_reclassification(
  process_code varchar(80) PRIMARY KEY,new_work_type_code varchar(40) NOT NULL,
  new_phase varchar(80) NOT NULL
) ON COMMIT DROP;

INSERT INTO process_work_type_reclassification VALUES
('CCUS_LIFECYCLE_MRV','MRV','CCUS_LIFECYCLE'),
('MRV_TRACEABILITY','MRV','TRACEABILITY_INTEGRITY'),
('CHAIN_OF_CUSTODY','MRV','TRACEABILITY_INTEGRITY'),
('LEAKAGE_INCIDENT_RESPONSE','MRV','INCIDENT_RECOVERY'),
('DOUBLE_USE_PREVENTION','MRV','TRACEABILITY_INTEGRITY'),
('REGULATORY_SUBMISSION','COMPLIANCE','REGULATORY_SUBMISSION'),
('DISCLOSURE_CORRECTION','COMPLIANCE','DISCLOSURE_CORRECTION'),
('EXTERNAL_VERIFICATION_ENGAGEMENT','COMPLIANCE','EXTERNAL_ASSURANCE'),
('REPORT_SUBMISSION','COMPLIANCE','REGULATORY_SUBMISSION'),
('MEASUREMENT_DATA_QUALITY','DATA_GOVERNANCE','MEASUREMENT_QUALITY'),
('DATA_QUALITY_MONITORING','DATA_GOVERNANCE','QUALITY_MONITORING'),
('LCA_DATA_QUALITY_UNCERTAINTY','DATA_GOVERNANCE','LCA_DATA_QUALITY'),
('BACKGROUND_DB_VERSION_IMPACT','DATA_GOVERNANCE','REFERENCE_DATA_VERSION'),
('DATA_SCHEMA_CONTRACT','DATA_GOVERNANCE','DATA_CONTRACT'),
('DATA_INTEGRATION','DATA_GOVERNANCE','DATA_INTEGRATION');

-- Move sequence rows first with collision-free temporary ordering.
UPDATE framework_business_process_sequence seq
SET work_type_code=map.new_work_type_code,
    workflow_phase=map.new_phase,
    workflow_order=100000+source.ordinal,
    updated_at=current_timestamp
FROM process_work_type_reclassification map
JOIN (
  SELECT process_code,row_number() OVER(ORDER BY process_code)::integer AS ordinal
  FROM process_work_type_reclassification
) source ON source.process_code=map.process_code
WHERE seq.process_code=map.process_code;

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition process
SET domain_code=map.new_work_type_code,updated_at=current_timestamp
FROM process_work_type_reclassification map
WHERE process.process_code=map.process_code;
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

-- Re-number every work type without violating the unique order constraint.
UPDATE framework_business_process_sequence
SET workflow_order=workflow_order+1000000,updated_at=current_timestamp;

WITH ranked AS (
  SELECT process_code,work_type_code,
         row_number() OVER(PARTITION BY work_type_code ORDER BY workflow_order,process_code)::integer AS ordinal,
         count(*) OVER(PARTITION BY work_type_code)::integer AS total
  FROM framework_business_process_sequence WHERE sequence_status='ACTIVE'
)
UPDATE framework_business_process_sequence seq
SET workflow_order=ranked.ordinal*10,
    process_role=CASE
      WHEN ranked.ordinal=1 THEN 'ENTRY'
      WHEN ranked.ordinal=ranked.total THEN 'EXIT'
      WHEN seq.process_role IN ('BRANCH','SUPPORT') THEN seq.process_role
      ELSE 'CORE' END,
    updated_at=current_timestamp
FROM ranked WHERE ranked.process_code=seq.process_code;

WITH ordered AS (
  SELECT process_code,work_type_code,
         lead(process_code) OVER(PARTITION BY work_type_code ORDER BY workflow_order,process_code) AS next_code
  FROM framework_business_process_sequence WHERE sequence_status='ACTIVE'
)
UPDATE framework_business_process_sequence seq
SET next_process_code=ordered.next_code,updated_at=current_timestamp
FROM ordered WHERE ordered.process_code=seq.process_code;

-- Rebuild normalized waves and parallel lanes from the reclassified catalog.
WITH ordered AS (
  SELECT s.*,
         sum(CASE WHEN s.process_role IN ('BRANCH','SUPPORT') THEN 0 ELSE 1 END)
           OVER(PARTITION BY s.work_type_code ORDER BY s.workflow_order,s.process_code) AS execution_wave
  FROM framework_business_process_sequence s WHERE s.sequence_status='ACTIVE'
), normalized AS (
  SELECT o.*,
         row_number() OVER(PARTITION BY o.work_type_code,o.execution_wave ORDER BY o.workflow_order,o.process_code) AS lane_order,
         count(*) OVER(PARTITION BY o.work_type_code,o.execution_wave) AS wave_size
  FROM ordered o
), topology AS (
  SELECT n.*,coalesce((
    SELECT jsonb_agg(p.process_code ORDER BY p.workflow_order,p.process_code)
    FROM normalized p WHERE p.work_type_code=n.work_type_code
      AND p.execution_wave=n.execution_wave-1
      AND p.process_role NOT IN ('BRANCH','SUPPORT')
  ),'[]'::jsonb) AS predecessors
  FROM normalized n
)
UPDATE framework_process_execution_topology target SET
  work_type_code=source.work_type_code,stage_code=source.workflow_phase,
  execution_wave=source.execution_wave,lane_code=CASE
    WHEN source.process_role='BRANCH' THEN 'EXCEPTION'
    WHEN source.process_role='SUPPORT' THEN 'SUPPORT' ELSE 'PRIMARY' END,
  lane_order=source.lane_order,
  execution_mode=CASE WHEN source.process_role IN ('BRANCH','SUPPORT') THEN 'CONDITIONAL'
    WHEN source.wave_size>1 THEN 'PARALLEL' ELSE 'SEQUENTIAL' END,
  join_strategy=CASE WHEN source.execution_wave=1 THEN 'NONE' ELSE 'ALL' END,
  predecessor_process_codes=source.predecessors,
  shared_milestone_code=source.work_type_code||'_'||source.workflow_phase||'_W'||source.execution_wave,
  required_for_join=source.process_role NOT IN ('BRANCH','SUPPORT'),
  applicability_rule=CASE WHEN source.process_role='BRANCH' THEN 'INCIDENT_OR_EXCEPTION'
    WHEN source.process_role='SUPPORT' THEN 'ON_DEMAND' ELSE 'ALWAYS' END,
  topology_status='DESIGN_COMPLETE',updated_at=current_timestamp
FROM topology source WHERE source.process_code=target.process_code;

UPDATE framework_process_execution_topology current_node
SET successor_process_codes=coalesce((
  SELECT jsonb_agg(next_node.process_code ORDER BY next_node.lane_order,next_node.process_code)
  FROM framework_process_execution_topology next_node
  WHERE next_node.work_type_code=current_node.work_type_code
    AND current_node.process_code IN (SELECT jsonb_array_elements_text(next_node.predecessor_process_codes))
),'[]'::jsonb),updated_at=current_timestamp;

UPDATE framework_business_process_sequence seq
SET prerequisite_process_codes=array_to_string(ARRAY(
  SELECT jsonb_array_elements_text(topo.predecessor_process_codes)
),','),updated_at=current_timestamp
FROM framework_process_execution_topology topo
WHERE topo.process_code=seq.process_code;

UPDATE framework_project_process_applicability applicability
SET work_type_code=sequence.work_type_code,
    criteria_snapshot=jsonb_set(applicability.criteria_snapshot,'{workTypeCode}',to_jsonb(sequence.work_type_code),true),
    updated_at=current_timestamp
FROM framework_business_process_sequence sequence
WHERE sequence.process_code=applicability.process_code;

-- Future emission projects include the promoted cross-cutting work types.
DO $$
DECLARE definition text;
BEGIN
  definition:=pg_get_functiondef('framework_sync_project_processes(character varying,character varying)'::regprocedure);
  definition:=replace(definition,
    'WHERE seq.work_type_code=''EMISSION'' AND seq.sequence_status=''ACTIVE''',
    'WHERE seq.work_type_code IN (''EMISSION'',''MRV'',''COMPLIANCE'',''DATA_GOVERNANCE'') AND seq.sequence_status=''ACTIVE''');
  IF position('seq.work_type_code IN (''EMISSION'',''MRV'',''COMPLIANCE'',''DATA_GOVERNANCE'')' in definition)=0 THEN
    RAISE EXCEPTION 'PROJECT_PROCESS_SYNC_SCOPE_PATCH_FAILED';
  END IF;
  EXECUTE definition;
END $$;

CREATE OR REPLACE VIEW framework_work_type_classification_audit AS
SELECT
  (SELECT count(*) FROM framework_business_work_type WHERE use_at='Y') AS active_work_type_count,
  (SELECT count(*) FROM framework_process_definition process
    LEFT JOIN framework_business_process_sequence sequence ON sequence.process_code=process.process_code
    LEFT JOIN framework_process_execution_topology topology ON topology.process_code=process.process_code
    WHERE sequence.process_code IS NULL OR topology.process_code IS NULL
       OR upper(process.domain_code)<>sequence.work_type_code
       OR sequence.work_type_code<>topology.work_type_code) AS classification_mismatch_count,
  (SELECT count(*) FROM framework_business_work_type work_type
    WHERE work_type.work_type_code IN ('MRV','COMPLIANCE','DATA_GOVERNANCE') AND work_type.use_at='Y'
      AND EXISTS(SELECT 1 FROM framework_process_definition process WHERE upper(process.domain_code)=work_type.work_type_code)) AS strategic_work_type_count;

COMMENT ON VIEW framework_work_type_classification_audit IS '13개 전문 업무 종류와 프로세스·순서·DAG 분류 일치 여부';
