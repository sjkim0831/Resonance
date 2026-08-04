-- Refresh the materialized execution topology after installing the assignment
-- process and its three step-to-step handoff contracts.
SELECT * FROM framework_rebuild_process_execution_topology();
