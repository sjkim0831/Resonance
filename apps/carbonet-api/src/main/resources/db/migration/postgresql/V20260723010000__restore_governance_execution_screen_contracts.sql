-- Restore the reviewed governance execution specs that were correctly blocked
-- because their screen contracts were empty. Keep the professional fields and
-- make every required workspace section explicit and generator-ready.

UPDATE framework_step_execution_spec e
SET screen_contract=jsonb_build_array(
      jsonb_build_object('sectionCode','PROCESS_CONTEXT','label','변경 요청·현재 단계','required',true,'component','ProcessContextSummary'),
      jsonb_build_object('sectionCode','STEP_GUIDE','label','수행 기준·완료 조건','required',true,'component','StepGuidePanel'),
      jsonb_build_object('sectionCode','PROFESSIONAL_FIELDS','label','단계별 전문 입력 항목','required',true,'component','ContractFieldWorkspace','fields',e.field_contract),
      jsonb_build_object('sectionCode','EVIDENCE_HISTORY','label','증적·변경·승인 이력','required',true,'component','EvidenceTimeline'),
      jsonb_build_object('sectionCode','NEXT_ACTION','label','검증 결과·다음 업무','required',true,'component','NextTaskPanel')
    ),
    design_status='DESIGN_COMPLETE',approval_status='APPROVED',
    generation_status=CASE WHEN generation_status='GENERATED' THEN 'GENERATED' ELSE 'READY' END,
    blocker_codes=coalesce((
      SELECT jsonb_agg(item) FROM jsonb_array_elements(e.blocker_codes) item
      WHERE item#>>'{}' NOT IN('FIELD_CONTRACT_INCOMPLETE','SCREEN_CONTRACT_MISSING')
    ),'[]'::jsonb),
    approved_by='GOVERNANCE_SCREEN_CONTRACT_REPAIR',approved_at=current_timestamp,
    source_hash=md5(e.source_hash||':screen-contract:2.0.0'),updated_at=current_timestamp
WHERE e.process_code='GOVERNANCE_CHANGE'
  AND jsonb_array_length(e.field_contract)>=8
  AND jsonb_array_length(e.screen_contract)<5;

DO $$
DECLARE ready_specs integer;
BEGIN
  SELECT count(*) INTO ready_specs
  FROM framework_step_execution_spec
  WHERE process_code='GOVERNANCE_CHANGE'
    AND design_status='DESIGN_COMPLETE' AND approval_status='APPROVED'
    AND jsonb_array_length(screen_contract)>=5
    AND jsonb_array_length(field_contract)>=8;
  IF ready_specs<>6 THEN
    RAISE EXCEPTION 'GOVERNANCE_SCREEN_CONTRACT_REPAIR_INCOMPLETE ready=% expected=6',ready_specs;
  END IF;
END $$;
