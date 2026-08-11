-- ACCOUNT_LOCK_RECOVERY 3.0.0 has one public, server-authoritative actor relay.
-- Keep the approved security coverage, but remove the obsolete administrator
-- review/approval journey from the eight executable simulation contracts.
-- Static contract tokens: GENERIC_HTTP_202 APPLICATION_LEVEL_FAIL
-- FIVE_ATTEMPT_LOCK SINGLE_USE_PROOF SESSION_REVOCATION ONE_SHOT_RESULT
-- Professional target tokens: OLD_ACCESS_JWT_REJECTED SAFE_RETRY_RESEND
-- AMBIGUOUS_SUBJECT_SUPPRESSION EXACTLY_ONCE_IDEMPOTENCY
-- ASYNC_TIMING_SAFE_DELIVERY PRESERVE_VALID_PROOF_ON_DUPLICATE_VERIFY
-- ATOMIC_RATE_LIMITS TRUSTED_PROXY_IDENTITY RESEND_INVALIDATES_PREVIOUS

DO $$
DECLARE
  definition_total integer;
  expected_definition_total integer;
  case_total integer;
  expected_case_total integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE process_version='3.0.0'
           AND owner_actor_code='MEMBER_USER'
           AND process_status='IN_DEVELOPMENT'
           AND definition_locked)
  INTO definition_total,expected_definition_total
  FROM framework_process_definition
  WHERE process_code='ACCOUNT_LOCK_RECOVERY';

  IF definition_total<>1 OR expected_definition_total<>1 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY case definition/version/status/lock mismatch definitions=% expected=%',
      definition_total,expected_definition_total;
  END IF;

  SELECT count(*),count(*) FILTER (WHERE case_code IN (
    'ACCOUNT_LOCK_RECOVERY_HAPPY',
    'ACCOUNT_LOCK_RECOVERY_EXCEPTION',
    'ACCOUNT_LOCK_RECOVERY_AUTHORITY',
    'ACCOUNT_LOCK_RECOVERY_ISOLATION',
    'ACCOUNT_LOCK_RECOVERY_RECOVERY',
    'ACCOUNT_LOCK_RECOVERY_ENUMERATION',
    'ACCOUNT_LOCK_RECOVERY_REPLAY',
    'ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE'))
  INTO case_total,expected_case_total
  FROM framework_simulation_case
  WHERE process_code='ACCOUNT_LOCK_RECOVERY';

  IF case_total<>8 OR expected_case_total<>8 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY exact approved case set mismatch total=% expected=%',
      case_total,expected_case_total;
  END IF;
END $$;

CREATE TEMP TABLE account_recovery_self_service_case(
  case_code varchar(120) PRIMARY KEY,
  case_name varchar(300) NOT NULL,
  case_type varchar(50) NOT NULL,
  preconditions text NOT NULL,
  steps_json text NOT NULL,
  assertions_json text NOT NULL,
  required_evidence text NOT NULL,
  expected_duration_minutes integer NOT NULL
) ON COMMIT DROP;

INSERT INTO account_recovery_self_service_case VALUES
('ACCOUNT_LOCK_RECOVERY_HAPPY','OTP 기반 자기복구 4단계 정상 완료','HAPPY_PATH',
 '격리된 잠금 QA 계정, 전달 샌드박스, 기존 access JWT·refresh token·서버 로그인 세션이 준비되고 개발용 코드 노출이 비활성화됨',
 '["S1 아이디·등록 이메일 제출 후 공통 접수 응답과 전달 확인","S2 전달 샌드박스에서 요청 ID에 결속된 OTP를 회수해 서버 검증","S3 단일 사용 복구 증명과 정책 준수 비밀번호로 변경","S4 동일 서버 세션으로 완료 화면을 한 번 확인하고 새 비밀번호로 로그인"]',
 '["S1 HTTP 202와 status=accepted이며 accountExists·developmentCode 없음","요청 상태 CODE_SENT 후 VERIFIED·COMPLETED 순서 전이","OTP와 복구 증명 원문은 DB·로그·증거에 없음","잠금 횟수와 잠금 시각 초기화","기존 access JWT·refresh token·모든 서버 세션이 각각 401 또는 명시적 무효 응답 OLD_ACCESS_JWT_REJECTED","완료 화면 최초 GET만 표시되고 재접근은 복구 시작으로 이동","기존 비밀번호 거부·새 비밀번호 로그인 성공","요청별 감사 이벤트 순서 완전"]',
 '비밀값 제거 요청·응답, 전달 영수증, DB 전후 해시, 구 access JWT·refresh token·서버 세션별 거부 결과, 최초·재접근 화면 증거, 신규 로그인 결과, 감사 타임라인',12),

