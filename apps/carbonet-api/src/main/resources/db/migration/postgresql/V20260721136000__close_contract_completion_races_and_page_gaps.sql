-- A required user/admin page is a design contract, not an implementation
-- failure. Classify the gap before a FULL_STACK job can be created.
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
      CASE WHEN coalesce(pa.designed_page_count,0) <
        (CASE WHEN s.requires_user_page THEN 1 ELSE 0 END + CASE WHEN s.requires_admin_page THEN 1 ELSE 0 END)
        THEN 'REQUIRED_PAGE_DESIGN_MISSING' END,
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

-- A worker may persist VERIFIED evidence immediately after an over-eager
-- orphan recovery. Reconcile only cryptographically addressable evidence; no
-- job is promoted merely because it stopped running.
WITH verified_event AS (
  SELECT DISTINCT ON (e.job_id) e.job_id,e.created_at,e.detail_json->>'commit' AS commit_hash
  FROM framework_development_job_event e
  WHERE e.event_type='VERIFIED'
    AND coalesce(e.detail_json->>'commit','') ~ '^[0-9a-f]{40}$'
  ORDER BY e.job_id,e.created_at DESC
), orphan_event AS (
  SELECT e.job_id,max(e.created_at) AS orphaned_at
  FROM framework_development_job_event e
  WHERE e.event_type='ORPHAN_WORKER_RECOVERED'
  GROUP BY e.job_id
), candidate AS (
  SELECT j.job_id,j.job_status AS prior_status,v.created_at,v.commit_hash
  FROM framework_development_job j
  JOIN verified_event v USING(job_id)
  JOIN orphan_event o USING(job_id)
  WHERE j.job_status IN ('RETRY','FAILED') AND v.created_at>=o.orphaned_at
    AND j.created_by='CONTRACT_COMPLETION_ALGORITHM'
), reconciled AS (
  UPDATE framework_development_job j
  SET job_status='VERIFIED',quality_status='VERIFIED',
      evidence_ref='git:'||c.commit_hash||';reconciled:verified-event-after-orphan-race',
      worker_id=null,lease_token=null,lease_until=null,last_error=null,
      completed_at=c.created_at,updated_at=current_timestamp
  FROM candidate c WHERE j.job_id=c.job_id
  RETURNING j.job_id,c.prior_status,c.commit_hash
)
INSERT INTO framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
SELECT job_id,'ORPHAN_RESULT_RECONCILED',prior_status,'VERIFIED','flyway',
  jsonb_build_object('commit',commit_hash,'reason','verified evidence persisted after orphan recovery race')
FROM reconciled;
