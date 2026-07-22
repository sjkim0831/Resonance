-- Professional contracts use structured JSON objects. The original validator
-- only understood arrays of strings and therefore treated each complete object
-- as a missing table while silently skipping structured API endpoints.
CREATE OR REPLACE FUNCTION framework_contract_relation_name(contract_item jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(contract_item)
    WHEN 'string' THEN contract_item #>> '{}'
    WHEN 'object' THEN coalesce(contract_item->>'entity', contract_item->>'view', '')
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION framework_contract_api_endpoint(contract_item jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(contract_item)
    WHEN 'string' THEN contract_item #>> '{}'
    WHEN 'object' THEN CASE
      WHEN coalesce(contract_item->>'method','') <> '' AND coalesce(contract_item->>'path','') <> ''
      THEN upper(contract_item->>'method') || ' ' || (contract_item->>'path')
      ELSE ''
    END
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION framework_validate_process_design(
  p_process_code text,
  p_actor text DEFAULT 'SYSTEM'
)
RETURNS TABLE(
  validation_status text,
  blocker_count integer,
  warning_count integer,
  validation_run_id bigint
)
LANGUAGE plpgsql AS $$
DECLARE
  v_issues jsonb;
  v_blockers integer;
  v_warnings integer;
  v_run bigint;
  v_hash text;
BEGIN
  WITH issues AS (
    SELECT s.step_code,'STATE_OUTPUT_MISMATCH' code,'BLOCKER' severity,
           'outputContract.toState does not match the step toState.' message
    FROM framework_process_step s
    WHERE s.process_code=p_process_code
      AND coalesce((s.output_contract::jsonb->>'toState'),'')<>s.to_state
    UNION ALL
    SELECT s.step_code,'NEXT_STATE_UNREACHABLE','BLOCKER',
           'The next state is not reachable from another step or an explicit branch.'
    FROM framework_process_step s
    WHERE s.process_code=p_process_code AND s.to_state<>'COMPLETED'
      AND NOT EXISTS(
        SELECT 1 FROM framework_process_step n
        WHERE n.process_code=s.process_code AND n.from_state=s.to_state
      )
    UNION ALL
    SELECT s.step_code,'USER_SCREEN_CONTRACT_MISSING','BLOCKER',
           'The user route has no professional screen contract.'
    FROM framework_process_step s
    WHERE s.process_code=p_process_code AND s.requires_user_page
      AND NOT EXISTS(
        SELECT 1 FROM framework_professional_screen_contract c
        WHERE c.process_code=s.process_code AND c.step_code=s.step_code AND c.audience='USER'
          AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.user_path,'?',1))
      )
    UNION ALL
    SELECT s.step_code,'ADMIN_SCREEN_CONTRACT_MISSING','BLOCKER',
           'The administrator route has no professional screen contract.'
    FROM framework_process_step s
    WHERE s.process_code=p_process_code AND s.requires_admin_page
      AND NOT EXISTS(
        SELECT 1 FROM framework_professional_screen_contract c
        WHERE c.process_code=s.process_code AND c.step_code=s.step_code AND c.audience='ADMIN'
          AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.admin_path,'?',1))
      )
    UNION ALL
    SELECT c.step_code,'API_ENDPOINT_NOT_IMPLEMENTED','BLOCKER',
           'The API endpoint is not present in the verified implementation registry: '||api.endpoint
    FROM framework_professional_screen_contract c
    CROSS JOIN LATERAL jsonb_array_elements(framework_try_jsonb(c.api_contract)) item(value)
    CROSS JOIN LATERAL (
      SELECT framework_contract_api_endpoint(item.value) endpoint
    ) api
    WHERE c.process_code=p_process_code AND api.endpoint~'^(GET|POST|PUT|PATCH|DELETE) '
      AND NOT EXISTS(
        SELECT 1 FROM framework_api_endpoint_registry r
        WHERE r.active_yn='Y' AND upper(r.http_method)||' '||r.route_path=api.endpoint
      )
    UNION ALL
    SELECT c.step_code,'DATA_ENTITY_NOT_IMPLEMENTED','BLOCKER',
           'The data relation is not present in the database: '||data.relation_name
    FROM framework_professional_screen_contract c
    CROSS JOIN LATERAL jsonb_array_elements(framework_try_jsonb(c.data_contract)) item(value)
    CROSS JOIN LATERAL (
      SELECT framework_contract_relation_name(item.value) relation_name
    ) data
    WHERE c.process_code=p_process_code AND data.relation_name<>''
      AND to_regclass(data.relation_name) IS NULL
    UNION ALL
    SELECT b.step_code,'FEATURE_NOT_INSTALLED','WARNING',
           'A required common feature is not installed: '||b.feature_code
    FROM framework_screen_feature_binding b
    WHERE b.process_code=p_process_code AND b.required_yn='Y'
      AND NOT EXISTS(
        SELECT 1 FROM framework_feature_installation i
        WHERE i.project_scope='PLATFORM' AND i.feature_code=b.feature_code
          AND i.installation_status='INSTALLED'
      )
  )
  SELECT coalesce(
           jsonb_agg(
             jsonb_build_object(
               'stepCode',step_code,'code',code,'severity',severity,'message',message
             ) ORDER BY step_code,code
           ),
           '[]'::jsonb
         ),
         count(*) FILTER(WHERE severity='BLOCKER'),
         count(*) FILTER(WHERE severity='WARNING')
  INTO v_issues,v_blockers,v_warnings
  FROM issues;

  SELECT md5(string_agg(
           concat_ws('|',step_code,from_state,to_state,input_contract,output_contract,user_path,admin_path,api_contract),
           '~' ORDER BY step_order
         ))
  INTO v_hash
  FROM framework_process_step
  WHERE process_code=p_process_code;

  INSERT INTO framework_process_design_validation_run(
    process_code,validation_status,blocker_count,warning_count,result_json,
    source_fingerprint,executed_by
  )
  VALUES(
    p_process_code,
    CASE WHEN v_blockers=0 THEN 'PASSED' ELSE 'BLOCKED' END,
    v_blockers,v_warnings,v_issues,coalesce(v_hash,''),p_actor
  )
  RETURNING framework_process_design_validation_run.validation_run_id INTO v_run;

  RETURN QUERY SELECT
    CASE WHEN v_blockers=0 THEN 'PASSED' ELSE 'BLOCKED' END,
    v_blockers,v_warnings,v_run;
