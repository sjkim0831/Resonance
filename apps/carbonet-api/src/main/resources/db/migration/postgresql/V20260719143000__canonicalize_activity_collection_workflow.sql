-- Canonicalize the executable activity-data workflow while retaining the
-- legacy /emission/data_input route as a backwards-compatible application alias.

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked = false,
    definition_lock_reason = 'VERSIONED_MAINTENANCE_CANONICAL_ACTIVITY_ROUTE'
WHERE process_code IN ('EMISSION_PROJECT','ACTIVITY_DATA');
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE comtnmenuinfo
SET menu_url = '/emission/activity-data',
    last_updt_pnttm = current_timestamp
WHERE menu_url = '/emission/data_input';

UPDATE framework_process_step
SET user_path = '/emission/activity-data',
    api_contract = 'GET|POST /home/api/emission-projects/{id}/activities; POST /home/api/emission-projects/{id}/activities/upload; GET|POST /home/api/emission-projects/{id}/quality; GET|POST /home/api/emission-projects/{id}/submissions; POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit'
WHERE process_code IN ('EMISSION_PROJECT','ACTIVITY_DATA')
  AND step_code IN ('EMISSION_PROJECT_COLLECT','ACTIVITY_DATA_02_WORK');

UPDATE framework_professional_screen_contract
SET route_path = '/emission/activity-data',
    api_contract = 'GET|POST /home/api/emission-projects/{id}/activities; POST /home/api/emission-projects/{id}/activities/upload; GET|POST /home/api/emission-projects/{id}/quality; GET|POST /home/api/emission-projects/{id}/submissions; POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit',
    contract_status = 'VERIFIED',
    audit_evidence_ref = 'canonical:activity-data+quality+atomic-submission',
    updated_by = 'FLYWAY',
    updated_at = current_timestamp
WHERE process_code IN ('EMISSION_PROJECT','ACTIVITY_DATA')
  AND step_code IN ('EMISSION_PROJECT_COLLECT','ACTIVITY_DATA_02_WORK');

UPDATE framework_process_artifact
SET target_path = '/emission/activity-data',
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT'
  AND step_code = 'EMISSION_PROJECT_COLLECT'
  AND artifact_code = 'EP-PAGE-COLLECT';

UPDATE framework_screen_feature_binding
SET route_path = '/emission/activity-data',
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT'
  AND step_code = 'EMISSION_PROJECT_COLLECT'
  AND route_path = '/emission/data_input';

UPDATE emission_project_task
SET target_url = CASE task_code
      WHEN 'ACTIVITY_DATA' THEN '/emission/activity-data?projectId=' || project_id
      WHEN 'CALCULATION' THEN '/emission/calculation?projectId=' || project_id
      WHEN 'APPROVAL' THEN '/emission/validate?tab=approval&projectId=' || project_id
      ELSE target_url
    END,
    updated_at = current_timestamp
WHERE task_code IN ('ACTIVITY_DATA','CALCULATION','APPROVAL');

SELECT framework_refresh_menu_semantic_binding(menu_code)
FROM comtnmenuinfo
WHERE menu_url = '/emission/activity-data';

UPDATE framework_process_definition
SET definition_locked = true,
    definition_lock_reason = 'IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: canonical activity collection workflow',
    updated_at = current_timestamp
WHERE process_code IN ('EMISSION_PROJECT','ACTIVITY_DATA');
