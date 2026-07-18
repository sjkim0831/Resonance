-- Connect the implemented calculation workflow to the process delivery control plane.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false, definition_lock_reason='VERSIONED_MAINTENANCE_V1.1.0'
WHERE process_code='EMISSION_CALCULATION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step SET
  user_path=CASE step_code
    WHEN 'EMISSION_CALCULATION_01_PLAN' THEN '/emission/project/detail'
    WHEN 'EMISSION_CALCULATION_02_WORK' THEN '/emission/calculation'
    WHEN 'EMISSION_CALCULATION_03_VERIFY' THEN '/emission/validate'
    WHEN 'EMISSION_CALCULATION_04_APPROVE' THEN '/emission/calculation-results' END,
  admin_path=CASE step_code
    WHEN 'EMISSION_CALCULATION_01_PLAN' THEN '/admin/emission/project-operations'
    WHEN 'EMISSION_CALCULATION_02_WORK' THEN '/admin/emission/calculation-rule'
    WHEN 'EMISSION_CALCULATION_03_VERIFY' THEN '/admin/emission/validate'
    WHEN 'EMISSION_CALCULATION_04_APPROVE' THEN '/admin/emission/result_list' END,
  api_contract=CASE step_code
    WHEN 'EMISSION_CALCULATION_01_PLAN' THEN 'GET /home/api/emission-projects/{id}; GET /home/api/emission-projects/{id}/activities; GET /home/api/emission-projects/{id}/calculation'
    WHEN 'EMISSION_CALCULATION_02_WORK' THEN 'POST /home/api/emission-projects/{id}/activities/{activityId}/factor; POST /home/api/emission-projects/{id}/activities/auto-map; POST /home/api/emission-projects/{id}/calculation'
    WHEN 'EMISSION_CALCULATION_03_VERIFY' THEN 'GET|POST /home/api/emission-projects/{id}/quality; GET /home/api/emission-projects/{id}/calculation; GET /home/api/emission-projects/{id}/review-workflow'
    WHEN 'EMISSION_CALCULATION_04_APPROVE' THEN 'POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision; GET /home/api/emission-projects/{id}/calculation' END,
  requires_user_page=true,requires_admin_page=true,requires_api=true,requires_database=true,
  automation_status='VERIFIED'
WHERE process_code='EMISSION_CALCULATION';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

DELETE FROM framework_professional_screen_contract WHERE process_code='EMISSION_CALCULATION';
WITH contract_map(target_step,source_step,user_route,admin_route) AS (
  VALUES
    ('EMISSION_CALCULATION_01_PLAN','EMISSION_PROJECT_SETUP','/emission/project/detail','/admin/emission/project-operations'),
    ('EMISSION_CALCULATION_02_WORK','EMISSION_PROJECT_CALCULATE','/emission/calculation','/admin/emission/calculation-rule'),
    ('EMISSION_CALCULATION_03_VERIFY','EMISSION_PROJECT_VALIDATE','/emission/validate','/admin/emission/validate'),
    ('EMISSION_CALCULATION_04_APPROVE','EMISSION_PROJECT_APPROVE','/emission/calculation-results','/admin/emission/result_list')
)
INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
  entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
  command_contract,state_contract,api_contract,data_contract,evidence_contract,
  responsive_contract,accessibility_contract,security_contract,api_verified,
  database_verified,authority_verified,responsive_verified,accessibility_verified,
  exception_states_verified,audit_evidence_ref,contract_status,updated_by,
  menu_visibility,menu_verified
)
SELECT 'EMISSION_CALCULATION',m.target_step,c.audience,
       CASE c.audience WHEN 'ADMIN' THEN m.admin_route ELSE m.user_route END,
       CASE m.target_step
         WHEN 'EMISSION_CALCULATION_01_PLAN' THEN '산정 계획·범위 확인'
         WHEN 'EMISSION_CALCULATION_02_WORK' THEN '배출계수 매핑·배출량 산정'
         WHEN 'EMISSION_CALCULATION_03_VERIFY' THEN '산정 결과 검증·보완'
         ELSE '산정 결과 승인·확정' END,
       c.actor_code,c.business_purpose,c.entry_condition,c.exit_condition,c.kpi_contract,
       c.section_contract,c.field_contract,c.command_contract,c.state_contract,c.api_contract,
       '["emission_project_registry","emission_activity_data","emission_factor_reference","emission_calculation_run","emission_calculation_item","emission_activity_quality_run","emission_submission_review"]',
       'tenant/project/actor authorization; factor source and unit evidence; immutable calculation version; quality and approval audit evidence',
       c.responsive_contract,c.accessibility_contract,c.security_contract,
       true,true,true,true,true,true,
       'implemented:EmissionProjectRegistryController+EmissionProjectRegistryService+calculation-schema+common-design-assets',
       'VERIFIED','FLYWAY','HIDDEN',true
