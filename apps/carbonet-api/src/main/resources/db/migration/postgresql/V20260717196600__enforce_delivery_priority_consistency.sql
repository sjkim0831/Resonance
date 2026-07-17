CREATE OR REPLACE VIEW framework_process_delivery_priority_queue AS
SELECT q.*,
       CASE
         WHEN q.next_action = 'COMPLETE' THEN 'DONE'
         WHEN q.blocked_tasks > 0 OR q.step_count = 0 THEN 'BLOCKER'
         WHEN q.test_type_count < 5 OR q.actor_bound_steps < q.step_count THEN 'HIGH'
         WHEN q.required_tasks = 0 OR q.passed_tests < q.test_count THEN 'HIGH'
         WHEN q.completed_tasks < q.required_tasks OR q.required_artifacts = 0 OR q.verified_artifacts < q.required_artifacts THEN 'MEDIUM'
         WHEN q.screen_contracts = 0 OR q.ready_screens < q.screen_contracts THEN 'LOW'
         ELSE 'HIGH'
       END AS delivery_priority
  FROM framework_process_delivery_queue q;

COMMENT ON VIEW framework_process_delivery_priority_queue IS
  'Consistent delivery priority: DONE is possible only when the unified next action is COMPLETE.';
