-- Canonical, fail-closed screen design gate.
-- Design readiness and implementation verification are intentionally separate.

CREATE TABLE IF NOT EXISTS framework_executable_design_audit_run (
  audit_run_id bigserial PRIMARY KEY,
  requested_by varchar(100) NOT NULL,
  total_count integer NOT NULL,
  design_ready_count integer NOT NULL,
  implementation_pending_count integer NOT NULL,
  verified_count integer NOT NULL,
  blocked_count integer NOT NULL,
  blocker_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_executable_design_audit_run_executed
  ON framework_executable_design_audit_run(executed_at DESC);

CREATE OR REPLACE VIEW framework_executable_screen_design_gate AS
WITH route_count AS (
  SELECT lower(split_part(coalesce(actual_route_path,planned_route_path),'?',1)) route_key,
         count(*) design_count
  FROM framework_page_design
  GROUP BY lower(split_part(coalesce(actual_route_path,planned_route_path),'?',1))
), fields AS (
  SELECT page_design_id,count(*) field_count,
         count(*) FILTER (WHERE required) required_field_count,
         bool_and(nullif(btrim(api_property),'') IS NOT NULL) api_mapped,
         bool_and(nullif(btrim(permission_code),'') IS NOT NULL) permission_mapped,
         bool_and(validation_contract NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)) validation_mapped
  FROM framework_page_field_definition
  GROUP BY page_design_id
), tests AS (
  SELECT process_code,
         count(DISTINCT case_type) FILTER (
           WHERE case_type IN ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY')
             AND case_status IN ('VERIFIED','APPROVED','ACTIVE','AUTOMATED','READY')
             AND automated
         ) safety_test_type_count
  FROM framework_simulation_case
  GROUP BY process_code
), handoff_endpoint AS (
  SELECT process_code,from_step_code step_code,context_keys,payload_contract,
         integrity_contract,authorization_contract,failure_contract
  FROM framework_process_data_handoff
  UNION ALL
  SELECT coalesce(to_process_code,process_code),to_step_code,context_keys,payload_contract,
         integrity_contract,authorization_contract,failure_contract
  FROM framework_process_data_handoff
  WHERE nullif(btrim(to_step_code),'') IS NOT NULL
), handoffs AS (
  SELECT process_code,step_code,
         count(*) handoff_count,
         bool_and(
           context_keys NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
           AND payload_contract NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
           AND integrity_contract NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
           AND authorization_contract NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
           AND failure_contract NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
         ) handoff_complete
  FROM handoff_endpoint
  GROUP BY process_code,step_code
), contracts AS (
  SELECT process_code,step_code,audience,
         count(*) contract_count,
         bool_and(
           length(btrim(business_purpose))>=20
           AND length(btrim(entry_condition))>=10
           AND length(btrim(exit_condition))>=20
           AND framework_try_jsonb(section_contract)<>'[]'::jsonb
           AND framework_try_jsonb(field_contract)<>'[]'::jsonb
           AND framework_try_jsonb(command_contract)<>'[]'::jsonb
           AND framework_try_jsonb(api_contract)<>'[]'::jsonb
           AND framework_try_jsonb(data_contract)<>'[]'::jsonb
           AND framework_try_jsonb(evidence_contract)<>'[]'::jsonb
         ) semantic_complete,
         bool_and(authority_verified) authority_verified,
         bool_and(
           exception_states_verified
           AND state_contract LIKE '%ERROR%'
           AND state_contract LIKE '%FORBIDDEN%'
           AND state_contract LIKE '%RECOVERY%'
         ) recovery_verified,
         bool_and(
           nullif(btrim(audit_evidence_ref),'') IS NOT NULL
           AND (data_contract ILIKE '%version%' OR evidence_contract ILIKE '%version%')
         ) version_audit_verified
  FROM framework_professional_screen_contract
  GROUP BY process_code,step_code,audience
), resources AS (
  SELECT route_key,count(*) resource_count,
         bool_or(implementation_status IN ('IMPLEMENTED','VERIFIED','ACTIVE')) implementation_present
  FROM framework_screen_resource
  GROUP BY route_key
), evaluated AS (
  SELECT pd.page_design_id,pd.page_code,pd.page_title,pd.process_code,pd.step_code,
         pd.audience,pd.actor_code,
         lower(split_part(coalesce(pd.actual_route_path,pd.planned_route_path),'?',1)) route_key,
         coalesce(f.field_count,0) field_count,
         coalesce(t.safety_test_type_count,0) safety_test_type_count,
         coalesce(h.handoff_count,0) handoff_count,
         (nullif(btrim(pd.process_code),'') IS NOT NULL
           AND nullif(btrim(pd.step_code),'') IS NOT NULL
           AND nullif(btrim(pd.actor_code),'') IS NOT NULL
           AND ps.step_code IS NOT NULL) identity_passed,
         (length(btrim(pd.page_purpose))>=20
           AND length(btrim(pd.entry_condition))>=10
           AND length(btrim(pd.exit_condition))>=10) business_passed,
         (coalesce(f.field_count,0)>=8 AND coalesce(f.required_field_count,0)>0
           AND coalesce(f.api_mapped,false) AND coalesce(f.permission_mapped,false)
           AND coalesce(f.validation_mapped,false)) field_contract_passed,
         (nullif(btrim(ps.from_state),'') IS NOT NULL
           AND nullif(btrim(ps.to_state),'') IS NOT NULL
           AND nullif(btrim(ps.command_code),'') IS NOT NULL
           AND nullif(btrim(ps.completion_rule),'') IS NOT NULL) transition_passed,
         (coalesce(h.handoff_count,0)>0 AND coalesce(h.handoff_complete,false)) handoff_passed,
         (coalesce(c.contract_count,0)>0 AND coalesce(c.semantic_complete,false)) professional_contract_passed,
         coalesce(c.authority_verified,false) authority_passed,
         coalesce(c.recovery_verified,false) recovery_passed,
         coalesce(c.version_audit_verified,false) version_audit_passed,
         (coalesce(t.safety_test_type_count,0)=5) test_passed,
         (coalesce(rc.design_count,0)=1) route_unique_passed,
         coalesce(r.implementation_present,false) implementation_present
  FROM framework_page_design pd
  LEFT JOIN framework_process_step ps
    ON ps.process_code=pd.process_code AND ps.step_code=pd.step_code
  LEFT JOIN fields f USING(page_design_id)
  LEFT JOIN tests t ON t.process_code=pd.process_code
  LEFT JOIN handoffs h
    ON h.process_code=pd.process_code AND h.step_code=pd.step_code
  LEFT JOIN contracts c
    ON c.process_code=pd.process_code AND c.step_code=pd.step_code
   AND c.audience=pd.audience
  LEFT JOIN route_count rc
    ON rc.route_key=lower(split_part(coalesce(pd.actual_route_path,pd.planned_route_path),'?',1))
  LEFT JOIN resources r
    ON r.route_key=lower(split_part(coalesce(pd.actual_route_path,pd.planned_route_path),'?',1))
), scored AS (
  SELECT e.*,
    array_remove(ARRAY[
      CASE WHEN NOT identity_passed THEN 'IDENTITY_ACTOR_PROCESS_BINDING_MISSING' END,
      CASE WHEN NOT business_passed THEN 'BUSINESS_ENTRY_EXIT_CONTRACT_INCOMPLETE' END,
      CASE WHEN NOT field_contract_passed THEN 'FIELD_API_PERMISSION_VALIDATION_CONTRACT_INCOMPLETE' END,
      CASE WHEN NOT transition_passed THEN 'STATE_TRANSITION_INCOMPLETE' END,
      CASE WHEN NOT handoff_passed THEN 'CROSS_SCREEN_HANDOFF_INCOMPLETE' END,
      CASE WHEN NOT professional_contract_passed THEN 'PROFESSIONAL_SCREEN_CONTRACT_INCOMPLETE' END,
      CASE WHEN NOT authority_passed THEN 'AUTHORITY_NOT_VERIFIED' END,
      CASE WHEN NOT recovery_passed THEN 'EXCEPTION_RECOVERY_NOT_VERIFIED' END,
      CASE WHEN NOT version_audit_passed THEN 'VERSION_AUDIT_NOT_VERIFIED' END,
      CASE WHEN NOT test_passed THEN 'FIVE_SAFETY_TEST_TYPES_INCOMPLETE' END,
      CASE WHEN NOT route_unique_passed THEN 'ROUTE_IDENTITY_COLLISION' END
    ],NULL)::text[] blocker_codes
  FROM evaluated e
)
SELECT s.*,
  cardinality(blocker_codes)=0 design_ready,
  CASE
    WHEN cardinality(blocker_codes)>0 THEN 'DESIGN_BLOCKED'
    WHEN implementation_present THEN 'VERIFIED'
    ELSE 'IMPLEMENTATION_PENDING'
  END executable_status,
  CASE
    WHEN cardinality(blocker_codes)>0
      THEN 'Resolve: '||array_to_string(blocker_codes,', ')
    WHEN NOT implementation_present
      THEN 'Generate implementation, run contract tests, and attach runtime evidence.'
    ELSE 'Design and implementation evidence are ready for release validation.'
  END next_action