FROM contract_map m
JOIN framework_professional_screen_contract c
  ON c.process_code='EMISSION_PROJECT' AND c.step_code=m.source_step
JOIN framework_process_step s
  ON s.process_code='EMISSION_CALCULATION' AND s.step_code=m.target_step;

-- Produce the same complete, selectable delivery workload used by ACTIVITY_DATA.
INSERT INTO framework_development_job(
  process_code,step_code,job_type,job_name,target_path,specification_json,
  job_status,approval_status,evidence_ref,created_by
)
SELECT 'EMISSION_CALCULATION',
       replace(j.step_code,'ACTIVITY_DATA','EMISSION_CALCULATION'),j.job_type,
       replace(j.job_name,'활동자료','배출량 산정'),
       CASE replace(j.step_code,'ACTIVITY_DATA','EMISSION_CALCULATION')
         WHEN 'EMISSION_CALCULATION_01_PLAN' THEN CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/project-operations' WHEN j.job_type='FRONTEND_USER' THEN '/emission/project/detail' ELSE coalesce(j.target_path,'') END
         WHEN 'EMISSION_CALCULATION_02_WORK' THEN CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/calculation-rule' WHEN j.job_type='FRONTEND_USER' THEN '/emission/calculation' ELSE coalesce(j.target_path,'') END
         WHEN 'EMISSION_CALCULATION_03_VERIFY' THEN CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/validate' WHEN j.job_type='FRONTEND_USER' THEN '/emission/validate' ELSE coalesce(j.target_path,'') END
         ELSE CASE WHEN j.job_type='FRONTEND_ADMIN' THEN '/admin/emission/result_list' WHEN j.job_type='FRONTEND_USER' THEN '/emission/calculation-results' ELSE coalesce(j.target_path,'') END END,
       replace(j.specification_json,'ACTIVITY_DATA','EMISSION_CALCULATION'),
       'PLANNED','APPROVED',null,'FLYWAY'
FROM framework_development_job j
WHERE j.process_code='ACTIVITY_DATA'
ON CONFLICT(process_code,step_code,job_type,target_path) DO UPDATE SET
  job_name=excluded.job_name,specification_json=excluded.specification_json,
  approval_status='APPROVED',updated_at=current_timestamp;

UPDATE framework_process_artifact
SET delivery_status=CASE WHEN artifact_type='PAGE' THEN 'IMPLEMENTED' ELSE 'PLANNED' END,
    evidence_ref=null,updated_at=current_timestamp
WHERE process_code='EMISSION_CALCULATION';

UPDATE framework_process_definition
SET process_version='1.1.0',process_status='IN_DEVELOPMENT',automation_mode='AUTOMATIC',
    definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: executable calculation contracts verified',
    updated_at=current_timestamp
WHERE process_code='EMISSION_CALCULATION';

DO $$
DECLARE validation record;
BEGIN
  SELECT * INTO validation FROM framework_validate_process_design('EMISSION_CALCULATION','MIGRATION_CALCULATION_DELIVERY');
  IF validation.blocker_count <> 0 THEN
    RAISE EXCEPTION 'EMISSION_CALCULATION_DESIGN_BLOCKED:%', validation.blocker_count;
  END IF;
END $$;
