CREATE TABLE IF NOT EXISTS framework_project_completion_run (
  run_id uuid PRIMARY KEY,
  run_status varchar(30) NOT NULL DEFAULT 'RUNNING',
  selected_process_count integer NOT NULL DEFAULT 0,
  executable_job_count integer NOT NULL DEFAULT 0,
  retried_job_count integer NOT NULL DEFAULT 0,
  completed_process_count integer NOT NULL DEFAULT 0,
  blocked_process_count integer NOT NULL DEFAULT 0,
  result_json text NOT NULL DEFAULT '{}',
  started_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_project_completion_run_started
  ON framework_project_completion_run(started_at DESC);

CREATE OR REPLACE VIEW framework_process_delivery_queue AS
WITH s AS (SELECT process_code,count(*) step_count,count(*) FILTER(WHERE nullif(actor_code,'') IS NOT NULL) actor_bound_steps FROM framework_process_step GROUP BY process_code),
t AS (SELECT process_code,count(*) test_count,count(DISTINCT case_type) test_type_count,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED')) passed_tests FROM framework_simulation_case c GROUP BY process_code),
j AS (SELECT process_code,count(*) FILTER(WHERE required) required_tasks,count(*) FILTER(WHERE required AND job_status IN('COMPLETED','VERIFIED') AND quality_status IN('PASSED','VERIFIED')) completed_tasks,count(*) FILTER(WHERE required AND job_status IN('FAILED','BLOCKED')) blocked_tasks FROM framework_development_job GROUP BY process_code),
a AS (SELECT process_code,count(*) FILTER(WHERE required) required_artifacts,count(*) FILTER(WHERE required AND delivery_status='VERIFIED') verified_artifacts FROM framework_process_artifact GROUP BY process_code),
c AS (SELECT process_code,count(*) screen_contracts,count(*) FILTER(WHERE readiness_score=100) ready_screens FROM framework_professional_screen_readiness GROUP BY process_code),
b AS (SELECT p.process_code,p.process_name,p.domain_code,p.development_order,p.process_status,
 coalesce(s.step_count,0) step_count,coalesce(s.actor_bound_steps,0) actor_bound_steps,
 coalesce(t.test_count,0) test_count,coalesce(t.test_type_count,0) test_type_count,coalesce(t.passed_tests,0) passed_tests,
 coalesce(j.required_tasks,0) required_tasks,coalesce(j.completed_tasks,0) completed_tasks,coalesce(j.blocked_tasks,0) blocked_tasks,
 coalesce(a.required_artifacts,0) required_artifacts,coalesce(a.verified_artifacts,0) verified_artifacts,
 coalesce(c.screen_contracts,0) screen_contracts,coalesce(c.ready_screens,0) ready_screens
 FROM framework_process_definition p LEFT JOIN s USING(process_code) LEFT JOIN t USING(process_code) LEFT JOIN j USING(process_code) LEFT JOIN a USING(process_code) LEFT JOIN c USING(process_code))
SELECT b.*,
 least(100,round((CASE WHEN step_count>0 THEN actor_bound_steps::numeric/step_count ELSE 0 END)*15+(CASE WHEN test_type_count>=5 THEN 15 ELSE test_type_count::numeric/5*15 END)+(CASE WHEN test_count>0 THEN passed_tests::numeric/test_count ELSE 0 END)*20+(CASE WHEN required_tasks>0 THEN completed_tasks::numeric/required_tasks ELSE 0 END)*20+(CASE WHEN required_artifacts>0 THEN verified_artifacts::numeric/required_artifacts ELSE 0 END)*15+(CASE WHEN screen_contracts>0 THEN ready_screens::numeric/screen_contracts ELSE 0 END)*15))::integer completion_score,
 CASE WHEN step_count=0 THEN 'DEFINE_STEPS' WHEN actor_bound_steps<step_count THEN 'BIND_ACTORS' WHEN test_type_count<5 THEN 'DESIGN_TESTS' WHEN passed_tests<test_count THEN 'RUN_TESTS' WHEN required_tasks=0 THEN 'GENERATE_TASKS' WHEN blocked_tasks>0 THEN 'RECOVER_BLOCKED_TASKS' WHEN completed_tasks<required_tasks THEN 'EXECUTE_TASKS' WHEN required_artifacts=0 THEN 'DEFINE_ARTIFACTS' WHEN verified_artifacts<required_artifacts THEN 'VERIFY_ARTIFACTS' WHEN screen_contracts=0 THEN 'DEFINE_SCREENS' WHEN ready_screens<screen_contracts THEN 'COMPLETE_SCREENS' ELSE 'COMPLETE' END next_action,
 CASE WHEN blocked_tasks>0 OR step_count=0 THEN 'BLOCKER' WHEN test_type_count<5 OR actor_bound_steps<step_count THEN 'HIGH' WHEN completed_tasks<required_tasks OR verified_artifacts<required_artifacts THEN 'MEDIUM' WHEN ready_screens<screen_contracts THEN 'LOW' ELSE 'DONE' END priority
FROM b;

CREATE OR REPLACE VIEW framework_process_delivery_priority_queue AS
SELECT q.*,CASE WHEN q.next_action='COMPLETE' THEN 'DONE' WHEN q.blocked_tasks>0 OR q.step_count=0 THEN 'BLOCKER' WHEN q.test_type_count<5 OR q.actor_bound_steps<q.step_count THEN 'HIGH' WHEN q.required_tasks=0 OR q.passed_tests<q.test_count THEN 'HIGH' WHEN q.completed_tasks<q.required_tasks OR q.required_artifacts=0 OR q.verified_artifacts<q.required_artifacts THEN 'MEDIUM' WHEN q.screen_contracts=0 OR q.ready_screens<q.screen_contracts THEN 'LOW' ELSE 'HIGH' END delivery_priority
FROM framework_process_delivery_queue q;

COMMENT ON TABLE framework_project_completion_run IS '설계부터 검증 완료까지 자동 완성 오케스트레이터 실행 기록';