('ACCOUNT_LOCK_RECOVERY_EXCEPTION','전달·만료·입력 오류의 안전한 실패','EXCEPTION',
 '실패 응답 전달 샌드박스, 만료시각을 통제하는 격리 fixture, 잘못된 요청 ID·OTP·복구 증명·비밀번호 표본과 안전한 재시도·재전송 정책이 준비됨',
 '["전달 실패 fixture로 S1 요청 후 정책 허용 시각에 안전 재시도","잘못된 UUID와 6자리가 아닌 OTP 제출","만료된 OTP와 만료된 복구 증명 제출 후 재전송","비밀번호 정책 미충족과 잘못된 상태의 S3 제출"]',
 '["S1은 전달 실패에도 HTTP 202 공통 응답","S2·S3 업무 오류는 HTTP 200 application-level fail","모든 전달 실패·만료·한도·잘못된 상태·정책 거부가 terminal 또는 retryable 결과와 감사 이벤트를 가짐","SAFE_RETRY_RESEND 계약은 재시도 가능 시각·횟수·동일 요청 재사용 여부를 서버가 결정","재전송은 이전 활성 OTP를 즉시 무효화","비밀번호·토큰·세션 불변","원문 OTP·증명·비밀번호 로그 없음"]',
 '상태·본문 스키마, 전달 실패 영수증, terminal·retryable 사유별 감사 이벤트, 재시도·재전송 전후 OTP 상태, 마스킹 로그 검사, DB·자격증명 전후 해시',10),

('ACCOUNT_LOCK_RECOVERY_AUTHORITY','요청 결속 복구 증명 권한 우회 차단','AUTHORITY',
 '서로 다른 두 QA 사용자 A·B와 각자의 독립 복구 요청·OTP·복구 증명이 준비됨',
 '["A 요청 ID에 B의 OTP 제출","B 요청 ID에 A의 복구 증명 제출","A의 유효 요청·증명으로 client userId를 생략하거나 B로 변조해 S3 제출","소비·만료된 증명으로 다시 제출"]',
 '["교차 OTP·증명은 HTTP 200 application-level fail","S3 client userId는 권한·대상 판정에 사용되지 않고 API 필수값도 아님","복구 대상은 requestId·proof 해시에 서버 결속된 subject만 사용","유효 A 증명은 A만 변경하고 B는 불변","소비·만료된 증명 재사용 거부","거부와 성공 감사에 원문 비밀 없음"]',
 'client userId 생략·변조 요청과 응답, requestId·proof·subject 결속 판정, A·B 계정·자격증명 DB 전후 해시, 거부 감사 이벤트',8),

