CREATE OR REPLACE VIEW framework_process_design_assurance_matrix AS
WITH step_audit AS (
  SELECT p.process_code,
    count(s.step_code)::integer AS step_count,
    count(*) FILTER(WHERE nullif(btrim(s.actor_code),'') IS NULL)::integer AS missing_actor_binding_count,
    count(*) FILTER(WHERE a.actor_code IS NULL)::integer AS unknown_actor_count,
    count(*) FILTER(WHERE nullif(btrim(s.command_code),'') IS NULL OR nullif(btrim(s.from_state),'') IS NULL OR nullif(btrim(s.to_state),'') IS NULL)::integer AS incomplete_transition_count,
    count(*) FILTER(WHERE nullif(btrim(s.requirement_text),'') IS NULL OR nullif(btrim(s.completion_rule),'') IS NULL)::integer AS incomplete_business_rule_count,
    count(*) FILTER(WHERE nullif(btrim(s.input_contract),'') IS NULL OR btrim(s.input_contract)='{}' OR nullif(btrim(s.output_contract),'') IS NULL OR btrim(s.output_contract)='{}')::integer AS incomplete_data_contract_count,
    count(*) FILTER(WHERE s.requires_user_page AND nullif(btrim(s.user_path),'') IS NULL)::integer AS missing_user_route_count,
    count(*) FILTER(WHERE s.requires_admin_page AND nullif(btrim(s.admin_path),'') IS NULL)::integer AS missing_admin_route_count,
    count(*) FILTER(WHERE s.requires_api AND nullif(btrim(s.api_contract),'') IS NULL)::integer AS missing_api_contract_count,
    count(*) FILTER(WHERE s.evidence_required AND (nullif(btrim(s.evidence_types),'') IS NULL OR btrim(s.evidence_types)='[]'))::integer AS missing_evidence_contract_count,
    count(*) FILTER(WHERE s.to_state='COMPLETED')::integer AS terminal_step_count,
    count(*) FILTER(WHERE s.to_state<>'COMPLETED' AND NOT EXISTS(
      SELECT 1 FROM framework_process_step n WHERE n.process_code=s.process_code AND n.from_state=s.to_state
    ))::integer AS unreachable_next_state_count,
    count(*) FILTER(WHERE s.requires_user_page AND NOT EXISTS(
      SELECT 1 FROM framework_professional_screen_contract c
      WHERE c.process_code=s.process_code AND c.step_code=s.step_code AND c.audience='USER'
        AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.user_path,'?',1))
    ))::integer AS missing_user_screen_contract_count,
    count(*) FILTER(WHERE s.requires_admin_page AND NOT EXISTS(
      SELECT 1 FROM framework_professional_screen_contract c
      WHERE c.process_code=s.process_code AND c.step_code=s.step_code AND c.audience='ADMIN'
        AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.admin_path,'?',1))
    ))::integer AS missing_admin_screen_contract_count
  FROM framework_process_definition p
  LEFT JOIN framework_process_step s ON s.process_code=p.process_code
  LEFT JOIN framework_actor_definition a ON a.actor_code=s.actor_code AND a.use_at='Y'
  GROUP BY p.process_code
), test_audit AS (
  SELECT p.process_code,
    ((count(*) FILTER(WHERE c.case_type='HAPPY_PATH')>0)::integer
      +(count(*) FILTER(WHERE c.case_type IN ('EXCEPTION','VALIDATION'))>0)::integer
      +(count(*) FILTER(WHERE c.case_type='AUTHORITY')>0)::integer
      +(count(*) FILTER(WHERE c.case_type='ISOLATION')>0)::integer
      +(count(*) FILTER(WHERE c.case_type='RECOVERY')>0)::integer)::integer AS safety_test_type_count,
    ((count(*) FILTER(WHERE c.case_type='HAPPY_PATH' AND c.case_status IN ('APPROVED','VERIFIED'))>0)::integer
      +(count(*) FILTER(WHERE c.case_type IN ('EXCEPTION','VALIDATION') AND c.case_status IN ('APPROVED','VERIFIED'))>0)::integer
      +(count(*) FILTER(WHERE c.case_type='AUTHORITY' AND c.case_status IN ('APPROVED','VERIFIED'))>0)::integer
      +(count(*) FILTER(WHERE c.case_type='ISOLATION' AND c.case_status IN ('APPROVED','VERIFIED'))>0)::integer
      +(count(*) FILTER(WHERE c.case_type='RECOVERY' AND c.case_status IN ('APPROVED','VERIFIED'))>0)::integer)::integer AS approved_safety_test_type_count,
    count(c.case_code) FILTER(WHERE c.case_status NOT IN ('APPROVED','VERIFIED'))::integer AS unapproved_test_count
  FROM framework_process_definition p LEFT JOIN framework_simulation_case c ON c.process_code=p.process_code
  GROUP BY p.process_code
), job_audit AS (
  SELECT p.process_code,
    count(j.job_id) FILTER(WHERE j.required)::integer AS required_job_count,
    count(j.job_id) FILTER(WHERE j.required AND j.job_status IN ('COMPLETED','VERIFIED') AND j.quality_status IN ('PASSED','VERIFIED'))::integer AS verified_job_count,
    count(j.job_id) FILTER(WHERE j.required AND j.job_status IN ('FAILED','BLOCKED'))::integer AS blocked_job_count
  FROM framework_process_definition p LEFT JOIN framework_development_job j ON j.process_code=p.process_code
  GROUP BY p.process_code
), audit AS (
  SELECT p.process_code,p.process_name,p.domain_code,p.process_status,p.definition_locked,
    s.step_count,s.missing_actor_binding_count,s.unknown_actor_count,s.incomplete_transition_count,
    s.incomplete_business_rule_count,s.incomplete_data_contract_count,s.missing_user_route_count,
    s.missing_admin_route_count,s.missing_api_contract_count,s.missing_evidence_contract_count,
    s.terminal_step_count,s.unreachable_next_state_count,s.missing_user_screen_contract_count,s.missing_admin_screen_contract_count,
    t.safety_test_type_count,t.approved_safety_test_type_count,t.unapproved_test_count,
    j.required_job_count,j.verified_job_count,j.blocked_job_count,
    CASE WHEN seq.process_code IS NULL THEN 1 ELSE 0 END AS missing_sequence_count,
    (CASE WHEN nullif(btrim(p.goal),'') IS NULL OR nullif(btrim(p.start_condition),'') IS NULL OR nullif(btrim(p.completion_condition),'') IS NULL OR nullif(btrim(p.owner_actor_code),'') IS NULL THEN 1 ELSE 0 END
      + CASE WHEN s.step_count=0 THEN 1 ELSE 0 END
      + s.missing_actor_binding_count+s.unknown_actor_count+s.incomplete_transition_count+s.incomplete_business_rule_count+s.incomplete_data_contract_count
      + s.missing_user_route_count+s.missing_admin_route_count+s.missing_api_contract_count+s.missing_evidence_contract_count
      + CASE WHEN s.terminal_step_count=0 THEN 1 ELSE 0 END+s.unreachable_next_state_count
      + s.missing_user_screen_contract_count+s.missing_admin_screen_contract_count
      + greatest(0,5-t.safety_test_type_count)+greatest(0,5-t.approved_safety_test_type_count)
      + CASE WHEN j.required_job_count=0 THEN 1 ELSE 0 END+j.blocked_job_count
      + CASE WHEN seq.process_code IS NULL THEN 1 ELSE 0 END)::integer AS design_blocker_count
  FROM framework_process_definition p
  JOIN step_audit s USING(process_code)
  JOIN test_audit t USING(process_code)
  JOIN job_audit j USING(process_code)
  LEFT JOIN framework_business_process_sequence seq ON seq.process_code=p.process_code
)
SELECT a.*,
  greatest(0,100-least(100,a.design_blocker_count*8)-CASE WHEN a.required_job_count>a.verified_job_count THEN 10 ELSE 0 END)::integer AS design_accuracy_score,
  CASE WHEN a.design_blocker_count>0 THEN 'DESIGN_BLOCKED'
       WHEN a.required_job_count>a.verified_job_count THEN 'IMPLEMENTATION_PENDING'
       WHEN NOT a.definition_locked THEN 'REVIEW_REQUIRED'
       ELSE 'IMPLEMENTATION_VERIFIED' END AS assurance_status,
  concat_ws(', ',
    CASE WHEN a.missing_actor_binding_count+a.unknown_actor_count>0 THEN 'ACTOR_CONTRACT_MISSING:'||(a.missing_actor_binding_count+a.unknown_actor_count) END,
    CASE WHEN a.incomplete_transition_count+a.unreachable_next_state_count>0 THEN 'STATE_FLOW_INVALID:'||(a.incomplete_transition_count+a.unreachable_next_state_count) END,
    CASE WHEN a.incomplete_business_rule_count>0 THEN 'BUSINESS_RULE_MISSING:'||a.incomplete_business_rule_count END,
    CASE WHEN a.incomplete_data_contract_count>0 THEN 'DATA_CONTRACT_MISSING:'||a.incomplete_data_contract_count END,
    CASE WHEN a.missing_api_contract_count>0 THEN 'API_CONTRACT_MISSING:'||a.missing_api_contract_count END,
    CASE WHEN a.missing_user_route_count+a.missing_admin_route_count>0 THEN 'ROUTE_MISSING:'||(a.missing_user_route_count+a.missing_admin_route_count) END,
    CASE WHEN a.missing_user_screen_contract_count+a.missing_admin_screen_contract_count>0 THEN 'SCREEN_CONTRACT_MISSING:'||(a.missing_user_screen_contract_count+a.missing_admin_screen_contract_count) END,
    CASE WHEN a.safety_test_type_count<5 THEN 'SAFETY_TEST_TYPE_MISSING:'||(5-a.safety_test_type_count) END,
    CASE WHEN a.approved_safety_test_type_count<5 THEN 'SAFETY_TEST_APPROVAL_MISSING:'||(5-a.approved_safety_test_type_count) END,
    CASE WHEN a.missing_sequence_count>0 THEN 'WORKFLOW_SEQUENCE_MISSING' END,
    CASE WHEN a.blocked_job_count>0 THEN 'DEVELOPMENT_JOB_BLOCKED:'||a.blocked_job_count END,
    CASE WHEN a.required_job_count>a.verified_job_count THEN 'IMPLEMENTATION_EVIDENCE_PENDING:'||(a.required_job_count-a.verified_job_count) END
  ) AS next_action
