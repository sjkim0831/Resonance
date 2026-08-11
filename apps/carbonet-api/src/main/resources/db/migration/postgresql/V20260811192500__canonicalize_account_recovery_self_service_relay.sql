-- Runtime implementation is a four-step, server-authoritative self-service flow.
-- Remove the stale administrative approval relay; no administrator handles user credentials.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_definition
SET process_version='3.0.0', owner_actor_code='MEMBER_USER',
    goal='등록 이메일 OTP와 단일 사용 복구 증명으로 사용자가 관리자 자격증명 우회 없이 계정을 복구한다.',
    start_condition='비로그인 사용자가 아이디와 등록 이메일을 제출하고 계정 존재 여부를 노출하지 않는 복구 요청을 시작한다.',
    completion_condition='OTP 검증, 비밀번호 변경, 기존 토큰·세션 폐기와 감사 기록이 완료되고 로그인 이동 결과가 표시된다.',
    updated_at=current_timestamp
WHERE process_code='ACCOUNT_LOCK_RECOVERY';

UPDATE framework_process_step
SET step_name='복구 요청·OTP 전달', actor_code='MEMBER_USER', step_type='TASK',
    requirement_text='아이디와 등록 이메일을 입력받되 계정 존재 여부를 노출하지 않는다. 유효 계정에만 구성된 전달 어댑터로 일회용 코드를 전송하고 요청·전달 결과를 감사 기록한다.',
    input_contract='{"userId":"required","email":"requiredRegisteredAddress","language":"optional","requestIp":"serverResolved","userAgent":"serverResolved"}',
    output_contract='{"status":"accepted","requestId":"opaque","message":"enumerationSafe","developmentCode":"neverInProduction"}',
    requires_user_page=true, requires_admin_page=false,
    admin_path=NULL, user_path='/signin/findPassword', requires_api=true,
    requires_database=true, requires_notification=true,
    from_state='READY', command_code='REQUEST_RECOVERY', to_state='REQUESTED',
    api_contract='[{"method":"POST","path":"/signin/account-recovery/requests","enumerationSafe":true,"rateLimited":true}]',
    completion_rule='존재 여부와 무관한 HTTP 202 공통 응답을 반환하고 유효 계정에만 OTP 전달을 요청하며 REQUESTED 또는 억제 사유 감사 이벤트를 남긴다.',
    escalation_actor_code=NULL, segregation_actor_codes='', rollback_command_code='',
    evidence_types='["REQUEST_SNAPSHOT","DELIVERY_RESULT","AUDIT_EVENT"]',
    decision_rule='입력 형식과 속도 제한을 통과하면 불투명 요청 ID를 발급하며 계정 존재 여부와 인증번호 원문은 응답하지 않는다.'
WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND step_code='ACCOUNT_LOCK_RECOVERY_S1';

UPDATE framework_process_step
SET step_name='OTP 검증·복구 증명 발급', actor_code='MEMBER_USER', step_type='TASK',
    requirement_text='사용자가 입력한 OTP를 서버 해시와 상수시간 비교하고 만료·사용 여부·실패 횟수·요청 범위를 검증한다. 성공 시 짧은 수명의 단일 사용 복구 증명을 발급한다.',
    input_contract='{"requestId":"requiredOpaqueId","code":"requiredSixDigits","language":"optional","requestIp":"serverResolved"}',
    output_contract='{"status":"successOrFail","recoveryProof":"opaqueSingleUseOnSuccess","message":"policySafe"}',
    requires_user_page=true, requires_admin_page=false,
    admin_path=NULL, user_path='/signin/findPassword', requires_api=true,
    requires_database=true, requires_notification=false,
    from_state='REQUESTED', command_code='VERIFY_RECOVERY_CHALLENGE', to_state='IDENTITY_VERIFIED',
    api_contract='[{"method":"POST","path":"/signin/account-recovery/requests/{requestId}/verify","singleUse":true}]',
    completion_rule='유효 OTP를 한 번만 소비하고 10분 유효 단일 목적 복구 증명을 발급하며 5회 실패한 요청은 잠근다.',
    escalation_actor_code=NULL, segregation_actor_codes='', rollback_command_code='',
    evidence_types='["SERVER_IDENTITY_PROOF","STATE_TRANSITION","AUDIT_EVENT"]',
    decision_rule='요청 상태가 전달 완료이고 OTP가 미사용·미만료이며 실패 횟수 5회 미만인 경우에만 IDENTITY_VERIFIED로 전이한다.'
WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND step_code='ACCOUNT_LOCK_RECOVERY_S2';

UPDATE framework_process_step
SET step_name='비밀번호 변경·세션 폐기', actor_code='MEMBER_USER', step_type='TASK',
    requirement_text='단일 사용 복구 증명과 비밀번호 정책을 재검증한 뒤 비밀번호를 변경하고 모든 리프레시 토큰과 서버 로그인 세션을 폐기한다. 증명 재사용은 거부한다.',
    input_contract='{"userId":"required","requestId":"requiredOpaqueId","recoveryProof":"requiredOpaqueSingleUse","newPassword":"requiredPolicyCompliant","language":"optional"}',
    output_contract='{"status":"successOrFail","errors":"policySafeOnFailure"}',
    requires_user_page=true, requires_admin_page=false,
    admin_path=NULL, user_path='/signin/findPassword', requires_api=true,
    requires_database=true, requires_notification=false,
    from_state='IDENTITY_VERIFIED', command_code='COMPLETE_ACCOUNT_RECOVERY', to_state='PASSWORD_CHANGED',
    api_contract='[{"method":"POST","path":"/signin/resetPassword","proofRequired":true,"revokesSessions":true}]',
    completion_rule='복구 증명을 한 번만 사용해 비밀번호를 변경하고 모든 로그인 토큰과 서버 세션을 폐기하며 PASSWORD_CHANGED 감사 이벤트를 기록한다.',
    escalation_actor_code=NULL, segregation_actor_codes='', rollback_command_code='',
    evidence_types='["SERVER_IDENTITY_PROOF","DATA_CHANGE","SESSION_REVOCATION","AUDIT_EVENT"]',
    decision_rule='복구 증명이 요청·사용자에 결속되고 미사용·미만료이며 새 비밀번호가 정책을 만족할 때만 원자적으로 변경한다.'
WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND step_code='ACCOUNT_LOCK_RECOVERY_S3';

UPDATE framework_process_step
SET step_name='완료 확인·로그인 이동', actor_code='MEMBER_USER', step_type='TASK',
    requirement_text='비밀번호 변경 성공 직후 서버 세션에 저장된 5분 TTL 일회성 완료 표식을 소비한 요청에만 완료 화면을 표시한다. 직접 접근·재접근·만료 요청은 복구 시작 화면으로 이동한다.',
    input_contract='{"completionGrant":"serverSessionSingleUse","requestPath":"serverResolved"}',
    output_contract='{"resultPage":"shownOnceOrRedirect","nextPath":"/signin/loginView"}',
    requires_user_page=true, requires_admin_page=false,
    admin_path=NULL, user_path='/signin/findPassword/result', requires_api=false,
    requires_database=true, requires_notification=false,
    from_state='PASSWORD_CHANGED', command_code='NAVIGATE_TO_LOGIN', to_state='COMPLETED',
    api_contract='[]',
    completion_rule='서버 세션 완료 표식을 한 번 소비해 민감한 OTP·복구 증명을 URL과 화면에 남기지 않고 완료 안내와 로그인 이동을 제공한다.',
    escalation_actor_code=NULL, segregation_actor_codes='', rollback_command_code='',
    evidence_types='["STATE_TRANSITION","SERVER_SESSION_RESULT","AUDIT_EVENT"]',
    decision_rule='5분 이내의 서버 세션 완료 표식이 존재하는 최초 GET만 결과를 표시하고 그 외 요청은 복구 시작 화면으로 리다이렉트한다.'
WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND step_code='ACCOUNT_LOCK_RECOVERY_S4';