END $$;

INSERT INTO framework_api_endpoint_registry(
  endpoint_key,http_method,route_path,implementation_ref,active_yn,verified_at
)
VALUES
  ('GOVERNANCE:DASHBOARD','GET','/admin/api/system/actor-process','ActorProcessGovernanceApiController#dashboard','Y',current_timestamp),
  ('GOVERNANCE:CASES','GET','/admin/api/system/actor-process/cases','ActorProcessGovernanceApiController#cases','Y',current_timestamp),
  ('GOVERNANCE:EXECUTION:READ','GET','/home/api/process-executions','ProcessExecutionApiController#execution','Y',current_timestamp),
  ('GOVERNANCE:SCREEN_CONTRACT','GET','/home/api/process-executions/screen-contract','ProcessExecutionApiController#screenContract','Y',current_timestamp),
  ('GOVERNANCE:EXECUTION:START','POST','/home/api/process-executions/start','ProcessExecutionApiController#start','Y',current_timestamp),
  ('GOVERNANCE:EXECUTION:COMMAND','POST','/home/api/process-executions/{executionId}/commands','ProcessExecutionApiController#command','Y',current_timestamp),
  ('GOVERNANCE:DRAFT:READ','GET','/home/api/process-executions/draft','ProcessExecutionApiController#draft','Y',current_timestamp),
  ('GOVERNANCE:DRAFT:SAVE','PUT','/home/api/process-executions/draft','ProcessExecutionApiController#saveDraft','Y',current_timestamp)
ON CONFLICT(http_method,route_path) DO UPDATE SET
  implementation_ref=excluded.implementation_ref,
  active_yn='Y',
  verified_at=current_timestamp;

UPDATE framework_professional_screen_contract
SET api_contract=jsonb_build_array(
      jsonb_build_object('method','GET','path','/admin/api/system/actor-process'),
      jsonb_build_object('method','GET','path','/admin/api/system/actor-process/cases'),
      jsonb_build_object('method','GET','path','/home/api/process-executions'),
      jsonb_build_object('method','GET','path','/home/api/process-executions/screen-contract'),
      jsonb_build_object('method','POST','path','/home/api/process-executions/start'),
      jsonb_build_object('method','POST','path','/home/api/process-executions/{executionId}/commands'),
      jsonb_build_object('method','GET','path','/home/api/process-executions/draft'),
      jsonb_build_object('method','PUT','path','/home/api/process-executions/draft')
    )::text,
    data_contract=jsonb_build_array(
      jsonb_build_object('entity','framework_process_definition','versionColumn','process_version'),
      jsonb_build_object('entity','framework_process_step','relation','ordered state machine'),
      jsonb_build_object('entity','framework_account_actor_assignment','scope','tenant and project'),
      jsonb_build_object('entity','framework_process_execution','state','server authoritative'),
      jsonb_build_object('entity','framework_process_execution_event','audit','append only'),
      jsonb_build_object('entity','framework_process_work_draft','optimistic','draft_version'),
      jsonb_build_object('entity','framework_simulation_case','relation','safety expectations'),
      jsonb_build_object('entity','framework_development_job','relation','implementation evidence'),
      jsonb_build_object('view','framework_process_development_progress'),
      jsonb_build_object('view','framework_process_design_assurance_matrix')
    )::text,
    updated_by='STRUCTURED_CONTRACT_VALIDATION',
    updated_at=current_timestamp
WHERE process_code='GOVERNANCE_CHANGE';

DO $$
DECLARE
  validation record;
BEGIN
  SELECT * INTO validation
  FROM framework_validate_process_design('GOVERNANCE_CHANGE','STRUCTURED_CONTRACT_VALIDATION');
  IF validation.blocker_count<>0 THEN
    RAISE EXCEPTION 'GOVERNANCE_CHANGE_DESIGN_BLOCKED:%',validation.blocker_count;
  END IF;
END $$;
