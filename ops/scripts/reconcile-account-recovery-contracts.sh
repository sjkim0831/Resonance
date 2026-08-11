#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${ACCOUNT_RECOVERY_RECONCILE_LOCK:-/tmp/resonance-account-recovery-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM framework_professional_screen_contract WHERE contract_id IN (3018,3020,3022,3024,3019,3021,3023,3025))<>8 THEN
   RAISE EXCEPTION 'account recovery canonical contract cardinality changed';
 END IF;
END $$;

UPDATE framework_professional_screen_contract
SET route_path='/signin/findPassword', screen_name='계정 식별·인증번호 요청 사용자 업무 화면',
    actor_code='MEMBER_USER', business_purpose='계정 존재 여부를 노출하지 않고 등록 이메일로 일회용 인증번호를 요청한다.',
    entry_condition='비로그인 사용자이며 아이디와 등록 이메일 형식이 유효해야 한다.',
    exit_condition='동일한 공개 응답을 반환하고 유효 계정에만 인증번호를 전달하며 요청 감사 이벤트를 남긴다.',
    command_contract='[{"code":"REQUEST_RECOVERY","label":"인증번호 요청","transactional":true,"genericResponse":true,"rateLimited":true}]',
    state_contract='["READY","SAVING","REQUESTED","ERROR","RATE_LIMITED"]',
    api_contract='[{"code":"REQUEST_RECOVERY","path":"/signin/account-recovery/requests","method":"POST","request":"AccountRecoveryRequest","response":"GenericRecoveryAccepted","rateLimited":true,"enumerationSafe":true}]',
    process_sequence=1,step_sequence=1,previous_step_codes='[]',next_step_codes='["ACCOUNT_LOCK_RECOVERY_S2"]',
    contract_revision=contract_revision+1,updated_by='ACCOUNT_RECOVERY_CONTRACT_CLOSER',updated_at=current_timestamp
WHERE contract_id=3018;

UPDATE framework_professional_screen_contract
SET route_path='/signin/findPassword', screen_name='인증번호 검증·복구 증명 발급 사용자 업무 화면',
    actor_code='MEMBER_USER', business_purpose='일회용 인증번호를 검증하고 짧은 수명의 단일 목적 복구 증명을 발급한다.',
    entry_condition='REQUESTED 상태이고 요청 식별자와 6자리 인증번호가 있어야 한다.',
    exit_condition='코드는 한 번만 소비되고 복구 증명 원문은 저장하지 않으며 실패 횟수 초과 시 요청을 잠근다.',
    command_contract='[{"code":"VERIFY_RECOVERY_CHALLENGE","label":"인증번호 확인","singleUse":true,"transactional":true}]',
    state_contract='["REQUESTED","SAVING","IDENTITY_VERIFIED","LOCKED","EXPIRED","ERROR"]',
    api_contract='[{"code":"VERIFY_RECOVERY_CHALLENGE","path":"/signin/account-recovery/requests/{requestId}/verify","method":"POST","request":"RecoveryChallengeVerification","response":"RecoveryProofIssued","singleUse":true,"constantTimeCompare":true}]',
    process_sequence=1,step_sequence=2,previous_step_codes='["ACCOUNT_LOCK_RECOVERY_S1"]',next_step_codes='["ACCOUNT_LOCK_RECOVERY_S3"]',
    contract_revision=contract_revision+1,updated_by='ACCOUNT_RECOVERY_CONTRACT_CLOSER',updated_at=current_timestamp
WHERE contract_id=3020;

