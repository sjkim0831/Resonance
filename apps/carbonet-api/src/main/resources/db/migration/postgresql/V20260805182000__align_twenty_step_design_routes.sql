WITH target AS (
  SELECT process_code,step_code,user_path
    FROM framework_process_step
   WHERE process_code IN (
     'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY',
     'ACTIVITY_DATA','EMISSION_CALCULATION'
   )
)
UPDATE framework_professional_screen_contract c
   SET route_path=t.user_path,
       field_contract=coalesce((
         SELECT jsonb_agg(field.value || jsonb_build_object('route',t.user_path)
                          ORDER BY coalesce((field.value->>'fieldOrder')::integer,9999),
                                   field.value->>'fieldCode')::text
           FROM jsonb_array_elements(framework_try_jsonb(c.field_contract)) field(value)
       ),'[]'::jsonb::text),
       updated_by='SYSTEM',
       updated_at=current_timestamp
  FROM target t
 WHERE c.process_code=t.process_code
   AND c.step_code=t.step_code
   AND c.audience='USER'
   AND c.contract_id=(
     SELECT c2.contract_id
       FROM framework_professional_screen_contract c2
      WHERE c2.process_code=t.process_code AND c2.step_code=t.step_code AND c2.audience='USER'
      ORDER BY CASE WHEN c2.route_path=t.user_path THEN 0 ELSE 1 END,
               CASE WHEN c2.contract_status='VERIFIED' THEN 0 ELSE 1 END,c2.contract_id
      LIMIT 1
   );

WITH target AS (
  SELECT process_code,step_code,user_path
    FROM framework_process_step
   WHERE process_code IN (
     'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY',
     'ACTIVITY_DATA','EMISSION_CALCULATION'
   )
)
UPDATE framework_step_execution_spec es
   SET screen_contract=jsonb_set(coalesce(es.screen_contract,'{}'::jsonb),'{userPath}',to_jsonb(t.user_path),true),
       field_contract=jsonb_set(
         coalesce(es.field_contract,'{}'::jsonb),
         '{fields}',
         coalesce((
           SELECT jsonb_agg(field.value || jsonb_build_object('route',t.user_path)
                            ORDER BY coalesce((field.value->>'fieldOrder')::integer,9999),
                                     field.value->>'fieldCode')
             FROM jsonb_array_elements(coalesce(es.field_contract->'fields','[]'::jsonb)) field(value)
         ),'[]'::jsonb),
         true
       ),
       updated_at=current_timestamp
  FROM target t
 WHERE es.process_code=t.process_code
   AND es.step_code=t.step_code;

CREATE OR REPLACE VIEW framework_twenty_step_relay_readiness AS
SELECT s.process_code,s.step_order,s.step_code,s.step_name,s.actor_code,s.user_path,s.admin_path,
       jsonb_array_length(coalesce(es.field_contract->'fields','[]'::jsonb)) AS field_count,
       count(*) FILTER (WHERE coalesce((field.value->>'required')::boolean,false)) AS required_field_count,
       p.completion_type,p.join_strategy,p.next_actor_code,p.snapshot_required,
       es.design_status,es.approval_status,es.generation_status,
       array_remove(ARRAY[
         CASE WHEN es.process_code IS NULL THEN 'EXECUTION_SPEC_MISSING' END,
         CASE WHEN jsonb_array_length(coalesce(es.field_contract->'fields','[]'::jsonb))=0 THEN 'FIELD_CONTRACT_MISSING' END,
         CASE WHEN nullif(s.user_path,'') IS NULL THEN 'USER_ROUTE_MISSING' END,
         CASE WHEN coalesce(pc.route_path,'')<>coalesce(s.user_path,'') OR coalesce(es.screen_contract->>'userPath','')<>coalesce(s.user_path,'') THEN 'ROUTE_CONTRACT_MISMATCH' END,
         CASE WHEN EXISTS (
           SELECT 1 FROM jsonb_array_elements(coalesce(es.field_contract->'fields','[]'::jsonb)) route_field(value)
            WHERE coalesce(route_field.value->>'route','')<>coalesce(s.user_path,'')
         ) THEN 'FIELD_ROUTE_MISMATCH' END,
         CASE WHEN p.process_code IS NULL THEN 'COMPLETION_POLICY_MISSING' END,
         CASE WHEN es.design_status<>'DESIGN_COMPLETE' OR es.approval_status<>'APPROVED' OR es.generation_status<>'READY' THEN 'SPEC_NOT_READY' END
       ],NULL) AS blocker_codes,pc.route_path AS design_route_path
  FROM framework_process_step s
  LEFT JOIN framework_step_execution_spec es USING(process_code,step_code)
  LEFT JOIN framework_step_completion_policy p USING(process_code,step_code)
  LEFT JOIN LATERAL (
    SELECT c.route_path
      FROM framework_professional_screen_contract c
     WHERE c.process_code=s.process_code AND c.step_code=s.step_code AND c.audience='USER'
     ORDER BY CASE WHEN c.route_path=s.user_path THEN 0 ELSE 1 END,
              CASE WHEN c.contract_status='VERIFIED' THEN 0 ELSE 1 END,c.updated_at DESC,c.contract_id
     LIMIT 1
  ) pc ON true
  LEFT JOIN LATERAL jsonb_array_elements(coalesce(es.field_contract->'fields','[]'::jsonb)) field(value) ON true
 WHERE s.process_code IN (
   'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY',
   'ACTIVITY_DATA','EMISSION_CALCULATION'
 )
 GROUP BY s.process_code,s.step_order,s.step_code,s.step_name,s.actor_code,s.user_path,s.admin_path,
          pc.route_path,es.field_contract,es.screen_contract,p.completion_type,p.join_strategy,
          p.next_actor_code,p.snapshot_required,es.process_code,es.design_status,
          es.approval_status,es.generation_status,p.process_code;

COMMENT ON VIEW framework_twenty_step_relay_readiness IS
  'Five-process twenty-step relay readiness with field, route, actor and handoff drift blockers';
