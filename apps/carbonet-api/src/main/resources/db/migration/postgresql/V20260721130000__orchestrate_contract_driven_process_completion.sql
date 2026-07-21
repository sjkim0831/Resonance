-- Contract-driven vertical completion loop.
--
-- This does not invent domain facts and never promotes implementation without
-- evidence. It turns the existing actor/process/page/API/data/test contracts
-- into one deterministic queue: design gaps first, implementation gaps next,
-- and VERIFIED only after every declared gate has concrete evidence.

CREATE TABLE IF NOT EXISTS framework_contract_completion_run (
  run_id bigserial PRIMARY KEY,
  requested_by varchar(100) NOT NULL,
  requested_limit integer NOT NULL,
  run_status varchar(24) NOT NULL DEFAULT 'RUNNING',
  selected_step_count integer NOT NULL DEFAULT 0,
  design_blocked_count integer NOT NULL DEFAULT 0,
  implementation_pending_count integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  queued_job_count integer NOT NULL DEFAULT 0,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp
);

CREATE TABLE IF NOT EXISTS framework_contract_completion_result (
  run_id bigint NOT NULL REFERENCES framework_contract_completion_run(run_id) ON DELETE CASCADE,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  completion_status varchar(32) NOT NULL CHECK (completion_status IN
    ('DESIGN_BLOCKED','IMPLEMENTATION_PENDING','VERIFIED')),
  design_blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  implementation_blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  contract_snapshot jsonb NOT NULL,
  selected_order integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(run_id,process_code,step_code),
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contract_completion_result_status
  ON framework_contract_completion_result(completion_status,process_code,step_code);

CREATE OR REPLACE VIEW framework_contract_completion_queue AS
WITH page_audit AS (
  SELECT s.process_code,s.step_code,
    count(d.page_design_id)::integer AS designed_page_count,
    count(d.page_design_id) FILTER(WHERE d.route_status='IMPLEMENTED')::integer AS implemented_page_count,
    count(d.page_design_id) FILTER(WHERE d.route_status='DESIGN_ONLY')::integer AS planned_page_count,
    count(d.page_design_id) FILTER(WHERE coalesce(f.field_count,0)<10)::integer AS weak_page_count
  FROM framework_process_step s
  LEFT JOIN framework_page_design d USING(process_code,step_code)
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS field_count
    FROM framework_page_field_definition f WHERE f.page_design_id=d.page_design_id
  ) f ON true
  GROUP BY s.process_code,s.step_code
), test_audit AS (
  SELECT p.process_code,
    count(DISTINCT CASE
      WHEN c.case_type IN ('EXCEPTION','VALIDATION') THEN 'EXCEPTION'
      WHEN c.case_type IN ('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY') THEN c.case_type
    END)::integer AS safety_family_count,
    count(*) FILTER(WHERE c.case_status IN ('APPROVED','VERIFIED'))::integer AS approved_test_count
  FROM framework_process_definition p
  LEFT JOIN framework_simulation_case c USING(process_code)
  GROUP BY p.process_code
), job_audit AS (
  SELECT s.process_code,s.step_code,
    count(j.job_id) FILTER(WHERE j.required)::integer AS required_job_count,
    count(j.job_id) FILTER(WHERE j.required AND j.job_status='VERIFIED'
      AND j.quality_status='VERIFIED' AND nullif(j.evidence_ref,'') IS NOT NULL)::integer AS verified_job_count,
    count(j.job_id) FILTER(WHERE j.required AND j.job_status IN ('FAILED','BLOCKED'))::integer AS failed_job_count
  FROM framework_process_step s
  LEFT JOIN framework_development_job j USING(process_code,step_code)
  GROUP BY s.process_code,s.step_code
), audited AS (
  SELECT p.process_code,p.process_name,p.domain_code,p.development_order,
    s.step_code,s.step_name,s.step_order,s.automation_status,s.actor_code,
    s.requires_user_page,s.requires_admin_page,s.requires_api,s.requires_database,
    e.spec_version,e.approval_status,e.generation_status,e.source_hash,
    coalesce(pa.designed_page_count,0) AS designed_page_count,
    coalesce(pa.implemented_page_count,0) AS implemented_page_count,
    coalesce(pa.planned_page_count,0) AS planned_page_count,
    coalesce(pa.weak_page_count,0) AS weak_page_count,
    coalesce(ta.safety_family_count,0) AS safety_family_count,
    coalesce(ta.approved_test_count,0) AS approved_test_count,
    coalesce(ja.required_job_count,0) AS required_job_count,
    coalesce(ja.verified_job_count,0) AS verified_job_count,
    coalesce(ja.failed_job_count,0) AS failed_job_count,
    array_remove(ARRAY[
      CASE WHEN e.process_code IS NULL THEN 'EXECUTION_SPEC_MISSING' END,
      CASE WHEN e.design_status='DESIGN_BLOCKED' THEN 'EXECUTION_SPEC_BLOCKED' END,
      CASE WHEN e.input_contract IS NULL OR e.input_contract='{}'::jsonb THEN 'INPUT_CONTRACT_MISSING' END,
      CASE WHEN e.output_contract IS NULL OR e.output_contract='{}'::jsonb THEN 'OUTPUT_CONTRACT_MISSING' END,
      CASE WHEN e.process_code IS NOT NULL AND jsonb_array_length(e.blocker_codes)>0 THEN 'DECLARED_SPEC_BLOCKERS' END,
      CASE WHEN coalesce(pa.weak_page_count,0)>0 THEN 'PROFESSIONAL_FIELD_CONTRACT_INCOMPLETE' END,
      CASE WHEN coalesce(ta.safety_family_count,0)<5 THEN 'SAFETY_TEST_FAMILY_MISSING' END
    ],NULL) AS design_blockers,
    array_remove(ARRAY[
      CASE WHEN coalesce(pa.planned_page_count,0)>0 THEN 'SCREEN_IMPLEMENTATION_PENDING' END,
      CASE WHEN e.approval_status IS DISTINCT FROM 'APPROVED' THEN 'SPEC_APPROVAL_PENDING' END,
      CASE WHEN coalesce(ja.required_job_count,0)=0 THEN 'IMPLEMENTATION_JOB_MISSING' END,
      CASE WHEN coalesce(ja.required_job_count,0)>coalesce(ja.verified_job_count,0) THEN 'IMPLEMENTATION_EVIDENCE_PENDING' END,
      CASE WHEN coalesce(ja.failed_job_count,0)>0 THEN 'FAILED_JOB_REQUIRES_REPAIR' END
    ],NULL) AS implementation_blockers
  FROM framework_process_definition p
  JOIN framework_process_step s USING(process_code)
  LEFT JOIN framework_step_execution_spec e USING(process_code,step_code)
  LEFT JOIN page_audit pa USING(process_code,step_code)
  LEFT JOIN test_audit ta USING(process_code)
  LEFT JOIN job_audit ja USING(process_code,step_code)
)
SELECT a.*,
  CASE WHEN cardinality(a.design_blockers)>0 THEN 'DESIGN_BLOCKED'
       WHEN cardinality(a.implementation_blockers)>0 THEN 'IMPLEMENTATION_PENDING'
       ELSE 'VERIFIED' END AS completion_status,
  CASE a.automation_status
    WHEN 'NOT_ANALYZED' THEN 0 WHEN 'PLANNED' THEN 1 WHEN 'APPROVED' THEN 2
    WHEN 'GENERATED' THEN 3 WHEN 'IMPLEMENTED' THEN 4 WHEN 'VERIFIED' THEN 5 ELSE 1 END AS status_rank
