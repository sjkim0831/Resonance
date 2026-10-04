BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT 'trace' AS ledger,count(*) AS matching_rows FROM trace_event WHERE trace_id='ccus-qa-ledger-20260908-v1'
UNION ALL SELECT 'access',count(*) FROM access_event WHERE trace_id='ccus-qa-ledger-20260908-v1'
UNION ALL SELECT 'audit',count(*) FROM audit_event WHERE trace_id='ccus-qa-ledger-20260908-v1';
SELECT count(*) AS audit_marker_rows FROM (SELECT after_summary FROM audit_event ORDER BY created_at DESC LIMIT 1000) recent WHERE after_summary LIKE '%ccus-qa-ledger-20260908-v1%';
COMMIT;
