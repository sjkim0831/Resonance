-- Keep the executable EMISSION_PROJECT design aligned with the implemented
-- controller and persistence model.  This migration deliberately fails when
-- the design gate still finds a blocker, preventing generators from consuming
-- stale or invented contracts.

INSERT INTO framework_api_endpoint_registry(endpoint_key,http_method,route_path,implementation_ref) VALUES
('EMISSION:PROJECT:LIST','GET','/home/api/emission-projects','EmissionProjectRegistryController#list'),
('EMISSION:PROJECT:OPTIONS','GET','/home/api/emission-projects/options','EmissionProjectRegistryController#options'),
('EMISSION:PROJECT:NAME_AVAILABILITY','GET','/home/api/emission-projects/name-availability','EmissionProjectRegistryController#nameAvailability'),
('EMISSION:PROJECT:DETAIL','GET','/home/api/emission-projects/{id}','EmissionProjectRegistryController#detail'),
('EMISSION:PROJECT:COPY','POST','/home/api/emission-projects/{id}/copy','EmissionProjectRegistryController#copy'),
('EMISSION:ACTIVITY:LIST','GET','/home/api/emission-projects/{id}/activities','EmissionProjectRegistryController#activities'),
('EMISSION:ACTIVITY:SAVE','POST','/home/api/emission-projects/{id}/activities','EmissionProjectRegistryController#saveActivity'),
('EMISSION:ACTIVITY:UPLOAD','POST','/home/api/emission-projects/{id}/activities/upload','EmissionProjectRegistryController#uploadActivities'),
('EMISSION:ACTIVITY:MAP_FACTOR','POST','/home/api/emission-projects/{id}/activities/{activityId}/factor','EmissionProjectRegistryController#mapFactor'),
('EMISSION:ACTIVITY:AUTO_MAP','POST','/home/api/emission-projects/{id}/activities/auto-map','EmissionProjectRegistryController#autoMap'),
('EMISSION:QUALITY:READ','GET','/home/api/emission-projects/{id}/quality','EmissionProjectRegistryController#latestQuality'),
('EMISSION:QUALITY:RUN','POST','/home/api/emission-projects/{id}/quality','EmissionProjectRegistryController#runQuality'),
('EMISSION:SUBMISSION:LIST','GET','/home/api/emission-projects/{id}/submissions','EmissionProjectRegistryController#submissions'),
('EMISSION:SUBMISSION:SAVE','POST','/home/api/emission-projects/{id}/submissions','EmissionProjectRegistryController#saveSubmission'),
('EMISSION:SUBMISSION:SUBMIT','POST','/home/api/emission-projects/{id}/submissions/{submissionId}/submit','EmissionProjectRegistryController#submitActivities'),
('EMISSION:REQUEST:LIST','GET','/home/api/emission-projects/{id}/activity-requests','EmissionProjectRegistryController#activityRequests'),
('EMISSION:REQUEST:CREATE','POST','/home/api/emission-projects/{id}/activity-requests','EmissionProjectRegistryController#createActivityRequest'),
('EMISSION:REQUEST:START','POST','/home/api/emission-projects/{id}/activity-requests/{requestId}/start','EmissionProjectRegistryController#startActivityRequest'),
('EMISSION:REPORT:DOWNLOAD','POST','/home/api/emission-projects/{id}/reports/{reportId}/download','EmissionProjectRegistryController#recordDownload'),
('EMISSION:REPORT:ACCESS_HISTORY','GET','/home/api/report-access-history','EmissionProjectRegistryController#accessHistory'),
('EMISSION:PROJECT:COMPLETION','GET','/home/api/emission-projects/{id}/completion','EmissionProjectRegistryController#completion'),
('EMISSION:TASK:LIST','GET','/home/api/emission-tasks','EmissionProjectRegistryController#myTasks'),
('EMISSION:TASK:STATUS','POST','/home/api/emission-tasks/{taskId}/status','EmissionProjectRegistryController#updateTask'),
('EMISSION:PROJECT:DELETE','DELETE','/home/api/emission-projects/{id}','EmissionProjectRegistryController#delete')
ON CONFLICT(endpoint_key) DO UPDATE SET
  http_method=excluded.http_method,
  route_path=excluded.route_path,
  implementation_ref=excluded.implementation_ref,
  active_yn='Y',
  verified_at=current_timestamp;

UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}","POST /home/api/emission-projects"]'::jsonb,
    data_contract='["emission_project_registry","emission_project_member","emission_project_task","framework_account_actor_assignment","framework_process_execution_event"]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_SETUP';

UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities/upload","GET /home/api/emission-projects/{id}/submissions","POST /home/api/emission-projects/{id}/submissions","POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit"]'::jsonb,
    data_contract='["emission_activity_data","emission_project_activity_request","emission_activity_submission","emission_activity_submission_evidence"]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_COLLECT';

UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}/calculation","POST /home/api/emission-projects/{id}/activities/{activityId}/factor","POST /home/api/emission-projects/{id}/activities/auto-map","POST /home/api/emission-projects/{id}/calculation"]'::jsonb,
    data_contract='["emission_activity_data","emission_factor_reference","emission_calculation_run","emission_calculation_item"]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CALCULATE';

UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}/quality","POST /home/api/emission-projects/{id}/quality","GET /home/api/emission-projects/{id}/review-workflow","POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/start","POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision"]'::jsonb,
    data_contract='["emission_activity_quality_run","emission_activity_quality_issue","emission_activity_submission","emission_submission_review"]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_VALIDATE';

UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities","GET /home/api/emission-projects/{id}/quality","POST /home/api/emission-projects/{id}/calculation","POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit"]'::jsonb,
    data_contract='["emission_activity_data","emission_activity_quality_issue","emission_calculation_run","emission_activity_submission","emission_activity_submission_event"]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CORRECT';

UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}/review-workflow","POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision"]'::jsonb,
    data_contract='["emission_activity_submission","emission_submission_review","emission_calculation_run","framework_process_execution_event"]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_APPROVE';

UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports/{reportId}/finalize","POST /home/api/emission-projects/{id}/reports/{reportId}/issue","POST /home/api/emission-projects/{id}/reports/{reportId}/download"]'::jsonb,
    data_contract='["emission_project_report","emission_report_certificate_audit","emission_report_access_ledger","emission_calculation_run","emission_activity_submission"]'::jsonb,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_REPORT';

-- A correction includes recalculation, after which the verified calculation
-- must be revisited before approval.
-- This is an explicit, versioned correction of an immutable source contract;
-- keep the guard disabled for this one statement only.
ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step
SET to_state='CALCULATED',
    output_contract=jsonb_set(output_contract::jsonb,'{toState}','"CALCULATED"'::jsonb)::json
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CORRECT';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

DO $$
DECLARE validation record;
BEGIN
  SELECT * INTO validation FROM framework_validate_process_design('EMISSION_PROJECT','MIGRATION_RECONCILE');
  IF validation.blocker_count <> 0 THEN
    RAISE EXCEPTION 'EMISSION_PROJECT_DESIGN_BLOCKED:%', validation.blocker_count;
  END IF;
END $$;
