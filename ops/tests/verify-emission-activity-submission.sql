BEGIN;

DO $$
DECLARE
  project varchar(40);
  activity bigint;
  submission bigint;
  duplicate_count integer;
  foreign_scope_count integer;
BEGIN
  SELECT project_id INTO project FROM emission_project_registry ORDER BY project_id LIMIT 1;
  IF project IS NULL THEN RAISE EXCEPTION 'TEST_PROJECT_MISSING'; END IF;

  INSERT INTO emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note)
  VALUES(project,'자동검증 활동자료','전력','2026-01',1,'kWh','자동 테스트') RETURNING activity_id INTO activity;
  INSERT INTO emission_activity_submission(project_id,tenant_id,site_name,version_no,idempotency_key,deadline_date)
  SELECT project_id,'TEST_TENANT_A',site_name,999999,'TEST-IDEMPOTENCY',current_date+1 FROM emission_project_registry WHERE project_id=project
  RETURNING submission_id INTO submission;
  INSERT INTO emission_activity_submission_evidence(submission_id,activity_id,evidence_type,evidence_name,uploaded_actor)
  VALUES(submission,activity,'ACTIVITY_DATA','자동검증','TEST_ACTOR');
  UPDATE emission_activity_submission SET submission_state='SUBMITTED',submitted_actor='TEST_ACTOR',submitted_at=current_timestamp WHERE submission_id=submission;
  INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state)
  VALUES(submission,'SUBMITTED','TEST_ACTOR','DRAFT','SUBMITTED');

  SELECT count(*) INTO duplicate_count FROM emission_activity_submission
   WHERE tenant_id='TEST_TENANT_A' AND project_id=project AND idempotency_key='TEST-IDEMPOTENCY';
  SELECT count(*) INTO foreign_scope_count FROM emission_activity_submission
   WHERE tenant_id='TEST_TENANT_B' AND submission_id=submission;
  IF duplicate_count<>1 THEN RAISE EXCEPTION 'IDEMPOTENCY_FAILED'; END IF;
  IF foreign_scope_count<>0 THEN RAISE EXCEPTION 'TENANT_ISOLATION_FAILED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM emission_activity_submission_event WHERE submission_id=submission AND previous_state='DRAFT' AND new_state='SUBMITTED') THEN
    RAISE EXCEPTION 'AUDIT_TRANSITION_MISSING';
  END IF;
END $$;

ROLLBACK;
