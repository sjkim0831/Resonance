-- WORK_ASSIGNMENT was functionally verified but had no field-level design contract.
-- Keep the contract aligned with the live GET/POST /home/api/work-assignments payload.
DO $$
DECLARE
  affected integer;
  invalid integer;
BEGIN
  UPDATE framework_professional_screen_contract c
  SET field_contract = (
    jsonb_build_array(
      jsonb_build_object('fieldCode','projectId','fieldName','프로젝트','fieldGroup','업무 문맥','fieldOrder',10,'dataType','STRING','controlType','PROJECT_SELECT','required',true,'editable',true,'apiProperty','projectId','sourceTable','emission_project_registry','sourceColumn','project_id','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
      jsonb_build_object('fieldCode','workTypeCode','fieldName','업무 종류','fieldGroup','업무 문맥','fieldOrder',20,'dataType','CODE','controlType','WORK_TYPE_SELECT','required',true,'editable',true,'apiProperty','workTypeCode','sourceTable','framework_business_work_type','sourceColumn','work_type_code','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
      jsonb_build_object('fieldCode','processCode','fieldName','업무 프로세스','fieldGroup','업무 문맥','fieldOrder',30,'dataType','CODE','controlType','PROCESS_SELECT','required',true,'editable',true,'apiProperty','processCode','sourceTable','framework_process_definition','sourceColumn','process_code','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
      jsonb_build_object('fieldCode','processAccountId','fieldName','프로세스 담당 계정','fieldGroup','담당자 배정','fieldOrder',40,'dataType','STRING','controlType','ACCOUNT_SELECT','required',true,'editable',true,'apiProperty','processAccountId','sourceTable','framework_project_process_step_assignment','sourceColumn','account_id','mappingStatus','DB_RESOLVED','privacyClass','PERSONAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
      jsonb_build_object('fieldCode','stepCode','fieldName','절차 코드','fieldGroup','절차 배정','fieldOrder',50,'dataType','CODE','controlType','HIDDEN','required',true,'editable',false,'apiProperty','assignments[].stepCode','sourceTable','framework_process_step','sourceColumn','step_code','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
      jsonb_build_object('fieldCode','stepOrder','fieldName','절차 순서','fieldGroup','절차 배정','fieldOrder',60,'dataType','INTEGER','controlType','ORDER_BADGE','required',true,'editable',false,'apiProperty','steps[].stepOrder','sourceTable','framework_process_step','sourceColumn','step_order','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
      jsonb_build_object('fieldCode','actorCode','fieldName','담당 액터','fieldGroup','절차 배정','fieldOrder',70,'dataType','CODE','controlType','ACTOR_VIEW','required',true,'editable',false,'apiProperty','steps[].actorCode','sourceTable','framework_process_step','sourceColumn','actor_code','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
      jsonb_build_object('fieldCode','accountId','fieldName','절차 담당 계정','fieldGroup','절차 배정','fieldOrder',80,'dataType','STRING','controlType','ACCOUNT_SELECT','required',true,'editable',true,'apiProperty','assignments[].accountId','sourceTable','framework_project_process_step_assignment','sourceColumn','account_id','mappingStatus','DB_RESOLVED','privacyClass','PERSONAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER')
    ) || CASE c.step_code
      WHEN 'WORK_ASSIGNMENT_CONTEXT' THEN jsonb_build_array(
        jsonb_build_object('fieldCode','projectName','fieldName','프로젝트명','fieldGroup','업무 문맥','fieldOrder',90,'dataType','STRING','controlType','READONLY_TEXT','required',true,'editable',false,'apiProperty','projects[].projectName','sourceTable','emission_project_registry','sourceColumn','project_name','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
        jsonb_build_object('fieldCode','processVersion','fieldName','프로세스 버전','fieldGroup','업무 문맥','fieldOrder',100,'dataType','INTEGER','controlType','VERSION_BADGE','required',true,'editable',false,'apiProperty','processVersion','sourceTable','framework_process_definition','sourceColumn','process_version','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'))
      WHEN 'WORK_ASSIGNMENT_ACTOR' THEN jsonb_build_array(
        jsonb_build_object('fieldCode','actorDefaultAccountId','fieldName','액터 기본 계정','fieldGroup','담당자 배정','fieldOrder',90,'dataType','STRING','controlType','ACTOR_ACCOUNT_SELECT','required',false,'editable',true,'apiProperty','actorDefaults[].accountId','sourceTable','framework_project_process_step_assignment','sourceColumn','account_id','mappingStatus','DB_RESOLVED','privacyClass','PERSONAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
        jsonb_build_object('fieldCode','department','fieldName','소속 부서','fieldGroup','담당자 배정','fieldOrder',100,'dataType','STRING','controlType','ACCOUNT_META','required',false,'editable',false,'apiProperty','accounts[].department','sourceTable','comtnemplyrinfo','sourceColumn','ofcps_nm','mappingStatus','DB_RESOLVED','privacyClass','PERSONAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'))
      WHEN 'WORK_ASSIGNMENT_STEP' THEN jsonb_build_array(
        jsonb_build_object('fieldCode','assignments','fieldName','절차별 배정 목록','fieldGroup','절차 배정','fieldOrder',90,'dataType','ARRAY','controlType','ASSIGNMENT_SWIMLANE','required',true,'editable',true,'apiProperty','assignments','sourceTable','framework_project_process_step_assignment','sourceColumn','step_code,account_id','mappingStatus','DB_RESOLVED','privacyClass','PERSONAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
        jsonb_build_object('fieldCode','unassignedCount','fieldName','미배정 절차 수','fieldGroup','완료 조건','fieldOrder',100,'dataType','INTEGER','controlType','VALIDATION_SUMMARY','required',true,'editable',false,'apiProperty','unassignedCount','sourceTable',null,'sourceColumn',null,'mappingStatus','CALCULATED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'))
      WHEN 'WORK_ASSIGNMENT_CONFIRM' THEN jsonb_build_array(
        jsonb_build_object('fieldCode','assignedStepCount','fieldName','저장된 절차 수','fieldGroup','저장 결과','fieldOrder',90,'dataType','INTEGER','controlType','RESULT_METRIC','required',true,'editable',false,'apiProperty','assignedStepCount','sourceTable','framework_project_process_step_assignment','sourceColumn','step_code','mappingStatus','DB_AGGREGATE','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
        jsonb_build_object('fieldCode','updatedTaskCount','fieldName','동기화된 태스크 수','fieldGroup','저장 결과','fieldOrder',100,'dataType','INTEGER','controlType','RESULT_METRIC','required',true,'editable',false,'apiProperty','updatedTaskCount','sourceTable','emission_project_task','sourceColumn','task_id','mappingStatus','DB_AGGREGATE','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'),
        jsonb_build_object('fieldCode','auditEvidenceId','fieldName','감사 증적 ID','fieldGroup','저장 결과','fieldOrder',110,'dataType','UUID','controlType','AUDIT_LINK','required',true,'editable',false,'apiProperty','auditEvidenceId','sourceTable','framework_work_assignment_audit','sourceColumn','audit_id','mappingStatus','DB_RESOLVED','privacyClass','INTERNAL','permissionCode','WORK_ASSIGNMENT_MANAGER:USER'))
      ELSE '[]'::jsonb END
  )::text,
      data_contract = '["framework_business_work_type","framework_process_definition","framework_process_step","framework_project_process_step_assignment","emission_project_task","framework_work_assignment_audit","emission_workflow_notification"]',
      updated_by = 'V20260811185500', updated_at = current_timestamp
  WHERE c.process_code = 'WORK_ASSIGNMENT';

  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 4 THEN RAISE EXCEPTION 'WORK_ASSIGNMENT contract count mismatch: %', affected; END IF;

  SELECT count(*) INTO invalid
  FROM framework_professional_screen_contract c
  CROSS JOIN LATERAL jsonb_array_elements(c.field_contract::jsonb) f
  WHERE c.process_code='WORK_ASSIGNMENT'
    AND (coalesce(f->>'fieldCode','')='' OR coalesce(f->>'apiProperty','')=''
      OR coalesce(f->>'mappingStatus','')='' OR coalesce(f->>'permissionCode','')='');
  IF invalid <> 0 THEN RAISE EXCEPTION 'WORK_ASSIGNMENT invalid field contracts: %', invalid; END IF;
END $$;
