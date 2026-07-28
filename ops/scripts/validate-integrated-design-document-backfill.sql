\set ON_ERROR_STOP on

DO $$
DECLARE
  v_expected bigint;
  v_actual bigint;
  v_missing bigint;
  v_protected_overwritten bigint;
BEGIN
  SELECT count(*) * 18 INTO v_expected
    FROM framework_process_definition p
    JOIN framework_process_step s ON s.process_code=p.process_code
    CROSS JOIN LATERAL (
      SELECT DISTINCT route_path
        FROM (VALUES (coalesce(s.user_path,'')),(coalesce(s.admin_path,''))) x(route_path)
       WHERE route_path <> ''
    ) r;

  SELECT count(*) INTO v_actual
    FROM integrated_design_document
   WHERE active_yn='Y';

  WITH contexts AS (
    SELECT p.process_code,s.step_code,r.route_path
      FROM framework_process_definition p
      JOIN framework_process_step s ON s.process_code=p.process_code
      CROSS JOIN LATERAL (
        SELECT DISTINCT route_path
          FROM (VALUES (coalesce(s.user_path,'')),(coalesce(s.admin_path,''))) x(route_path)
         WHERE route_path <> ''
      ) r
  ), types(document_type) AS (
    VALUES ('REQUIREMENT'),('ACTOR_RACI'),('AUTHORITY'),('PROCESS'),('STATE'),
      ('NAVIGATION'),('ACTIVE_UI'),('DESIGN_ASSET'),('FIELD_DICTIONARY'),
      ('DATA_HANDOFF'),('DATABASE'),('API'),('BUSINESS_RULE'),('VALIDATION'),
      ('NOTIFICATION'),('TEST'),('TASK_EVIDENCE'),('RELEASE_AUDIT')
  )
  SELECT count(*) INTO v_missing
    FROM contexts c CROSS JOIN types t
   WHERE NOT EXISTS (
     SELECT 1 FROM integrated_design_document d
      WHERE d.process_code=c.process_code AND d.step_code=c.step_code
        AND d.route_path=c.route_path AND d.document_type=t.document_type
        AND d.active_yn='Y' AND length(d.content)>100
   );

  SELECT count(*) INTO v_protected_overwritten
    FROM integrated_design_document
   WHERE status IN ('APPROVED','VERIFIED')
     AND updated_by='LIVE_CONTRACT_BACKFILL';

  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'integrated design document missing count=%',v_missing;
  END IF;
  IF v_protected_overwritten <> 0 THEN
    RAISE EXCEPTION 'protected design document overwritten count=%',v_protected_overwritten;
  END IF;

  RAISE NOTICE 'INTEGRATED_DESIGN_BACKFILL_PASS expected=% actual=% missing=0 protected_overwritten=0',
    v_expected,v_actual;
END $$;
