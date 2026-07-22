CREATE OR REPLACE VIEW framework_process_delivery_priority_queue AS
SELECT
  q.process_code,
  q.process_name,
  q.domain_code,
  q.development_order,
  q.process_status,
  q.step_count,
  q.actor_bound_steps,
  q.test_count,
  q.test_type_count,
  q.passed_tests,
  q.required_tasks,
  q.completed_tasks,
  (q.blocked_tasks + coalesce(d.design_blocker_count,0))::bigint AS blocked_tasks,
  q.required_artifacts,
  q.verified_artifacts,
  q.screen_contracts,
  q.ready_screens,
  least(q.completion_score,coalesce(d.design_accuracy_score,q.completion_score))::integer AS completion_score,
  CASE
    WHEN coalesce(d.design_blocker_count,0)>0 THEN 'REPAIR_DESIGN'
    ELSE q.next_action
  END AS next_action,
  CASE
    WHEN coalesce(d.design_blocker_count,0)>0 THEN 'BLOCKER'
    ELSE q.priority
  END AS priority,
  CASE
    WHEN q.next_action='COMPLETE' AND coalesce(d.design_blocker_count,0)=0 THEN 'DONE'
    WHEN coalesce(d.design_blocker_count,0)>0 OR q.blocked_tasks>0 OR q.step_count=0 THEN 'BLOCKER'
    WHEN q.test_type_count<5 OR q.actor_bound_steps<q.step_count THEN 'HIGH'
    WHEN q.required_tasks=0 OR q.passed_tests<q.test_count THEN 'HIGH'
    WHEN q.completed_tasks<q.required_tasks OR q.required_artifacts=0 OR q.verified_artifacts<q.required_artifacts THEN 'MEDIUM'
    WHEN q.screen_contracts=0 OR q.ready_screens<q.screen_contracts THEN 'LOW'
    ELSE 'HIGH'
  END AS delivery_priority,
  coalesce(d.design_blocker_count,0)::integer AS design_blocker_count,
  coalesce(d.design_accuracy_score,0)::integer AS design_accuracy_score,
  coalesce(d.assurance_status,'NOT_ASSESSED')::varchar(40) AS design_assurance_status,
  coalesce(d.next_action,'ASSESS_DESIGN')::varchar(80) AS design_next_action
FROM framework_process_delivery_queue q
LEFT JOIN framework_process_design_assurance_matrix d USING(process_code);

COMMENT ON VIEW framework_process_delivery_priority_queue IS
  'Delivery priority is fail-closed against actor/process design assurance. Test and implementation work cannot precede unresolved state, API, data, screen, authority, or safety-test contracts.';

DO $$
DECLARE account_row record;
BEGIN
  SELECT * INTO account_row
  FROM framework_process_delivery_priority_queue
  WHERE process_code='ACCOUNT_LOCK_RECOVERY';

  IF account_row.process_code IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY_PRIORITY_MISSING';
  END IF;
  IF account_row.design_blocker_count<=0
     OR account_row.blocked_tasks<account_row.design_blocker_count
     OR account_row.next_action<>'REPAIR_DESIGN'
     OR account_row.delivery_priority<>'BLOCKER' THEN
    RAISE EXCEPTION 'DESIGN_ASSURANCE_PRIORITY_NOT_FAIL_CLOSED row=%',row_to_json(account_row);
  END IF;
  IF EXISTS (
    SELECT 1 FROM framework_process_delivery_priority_queue
    WHERE next_action='COMPLETE' AND (design_blocker_count>0 OR delivery_priority<>'DONE')
  ) THEN
    RAISE EXCEPTION 'COMPLETE_PROCESS_HAS_UNRESOLVED_DESIGN_BLOCKER';
  END IF;
END $$;
