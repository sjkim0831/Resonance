-- V20260722160000 is immutable after it is applied. The follow-up repairs the
-- legacy taxonomy and shared workspace metadata without changing its checksum.

CREATE OR REPLACE FUNCTION framework_canonical_professional_scenario_type(
  requested_type text
) RETURNS varchar
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE upper(coalesce(requested_type,''))
    WHEN 'TENANT_ISOLATION' THEN 'ISOLATION'
    WHEN 'PROJECT_ISOLATION' THEN 'ISOLATION'
    WHEN 'VALIDATION' THEN 'EXCEPTION'
    WHEN 'INVALID_STATE' THEN 'EXCEPTION'
    ELSE upper(coalesce(requested_type,''))
  END::varchar;
$$;

ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;
UPDATE framework_simulation_case
SET case_type=framework_canonical_professional_scenario_type(case_type),updated_at=current_timestamp
WHERE case_type IS DISTINCT FROM framework_canonical_professional_scenario_type(case_type);
ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;

UPDATE framework_professional_screen_contract c SET
  api_contract=CASE
    WHEN c.api_contract='[]' AND lower(split_part(c.route_path,'?',1))='/admin/system/process-workspace'
    THEN jsonb_build_array(
      jsonb_build_object('method','GET','path','/admin/api/system/actor-process','scope','actor and process governance'),
      jsonb_build_object('method','GET','path','/home/api/process-executions','scope','tenant, project and actor'),
      jsonb_build_object('method','POST','path','/home/api/process-executions/start','guard','first step actor'),
      jsonb_build_object('method','POST','path','/home/api/process-executions/{executionId}/commands','idempotency','required')
    )::text ELSE c.api_contract END,
  state_contract=CASE
    WHEN c.contract_id=251 AND NOT (c.state_contract LIKE '%LOADING%' AND c.state_contract LIKE '%EMPTY%'
      AND c.state_contract LIKE '%ERROR%' AND c.state_contract LIKE '%FORBIDDEN%')
    THEN jsonb_build_array('LOADING','READY','EMPTY','SIMULATED','SAVED','SUBMITTED','ERROR','FORBIDDEN')::text
    WHEN c.contract_id IN (742,744) AND c.state_contract NOT LIKE '%"EMPTY"%'
    THEN (framework_try_jsonb(c.state_contract)||jsonb_build_array('EMPTY'))::text
    ELSE c.state_contract END,
  updated_by='MASS_SCREEN_SAFETY_TAXONOMY_RECONCILIATION',updated_at=current_timestamp
WHERE (c.api_contract='[]' AND lower(split_part(c.route_path,'?',1))='/admin/system/process-workspace')
   OR (c.contract_id=251 AND NOT (c.state_contract LIKE '%LOADING%' AND c.state_contract LIKE '%EMPTY%'
     AND c.state_contract LIKE '%ERROR%' AND c.state_contract LIKE '%FORBIDDEN%'))
   OR (c.contract_id IN (742,744) AND c.state_contract NOT LIKE '%"EMPTY"%');

SELECT framework_prepare_mass_professional_screens(1000,'SYSTEM_MASS_SCREEN_DESIGNER_V2');