-- Reconcile the generated development queue with the canonical self-service
-- design. Retired administrator UI and a nonexistent JSON API on the result
-- step remain traceable but can never be claimed as required work.
DO $$
DECLARE
  retired_jobs integer;
  route_jobs integer;
  inserted_jobs integer;
  canonical_jobs integer;
BEGIN
  UPDATE framework_development_job
  SET required=false, approval_status='DRAFT',
      result_json=jsonb_build_object(
        'retired',true,
        'reason','RETIRED_DUPLICATE_ADMIN_FLOW',
        'designVersion','ACCOUNT_LOCK_RECOVERY:3.0.0'
      )::text,
      updated_at=current_timestamp
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND job_status='PLANNED' AND required
    AND (job_type='FRONTEND_ADMIN'
      OR (step_code='ACCOUNT_LOCK_RECOVERY_S4' AND job_type='API'));
  GET DIAGNOSTICS retired_jobs = ROW_COUNT;
  IF retired_jobs<>9 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY retired job mismatch: %',retired_jobs;
  END IF;

  UPDATE framework_development_job j
  SET target_path=CASE j.step_code
        WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
      END,
      updated_at=current_timestamp
  WHERE j.process_code='ACCOUNT_LOCK_RECOVERY' AND j.job_type='FRONTEND_USER'
    AND j.job_status='PLANNED' AND j.target_path LIKE '/%'
    AND j.step_code IN ('ACCOUNT_LOCK_RECOVERY_S1','ACCOUNT_LOCK_RECOVERY_S2','ACCOUNT_LOCK_RECOVERY_S3');
  GET DIAGNOSTICS route_jobs = ROW_COUNT;
  IF route_jobs<>3 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY existing route job mismatch: %',route_jobs;
  END IF;

  INSERT INTO framework_development_job(
    process_code,step_code,job_type,job_name,target_path,specification_json,
    job_status,approval_status,created_by,execution_mode,required,quality_status
  ) VALUES (
    'ACCOUNT_LOCK_RECOVERY','ACCOUNT_LOCK_RECOVERY_S4','FRONTEND_USER',
    '완료 확인·로그인 이동 - 실제 화면 구현','/signin/findPassword/result',
    '{}','PLANNED','DRAFT','BACKSTAGE_CONTROL_PLANE','SEQUENTIAL',true,'PENDING'
  );
  GET DIAGNOSTICS inserted_jobs = ROW_COUNT;
  IF inserted_jobs<>1 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY result route job insert mismatch: %',inserted_jobs;
  END IF;

  -- A process-version change invalidates all prior job and gate evidence. The
  -- evidence tables do not carry version/commit columns, so reset them here and
  -- require a versioned evidence reference before later assurance promotion.
  DELETE FROM framework_development_job_gate_result
  WHERE job_id IN (
    SELECT job_id FROM framework_development_job
    WHERE process_code='ACCOUNT_LOCK_RECOVERY'
  );

  UPDATE framework_development_job
  SET job_status='PLANNED', approval_status='DRAFT', quality_status='PENDING',
      execution_log=NULL, evidence_ref=NULL, quality_report='{}', result_json='{}',
      worker_id=NULL, lease_token=NULL, lease_until=NULL, attempt_count=0,
      started_at=NULL, completed_at=NULL, last_error=NULL,
      updated_at=current_timestamp
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required;

  UPDATE framework_development_job j
  SET job_name=s.step_name||' - '||CASE
        WHEN j.job_type='FRONTEND_USER' AND j.target_path LIKE '/%' THEN '실제 사용자 화면 구현'
        WHEN j.job_type='FRONTEND_USER' AND j.target_path LIKE 'schema-set/%' THEN '스키마 기반 사용자 화면 생성'
        WHEN j.job_type='FRONTEND_USER' THEN '사용자 화면 설계'
        WHEN j.job_type='API' THEN 'API 계약·권한·멱등성'
        WHEN j.job_type='BACKEND' THEN '백엔드 업무 규칙 구현'
        WHEN j.job_type='DATABASE' THEN 'DB 스키마·영속성 계약'
        WHEN j.job_type='DESIGN' THEN '상세 설계 계약'
        WHEN j.job_type='INTEGRATION' THEN '화면·API·DB 통합'
        WHEN j.job_type='TEST' THEN '정상·예외·보안 자동 테스트'
        ELSE j.job_type
      END,
      specification_json=jsonb_build_object(
        'contractVersion','ACCOUNT_LOCK_RECOVERY:3.0.0',
        'sourceOfTruth','framework_process_step',
        'processCode',j.process_code,
        'stepCode',j.step_code,
        'stepName',s.step_name,
        'actorCode',s.actor_code,
        'jobType',j.job_type,
        'jobTarget',j.target_path,
        'routePath',s.user_path,
        'commandCode',s.command_code,
        'fromState',s.from_state,
        'toState',s.to_state,
        'requirement',s.requirement_text,
        'inputContract',s.input_contract::jsonb,
        'outputContract',s.output_contract::jsonb,
        'completionRule',s.completion_rule,
        'requires',jsonb_build_object(
          'userPage',s.requires_user_page,
          'adminPage',s.requires_admin_page,
          'api',s.requires_api,
          'database',s.requires_database,
          'notification',s.requires_notification
        )
      )::text,
      search_context_ref='process://ACCOUNT_LOCK_RECOVERY/3.0.0/'||lower(j.step_code),
      updated_at=current_timestamp
  FROM framework_process_step s
  WHERE j.process_code='ACCOUNT_LOCK_RECOVERY' AND j.required AND j.job_status='PLANNED'
    AND s.process_code=j.process_code AND s.step_code=j.step_code;
  GET DIAGNOSTICS canonical_jobs = ROW_COUNT;
  IF canonical_jobs<>43 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY canonical required job mismatch: %',canonical_jobs;
  END IF;