FROM scored s;

COMMENT ON VIEW framework_executable_screen_design_gate IS
  'One fail-closed row per page design. DESIGN_BLOCKED, IMPLEMENTATION_PENDING, and VERIFIED are never conflated.';

CREATE OR REPLACE VIEW framework_screen_design_repair_queue_v2 AS
SELECT page_design_id,page_code,page_title,process_code,step_code,audience,
       actor_code,route_key,executable_status,blocker_codes,next_action,
       CASE
         WHEN 'IDENTITY_ACTOR_PROCESS_BINDING_MISSING'=ANY(blocker_codes) THEN 1
         WHEN 'ROUTE_IDENTITY_COLLISION'=ANY(blocker_codes) THEN 2
         WHEN 'BUSINESS_ENTRY_EXIT_CONTRACT_INCOMPLETE'=ANY(blocker_codes) THEN 3
         WHEN 'FIELD_API_PERMISSION_VALIDATION_CONTRACT_INCOMPLETE'=ANY(blocker_codes) THEN 4
         WHEN 'STATE_TRANSITION_INCOMPLETE'=ANY(blocker_codes) THEN 5
         WHEN 'CROSS_SCREEN_HANDOFF_INCOMPLETE'=ANY(blocker_codes) THEN 6
         WHEN 'AUTHORITY_NOT_VERIFIED'=ANY(blocker_codes) THEN 7
         WHEN 'EXCEPTION_RECOVERY_NOT_VERIFIED'=ANY(blocker_codes) THEN 8
         WHEN 'FIVE_SAFETY_TEST_TYPES_INCOMPLETE'=ANY(blocker_codes) THEN 9
         ELSE 10
       END repair_priority
