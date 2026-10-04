\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $$
DECLARE missing text;
BEGIN
 SELECT string_agg(name,', ') INTO missing FROM (VALUES ('emission_result_lock'),('emission_calculation_submission'),('emission_verification_finding')) t(name) WHERE to_regclass('public.'||name) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing report workflow tables: %',missing; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='emission_result_lock'::regclass AND conname='ck_emission_result_lock_hash') THEN RAISE EXCEPTION 'Missing result lock hash constraint'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='emission_project_report'::regclass AND contype='f' AND confrelid='emission_result_lock'::regclass) THEN RAISE EXCEPTION 'Missing report to lock foreign key'; END IF;
 IF NOT has_table_privilege('carbonet_app','emission_result_lock','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Missing runtime permissions'; END IF;
END $$;
SELECT result_lock_id,calculation_version,total_emission,result_unit,input_snapshot_hash,lock_hash,lock_payload FROM emission_result_lock LIMIT 0;
SELECT result_lock_id,result_lock_hash FROM emission_project_report LIMIT 0;
ROLLBACK;
