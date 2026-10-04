BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT 'trace' AS ledger,count(*) FROM (SELECT trace_id FROM trace_event ORDER BY created_at DESC LIMIT 1000) recent WHERE trace_id='ccus-qa-idempotency-20260908'
UNION ALL
SELECT 'access',count(*) FROM (SELECT trace_id FROM access_event ORDER BY created_at DESC LIMIT 1000) recent WHERE trace_id='ccus-qa-idempotency-20260908';
COMMIT;
