CREATE OR REPLACE FUNCTION framework_refresh_contract_design_tasks(requested_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE latest_id bigint; touched integer:=0; inserted integer:=0;
BEGIN
  SELECT max(compilation_id) INTO latest_id FROM framework_contract_compilation_run;
  UPDATE framework_contract_design_task task SET compilation_id=latest_id,
    task_contract=jsonb_build_object('taskType','CONTRACT_REPAIR','issueCode',issue.issue_code,
      'severity',issue.severity,'resourceKey',issue.resource_key,'fieldKey',issue.field_key,
      'message',issue.message,'evidence',issue.evidence_json,
      'constraints',jsonb_build_object('inventIds',false,'requireRegisteredEndpoint',true,
        'preserveActorProcessTraceability',true,'requireMobileContract',true)),
    updated_at=current_timestamp
  FROM framework_contract_compilation_issue issue
  WHERE issue.compilation_id=latest_id
    AND task.issue_code=issue.issue_code AND task.resource_key=issue.resource_key
    AND coalesce(task.field_key,'')=coalesce(issue.field_key,'');
  GET DIAGNOSTICS touched=ROW_COUNT;

  INSERT INTO framework_contract_design_task(
    task_id,compilation_id,issue_code,resource_key,field_key,task_contract)
  SELECT 'CDT-'||substr(md5(concat_ws('|',issue_code,resource_key,coalesce(field_key,''))),1,20),
    latest_id,issue_code,resource_key,field_key,
    jsonb_build_object('taskType','CONTRACT_REPAIR','issueCode',issue_code,
      'severity',severity,'resourceKey',resource_key,'fieldKey',field_key,
      'message',message,'evidence',evidence_json,
      'constraints',jsonb_build_object('inventIds',false,'requireRegisteredEndpoint',true,
        'preserveActorProcessTraceability',true,'requireMobileContract',true))
  FROM framework_contract_compilation_issue issue
  WHERE issue.compilation_id=latest_id AND NOT EXISTS (
    SELECT 1 FROM framework_contract_design_task task
    WHERE task.issue_code=issue.issue_code AND task.resource_key=issue.resource_key
      AND coalesce(task.field_key,'')=coalesce(issue.field_key,''))
  ORDER BY severity,issue_code,resource_key,field_key
  LIMIT greatest(1,least(coalesce(requested_limit,1000),1000))
  ON CONFLICT(task_id) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN jsonb_build_object('success',true,'compilationId',latest_id,
    'reused',touched,'inserted',inserted,'taskCount',touched+inserted);
END $$;
SELECT framework_refresh_contract_design_tasks(1000);
