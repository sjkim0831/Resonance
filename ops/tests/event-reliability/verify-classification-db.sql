BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT event_type, payload_summary::jsonb #>> '{summary,usageClassification,origin}' AS origin,
 payload_summary::jsonb #>> '{summary,usageClassification,activity}' AS activity,
 payload_summary::jsonb #>> '{summary,usageClassification,analyticsEligible}' AS analytics_eligible
FROM (SELECT trace_id,event_type,payload_summary FROM trace_event ORDER BY created_at DESC LIMIT 1000) recent
WHERE trace_id='ccus-qa-classification-20260908';
SELECT payload_summary::jsonb #>> '{usageClassification,activity}' AS server_activity, count(*)
FROM (SELECT payload_summary FROM trace_event ORDER BY created_at DESC LIMIT 1000) recent
WHERE payload_summary LIKE '%SERVER_ROUTE_CLASSIFICATION%'
GROUP BY 1 ORDER BY 2 DESC;
COMMIT;
