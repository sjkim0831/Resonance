UPDATE framework_step_execution_spec
SET screen_contract = jsonb_build_array(jsonb_build_object(
        'pageCode', CASE step_code
            WHEN 'MEMBER_LIFECYCLE_03_VERIFY' THEN 'MEMBER_LIFECYCLE_VERIFY_WORKSPACE_ADMIN'
            ELSE 'MEMBER_LIFECYCLE_APPROVE_WORKSPACE_ADMIN'
        END,
        'title', CASE step_code
            WHEN 'MEMBER_LIFECYCLE_03_VERIFY' THEN '회원 생명주기 검증·보완 작업공간'
            ELSE '회원 생명주기 승인·확정 작업공간'
        END,
        'audience', 'ADMIN',
        'screenType', 'PROCESS_WORKSPACE',
        'actualRoute', concat('/admin/system/process-workspace?process=MEMBER_LIFECYCLE&step=', step_code),
        'routeStatus', 'IMPLEMENTED',
        'primaryEntity', 'framework_step_execution_spec',
        'sections', jsonb_build_array(
            jsonb_build_object('code', 'PROCESS_SEQUENCE', 'fields', jsonb_build_array('processCode', 'stepCode', 'stepOrder', 'stepName', 'actorCode', 'fromState', 'toState')),
            jsonb_build_object('code', 'SELECTED_STEP_CONTRACT', 'fields', jsonb_build_array('requirementText', 'inputContract', 'outputContract', 'apiContract', 'completionRule', 'userPath', 'adminPath')),
            jsonb_build_object('code', 'TEST_EVIDENCE', 'fields', jsonb_build_array('caseCode', 'caseName', 'caseType', 'status')),
            jsonb_build_object('code', 'DEVELOPMENT_EVIDENCE', 'fields', jsonb_build_array('jobId', 'jobName', 'jobType', 'targetPath', 'jobStatus'))
        ),
        'responsive', jsonb_build_object('desktop', 'process sequence and contract workspace', 'mobile', 'single-column contract cards', 'overflow', 'local-only'),
        'accessibility', jsonb_build_object('standard', 'WCAG 2.1 AA', 'ariaCurrentStep', true, 'labels', true, 'keyboard', true),
        'security', jsonb_build_object('serverAuthorization', true, 'anonymousFailClosed', true, 'auditRequired', true),
        'stateBinding', jsonb_build_object('queryProcess', 'process', 'queryStep', 'step', 'selectedStepRequired', true)
    )),
    updated_at = CURRENT_TIMESTAMP
WHERE process_code = 'MEMBER_LIFECYCLE'
  AND step_code IN ('MEMBER_LIFECYCLE_03_VERIFY', 'MEMBER_LIFECYCLE_04_APPROVE')
  AND screen_contract IN ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb);
