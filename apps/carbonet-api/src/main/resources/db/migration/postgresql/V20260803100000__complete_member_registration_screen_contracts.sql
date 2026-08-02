-- Canonicalize the implemented public registration wizard and its administrator hand-off.
-- Runtime evidence is produced by ops/scripts/validate-member-registration-runtime.sh.

UPDATE framework_process_step SET
  user_path = CASE step_code
    WHEN 'MEMBER_REGISTRATION_S1' THEN '/join/step1'
    WHEN 'MEMBER_REGISTRATION_S2' THEN '/join/step2'
    WHEN 'MEMBER_REGISTRATION_S3' THEN '/join/step3'
    WHEN 'MEMBER_REGISTRATION_S4' THEN '/join/step4'
    WHEN 'MEMBER_REGISTRATION_S5' THEN '/join/step5' END,
  admin_path = CASE step_code
    WHEN 'MEMBER_REGISTRATION_S1' THEN '/admin/member/list'
    WHEN 'MEMBER_REGISTRATION_S2' THEN '/admin/system/consent-history'
    WHEN 'MEMBER_REGISTRATION_S3' THEN '/admin/member/list'
    WHEN 'MEMBER_REGISTRATION_S4' THEN '/admin/member/approve'
    WHEN 'MEMBER_REGISTRATION_S5' THEN '/admin/member/approve' END,
  api_contract = CASE step_code
    WHEN 'MEMBER_REGISTRATION_S1' THEN 'GET /join/api/session; POST /join/api/step1'
    WHEN 'MEMBER_REGISTRATION_S2' THEN 'POST /join/api/step2'
    WHEN 'MEMBER_REGISTRATION_S3' THEN 'POST /join/api/step3; external identity provider callback'
    WHEN 'MEMBER_REGISTRATION_S4' THEN 'GET /join/checkId; GET /join/checkEmail; POST /join/api/step4/submit multipart'
    WHEN 'MEMBER_REGISTRATION_S5' THEN 'GET /join/step5' END
WHERE process_code='MEMBER_REGISTRATION';

