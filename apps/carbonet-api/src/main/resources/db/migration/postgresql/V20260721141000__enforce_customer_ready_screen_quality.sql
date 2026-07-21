CREATE OR REPLACE VIEW framework_screen_professional_quality AS
WITH binding_stats AS (
  SELECT screen_resource_id,count(DISTINCT binding_id)::integer binding_count,
    count(DISTINCT process_code)::integer process_count,
    count(DISTINCT actor_code) FILTER(WHERE nullif(actor_code,'') IS NOT NULL)::integer actor_count
  FROM framework_process_step_screen_binding WHERE binding_status='ACTIVE' GROUP BY screen_resource_id
), capability_stats AS (
  SELECT screen_resource_id,count(*)::integer capability_count FROM framework_screen_capability GROUP BY screen_resource_id
), data_stats AS (
  SELECT screen_resource_id,count(DISTINCT data_element_code)::integer data_element_count,
    count(DISTINCT data_element_code) FILTER(WHERE lineage_status IN
      ('DB_RESOLVED','IMPLEMENTATION_VERIFIED'))::integer resolved_data_count
  FROM framework_screen_data_binding GROUP BY screen_resource_id
), transition_stats AS (
  SELECT binding.screen_resource_id,count(DISTINCT transition.transition_id)::integer transition_count
  FROM framework_process_step_screen_binding binding JOIN framework_state_transition_contract transition
    ON transition.process_code=binding.process_code AND transition.step_code=binding.step_code
  WHERE binding.binding_status='ACTIVE' GROUP BY binding.screen_resource_id
), test_stats AS (
  SELECT binding.screen_resource_id,count(DISTINCT test.case_code)::integer test_count,
    count(DISTINCT simulation.case_type) FILTER(WHERE simulation.case_type IN
      ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'))::integer safety_family_count
  FROM framework_process_step_screen_binding binding JOIN framework_step_test_binding test
    ON test.process_code=binding.process_code AND test.step_code=binding.step_code
  LEFT JOIN framework_simulation_case simulation ON simulation.case_code=test.case_code
  WHERE binding.binding_status='ACTIVE' GROUP BY binding.screen_resource_id
), task_stats AS (
  SELECT binding.screen_resource_id,count(DISTINCT task.task_id)::integer actual_task_count
  FROM framework_process_step_screen_binding binding JOIN emission_project_task task
    ON task.process_code=binding.process_code AND task.process_step_code=binding.step_code
  WHERE binding.binding_status='ACTIVE' GROUP BY binding.screen_resource_id
), screen_contract AS (
  SELECT resource.screen_resource_id,resource.route_key,resource.screen_name,resource.implementation_status,
    coalesce(binding.binding_count,0) binding_count,coalesce(binding.process_count,0) process_count,
    coalesce(binding.actor_count,0) actor_count,coalesce(capability.capability_count,0) capability_count,
    coalesce(data_contract.data_element_count,0) data_element_count,
    coalesce(data_contract.resolved_data_count,0) resolved_data_count,
    coalesce(transition.transition_count,0) transition_count,coalesce(test.test_count,0) test_count,
    coalesce(test.safety_family_count,0) safety_family_count,coalesce(task.actual_task_count,0) actual_task_count
  FROM framework_screen_resource resource
  LEFT JOIN binding_stats binding USING(screen_resource_id)
  LEFT JOIN capability_stats capability USING(screen_resource_id)
  LEFT JOIN data_stats data_contract USING(screen_resource_id)
  LEFT JOIN transition_stats transition USING(screen_resource_id)
  LEFT JOIN test_stats test USING(screen_resource_id)
  LEFT JOIN task_stats task USING(screen_resource_id)
), scored AS (
  SELECT contract.*,
    CASE WHEN binding_count>0 AND actor_count>0 AND capability_count>0 THEN 20 ELSE 0 END AS structure_score,
    CASE WHEN data_element_count>0 AND resolved_data_count=data_element_count THEN 20
         WHEN data_element_count>0 AND resolved_data_count>0 THEN 10 ELSE 0 END AS data_score,
    CASE WHEN implementation_status='VERIFIED' THEN 20
         WHEN implementation_status='IMPLEMENTED' THEN 15 ELSE 0 END AS implementation_score,
    CASE WHEN transition_count>0 THEN 20 ELSE 0 END AS workflow_score,
    CASE WHEN test_count>0 AND safety_family_count>=5 THEN 20
         WHEN test_count>0 THEN 10 ELSE 0 END AS test_score
  FROM screen_contract contract
)
SELECT scored.*,
  (structure_score+data_score+implementation_score+workflow_score+test_score)::integer professional_score,
  array_remove(ARRAY[
    CASE WHEN binding_count=0 THEN 'PROCESS_BINDING_MISSING' END,
    CASE WHEN actor_count=0 THEN 'ACTOR_MISSING' END,
    CASE WHEN capability_count=0 THEN 'CAPABILITY_MISSING' END,
    CASE WHEN data_element_count=0 THEN 'DATA_CONTRACT_MISSING' END,
    CASE WHEN data_element_count>0 AND resolved_data_count<data_element_count THEN 'DB_LINEAGE_INCOMPLETE' END,
    CASE WHEN implementation_status='DESIGN_ONLY' THEN 'IMPLEMENTATION_MISSING' END,
    CASE WHEN transition_count=0 THEN 'WORKFLOW_TRANSITION_MISSING' END,
    CASE WHEN test_count=0 THEN 'TEST_MISSING' END,
    CASE WHEN test_count>0 AND safety_family_count<5 THEN 'SAFETY_TEST_INCOMPLETE' END
  ],NULL) gap_codes,
  CASE WHEN structure_score=20 AND data_score=20 AND implementation_score>=15
    AND workflow_score=20 AND test_score=20 THEN 'CUSTOMER_READY'
    WHEN implementation_status='DESIGN_ONLY' THEN 'IMPLEMENTATION_REQUIRED'
    ELSE 'CONTRACT_REPAIR_REQUIRED' END AS customer_readiness
FROM scored;

CREATE OR REPLACE VIEW framework_screen_professional_repair_queue AS
SELECT quality.screen_resource_id,quality.route_key,quality.screen_name,quality.implementation_status,
  quality.professional_score,quality.customer_readiness,quality.gap_codes,
  CASE
    WHEN 'PROCESS_BINDING_MISSING'=ANY(quality.gap_codes) THEN 'PROCESS_BINDING'
    WHEN 'CAPABILITY_MISSING'=ANY(quality.gap_codes) THEN 'CAPABILITY_CONTRACT'
    WHEN 'DATA_CONTRACT_MISSING'=ANY(quality.gap_codes) OR 'DB_LINEAGE_INCOMPLETE'=ANY(quality.gap_codes) THEN 'DATA_LINEAGE'
    WHEN 'IMPLEMENTATION_MISSING'=ANY(quality.gap_codes) THEN 'SCREEN_IMPLEMENTATION'
    WHEN 'WORKFLOW_TRANSITION_MISSING'=ANY(quality.gap_codes) THEN 'WORKFLOW_CONTRACT'
    ELSE 'TEST_AUTOMATION' END AS next_job_type,
  CASE WHEN quality.implementation_status<>'DESIGN_ONLY' THEN 1 ELSE 2 END AS repair_priority
FROM framework_screen_professional_quality quality
WHERE quality.customer_readiness<>'CUSTOMER_READY'
ORDER BY repair_priority,quality.professional_score,quality.route_key;

CREATE OR REPLACE VIEW framework_screen_professional_quality_summary AS
SELECT count(*)::integer screen_count,
  count(*) FILTER(WHERE customer_readiness='CUSTOMER_READY')::integer customer_ready_count,
  count(*) FILTER(WHERE customer_readiness='CONTRACT_REPAIR_REQUIRED')::integer contract_repair_count,
  count(*) FILTER(WHERE customer_readiness='IMPLEMENTATION_REQUIRED')::integer implementation_required_count,
  round(avg(professional_score),1) average_score,
  count(*) FILTER(WHERE 'DB_LINEAGE_INCOMPLETE'=ANY(gap_codes))::integer data_lineage_gap_count,
  count(*) FILTER(WHERE 'TEST_MISSING'=ANY(gap_codes) OR 'SAFETY_TEST_INCOMPLETE'=ANY(gap_codes))::integer test_gap_count
FROM framework_screen_professional_quality;

COMMENT ON VIEW framework_screen_professional_quality IS
  'Fail-closed customer readiness gate: structure, complete DB lineage, implementation, workflow and five safety test families.';
