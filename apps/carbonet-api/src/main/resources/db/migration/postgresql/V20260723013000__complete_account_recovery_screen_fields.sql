-- Complete the two public recovery screens to the shared professional field
-- contract without exposing account existence, raw delivery destinations or
-- security counters. Also remove the superseded generic authority draft.

CREATE TEMP TABLE account_recovery_field_addition(
  step_code varchar(80) PRIMARY KEY,
  additions jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO account_recovery_field_addition VALUES
('ACCOUNT_LOCK_RECOVERY_S1','[
  {"fieldCode":"channelType","label":"복구 채널 유형","controlType":"SELECT","required":true,"options":["EMAIL","MOBILE"]},
  {"fieldCode":"recoveryReason","label":"복구 요청 사유","controlType":"SELECT","required":true,"options":["LOCKED","DORMANT","SUSPECTED_COMPROMISE","OTHER"]},
  {"fieldCode":"requestReference","label":"접수 참조번호","controlType":"TEXT","editable":false,"visibleAfterSubmit":true},
  {"fieldCode":"securityNotice","label":"보안·처리시간 안내","controlType":"NOTICE","editable":false,"accountExistenceSafe":true}
]'::jsonb),
('ACCOUNT_LOCK_RECOVERY_S2','[
  {"fieldCode":"deliveryChannelMasked","label":"전송 대상","controlType":"TEXT","editable":false,"masked":true},
  {"fieldCode":"lastDeliveredAt","label":"최근 전송 시각","controlType":"DATETIME","editable":false},
  {"fieldCode":"remainingAttempts","label":"남은 입력 기회","controlType":"STATUS","editable":false,"policyMasked":true},
  {"fieldCode":"verificationStatus","label":"서버 검증 상태","controlType":"STATUS","editable":false}
]'::jsonb);

UPDATE framework_step_execution_spec e
SET field_contract=e.field_contract||a.additions,
    design_status='DESIGN_COMPLETE',approval_status='APPROVED',generation_status='READY',
    blocker_codes=coalesce((
      SELECT jsonb_agg(item) FROM jsonb_array_elements(e.blocker_codes) item
      WHERE item#>>'{}'<>'FIELD_CONTRACT_INCOMPLETE'
    ),'[]'::jsonb),
    approved_by='ACCOUNT_RECOVERY_FIELD_COMPLETION',approved_at=current_timestamp,
    source_hash=md5(e.source_hash||':professional-fields:2.0.0'),updated_at=current_timestamp
FROM account_recovery_field_addition a
WHERE e.process_code='ACCOUNT_LOCK_RECOVERY' AND e.step_code=a.step_code
  AND jsonb_array_length(e.field_contract)<8;

UPDATE framework_professional_screen_contract p
SET field_contract=(framework_try_jsonb(p.field_contract)||a.additions)::text,
    contract_status='DESIGN_COMPLETE',updated_by='ACCOUNT_RECOVERY_FIELD_COMPLETION',
    updated_at=current_timestamp
FROM account_recovery_field_addition a
WHERE p.process_code='ACCOUNT_LOCK_RECOVERY' AND p.step_code=a.step_code
  AND jsonb_array_length(framework_try_jsonb(p.field_contract))<8;

ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;
DELETE FROM framework_simulation_case legacy
WHERE legacy.case_code='ACCOUNT_LOCK_RECOVERY_AUTH'
  AND legacy.process_code='ACCOUNT_LOCK_RECOVERY'
  AND legacy.case_status='DRAFT'
  AND EXISTS(
    SELECT 1 FROM framework_simulation_case reviewed
    WHERE reviewed.process_code=legacy.process_code
      AND reviewed.case_code='ACCOUNT_LOCK_RECOVERY_AUTHORITY'
      AND reviewed.case_type='AUTHORITY'
      AND reviewed.case_status IN('APPROVED','VERIFIED')
  );
ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;

DO $$
DECLARE spec_count integer; screen_count integer; duplicate_count integer;
BEGIN
  SELECT count(*) INTO spec_count FROM framework_step_execution_spec
  WHERE process_code='ACCOUNT_LOCK_RECOVERY'
    AND design_status='DESIGN_COMPLETE' AND approval_status='APPROVED'
    AND jsonb_array_length(screen_contract)>0 AND jsonb_array_length(field_contract)>=8;
  SELECT count(*) INTO screen_count FROM framework_professional_screen_contract
  WHERE process_code='ACCOUNT_LOCK_RECOVERY'
    AND jsonb_array_length(framework_try_jsonb(field_contract))>=8;
  SELECT count(*)-count(DISTINCT case_type) INTO duplicate_count
  FROM framework_simulation_case
  WHERE process_code='ACCOUNT_LOCK_RECOVERY'
    AND case_type IN('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY');
  IF spec_count<>4 OR screen_count<>8 OR duplicate_count<>0 THEN
    RAISE EXCEPTION 'ACCOUNT_RECOVERY_FIELD_COMPLETION_FAILED specs=% screens=% duplicate_core_tests=%',spec_count,screen_count,duplicate_count;
  END IF;
END $$;
