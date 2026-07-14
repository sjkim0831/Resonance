UPDATE emission_project_task
SET target_url = CASE task_code
    WHEN 'BASIC_INFO' THEN '/emission/project/detail?id=' || project_id
    WHEN 'ACTIVITY_DATA' THEN '/emission/data_input?projectId=' || project_id
    WHEN 'CALCULATION' THEN '/emission/simulate?projectId=' || project_id
    WHEN 'VERIFICATION' THEN '/emission/validate?projectId=' || project_id
    WHEN 'APPROVAL' THEN '/emission/validate?projectId=' || project_id
    WHEN 'REPORT' THEN '/emission/report_submit?projectId=' || project_id
    ELSE target_url
END,
updated_at = CURRENT_TIMESTAMP
WHERE task_code IN ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT');
