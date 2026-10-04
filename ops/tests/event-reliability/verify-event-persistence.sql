BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT trace_id,event_type,page_id FROM (
  SELECT trace_id,event_type,page_id FROM trace_event ORDER BY created_at DESC LIMIT 1000
) recent WHERE trace_id = 'ccus-qa-telemetry-20260908';
COMMIT;
