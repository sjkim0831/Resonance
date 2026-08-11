-- Close only the ACCOUNT_LOCK_RECOVERY design layer. Verification flags remain unchanged
-- so missing admin commands and browser evidence stay visible in implementation/test gates.
DO $$
DECLARE
  affected_user integer;
  affected_admin integer;
  design_ready integer;
BEGIN
  UPDATE framework_professional_screen_contract
  SET state_contract = '["LOADING: 요청·인증·재설정 처리 중","EMPTY: 복구 가능한 계정 또는 결과 없음","ERROR: 입력·토큰·서버 오류와 재시도 안내","FORBIDDEN: 만료·오용·권한 없음 및 신규 요청 안내","SUCCESS: 다음 절차와 완료 결과 안내"]',
      api_contract = CASE step_code
        WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '["POST /signin/account-recovery/requests"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '["POST /signin/account-recovery/requests/{requestId}/verify"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '["POST /signin/resetPassword"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '["GET /signin/findPassword/result (session-scoped result)"]'
      END,
      contract_status = 'DESIGN_COMPLETE',
      updated_by = 'V20260811190500', updated_at = current_timestamp
  WHERE process_code='ACCOUNT_LOCK_RECOVERY'
    AND audience='USER'
    AND route_path IN ('/signin/findPassword','/signin/findPassword/result');
  GET DIAGNOSTICS affected_user = ROW_COUNT;

  UPDATE framework_professional_screen_contract
  SET api_contract = CASE step_code
        WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '["GET /admin/api/admin/member/list/page?sbscrbSttus=LOCKED","POST /admin/api/member/account-lock-recovery/{accountId}/review"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '["GET /admin/api/member/account-lock-recovery/{accountId}/evidence","POST /admin/api/member/account-lock-recovery/{accountId}/verify"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '["POST /admin/api/member/account-lock-recovery/{accountId}/unlock","POST /admin/api/member/account-lock-recovery/{accountId}/reject"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '["GET /admin/api/security/login-history?accountId={accountId}","GET /admin/api/member/account-lock-recovery/{accountId}/audit"]'
      END,
      command_contract = CASE step_code
        WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '["잠금 계정 검색","복구 대상 선택","검토 시작"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '["본인확인 증적 조회","검증 승인","추가 확인 요청"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '["계정 잠금 해제","복구 반려","사용자 알림"]'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '["로그인 이력 조회","복구 감사 추적","보안 이상 보고"]'
      END,
      contract_status = 'DESIGN_COMPLETE',
      updated_by = 'V20260811190500', updated_at = current_timestamp
  WHERE process_code='ACCOUNT_LOCK_RECOVERY'
    AND audience='ADMIN'
    AND route_path IN ('/admin/member/activate','/admin/member/login_history');
  GET DIAGNOSTICS affected_admin = ROW_COUNT;

  IF affected_user <> 4 OR affected_admin <> 4 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY target mismatch user=% admin=%', affected_user, affected_admin;
  END IF;

  SELECT count(*) INTO design_ready
  FROM framework_professional_screen_contract
  WHERE process_code='ACCOUNT_LOCK_RECOVERY'
    AND contract_status IN ('DESIGN_COMPLETE','VERIFIED')
    AND length(trim(business_purpose))>=20
    AND length(trim(entry_condition))>=10 AND length(trim(exit_condition))>=20
    AND kpi_contract<>'[]' AND section_contract<>'[]' AND field_contract<>'[]'
    AND command_contract<>'[]' AND state_contract LIKE '%LOADING%'
    AND state_contract LIKE '%EMPTY%' AND state_contract LIKE '%ERROR%'
    AND state_contract LIKE '%FORBIDDEN%' AND api_contract<>'[]'
    AND data_contract<>'[]' AND evidence_contract<>'[]';
  IF design_ready <> 16 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY design readiness mismatch: %/16', design_ready;
  END IF;
END $$;
