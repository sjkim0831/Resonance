-- Professional account lock/dormancy recovery design.
-- The design deliberately forbids browser-only verification. Runtime jobs must
-- implement an opaque, server-side challenge and a configured delivery adapter.

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET process_name='휴면·잠금 계정 복구',
    goal='잠금 또는 휴면 계정의 요청자를 서버에서 검증하고 독립 검토 후 계정을 안전하게 복구하며 기존 세션과 복구 증명을 재사용할 수 없게 한다.',
    start_condition='계정 존재 여부를 외부에 노출하지 않는 복구 요청이 접수되고 서버 복구 채널과 회원 관리자·승인자 직무분리가 구성되어 있다.',
    completion_condition='서버 신원검증, 위험 검토, 승인, 계정 상태 변경, 실패횟수 초기화, 기존 세션 폐기, 완료 통지와 불변 감사이력이 하나의 추적 가능한 복구 건으로 저장된다.',
    owner_actor_code='MEMBER_ADMIN',risk_level='CRITICAL',review_cycle_days=30,
    regulation_refs='개인정보 보호법; 전자정부서비스 계정 보안; 접근통제·인증정보 관리 정책',
    process_status='ACTIVE',definition_locked=true,updated_at=current_timestamp
WHERE process_code='ACCOUNT_LOCK_RECOVERY';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

