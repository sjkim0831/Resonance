CREATE OR REPLACE VIEW framework_page_design_assurance AS
WITH binding AS (
  SELECT b.screen_resource_id,
         count(*) FILTER (WHERE b.binding_status='ACTIVE') binding_count,
         count(DISTINCT b.actor_code) FILTER (WHERE b.binding_status='ACTIVE' AND trim(coalesce(b.actor_code,''))<>'') actor_count,
         count(DISTINCT (b.process_code,b.step_code)) FILTER (WHERE b.binding_status='ACTIVE') process_step_count,
         count(*) FILTER (WHERE b.binding_status='ACTIVE' AND b.audience='USER') user_binding_count
  FROM framework_process_step_screen_binding b GROUP BY b.screen_resource_id
), contract AS (
  SELECT r.screen_resource_id,
         count(c.contract_id) contract_count,
         count(c.contract_id) FILTER (WHERE length(trim(c.business_purpose))>=20
           AND length(trim(c.entry_condition))>=10 AND length(trim(c.exit_condition))>=10
           AND c.section_contract<>'[]' AND c.field_contract<>'[]' AND c.command_contract<>'[]') semantic_count,
         bool_and(c.authority_verified) authority_verified,
         bool_and(c.exception_states_verified AND c.state_contract LIKE '%ERROR%' AND c.state_contract LIKE '%FORBIDDEN%') exception_verified,
         bool_and(c.audit_evidence_ref<>'' AND (c.data_contract ILIKE '%version%' OR c.evidence_contract ILIKE '%version%')) version_verified
  FROM framework_screen_resource r
  LEFT JOIN framework_professional_screen_contract c
    ON lower(split_part(c.route_path,'?',1))=r.route_key
  GROUP BY r.screen_resource_id
), transition_gate AS (
  SELECT b.screen_resource_id,
         bool_and(trim(coalesce(s.from_state,''))<>'' AND trim(coalesce(s.to_state,''))<>''
           AND trim(coalesce(s.command_code,''))<>'' AND trim(coalesce(s.completion_rule,''))<>'') transition_verified,
         bool_and(NOT s.requires_admin_page OR EXISTS(
           SELECT 1 FROM framework_process_step_screen_binding admin_binding
           WHERE admin_binding.process_code=b.process_code AND admin_binding.step_code=b.step_code
             AND admin_binding.audience='ADMIN' AND admin_binding.binding_status='ACTIVE')) admin_counterpart_verified
  FROM framework_process_step_screen_binding b
  JOIN framework_process_step s USING(process_code,step_code)
  WHERE b.binding_status='ACTIVE'
  GROUP BY b.screen_resource_id
), lineage_gate AS (
  SELECT d.screen_resource_id,count(*) field_count,
         bool_and(trim(coalesce(d.api_property,''))<>'' AND trim(coalesce(d.source_table,''))<>''
           AND trim(coalesce(d.source_column,''))<>'' AND d.lineage_status IN('VERIFIED','CONNECTED')) lineage_verified
  FROM framework_screen_data_binding d GROUP BY d.screen_resource_id
), test_gate AS (
  SELECT b.screen_resource_id,count(DISTINCT t.case_code) test_count,count(DISTINCT t.case_type) test_type_count
  FROM framework_process_step_screen_binding b
  JOIN framework_step_test_binding x ON x.process_code=b.process_code AND x.step_code=b.step_code
  JOIN framework_simulation_case t ON t.case_code=x.case_code AND t.case_status IN('VERIFIED','APPROVED','ACTIVE')
  WHERE b.binding_status='ACTIVE' GROUP BY b.screen_resource_id
), evaluated AS (
  SELECT r.screen_resource_id,
    coalesce(b.binding_count,0)>0 AND coalesce(b.actor_count,0)>0 actor_passed,
    coalesce(b.process_step_count,0)>0 process_passed,
    coalesce(c.contract_count,0)>=coalesce(b.binding_count,0) AND coalesce(c.semantic_count,0)>=coalesce(b.binding_count,0) contract_passed,
    coalesce(l.field_count,0)>0 AND coalesce(l.lineage_verified,false) lineage_passed,
    coalesce(tg.transition_verified,false) transition_passed,
    coalesce(c.authority_verified,false) authority_passed,
    coalesce(c.version_verified,false) version_passed,
    coalesce(c.exception_verified,false) exception_passed,
    coalesce(tg.admin_counterpart_verified,true) admin_counterpart_passed,
    coalesce(test.test_count,0)>=3 AND coalesce(test.test_type_count,0)>=3 test_passed,
    coalesce(test.test_count,0) test_count,coalesce(l.field_count,0) field_count
  FROM framework_screen_resource r
  LEFT JOIN binding b USING(screen_resource_id)
  LEFT JOIN contract c USING(screen_resource_id)
  LEFT JOIN transition_gate tg USING(screen_resource_id)
  LEFT JOIN lineage_gate l USING(screen_resource_id)
  LEFT JOIN test_gate test USING(screen_resource_id)
)
SELECT e.*,
  ((actor_passed::int+process_passed::int+contract_passed::int+lineage_passed::int+transition_passed::int+
    authority_passed::int+version_passed::int+exception_passed::int+admin_counterpart_passed::int+test_passed::int)*10) design_gate_score,
  CASE WHEN actor_passed AND process_passed AND contract_passed AND lineage_passed AND transition_passed
    AND authority_passed AND version_passed AND exception_passed AND admin_counterpart_passed AND test_passed
    THEN 'PASSED' ELSE 'FAILED' END design_gate_status,
  array_remove(ARRAY[
    CASE WHEN NOT actor_passed THEN 'ACTOR_BINDING_MISSING' END,
    CASE WHEN NOT process_passed THEN 'PROCESS_STEP_MISSING' END,
    CASE WHEN NOT contract_passed THEN 'PROFESSIONAL_CONTRACT_INCOMPLETE' END,
    CASE WHEN NOT lineage_passed THEN 'INPUT_OUTPUT_LINEAGE_INCOMPLETE' END,
    CASE WHEN NOT transition_passed THEN 'STATE_TRANSITION_INCOMPLETE' END,
    CASE WHEN NOT authority_passed THEN 'AUTHORITY_NOT_VERIFIED' END,
    CASE WHEN NOT version_passed THEN 'VERSION_AUDIT_CONTRACT_MISSING' END,
    CASE WHEN NOT exception_passed THEN 'EXCEPTION_RECOVERY_NOT_VERIFIED' END,
    CASE WHEN NOT admin_counterpart_passed THEN 'ADMIN_COUNTERPART_MISSING' END,
    CASE WHEN NOT test_passed THEN 'INDEPENDENT_TEST_COVERAGE_INCOMPLETE' END
  ],NULL)::text[] design_gate_issues
