-- Keep the canonical process-step routes and professional screen contracts in
-- sync.  This is deliberately a design repair only: runtime verification flags
-- stay false until the route passes its authenticated implementation gate.

CREATE OR REPLACE FUNCTION framework_repair_missing_required_screen_contracts(
  requested_process_code varchar DEFAULT NULL,
  requested_by varchar DEFAULT 'REQUIRED_SCREEN_CONTRACT_REPAIR'
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  repaired_count integer := 0;
BEGIN
  WITH required_route AS (
    SELECT s.process_code,s.step_code,s.step_name,s.actor_code,
           s.requirement_text,s.completion_rule,
           x.audience,x.route_path
    FROM framework_process_step s
    CROSS JOIN LATERAL (VALUES
      ('USER'::varchar,CASE WHEN s.requires_user_page THEN nullif(btrim(s.user_path),'') END),
      ('ADMIN'::varchar,CASE WHEN s.requires_admin_page THEN nullif(btrim(s.admin_path),'') END)
    ) x(audience,route_path)
    WHERE x.route_path IS NOT NULL
      AND (requested_process_code IS NULL OR s.process_code=requested_process_code)
  ), missing AS (
    SELECT r.*,
      source.business_purpose source_business_purpose,
      source.entry_condition,source.exit_condition,source.kpi_contract,
      source.section_contract,source.field_contract,source.command_contract,
      source.state_contract,source.api_contract,source.data_contract,
      source.evidence_contract,source.responsive_contract,
      source.accessibility_contract,source.security_contract,
      source.screen_code,source.project_context_required,
      source.tenant_context_required,source.process_sequence,
      source.step_sequence,source.screen_sequence,source.screen_usage_type,
      source.transition_type,source.transition_condition,
      source.parallel_group_code,source.previous_step_codes,
      source.next_step_codes,source.permission_codes,
      source.data_scope_contract,source.test_contract,source.design_version,
      source.contract_revision
    FROM required_route r
    JOIN LATERAL (
      SELECT c.*
      FROM framework_professional_screen_contract c
      WHERE c.process_code=r.process_code
        AND c.step_code=r.step_code
      ORDER BY CASE WHEN c.audience<>r.audience THEN 0 ELSE 1 END,c.contract_id
      LIMIT 1
    ) source ON true
    WHERE NOT EXISTS (
      SELECT 1
      FROM framework_professional_screen_contract current_contract
      WHERE current_contract.process_code=r.process_code
        AND current_contract.step_code=r.step_code
        AND current_contract.audience=r.audience
        AND lower(split_part(current_contract.route_path,'?',1))=
            lower(split_part(r.route_path,'?',1))
    )
  ), inserted AS (
    INSERT INTO framework_professional_screen_contract(
      process_code,step_code,audience,route_path,screen_name,actor_code,
      business_purpose,entry_condition,exit_condition,kpi_contract,
      section_contract,field_contract,command_contract,state_contract,
      api_contract,data_contract,evidence_contract,responsive_contract,
      accessibility_contract,security_contract,api_verified,database_verified,
      authority_verified,responsive_verified,accessibility_verified,
      exception_states_verified,audit_evidence_ref,contract_status,updated_by,
      menu_code,menu_visibility,menu_verified,screen_code,
      project_context_required,tenant_context_required,process_sequence,
      step_sequence,screen_sequence,screen_usage_type,transition_type,
      transition_condition,parallel_group_code,previous_step_codes,
      next_step_codes,permission_codes,data_scope_contract,test_contract,
      design_version,contract_revision
    )
    SELECT m.process_code,m.step_code,m.audience,m.route_path,
      m.step_name||CASE m.audience WHEN 'ADMIN' THEN ' 관리자 업무 화면' ELSE ' 사용자 업무 화면' END,
      m.actor_code,
      coalesce(nullif(btrim(m.requirement_text),''),m.source_business_purpose),
      m.entry_condition,
      coalesce(nullif(btrim(m.completion_rule),''),m.exit_condition),
      m.kpi_contract,m.section_contract,m.field_contract,m.command_contract,
      m.state_contract,m.api_contract,m.data_contract,m.evidence_contract,
      m.responsive_contract,m.accessibility_contract,m.security_contract,
      false,false,false,false,false,false,
      'design-repair:required-route-contract','DESIGN_COMPLETE',requested_by,
      NULL,'HIDDEN',false,
      coalesce(nullif(m.screen_code,''),upper(substr(md5(lower(split_part(m.route_path,'?',1))),1,16))),
      m.project_context_required,m.tenant_context_required,m.process_sequence,
      m.step_sequence,m.screen_sequence,m.screen_usage_type,m.transition_type,
      m.transition_condition,m.parallel_group_code,m.previous_step_codes,
      m.next_step_codes,m.permission_codes,m.data_scope_contract,m.test_contract,
      m.design_version,greatest(1,m.contract_revision)
    FROM missing m
    ON CONFLICT(process_code,step_code,audience,route_path) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO repaired_count FROM inserted;

  RETURN repaired_count;
END $$;

SELECT framework_repair_missing_required_screen_contracts(
  NULL,'FLYWAY_REQUIRED_SCREEN_CONTRACT_REPAIR'
);

DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT coalesce(sum(
    missing_user_screen_contract_count+missing_admin_screen_contract_count
  ),0)::integer
  INTO remaining_count
  FROM framework_process_design_assurance_matrix;

  IF remaining_count<>0 THEN
    RAISE EXCEPTION
      'required professional screen contract repair incomplete: % routes remain',
      remaining_count;
  END IF;
END $$;
