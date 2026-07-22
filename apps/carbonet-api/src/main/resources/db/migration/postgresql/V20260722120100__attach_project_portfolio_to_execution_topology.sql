-- A professional process is deployable only when it participates in the
-- executable business sequence and its normalized DAG topology.  The
-- LIST_DASHBOARD standard introduced EMISSION_PROJECT_PORTFOLIO as an
-- implemented process; attach it to the emission workflow before promotion.
INSERT INTO framework_business_process_sequence(
  work_type_code,
  process_code,
  workflow_order,
  workflow_phase,
  process_role,
  prerequisite_process_codes,
  sequence_status
)
VALUES(
  'EMISSION',
  'EMISSION_PROJECT_PORTFOLIO',
  5,
  'PROJECT_PORTFOLIO',
  'ENTRY',
  '',
  'ACTIVE'
)
ON CONFLICT(process_code) DO UPDATE SET
  work_type_code=excluded.work_type_code,
  workflow_order=excluded.workflow_order,
  workflow_phase=excluded.workflow_phase,
  process_role=excluded.process_role,
  sequence_status='ACTIVE',
  updated_at=current_timestamp;

SELECT * FROM framework_rebuild_process_execution_topology();

DO $$
DECLARE
  process_total integer;
  topology_total integer;
  portfolio_topology integer;
BEGIN
  SELECT count(*) INTO process_total FROM framework_process_definition;
  SELECT count(*) INTO topology_total
  FROM framework_process_execution_topology
  WHERE topology_status='DESIGN_COMPLETE';
  SELECT count(*) INTO portfolio_topology
  FROM framework_process_execution_topology
  WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
    AND work_type_code='EMISSION'
    AND topology_status='DESIGN_COMPLETE';

  IF process_total<>topology_total OR portfolio_topology<>1 THEN
    RAISE EXCEPTION
      'Project portfolio topology closure failed: process=%, topology=%, portfolio=%',
      process_total,topology_total,portfolio_topology;
  END IF;
END $$;
