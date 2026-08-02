-- Refresh stale compiled contracts from their canonical process and step rows.
-- This repairs legacy empty requirements and null API declarations without
-- inventing business meaning in the renderer.
WITH refreshed AS (
  SELECT e.process_code,e.step_code,
    e.business_contract || jsonb_build_object(
      'domainCode',p.domain_code,'processName',p.process_name,'stepName',s.step_name,
      'goal',p.goal,'requirement',s.requirement_text,'completionRule',s.completion_rule,
      'riskLevel',p.risk_level,'slaHours',p.sla_hours,'regulationRefs',p.regulation_refs
    ) AS business_contract,
    CASE WHEN s.requires_api THEN jsonb_build_array(
      coalesce(e.api_contract->0,'{}'::jsonb) || jsonb_build_object(
        'declaredContract',coalesce(nullif(s.api_contract,''),'COMMON_PROCESS_EXECUTION_RUNTIME_V1'),
        'transactional',true,'tenantGuard',true,'projectGuard',true,'actorGuard',true,
        'idempotencyKey',true,'rowVersion',true
      )
    ) ELSE '[]'::jsonb END AS api_contract,
    e.guide_contract || jsonb_build_object(
      'workTypeCode',p.domain_code,'processCode',p.process_code,'stepCode',s.step_code,
      'stepOrder',s.step_order,'actorCode',s.actor_code,'title',s.step_name,
      'purpose',s.requirement_text,'entryCondition',s.from_state,
      'completionCondition',s.completion_rule,'userPath',s.user_path,'adminPath',s.admin_path,
      'nextStepCode',(SELECT n.step_code FROM framework_process_step n
        WHERE n.process_code=s.process_code AND n.step_order>s.step_order
        ORDER BY n.step_order LIMIT 1)
    ) AS guide_contract
  FROM framework_step_execution_spec e
  JOIN framework_process_definition p USING(process_code)
  JOIN framework_process_step s USING(process_code,step_code)
  WHERE e.process_code='CONTENT_OPERATION'
), hashed AS (
  SELECT r.*,
    md5(e.actor_contract::text||r.business_contract::text||e.transition_contract::text||
      e.input_contract::text||e.output_contract::text||e.screen_contract::text||
      e.field_contract::text||e.command_contract::text||r.api_contract::text||
      e.persistence_contract::text||e.handoff_contract::text||e.test_contract::text||
      r.guide_contract::text||e.nonfunctional_contract::text) AS source_hash
  FROM refreshed r
  JOIN framework_step_execution_spec e USING(process_code,step_code)
)
UPDATE framework_step_execution_spec e SET
  business_contract=h.business_contract,
  api_contract=h.api_contract,
  guide_contract=h.guide_contract,
  source_hash=h.source_hash,
  spec_version=CASE WHEN e.source_hash<>h.source_hash THEN e.spec_version+1 ELSE e.spec_version END,
  generation_status=CASE WHEN e.approval_status='APPROVED' AND e.design_status='DESIGN_COMPLETE'
    THEN 'READY' ELSE e.generation_status END,
  updated_at=current_timestamp
FROM hashed h
WHERE e.process_code=h.process_code AND e.step_code=h.step_code;

DO $$
DECLARE gap_count integer;
BEGIN
  SELECT count(*) INTO gap_count
  FROM framework_step_execution_spec e
  JOIN framework_process_step s USING(process_code,step_code)
  WHERE e.process_code='CONTENT_OPERATION'
    AND (nullif(e.business_contract->>'requirement','') IS NULL
      OR e.business_contract->>'requirement'<>s.requirement_text
      OR nullif(e.api_contract->0->>'declaredContract','') IS NULL);
  IF gap_count>0 THEN
    RAISE EXCEPTION 'CONTENT_OPERATION execution contract refresh failed: % gaps',gap_count;
  END IF;
END $$;
