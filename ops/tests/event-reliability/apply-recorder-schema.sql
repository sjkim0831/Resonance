\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
SET LOCAL search_path=public,pg_catalog;
DO $$ BEGIN
 IF to_regclass('public.process_preview_recording_audit') IS NOT NULL OR to_regclass('public.process_preview_runtime_alert_delivery') IS NOT NULL OR to_regclass('public.process_preview_recording_audit_transition') IS NOT NULL THEN
 RAISE EXCEPTION 'Unexpected existing recorder tables; inspect before applying'; END IF;
END $$;
SELECT format('SET LOCAL ROLE %I',pg_get_userbyid(relowner)) FROM pg_class WHERE oid='public.trace_event'::regclass \gexec
\ir recorder-audit-schema.sql
\ir recorder-list-query.sql
COMMIT;
SELECT relname,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid IN ('public.process_preview_recording_audit'::regclass,'public.process_preview_runtime_alert_delivery'::regclass,'public.process_preview_recording_audit_transition'::regclass);
