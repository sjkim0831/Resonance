-- flyway:executeInTransaction=false
-- Keeps page-scoped audit lookups bounded as AUDIT_EVENT grows into tens of
-- millions of rows. CONCURRENTLY avoids blocking live audit ingestion.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_page_result_created
    ON audit_event (menu_code, page_id, result_status, created_at DESC);
