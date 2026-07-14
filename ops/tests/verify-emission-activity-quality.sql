BEGIN;

DO $$
DECLARE
  test_project varchar(40);
  test_factor varchar(40);
  factor_unit varchar(30);
  valid_activity bigint;
  invalid_activity bigint;
  run bigint;
  blocking integer;
  warning integer;
BEGIN
  SELECT project_id INTO test_project FROM emission_project_registry ORDER BY project_id LIMIT 1;
  SELECT factor_id,unit INTO test_factor,factor_unit FROM emission_factor_reference ORDER BY factor_id LIMIT 1;
  IF test_project IS NULL OR test_factor IS NULL THEN RAISE EXCEPTION 'QUALITY_TEST_FIXTURE_MISSING'; END IF;

  INSERT INTO emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note,factor_id,mapping_status)
  VALUES(test_project,'QUALITY-VALID-'||txid_current(),'테스트','2026-01',10,factor_unit,'원본 계량기 TEST-001',test_factor,'MAPPED')
  RETURNING activity_id INTO valid_activity;

  INSERT INTO emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note,mapping_status)
  VALUES(test_project,'QUALITY-INVALID-'||txid_current(),'테스트','2099-13',0,'INVALID','', 'UNMAPPED')
  RETURNING activity_id INTO invalid_activity;

  INSERT INTO emission_activity_quality_run(tenant_id,project_id,executed_actor,total_count,blocking_count,warning_count,quality_score,submit_ready)
  VALUES('QUALITY_TEST_TENANT',test_project,'QUALITY_TEST_ACTOR',2,3,2,45,false)
  RETURNING run_id INTO run;

  INSERT INTO emission_activity_quality_issue(run_id,activity_id,rule_code,severity,field_name,issue_message,remediation_message) VALUES
  (run,invalid_activity,'INVALID_UNIT','BLOCKING','unit','지원하지 않는 단위','단위를 정정하세요.'),
  (run,invalid_activity,'UNMAPPED_FACTOR','BLOCKING','factorId','배출계수 미매핑','배출계수를 매핑하세요.'),
  (run,invalid_activity,'INVALID_PERIOD','BLOCKING','period','기간 형식 오류','YYYY-MM으로 정정하세요.'),
  (run,invalid_activity,'ZERO_QUANTITY','WARNING','quantity','활동량 0','근거를 확인하세요.'),
  (run,invalid_activity,'MISSING_EVIDENCE','WARNING','note','증빙 없음','증빙 식별 정보를 입력하세요.');

  SELECT count(*) FILTER(WHERE severity='BLOCKING'),count(*) FILTER(WHERE severity='WARNING')
    INTO blocking,warning FROM emission_activity_quality_issue WHERE run_id=run;
  IF blocking<>3 OR warning<>2 THEN RAISE EXCEPTION 'QUALITY_SEVERITY_COUNT_FAILED'; END IF;
  IF EXISTS(SELECT 1 FROM emission_activity_quality_run WHERE run_id=run AND submit_ready) THEN
    RAISE EXCEPTION 'QUALITY_BLOCKING_SUBMIT_GATE_FAILED';
  END IF;
  IF EXISTS(SELECT 1 FROM emission_activity_quality_run WHERE run_id=run AND tenant_id='OTHER_TENANT') THEN
    RAISE EXCEPTION 'QUALITY_TENANT_ISOLATION_FAILED';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM emission_activity_quality_issue WHERE run_id=run AND activity_id=invalid_activity AND remediation_message<>'') THEN
    RAISE EXCEPTION 'QUALITY_REMEDIATION_MISSING';
  END IF;
END $$;

ROLLBACK;