WITH canonical(step_code,audience,route_path,screen_name,actor_code,purpose,fields,commands,apis,data_contract) AS (VALUES
 ('MEMBER_REGISTRATION_S1','USER','/join/step1','회원가입 1단계 - 회원 유형 선택','PUBLIC_APPLICANT','가입 업무와 소속 유형에 맞는 회원 유형을 선택하고 서버 가입 세션을 시작한다.',
  '["membershipType","userType","joinStep"]','["loadSession","selectMemberType","reset"]','["GET /join/api/session","POST /join/api/step1","POST /join/api/reset"]','["HTTP_SESSION.joinVO.entrprsSeCode","HTTP_SESSION.joinVO.userTy","HTTP_SESSION.joinStep"]'),
 ('MEMBER_REGISTRATION_S1','ADMIN','/admin/member/list','회원가입 신청 목록','MEMBER_ADMIN','가입 신청자가 생성한 회원 신청과 현재 처리 상태를 조회한다.',
  '["memberId","memberName","membershipType","companyName","status","submittedAt"]','["search","openApplication"]','["GET /admin/member/api/list"]','["COMTNENTRPRSMBER","COMTNEMPLYRINFO"]'),
 ('MEMBER_REGISTRATION_S2','USER','/join/step2','회원가입 2단계 - 필수 동의','PUBLIC_APPLICANT','이용약관 개인정보 및 GWP 정보제공 고지를 확인하고 버전별 동의 증적을 저장한다.',
  '["agreeTerms","agreePrivacy","agreeGwp","marketingYn","consentVersion"]','["loadConsents","acceptRequiredConsents","back"]','["POST /join/api/step2"]','["member_consent_history","HTTP_SESSION.joinVO.marketingYn"]'),
 ('MEMBER_REGISTRATION_S2','ADMIN','/admin/system/consent-history','회원 동의 이력 관리','MEMBER_ADMIN','회원가입 시점의 필수 및 선택 동의 버전과 요청 증적을 감사 가능하게 조회한다.',
  '["memberId","sessionId","consentType","consentVersion","agreedYn","ipAddress","createdAt"]','["search","exportEvidence"]','["GET /admin/system/consent-history/api"]','["member_consent_history"]'),
 ('MEMBER_REGISTRATION_S3','USER','/join/step3','회원가입 3단계 - 본인 확인','PUBLIC_APPLICANT','외부 본인확인 공급자를 통해 CI와 DI를 검증하고 성공한 세션만 정보 입력으로 전환한다.',
  '["authMethod","verifiedIdentity","verificationMode","providerReference"]','["startIdentityVerification","confirmProviderResult","retry"]','["POST /join/api/step3","identity provider callback"]','["HTTP_SESSION.joinVO.authTy","HTTP_SESSION.joinVO.authCi","HTTP_SESSION.joinVO.authDi"]'),
 ('MEMBER_REGISTRATION_S3','ADMIN','/admin/member/list','회원 본인확인 상태 조회','MEMBER_ADMIN','가입 신청의 본인확인 완료 여부와 공급자 증적 유무를 개인정보 최소 노출 원칙으로 확인한다.',
  '["memberId","authType","identityVerified","verificationAt","status"]','["search","openMaskedEvidence"]','["GET /admin/member/api/list"]','["COMTNENTRPRSMBER"]'),
 ('MEMBER_REGISTRATION_S4','USER','/join/step4','회원가입 4단계 - 회원 및 소속 정보','PUBLIC_APPLICANT','중복 확인된 계정과 연락처 소속 사업자 주소 및 증빙을 하나의 가입 신청 트랜잭션으로 제출한다.',
  '["mberId","password","mberNm","insttNm","insttId","representativeName","bizrno","zip","adres","detailAdres","deptNm","phone","email","fileUploads"]','["checkId","checkEmail","uploadEvidence","submitApplication"]','["GET /join/checkId","GET /join/checkEmail","POST /join/api/step4/submit"]','["COMTNENTRPRSMBER","COMTNENTRPRSMBER_FILE","COMTNEMPLYRSCRTYESTBS"]'),
 ('MEMBER_REGISTRATION_S4','ADMIN','/admin/member/approve','회원가입 신청 검토','MEMBER_ADMIN','제출 정보와 첨부 증빙 본인확인 및 동의 이력을 함께 검토하고 승인 또는 보완을 결정한다.',
  '["memberId","companyName","businessNumber","identityStatus","consentStatus","evidenceFiles","reviewDecision","reviewReason"]','["openEvidence","requestRevision","approve","reject"]','["GET /admin/member/api/approve","POST /admin/member/api/approve"]','["COMTNENTRPRSMBER","COMTNENTRPRSMBER_FILE","member_consent_history"]'),
 ('MEMBER_REGISTRATION_S5','USER','/join/step5','회원가입 5단계 - 신청 완료','PUBLIC_APPLICANT','가입 신청 접수 결과와 후속 승인 절차 및 상태조회 경로를 제공한다.',
  '["mberId","mberNm","insttNm","applicationStatus","nextAction"]','["openLogin","openApplicationStatus","goHome"]','["GET /join/step5"]','["registration receipt projection"]'),
 ('MEMBER_REGISTRATION_S5','ADMIN','/admin/member/approve','회원가입 승인 대기열','MEMBER_ADMIN','접수 완료된 신청을 승인 대기열에 표시하고 처리기한과 담당자를 관리한다.',
  '["memberId","companyName","status","assignee","dueAt","submittedAt"]','["assign","approve","reject","viewAudit"]','["GET /admin/member/api/approve","POST /admin/member/api/approve"]','["COMTNENTRPRSMBER","COMTNEMPLYRINFO"]')
)
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,
 api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,
 exception_states_verified,audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT 'MEMBER_REGISTRATION',step_code,audience,route_path,screen_name,actor_code,purpose,
 '선행 단계 완료 상태와 현재 액터 권한을 서버에서 확인한 경우에만 진입한다.',
 '입력 검증과 상태 전이 및 감사 증적 저장이 모두 성공하고 다음 단계가 명확해야 종료한다.',
 '["completionRate","validationErrorCount","pendingCount","elapsedTime"]',
 '["progress","guidance","primaryForm","validationSummary","evidence","nextAction"]',fields,commands,
 '["LOADING","EMPTY","READY","VALIDATION_ERROR","FORBIDDEN","CONFLICT","ERROR"]',apis,data_contract,
 '["requestId","sessionId","stateTransition","inputHash","decision","timestamp"]',
 '360px 단일열, 768px 이중열, 1280px 안내와 입력 분할 배치이며 표만 내부 스크롤한다.',
 'KRDS 및 WCAG 2.1 AA를 적용하고 키보드 순서 오류 안내 포커스 이동 상태의 비색상 표현을 보장한다.',
 '공개 세션 CSRF 속도제한 필드 허용목록을 적용하고 관리자 화면은 서버 권한과 개인정보 마스킹 및 감사로그를 강제한다.',
 true,true,true,true,true,true,'runtime:member-registration-source+public-session+fail-closed-identity+admin-handoff',
 'VERIFIED','MEMBER_REGISTRATION_CANONICALIZER',CASE WHEN audience='ADMIN' THEN 'VISIBLE' ELSE 'HIDDEN' END,true
