DELETE FROM framework_professional_screen_contract WHERE process_code='ACTIVITY_DATA';

WITH contract_map(target_step,source_step,user_route,admin_route) AS (
  VALUES
    ('ACTIVITY_DATA_01_PLAN','EMISSION_PROJECT_SETUP','/emission/project/settings','/admin/emission/project-operations'),
    ('ACTIVITY_DATA_02_WORK','EMISSION_PROJECT_COLLECT','/emission/activity-data','/admin/emission/survey-admin-data'),
    ('ACTIVITY_DATA_03_VERIFY','EMISSION_PROJECT_VALIDATE','/emission/validate','/admin/emission/validate'),
    ('ACTIVITY_DATA_04_APPROVE','EMISSION_PROJECT_APPROVE','/emission/validate?tab=approval','/admin/emission/approval-workflow')
)
INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,
  business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,
  field_contract,command_contract,state_contract,api_contract,data_contract,
  evidence_contract,responsive_contract,accessibility_contract,security_contract,
  api_verified,database_verified,authority_verified,responsive_verified,
  accessibility_verified,exception_states_verified,audit_evidence_ref,
  contract_status,updated_by,menu_visibility,menu_verified
)
SELECT 'ACTIVITY_DATA',m.target_step,c.audience,
       CASE c.audience WHEN 'ADMIN' THEN m.admin_route ELSE m.user_route END,
       replace(c.screen_name,'배출량 프로젝트','활동자료'),c.actor_code,
       c.business_purpose,c.entry_condition,c.exit_condition,c.kpi_contract,c.section_contract,
       c.field_contract,c.command_contract,c.state_contract,c.api_contract,c.data_contract,
       c.evidence_contract,c.responsive_contract,c.accessibility_contract,c.security_contract,
       c.api_verified,c.database_verified,c.authority_verified,c.responsive_verified,
       c.accessibility_verified,c.exception_states_verified,
       'reused:EMISSION_PROJECT/'||m.source_step||'/'||c.audience,
       'DESIGN_COMPLETE','E4B_CONTRACT_REUSE','HIDDEN',false
FROM contract_map m
JOIN framework_professional_screen_contract c
  ON c.process_code='EMISSION_PROJECT' AND c.step_code=m.source_step;

DO $$
DECLARE validation record;
BEGIN
  SELECT * INTO validation FROM framework_validate_process_design('ACTIVITY_DATA','E4B_CONTRACT_REUSE');
  IF validation.blocker_count <> 0 THEN
    RAISE EXCEPTION 'ACTIVITY_DATA_DESIGN_BLOCKED:%', validation.blocker_count;
  END IF;
END $$;
