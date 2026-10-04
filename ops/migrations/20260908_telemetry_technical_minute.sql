-- Non-destructive, native PostgreSQL migration. Existing ledgers are unchanged.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
CREATE TABLE IF NOT EXISTS public.telemetry_technical_minute (
    bucket_start timestamptz NOT NULL,
    project_id varchar(200) NOT NULL,
    route varchar(200) NOT NULL,
    http_method varchar(10) NOT NULL,
    response_status integer NOT NULL CHECK (response_status BETWEEN 200 AND 299),
    request_count bigint NOT NULL CHECK (request_count > 0),
    duration_sum_ms bigint NOT NULL CHECK (duration_sum_ms >= 0),
    duration_max_ms integer NOT NULL CHECK (duration_max_ms >= 0),
    first_seen timestamptz NOT NULL,
    last_seen timestamptz NOT NULL,
    PRIMARY KEY (bucket_start, project_id, route, http_method, response_status)
);
DO $$
DECLARE owner_name text;
BEGIN
    SELECT tableowner INTO STRICT owner_name FROM pg_tables WHERE schemaname='public' AND tablename='trace_event';
    EXECUTE format('ALTER TABLE public.telemetry_technical_minute OWNER TO %I', owner_name);
END $$;
COMMIT;