FROM framework_executable_screen_design_gate
WHERE executable_status<>'VERIFIED';

CREATE OR REPLACE VIEW framework_vertical_screen_design_map AS
SELECT row_number() OVER (
         ORDER BY p.domain_code,p.process_code,s.step_order NULLS LAST,
                  g.audience,g.page_design_id
       ) global_sequence,
       g.page_design_id,g.page_code,g.page_title,g.process_code,
       p.process_name,s.step_order,g.step_code,s.step_name,g.audience,
       g.actor_code,g.route_key,g.executable_status,g.blocker_codes,g.next_action,
       lag(g.page_design_id) OVER (
         ORDER BY p.domain_code,p.process_code,s.step_order NULLS LAST,
                  g.audience,g.page_design_id
       ) previous_page_design_id,
       lead(g.page_design_id) OVER (
         ORDER BY p.domain_code,p.process_code,s.step_order NULLS LAST,
                  g.audience,g.page_design_id
       ) next_page_design_id
FROM framework_executable_screen_design_gate g
LEFT JOIN framework_process_definition p USING(process_code)
LEFT JOIN framework_process_step s
  ON s.process_code=g.process_code AND s.step_code=g.step_code;

CREATE OR REPLACE FUNCTION framework_audit_executable_screen_designs(
  requested_by varchar DEFAULT 'SYSTEM_EXECUTABLE_DESIGN_GATE'
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  result jsonb;
BEGIN
  WITH counts AS (
    SELECT count(*) total_count,
           count(*) FILTER (WHERE design_ready) design_ready_count,
           count(*) FILTER (WHERE executable_status='IMPLEMENTATION_PENDING') implementation_pending_count,
           count(*) FILTER (WHERE executable_status='VERIFIED') verified_count,
           count(*) FILTER (WHERE executable_status='DESIGN_BLOCKED') blocked_count
    FROM framework_executable_screen_design_gate
  ), blockers AS (
    SELECT coalesce(jsonb_object_agg(code,cnt),'{}'::jsonb) summary
    FROM (
      SELECT code,count(*) cnt
      FROM framework_executable_screen_design_gate g,
           unnest(g.blocker_codes) code
      GROUP BY code ORDER BY code
    ) x
  ), inserted AS (
    INSERT INTO framework_executable_design_audit_run(
      requested_by,total_count,design_ready_count,
      implementation_pending_count,verified_count,blocked_count,blocker_summary
    )
    SELECT requested_by,c.total_count,c.design_ready_count,
           c.implementation_pending_count,c.verified_count,c.blocked_count,b.summary
    FROM counts c CROSS JOIN blockers b
    RETURNING *
  )
  SELECT to_jsonb(inserted) INTO result FROM inserted;
  RETURN result;
END
$$;

SELECT framework_audit_executable_screen_designs('FLYWAY_EXECUTABLE_DESIGN_GATE');