('ACCOUNT_LOCK_RECOVERY_ISOLATION','브라우저·요청 간 복구 상태 격리','ISOLATION',
 '독립 브라우저 context A·B, 서로 다른 account type·tenant·eligibility namespace의 QA 사용자, 동일 식별정보로 모호해지는 subject 표본, 분리된 provider inbox가 준비됨',
 '["A·B namespace에서 각각 S1 요청","account type·tenant·eligibility 경계를 넘겨 requestId·OTP·proof 교환","동일 아이디·이메일이 둘 이상의 subject에 일치하는 모호한 S1 요청","각 context에서 유일하게 적격인 자기 요청만 정상 완료"]',
 '["상대 namespace의 요청·계정·마스킹 목적지 정보가 화면·응답·provider에 노출되지 않음","교차 입력은 application-level fail이며 상대 상태 불변","AMBIGUOUS_SUBJECT_SUPPRESSION은 우선순위 임의 선택 없이 공통 202·전달 억제·비식별 감사","각 요청은 적격 account type·tenant에 결속된 자기 OTP·proof로만 완료","쿠키·완료 표식·감사 타임라인이 context·requestId별로 분리"]',
 'account type·tenant·eligibility 매트릭스, 두 browser context 네트워크 추적, 모호 subject 전달 0건, 요청·계정별 DB 전후 해시, provider inbox 분리, 감사 이벤트',10),

('ACCOUNT_LOCK_RECOVERY_RECOVERY','비밀번호 변경·세션 폐기의 원자 복구','RECOVERY',
 '격리 시험 환경에서 비밀번호 저장 후 자격증명 폐기 구간의 결정적 장애를 주입·제거하고 동일 idempotency key 병렬 재시도를 실행할 수 있음',
 '["S1·S2 정상 완료와 구 access JWT·refresh token·서버 세션 확보","S3 트랜잭션 중 자격증명 폐기 장애 주입","DB와 모든 인증 상태 rollback 확인","장애 제거 후 동일 명령을 같은 idempotency key로 병렬 재실행"]',
 '["부분 비밀번호 변경·부분 자격증명 폐기·부분 COMPLETED 없음","실패 전 비밀번호·잠금·access JWT·refresh token·서버 세션 상태 복원","EXACTLY_ONCE_IDEMPOTENCY로 동일 명령 결과 1건·비밀번호 이력 1건·COMPLETED 1건","성공 시 OTP·proof·구 access JWT·refresh token·모든 서버 세션 무효","재시도 응답은 동일 terminal 결과이며 추가 변경 없음","실패·복구 감사 순서와 상관관계 ID 보존"]',
 'idempotency key·장애 주입 식별자, 트랜잭션·계정·비밀번호 이력 DB 전후 해시, access JWT·refresh token·세션별 검증 결과, 병렬 응답 집합, 실패·재실행 감사 이벤트',12),

('ACCOUNT_LOCK_RECOVERY_ENUMERATION','계정 존재 여부 열거 방지','VALIDATION',
 '존재·미존재·잠금·부적격·모호 subject 표본, 고유 요청 IP 표본, 개발 코드 비활성화, 비동기 전달 큐와 반복 시간 측정기가 준비됨',
 '["각 표본에 동일 형식 S1 요청을 정책 표본 수만큼 실행","requestId를 정규화한 상태·본문·헤더 스키마 비교","응답 반환과 provider 호출이 분리된 ASYNC_TIMING_SAFE_DELIVERY 확인","처리시간 p50·p95·분포와 미존재·부적격·모호 요청 억제 상태 확인"]',
 '["모두 HTTP 202·status=accepted·동일 메시지·동일 키 집합","accountExists·developmentCode·원문 목적지 없음","provider 성공·지연·실패가 public 응답시간에 직접 반영되지 않음","표본 간 처리시간 차이가 승인된 열거 방지 예산 이내","미존재·부적격·모호 요청은 subject 미결속·전달 억제·비식별 감사","유일한 적격 subject에만 비동기 provider 전달"]',
 '정규화 응답 비교표, p50·p95·분포와 열거 예산 판정, 비동기 queue enqueue·provider 완료 시각, 표본별 전달 건수, 비식별 DB·감사 스냅샷',12),