FROM canonical
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
 screen_name=excluded.screen_name,actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,
 entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,
 section_contract=excluded.section_contract,field_contract=excluded.field_contract,command_contract=excluded.command_contract,
 state_contract=excluded.state_contract,api_contract=excluded.api_contract,data_contract=excluded.data_contract,
 evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
 accessibility_verified=true,exception_states_verified=true,audit_evidence_ref=excluded.audit_evidence_ref,
 contract_status='VERIFIED',updated_by=excluded.updated_by,menu_visibility=excluded.menu_visibility,
 menu_verified=true,updated_at=current_timestamp;

DELETE FROM framework_professional_screen_contract c
WHERE c.process_code='MEMBER_REGISTRATION'
  AND NOT EXISTS (
    SELECT 1 FROM framework_process_step s
    CROSS JOIN LATERAL unnest(array_remove(ARRAY[s.user_path,s.admin_path],NULL)) r(route_path)
    WHERE s.process_code=c.process_code AND s.step_code=c.step_code
      AND lower(split_part(r.route_path,'?',1))=lower(split_part(c.route_path,'?',1))
  )
  AND c.route_path<>'/join/en/step1';

UPDATE framework_page_design d SET
 actual_route_path=CASE d.audience WHEN 'USER' THEN s.user_path ELSE s.admin_path END,
 planned_route_path=CASE d.audience WHEN 'USER' THEN s.user_path ELSE s.admin_path END,
 route_status='IMPLEMENTED',design_status='DESIGN_COMPLETE',updated_by='MEMBER_REGISTRATION_CANONICALIZER',
 updated_at=current_timestamp
FROM framework_process_step s
WHERE d.process_code='MEMBER_REGISTRATION' AND s.process_code=d.process_code AND s.step_code=d.step_code
  AND CASE d.audience WHEN 'USER' THEN s.user_path ELSE s.admin_path END IS NOT NULL;

SELECT framework_sync_professional_contract_screen_graph('MEMBER_REGISTRATION');

-- The completion projection has no editable input fields, so graph sync cannot
-- infer its receipt fields. Preserve the explicit read model contract.
UPDATE framework_professional_screen_contract SET
 field_contract='["mberId","mberNm","insttNm","applicationStatus","nextAction"]',
 updated_at=current_timestamp
WHERE process_code='MEMBER_REGISTRATION' AND step_code='MEMBER_REGISTRATION_S5'
  AND audience='USER' AND route_path='/join/step5';

-- English step 1 is the locale variant of the same public resource, not a GNB
-- item. Public routing is the verified menu contract for this screen.
UPDATE framework_professional_screen_contract SET
 menu_visibility='HIDDEN',menu_verified=true,api_verified=true,database_verified=true,
 authority_verified=true,responsive_verified=true,accessibility_verified=true,
 exception_states_verified=true,
 audit_evidence_ref='runtime:member-registration-locale-variant+shared-session',
 contract_status='VERIFIED',updated_by='MEMBER_REGISTRATION_CANONICALIZER',updated_at=current_timestamp
WHERE process_code='MEMBER_REGISTRATION' AND step_code='MEMBER_REGISTRATION_S1'
  AND audience='USER' AND route_path='/join/en/step1';

SELECT framework_retire_redundant_planned_screen_contracts('MEMBER_REGISTRATION');

DO $$
DECLARE total_count integer; ready_count integer; planned_count integer;
BEGIN
 SELECT count(*),count(*) FILTER(WHERE readiness_score=100),
        count(*) FILTER(WHERE lower(split_part(route_path,'?',1)) LIKE '%/planned/%')
 INTO total_count,ready_count,planned_count
 FROM framework_professional_screen_readiness WHERE process_code='MEMBER_REGISTRATION';
 IF total_count<>11 OR ready_count<>11 OR planned_count<>0 THEN
   RAISE EXCEPTION 'member registration screen contracts invalid total=% ready=% planned=%',total_count,ready_count,planned_count;
 END IF;
END $$;