END $$;

-- Materialize exactly one user-facing page artifact for every canonical step.
-- Any old administrative or duplicate artifact remains traceable, but is
-- retired and cannot satisfy an implementation gate.
UPDATE framework_process_artifact
SET required=false, delivery_status='PLANNED', evidence_ref=NULL,
    notes='{"retired":true,"reason":"RETIRED_STALE_PROCESS_ARTIFACT","contractVersion":"ACCOUNT_LOCK_RECOVERY:3.0.0"}',
    updated_at=current_timestamp
WHERE process_code='ACCOUNT_LOCK_RECOVERY';

INSERT INTO framework_process_artifact(
  process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,
  contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,
  evidence_ref,notes,updated_at
)
SELECT
  s.process_code,
  s.step_code,
  s.process_code||'_'||s.step_code||'_FRONTEND_USER',
  'PAGE',
  s.step_name,
  s.user_path,
  'process://ACCOUNT_LOCK_RECOVERY/3.0.0/'||s.step_code,
  true,
  'PLANNED',
  'MEMBER_USER',
  'Canonical step route, actor, process contract, accessibility, responsive layout, and automated E2E evidence must pass.',
  NULL,
  '{"contractVersion":"ACCOUNT_LOCK_RECOVERY:3.0.0","sourceOfTruth":"framework_process_step"}',
  current_timestamp
FROM framework_process_step s
WHERE s.process_code='ACCOUNT_LOCK_RECOVERY'
  AND s.step_code IN (
    'ACCOUNT_LOCK_RECOVERY_S1','ACCOUNT_LOCK_RECOVERY_S2',
    'ACCOUNT_LOCK_RECOVERY_S3','ACCOUNT_LOCK_RECOVERY_S4'
  )
ON CONFLICT (process_code,artifact_code) DO UPDATE
SET step_code=excluded.step_code,
    artifact_type=excluded.artifact_type,
    artifact_name=excluded.artifact_name,
    target_path=excluded.target_path,
    contract_ref=excluded.contract_ref,
    required=excluded.required,
    delivery_status=excluded.delivery_status,
    owner_actor_code=excluded.owner_actor_code,
    acceptance_criteria=excluded.acceptance_criteria,
    evidence_ref=NULL,
    notes=excluded.notes,
    updated_at=excluded.updated_at;

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

