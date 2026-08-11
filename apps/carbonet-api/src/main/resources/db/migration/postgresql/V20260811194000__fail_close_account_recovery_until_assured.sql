-- ACCOUNT_LOCK_RECOVERY 3.0.0 is designed and locked, but it must not be
-- advertised as ACTIVE until current implementation evidence and the external
-- OTP delivery provider satisfy the assurance promoter.
DO $$
DECLARE
  definition_total integer;
  version_total integer;
  known_pre_state_total integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE process_version='3.0.0'),
         count(*) FILTER (WHERE process_version='3.0.0' AND definition_locked
           AND process_status IN ('ACTIVE','IN_DEVELOPMENT'))
  INTO definition_total,version_total,known_pre_state_total
  FROM framework_process_definition
  WHERE process_code='ACCOUNT_LOCK_RECOVERY';

  IF definition_total<>1 OR version_total<>1 OR known_pre_state_total<>1 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY definition/version/pre-state mismatch definitions=% version3=% knownPreState=%',
      definition_total,version_total,known_pre_state_total;
  END IF;
END $$;

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;

DO $$
DECLARE
  updated_total integer;
BEGIN
  UPDATE framework_process_definition
  SET process_status='IN_DEVELOPMENT',
      definition_locked=true,
      updated_at=current_timestamp
  WHERE process_code='ACCOUNT_LOCK_RECOVERY'
    AND process_version='3.0.0'
    AND definition_locked
    AND process_status IN ('ACTIVE','IN_DEVELOPMENT');

  GET DIAGNOSTICS updated_total = ROW_COUNT;
  IF updated_total<>1 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY fail-closed status update mismatch updated=%',
      updated_total;
  END IF;
END $$;

ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

DO $$
DECLARE
  definition_total integer;
  version_total integer;
  gated_total integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE process_version='3.0.0'),
         count(*) FILTER (WHERE process_version='3.0.0'
           AND process_status='IN_DEVELOPMENT' AND definition_locked)
  INTO definition_total,version_total,gated_total
  FROM framework_process_definition
  WHERE process_code='ACCOUNT_LOCK_RECOVERY';

  IF definition_total<>1 OR version_total<>1 OR gated_total<>1 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY fail-closed guard mismatch definitions=% version3=% gated=%',
      definition_total,version_total,gated_total;
  END IF;
END $$;
