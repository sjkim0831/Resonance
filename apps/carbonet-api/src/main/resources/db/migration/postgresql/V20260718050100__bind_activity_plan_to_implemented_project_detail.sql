-- Replace the non-existent planning route with the implemented project detail workspace.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,definition_lock_reason='VERSIONED_MAINTENANCE_V1.2.1'
WHERE process_code='ACTIVITY_DATA';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_process_step
SET user_path='/emission/project/detail'
WHERE process_code='ACTIVITY_DATA' AND step_code='ACTIVITY_DATA_01_PLAN';

UPDATE framework_professional_screen_contract
SET route_path='/emission/project/detail',
    audit_evidence_ref='implemented:EmissionProjectDetailPage+EmissionProjectRegistryController+EmissionProjectRegistryService',
    updated_by='FLYWAY',updated_at=current_timestamp
WHERE process_code='ACTIVITY_DATA' AND step_code='ACTIVITY_DATA_01_PLAN' AND audience='USER';

UPDATE framework_development_job
SET target_path='/emission/project/detail',updated_at=current_timestamp
WHERE process_code='ACTIVITY_DATA' AND step_code='ACTIVITY_DATA_01_PLAN' AND job_type='FRONTEND_USER';

UPDATE framework_process_definition
SET process_version='1.2.1',definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: activity planning uses project detail workspace',
    updated_at=current_timestamp
WHERE process_code='ACTIVITY_DATA';
