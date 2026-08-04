INSERT INTO framework_process_navigation_binding(
  process_code,menu_code,step_code,actor_code,audience,navigation_type,target_path,
  business_screen_implemented,binding_status,binding_source,verified_at
)
VALUES(
  'WORK_ASSIGNMENT','H10201','WORK_ASSIGNMENT_CONTEXT','WORK_ASSIGNMENT_MANAGER','USER',
  'INTERNAL_TAB','/emission/project-portfolio?assignment=1',true,'ACTIVE',
  'WORK_ASSIGNMENT_RUNTIME',current_timestamp
)
ON CONFLICT(process_code) DO UPDATE SET
  menu_code=excluded.menu_code,step_code=excluded.step_code,actor_code=excluded.actor_code,
  audience=excluded.audience,navigation_type=excluded.navigation_type,target_path=excluded.target_path,
  business_screen_implemented=true,binding_status='ACTIVE',binding_source=excluded.binding_source,
  verified_at=current_timestamp,updated_at=current_timestamp;
