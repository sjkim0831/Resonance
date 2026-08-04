UPDATE framework_process_navigation_binding
SET navigation_type='IMPLEMENTED_SCREEN',
    business_screen_implemented=true,
    binding_status='ACTIVE',
    binding_source='WORK_ASSIGNMENT_RUNTIME_VERIFIED',
    verified_at=current_timestamp,
    updated_at=current_timestamp
WHERE process_code='WORK_ASSIGNMENT'
  AND target_path='/emission/project-portfolio?assignment=1';
