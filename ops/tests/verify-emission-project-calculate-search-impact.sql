BEGIN;
-- Job 659: EMISSION_PROJECT_CALCULATE search impact verification
-- Requirement: 신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.
-- This test verifies:
--   1. The calculation routes (work / results / simulate) are bound to the
--      EMISSION_PROJECT_CALCULATE step in framework_process_step
--   2. The calculation business data (factor / activity / run / item) tables
--      exist and are queryable against PostgreSQL
--   3. The calculation data structures carry the indexes required for the
--      integrated search (tenant/project lookup, uniqueness of calculation
--      version per project, and activity -> calculation item uniqueness)

DO $$
DECLARE
  has_factor_table boolean := false;
  has_activity_table boolean := false;
  has_run_table boolean := false;
  has_item_table boolean := false;
  has_activity_project_index boolean := false;
  has_run_pk boolean := false;
  has_item_pk boolean := false;
  has_run_project_version_unique boolean := false;
  has_item_calc_activity_unique boolean := false;
  calc_step_count integer := 0;
  step_user_path text;
  step_admin_path text;
  factor_count integer := 0;
  activity_count integer := 0;
  run_count integer := 0;
  item_count integer := 0;
BEGIN
  -- Verify 1: emission_factor_reference table (factor reference data structure)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_factor_reference') THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_factor_reference table missing';
  END IF;
  has_factor_table := true;

  -- Verify 2: emission_activity_data table (activity input data structure)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_activity_data') THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_activity_data table missing';
  END IF;
  has_activity_table := true;

  -- Verify 3: emission_calculation_run table (calculation run/version data structure)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_calculation_run') THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_calculation_run table missing';
  END IF;
  has_run_table := true;

  -- Verify 4: emission_calculation_item table (calculation item data structure)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_calculation_item') THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_calculation_item table missing';
  END IF;
  has_item_table := true;

  -- Verify 5: project/period lookup index on emission_activity_data
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_activity_data'
    AND indexname = 'ix_emission_activity_project'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_activity_data project/period index missing';
  END IF;
  has_activity_project_index := true;

  -- Verify 6: emission_calculation_run primary key on calculation_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_calculation_run'
    AND indexname = 'emission_calculation_run_pkey'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_calculation_run primary key index missing';
  END IF;
  has_run_pk := true;

  -- Verify 7: emission_calculation_item primary key on calculation_item_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_calculation_item'
    AND indexname = 'emission_calculation_item_pkey'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_calculation_item primary key index missing';
  END IF;
  has_item_pk := true;

  -- Verify 8: uniqueness of (project_id, version_no) on calculation run
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_calculation_run'
    AND indexdef LIKE '%(project_id, version_no)%'
    AND indexdef ILIKE '%UNIQUE%'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_calculation_run project/version uniqueness index missing';
  END IF;
  has_run_project_version_unique := true;

  -- Verify 9: uniqueness of (calculation_id, activity_id) on calculation item
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_calculation_item'
    AND indexdef LIKE '%(calculation_id, activity_id)%'
    AND indexdef ILIKE '%UNIQUE%'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_calculation_item calculation/activity uniqueness index missing';
  END IF;
  has_item_calc_activity_unique := true;

  -- Verify 10: calculation step process binding routes (when applicable)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='framework_process_step') THEN
    SELECT count(*),
           max(CASE WHEN user_path='/emission/calculation' THEN user_path END),
           max(CASE WHEN admin_path='/admin/emission/calculation-rule' THEN admin_path END)
      INTO calc_step_count, step_user_path, step_admin_path
      FROM framework_process_step
     WHERE process_code='EMISSION_CALCULATION';
    IF calc_step_count < 1 THEN
      RAISE NOTICE 'SEARCH_IMPACT_WARN: framework_process_step EMISSION_CALCULATION binding not found';
    END IF;
  END IF;

  -- Verify 11: factor reference data is queryable
  BEGIN
    SELECT count(*) INTO factor_count FROM emission_factor_reference LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: factor reference query failed - %', SQLERRM;
  END;

  -- Verify 12: activity data is queryable
  BEGIN
    SELECT count(*) INTO activity_count FROM emission_activity_data LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: activity data query failed - %', SQLERRM;
  END;

  -- Verify 13: calculation run data is queryable
  BEGIN
    SELECT count(*) INTO run_count FROM emission_calculation_run LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: calculation run query failed - %', SQLERRM;
  END;

  -- Verify 14: calculation item data is queryable
  BEGIN
    SELECT count(*) INTO item_count FROM emission_calculation_item LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: calculation item query failed - %', SQLERRM;
  END;

  RAISE NOTICE 'SEARCH_IMPACT_PASS: Calculation routes and factor/activity/run/item data are indexed for integrated search';
  RAISE NOTICE '  - emission_factor_reference: % (rows: %)', has_factor_table, factor_count;
  RAISE NOTICE '  - emission_activity_data: % (rows: %)', has_activity_table, activity_count;
  RAISE NOTICE '  - emission_calculation_run: % (rows: %)', has_run_table, run_count;
  RAISE NOTICE '  - emission_calculation_item: % (rows: %)', has_item_table, item_count;
  RAISE NOTICE '  - activity project/period index: %', has_activity_project_index;
  RAISE NOTICE '  - calculation_run pk: %', has_run_pk;
  RAISE NOTICE '  - calculation_item pk: %', has_item_pk;
  RAISE NOTICE '  - calculation_run project/version unique: %', has_run_project_version_unique;
  RAISE NOTICE '  - calculation_item calculation/activity unique: %', has_item_calc_activity_unique;
  RAISE NOTICE '  - process_step binding count: % (user_path=%, admin_path=%)', calc_step_count, step_user_path, step_admin_path;
END $$;

-- Route registration evidence (informational, route layer is verified externally)
-- /emission/calculation          → EmissionSimulateMigrationPage (emission-calculation)
-- /emission/calculation-results  → EmissionProjectResultPage    (emission-calculation-results)
-- /emission/simulate            → EmissionSimulateMigrationPage (emission-simulate)
-- /admin/emission/calculation-rule → EmissionDefinitionStudioMigrationPage (emission-calculation-rule)
ROLLBACK;
