DO $test$
DECLARE
  baseline_current bigint;
  legacy_outside bigint;
  linked_count bigint;
  changed_legacy bigint;
  v_batch_id uuid;
  v_failed_batch_id uuid;
  passed_count integer;
  blocked_count integer;
  staged_ids bigint[];
  fixture_run_base bigint;
  sequence_start bigint;
  target_total bigint;
  v_page_size integer:=500;
  page_number integer;
  page_offset integer;
  page_target_count integer;
  receipt jsonb;
  rejected boolean;
BEGIN
  SELECT last_value INTO sequence_start FROM framework_screen_workflow_test_run_run_id_seq;
  INSERT INTO framework_runtime_release_state(
    release_key,source_commit,deployment_namespace,deployment_name,deployment_uid,
    deployment_generation,observed_generation,desired_replicas,image_ref,image_id,
    health_status,recorded_by
  ) VALUES (
    'CARBONET_RUNTIME',repeat('a',40),'mutation-test','carbonet-api','mutation-test-uid',
    1,1,1,'carbonet-api:mutation-test','sha256:'||repeat('b',64),'UP','BATCH_MUTATION_TEST'
  ) ON CONFLICT (release_key) DO NOTHING;
  IF to_regclass('framework_screen_workflow_audit_batch') IS NULL
     OR to_regclass('framework_screen_workflow_audit_batch_page') IS NULL
     OR to_regclass('framework_screen_workflow_audit_batch_target') IS NULL
     OR to_regclass('framework_screen_workflow_audit_incident_run') IS NULL THEN
    RAISE EXCEPTION 'audit batch schema table drift';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conname IN (
        'fk_screen_workflow_test_run_audit_batch','uq_screen_workflow_audit_batch_target_key',
        'uq_screen_workflow_audit_incident_run'))<>3 THEN
    RAISE EXCEPTION 'audit batch FK/unique constraint drift';
  END IF;
  IF (SELECT count(*) FROM pg_indexes WHERE indexname IN (
        'uq_screen_workflow_test_run_batch_ordinal','uq_screen_workflow_test_run_batch_target')
        AND indexdef LIKE 'CREATE UNIQUE INDEX%')<>2 THEN
    RAISE EXCEPTION 'audit batch unique index drift';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema=current_schema() AND table_name='framework_screen_workflow_test_run'
         AND column_name IN ('audit_batch_id','audit_source_commit','audit_runtime_identity_hash',
                             'audit_page_number','audit_target_ordinal','audit_target_key'))<>6 THEN
    RAISE EXCEPTION 'audit run provenance column drift';
  END IF;
  SELECT count(*) INTO baseline_current FROM framework_current_screen_workflow_test_run;
  SELECT count(*) INTO linked_count FROM framework_screen_workflow_audit_incident_run
   WHERE incident_id='UNBOUND-HOURLY-20260811-700681-702430';
  IF linked_count<>1750 THEN RAISE EXCEPTION 'expected 1750 incident links, got %',linked_count; END IF;
  SELECT count(*) INTO changed_legacy FROM framework_screen_workflow_test_run
   WHERE run_id BETWEEN 700681 AND 702430 AND (
     audit_batch_id IS NOT NULL OR audit_source_commit IS NOT NULL OR audit_runtime_identity_hash IS NOT NULL
     OR audit_page_number IS NOT NULL OR audit_target_ordinal IS NOT NULL OR audit_target_key IS NOT NULL
   );
  IF changed_legacy<>0 THEN RAISE EXCEPTION 'historical 1750 provenance was rewritten'; END IF;
  SELECT count(*) INTO legacy_outside FROM framework_screen_workflow_test_run run
   WHERE run.audit_batch_id IS NULL AND NOT EXISTS (
     SELECT 1 FROM framework_screen_workflow_audit_incident_run link WHERE link.run_id=run.run_id
   );
  IF legacy_outside<>baseline_current THEN RAISE EXCEPTION 'nonincident legacy visibility changed'; END IF;

  v_batch_id:=(framework_start_screen_workflow_audit_batch('BATCH_MUTATION_TEST',v_page_size)->>'auditBatchId')::uuid;
  fixture_run_base:=-(1000000000000000000+(('x'||substr(md5(v_batch_id::text),1,15))::bit(60)::bigint));
  SELECT expected_target_count INTO target_total FROM framework_screen_workflow_audit_batch WHERE audit_batch_id=v_batch_id;
  IF (SELECT count(*) FROM framework_screen_workflow_audit_batch_target WHERE audit_batch_id=v_batch_id)<>target_total THEN
    RAISE EXCEPTION 'canonical target snapshot count drift';
  END IF;
  rejected:=false;
  BEGIN
    DELETE FROM framework_screen_workflow_audit_batch_target
     WHERE audit_batch_id=v_batch_id AND target_ordinal=0;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'canonical target snapshot deletion was accepted'; END IF;

  rejected:=false;
  BEGIN
    INSERT INTO framework_screen_workflow_test_run(
      run_id,screen_resource_id,process_code,step_code,capability_code,route_key,result,
      passed_check_count,total_check_count,blocker_codes,evidence_json,executed_by,
      audit_batch_id,audit_source_commit,audit_runtime_identity_hash,audit_page_number,audit_target_ordinal,audit_target_key
    )
    SELECT fixture_run_base-1000000,replacement.screen_resource_id,replacement.process_code,replacement.step_code,replacement.capability_code,
           replacement.route_key,'BLOCKED',0,1,ARRAY['MUTATION'],
           jsonb_build_object('evidenceType','CONTRACT_SIMULATION','businessFunctionsExecuted',false,
             'screenResourceId',replacement.screen_resource_id,'processCode',replacement.process_code,
             'stepCode',replacement.step_code,'capabilityCode',replacement.capability_code,
             'audience',replacement.audience,'contractFingerprint',md5(replacement.target_key)),
           'BATCH_MUTATION_TEST',v_batch_id,batch.source_commit,batch.runtime_identity_hash,0,0,replacement.target_key
      FROM framework_screen_workflow_audit_batch_target replacement
      JOIN framework_screen_workflow_audit_batch batch USING(audit_batch_id)
     WHERE replacement.audit_batch_id=v_batch_id AND replacement.target_ordinal=1;
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'same-count replacement target was accepted at ordinal zero'; END IF;

  WITH inserted AS (
    INSERT INTO framework_screen_workflow_test_run(
      run_id,screen_resource_id,process_code,step_code,capability_code,route_key,result,
      passed_check_count,total_check_count,blocker_codes,evidence_json,executed_by,test_case_id,
      audit_batch_id,audit_source_commit,audit_runtime_identity_hash,audit_page_number,audit_target_ordinal,audit_target_key
    )
    SELECT fixture_run_base-target.target_ordinal,target.screen_resource_id,target.process_code,target.step_code,target.capability_code,target.route_key,
           'BLOCKED',0,1,ARRAY['MUTATION'],
           jsonb_build_object('evidenceType','CONTRACT_SIMULATION','businessFunctionsExecuted',false,
             'screenResourceId',target.screen_resource_id,'processCode',target.process_code,
             'stepCode',target.step_code,'capabilityCode',target.capability_code,
             'audience',target.audience,'contractFingerprint',md5(target.target_key)),
           'BATCH_MUTATION_TEST',NULL,v_batch_id,batch.source_commit,batch.runtime_identity_hash,
           (target.target_ordinal/v_page_size)::integer,target.target_ordinal,target.target_key
      FROM framework_screen_workflow_audit_batch_target target
      JOIN framework_screen_workflow_audit_batch batch USING(audit_batch_id)
     WHERE target.audit_batch_id=v_batch_id
    RETURNING run_id
  ) SELECT array_agg(run_id ORDER BY run_id) INTO staged_ids FROM inserted;
  IF cardinality(staged_ids)<>target_total THEN RAISE EXCEPTION 'fixture staged % of % targets',cardinality(staged_ids),target_total; END IF;
  IF (SELECT count(*) FROM framework_current_screen_workflow_test_run WHERE run_id=ANY(staged_ids))<>0 THEN
    RAISE EXCEPTION 'RUNNING evidence leaked into current view';
  END IF;

  rejected:=false;
  BEGIN
    PERFORM framework_complete_screen_workflow_audit_batch(v_batch_id,'BATCH_MUTATION_TEST');
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'premature COMPLETE was accepted'; END IF;

  SELECT count(*) filter(where result='PASSED'),count(*) filter(where result='BLOCKED')
    INTO passed_count,blocked_count FROM framework_screen_workflow_test_run
   WHERE audit_batch_id=v_batch_id AND audit_page_number=0;
  rejected:=false;
  BEGIN
    PERFORM framework_record_screen_workflow_audit_page(v_batch_id,'BATCH_MUTATION_TEST',0,0,
      target_total-1,passed_count,blocked_count,0,true);
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'reduced all-process target total was accepted'; END IF;

  FOR page_number IN 0..((target_total+v_page_size-1)/v_page_size)::integer-1 LOOP
    page_offset:=page_number*v_page_size;
    page_target_count:=least(v_page_size,(target_total-page_offset)::integer);
    SELECT count(*) filter(where result='PASSED'),count(*) filter(where result='BLOCKED')
      INTO passed_count,blocked_count FROM framework_screen_workflow_test_run
     WHERE audit_batch_id=v_batch_id AND audit_page_number=page_number;
    receipt:=framework_record_screen_workflow_audit_page(v_batch_id,'BATCH_MUTATION_TEST',page_number,page_offset,
      target_total,passed_count,blocked_count,0,page_offset+page_target_count<target_total);
    IF receipt->>'pageFingerprint' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'page fingerprint missing'; END IF;
  END LOOP;

  rejected:=false;
  BEGIN
    INSERT INTO framework_screen_workflow_audit_batch_page
    SELECT * FROM framework_screen_workflow_audit_batch_page WHERE audit_batch_id=v_batch_id;
  EXCEPTION WHEN unique_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'duplicate page was accepted'; END IF;

  receipt:=framework_complete_screen_workflow_audit_batch(v_batch_id,'BATCH_MUTATION_TEST');
  IF receipt->>'status'<>'COMPLETE' OR (receipt->>'targetCount')::bigint<>target_total THEN
    RAISE EXCEPTION 'exact COMPLETE receipt invalid: %',receipt;
  END IF;
  receipt:=framework_complete_screen_workflow_audit_batch(v_batch_id,'BATCH_MUTATION_TEST');
  IF receipt->>'status'<>'COMPLETE' OR receipt->>'idempotent'<>'true'
     OR (receipt->>'targetCount')::bigint<>target_total THEN
    RAISE EXCEPTION 'idempotent COMPLETE retry receipt invalid: %',receipt;
  END IF;
  IF (SELECT count(*) FROM framework_current_screen_workflow_test_run WHERE run_id=ANY(staged_ids))<>target_total THEN
    RAISE EXCEPTION 'COMPLETE evidence not promoted atomically';
  END IF;

  rejected:=false;
  BEGIN
    UPDATE framework_screen_workflow_audit_batch SET failure_detail='mutation' WHERE audit_batch_id=v_batch_id;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'terminal batch mutation was accepted'; END IF;
  rejected:=false;
  BEGIN
    DELETE FROM framework_screen_workflow_audit_batch_page WHERE audit_batch_id=v_batch_id;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'page deletion was accepted'; END IF;

  v_failed_batch_id:=(framework_start_screen_workflow_audit_batch('BATCH_MUTATION_TEST',v_page_size)->>'auditBatchId')::uuid;
  receipt:=framework_fail_screen_workflow_audit_batch(v_failed_batch_id,'BATCH_MUTATION_TEST','FIXTURE_FAILURE','expected');
  IF receipt->>'status'<>'FAILED' THEN RAISE EXCEPTION 'FAILED transition missing'; END IF;
  IF (SELECT count(*) FROM framework_current_screen_workflow_test_run)<>baseline_current+target_total THEN
    RAISE EXCEPTION 'FAILED attempt changed current view';
  END IF;
  rejected:=false;
  BEGIN
    INSERT INTO framework_screen_workflow_audit_incident(
      incident_id,incident_status,audit_type,first_run_id,last_run_id,run_count,
      first_executed_at,last_executed_at,source_commit,runtime_identity_hash,failure_code,failure_detail
    )
    SELECT 'FORGED-INCIDENT',incident_status,audit_type,first_run_id,last_run_id,run_count,
           first_executed_at,last_executed_at,source_commit,runtime_identity_hash,failure_code,failure_detail
      FROM framework_screen_workflow_audit_incident
     WHERE incident_id='UNBOUND-HOURLY-20260811-700681-702430';
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'unallowlisted FAILED_UNBOUND incident was accepted'; END IF;
  rejected:=false;
  BEGIN
    INSERT INTO framework_screen_workflow_audit_incident_run(incident_id,run_id)
    VALUES ('UNBOUND-HOURLY-20260811-700681-702430',700680);
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'out-of-range FAILED_UNBOUND membership was accepted'; END IF;
  rejected:=false;
  BEGIN
    UPDATE framework_screen_workflow_test_run
       SET evidence_json=evidence_json||'{"mutation":true}'::jsonb
     WHERE run_id=700681;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAILED_UNBOUND source evidence mutation was accepted'; END IF;
  rejected:=false;
  BEGIN
    DELETE FROM framework_screen_workflow_audit_incident_run WHERE incident_id='UNBOUND-HOURLY-20260811-700681-702430';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'incident link deletion was accepted'; END IF;
  IF (SELECT last_value FROM framework_screen_workflow_test_run_run_id_seq)<>sequence_start THEN
    RAISE EXCEPTION 'rollback mutation advanced the production run sequence';
  END IF;
  RAISE NOTICE 'BATCH_MUTATION_PASS baseline_current=% linked=% complete_visible=% failed_visible=0',baseline_current,linked_count,target_total;
END
$test$;
