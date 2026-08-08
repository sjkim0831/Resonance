CREATE OR REPLACE VIEW framework_qa_process_case_catalog AS
WITH bound AS (
  SELECT step.process_code,step.step_code,step.step_order,step.step_name,
         test.case_code,test.case_name,test.case_type,test.preconditions,
         test.steps_json,test.assertions_json,test.case_status,test.automated,
         binding.screen_resource_id,binding.audience,
         row_number() OVER(PARTITION BY step.process_code,step.step_code,test.case_code
                           ORDER BY CASE binding.entry_mode WHEN 'PRIMARY' THEN 0 ELSE 1 END,
                                    CASE binding.audience WHEN 'USER' THEN 0 WHEN 'PUBLIC' THEN 1 ELSE 2 END,
                                    binding.screen_resource_id) binding_rank,
         (select count(distinct reuse_binding.step_code) from framework_step_test_binding reuse_binding
           where reuse_binding.process_code=test.process_code and reuse_binding.case_code=test.case_code) reuse_count
    FROM framework_process_step step
    JOIN framework_step_test_binding test_binding
      ON test_binding.process_code=step.process_code AND test_binding.step_code=step.step_code
    JOIN framework_simulation_case test ON test.case_code=test_binding.case_code
    LEFT JOIN framework_process_step_screen_binding binding
      ON binding.process_code=step.process_code AND binding.step_code=step.step_code
     AND binding.binding_status='ACTIVE'
)
SELECT bound.process_code,bound.step_code,bound.step_order,bound.step_name,
       bound.case_code,bound.case_name,bound.case_type,bound.preconditions,bound.steps_json,bound.assertions_json,
       bound.case_status,bound.automated,bound.screen_resource_id,bound.audience,bound.binding_rank,
       screen.route_key,screen.screen_name,master.item_id,
       fixture.test_case_id,fixture.capability_code,
       coalesce(fixture.pre_input_json,jsonb_build_object('caseType',bound.case_type,'preconditions',bound.preconditions,'actions',bound.steps_json)) pre_input_json,
       coalesce(fixture.expected_result,case when bound.case_type='HAPPY_PATH' then 'PASSED' else 'BLOCKED' end)::varchar(24) expected_result,
       fixture.expected_state,
       coalesce(fixture.expected_output_json,jsonb_build_object('assertions',bound.assertions_json)) expected_output_json,
       coalesce(fixture.action_sequence_json,bound.steps_json::jsonb) action_sequence_json,
       coalesce(nullif(fixture.case_description,''),bound.preconditions)::varchar(1000) case_description,
       case when bound.reuse_count>1 then 'PROCESS_REUSED' else 'STEP_SPECIFIC' end case_origin,
       bound.reuse_count
  FROM bound
  LEFT JOIN framework_screen_resource screen USING(screen_resource_id)
  LEFT JOIN framework_page_development_master master USING(screen_resource_id)
  LEFT JOIN LATERAL (
    SELECT fixture.* FROM framework_screen_workflow_test_case fixture
     WHERE fixture.screen_resource_id=bound.screen_resource_id
       AND fixture.process_code=bound.process_code AND fixture.step_code=bound.step_code
       AND fixture.case_type=bound.case_type AND fixture.active=true
     ORDER BY fixture.updated_at DESC,fixture.test_case_id DESC LIMIT 1
  ) fixture ON true
 WHERE binding_rank=1;

COMMENT ON VIEW framework_qa_process_case_catalog IS
  'AI-independent process QA catalog with scenario defaults and reuse origin.';

DO $$
DECLARE total_count integer; independent_count integer; reused_count integer;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE case_origin='STEP_SPECIFIC'),count(*) FILTER(WHERE case_origin='PROCESS_REUSED')
    INTO total_count,independent_count,reused_count FROM framework_qa_process_case_catalog WHERE process_code='MEMBER_REGISTRATION';
  IF total_count<>30 OR independent_count<>10 OR reused_count<>20 THEN
    RAISE EXCEPTION 'MEMBER_QA_CATALOG_CLASSIFICATION_INVALID total=% independent=% reused=%',total_count,independent_count,reused_count;
  END IF;
END $$;
