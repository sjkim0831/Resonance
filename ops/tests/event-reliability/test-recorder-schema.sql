\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
CREATE SCHEMA ccus_recorder_contract_test;
SET LOCAL search_path=ccus_recorder_contract_test,pg_catalog;
\ir recorder-audit-schema.sql
\ir recorder-audit-schema.sql
INSERT INTO process_preview_recording_audit(id,event_type,status,payload,source_code,workflow_status,acknowledgement_status)
 VALUES(1,'FAILURE','FAILED_FINAL','{}','ISOLATED_QA','ASSIGNED','UNACKNOWLEDGED');
DO $$ BEGIN
 BEGIN
  INSERT INTO process_preview_recording_audit(event_type,status,payload,source_code,acknowledgement_status) VALUES('FAILURE','FAILED_FINAL','{}','ISOLATED_QA','UNACKNOWLEDGED');
  RAISE EXCEPTION 'duplicate failure accepted';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS duplicate open failure rejected'; END;
 BEGIN
  INSERT INTO process_preview_recording_audit_transition(audit_id,to_status,actor) VALUES(999,'ASSIGNED','QA');
  RAISE EXCEPTION 'orphan transition accepted';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS orphan transition rejected'; END;
END $$;
INSERT INTO process_preview_runtime_alert_delivery(audit_id,channel,attempt_no,delivery_status) VALUES(1,'WEBHOOK',1,'FAILED'),(1,'WEBHOOK',2,'DELIVERED');
DO $$ BEGIN
 BEGIN
  INSERT INTO process_preview_runtime_alert_delivery(audit_id,channel,attempt_no,delivery_status) VALUES(1,'WEBHOOK',2,'DELIVERED');
  RAISE EXCEPTION 'duplicate delivery accepted';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS duplicate delivery rejected'; END;
END $$;
UPDATE process_preview_recording_audit SET workflow_status='RESOLVED' WHERE id=1 AND workflow_status='ASSIGNED';
INSERT INTO process_preview_recording_audit_transition(audit_id,from_status,to_status,actor) VALUES(1,'ASSIGNED','RESOLVED','QA');
UPDATE process_preview_recording_audit SET workflow_status='CLOSED',acknowledgement_status='ACKNOWLEDGED' WHERE id=1 AND workflow_status='RESOLVED';
INSERT INTO process_preview_recording_audit_transition(audit_id,from_status,to_status,actor) VALUES(1,'RESOLVED','CLOSED','QA');
DO $$ BEGIN
 IF (SELECT workflow_status FROM process_preview_recording_audit WHERE id=1)<>'CLOSED' OR (SELECT count(*) FROM process_preview_recording_audit_transition)<>2 THEN RAISE EXCEPTION 'transition mismatch'; END IF;
 RAISE NOTICE 'PASS resolve and close with two transitions';
END $$;
\ir recorder-list-query.sql
ROLLBACK;
SELECT to_regnamespace('ccus_recorder_contract_test') IS NULL AS isolated_schema_removed;
