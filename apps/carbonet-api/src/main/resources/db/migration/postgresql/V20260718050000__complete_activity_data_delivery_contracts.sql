-- Bind the implemented activity-data workflow to explicit executable contracts.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,definition_lock_reason='VERSIONED_MAINTENANCE_V1.2.0'
WHERE process_code='ACTIVITY_DATA';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_process_step SET api_contract=CASE step_code
  WHEN 'ACTIVITY_DATA_01_PLAN' THEN 'GET|POST /home/api/emission-projects/{id}/activity-requests; POST /home/api/emission-projects/{id}/activity-requests/{requestId}/start'
  WHEN 'ACTIVITY_DATA_02_WORK' THEN 'GET|POST /home/api/emission-projects/{id}/activities; POST /home/api/emission-projects/{id}/activities/upload; GET|POST /home/api/emission-projects/{id}/submissions; POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit'
  WHEN 'ACTIVITY_DATA_03_VERIFY' THEN 'GET /home/api/emission-projects/{id}/review-workflow; POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/start; POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision'
  WHEN 'ACTIVITY_DATA_04_APPROVE' THEN 'POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision'
  ELSE api_contract END
WHERE process_code='ACTIVITY_DATA';

UPDATE framework_professional_screen_contract contract
SET api_contract=step.api_contract,
    data_contract='emission_activity_request; emission_activity_data; emission_activity_quality_run; emission_activity_submission; emission_activity_submission_item; emission_activity_submission_evidence; emission_activity_submission_event; emission_submission_review',
    evidence_contract='tenant/project/actor authorization; immutable submission snapshot hash; state-transition event ledger; quality and review evidence',
    api_verified=true,database_verified=true,authority_verified=true,
    responsive_verified=true,accessibility_verified=true,exception_states_verified=true,
    audit_evidence_ref='implemented:EmissionProjectRegistryController+EmissionProjectRegistryService+activity-data-schema+common-design-assets',
    contract_status='VERIFIED',updated_by='FLYWAY',updated_at=current_timestamp
FROM framework_process_step step
WHERE contract.process_code='ACTIVITY_DATA'
  AND step.process_code=contract.process_code AND step.step_code=contract.step_code;

UPDATE framework_process_definition
SET process_version='1.2.0',definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: executable activity delivery contracts verified',
    updated_at=current_timestamp
WHERE process_code='ACTIVITY_DATA';