FROM audit a;

CREATE TABLE IF NOT EXISTS framework_process_design_assurance_run (
  assurance_run_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  assurance_status varchar(32) NOT NULL,
  design_accuracy_score integer NOT NULL,
  design_blocker_count integer NOT NULL,
  next_action text NOT NULL DEFAULT '',
  design_snapshot jsonb NOT NULL,
  executed_by varchar(100) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_process_design_assurance_run_latest
  ON framework_process_design_assurance_run(process_code,executed_at DESC);

CREATE OR REPLACE FUNCTION framework_audit_all_process_designs(requested_by varchar DEFAULT 'SYSTEM')
RETURNS TABLE(process_count integer,verified_count integer,blocked_count integer,pending_count integer)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO framework_process_design_assurance_run(process_code,assurance_status,design_accuracy_score,design_blocker_count,next_action,design_snapshot,executed_by)
  SELECT process_code,assurance_status,design_accuracy_score,design_blocker_count,coalesce(next_action,''),
    to_jsonb(m)-ARRAY['process_name','next_action'],requested_by
  FROM framework_process_design_assurance_matrix m;
  RETURN QUERY SELECT count(*)::integer,
    count(*) FILTER(WHERE assurance_status='IMPLEMENTATION_VERIFIED')::integer,
    count(*) FILTER(WHERE assurance_status='DESIGN_BLOCKED')::integer,
    count(*) FILTER(WHERE assurance_status IN ('IMPLEMENTATION_PENDING','REVIEW_REQUIRED'))::integer
  FROM framework_process_design_assurance_matrix;
END $$;

SELECT * FROM framework_audit_all_process_designs('FLYWAY_DESIGN_ASSURANCE');