FROM evaluated e;

COMMENT ON VIEW framework_page_design_assurance IS
  'Fail-closed design gate. A page is generation-ready only when all ten actor, process, contract, lineage, transition, authority, version, exception, admin and independent-test checks pass.';

CREATE OR REPLACE VIEW framework_page_development_master AS
SELECT i.item_id,i.plan_code,i.sequence_no,i.priority_score,i.manual_lock,
  r.screen_resource_id,r.route_key,r.screen_name,r.screen_type,r.implementation_status,r.source_ref,
  i.design_status,i.frontend_status,i.backend_status,i.test_status,i.deployment_status,
  i.menu_code,i.menu_name,i.menu_status,i.permission_code,i.permission_name,i.permission_status,
  i.blocker_reason,i.next_action,i.updated_at,
  coalesce(q.professional_score,0) quality_score,coalesce(q.customer_readiness,'IMPLEMENTATION_REQUIRED') customer_readiness,
  coalesce((SELECT string_agg(DISTINCT b.actor_code,', ' ORDER BY b.actor_code) FROM framework_process_step_screen_binding b WHERE b.screen_resource_id=r.screen_resource_id AND b.binding_status='ACTIVE'),'') actor_codes,
  coalesce((SELECT string_agg(DISTINCT b.process_code,', ' ORDER BY b.process_code) FROM framework_process_step_screen_binding b WHERE b.screen_resource_id=r.screen_resource_id AND b.binding_status='ACTIVE'),'') process_codes,
  coalesce((SELECT count(DISTINCT (b.process_code,b.step_code)) FROM framework_process_step_screen_binding b WHERE b.screen_resource_id=r.screen_resource_id AND b.binding_status='ACTIVE'),0) process_step_count,
  coalesce((SELECT count(*) FROM framework_screen_capability c WHERE c.screen_resource_id=r.screen_resource_id),0) capability_count,
  coalesce((SELECT count(*) FROM framework_screen_data_binding d WHERE d.screen_resource_id=r.screen_resource_id),0) field_count,
  coalesce(g.design_gate_score,0) design_gate_score,coalesce(g.design_gate_status,'FAILED') design_gate_status,
  coalesce(g.design_gate_issues,ARRAY['DESIGN_GATE_NOT_EVALUATED']::text[]) design_gate_issues
FROM framework_page_development_item i
JOIN framework_screen_resource r USING(screen_resource_id)
LEFT JOIN framework_screen_professional_quality q USING(screen_resource_id)
LEFT JOIN framework_page_design_assurance g USING(screen_resource_id);

UPDATE framework_page_development_item i
SET design_status=CASE WHEN g.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
    blocker_reason=CASE WHEN g.design_gate_status='PASSED' THEN NULL ELSE array_to_string(g.design_gate_issues,', ') END,
    next_action=CASE WHEN g.design_gate_status='PASSED' THEN 'Design gate passed; implementation may proceed.'
      ELSE 'Resolve design gate issues before generation: '||array_to_string(g.design_gate_issues,', ') END,
    updated_by='DESIGN_ASSURANCE_GATE',updated_at=current_timestamp
FROM framework_page_design_assurance g WHERE g.screen_resource_id=i.screen_resource_id;
