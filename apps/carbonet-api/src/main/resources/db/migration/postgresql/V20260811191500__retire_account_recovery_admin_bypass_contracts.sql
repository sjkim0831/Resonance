-- The canonical recovery path is public self-service with one-time proof.
-- Administrative duplicates must not become a credential-reset bypass.
DO $$
DECLARE retired integer;
BEGIN
  UPDATE framework_professional_screen_contract
  SET business_purpose='표준 OTP 자동복구로 처리할 수 없는 예외 건의 관리자 보조복구 설계 대기 계약이다. 운영 API로 실행하지 않는다.',
      entry_condition='표준 자동복구가 불가능하고 별도의 본인확인·직무분리 정책이 승인된 경우에만 설계를 재개한다.',
      exit_condition='관리자에 의한 비밀번호 우회 변경 없이 보안·개인정보 검토를 마친 전문 계약이 별도로 승인되어야 한다.',
      api_contract='[]', command_contract='[]', contract_status='REVIEW_REQUIRED',
      api_verified=false, database_verified=false, authority_verified=false,
      responsive_verified=false, accessibility_verified=false, exception_states_verified=false,
      audit_evidence_ref='RETIRED_DUPLICATE_ADMIN_FLOW',
      updated_by='V20260811191500', updated_at=current_timestamp
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND audience='ADMIN'
    AND route_path IN ('/admin/member/activate','/admin/member/login_history');
  GET DIAGNOSTICS retired = ROW_COUNT;
  IF retired <> 4 THEN RAISE EXCEPTION 'account recovery retired admin contract mismatch: %', retired; END IF;

  IF EXISTS (
    SELECT 1 FROM framework_professional_screen_contract
    WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND audience='ADMIN'
      AND audit_evidence_ref='RETIRED_DUPLICATE_ADMIN_FLOW'
      AND (api_contract<>'[]' OR command_contract<>'[]' OR contract_status<>'REVIEW_REQUIRED'
        OR api_verified OR database_verified OR authority_verified)
  ) THEN RAISE EXCEPTION 'administrative credential bypass contract remains executable'; END IF;

  IF (SELECT count(*) FROM framework_professional_screen_contract
      WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND audience='USER'
        AND route_path IN ('/signin/findPassword','/signin/findPassword/result')
        AND contract_status='DESIGN_COMPLETE'
        AND api_contract<>'[]' AND state_contract LIKE '%FORBIDDEN%') <> 4
  THEN RAISE EXCEPTION 'canonical self-service recovery contract mismatch'; END IF;
END $$;