FROM audited a;

CREATE OR REPLACE FUNCTION framework_run_contract_completion(
  requested_by varchar DEFAULT 'SYSTEM', requested_limit integer DEFAULT 25, dry_run boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  current_run_id bigint;
  selected_count integer := 0;
  design_count integer := 0;
  pending_count integer := 0;
  v_verified_count integer := 0;
  queued_count integer := 0;
BEGIN
  IF requested_limit<1 OR requested_limit>500 THEN
    RAISE EXCEPTION 'requested_limit must be between 1 and 500';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('framework_contract_completion')) THEN
    RETURN jsonb_build_object('status','BUSY','selected',0);
  END IF;

  INSERT INTO framework_contract_completion_run(requested_by,requested_limit)
  VALUES(requested_by,requested_limit) RETURNING run_id INTO current_run_id;

  INSERT INTO framework_contract_completion_result(
    run_id,process_code,step_code,completion_status,design_blockers,
    implementation_blockers,contract_snapshot,selected_order)
  SELECT current_run_id,q.process_code,q.step_code,q.completion_status,
    to_jsonb(q.design_blockers),to_jsonb(q.implementation_blockers),
    jsonb_build_object(
      'processName',q.process_name,'domainCode',q.domain_code,'stepName',q.step_name,
      'actorCode',q.actor_code,'automationStatus',q.automation_status,
      'specVersion',q.spec_version,'sourceHash',q.source_hash,
      'designedPages',q.designed_page_count,'implementedPages',q.implemented_page_count,
      'safetyTestFamilies',q.safety_family_count,'approvedTests',q.approved_test_count,
      'requiredJobs',q.required_job_count,'verifiedJobs',q.verified_job_count),
    row_number() OVER(ORDER BY q.status_rank,coalesce(q.development_order,2147483647),q.process_code,q.step_order)
  FROM framework_contract_completion_queue q
  WHERE q.completion_status<>'VERIFIED' OR q.automation_status<>'VERIFIED'
  ORDER BY q.status_rank,coalesce(q.development_order,2147483647),q.process_code,q.step_order
  LIMIT requested_limit;

  SELECT count(*),count(*) FILTER(WHERE completion_status='DESIGN_BLOCKED'),
    count(*) FILTER(WHERE completion_status='IMPLEMENTATION_PENDING'),
    count(*) FILTER(WHERE completion_status='VERIFIED')
  INTO selected_count,design_count,pending_count,v_verified_count
  FROM framework_contract_completion_result WHERE run_id=current_run_id;

  IF NOT dry_run THEN
    INSERT INTO framework_development_job(
      process_code,step_code,job_type,job_name,target_path,specification_json,
      job_status,approval_status,execution_mode,job_group_code,required,
      progress_weight,max_attempts,quality_status,created_by)
    SELECT r.process_code,r.step_code,
      CASE WHEN r.completion_status='DESIGN_BLOCKED' THEN 'DESIGN' ELSE 'FULL_STACK' END,
      CASE WHEN r.completion_status='DESIGN_BLOCKED' THEN '계약 설계 자동 보정' ELSE '수직 통합 구현·검증' END,
      'contract://'||r.process_code||'/'||r.step_code,
      jsonb_build_object(
        'algorithm','CONTRACT_DRIVEN_VERTICAL_COMPLETION_V1',
        'completionRunId',current_run_id,'completionStatus',r.completion_status,
        'designBlockers',r.design_blockers,'implementationBlockers',r.implementation_blockers,
        'contractSnapshot',r.contract_snapshot,'reuseCommonAssets',true,
        'requiredGates',jsonb_build_array('DESIGN','DATABASE','API','AUTHORITY','FRONTEND','RESPONSIVE','ACCESSIBILITY','EXCEPTION','ACTOR_TEST','LIVE_SMOKE'),
        'verifiedEvidenceRequired',true)::text,
      'PLANNED','APPROVED','SEQUENTIAL',r.process_code||'_VERTICAL_COMPLETION',true,
      10,3,'PENDING','CONTRACT_COMPLETION_ALGORITHM'
    FROM framework_contract_completion_result r
    WHERE r.run_id=current_run_id AND r.completion_status<>'VERIFIED'
      AND NOT EXISTS (
        SELECT 1 FROM framework_development_job j
        WHERE j.process_code=r.process_code AND j.step_code=r.step_code
          AND j.target_path='contract://'||r.process_code||'/'||r.step_code
          AND j.job_status IN ('PLANNED','RETRY','RUNNING','COMPLETED','VERIFIED'));
    GET DIAGNOSTICS queued_count=ROW_COUNT;

    UPDATE framework_process_step s
    SET automation_status=CASE
      WHEN r.completion_status='VERIFIED' THEN 'VERIFIED'
      WHEN s.automation_status='NOT_ANALYZED' THEN 'PLANNED'
      ELSE s.automation_status END
    FROM framework_contract_completion_result r
    WHERE r.run_id=current_run_id AND r.process_code=s.process_code AND r.step_code=s.step_code;
  END IF;

  UPDATE framework_contract_completion_run SET
    run_status=CASE WHEN dry_run THEN 'PREVIEW' ELSE 'QUEUED' END,
    selected_step_count=selected_count,design_blocked_count=design_count,
    implementation_pending_count=pending_count,verified_count=v_verified_count,
    queued_job_count=queued_count,
    result_json=jsonb_build_object('selected',selected_count,'designBlocked',design_count,
      'implementationPending',pending_count,'verified',v_verified_count,'queuedJobs',queued_count,
      'dryRun',dry_run),completed_at=current_timestamp
  WHERE run_id=current_run_id;

  RETURN jsonb_build_object('status',CASE WHEN dry_run THEN 'PREVIEW' ELSE 'QUEUED' END,
    'runId',current_run_id,'selected',selected_count,'designBlocked',design_count,
    'implementationPending',pending_count,'verified',v_verified_count,'queuedJobs',queued_count);
EXCEPTION WHEN OTHERS THEN
  IF current_run_id IS NOT NULL THEN
    UPDATE framework_contract_completion_run SET run_status='FAILED',
      result_json=jsonb_build_object('error',SQLERRM),completed_at=current_timestamp
    WHERE run_id=current_run_id;
  END IF;
  RAISE;
END $$;

-- Install-time preview proves that all joins and JSON contracts are valid,
-- without mutating automation status or adding development work.
SELECT framework_run_contract_completion('FLYWAY_CONTRACT_COMPLETION_PREVIEW',25,true);