DO $$
DECLARE
  definition_total integer;
  step_total integer;
  expected_step_total integer;
  invalid integer;
  invalid_artifacts integer;
BEGIN
  SELECT count(*) INTO definition_total
  FROM framework_process_definition
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND owner_actor_code='MEMBER_USER';

  SELECT count(*), count(*) FILTER (WHERE step_code IN (
    'ACCOUNT_LOCK_RECOVERY_S1',
    'ACCOUNT_LOCK_RECOVERY_S2',
    'ACCOUNT_LOCK_RECOVERY_S3',
    'ACCOUNT_LOCK_RECOVERY_S4'
  ))
  INTO step_total, expected_step_total
  FROM framework_process_step
  WHERE process_code='ACCOUNT_LOCK_RECOVERY';

  SELECT count(*) INTO invalid FROM framework_process_step
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND (
    actor_code<>'MEMBER_USER' OR NOT requires_user_page OR requires_admin_page
    OR nullif(btrim(user_path),'') IS NULL OR admin_path IS NOT NULL
    OR (step_code IN ('ACCOUNT_LOCK_RECOVERY_S1','ACCOUNT_LOCK_RECOVERY_S2','ACCOUNT_LOCK_RECOVERY_S3')
      AND (NOT requires_api OR NOT requires_database))
    OR (step_code='ACCOUNT_LOCK_RECOVERY_S4' AND (requires_api OR NOT requires_database OR requires_notification))
  );
  IF definition_total<>1 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY definition mismatch: %',definition_total;
  END IF;
  IF step_total<>4 OR expected_step_total<>4 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY step set mismatch: total=% expected=%',step_total,expected_step_total;
  END IF;
  IF invalid<>0 THEN RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY self-service relay mismatch: %',invalid; END IF;
  IF (SELECT count(*) FROM framework_development_job
      WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required)<>43 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY required job set mismatch';
  END IF;
  IF (SELECT count(*) FROM framework_development_job
      WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required
        AND specification_json::jsonb->>'contractVersion' IS DISTINCT FROM 'ACCOUNT_LOCK_RECOVERY:3.0.0')<>0 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY stale job specification remains';
  END IF;
  IF (SELECT count(*) FROM framework_development_job_gate_result
      WHERE job_id IN (SELECT job_id FROM framework_development_job
        WHERE process_code='ACCOUNT_LOCK_RECOVERY'))<>0 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY stale job gate evidence remains';
  END IF;
  IF (SELECT count(*) FROM framework_development_job
      WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required
        AND (job_status<>'PLANNED' OR approval_status<>'DRAFT'
          OR quality_status<>'PENDING' OR evidence_ref IS NOT NULL))<>0 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY stale job approval or evidence remains';
  END IF;

  SELECT count(*) INTO invalid_artifacts
  FROM framework_process_artifact a
  WHERE a.process_code='ACCOUNT_LOCK_RECOVERY' AND a.required AND (
    a.step_code NOT IN (
      'ACCOUNT_LOCK_RECOVERY_S1','ACCOUNT_LOCK_RECOVERY_S2',
      'ACCOUNT_LOCK_RECOVERY_S3','ACCOUNT_LOCK_RECOVERY_S4'
    )
    OR a.artifact_type<>'PAGE'
    OR a.owner_actor_code<>'MEMBER_USER'
    OR a.target_path<>CASE a.step_code
      WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result'
    END
    OR a.contract_ref<>'process://ACCOUNT_LOCK_RECOVERY/3.0.0/'||a.step_code
    OR a.delivery_status<>'PLANNED' OR a.evidence_ref IS NOT NULL
  );
  IF (SELECT count(*) FROM framework_process_artifact
      WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND required)<>4
      OR invalid_artifacts<>0 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY canonical artifact mismatch: invalid=%',invalid_artifacts;
  END IF;
END $$;