UPDATE framework_professional_screen_contract
SET route_path='/signin/findPassword', screen_name='새 비밀번호 설정·기존 세션 폐기 사용자 업무 화면',
    actor_code='MEMBER_USER', business_purpose='복구 증명과 비밀번호 정책을 검증한 뒤 비밀번호를 원자적으로 변경하고 기존 세션을 폐기한다.',
    entry_condition='IDENTITY_VERIFIED 상태이고 유효한 복구 증명과 정책에 맞는 새 비밀번호가 있어야 한다.',
    exit_condition='비밀번호 변경, 모든 토큰·세션 폐기, 복구 증명 제거와 완료 감사 기록이 하나의 트랜잭션으로 끝난다.',
    command_contract='[{"code":"COMPLETE_ACCOUNT_RECOVERY","label":"비밀번호 변경 완료","transactional":true,"singleUse":true,"revokesSessions":true}]',
    state_contract='["IDENTITY_VERIFIED","SAVING","COMPLETED","EXPIRED","ERROR"]',
    api_contract='[{"code":"COMPLETE_ACCOUNT_RECOVERY","path":"/signin/resetPassword","method":"POST","request":"AccountRecoveryCompletion","response":"AccountRecoveryCompleted","singleUse":true,"transactional":true}]',
    process_sequence=1,step_sequence=3,previous_step_codes='["ACCOUNT_LOCK_RECOVERY_S2"]',next_step_codes='["ACCOUNT_LOCK_RECOVERY_S4"]',
    contract_revision=contract_revision+1,updated_by='ACCOUNT_RECOVERY_CONTRACT_CLOSER',updated_at=current_timestamp
WHERE contract_id=3022;

UPDATE framework_professional_screen_contract
SET route_path='/signin/findPassword/result', screen_name='계정 복구 완료·로그인 이동 사용자 업무 화면',
    actor_code='MEMBER_USER', business_purpose='계정 복구 완료 사실과 보안 안내를 표시하고 로그인 화면으로 이동시킨다.',
    entry_condition='COMPLETED 상태이며 완료 결과가 현재 브라우저 흐름에서 확인되어야 한다.',
    exit_condition='사용자가 로그인 화면으로 이동하며 민감한 복구 증명·인증번호가 URL이나 화면에 남지 않는다.',
    command_contract='[{"code":"NAVIGATE_TO_LOGIN","label":"로그인 화면으로 이동","transactional":false}]',
    state_contract='["COMPLETED","READY"]',api_contract='[]',
    process_sequence=1,step_sequence=4,previous_step_codes='["ACCOUNT_LOCK_RECOVERY_S3"]',next_step_codes='[]',
    contract_revision=contract_revision+1,updated_by='ACCOUNT_RECOVERY_CONTRACT_CLOSER',updated_at=current_timestamp
WHERE contract_id=3024;

UPDATE framework_professional_screen_contract
SET business_purpose='표준 OTP 자동복구로 처리할 수 없는 예외 건의 관리자 보조복구 설계 대기 계약이다. 운영 API로 실행하지 않는다.',
    entry_condition='표준 자동복구가 불가능하고 별도의 본인확인·직무분리 정책이 승인된 경우에만 설계를 재개한다.',
    exit_condition='관리자에 의한 비밀번호 우회 변경 없이 보안·개인정보 검토를 마친 전문 계약이 별도로 승인되어야 한다.',
    api_contract='[]',command_contract='[]',contract_status='REVIEW_REQUIRED',
    api_verified=false,database_verified=false,authority_verified=false,responsive_verified=false,accessibility_verified=false,exception_states_verified=false,
    audit_evidence_ref='RETIRED_DUPLICATE_ADMIN_FLOW',
    contract_revision=contract_revision+1,updated_by='ACCOUNT_RECOVERY_CONTRACT_CLOSER',updated_at=current_timestamp
WHERE contract_id IN (3019,3021,3023,3025) AND process_code='ACCOUNT_LOCK_RECOVERY';

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM framework_professional_screen_contract WHERE contract_id IN (3022,3024) AND api_contract::jsonb @? '$[*] ? (@.path like_regex "^/admin/api/member-recovery")') THEN
   RAISE EXCEPTION 'user recovery still references admin bypass API';
 END IF;
 IF (SELECT count(*) FROM framework_professional_screen_contract WHERE contract_id IN (3019,3021,3023,3025) AND audience='ADMIN' AND contract_status='REVIEW_REQUIRED' AND api_contract::jsonb='[]')<>4 THEN
   RAISE EXCEPTION 'admin duplicate retirement guard failed';
 END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","userSteps":4,"retiredAdminDuplicates":4,"adminBypassApis":0}\n'
