BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_submission_review') THEN
    RAISE EXCEPTION 'review ledger missing';
  END IF;
  IF (SELECT count(*) FROM framework_simulation_case WHERE case_code LIKE 'EMISSION_REVIEW_%') <> 4 THEN
    RAISE EXCEPTION 'review simulation cases missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='emission_calculation_run' AND column_name='locked_at') THEN
    RAISE EXCEPTION 'calculation lock missing';
  END IF;
END $$;
ROLLBACK;
