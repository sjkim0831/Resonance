BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT bucket_start,route,response_status,request_count,duration_sum_ms,duration_max_ms FROM telemetry_technical_minute ORDER BY bucket_start DESC LIMIT 10;
SELECT count(*) AS raw_qa_trace_count FROM (SELECT trace_id FROM trace_event ORDER BY created_at DESC LIMIT 1000) recent WHERE trace_id='ccus-qa-rollup-20260908';
SELECT pg_size_pretty(pg_total_relation_size('telemetry_technical_minute')) AS rollup_storage;
COMMIT;
