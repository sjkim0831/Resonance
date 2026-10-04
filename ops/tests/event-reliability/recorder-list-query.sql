select id,source_code as "sourceCode",event_type as "eventType",status,alert,coalesce(reason,'') as reason,
 coalesce(process_code,'') as "processCode",consecutive_failures as "consecutiveFailures",duration_ms as "durationMs",
 severity,coalesce(assigned_actor,'') as "assignedActor",workflow_status as "workflowStatus",due_at as "dueAt",
 escalation_level as "escalationLevel",escalated_at as "escalatedAt",
 coalesce((select string_agg(d.channel||':'||d.delivery_status||'('||d.attempt_no||')', ', ' order by d.channel)
 from process_preview_runtime_alert_delivery d
 join (select channel,max(attempt_no) attempt_no from process_preview_runtime_alert_delivery
 where audit_id=process_preview_recording_audit.id group by channel) latest
 on latest.channel=d.channel and latest.attempt_no=d.attempt_no
 where d.audit_id=process_preview_recording_audit.id),'') as "deliverySummary",
 (select count(*)::integer from process_preview_runtime_alert_delivery d where d.audit_id=process_preview_recording_audit.id) as "deliveryAttemptCount",
 acknowledgement_status as "acknowledgementStatus",acknowledged_by as "acknowledgedBy",acknowledged_at as "acknowledgedAt",occurred_at as "occurredAt"
 from process_preview_recording_audit order by occurred_at desc,id desc limit 500;
select count(*)::integer as unacknowledged from process_preview_recording_audit where event_type='FAILURE' and acknowledgement_status='UNACKNOWLEDGED';