('ACCOUNT_LOCK_RECOVERY_REPLAY','OTP·복구 증명 재사용 차단','VALIDATION',
 'S2에서 아직 소비하지 않은 유효 proof를 가진 요청과 정상 4단계를 완료한 요청, 동일 idempotency key가 준비됨',
 '["S2 성공 직후 동일 OTP를 다시 검증하고 기존 proof 보존 확인","보존된 proof로 S3 정상 완료","완료된 요청에 동일 proof·동일 idempotency key로 S3 재호출","소비된 proof를 다른 requestId에 대입하고 병렬 재생"]',
 '["duplicate verify는 application-level fail이지만 요청을 EXPIRED로 바꾸거나 기존 유효 proof를 지우지 않음 PRESERVE_VALID_PROOF_ON_DUPLICATE_VERIFY","보존된 proof는 최초 S3를 정확히 한 번 완료","동일 idempotency key의 terminal 재호출은 최초 성공과 동일 결과","다른 key·다른 requestId 재생은 안전 거부","비밀번호 이력·자격증명 상태 추가 변경 없음","재생 감사만 추가되고 원문 비밀 없음"]',
 'S2 직후·중복 verify 후 proof hash와 상태 비교, 최초·중복 terminal 응답, idempotency 저장값, 비밀번호 이력 수, 자격증명 DB 전후 해시, 재생 감사 이벤트',10),

('ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE','OTP 대입·요청 남용 차단','VALIDATION',
 '격리 QA 요청의 실제 OTP와 서로 다른 잘못된 6자리 코드 5개, trusted proxy 경계와 IP·subject·request 축 원자 한도, 재전송 fixture가 준비됨',
 '["같은 requestId에 잘못된 OTP를 동시·순차 5회 제출","잠금 후 원래 유효 OTP 제출","trusted proxy가 확정한 client identity로 IP·subject·request 한도를 동시 초과","재전송 후 이전 OTP와 새 OTP를 각각 검증"]',
 '["ATOMIC_RATE_LIMITS로 경쟁 요청에서도 attempt_count가 정확히 5에서 LOCKED되고 proof 미발급","잠금 후 유효 OTP도 거부","TRUSTED_PROXY_IDENTITY는 신뢰 프록시 외 X-Forwarded-For 위조를 한도 우회에 사용하지 않음","IP 한도는 429·Retry-After를 반환할 수 있으나 subject 존재 여부 관련 억제 응답은 GENERIC_HTTP_202 유지","RESEND_INVALIDATES_PREVIOUS로 새 OTP 발급과 동시에 이전 활성 challenge 무효","한도·잠금·재전송 감사가 원자 카운터와 일치하고 정상 계정으로 범위 확대 없음"]',
 '동시 시도별 응답, request attempt·IP·subject 원자 카운터, trusted/untrusted proxy 헤더 판정, 429 Retry-After와 generic 202 분류표, 재전송 전후 challenge 소비 상태, provider 전달 건수, DB 전후 해시, 보안 감사 이벤트',12);

ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;

DO $$
DECLARE
  updated_total integer;
BEGIN
  DELETE FROM framework_simulation_run
  WHERE case_code IN (SELECT case_code FROM account_recovery_self_service_case);

  UPDATE framework_simulation_case c
  SET case_name=s.case_name,
      case_type=s.case_type,
      preconditions=s.preconditions,
      steps_json=s.steps_json,
      assertions_json=s.assertions_json,
      case_status='APPROVED',
      severity='CRITICAL',
      required_evidence=s.required_evidence,
      automated=false,
      expected_duration_minutes=s.expected_duration_minutes,
      updated_at=current_timestamp
  FROM account_recovery_self_service_case s
  WHERE c.process_code='ACCOUNT_LOCK_RECOVERY'
    AND c.case_code=s.case_code;

  GET DIAGNOSTICS updated_total = ROW_COUNT;
  IF updated_total<>8 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY self-service case update mismatch updated=%',updated_total;
  END IF;
END $$;

ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;

