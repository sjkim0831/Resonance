-- The context step is a real three-control selection screen.  Its runtime UI
-- already renders these controls, but the executable design spec was compiled
-- before the professional screen metadata existed and therefore retained an
-- empty field/page contract.  Complete the design contract without claiming
-- runtime or E2E verification.
UPDATE framework_step_execution_spec
SET field_contract = jsonb_build_object(
      'schemaVersion', 1,
      'contractType', 'STEP_FIELDS',
      'fields', jsonb_build_array(
        jsonb_build_object(
          'fieldCode', 'workTypeCode', 'label', '업무 종류',
          'audience', 'USER', 'fieldOrder', 1,
          'dataType', 'STRING', 'controlType', 'SELECT',
          'required', true, 'editable', true,
          'source', 'framework_business_work_type'
        ),
        jsonb_build_object(
          'fieldCode', 'projectId', 'label', '배정 프로젝트',
          'audience', 'USER', 'fieldOrder', 2,
          'dataType', 'STRING', 'controlType', 'PROJECT_SELECT',
          'required', true, 'editable', true,
          'source', 'emission_project'
        ),
        jsonb_build_object(
          'fieldCode', 'processCode', 'label', '업무 프로세스',
          'audience', 'USER', 'fieldOrder', 3,
          'dataType', 'STRING', 'controlType', 'SELECT',
          'required', true, 'editable', true,
          'source', 'framework_process_definition'
        )
      )
    ),
    input_contract = jsonb_build_object(
      'schemaVersion', 1,
      'contractType', 'STEP_INPUT',
      'schema', jsonb_build_object(
        'required', jsonb_build_array(
          'tenantId', 'projectId', 'workTypeCode', 'processCode'
        )
      )
    ),
    screen_contract = jsonb_build_array(jsonb_build_object(
      'pageCode', 'WORK_ASSIGNMENT_CONTEXT_USER',
      'audience', 'USER',
      'screenType', 'PROCESS_ASSIGNMENT',
      'title', '업무 배정 문맥 선택',
      'purpose', '동일 기업 범위에서 업무 종류, 프로젝트와 프로세스를 선택한다.',
      'plannedRoute', '/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT',
      'actualRoute', '/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT',
      'routeStatus', 'IMPLEMENTED',
      'exceptions', jsonb_build_array('LOADING', 'EMPTY', 'FORBIDDEN', 'ERROR'),
      'responsive', jsonb_build_object(
        'mobile', 'single-column', 'tablet', 'adaptive-two-column',
        'desktop', 'task-optimized', 'noTextOverflow', true
      ),
      'accessibility', jsonb_build_object(
        'standard', 'WCAG 2.1 AA', 'keyboard', true,
        'focus', true, 'errorSummary', true
      )
    )),
    updated_at = current_timestamp
WHERE process_code = 'WORK_ASSIGNMENT'
  AND step_code = 'WORK_ASSIGNMENT_CONTEXT';

DO $$
DECLARE
  actual_fields integer;
  actual_pages integer;
BEGIN
  SELECT jsonb_array_length(field_contract->'fields'),
         jsonb_array_length(screen_contract)
    INTO actual_fields, actual_pages
  FROM framework_step_execution_spec
  WHERE process_code = 'WORK_ASSIGNMENT'
    AND step_code = 'WORK_ASSIGNMENT_CONTEXT';

  IF actual_fields IS DISTINCT FROM 3 OR actual_pages IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION
      'WORK_ASSIGNMENT_CONTEXT contract closure failed fields=% pages=%',
      actual_fields, actual_pages;
  END IF;
END $$;
