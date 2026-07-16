UPDATE framework_process_step
SET admin_path='/admin/emission/project-operations',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_SETUP';

UPDATE framework_professional_screen_contract
SET route_path='/admin/emission/project-operations',screen_name='배출량 프로젝트 운영',menu_code=NULL,
    menu_verified=false,api_verified=false,database_verified=false,authority_verified=false,
    responsive_verified=false,accessibility_verified=false,exception_states_verified=false,
    audit_evidence_ref='',contract_status='REVIEW_REQUIRED',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_SETUP' AND audience='ADMIN';