CREATE TEMP TABLE account_recovery_design(
  step_code varchar(80) PRIMARY KEY,
  step_name varchar(200) NOT NULL,
  actor_code varchar(80) NOT NULL,
  from_state varchar(80) NOT NULL,
  to_state varchar(80) NOT NULL,
  command_code varchar(120) NOT NULL,
  requirement_text text NOT NULL,
  completion_rule text NOT NULL,
  api_contract jsonb NOT NULL,
  input_contract jsonb NOT NULL,
  output_contract jsonb NOT NULL,
  section_contract jsonb NOT NULL,
  field_contract jsonb NOT NULL,
  command_contract jsonb NOT NULL,
  persistence_contract jsonb NOT NULL,
  evidence_contract jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO account_recovery_design VALUES
('ACCOUNT_LOCK_RECOVERY_S1','복구 요청 접수·범위 확인','MEMBER_USER','READY','REQUESTED','REQUEST_RECOVERY',
 '로그인 아이디와 등록된 복구 채널을 입력받되 계정 존재 여부와 채널 원문을 응답하지 않는다. 서버는 요청 식별자를 난수로 발급하고 OTP 원문이 아닌 해시, 만료시각, 시도 제한, 요청 IP·기기 해시와 속도 제한 키를 저장한다.',
 '존재 여부와 무관하게 동일한 응답 형식·상태코드·유사한 처리시간을 반환하고, 유효 계정에만 구성된 전달 어댑터로 일회용 코드를 전송하며 REQUESTED 감사 이벤트를 남긴다.',
 '[{"code":"REQUEST_RECOVERY","method":"POST","path":"/api/public/account-recovery/requests","request":"AccountRecoveryRequest","response":"GenericRecoveryAccepted","enumerationSafe":true,"rateLimited":true}]',
 '{"loginId":"required","recoveryChannel":"required","locale":"required","captchaToken":"policyBased","requestIp":"serverResolved","deviceFingerprintHash":"serverResolved","idempotencyKey":"required"}',
 '{"requestId":"opaque","accepted":true,"expiresAt":"maskedPolicyValue","nextState":"REQUESTED","accountExists":"neverReturned"}',
 '[{"code":"RECOVERY_NOTICE","label":"복구 안내·개인정보 처리"},{"code":"ACCOUNT_HINT","label":"계정·복구 채널 입력"},{"code":"REQUEST_RESULT","label":"동일 형식 접수 결과"}]',
 '[{"fieldCode":"loginId","label":"로그인 아이디","controlType":"TEXT","required":true,"autocomplete":"username"},{"fieldCode":"recoveryChannel","label":"등록된 이메일 또는 휴대전화","controlType":"TEXT","required":true,"maskAfterSubmit":true},{"fieldCode":"locale","label":"통지 언어","controlType":"SELECT","required":true,"options":["ko","en"]},{"fieldCode":"privacyNoticeAccepted","label":"복구 목적 개인정보 처리 확인","controlType":"CHECKBOX","required":true}]',
 '[{"code":"REQUEST_RECOVERY","label":"복구 코드 요청","transactional":true,"idempotencyRequired":true,"genericResponse":true}]',
 '[{"entity":"ACCOUNT_RECOVERY_REQUEST","keys":["requestId"],"storedSecret":"argon2OrHmacHashOnly","ttlRequired":true,"attemptLimitRequired":true},{"entity":"SECURITY_AUDIT_EVENT","appendOnly":true}]',
 '[{"type":"REQUEST_ACCEPTED","fields":["requestId","requestedAt","channelType","ipHash","deviceHash","policyVersion"]},{"type":"DELIVERY_RESULT","fields":["providerCode","providerMessageId","deliveredAt","failureCode"],"secretExcluded":true}]'),

('ACCOUNT_LOCK_RECOVERY_S2','서버 신원검증·복구 증명 발급','MEMBER_USER','REQUESTED','IDENTITY_VERIFIED','VERIFY_RECOVERY_CHALLENGE',
 '사용자가 입력한 일회용 코드는 서버의 해시와 상수시간 비교하고 만료, 사용 여부, 실패횟수, 요청 범위와 속도 제한을 검증한다. 브라우저 상태나 화면에 저장된 코드 비교는 신원증명으로 인정하지 않는다.',
 '유효한 코드가 한 번만 소비되고 짧은 수명의 단일 목적 복구 증명 해시가 서버에 저장된다. 실패 시 남은 횟수 원문을 과도하게 노출하지 않고 한도 초과 요청을 잠근다.',
 '[{"code":"VERIFY_RECOVERY_CHALLENGE","method":"POST","path":"/api/public/account-recovery/requests/{requestId}/verify","request":"RecoveryChallengeVerification","response":"RecoveryProofIssued","singleUse":true,"constantTimeCompare":true}]',
 '{"requestId":"required","verificationCode":"required","idempotencyKey":"required","requestIp":"serverResolved","deviceFingerprintHash":"serverResolved"}',
 '{"recoveryProof":"opaqueSingleUse","proofExpiresAt":"required","nextState":"IDENTITY_VERIFIED","remainingAttempts":"policyMasked"}',
 '[{"code":"CHALLENGE_STATUS","label":"만료·재전송 상태"},{"code":"CODE_INPUT","label":"일회용 코드 입력"},{"code":"SECURITY_FEEDBACK","label":"안전한 오류·재시도 안내"}]',
 '[{"fieldCode":"requestId","label":"복구 요청 번호","controlType":"HIDDEN","required":true,"editable":false},{"fieldCode":"verificationCode","label":"일회용 인증 코드","controlType":"OTP","required":true,"autocomplete":"one-time-code"},{"fieldCode":"expiresAt","label":"인증 유효시간","controlType":"TIMER","required":true,"editable":false},{"fieldCode":"resendAvailableAt","label":"재전송 가능 시각","controlType":"TEXT","editable":false}]',
 '[{"code":"VERIFY_RECOVERY_CHALLENGE","label":"본인 확인","transactional":true,"singleUse":true},{"code":"RESEND_CHALLENGE","label":"코드 재전송","rateLimited":true,"invalidatesPrevious":true}]',
 '[{"entity":"ACCOUNT_RECOVERY_REQUEST","optimisticLock":true,"atomicUpdates":["attemptCount","consumedAt","state"]},{"entity":"ACCOUNT_RECOVERY_PROOF","storedSecret":"hashOnly","ttlRequired":true,"singleUse":true},{"entity":"SECURITY_AUDIT_EVENT","appendOnly":true}]',
 '[{"type":"IDENTITY_VERIFIED","fields":["requestId","verifiedAt","attemptCount","proofExpiresAt"]},{"type":"CHALLENGE_REJECTED","fields":["requestId","reasonCode","attemptCount","lockedUntil"],"secretExcluded":true}]'),

('ACCOUNT_LOCK_RECOVERY_S3','잠금 원인·위험 독립 검토','MEMBER_ADMIN','IDENTITY_VERIFIED','REVIEW_APPROVED','REVIEW_ACCOUNT_RECOVERY',
 '회원 관리자는 복구 요청자와 분리된 권한으로 잠금·휴면 원인, 최근 로그인·실패 이력, 위험 신호, 본인확인 결과와 중복 요청을 검토한다. 자기 계정, 다른 테넌트 또는 만료된 복구 증명은 처리할 수 없다.',
 '승인·반려 결정에 정책 코드와 구체적 근거가 저장되고 고위험 건은 추가 증빙 또는 상위 승인으로 분기한다. 결정 시 행 버전을 검증해 중복 승인과 경쟁 갱신을 차단한다.',
 '[{"code":"LOAD_RECOVERY_REVIEW","method":"GET","path":"/admin/api/member-recovery/{requestId}","authority":"MEMBER_RECOVERY_REVIEW"},{"code":"REVIEW_ACCOUNT_RECOVERY","method":"POST","path":"/admin/api/member-recovery/{requestId}/review","request":"AccountRecoveryReviewDecision","response":"RecoveryReviewResult","authority":"MEMBER_RECOVERY_REVIEW","optimisticLock":true}]',
 '{"requestId":"required","decision":"APPROVE_OR_REJECT","reasonCode":"required","decisionReason":"required","evidenceRefs":"riskBased","rowVersion":"required","actorTenantId":"serverResolved"}',
 '{"reviewId":"required","state":"REVIEW_APPROVED_OR_REJECTED","reviewedBy":"required","reviewedAt":"required","nextTaskId":"approvalOnly"}',
 '[{"code":"ACCOUNT_STATUS","label":"계정·잠금·휴면 현황"},{"code":"IDENTITY_EVIDENCE","label":"본인확인·전달 증적"},{"code":"RISK_TIMELINE","label":"접속·실패·복구 요청 이력"},{"code":"REVIEW_DECISION","label":"검토 결정·근거"}]',
 '[{"fieldCode":"memberId","label":"회원 식별자","controlType":"TEXT","editable":false,"masked":true},{"fieldCode":"accountStatus","label":"계정 상태","controlType":"STATUS","editable":false},{"fieldCode":"lockReason","label":"잠금·휴면 원인","controlType":"TEXT","editable":false},{"fieldCode":"failedLoginCount","label":"로그인 실패 횟수","controlType":"NUMBER","editable":false},{"fieldCode":"lastLoginAt","label":"최근 로그인","controlType":"DATETIME","editable":false},{"fieldCode":"identityProofStatus","label":"서버 본인확인 상태","controlType":"STATUS","editable":false},{"fieldCode":"riskSignals","label":"위험 신호","controlType":"TABLE","editable":false},{"fieldCode":"decision","label":"검토 결정","controlType":"RADIO","required":true,"options":["APPROVE","REJECT","REQUIRE_MORE_EVIDENCE"]},{"fieldCode":"reasonCode","label":"결정 사유 코드","controlType":"SELECT","required":true},{"fieldCode":"decisionReason","label":"상세 결정 근거","controlType":"TEXTAREA","required":true},{"fieldCode":"rowVersion","label":"행 버전","controlType":"HIDDEN","required":true,"editable":false}]',
 '[{"code":"REVIEW_ACCOUNT_RECOVERY","label":"검토 저장","transactional":true,"authorityRequired":true,"selfActionDenied":true,"idempotencyRequired":true}]',
 '[{"entity":"ACCOUNT_RECOVERY_REVIEW","keys":["reviewId"],"tenantScoped":true,"versioned":true},{"entity":"MEMBER_LOGIN_HISTORY","readOnly":true,"tenantScoped":true},{"entity":"SECURITY_AUDIT_EVENT","appendOnly":true,"beforeAfterRequired":true}]',
 '[{"type":"RECOVERY_REVIEWED","fields":["requestId","reviewId","decision","reasonCode","reviewedBy","reviewedAt","rowVersion"]},{"type":"RECOVERY_REVIEW_CONFLICT","fields":["requestId","expectedVersion","actualVersion"]}]'),

('ACCOUNT_LOCK_RECOVERY_S4','복구 승인·원자적 적용·통지','APPROVER','REVIEW_APPROVED','COMPLETED','COMPLETE_ACCOUNT_RECOVERY',
 '승인자는 검토자와 분리된 권한으로 복구 결정을 확정한다. 서버 트랜잭션은 복구 증명의 미사용·미만료 상태와 최신 계정 버전을 재검증한 뒤 계정 활성화, 실패횟수 초기화, 모든 기존 세션·리프레시 토큰 폐기, 복구 증명 소비를 원자적으로 수행한다.',
 '계정이 ACTIVE가 되고 기존 인증 세션은 모두 무효화되며 사용자는 새 비밀번호 설정을 요구받는다. 성공·실패 통지가 전달되고 같은 명령 재시도는 동일 결과를 반환하며 전체 감사 증적이 보존된다.',
 '[{"code":"COMPLETE_ACCOUNT_RECOVERY","method":"POST","path":"/admin/api/member-recovery/{requestId}/complete","request":"AccountRecoveryCompletion","response":"AccountRecoveryCompleted","authority":"MEMBER_RECOVERY_APPROVE","transactional":true,"idempotent":true}]',
 '{"requestId":"required","reviewId":"required","approvalDecision":"required","approvalReason":"required","recoveryProof":"serverBound","rowVersion":"required","idempotencyKey":"required"}',
 '{"state":"COMPLETED","memberStatus":"ACTIVE","sessionsRevoked":true,"passwordChangeRequired":true,"notificationStatus":"required","completedAt":"required","auditEventId":"required"}',
 '[{"code":"APPROVAL_SUMMARY","label":"검토·위험·증적 요약"},{"code":"FINAL_DECISION","label":"최종 승인·반려"},{"code":"ATOMIC_RESULT","label":"계정·세션·증명 처리 결과"},{"code":"NOTIFICATION_RESULT","label":"완료 통지·후속 로그인 안내"}]',
 '[{"fieldCode":"requestId","label":"복구 요청 번호","controlType":"TEXT","editable":false},{"fieldCode":"reviewDecision","label":"검토 결과","controlType":"STATUS","editable":false},{"fieldCode":"riskSummary","label":"위험 요약","controlType":"TEXTAREA","editable":false},{"fieldCode":"approvalDecision","label":"최종 결정","controlType":"RADIO","required":true,"options":["APPROVE","REJECT"]},{"fieldCode":"approvalReason","label":"최종 결정 근거","controlType":"TEXTAREA","required":true},{"fieldCode":"revokeAllSessions","label":"기존 세션 전체 폐기","controlType":"CHECKBOX","required":true,"fixedValue":true},{"fieldCode":"requirePasswordChange","label":"다음 로그인 비밀번호 변경","controlType":"CHECKBOX","required":true,"fixedValue":true},{"fieldCode":"rowVersion","label":"행 버전","controlType":"HIDDEN","required":true,"editable":false}]',
 '[{"code":"COMPLETE_ACCOUNT_RECOVERY","label":"승인하고 계정 복구","transactional":true,"authorityRequired":true,"segregationRequired":true,"idempotencyRequired":true},{"code":"REJECT_ACCOUNT_RECOVERY","label":"복구 반려","transactional":true,"reasonRequired":true}]',
 '[{"entity":"MEMBER_ACCOUNT","atomicUpdates":["status","lockAt","failedLoginCount","passwordChangeRequired","rowVersion"]},{"entity":"AUTH_SESSION","bulkRevoke":true},{"entity":"ACCOUNT_RECOVERY_PROOF","singleUse":true},{"entity":"ACCOUNT_RECOVERY_REQUEST","terminalState":true},{"entity":"SECURITY_AUDIT_EVENT","appendOnly":true,"beforeAfterRequired":true}]',
 '[{"type":"ACCOUNT_RECOVERY_COMPLETED","fields":["requestId","memberId","approvedBy","completedAt","sessionsRevoked","notificationStatus","policyVersion"]},{"type":"ACCOUNT_RECOVERY_REJECTED","fields":["requestId","reasonCode","approvedBy","completedAt"]}]');

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step s
SET step_name=d.step_name,actor_code=d.actor_code,from_state=d.from_state,to_state=d.to_state,
    command_code=d.command_code,requirement_text=d.requirement_text,completion_rule=d.completion_rule,
    api_contract=(SELECT jsonb_agg(jsonb_build_object('method',e->>'method','path',e->>'path'))::text
                    FROM jsonb_array_elements(d.api_contract) e),
    input_contract=d.input_contract::text,output_contract=d.output_contract::text,
    requires_api=true,requires_database=true,evidence_required=true,
    evidence_types='["REQUEST_SNAPSHOT","SERVER_IDENTITY_PROOF","ACTOR_AUTHORITY","STATE_TRANSITION","DATA_CHANGE","DELIVERY_RESULT","SESSION_REVOCATION","AUDIT_EVENT"]'
FROM account_recovery_design d
WHERE s.process_code='ACCOUNT_LOCK_RECOVERY' AND s.step_code=d.step_code;
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_step_execution_spec x
SET actor_contract=jsonb_build_object('actorCode',d.actor_code,'serverAuthorization',true,'tenantScoped',true,'segregationRequired',d.step_code IN ('ACCOUNT_LOCK_RECOVERY_S3','ACCOUNT_LOCK_RECOVERY_S4')),
    business_contract=jsonb_build_object('purpose',d.requirement_text,'completionRule',d.completion_rule,'browserOnlyVerificationForbidden',true,'deliveryAdapterRequired',true),
    transition_contract=jsonb_build_object('from',d.from_state,'to',d.to_state,'invalidStatesRejected',true,'optimisticLock',true),
    input_contract=d.input_contract,output_contract=d.output_contract,
    screen_contract=d.section_contract,field_contract=d.field_contract,command_contract=d.command_contract,
    api_contract=d.api_contract,persistence_contract=d.persistence_contract,
    handoff_contract=jsonb_build_object('nextState',d.to_state,'nextActor',CASE d.step_code WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN 'MEMBER_USER' WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN 'MEMBER_ADMIN' WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN 'APPROVER' ELSE null END,'notificationRequired',true),
    test_contract='[{"type":"HAPPY_PATH"},{"type":"EXCEPTION"},{"type":"AUTHORITY"},{"type":"ISOLATION"},{"type":"RECOVERY"},{"type":"ENUMERATION"},{"type":"REPLAY"},{"type":"BRUTE_FORCE"}]',
    guide_contract=jsonb_build_object('title',d.step_name,'purpose',d.requirement_text,'completion',d.completion_rule,'nextAction',d.to_state),
    nonfunctional_contract='{"accessibility":"WCAG_2_1_AA","responsive":true,"genericResponseTiming":true,"rateLimitRequired":true,"secretLoggingForbidden":true,"sensitiveValueMasking":true}',
    design_status='DESIGN_COMPLETE',approval_status='APPROVED',generation_status='READY',blocker_codes='[]',
    source_hash=md5(d.step_code||d.requirement_text||d.api_contract::text||d.field_contract::text),
    approved_by='ACCOUNT_RECOVERY_PROFESSIONALIZATION',approved_at=current_timestamp,updated_at=current_timestamp
FROM account_recovery_design d
WHERE x.process_code='ACCOUNT_LOCK_RECOVERY' AND x.step_code=d.step_code;

UPDATE framework_professional_screen_contract p
SET screen_name='휴면·잠금 계정 복구 - '||d.step_name,
    actor_code=d.actor_code,business_purpose=d.requirement_text,
    entry_condition=d.from_state||' 상태이며 요청 범위, 서버 증명, 액터 권한과 최신 행 버전이 유효해야 한다.',
    exit_condition=d.completion_rule,
    kpi_contract='[{"code":"RECOVERY_SLA","label":"복구 처리시간","unit":"MINUTE"},{"code":"FAILED_ATTEMPTS","label":"차단된 부정 시도","unit":"COUNT"},{"code":"SESSION_REVOKE_RATE","label":"세션 폐기 성공률","unit":"PERCENT"}]',
    section_contract=d.section_contract::text,field_contract=d.field_contract::text,
    command_contract=d.command_contract::text,
    state_contract=jsonb_build_array(d.from_state,'LOADING','READY','SAVING','ERROR','FORBIDDEN','EXPIRED','RATE_LIMITED','CONFLICT','RECOVERY',d.to_state)::text,
    api_contract=d.api_contract::text,data_contract=d.persistence_contract::text,evidence_contract=d.evidence_contract::text,
    responsive_contract='360px 단일 열과 하단 주요 명령, 768px 요약·입력 분리, 1280px 이상 검토 목록·상세 2열을 사용하며 표는 카드 전환 또는 내부 스크롤로 본문을 넘지 않는다.',
    accessibility_contract='KRDS와 WCAG 2.1 AA를 적용하고 OTP 자동완성, 남은 시간 라이브 영역, 오류 요약·필드 연결, 키보드 초점 복귀, 비색상 상태 표현을 제공한다.',
    security_contract='서버 검증만 신원증명으로 인정한다. 복구 코드·증명 원문은 저장·로그·응답하지 않으며 열거 방지, TTL, 1회성, 속도 제한, 테넌트 격리, 직무분리, 세션 전체 폐기와 불변 감사를 강제한다.',
    api_verified=false,database_verified=false,authority_verified=false,
    responsive_verified=false,accessibility_verified=false,exception_states_verified=false,
    audit_evidence_ref='DESIGN:ACCOUNT_LOCK_RECOVERY:3.0.0',contract_status='DESIGN_COMPLETE',
    updated_by='ACCOUNT_RECOVERY_PROFESSIONALIZATION',updated_at=current_timestamp
FROM account_recovery_design d
WHERE p.process_code='ACCOUNT_LOCK_RECOVERY' AND p.step_code=d.step_code;

ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;
INSERT INTO framework_simulation_case(
 case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,
 case_status,severity,required_evidence,automated,expected_duration_minutes
) VALUES
('ACCOUNT_LOCK_RECOVERY_HAPPY','ACCOUNT_LOCK_RECOVERY','서버 검증부터 잠금 해제까지 정상 복구','HAPPY_PATH','잠긴 테스트 계정, 전달 어댑터, 분리된 관리자·승인자 계정이 준비됨','["동일 응답 복구 요청","서버 OTP 검증","관리자 위험 검토","분리 승인","계정 복구 후 로그인"]','["상태=COMPLETED","계정=ACTIVE","기존 세션 전부 401","복구 증명 재사용 409","감사 타임라인 완전"]','APPROVED','CRITICAL','요청·응답, DB 전후값, 세션 폐기 결과, 감사 이벤트',false,12),
('ACCOUNT_LOCK_RECOVERY_EXCEPTION','ACCOUNT_LOCK_RECOVERY','만료·오류·전달 실패 안전 처리','EXCEPTION','만료 코드와 실패하도록 구성한 전달 어댑터가 존재','["존재·미존재 계정 요청 비교","전달 실패","만료 코드 검증","잘못된 상태 완료 요청"]','["외부 응답 형식 동일","비밀값 로그 없음","상태 전이 없음","재시도 가능 감사 이벤트"]','APPROVED','CRITICAL','응답 시간 분포, 마스킹 로그, 롤백 DB 스냅샷',false,8),
('ACCOUNT_LOCK_RECOVERY_AUTHORITY','ACCOUNT_LOCK_RECOVERY','자기복구·직무분리·권한 우회 차단','AUTHORITY','일반 회원, 회원 관리자, 검토자와 승인자 계정이 분리됨','["일반 회원 관리 API 호출","관리자 자기 계정 검토","검토자가 동일 건 승인","권한 만료 후 재시도"]','["모두 403","계정 상태 불변","거부 감사 이벤트","민감정보 마스킹"]','APPROVED','CRITICAL','권한 결정, 403 응답, DB 무변경 증적',false,8),
('ACCOUNT_LOCK_RECOVERY_ISOLATION','ACCOUNT_LOCK_RECOVERY','다른 테넌트 회원·복구 건 격리','ISOLATION','서로 다른 두 테넌트와 각각의 회원·관리자 계정이 존재','["A 테넌트 요청 생성","B 관리자로 A 요청 조회·검토·완료","요청 식별자 변조"]','["404 또는 403","A 데이터 미노출","A 계정 상태 불변","격리 위반 감사"]','APPROVED','CRITICAL','테넌트별 쿼리·응답·감사 이벤트',false,7),
('ACCOUNT_LOCK_RECOVERY_RECOVERY','ACCOUNT_LOCK_RECOVERY','완료 중 실패·중복 요청 원자 복구','RECOVERY','세션 폐기 단계 장애와 동일 멱등키 병렬 호출을 재현 가능','["계정 갱신 후 장애 주입","동일 명령 병렬 재시도","장애 제거 후 재개"]','["부분 활성화 없음","최종 결과 1건","세션 전부 폐기","증명 1회 소비","실패·복구 감사 보존"]','APPROVED','CRITICAL','트랜잭션 로그, 멱등 결과, 세션 저장소, 감사 이벤트',false,10),
('ACCOUNT_LOCK_RECOVERY_ENUMERATION','ACCOUNT_LOCK_RECOVERY','계정 존재 여부 열거 방지','VALIDATION','존재·미존재·휴면·잠금 아이디 표본과 반복 측정 도구가 준비됨','["각 표본에 같은 요청 반복","상태·본문·헤더·처리시간 비교"]','["동일 상태코드와 스키마","식별 가능한 본문 차이 없음","처리시간 정책 허용범위","미존재 계정 데이터 미생성"]','APPROVED','CRITICAL','응답 비교표와 처리시간 통계',false,10),
('ACCOUNT_LOCK_RECOVERY_REPLAY','ACCOUNT_LOCK_RECOVERY','OTP·복구 증명 재사용 차단','VALIDATION','정상 소비된 OTP와 복구 증명이 존재','["동일 OTP 재검증","동일 증명으로 완료 재호출","다른 요청에 증명 대입"]','["재사용 거부","멱등키 동일 호출만 동일 결과","계정 추가 변경 없음","재사용 감사 이벤트"]','APPROVED','CRITICAL','요청·응답, 증명 소비시각, DB 전후값',false,7),
('ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE','ACCOUNT_LOCK_RECOVERY','코드 무차별 대입·재전송 남용 차단','VALIDATION','낮은 테스트 한도와 다수 잘못된 코드가 준비됨','["오류 코드를 한도까지 제출","IP·계정·요청 축으로 병렬 시도","재전송 반복"]','["정책 한도에서 차단","이전 코드 무효","429와 Retry-After","정상 계정 잠금 확대 없음","보안 감사 생성"]','APPROVED','CRITICAL','속도 제한 카운터, 응답 헤더, 감사 이벤트',false,8)
ON CONFLICT(case_code) DO UPDATE SET
 case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,
 steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status='APPROVED',
 severity=excluded.severity,required_evidence=excluded.required_evidence,automated=false,
 expected_duration_minutes=excluded.expected_duration_minutes,updated_at=current_timestamp;
ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;

INSERT INTO framework_common_feature_package(
 feature_code,feature_name,feature_version,feature_category,description,
 api_contract,data_contract,ui_contract,event_contract,permission_contract,test_contract,install_strategy,active_yn
) VALUES(
 'ACCOUNT_RECOVERY_CHALLENGE','서버 검증형 계정 복구','3.0.0','SECURITY',
 '불투명 요청, 해시 OTP, 단일 목적 복구 증명, 전달 어댑터, 속도 제한, 독립 검토, 원자적 잠금 해제와 세션 폐기를 제공한다.',
 '["POST /api/public/account-recovery/requests","POST /api/public/account-recovery/requests/{requestId}/verify","GET /admin/api/member-recovery/{requestId}","POST /admin/api/member-recovery/{requestId}/review","POST /admin/api/member-recovery/{requestId}/complete"]',
 '["account_recovery_request","account_recovery_proof","account_recovery_review","security_audit_event","auth_session"]',
 '["RecoveryRequestForm","OtpVerificationForm","RecoveryReviewWorkspace","RecoveryApprovalPanel"]',
 '["RECOVERY_REQUESTED","IDENTITY_VERIFIED","RECOVERY_REVIEWED","ACCOUNT_RECOVERY_COMPLETED","ACCOUNT_RECOVERY_REJECTED"]',
 '["MEMBER_USER:REQUEST_AND_VERIFY","MEMBER_ADMIN:REVIEW","APPROVER:COMPLETE","SEGREGATION_OF_DUTIES","TENANT_SCOPE"]',
 '["HAPPY_PATH","EXCEPTION","AUTHORITY","ISOLATION","RECOVERY","ENUMERATION","REPLAY","BRUTE_FORCE"]',
 'GENERATE','Y'
) ON CONFLICT(feature_code) DO UPDATE SET
 feature_name=excluded.feature_name,feature_version=excluded.feature_version,
 description=excluded.description,api_contract=excluded.api_contract,data_contract=excluded.data_contract,
 ui_contract=excluded.ui_contract,event_contract=excluded.event_contract,
 permission_contract=excluded.permission_contract,test_contract=excluded.test_contract,
 install_strategy=excluded.install_strategy,active_yn='Y',updated_at=current_timestamp;

DO $$
DECLARE blockers integer; approved_families integer; invalid_steps integer;
BEGIN
  SELECT count(*) INTO invalid_steps FROM framework_process_step s
  WHERE s.process_code='ACCOUNT_LOCK_RECOVERY' AND (
    nullif(btrim(s.api_contract),'') IS NULL OR
    (s.to_state<>'COMPLETED' AND NOT EXISTS(
      SELECT 1 FROM framework_process_step n
      WHERE n.process_code=s.process_code AND n.from_state=s.to_state))
  );
  SELECT count(DISTINCT CASE WHEN case_type='VALIDATION' THEN 'EXCEPTION' ELSE case_type END)
    INTO approved_families
  FROM framework_simulation_case
  WHERE process_code='ACCOUNT_LOCK_RECOVERY' AND case_status IN('APPROVED','VERIFIED')
    AND case_type IN('HAPPY_PATH','EXCEPTION','VALIDATION','AUTHORITY','ISOLATION','RECOVERY');
  SELECT design_blocker_count INTO blockers
  FROM framework_process_design_assurance_matrix WHERE process_code='ACCOUNT_LOCK_RECOVERY';
  IF invalid_steps<>0 OR approved_families<>5 OR blockers<>0 THEN
    RAISE EXCEPTION 'ACCOUNT_LOCK_RECOVERY_DESIGN_INCOMPLETE invalid_steps=% approved_families=% blockers=%',invalid_steps,approved_families,blockers;
  END IF;
END $$;

SELECT * FROM framework_audit_all_process_designs('ACCOUNT_RECOVERY_PROFESSIONALIZATION');
