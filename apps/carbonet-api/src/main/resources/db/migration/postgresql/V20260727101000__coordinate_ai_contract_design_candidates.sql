CREATE TABLE IF NOT EXISTS framework_contract_design_task (
  task_id varchar(100) PRIMARY KEY,
  compilation_id bigint NOT NULL REFERENCES framework_contract_compilation_run(compilation_id) ON DELETE CASCADE,
  issue_code varchar(80) NOT NULL,
  resource_key varchar(1000) NOT NULL,
  field_key varchar(500),
  task_contract jsonb NOT NULL,
  task_status varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK(task_status IN ('PLANNED','CANDIDATE_READY','SELECTED','REJECTED','APPLIED')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS framework_contract_design_candidate (
  candidate_id bigserial PRIMARY KEY,
  task_id varchar(100) NOT NULL REFERENCES framework_contract_design_task(task_id) ON DELETE CASCADE,
  model_name varchar(120) NOT NULL,
  lane_no integer NOT NULL,
  candidate_json jsonb NOT NULL,
  candidate_hash varchar(64) NOT NULL,
  validation_status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK(validation_status IN ('PENDING','VALID','INVALID')),
  validation_message text,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(task_id,candidate_hash)
);
CREATE TABLE IF NOT EXISTS framework_contract_design_selection (
  selection_id bigserial PRIMARY KEY,
  task_id varchar(100) NOT NULL REFERENCES framework_contract_design_task(task_id) ON DELETE CASCADE,
  candidate_id bigint REFERENCES framework_contract_design_candidate(candidate_id) ON DELETE SET NULL,
  selector_model varchar(120) NOT NULL,
  decision varchar(20) NOT NULL CHECK(decision IN ('SELECT','REJECT','REVIEW')),
  confidence numeric(5,4) NOT NULL,
  reason text NOT NULL,
  selected_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE OR REPLACE FUNCTION framework_refresh_contract_design_tasks(requested_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE latest_id bigint; added integer;
BEGIN
  SELECT max(compilation_id) INTO latest_id FROM framework_contract_compilation_run;
  INSERT INTO framework_contract_design_task(
    task_id,compilation_id,issue_code,resource_key,field_key,task_contract)
  SELECT 'CDT-'||latest_id||'-'||row_number() over(order by severity,issue_code,resource_key,field_key),
    latest_id,issue_code,resource_key,field_key,
    jsonb_build_object('taskType','CONTRACT_REPAIR','issueCode',issue_code,
      'severity',severity,'resourceKey',resource_key,'fieldKey',field_key,
      'message',message,'evidence',evidence_json,
      'constraints',jsonb_build_object(
        'inventIds',false,'requireRegisteredEndpoint',true,
        'preserveActorProcessTraceability',true,'requireMobileContract',true))
  FROM framework_contract_compilation_issue
  WHERE compilation_id=latest_id
  ORDER BY severity,issue_code,resource_key,field_key
  LIMIT greatest(1,least(coalesce(requested_limit,1000),1000))
  ON CONFLICT(task_id) DO UPDATE SET task_contract=excluded.task_contract,updated_at=current_timestamp;
  GET DIAGNOSTICS added=ROW_COUNT;
  RETURN jsonb_build_object('success',true,'compilationId',latest_id,'taskCount',added);
END $$;

CREATE OR REPLACE FUNCTION framework_contract_design_task_export(requested_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_agg(task_contract||jsonb_build_object('taskId',task_id)
    ORDER BY task_id),'[]'::jsonb)
  FROM (SELECT * FROM framework_contract_design_task
    WHERE task_status='PLANNED' ORDER BY task_id
    LIMIT greatest(1,least(coalesce(requested_limit,1000),1000))) task
$$;

CREATE OR REPLACE FUNCTION framework_import_contract_design_candidates(
  requested_payload jsonb, requested_model varchar
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE item jsonb; candidate jsonb; imported integer:=0; task varchar; hash varchar;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(coalesce(requested_payload->'candidates','[]'::jsonb))
  LOOP
    IF item->>'status'<>'CANDIDATE' THEN CONTINUE; END IF;
    task:=item->>'taskId'; candidate:=item->'candidate';
    hash:=(md5(candidate::text)||md5('AI_CANDIDATE_V1|'||candidate::text))::varchar;
    INSERT INTO framework_contract_design_candidate(
      task_id,model_name,lane_no,candidate_json,candidate_hash,validation_status,validation_message)
    VALUES(task,requested_model,mod(abs(hashtext(task)),16)+1,candidate,hash,
      CASE WHEN item->>'deterministicValidation'='VALID' THEN 'VALID' ELSE 'INVALID' END,
      CASE WHEN item->>'deterministicValidation'='VALID' THEN 'contract schema accepted'
        ELSE 'candidate contains forbidden or invalid structure' END)
    ON CONFLICT DO NOTHING;
    UPDATE framework_contract_design_task SET task_status='CANDIDATE_READY',
      updated_at=current_timestamp WHERE task_id=task;
    imported:=imported+1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'imported',imported);
END $$;

CREATE OR REPLACE FUNCTION framework_import_contract_design_selections(requested_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE item jsonb; imported integer:=0; selected_candidate bigint;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(coalesce(requested_payload->'selections','[]'::jsonb))
  LOOP
    SELECT candidate_id INTO selected_candidate FROM framework_contract_design_candidate
    WHERE task_id=item->>'taskId' AND validation_status='VALID'
    ORDER BY candidate_id DESC LIMIT 1;
    INSERT INTO framework_contract_design_selection(
      task_id,candidate_id,selector_model,decision,confidence,reason)
    VALUES(item->>'taskId',selected_candidate,requested_payload->>'model',
      CASE WHEN selected_candidate IS NULL THEN 'REVIEW'
        WHEN item->>'decision' IN ('SELECT','REJECT','REVIEW') THEN item->>'decision' ELSE 'REVIEW' END,
      greatest(0,least(coalesce((item->>'confidence')::numeric,0),1)),
      coalesce(item->>'reason','E4B selection result'));
    UPDATE framework_contract_design_task SET
      task_status=CASE WHEN selected_candidate IS NOT NULL AND item->>'decision'='SELECT'
        THEN 'SELECTED' WHEN item->>'decision'='REJECT' THEN 'REJECTED' ELSE 'CANDIDATE_READY' END,
      updated_at=current_timestamp WHERE task_id=item->>'taskId';
    imported:=imported+1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'imported',imported);
END $$;

SELECT framework_refresh_contract_design_tasks(1000);
