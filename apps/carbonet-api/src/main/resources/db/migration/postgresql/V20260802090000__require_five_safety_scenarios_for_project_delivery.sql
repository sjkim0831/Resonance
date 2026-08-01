ALTER FUNCTION framework_validate_project_delivery_blueprint(varchar)
  RENAME TO framework_validate_project_delivery_blueprint_v1;

CREATE OR REPLACE FUNCTION framework_validate_project_delivery_blueprint(
  requested_blueprint_code varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  base_result jsonb;
  spec jsonb;
  safety_gap_count integer := 0;
  errors jsonb;
  required_types constant text[] := ARRAY[
    'HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'
  ];
BEGIN
  base_result:=framework_validate_project_delivery_blueprint_v1(requested_blueprint_code);
  SELECT specification INTO spec
    FROM framework_project_delivery_blueprint
   WHERE blueprint_code=requested_blueprint_code;

  IF spec IS NULL OR jsonb_typeof(spec->'processCodes')<>'array' THEN
    RETURN base_result;
  END IF;

  WITH requested AS (
    SELECT DISTINCT value process_code
      FROM jsonb_array_elements_text(spec->'processCodes')
  ), coverage AS (
    SELECT requested.process_code,
           count(DISTINCT test.case_type) FILTER(
             WHERE test.case_type=ANY(required_types)
               AND test.case_status IN ('READY','ACTIVE','APPROVED','VERIFIED')) covered_types
      FROM requested
      LEFT JOIN framework_simulation_case test
        ON test.process_code=requested.process_code
     GROUP BY requested.process_code
  )
  SELECT count(*) FILTER(WHERE covered_types<cardinality(required_types))
    INTO safety_gap_count
    FROM coverage;

  errors:=coalesce(base_result->'errors','[]'::jsonb);
  IF safety_gap_count>0 AND NOT errors ? 'FIVE_SAFETY_SCENARIOS_MISSING' THEN
    errors:=errors||jsonb_build_array('FIVE_SAFETY_SCENARIOS_MISSING');
  END IF;

  RETURN base_result
    || jsonb_build_object(
      'valid',jsonb_array_length(errors)=0,
      'errors',errors,
      'requiredScenarioTypes',to_jsonb(required_types),
      'processWithoutFiveSafetyScenariosCount',safety_gap_count);
END $$;

COMMENT ON FUNCTION framework_validate_project_delivery_blueprint(varchar) IS
  '업무팩의 액터·단계·화면과 정상·권한·격리·예외·복구 5종 시나리오를 승인 전에 검증한다';