DO $$
DECLARE
  case_total integer;
  expected_case_total integer;
  type_total integer;
  invalid_total integer;
  stale_run_total integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE case_code IN (
           'ACCOUNT_LOCK_RECOVERY_HAPPY',
           'ACCOUNT_LOCK_RECOVERY_EXCEPTION',
           'ACCOUNT_LOCK_RECOVERY_AUTHORITY',
           'ACCOUNT_LOCK_RECOVERY_ISOLATION',
           'ACCOUNT_LOCK_RECOVERY_RECOVERY',
           'ACCOUNT_LOCK_RECOVERY_ENUMERATION',
           'ACCOUNT_LOCK_RECOVERY_REPLAY',
           'ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE')),
         count(DISTINCT case_type),
         count(*) FILTER (WHERE case_status<>'APPROVED' OR automated
           OR severity<>'CRITICAL'
           OR nullif(btrim(preconditions),'') IS NULL
           OR nullif(btrim(steps_json),'') IS NULL
           OR nullif(btrim(assertions_json),'') IS NULL
           OR jsonb_typeof(steps_json::jsonb)<>'array'
           OR jsonb_array_length(steps_json::jsonb)=0
           OR jsonb_typeof(assertions_json::jsonb)<>'array'
           OR jsonb_array_length(assertions_json::jsonb)=0
           OR nullif(btrim(required_evidence),'') IS NULL
           OR expected_duration_minutes<=0
           OR NOT CASE case_code
             WHEN 'ACCOUNT_LOCK_RECOVERY_HAPPY' THEN
               (preconditions||assertions_json||required_evidence) LIKE '%OLD_ACCESS_JWT_REJECTED%'
             WHEN 'ACCOUNT_LOCK_RECOVERY_EXCEPTION' THEN
               (preconditions||steps_json||assertions_json||required_evidence) LIKE '%SAFE_RETRY_RESEND%'
             WHEN 'ACCOUNT_LOCK_RECOVERY_AUTHORITY' THEN
               (steps_json||assertions_json||required_evidence) LIKE '%client userId%API 필수값도 아님%'
             WHEN 'ACCOUNT_LOCK_RECOVERY_ISOLATION' THEN
               (preconditions||assertions_json||required_evidence) LIKE '%AMBIGUOUS_SUBJECT_SUPPRESSION%'
             WHEN 'ACCOUNT_LOCK_RECOVERY_RECOVERY' THEN
               (preconditions||assertions_json||required_evidence) LIKE '%EXACTLY_ONCE_IDEMPOTENCY%'
             WHEN 'ACCOUNT_LOCK_RECOVERY_ENUMERATION' THEN
               (preconditions||steps_json||assertions_json||required_evidence) LIKE '%ASYNC_TIMING_SAFE_DELIVERY%'
             WHEN 'ACCOUNT_LOCK_RECOVERY_REPLAY' THEN
               (preconditions||steps_json||assertions_json||required_evidence) LIKE '%PRESERVE_VALID_PROOF_ON_DUPLICATE_VERIFY%'
             WHEN 'ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE' THEN
               (preconditions||steps_json||assertions_json||required_evidence)
                 LIKE '%ATOMIC_RATE_LIMITS%TRUSTED_PROXY_IDENTITY%RESEND_INVALIDATES_PREVIOUS%'
             ELSE false
           END
           OR (preconditions||steps_json||assertions_json) ~
             '(MEMBER_ADMIN|APPROVER|/admin/api/member-recovery|관리자 위험 검토|분리 승인)')
  INTO case_total,expected_case_total,type_total,invalid_total
  FROM framework_simulation_case
  WHERE process_code='ACCOUNT_LOCK_RECOVERY';

  SELECT count(*) INTO stale_run_total
  FROM framework_simulation_run
  WHERE case_code IN (SELECT case_code FROM account_recovery_self_service_case);

  IF case_total<>8 OR expected_case_total<>8 OR type_total<>6
      OR invalid_total<>0 OR stale_run_total<>0 THEN
    RAISE EXCEPTION
      'ACCOUNT_LOCK_RECOVERY self-service case guard mismatch total=% expected=% types=% invalid=% staleRuns=%',
      case_total,expected_case_total,type_total,invalid_total,stale_run_total;
  END IF;
END $$;
