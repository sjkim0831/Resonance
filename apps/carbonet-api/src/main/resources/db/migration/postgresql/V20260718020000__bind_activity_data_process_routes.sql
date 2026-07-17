UPDATE framework_process_step
SET user_path = CASE step_code
      WHEN 'ACTIVITY_DATA_01_PLAN' THEN '/emission/project/settings'
      WHEN 'ACTIVITY_DATA_02_WORK' THEN '/emission/activity-data'
      WHEN 'ACTIVITY_DATA_03_VERIFY' THEN '/emission/validate'
      WHEN 'ACTIVITY_DATA_04_APPROVE' THEN '/emission/validate?tab=approval'
    END,
    admin_path = CASE step_code
      WHEN 'ACTIVITY_DATA_01_PLAN' THEN '/admin/emission/project-operations'
      WHEN 'ACTIVITY_DATA_02_WORK' THEN '/admin/emission/survey-admin-data'
      WHEN 'ACTIVITY_DATA_03_VERIFY' THEN '/admin/emission/validate'
      WHEN 'ACTIVITY_DATA_04_APPROVE' THEN '/admin/emission/approval-workflow'
    END,
    requires_user_page = true,
    requires_admin_page = true
WHERE process_code = 'ACTIVITY_DATA'
  AND step_code IN ('ACTIVITY_DATA_01_PLAN','ACTIVITY_DATA_02_WORK','ACTIVITY_DATA_03_VERIFY','ACTIVITY_DATA_04_APPROVE');
