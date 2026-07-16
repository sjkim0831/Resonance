# Carbonet 전체 실행 설계

> 이 문서는 생성 파일입니다. 원본 카탈로그와 생성기를 수정한 뒤 재생성합니다.

## 판정

- 구조 검증: 통과
- 법령·현업 책임자 승인: 대기
- 참조 자산 인벤토리: 12,763개
- 액터: 31개
- 종단 프로세스: 43개
- 테스트 시나리오: 13,189개

## 공통 사용자 문맥

모든 비공개 업무는 accountId, tenantId, companyId, organizationId, siteIds, projectIds, actorAssignments, delegations, consents, assuranceLevel, sessionId를 검증한다.

실제 개인정보는 테스트 데이터에 포함하지 않으며 합성 데이터, 마스킹, 목적 제한, 보존·파기, 접근기록 규칙을 적용한다.

## 액터

- `PUBLIC_VISITOR` 비회원 방문자: 공개 정보 조회와 인증서 진위 확인
- `APPLICANT` 가입 신청자: 본인·법인 확인 후 가입 신청
- `MEMBER` 일반 회원: 허용된 프로젝트 업무 수행
- `COMPANY_REPRESENTATIVE` 기업 대표자: 기업 가입과 법적 책임 승인
- `COMPANY_MANAGER` 기업 관리자: 기업·조직·프로젝트·사용자 관리
- `ORGANIZATION_MANAGER` 조직 관리자: 부서와 담당자 및 데이터 범위 관리
- `SITE_MANAGER` 사업장 관리자: 사업장·시설·배출원 기준정보 관리
- `SITE_DATA_OWNER` 활동자료 담당자: 활동자료와 증빙 제출 및 보완
- `CALCULATOR` 배출량 산정 담당자: 단위·배출계수 매핑과 배출량 산정
- `LCA_PRACTITIONER` LCA 실무자: 시스템 경계·인벤토리·영향평가 수행
- `REDUCTION_MANAGER` 감축 담당자: 감축 목표·과제·성과 관리
- `INTERNAL_REVIEWER` 내부 검토자: 데이터와 계산 근거의 독립 검토
- `APPROVER` 승인권자: 검토 결과 승인·반려·확정
- `EXTERNAL_VERIFIER` 외부 검증심사원: 독립 검증과 발견사항 등록
- `VERIFICATION_MANAGER` 검증기관 책임자: 검증계획 승인과 검증의견 확정
- `CERTIFICATE_ISSUER` 인증 발급 담당자: 인증 적격성 확인과 발급
- `REGULATOR` 규제기관 담당자: 법정 보고 접수·적합성 평가·통지
- `AUDITOR` 감사 담당자: 접근·변경·승인·발급 증적 감사
- `PRIVACY_OFFICER` 개인정보 보호책임자: 개인정보 처리·열람·파기 감독
- `SECURITY_ADMIN` 보안 관리자: 인증·접근통제·보안사고 대응
- `PLATFORM_OPERATOR` 플랫폼 운영자: 테넌트·메뉴·워크플로·운영 관리
- `SYSTEM_INTEGRATOR` 외부 연계 담당자: API·스키마·동기화·재처리 관리
- `DATA_STEWARD` 기준정보 관리자: 단위·물질·배출계수·LCI 버전 관리
- `CONTENT_MANAGER` 콘텐츠 관리자: 공지·교육·자료·뉴스레터 관리
- `SUPPORT_AGENT` 고객지원 담당자: 문의·장애·개선 요청 처리
- `TRADER` 거래 담당자: 공급·수요·제안·계약 업무 수행
- `SETTLEMENT_OFFICER` 정산 담당자: 결제·정산·환불·세금계산서 처리
- `CCUS_CAPTURE_OPERATOR` 포집 운영자: 포집량·품질·운영 기록 관리
- `CCUS_TRANSPORT_OPERATOR` 수송 운영자: 인수인계·수송·누출·안전 기록 관리
- `CCUS_STORAGE_OPERATOR` 저장 운영자: 주입·저장·모니터링·폐쇄 기록 관리
- `CCUS_UTILIZATION_OPERATOR` 활용 운영자: 투입 CO2와 제품·부산물 추적

## 프로세스·화면·기능

### 회원가입·본인확인 (`IDENTITY_SIGNUP`)

- 담당 액터: `APPLICANT`
- 영역: `IDENTITY` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY, LAW-E-SIGN

#### 1. 회원유형 선택

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_IDENTITY_SIGNUP_01_회원유형_선택` / `API_IDENTITY_SIGNUP_01_회원유형_선택` / `SCR_IDENTITY_SIGNUP_01_회원유형_선택`
- 경로: `/work/identity-signup/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_SIGNUP_01_회원유형_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 약관·개인정보 동의

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_IDENTITY_SIGNUP_02_약관_개인정보_동의` / `API_IDENTITY_SIGNUP_02_약관_개인정보_동의` / `SCR_IDENTITY_SIGNUP_02_약관_개인정보_동의`
- 경로: `/work/identity-signup/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_SIGNUP_02_약관_개인정보_동의`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 본인·법인 인증

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_IDENTITY_SIGNUP_03_본인_법인_인증` / `API_IDENTITY_SIGNUP_03_본인_법인_인증` / `SCR_IDENTITY_SIGNUP_03_본인_법인_인증`
- 경로: `/work/identity-signup/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_SIGNUP_03_본인_법인_인증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 회원정보 입력

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_IDENTITY_SIGNUP_04_회원정보_입력` / `API_IDENTITY_SIGNUP_04_회원정보_입력` / `SCR_IDENTITY_SIGNUP_04_회원정보_입력`
- 경로: `/work/identity-signup/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_SIGNUP_04_회원정보_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 가입 신청

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_IDENTITY_SIGNUP_05_가입_신청` / `API_IDENTITY_SIGNUP_05_가입_신청` / `SCR_IDENTITY_SIGNUP_05_가입_신청`
- 경로: `/work/identity-signup/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_SIGNUP_05_가입_신청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 승인 결과 통지

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_IDENTITY_SIGNUP_06_승인_결과_통지` / `API_IDENTITY_SIGNUP_06_승인_결과_통지` / `SCR_IDENTITY_SIGNUP_06_승인_결과_통지`
- 경로: `/work/identity-signup/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_SIGNUP_06_승인_결과_통지`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 로그인·추가인증·세션 (`IDENTITY_ACCESS`)

- 담당 액터: `MEMBER`
- 영역: `IDENTITY` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY, RULE-PRIVACY-SAFETY

#### 1. 자격증명 입력

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_IDENTITY_ACCESS_01_자격증명_입력` / `API_IDENTITY_ACCESS_01_자격증명_입력` / `SCR_IDENTITY_ACCESS_01_자격증명_입력`
- 경로: `/work/identity-access/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_ACCESS_01_자격증명_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 위험기반 추가인증

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_IDENTITY_ACCESS_02_위험기반_추가인증` / `API_IDENTITY_ACCESS_02_위험기반_추가인증` / `SCR_IDENTITY_ACCESS_02_위험기반_추가인증`
- 경로: `/work/identity-access/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_ACCESS_02_위험기반_추가인증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 계정·상태 확인

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_IDENTITY_ACCESS_03_계정_상태_확인` / `API_IDENTITY_ACCESS_03_계정_상태_확인` / `SCR_IDENTITY_ACCESS_03_계정_상태_확인`
- 경로: `/work/identity-access/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_ACCESS_03_계정_상태_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 액터·데이터범위 로드

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_IDENTITY_ACCESS_04_액터_데이터범위_로드` / `API_IDENTITY_ACCESS_04_액터_데이터범위_로드` / `SCR_IDENTITY_ACCESS_04_액터_데이터범위_로드`
- 경로: `/work/identity-access/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_ACCESS_04_액터_데이터범위_로드`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 세션 발급

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_IDENTITY_ACCESS_05_세션_발급` / `API_IDENTITY_ACCESS_05_세션_발급` / `SCR_IDENTITY_ACCESS_05_세션_발급`
- 경로: `/work/identity-access/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_ACCESS_05_세션_발급`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 로그인 감사

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_IDENTITY_ACCESS_06_로그인_감사` / `API_IDENTITY_ACCESS_06_로그인_감사` / `SCR_IDENTITY_ACCESS_06_로그인_감사`
- 경로: `/work/identity-access/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_IDENTITY_ACCESS_06_로그인_감사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 계정 찾기·비밀번호 재설정 (`MEMBER_RECOVERY`)

- 담당 액터: `MEMBER`
- 영역: `IDENTITY` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY

#### 1. 계정 식별

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_MEMBER_RECOVERY_01_계정_식별` / `API_MEMBER_RECOVERY_01_계정_식별` / `SCR_MEMBER_RECOVERY_01_계정_식별`
- 경로: `/work/member-recovery/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_RECOVERY_01_계정_식별`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 추가인증

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_MEMBER_RECOVERY_02_추가인증` / `API_MEMBER_RECOVERY_02_추가인증` / `SCR_MEMBER_RECOVERY_02_추가인증`
- 경로: `/work/member-recovery/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_RECOVERY_02_추가인증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 재설정 요청

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_MEMBER_RECOVERY_03_재설정_요청` / `API_MEMBER_RECOVERY_03_재설정_요청` / `SCR_MEMBER_RECOVERY_03_재설정_요청`
- 경로: `/work/member-recovery/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_RECOVERY_03_재설정_요청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 기존 세션 폐기

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_MEMBER_RECOVERY_04_기존_세션_폐기` / `API_MEMBER_RECOVERY_04_기존_세션_폐기` / `SCR_MEMBER_RECOVERY_04_기존_세션_폐기`
- 경로: `/work/member-recovery/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_RECOVERY_04_기존_세션_폐기`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 완료 통지

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_MEMBER_RECOVERY_05_완료_통지` / `API_MEMBER_RECOVERY_05_완료_통지` / `SCR_MEMBER_RECOVERY_05_완료_통지`
- 경로: `/work/member-recovery/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_RECOVERY_05_완료_통지`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 회원 변경·휴면·탈퇴 (`MEMBER_LIFECYCLE`)

- 담당 액터: `COMPANY_MANAGER`
- 영역: `IDENTITY` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY

#### 1. 변경 요청

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_MEMBER_LIFECYCLE_01_변경_요청` / `API_MEMBER_LIFECYCLE_01_변경_요청` / `SCR_MEMBER_LIFECYCLE_01_변경_요청`
- 경로: `/work/member-lifecycle/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_LIFECYCLE_01_변경_요청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 영향 분석

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_MEMBER_LIFECYCLE_02_영향_분석` / `API_MEMBER_LIFECYCLE_02_영향_분석` / `SCR_MEMBER_LIFECYCLE_02_영향_분석`
- 경로: `/work/member-lifecycle/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_LIFECYCLE_02_영향_분석`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 본인·승인 확인

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_MEMBER_LIFECYCLE_03_본인_승인_확인` / `API_MEMBER_LIFECYCLE_03_본인_승인_확인` / `SCR_MEMBER_LIFECYCLE_03_본인_승인_확인`
- 경로: `/work/member-lifecycle/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_LIFECYCLE_03_본인_승인_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 권한·업무 재배정

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_MEMBER_LIFECYCLE_04_권한_업무_재배정` / `API_MEMBER_LIFECYCLE_04_권한_업무_재배정` / `SCR_MEMBER_LIFECYCLE_04_권한_업무_재배정`
- 경로: `/work/member-lifecycle/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_LIFECYCLE_04_권한_업무_재배정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 정보 변경·분리보관·파기

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_MEMBER_LIFECYCLE_05_정보_변경_분리보관_파기` / `API_MEMBER_LIFECYCLE_05_정보_변경_분리보관_파기` / `SCR_MEMBER_LIFECYCLE_05_정보_변경_분리보관_파기`
- 경로: `/work/member-lifecycle/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_LIFECYCLE_05_정보_변경_분리보관_파기`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 후속 시스템 통지

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_MEMBER_LIFECYCLE_06_후속_시스템_통지` / `API_MEMBER_LIFECYCLE_06_후속_시스템_통지` / `SCR_MEMBER_LIFECYCLE_06_후속_시스템_통지`
- 경로: `/work/member-lifecycle/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_LIFECYCLE_06_후속_시스템_통지`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 감사

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_MEMBER_LIFECYCLE_07_감사` / `API_MEMBER_LIFECYCLE_07_감사` / `SCR_MEMBER_LIFECYCLE_07_감사`
- 경로: `/work/member-lifecycle/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MEMBER_LIFECYCLE_07_감사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 기업·사업장 온보딩 (`COMPANY_ONBOARDING`)

- 담당 액터: `COMPANY_REPRESENTATIVE`
- 영역: `IDENTITY` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY, LAW-E-DOCUMENT

#### 1. 기업 검색·중복확인

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_COMPANY_ONBOARDING_01_기업_검색_중복확인` / `API_COMPANY_ONBOARDING_01_기업_검색_중복확인` / `SCR_COMPANY_ONBOARDING_01_기업_검색_중복확인`
- 경로: `/work/company-onboarding/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_COMPANY_ONBOARDING_01_기업_검색_중복확인`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 법인 정보 입력

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_COMPANY_ONBOARDING_02_법인_정보_입력` / `API_COMPANY_ONBOARDING_02_법인_정보_입력` / `SCR_COMPANY_ONBOARDING_02_법인_정보_입력`
- 경로: `/work/company-onboarding/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_COMPANY_ONBOARDING_02_법인_정보_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 증빙 제출

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_COMPANY_ONBOARDING_03_증빙_제출` / `API_COMPANY_ONBOARDING_03_증빙_제출` / `SCR_COMPANY_ONBOARDING_03_증빙_제출`
- 경로: `/work/company-onboarding/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_COMPANY_ONBOARDING_03_증빙_제출`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 조직·사업장 등록

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_COMPANY_ONBOARDING_04_조직_사업장_등록` / `API_COMPANY_ONBOARDING_04_조직_사업장_등록` / `SCR_COMPANY_ONBOARDING_04_조직_사업장_등록`
- 경로: `/work/company-onboarding/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_COMPANY_ONBOARDING_04_조직_사업장_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 대표권 확인

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_COMPANY_ONBOARDING_05_대표권_확인` / `API_COMPANY_ONBOARDING_05_대표권_확인` / `SCR_COMPANY_ONBOARDING_05_대표권_확인`
- 경로: `/work/company-onboarding/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_COMPANY_ONBOARDING_05_대표권_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 관리자 승인

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_COMPANY_ONBOARDING_06_관리자_승인` / `API_COMPANY_ONBOARDING_06_관리자_승인` / `SCR_COMPANY_ONBOARDING_06_관리자_승인`
- 경로: `/work/company-onboarding/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_COMPANY_ONBOARDING_06_관리자_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 테넌트 개통

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_COMPANY_ONBOARDING_07_테넌트_개통` / `API_COMPANY_ONBOARDING_07_테넌트_개통` / `SCR_COMPANY_ONBOARDING_07_테넌트_개통`
- 경로: `/work/company-onboarding/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_COMPANY_ONBOARDING_07_테넌트_개통`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 역할·권한·위임 (`ROLE_ASSIGNMENT`)

- 담당 액터: `COMPANY_MANAGER`
- 영역: `IDENTITY` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY, RULE-PRIVACY-SAFETY

#### 1. 대상 사용자 검색

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_ROLE_ASSIGNMENT_01_대상_사용자_검색` / `API_ROLE_ASSIGNMENT_01_대상_사용자_검색` / `SCR_ROLE_ASSIGNMENT_01_대상_사용자_검색`
- 경로: `/work/role-assignment/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ROLE_ASSIGNMENT_01_대상_사용자_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 액터·데이터범위 선택

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_ROLE_ASSIGNMENT_02_액터_데이터범위_선택` / `API_ROLE_ASSIGNMENT_02_액터_데이터범위_선택` / `SCR_ROLE_ASSIGNMENT_02_액터_데이터범위_선택`
- 경로: `/work/role-assignment/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ROLE_ASSIGNMENT_02_액터_데이터범위_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 직무분리 충돌 검사

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_ROLE_ASSIGNMENT_03_직무분리_충돌_검사` / `API_ROLE_ASSIGNMENT_03_직무분리_충돌_검사` / `SCR_ROLE_ASSIGNMENT_03_직무분리_충돌_검사`
- 경로: `/work/role-assignment/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ROLE_ASSIGNMENT_03_직무분리_충돌_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 승인

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_ROLE_ASSIGNMENT_04_승인` / `API_ROLE_ASSIGNMENT_04_승인` / `SCR_ROLE_ASSIGNMENT_04_승인`
- 경로: `/work/role-assignment/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ROLE_ASSIGNMENT_04_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 권한 적용

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_ROLE_ASSIGNMENT_05_권한_적용` / `API_ROLE_ASSIGNMENT_05_권한_적용` / `SCR_ROLE_ASSIGNMENT_05_권한_적용`
- 경로: `/work/role-assignment/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ROLE_ASSIGNMENT_05_권한_적용`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 캐시·세션 무효화

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_ROLE_ASSIGNMENT_06_캐시_세션_무효화` / `API_ROLE_ASSIGNMENT_06_캐시_세션_무효화` / `SCR_ROLE_ASSIGNMENT_06_캐시_세션_무효화`
- 경로: `/work/role-assignment/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ROLE_ASSIGNMENT_06_캐시_세션_무효화`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 이력 저장

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_ROLE_ASSIGNMENT_07_이력_저장` / `API_ROLE_ASSIGNMENT_07_이력_저장` / `SCR_ROLE_ASSIGNMENT_07_이력_저장`
- 경로: `/work/role-assignment/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ROLE_ASSIGNMENT_07_이력_저장`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 배출량 프로젝트 생애주기 (`EMISSION_PROJECT`)

- 담당 액터: `COMPANY_MANAGER`
- 영역: `EMISSION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CARBON-NEUTRAL, LAW-ETS, RULE-ETS-MRV

#### 1. 프로젝트 등록

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_01_프로젝트_등록` / `API_EMISSION_PROJECT_01_프로젝트_등록` / `SCR_EMISSION_PROJECT_01_프로젝트_등록`
- 경로: `/work/emission-project/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_01_프로젝트_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 조직·운영경계 설정

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_02_조직_운영경계_설정` / `API_EMISSION_PROJECT_02_조직_운영경계_설정` / `SCR_EMISSION_PROJECT_02_조직_운영경계_설정`
- 경로: `/work/emission-project/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_02_조직_운영경계_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 산정기간·방법론 설정

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_03_산정기간_방법론_설정` / `API_EMISSION_PROJECT_03_산정기간_방법론_설정` / `SCR_EMISSION_PROJECT_03_산정기간_방법론_설정`
- 경로: `/work/emission-project/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_03_산정기간_방법론_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 담당 액터·마감 배정

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_04_담당_액터_마감_배정` / `API_EMISSION_PROJECT_04_담당_액터_마감_배정` / `SCR_EMISSION_PROJECT_04_담당_액터_마감_배정`
- 경로: `/work/emission-project/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_04_담당_액터_마감_배정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 자료수집 개시

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_05_자료수집_개시` / `API_EMISSION_PROJECT_05_자료수집_개시` / `SCR_EMISSION_PROJECT_05_자료수집_개시`
- 경로: `/work/emission-project/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_05_자료수집_개시`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 산정·검증

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_06_산정_검증` / `API_EMISSION_PROJECT_06_산정_검증` / `SCR_EMISSION_PROJECT_06_산정_검증`
- 경로: `/work/emission-project/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_06_산정_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 승인·확정

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_07_승인_확정` / `API_EMISSION_PROJECT_07_승인_확정` / `SCR_EMISSION_PROJECT_07_승인_확정`
- 경로: `/work/emission-project/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_07_승인_확정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 보고·종료

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_EMISSION_PROJECT_08_보고_종료` / `API_EMISSION_PROJECT_08_보고_종료` / `SCR_EMISSION_PROJECT_08_보고_종료`
- 경로: `/work/emission-project/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_PROJECT_08_보고_종료`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 활동자료 제출 요청 (`ACTIVITY_REQUEST`)

- 담당 액터: `COMPANY_MANAGER`
- 영역: `EMISSION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: RULE-ETS-MRV

#### 1. 요청범위 설정

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_ACTIVITY_REQUEST_01_요청범위_설정` / `API_ACTIVITY_REQUEST_01_요청범위_설정` / `SCR_ACTIVITY_REQUEST_01_요청범위_설정`
- 경로: `/work/activity-request/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_REQUEST_01_요청범위_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 대상 사업장·담당자 검색

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_ACTIVITY_REQUEST_02_대상_사업장_담당자_검색` / `API_ACTIVITY_REQUEST_02_대상_사업장_담당자_검색` / `SCR_ACTIVITY_REQUEST_02_대상_사업장_담당자_검색`
- 경로: `/work/activity-request/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_REQUEST_02_대상_사업장_담당자_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 입력양식·마감 선택

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_ACTIVITY_REQUEST_03_입력양식_마감_선택` / `API_ACTIVITY_REQUEST_03_입력양식_마감_선택` / `SCR_ACTIVITY_REQUEST_03_입력양식_마감_선택`
- 경로: `/work/activity-request/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_REQUEST_03_입력양식_마감_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 요청 발송

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_ACTIVITY_REQUEST_04_요청_발송` / `API_ACTIVITY_REQUEST_04_요청_발송` / `SCR_ACTIVITY_REQUEST_04_요청_발송`
- 경로: `/work/activity-request/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_REQUEST_04_요청_발송`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 수신·열람 추적

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_ACTIVITY_REQUEST_05_수신_열람_추적` / `API_ACTIVITY_REQUEST_05_수신_열람_추적` / `SCR_ACTIVITY_REQUEST_05_수신_열람_추적`
- 경로: `/work/activity-request/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_REQUEST_05_수신_열람_추적`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 미제출 알림·에스컬레이션

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_ACTIVITY_REQUEST_06_미제출_알림_에스컬레이션` / `API_ACTIVITY_REQUEST_06_미제출_알림_에스컬레이션` / `SCR_ACTIVITY_REQUEST_06_미제출_알림_에스컬레이션`
- 경로: `/work/activity-request/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_REQUEST_06_미제출_알림_에스컬레이션`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 활동자료 입력·보완 (`ACTIVITY_DATA`)

- 담당 액터: `SITE_DATA_OWNER`
- 영역: `EMISSION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: RULE-ETS-MRV

#### 1. 업무 수신

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_01_업무_수신` / `API_ACTIVITY_DATA_01_업무_수신` / `SCR_ACTIVITY_DATA_01_업무_수신`
- 경로: `/work/activity-data/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_01_업무_수신`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 자료 입력·엑셀 업로드

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_02_자료_입력_엑셀_업로드` / `API_ACTIVITY_DATA_02_자료_입력_엑셀_업로드` / `SCR_ACTIVITY_DATA_02_자료_입력_엑셀_업로드`
- 경로: `/work/activity-data/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_02_자료_입력_엑셀_업로드`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 단위·기간·출처 검증

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_03_단위_기간_출처_검증` / `API_ACTIVITY_DATA_03_단위_기간_출처_검증` / `SCR_ACTIVITY_DATA_03_단위_기간_출처_검증`
- 경로: `/work/activity-data/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_03_단위_기간_출처_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 증빙 연결

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_04_증빙_연결` / `API_ACTIVITY_DATA_04_증빙_연결` / `SCR_ACTIVITY_DATA_04_증빙_연결`
- 경로: `/work/activity-data/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_04_증빙_연결`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 임시저장

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_05_임시저장` / `API_ACTIVITY_DATA_05_임시저장` / `SCR_ACTIVITY_DATA_05_임시저장`
- 경로: `/work/activity-data/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_05_임시저장`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 제출

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_06_제출` / `API_ACTIVITY_DATA_06_제출` / `SCR_ACTIVITY_DATA_06_제출`
- 경로: `/work/activity-data/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_06_제출`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 반려 보완

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_07_반려_보완` / `API_ACTIVITY_DATA_07_반려_보완` / `SCR_ACTIVITY_DATA_07_반려_보완`
- 경로: `/work/activity-data/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_07_반려_보완`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 재제출

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_ACTIVITY_DATA_08_재제출` / `API_ACTIVITY_DATA_08_재제출` / `SCR_ACTIVITY_DATA_08_재제출`
- 경로: `/work/activity-data/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_ACTIVITY_DATA_08_재제출`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 증빙자료 생애주기 (`EVIDENCE_MANAGEMENT`)

- 담당 액터: `SITE_DATA_OWNER`
- 영역: `EMISSION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-E-DOCUMENT, LAW-PRIVACY

#### 1. 파일 검사

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_EVIDENCE_MANAGEMENT_01_파일_검사` / `API_EVIDENCE_MANAGEMENT_01_파일_검사` / `SCR_EVIDENCE_MANAGEMENT_01_파일_검사`
- 경로: `/work/evidence-management/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EVIDENCE_MANAGEMENT_01_파일_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 업로드

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_EVIDENCE_MANAGEMENT_02_업로드` / `API_EVIDENCE_MANAGEMENT_02_업로드` / `SCR_EVIDENCE_MANAGEMENT_02_업로드`
- 경로: `/work/evidence-management/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EVIDENCE_MANAGEMENT_02_업로드`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 자료행 연결

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_EVIDENCE_MANAGEMENT_03_자료행_연결` / `API_EVIDENCE_MANAGEMENT_03_자료행_연결` / `SCR_EVIDENCE_MANAGEMENT_03_자료행_연결`
- 경로: `/work/evidence-management/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EVIDENCE_MANAGEMENT_03_자료행_연결`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 해시·메타데이터 저장

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_EVIDENCE_MANAGEMENT_04_해시_메타데이터_저장` / `API_EVIDENCE_MANAGEMENT_04_해시_메타데이터_저장` / `SCR_EVIDENCE_MANAGEMENT_04_해시_메타데이터_저장`
- 경로: `/work/evidence-management/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EVIDENCE_MANAGEMENT_04_해시_메타데이터_저장`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 열람권한 적용

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_EVIDENCE_MANAGEMENT_05_열람권한_적용` / `API_EVIDENCE_MANAGEMENT_05_열람권한_적용` / `SCR_EVIDENCE_MANAGEMENT_05_열람권한_적용`
- 경로: `/work/evidence-management/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EVIDENCE_MANAGEMENT_05_열람권한_적용`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 버전 변경

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_EVIDENCE_MANAGEMENT_06_버전_변경` / `API_EVIDENCE_MANAGEMENT_06_버전_변경` / `SCR_EVIDENCE_MANAGEMENT_06_버전_변경`
- 경로: `/work/evidence-management/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EVIDENCE_MANAGEMENT_06_버전_변경`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 보존·파기

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_EVIDENCE_MANAGEMENT_07_보존_파기` / `API_EVIDENCE_MANAGEMENT_07_보존_파기` / `SCR_EVIDENCE_MANAGEMENT_07_보존_파기`
- 경로: `/work/evidence-management/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EVIDENCE_MANAGEMENT_07_보존_파기`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 배출계수·단위 매핑 (`FACTOR_MAPPING`)

- 담당 액터: `CALCULATOR`
- 영역: `EMISSION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: RULE-ETS-MRV

#### 1. 미매핑 자료 조회

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_FACTOR_MAPPING_01_미매핑_자료_조회` / `API_FACTOR_MAPPING_01_미매핑_자료_조회` / `SCR_FACTOR_MAPPING_01_미매핑_자료_조회`
- 경로: `/work/factor-mapping/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_FACTOR_MAPPING_01_미매핑_자료_조회`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 물질·연료 검색

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_FACTOR_MAPPING_02_물질_연료_검색` / `API_FACTOR_MAPPING_02_물질_연료_검색` / `SCR_FACTOR_MAPPING_02_물질_연료_검색`
- 경로: `/work/factor-mapping/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_FACTOR_MAPPING_02_물질_연료_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 후보 순위·근거 확인

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_FACTOR_MAPPING_03_후보_순위_근거_확인` / `API_FACTOR_MAPPING_03_후보_순위_근거_확인` / `SCR_FACTOR_MAPPING_03_후보_순위_근거_확인`
- 경로: `/work/factor-mapping/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_FACTOR_MAPPING_03_후보_순위_근거_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 단위 환산 선택

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_FACTOR_MAPPING_04_단위_환산_선택` / `API_FACTOR_MAPPING_04_단위_환산_선택` / `SCR_FACTOR_MAPPING_04_단위_환산_선택`
- 경로: `/work/factor-mapping/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_FACTOR_MAPPING_04_단위_환산_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 개별·일괄 매핑

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_FACTOR_MAPPING_05_개별_일괄_매핑` / `API_FACTOR_MAPPING_05_개별_일괄_매핑` / `SCR_FACTOR_MAPPING_05_개별_일괄_매핑`
- 경로: `/work/factor-mapping/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_FACTOR_MAPPING_05_개별_일괄_매핑`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 충돌 검증

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_FACTOR_MAPPING_06_충돌_검증` / `API_FACTOR_MAPPING_06_충돌_검증` / `SCR_FACTOR_MAPPING_06_충돌_검증`
- 경로: `/work/factor-mapping/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_FACTOR_MAPPING_06_충돌_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 매핑 확정·버전 저장

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_FACTOR_MAPPING_07_매핑_확정_버전_저장` / `API_FACTOR_MAPPING_07_매핑_확정_버전_저장` / `SCR_FACTOR_MAPPING_07_매핑_확정_버전_저장`
- 경로: `/work/factor-mapping/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_FACTOR_MAPPING_07_매핑_확정_버전_저장`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### Scope 1·2·3 배출량 산정 (`EMISSION_CALCULATION`)

- 담당 액터: `CALCULATOR`
- 영역: `EMISSION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-ETS, RULE-ETS-MRV, STD-ISO-14064

#### 1. 산정대상 잠금

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_01_산정대상_잠금` / `API_EMISSION_CALCULATION_01_산정대상_잠금` / `SCR_EMISSION_CALCULATION_01_산정대상_잠금`
- 경로: `/work/emission-calculation/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_01_산정대상_잠금`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 방법론·계수 버전 확인

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_02_방법론_계수_버전_확인` / `API_EMISSION_CALCULATION_02_방법론_계수_버전_확인` / `SCR_EMISSION_CALCULATION_02_방법론_계수_버전_확인`
- 경로: `/work/emission-calculation/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_02_방법론_계수_버전_확인`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 단위 환산

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_03_단위_환산` / `API_EMISSION_CALCULATION_03_단위_환산` / `SCR_EMISSION_CALCULATION_03_단위_환산`
- 경로: `/work/emission-calculation/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_03_단위_환산`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 행별 산정

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_04_행별_산정` / `API_EMISSION_CALCULATION_04_행별_산정` / `SCR_EMISSION_CALCULATION_04_행별_산정`
- 경로: `/work/emission-calculation/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_04_행별_산정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 시설·사업장·Scope 집계

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_05_시설_사업장_SCOPE_집계` / `API_EMISSION_CALCULATION_05_시설_사업장_SCOPE_집계` / `SCR_EMISSION_CALCULATION_05_시설_사업장_SCOPE_집계`
- 경로: `/work/emission-calculation/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_05_시설_사업장_SCOPE_집계`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 불확도·품질 평가

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_06_불확도_품질_평가` / `API_EMISSION_CALCULATION_06_불확도_품질_평가` / `SCR_EMISSION_CALCULATION_06_불확도_품질_평가`
- 경로: `/work/emission-calculation/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_06_불확도_품질_평가`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 계산근거 저장

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_07_계산근거_저장` / `API_EMISSION_CALCULATION_07_계산근거_저장` / `SCR_EMISSION_CALCULATION_07_계산근거_저장`
- 경로: `/work/emission-calculation/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_07_계산근거_저장`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 결과 제출

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_EMISSION_CALCULATION_08_결과_제출` / `API_EMISSION_CALCULATION_08_결과_제출` / `SCR_EMISSION_CALCULATION_08_결과_제출`
- 경로: `/work/emission-calculation/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_CALCULATION_08_결과_제출`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 배출량 데이터 검증 (`EMISSION_VALIDATION`)

- 담당 액터: `INTERNAL_REVIEWER`
- 영역: `VERIFICATION` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: RULE-ETS-MRV, RULE-ETS-VERIFY

#### 1. 검증계획 수립

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_01_검증계획_수립` / `API_EMISSION_VALIDATION_01_검증계획_수립` / `SCR_EMISSION_VALIDATION_01_검증계획_수립`
- 경로: `/work/emission-validation/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_01_검증계획_수립`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 완전성·일관성 검사

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_02_완전성_일관성_검사` / `API_EMISSION_VALIDATION_02_완전성_일관성_검사` / `SCR_EMISSION_VALIDATION_02_완전성_일관성_검사`
- 경로: `/work/emission-validation/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_02_완전성_일관성_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 이상치·중복 검사

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_03_이상치_중복_검사` / `API_EMISSION_VALIDATION_03_이상치_중복_검사` / `SCR_EMISSION_VALIDATION_03_이상치_중복_검사`
- 경로: `/work/emission-validation/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_03_이상치_중복_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 증빙 표본검사

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_04_증빙_표본검사` / `API_EMISSION_VALIDATION_04_증빙_표본검사` / `SCR_EMISSION_VALIDATION_04_증빙_표본검사`
- 경로: `/work/emission-validation/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_04_증빙_표본검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 계산 재현

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_05_계산_재현` / `API_EMISSION_VALIDATION_05_계산_재현` / `SCR_EMISSION_VALIDATION_05_계산_재현`
- 경로: `/work/emission-validation/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_05_계산_재현`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 발견사항 등록

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_06_발견사항_등록` / `API_EMISSION_VALIDATION_06_발견사항_등록` / `SCR_EMISSION_VALIDATION_06_발견사항_등록`
- 경로: `/work/emission-validation/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_06_발견사항_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 보완 확인

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_07_보완_확인` / `API_EMISSION_VALIDATION_07_보완_확인` / `SCR_EMISSION_VALIDATION_07_보완_확인`
- 경로: `/work/emission-validation/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_07_보완_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 검증 결론

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_EMISSION_VALIDATION_08_검증_결론` / `API_EMISSION_VALIDATION_08_검증_결론` / `SCR_EMISSION_VALIDATION_08_검증_결론`
- 경로: `/work/emission-validation/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_VALIDATION_08_검증_결론`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 배출량 검토·승인·확정 (`EMISSION_APPROVAL`)

- 담당 액터: `APPROVER`
- 영역: `APPROVAL` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-E-SIGN, LAW-ETS

#### 1. 승인대상 조회

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_EMISSION_APPROVAL_01_승인대상_조회` / `API_EMISSION_APPROVAL_01_승인대상_조회` / `SCR_EMISSION_APPROVAL_01_승인대상_조회`
- 경로: `/work/emission-approval/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_APPROVAL_01_승인대상_조회`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 변경·위험 요약 확인

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_EMISSION_APPROVAL_02_변경_위험_요약_확인` / `API_EMISSION_APPROVAL_02_변경_위험_요약_확인` / `SCR_EMISSION_APPROVAL_02_변경_위험_요약_확인`
- 경로: `/work/emission-approval/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_APPROVAL_02_변경_위험_요약_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 검증의견 확인

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_EMISSION_APPROVAL_03_검증의견_확인` / `API_EMISSION_APPROVAL_03_검증의견_확인` / `SCR_EMISSION_APPROVAL_03_검증의견_확인`
- 경로: `/work/emission-approval/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_APPROVAL_03_검증의견_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 승인·반려

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_EMISSION_APPROVAL_04_승인_반려` / `API_EMISSION_APPROVAL_04_승인_반려` / `SCR_EMISSION_APPROVAL_04_승인_반려`
- 경로: `/work/emission-approval/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_APPROVAL_04_승인_반려`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 전자서명

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_EMISSION_APPROVAL_05_전자서명` / `API_EMISSION_APPROVAL_05_전자서명` / `SCR_EMISSION_APPROVAL_05_전자서명`
- 경로: `/work/emission-approval/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_APPROVAL_05_전자서명`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 결과 잠금

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_EMISSION_APPROVAL_06_결과_잠금` / `API_EMISSION_APPROVAL_06_결과_잠금` / `SCR_EMISSION_APPROVAL_06_결과_잠금`
- 경로: `/work/emission-approval/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_APPROVAL_06_결과_잠금`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 재개 통제

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_EMISSION_APPROVAL_07_재개_통제` / `API_EMISSION_APPROVAL_07_재개_통제` / `SCR_EMISSION_APPROVAL_07_재개_통제`
- 경로: `/work/emission-approval/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EMISSION_APPROVAL_07_재개_통제`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 온실가스 명세서 작성·제출 (`STATEMENT_REPORT`)

- 담당 액터: `COMPANY_MANAGER`
- 영역: `REPORT` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-ETS, RULE-ETS-MRV, LAW-E-DOCUMENT

#### 1. 확정 데이터 선택

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_01_확정_데이터_선택` / `API_STATEMENT_REPORT_01_확정_데이터_선택` / `SCR_STATEMENT_REPORT_01_확정_데이터_선택`
- 경로: `/work/statement-report/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_01_확정_데이터_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 법정 서식 생성

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_02_법정_서식_생성` / `API_STATEMENT_REPORT_02_법정_서식_생성` / `SCR_STATEMENT_REPORT_02_법정_서식_생성`
- 경로: `/work/statement-report/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_02_법정_서식_생성`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 총괄·사업장·시설 대조

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_03_총괄_사업장_시설_대조` / `API_STATEMENT_REPORT_03_총괄_사업장_시설_대조` / `SCR_STATEMENT_REPORT_03_총괄_사업장_시설_대조`
- 경로: `/work/statement-report/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_03_총괄_사업장_시설_대조`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 검증보고서 첨부

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_04_검증보고서_첨부` / `API_STATEMENT_REPORT_04_검증보고서_첨부` / `SCR_STATEMENT_REPORT_04_검증보고서_첨부`
- 경로: `/work/statement-report/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_04_검증보고서_첨부`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 전자서명

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_05_전자서명` / `API_STATEMENT_REPORT_05_전자서명` / `SCR_STATEMENT_REPORT_05_전자서명`
- 경로: `/work/statement-report/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_05_전자서명`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 전자 제출

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_06_전자_제출` / `API_STATEMENT_REPORT_06_전자_제출` / `SCR_STATEMENT_REPORT_06_전자_제출`
- 경로: `/work/statement-report/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_06_전자_제출`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 접수·보완

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_07_접수_보완` / `API_STATEMENT_REPORT_07_접수_보완` / `SCR_STATEMENT_REPORT_07_접수_보완`
- 경로: `/work/statement-report/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_07_접수_보완`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 최종 보존

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_STATEMENT_REPORT_08_최종_보존` / `API_STATEMENT_REPORT_08_최종_보존` / `SCR_STATEMENT_REPORT_08_최종_보존`
- 경로: `/work/statement-report/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_STATEMENT_REPORT_08_최종_보존`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 제품 LCA 프로젝트 (`LCA_PROJECT`)

- 담당 액터: `LCA_PRACTITIONER`
- 영역: `LCA` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: STD-ISO-14040, STD-ISO-14067, RULE-EPD

#### 1. 목표·범위 설정

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_01_목표_범위_설정` / `API_LCA_PROJECT_01_목표_범위_설정` / `SCR_LCA_PROJECT_01_목표_범위_설정`
- 경로: `/work/lca-project/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_01_목표_범위_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 제품·공정 선택

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_02_제품_공정_선택` / `API_LCA_PROJECT_02_제품_공정_선택` / `SCR_LCA_PROJECT_02_제품_공정_선택`
- 경로: `/work/lca-project/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_02_제품_공정_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 기능단위 설정

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_03_기능단위_설정` / `API_LCA_PROJECT_03_기능단위_설정` / `SCR_LCA_PROJECT_03_기능단위_설정`
- 경로: `/work/lca-project/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_03_기능단위_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 시스템경계 설정

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_04_시스템경계_설정` / `API_LCA_PROJECT_04_시스템경계_설정` / `SCR_LCA_PROJECT_04_시스템경계_설정`
- 경로: `/work/lca-project/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_04_시스템경계_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 데이터수집 계획

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_05_데이터수집_계획` / `API_LCA_PROJECT_05_데이터수집_계획` / `SCR_LCA_PROJECT_05_데이터수집_계획`
- 경로: `/work/lca-project/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_05_데이터수집_계획`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 인벤토리·영향평가

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_06_인벤토리_영향평가` / `API_LCA_PROJECT_06_인벤토리_영향평가` / `SCR_LCA_PROJECT_06_인벤토리_영향평가`
- 경로: `/work/lca-project/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_06_인벤토리_영향평가`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 검토·확정

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_07_검토_확정` / `API_LCA_PROJECT_07_검토_확정` / `SCR_LCA_PROJECT_07_검토_확정`
- 경로: `/work/lca-project/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_07_검토_확정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 보고

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_LCA_PROJECT_08_보고` / `API_LCA_PROJECT_08_보고` / `SCR_LCA_PROJECT_08_보고`
- 경로: `/work/lca-project/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_PROJECT_08_보고`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### LCI 인벤토리 수집·매핑 (`LCA_INVENTORY`)

- 담당 액터: `LCA_PRACTITIONER`
- 영역: `LCA` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: STD-ISO-14040, RULE-EPD

#### 1. 공정 흐름 구성

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_01_공정_흐름_구성` / `API_LCA_INVENTORY_01_공정_흐름_구성` / `SCR_LCA_INVENTORY_01_공정_흐름_구성`
- 경로: `/work/lca-inventory/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_01_공정_흐름_구성`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 원료·보조재 입력

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_02_원료_보조재_입력` / `API_LCA_INVENTORY_02_원료_보조재_입력` / `SCR_LCA_INVENTORY_02_원료_보조재_입력`
- 경로: `/work/lca-inventory/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_02_원료_보조재_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 에너지·스팀 입력

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_03_에너지_스팀_입력` / `API_LCA_INVENTORY_03_에너지_스팀_입력` / `SCR_LCA_INVENTORY_03_에너지_스팀_입력`
- 경로: `/work/lca-inventory/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_03_에너지_스팀_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 운송 입력

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_04_운송_입력` / `API_LCA_INVENTORY_04_운송_입력` / `SCR_LCA_INVENTORY_04_운송_입력`
- 경로: `/work/lca-inventory/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_04_운송_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 제품·부산물 입력

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_05_제품_부산물_입력` / `API_LCA_INVENTORY_05_제품_부산물_입력` / `SCR_LCA_INVENTORY_05_제품_부산물_입력`
- 경로: `/work/lca-inventory/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_05_제품_부산물_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 폐기물·배출물 입력

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_06_폐기물_배출물_입력` / `API_LCA_INVENTORY_06_폐기물_배출물_입력` / `SCR_LCA_INVENTORY_06_폐기물_배출물_입력`
- 경로: `/work/lca-inventory/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_06_폐기물_배출물_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. LCI 검색·매핑

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_07_LCI_검색_매핑` / `API_LCA_INVENTORY_07_LCI_검색_매핑` / `SCR_LCA_INVENTORY_07_LCI_검색_매핑`
- 경로: `/work/lca-inventory/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_07_LCI_검색_매핑`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 질량·에너지 수지 검증

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_LCA_INVENTORY_08_질량_에너지_수지_검증` / `API_LCA_INVENTORY_08_질량_에너지_수지_검증` / `SCR_LCA_INVENTORY_08_질량_에너지_수지_검증`
- 경로: `/work/lca-inventory/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_INVENTORY_08_질량_에너지_수지_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 제품·부산물 할당 (`LCA_ALLOCATION`)

- 담당 액터: `LCA_PRACTITIONER`
- 영역: `LCA` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: STD-ISO-14044, STD-ISO-14067

#### 1. 산출물 분류

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_LCA_ALLOCATION_01_산출물_분류` / `API_LCA_ALLOCATION_01_산출물_분류` / `SCR_LCA_ALLOCATION_01_산출물_분류`
- 경로: `/work/lca-allocation/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_ALLOCATION_01_산출물_분류`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 질량·경제·물리 기준 선택

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_LCA_ALLOCATION_02_질량_경제_물리_기준_선택` / `API_LCA_ALLOCATION_02_질량_경제_물리_기준_선택` / `SCR_LCA_ALLOCATION_02_질량_경제_물리_기준_선택`
- 경로: `/work/lca-allocation/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_ALLOCATION_02_질량_경제_물리_기준_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 기준자료 입력

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_LCA_ALLOCATION_03_기준자료_입력` / `API_LCA_ALLOCATION_03_기준자료_입력` / `SCR_LCA_ALLOCATION_03_기준자료_입력`
- 경로: `/work/lca-allocation/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_ALLOCATION_03_기준자료_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 할당비율 계산

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_LCA_ALLOCATION_04_할당비율_계산` / `API_LCA_ALLOCATION_04_할당비율_계산` / `SCR_LCA_ALLOCATION_04_할당비율_계산`
- 경로: `/work/lca-allocation/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_ALLOCATION_04_할당비율_계산`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 100% 정합성 검사

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_LCA_ALLOCATION_05_100__정합성_검사` / `API_LCA_ALLOCATION_05_100__정합성_검사` / `SCR_LCA_ALLOCATION_05_100__정합성_검사`
- 경로: `/work/lca-allocation/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_ALLOCATION_05_100__정합성_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 민감도 비교

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_LCA_ALLOCATION_06_민감도_비교` / `API_LCA_ALLOCATION_06_민감도_비교` / `SCR_LCA_ALLOCATION_06_민감도_비교`
- 경로: `/work/lca-allocation/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_ALLOCATION_06_민감도_비교`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 기준 확정

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_LCA_ALLOCATION_07_기준_확정` / `API_LCA_ALLOCATION_07_기준_확정` / `SCR_LCA_ALLOCATION_07_기준_확정`
- 경로: `/work/lca-allocation/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_ALLOCATION_07_기준_확정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### LCIA 영향평가·기여도 분석 (`LCA_IMPACT`)

- 담당 액터: `LCA_PRACTITIONER`
- 영역: `LCA` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: STD-ISO-14040, STD-ISO-14067

#### 1. 영향범주·방법 선택

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_LCA_IMPACT_01_영향범주_방법_선택` / `API_LCA_IMPACT_01_영향범주_방법_선택` / `SCR_LCA_IMPACT_01_영향범주_방법_선택`
- 경로: `/work/lca-impact/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_IMPACT_01_영향범주_방법_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 특성화 계수 버전 선택

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_LCA_IMPACT_02_특성화_계수_버전_선택` / `API_LCA_IMPACT_02_특성화_계수_버전_선택` / `SCR_LCA_IMPACT_02_특성화_계수_버전_선택`
- 경로: `/work/lca-impact/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_IMPACT_02_특성화_계수_버전_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 영향평가 계산

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_LCA_IMPACT_03_영향평가_계산` / `API_LCA_IMPACT_03_영향평가_계산` / `SCR_LCA_IMPACT_03_영향평가_계산`
- 경로: `/work/lca-impact/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_IMPACT_03_영향평가_계산`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 공정별 기여도

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_LCA_IMPACT_04_공정별_기여도` / `API_LCA_IMPACT_04_공정별_기여도` / `SCR_LCA_IMPACT_04_공정별_기여도`
- 경로: `/work/lca-impact/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_IMPACT_04_공정별_기여도`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 원료별 기여도

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_LCA_IMPACT_05_원료별_기여도` / `API_LCA_IMPACT_05_원료별_기여도` / `SCR_LCA_IMPACT_05_원료별_기여도`
- 경로: `/work/lca-impact/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_IMPACT_05_원료별_기여도`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 민감도·시나리오

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_LCA_IMPACT_06_민감도_시나리오` / `API_LCA_IMPACT_06_민감도_시나리오` / `SCR_LCA_IMPACT_06_민감도_시나리오`
- 경로: `/work/lca-impact/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_IMPACT_06_민감도_시나리오`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 결과 검토

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_LCA_IMPACT_07_결과_검토` / `API_LCA_IMPACT_07_결과_검토` / `SCR_LCA_IMPACT_07_결과_검토`
- 경로: `/work/lca-impact/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_IMPACT_07_결과_검토`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### LCA·제품탄소발자국 보고 (`LCA_REPORT`)

- 담당 액터: `LCA_PRACTITIONER`
- 영역: `REPORT` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: STD-ISO-14067, RULE-EPD, LAW-E-DOCUMENT

#### 1. 확정 결과 선택

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_LCA_REPORT_01_확정_결과_선택` / `API_LCA_REPORT_01_확정_결과_선택` / `SCR_LCA_REPORT_01_확정_결과_선택`
- 경로: `/work/lca-report/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_REPORT_01_확정_결과_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 요약·상세 보고서 생성

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_LCA_REPORT_02_요약_상세_보고서_생성` / `API_LCA_REPORT_02_요약_상세_보고서_생성` / `SCR_LCA_REPORT_02_요약_상세_보고서_생성`
- 경로: `/work/lca-report/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_REPORT_02_요약_상세_보고서_생성`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 가정·제외·품질 표시

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_LCA_REPORT_03_가정_제외_품질_표시` / `API_LCA_REPORT_03_가정_제외_품질_표시` / `SCR_LCA_REPORT_03_가정_제외_품질_표시`
- 경로: `/work/lca-report/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_REPORT_03_가정_제외_품질_표시`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 독립 검토

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_LCA_REPORT_04_독립_검토` / `API_LCA_REPORT_04_독립_검토` / `SCR_LCA_REPORT_04_독립_검토`
- 경로: `/work/lca-report/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_REPORT_04_독립_검토`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 보고서 확정

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_LCA_REPORT_05_보고서_확정` / `API_LCA_REPORT_05_보고서_확정` / `SCR_LCA_REPORT_05_보고서_확정`
- 경로: `/work/lca-report/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_REPORT_05_보고서_확정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 발급·공개 범위 설정

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_LCA_REPORT_06_발급_공개_범위_설정` / `API_LCA_REPORT_06_발급_공개_범위_설정` / `SCR_LCA_REPORT_06_발급_공개_범위_설정`
- 경로: `/work/lca-report/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_LCA_REPORT_06_발급_공개_범위_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 감축 목표·로드맵 (`REDUCTION_TARGET`)

- 담당 액터: `REDUCTION_MANAGER`
- 영역: `REDUCTION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CARBON-NEUTRAL

#### 1. 기준연도 설정

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_REDUCTION_TARGET_01_기준연도_설정` / `API_REDUCTION_TARGET_01_기준연도_설정` / `SCR_REDUCTION_TARGET_01_기준연도_설정`
- 경로: `/work/reduction-target/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_TARGET_01_기준연도_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 기준배출량 확정

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_REDUCTION_TARGET_02_기준배출량_확정` / `API_REDUCTION_TARGET_02_기준배출량_확정` / `SCR_REDUCTION_TARGET_02_기준배출량_확정`
- 경로: `/work/reduction-target/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_TARGET_02_기준배출량_확정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 조직·사업장 목표 배분

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_REDUCTION_TARGET_03_조직_사업장_목표_배분` / `API_REDUCTION_TARGET_03_조직_사업장_목표_배분` / `SCR_REDUCTION_TARGET_03_조직_사업장_목표_배분`
- 경로: `/work/reduction-target/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_TARGET_03_조직_사업장_목표_배분`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 목표 시나리오

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_REDUCTION_TARGET_04_목표_시나리오` / `API_REDUCTION_TARGET_04_목표_시나리오` / `SCR_REDUCTION_TARGET_04_목표_시나리오`
- 경로: `/work/reduction-target/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_TARGET_04_목표_시나리오`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 로드맵 작성

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_REDUCTION_TARGET_05_로드맵_작성` / `API_REDUCTION_TARGET_05_로드맵_작성` / `SCR_REDUCTION_TARGET_05_로드맵_작성`
- 경로: `/work/reduction-target/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_TARGET_05_로드맵_작성`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 승인

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_REDUCTION_TARGET_06_승인` / `API_REDUCTION_TARGET_06_승인` / `SCR_REDUCTION_TARGET_06_승인`
- 경로: `/work/reduction-target/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_TARGET_06_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 변경관리

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_REDUCTION_TARGET_07_변경관리` / `API_REDUCTION_TARGET_07_변경관리` / `SCR_REDUCTION_TARGET_07_변경관리`
- 경로: `/work/reduction-target/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_TARGET_07_변경관리`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 감축 과제 생애주기 (`REDUCTION_INITIATIVE`)

- 담당 액터: `REDUCTION_MANAGER`
- 영역: `REDUCTION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CARBON-NEUTRAL

#### 1. 과제 등록

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_01_과제_등록` / `API_REDUCTION_INITIATIVE_01_과제_등록` / `SCR_REDUCTION_INITIATIVE_01_과제_등록`
- 경로: `/work/reduction-initiative/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_01_과제_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 감축수단·경계 설정

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_02_감축수단_경계_설정` / `API_REDUCTION_INITIATIVE_02_감축수단_경계_설정` / `SCR_REDUCTION_INITIATIVE_02_감축수단_경계_설정`
- 경로: `/work/reduction-initiative/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_02_감축수단_경계_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 예상 감축량 산정

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_03_예상_감축량_산정` / `API_REDUCTION_INITIATIVE_03_예상_감축량_산정` / `SCR_REDUCTION_INITIATIVE_03_예상_감축량_산정`
- 경로: `/work/reduction-initiative/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_03_예상_감축량_산정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 예산·일정·담당자

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_04_예산_일정_담당자` / `API_REDUCTION_INITIATIVE_04_예산_일정_담당자` / `SCR_REDUCTION_INITIATIVE_04_예산_일정_담당자`
- 경로: `/work/reduction-initiative/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_04_예산_일정_담당자`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 타당성 검토

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_05_타당성_검토` / `API_REDUCTION_INITIATIVE_05_타당성_검토` / `SCR_REDUCTION_INITIATIVE_05_타당성_검토`
- 경로: `/work/reduction-initiative/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_05_타당성_검토`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 승인

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_06_승인` / `API_REDUCTION_INITIATIVE_06_승인` / `SCR_REDUCTION_INITIATIVE_06_승인`
- 경로: `/work/reduction-initiative/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_06_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 실행

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_07_실행` / `API_REDUCTION_INITIATIVE_07_실행` / `SCR_REDUCTION_INITIATIVE_07_실행`
- 경로: `/work/reduction-initiative/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_07_실행`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 종료

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_REDUCTION_INITIATIVE_08_종료` / `API_REDUCTION_INITIATIVE_08_종료` / `SCR_REDUCTION_INITIATIVE_08_종료`
- 경로: `/work/reduction-initiative/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_INITIATIVE_08_종료`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 감축 실적·성과 검증 (`REDUCTION_PERFORMANCE`)

- 담당 액터: `REDUCTION_MANAGER`
- 영역: `REDUCTION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CARBON-NEUTRAL, STD-ISO-14064

#### 1. 모니터링 자료 수집

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_REDUCTION_PERFORMANCE_01_모니터링_자료_수집` / `API_REDUCTION_PERFORMANCE_01_모니터링_자료_수집` / `SCR_REDUCTION_PERFORMANCE_01_모니터링_자료_수집`
- 경로: `/work/reduction-performance/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_PERFORMANCE_01_모니터링_자료_수집`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 기준선 조정

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_REDUCTION_PERFORMANCE_02_기준선_조정` / `API_REDUCTION_PERFORMANCE_02_기준선_조정` / `SCR_REDUCTION_PERFORMANCE_02_기준선_조정`
- 경로: `/work/reduction-performance/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_PERFORMANCE_02_기준선_조정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 실제 감축량 산정

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_REDUCTION_PERFORMANCE_03_실제_감축량_산정` / `API_REDUCTION_PERFORMANCE_03_실제_감축량_산정` / `SCR_REDUCTION_PERFORMANCE_03_실제_감축량_산정`
- 경로: `/work/reduction-performance/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_PERFORMANCE_03_실제_감축량_산정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 비용·효과 분석

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_REDUCTION_PERFORMANCE_04_비용_효과_분석` / `API_REDUCTION_PERFORMANCE_04_비용_효과_분석` / `SCR_REDUCTION_PERFORMANCE_04_비용_효과_분석`
- 경로: `/work/reduction-performance/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_PERFORMANCE_04_비용_효과_분석`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 검증

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_REDUCTION_PERFORMANCE_05_검증` / `API_REDUCTION_PERFORMANCE_05_검증` / `SCR_REDUCTION_PERFORMANCE_05_검증`
- 경로: `/work/reduction-performance/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_PERFORMANCE_05_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 승인

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_REDUCTION_PERFORMANCE_06_승인` / `API_REDUCTION_PERFORMANCE_06_승인` / `SCR_REDUCTION_PERFORMANCE_06_승인`
- 경로: `/work/reduction-performance/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_PERFORMANCE_06_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 성과 보고

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_REDUCTION_PERFORMANCE_07_성과_보고` / `API_REDUCTION_PERFORMANCE_07_성과_보고` / `SCR_REDUCTION_PERFORMANCE_07_성과_보고`
- 경로: `/work/reduction-performance/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REDUCTION_PERFORMANCE_07_성과_보고`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 통합 모니터링·이상치 대응 (`MONITORING_ANALYSIS`)

- 담당 액터: `INTERNAL_REVIEWER`
- 영역: `MONITORING` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CARBON-NEUTRAL

#### 1. 분석범위 선택

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_01_분석범위_선택` / `API_MONITORING_ANALYSIS_01_분석범위_선택` / `SCR_MONITORING_ANALYSIS_01_분석범위_선택`
- 경로: `/work/monitoring-analysis/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_01_분석범위_선택`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 지표 집계

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_02_지표_집계` / `API_MONITORING_ANALYSIS_02_지표_집계` / `SCR_MONITORING_ANALYSIS_02_지표_집계`
- 경로: `/work/monitoring-analysis/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_02_지표_집계`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 목표 대비 분석

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_03_목표_대비_분석` / `API_MONITORING_ANALYSIS_03_목표_대비_분석` / `SCR_MONITORING_ANALYSIS_03_목표_대비_분석`
- 경로: `/work/monitoring-analysis/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_03_목표_대비_분석`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 품질 점수

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_04_품질_점수` / `API_MONITORING_ANALYSIS_04_품질_점수` / `SCR_MONITORING_ANALYSIS_04_품질_점수`
- 경로: `/work/monitoring-analysis/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_04_품질_점수`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 이상치·경보

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_05_이상치_경보` / `API_MONITORING_ANALYSIS_05_이상치_경보` / `SCR_MONITORING_ANALYSIS_05_이상치_경보`
- 경로: `/work/monitoring-analysis/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_05_이상치_경보`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 원인 조사

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_06_원인_조사` / `API_MONITORING_ANALYSIS_06_원인_조사` / `SCR_MONITORING_ANALYSIS_06_원인_조사`
- 경로: `/work/monitoring-analysis/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_06_원인_조사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 조치·종결

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_07_조치_종결` / `API_MONITORING_ANALYSIS_07_조치_종결` / `SCR_MONITORING_ANALYSIS_07_조치_종결`
- 경로: `/work/monitoring-analysis/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_07_조치_종결`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 공유·내보내기

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_MONITORING_ANALYSIS_08_공유_내보내기` / `API_MONITORING_ANALYSIS_08_공유_내보내기` / `SCR_MONITORING_ANALYSIS_08_공유_내보내기`
- 경로: `/work/monitoring-analysis/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_MONITORING_ANALYSIS_08_공유_내보내기`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### CO2 포집 운영 (`CCUS_CAPTURE`)

- 담당 액터: `CCUS_CAPTURE_OPERATOR`
- 영역: `CCUS` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS

#### 1. 배출원·설비 등록

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CCUS_CAPTURE_01_배출원_설비_등록` / `API_CCUS_CAPTURE_01_배출원_설비_등록` / `SCR_CCUS_CAPTURE_01_배출원_설비_등록`
- 경로: `/work/ccus-capture/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_CAPTURE_01_배출원_설비_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 포집계획

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CCUS_CAPTURE_02_포집계획` / `API_CCUS_CAPTURE_02_포집계획` / `SCR_CCUS_CAPTURE_02_포집계획`
- 경로: `/work/ccus-capture/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_CAPTURE_02_포집계획`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 포집량·운전자료 수집

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CCUS_CAPTURE_03_포집량_운전자료_수집` / `API_CCUS_CAPTURE_03_포집량_운전자료_수집` / `SCR_CCUS_CAPTURE_03_포집량_운전자료_수집`
- 경로: `/work/ccus-capture/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_CAPTURE_03_포집량_운전자료_수집`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. CO2 품질 검사

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CCUS_CAPTURE_04_CO2_품질_검사` / `API_CCUS_CAPTURE_04_CO2_품질_검사` / `SCR_CCUS_CAPTURE_04_CO2_품질_검사`
- 경로: `/work/ccus-capture/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_CAPTURE_04_CO2_품질_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 손실·누출 산정

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CCUS_CAPTURE_05_손실_누출_산정` / `API_CCUS_CAPTURE_05_손실_누출_산정` / `SCR_CCUS_CAPTURE_05_손실_누출_산정`
- 경로: `/work/ccus-capture/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_CAPTURE_05_손실_누출_산정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 인계 계량

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CCUS_CAPTURE_06_인계_계량` / `API_CCUS_CAPTURE_06_인계_계량` / `SCR_CCUS_CAPTURE_06_인계_계량`
- 경로: `/work/ccus-capture/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_CAPTURE_06_인계_계량`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 운영기록 보존

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CCUS_CAPTURE_07_운영기록_보존` / `API_CCUS_CAPTURE_07_운영기록_보존` / `SCR_CCUS_CAPTURE_07_운영기록_보존`
- 경로: `/work/ccus-capture/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_CAPTURE_07_운영기록_보존`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### CO2 수송·인수인계 (`CCUS_TRANSPORT`)

- 담당 액터: `CCUS_TRANSPORT_OPERATOR`
- 영역: `CCUS` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS

#### 1. 수송계약·경로

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CCUS_TRANSPORT_01_수송계약_경로` / `API_CCUS_TRANSPORT_01_수송계약_경로` / `SCR_CCUS_TRANSPORT_01_수송계약_경로`
- 경로: `/work/ccus-transport/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_TRANSPORT_01_수송계약_경로`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 인수 계량·품질 확인

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CCUS_TRANSPORT_02_인수_계량_품질_확인` / `API_CCUS_TRANSPORT_02_인수_계량_품질_확인` / `SCR_CCUS_TRANSPORT_02_인수_계량_품질_확인`
- 경로: `/work/ccus-transport/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_TRANSPORT_02_인수_계량_품질_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 운송수단·안전 확인

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CCUS_TRANSPORT_03_운송수단_안전_확인` / `API_CCUS_TRANSPORT_03_운송수단_안전_확인` / `SCR_CCUS_TRANSPORT_03_운송수단_안전_확인`
- 경로: `/work/ccus-transport/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_TRANSPORT_03_운송수단_안전_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 수송 추적

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CCUS_TRANSPORT_04_수송_추적` / `API_CCUS_TRANSPORT_04_수송_추적` / `SCR_CCUS_TRANSPORT_04_수송_추적`
- 경로: `/work/ccus-transport/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_TRANSPORT_04_수송_추적`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 사고·누출 대응

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CCUS_TRANSPORT_05_사고_누출_대응` / `API_CCUS_TRANSPORT_05_사고_누출_대응` / `SCR_CCUS_TRANSPORT_05_사고_누출_대응`
- 경로: `/work/ccus-transport/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_TRANSPORT_05_사고_누출_대응`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 인계 계량

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CCUS_TRANSPORT_06_인계_계량` / `API_CCUS_TRANSPORT_06_인계_계량` / `SCR_CCUS_TRANSPORT_06_인계_계량`
- 경로: `/work/ccus-transport/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_TRANSPORT_06_인계_계량`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 차이 조정·기록

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CCUS_TRANSPORT_07_차이_조정_기록` / `API_CCUS_TRANSPORT_07_차이_조정_기록` / `SCR_CCUS_TRANSPORT_07_차이_조정_기록`
- 경로: `/work/ccus-transport/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_TRANSPORT_07_차이_조정_기록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### CO2 저장·모니터링 (`CCUS_STORAGE`)

- 담당 액터: `CCUS_STORAGE_OPERATOR`
- 영역: `CCUS` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS

#### 1. 저장소·허가 확인

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_01_저장소_허가_확인` / `API_CCUS_STORAGE_01_저장소_허가_확인` / `SCR_CCUS_STORAGE_01_저장소_허가_확인`
- 경로: `/work/ccus-storage/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_01_저장소_허가_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 주입계획

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_02_주입계획` / `API_CCUS_STORAGE_02_주입계획` / `SCR_CCUS_STORAGE_02_주입계획`
- 경로: `/work/ccus-storage/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_02_주입계획`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 인수·주입 계량

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_03_인수_주입_계량` / `API_CCUS_STORAGE_03_인수_주입_계량` / `SCR_CCUS_STORAGE_03_인수_주입_계량`
- 경로: `/work/ccus-storage/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_03_인수_주입_계량`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 압력·거동 모니터링

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_04_압력_거동_모니터링` / `API_CCUS_STORAGE_04_압력_거동_모니터링` / `SCR_CCUS_STORAGE_04_압력_거동_모니터링`
- 경로: `/work/ccus-storage/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_04_압력_거동_모니터링`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 누출·이상 대응

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_05_누출_이상_대응` / `API_CCUS_STORAGE_05_누출_이상_대응` / `SCR_CCUS_STORAGE_05_누출_이상_대응`
- 경로: `/work/ccus-storage/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_05_누출_이상_대응`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 저장량 검증

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_06_저장량_검증` / `API_CCUS_STORAGE_06_저장량_검증` / `SCR_CCUS_STORAGE_06_저장량_검증`
- 경로: `/work/ccus-storage/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_06_저장량_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 폐쇄·사후관리

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_07_폐쇄_사후관리` / `API_CCUS_STORAGE_07_폐쇄_사후관리` / `SCR_CCUS_STORAGE_07_폐쇄_사후관리`
- 경로: `/work/ccus-storage/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_07_폐쇄_사후관리`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 운영기록 보존

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_CCUS_STORAGE_08_운영기록_보존` / `API_CCUS_STORAGE_08_운영기록_보존` / `SCR_CCUS_STORAGE_08_운영기록_보존`
- 경로: `/work/ccus-storage/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_STORAGE_08_운영기록_보존`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### CO2 활용·제품 추적 (`CCUS_UTILIZATION`)

- 담당 액터: `CCUS_UTILIZATION_OPERATOR`
- 영역: `CCUS` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS, STD-ISO-14067

#### 1. 활용공정·제품 등록

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CCUS_UTILIZATION_01_활용공정_제품_등록` / `API_CCUS_UTILIZATION_01_활용공정_제품_등록` / `SCR_CCUS_UTILIZATION_01_활용공정_제품_등록`
- 경로: `/work/ccus-utilization/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_UTILIZATION_01_활용공정_제품_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. CO2 인수·품질 확인

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CCUS_UTILIZATION_02_CO2_인수_품질_확인` / `API_CCUS_UTILIZATION_02_CO2_인수_품질_확인` / `SCR_CCUS_UTILIZATION_02_CO2_인수_품질_확인`
- 경로: `/work/ccus-utilization/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_UTILIZATION_02_CO2_인수_품질_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 투입·산출 수지

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CCUS_UTILIZATION_03_투입_산출_수지` / `API_CCUS_UTILIZATION_03_투입_산출_수지` / `SCR_CCUS_UTILIZATION_03_투입_산출_수지`
- 경로: `/work/ccus-utilization/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_UTILIZATION_03_투입_산출_수지`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 고정·재방출량 산정

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CCUS_UTILIZATION_04_고정_재방출량_산정` / `API_CCUS_UTILIZATION_04_고정_재방출량_산정` / `SCR_CCUS_UTILIZATION_04_고정_재방출량_산정`
- 경로: `/work/ccus-utilization/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_UTILIZATION_04_고정_재방출량_산정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 제품·부산물 추적

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CCUS_UTILIZATION_05_제품_부산물_추적` / `API_CCUS_UTILIZATION_05_제품_부산물_추적` / `SCR_CCUS_UTILIZATION_05_제품_부산물_추적`
- 경로: `/work/ccus-utilization/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_UTILIZATION_05_제품_부산물_추적`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 감축량 산정

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CCUS_UTILIZATION_06_감축량_산정` / `API_CCUS_UTILIZATION_06_감축량_산정` / `SCR_CCUS_UTILIZATION_06_감축량_산정`
- 경로: `/work/ccus-utilization/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_UTILIZATION_06_감축량_산정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 인증 신청

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CCUS_UTILIZATION_07_인증_신청` / `API_CCUS_UTILIZATION_07_인증_신청` / `SCR_CCUS_UTILIZATION_07_인증_신청`
- 경로: `/work/ccus-utilization/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CCUS_UTILIZATION_07_인증_신청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### CCUS 전 과정 질량수지·감축량 (`CO2_MASS_BALANCE`)

- 담당 액터: `CALCULATOR`
- 영역: `CCUS` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS, STD-ISO-14064

#### 1. 포집·수송·저장·활용 데이터 잠금

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CO2_MASS_BALANCE_01_포집_수송_저장_활용_데이터_잠금` / `API_CO2_MASS_BALANCE_01_포집_수송_저장_활용_데이터_잠금` / `SCR_CO2_MASS_BALANCE_01_포집_수송_저장_활용_데이터_잠금`
- 경로: `/work/co2-mass-balance/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CO2_MASS_BALANCE_01_포집_수송_저장_활용_데이터_잠금`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 계량기·단위 정규화

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CO2_MASS_BALANCE_02_계량기_단위_정규화` / `API_CO2_MASS_BALANCE_02_계량기_단위_정규화` / `SCR_CO2_MASS_BALANCE_02_계량기_단위_정규화`
- 경로: `/work/co2-mass-balance/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CO2_MASS_BALANCE_02_계량기_단위_정규화`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 인수인계 차이 조정

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CO2_MASS_BALANCE_03_인수인계_차이_조정` / `API_CO2_MASS_BALANCE_03_인수인계_차이_조정` / `SCR_CO2_MASS_BALANCE_03_인수인계_차이_조정`
- 경로: `/work/co2-mass-balance/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CO2_MASS_BALANCE_03_인수인계_차이_조정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 누출·에너지 배출 반영

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CO2_MASS_BALANCE_04_누출_에너지_배출_반영` / `API_CO2_MASS_BALANCE_04_누출_에너지_배출_반영` / `SCR_CO2_MASS_BALANCE_04_누출_에너지_배출_반영`
- 경로: `/work/co2-mass-balance/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CO2_MASS_BALANCE_04_누출_에너지_배출_반영`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 중복계상 검사

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CO2_MASS_BALANCE_05_중복계상_검사` / `API_CO2_MASS_BALANCE_05_중복계상_검사` / `SCR_CO2_MASS_BALANCE_05_중복계상_검사`
- 경로: `/work/co2-mass-balance/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CO2_MASS_BALANCE_05_중복계상_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 순감축량 산정

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CO2_MASS_BALANCE_06_순감축량_산정` / `API_CO2_MASS_BALANCE_06_순감축량_산정` / `SCR_CO2_MASS_BALANCE_06_순감축량_산정`
- 경로: `/work/co2-mass-balance/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CO2_MASS_BALANCE_06_순감축량_산정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 검증·확정

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CO2_MASS_BALANCE_07_검증_확정` / `API_CO2_MASS_BALANCE_07_검증_확정` / `SCR_CO2_MASS_BALANCE_07_검증_확정`
- 경로: `/work/co2-mass-balance/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CO2_MASS_BALANCE_07_검증_확정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### CO2 공급·수요 등록·매칭 (`SUPPLY_DEMAND`)

- 담당 액터: `TRADER`
- 영역: `TRADE` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS

#### 1. 공급·수요 등록

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_SUPPLY_DEMAND_01_공급_수요_등록` / `API_SUPPLY_DEMAND_01_공급_수요_등록` / `SCR_SUPPLY_DEMAND_01_공급_수요_등록`
- 경로: `/work/supply-demand/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SUPPLY_DEMAND_01_공급_수요_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 품질·물량·기간·위치 검증

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_SUPPLY_DEMAND_02_품질_물량_기간_위치_검증` / `API_SUPPLY_DEMAND_02_품질_물량_기간_위치_검증` / `SCR_SUPPLY_DEMAND_02_품질_물량_기간_위치_검증`
- 경로: `/work/supply-demand/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SUPPLY_DEMAND_02_품질_물량_기간_위치_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 상대방 검색

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_SUPPLY_DEMAND_03_상대방_검색` / `API_SUPPLY_DEMAND_03_상대방_검색` / `SCR_SUPPLY_DEMAND_03_상대방_검색`
- 경로: `/work/supply-demand/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SUPPLY_DEMAND_03_상대방_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 매칭 후보 산출

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_SUPPLY_DEMAND_04_매칭_후보_산출` / `API_SUPPLY_DEMAND_04_매칭_후보_산출` / `SCR_SUPPLY_DEMAND_04_매칭_후보_산출`
- 경로: `/work/supply-demand/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SUPPLY_DEMAND_04_매칭_후보_산출`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 후보 비교

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_SUPPLY_DEMAND_05_후보_비교` / `API_SUPPLY_DEMAND_05_후보_비교` / `SCR_SUPPLY_DEMAND_05_후보_비교`
- 경로: `/work/supply-demand/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SUPPLY_DEMAND_05_후보_비교`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 협의 요청

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_SUPPLY_DEMAND_06_협의_요청` / `API_SUPPLY_DEMAND_06_협의_요청` / `SCR_SUPPLY_DEMAND_06_협의_요청`
- 경로: `/work/supply-demand/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SUPPLY_DEMAND_06_협의_요청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 매칭 확정

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_SUPPLY_DEMAND_07_매칭_확정` / `API_SUPPLY_DEMAND_07_매칭_확정` / `SCR_SUPPLY_DEMAND_07_매칭_확정`
- 경로: `/work/supply-demand/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SUPPLY_DEMAND_07_매칭_확정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 거래 제안·계약·이행 (`TRADE_EXECUTION`)

- 담당 액터: `TRADER`
- 영역: `TRADE` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS, LAW-E-DOCUMENT, LAW-E-SIGN

#### 1. 거래 제안

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_01_거래_제안` / `API_TRADE_EXECUTION_01_거래_제안` / `SCR_TRADE_EXECUTION_01_거래_제안`
- 경로: `/work/trade-execution/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_01_거래_제안`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 협상·변경 이력

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_02_협상_변경_이력` / `API_TRADE_EXECUTION_02_협상_변경_이력` / `SCR_TRADE_EXECUTION_02_협상_변경_이력`
- 경로: `/work/trade-execution/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_02_협상_변경_이력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 상대방 적격성

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_03_상대방_적격성` / `API_TRADE_EXECUTION_03_상대방_적격성` / `SCR_TRADE_EXECUTION_03_상대방_적격성`
- 경로: `/work/trade-execution/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_03_상대방_적격성`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 전자계약

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_04_전자계약` / `API_TRADE_EXECUTION_04_전자계약` / `SCR_TRADE_EXECUTION_04_전자계약`
- 경로: `/work/trade-execution/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_04_전자계약`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 인도 계획

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_05_인도_계획` / `API_TRADE_EXECUTION_05_인도_계획` / `SCR_TRADE_EXECUTION_05_인도_계획`
- 경로: `/work/trade-execution/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_05_인도_계획`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 인수인계 증적

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_06_인수인계_증적` / `API_TRADE_EXECUTION_06_인수인계_증적` / `SCR_TRADE_EXECUTION_06_인수인계_증적`
- 경로: `/work/trade-execution/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_06_인수인계_증적`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 이행 완료

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_07_이행_완료` / `API_TRADE_EXECUTION_07_이행_완료` / `SCR_TRADE_EXECUTION_07_이행_완료`
- 경로: `/work/trade-execution/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_07_이행_완료`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 분쟁·취소

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_TRADE_EXECUTION_08_분쟁_취소` / `API_TRADE_EXECUTION_08_분쟁_취소` / `SCR_TRADE_EXECUTION_08_분쟁_취소`
- 경로: `/work/trade-execution/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_TRADE_EXECUTION_08_분쟁_취소`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 거래 정산·결제·환불 (`SETTLEMENT`)

- 담당 액터: `SETTLEMENT_OFFICER`
- 영역: `PAYMENT` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-E-DOCUMENT

#### 1. 정산대상 확정

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_01_정산대상_확정` / `API_SETTLEMENT_01_정산대상_확정` / `SCR_SETTLEMENT_01_정산대상_확정`
- 경로: `/work/settlement/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_01_정산대상_확정`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 금액·세금 계산

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_02_금액_세금_계산` / `API_SETTLEMENT_02_금액_세금_계산` / `SCR_SETTLEMENT_02_금액_세금_계산`
- 경로: `/work/settlement/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_02_금액_세금_계산`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 청구·결제

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_03_청구_결제` / `API_SETTLEMENT_03_청구_결제` / `SCR_SETTLEMENT_03_청구_결제`
- 경로: `/work/settlement/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_03_청구_결제`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 입금 대사

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_04_입금_대사` / `API_SETTLEMENT_04_입금_대사` / `SCR_SETTLEMENT_04_입금_대사`
- 경로: `/work/settlement/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_04_입금_대사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 세금계산서

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_05_세금계산서` / `API_SETTLEMENT_05_세금계산서` / `SCR_SETTLEMENT_05_세금계산서`
- 경로: `/work/settlement/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_05_세금계산서`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 정산 지급

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_06_정산_지급` / `API_SETTLEMENT_06_정산_지급` / `SCR_SETTLEMENT_06_정산_지급`
- 경로: `/work/settlement/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_06_정산_지급`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 환불·취소

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_07_환불_취소` / `API_SETTLEMENT_07_환불_취소` / `SCR_SETTLEMENT_07_환불_취소`
- 경로: `/work/settlement/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_07_환불_취소`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 회계 증적

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_SETTLEMENT_08_회계_증적` / `API_SETTLEMENT_08_회계_증적` / `SCR_SETTLEMENT_08_회계_증적`
- 경로: `/work/settlement/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SETTLEMENT_08_회계_증적`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 인증서 신청·검토·발급 (`CERTIFICATE_ISSUANCE`)

- 담당 액터: `CERTIFICATE_ISSUER`
- 영역: `CERTIFICATE` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-CCUS, LAW-E-DOCUMENT, LAW-E-SIGN

#### 1. 발급 신청

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_01_발급_신청` / `API_CERTIFICATE_ISSUANCE_01_발급_신청` / `SCR_CERTIFICATE_ISSUANCE_01_발급_신청`
- 경로: `/work/certificate-issuance/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_01_발급_신청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 대상 결과·증적 잠금

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_02_대상_결과_증적_잠금` / `API_CERTIFICATE_ISSUANCE_02_대상_결과_증적_잠금` / `SCR_CERTIFICATE_ISSUANCE_02_대상_결과_증적_잠금`
- 경로: `/work/certificate-issuance/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_02_대상_결과_증적_잠금`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 중복 발급 검사

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_03_중복_발급_검사` / `API_CERTIFICATE_ISSUANCE_03_중복_발급_검사` / `SCR_CERTIFICATE_ISSUANCE_03_중복_발급_검사`
- 경로: `/work/certificate-issuance/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_03_중복_발급_검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 적격성 검토

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_04_적격성_검토` / `API_CERTIFICATE_ISSUANCE_04_적격성_검토` / `SCR_CERTIFICATE_ISSUANCE_04_적격성_검토`
- 경로: `/work/certificate-issuance/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_04_적격성_검토`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 수수료 확인

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_05_수수료_확인` / `API_CERTIFICATE_ISSUANCE_05_수수료_확인` / `SCR_CERTIFICATE_ISSUANCE_05_수수료_확인`
- 경로: `/work/certificate-issuance/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_05_수수료_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 전자서명·발급

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_06_전자서명_발급` / `API_CERTIFICATE_ISSUANCE_06_전자서명_발급` / `SCR_CERTIFICATE_ISSUANCE_06_전자서명_발급`
- 경로: `/work/certificate-issuance/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_06_전자서명_발급`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 공개키·진위 데이터 등록

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_07_공개키_진위_데이터_등록` / `API_CERTIFICATE_ISSUANCE_07_공개키_진위_데이터_등록` / `SCR_CERTIFICATE_ISSUANCE_07_공개키_진위_데이터_등록`
- 경로: `/work/certificate-issuance/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_07_공개키_진위_데이터_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 재발급·취소

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_ISSUANCE_08_재발급_취소` / `API_CERTIFICATE_ISSUANCE_08_재발급_취소` / `SCR_CERTIFICATE_ISSUANCE_08_재발급_취소`
- 경로: `/work/certificate-issuance/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_ISSUANCE_08_재발급_취소`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 보고서·인증서 진위 확인 (`CERTIFICATE_VERIFY`)

- 담당 액터: `PUBLIC_VISITOR`
- 영역: `CERTIFICATE` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-E-DOCUMENT, LAW-E-SIGN

#### 1. 파일·번호·QR 입력

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_VERIFY_01_파일_번호_QR_입력` / `API_CERTIFICATE_VERIFY_01_파일_번호_QR_입력` / `SCR_CERTIFICATE_VERIFY_01_파일_번호_QR_입력`
- 경로: `/work/certificate-verify/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_VERIFY_01_파일_번호_QR_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 원본 레지스트리 검색

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_VERIFY_02_원본_레지스트리_검색` / `API_CERTIFICATE_VERIFY_02_원본_레지스트리_검색` / `SCR_CERTIFICATE_VERIFY_02_원본_레지스트리_검색`
- 경로: `/work/certificate-verify/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_VERIFY_02_원본_레지스트리_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 전자서명·해시 검증

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_VERIFY_03_전자서명_해시_검증` / `API_CERTIFICATE_VERIFY_03_전자서명_해시_검증` / `SCR_CERTIFICATE_VERIFY_03_전자서명_해시_검증`
- 경로: `/work/certificate-verify/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_VERIFY_03_전자서명_해시_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 시각지문·OCR 보조검사

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_VERIFY_04_시각지문_OCR_보조검사` / `API_CERTIFICATE_VERIFY_04_시각지문_OCR_보조검사` / `SCR_CERTIFICATE_VERIFY_04_시각지문_OCR_보조검사`
- 경로: `/work/certificate-verify/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_VERIFY_04_시각지문_OCR_보조검사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 핵심 수치·물질 대조

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_VERIFY_05_핵심_수치_물질_대조` / `API_CERTIFICATE_VERIFY_05_핵심_수치_물질_대조` / `SCR_CERTIFICATE_VERIFY_05_핵심_수치_물질_대조`
- 경로: `/work/certificate-verify/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_VERIFY_05_핵심_수치_물질_대조`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 판정·불일치 상세

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_VERIFY_06_판정_불일치_상세` / `API_CERTIFICATE_VERIFY_06_판정_불일치_상세` / `SCR_CERTIFICATE_VERIFY_06_판정_불일치_상세`
- 경로: `/work/certificate-verify/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_VERIFY_06_판정_불일치_상세`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 조회 감사

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CERTIFICATE_VERIFY_07_조회_감사` / `API_CERTIFICATE_VERIFY_07_조회_감사` / `SCR_CERTIFICATE_VERIFY_07_조회_감사`
- 경로: `/work/certificate-verify/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CERTIFICATE_VERIFY_07_조회_감사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 기준정보·방법론 버전 관리 (`REFERENCE_DATA`)

- 담당 액터: `DATA_STEWARD`
- 영역: `DATA` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: RULE-ETS-MRV, STD-ISO-14067

#### 1. 변경 요청

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_01_변경_요청` / `API_REFERENCE_DATA_01_변경_요청` / `SCR_REFERENCE_DATA_01_변경_요청`
- 경로: `/work/reference-data/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_01_변경_요청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 법령·출처 등록

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_02_법령_출처_등록` / `API_REFERENCE_DATA_02_법령_출처_등록` / `SCR_REFERENCE_DATA_02_법령_출처_등록`
- 경로: `/work/reference-data/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_02_법령_출처_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 물질·단위·계수 검색

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_03_물질_단위_계수_검색` / `API_REFERENCE_DATA_03_물질_단위_계수_검색` / `SCR_REFERENCE_DATA_03_물질_단위_계수_검색`
- 경로: `/work/reference-data/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_03_물질_단위_계수_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 신규·개정 값 입력

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_04_신규_개정_값_입력` / `API_REFERENCE_DATA_04_신규_개정_값_입력` / `SCR_REFERENCE_DATA_04_신규_개정_값_입력`
- 경로: `/work/reference-data/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_04_신규_개정_값_입력`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 영향 분석

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_05_영향_분석` / `API_REFERENCE_DATA_05_영향_분석` / `SCR_REFERENCE_DATA_05_영향_분석`
- 경로: `/work/reference-data/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_05_영향_분석`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 검토·승인

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_06_검토_승인` / `API_REFERENCE_DATA_06_검토_승인` / `SCR_REFERENCE_DATA_06_검토_승인`
- 경로: `/work/reference-data/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_06_검토_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 유효기간 배포

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_07_유효기간_배포` / `API_REFERENCE_DATA_07_유효기간_배포` / `SCR_REFERENCE_DATA_07_유효기간_배포`
- 경로: `/work/reference-data/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_07_유효기간_배포`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 재산정 대상 통지

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_REFERENCE_DATA_08_재산정_대상_통지` / `API_REFERENCE_DATA_08_재산정_대상_통지` / `SCR_REFERENCE_DATA_08_재산정_대상_통지`
- 경로: `/work/reference-data/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_REFERENCE_DATA_08_재산정_대상_통지`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 외부 API·동기화·재처리 (`EXTERNAL_INTEGRATION`)

- 담당 액터: `SYSTEM_INTEGRATOR`
- 영역: `INTEGRATION` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY, RULE-PRIVACY-SAFETY

#### 1. 연계시스템 등록

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_01_연계시스템_등록` / `API_EXTERNAL_INTEGRATION_01_연계시스템_등록` / `SCR_EXTERNAL_INTEGRATION_01_연계시스템_등록`
- 경로: `/work/external-integration/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_01_연계시스템_등록`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 인증·스키마 설정

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_02_인증_스키마_설정` / `API_EXTERNAL_INTEGRATION_02_인증_스키마_설정` / `SCR_EXTERNAL_INTEGRATION_02_인증_스키마_설정`
- 경로: `/work/external-integration/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_02_인증_스키마_설정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 필드 매핑

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_03_필드_매핑` / `API_EXTERNAL_INTEGRATION_03_필드_매핑` / `SCR_EXTERNAL_INTEGRATION_03_필드_매핑`
- 경로: `/work/external-integration/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_03_필드_매핑`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 연결 테스트

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_04_연결_테스트` / `API_EXTERNAL_INTEGRATION_04_연결_테스트` / `SCR_EXTERNAL_INTEGRATION_04_연결_테스트`
- 경로: `/work/external-integration/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_04_연결_테스트`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 동기화 실행

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_05_동기화_실행` / `API_EXTERNAL_INTEGRATION_05_동기화_실행` / `SCR_EXTERNAL_INTEGRATION_05_동기화_실행`
- 경로: `/work/external-integration/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_05_동기화_실행`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 검증·대사

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_06_검증_대사` / `API_EXTERNAL_INTEGRATION_06_검증_대사` / `SCR_EXTERNAL_INTEGRATION_06_검증_대사`
- 경로: `/work/external-integration/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_06_검증_대사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 실패 재시도·격리

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_07_실패_재시도_격리` / `API_EXTERNAL_INTEGRATION_07_실패_재시도_격리` / `SCR_EXTERNAL_INTEGRATION_07_실패_재시도_격리`
- 경로: `/work/external-integration/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_07_실패_재시도_격리`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 모니터링·감사

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_EXTERNAL_INTEGRATION_08_모니터링_감사` / `API_EXTERNAL_INTEGRATION_08_모니터링_감사` / `SCR_EXTERNAL_INTEGRATION_08_모니터링_감사`
- 경로: `/work/external-integration/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_EXTERNAL_INTEGRATION_08_모니터링_감사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 콘텐츠·교육 운영 (`CONTENT_EDUCATION`)

- 담당 액터: `CONTENT_MANAGER`
- 영역: `CONTENT` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY

#### 1. 콘텐츠·과정 작성

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CONTENT_EDUCATION_01_콘텐츠_과정_작성` / `API_CONTENT_EDUCATION_01_콘텐츠_과정_작성` / `SCR_CONTENT_EDUCATION_01_콘텐츠_과정_작성`
- 경로: `/work/content-education/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CONTENT_EDUCATION_01_콘텐츠_과정_작성`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 검토·승인

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CONTENT_EDUCATION_02_검토_승인` / `API_CONTENT_EDUCATION_02_검토_승인` / `SCR_CONTENT_EDUCATION_02_검토_승인`
- 경로: `/work/content-education/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CONTENT_EDUCATION_02_검토_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 공개범위·예약

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CONTENT_EDUCATION_03_공개범위_예약` / `API_CONTENT_EDUCATION_03_공개범위_예약` / `SCR_CONTENT_EDUCATION_03_공개범위_예약`
- 경로: `/work/content-education/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CONTENT_EDUCATION_03_공개범위_예약`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 게시·신청

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CONTENT_EDUCATION_04_게시_신청` / `API_CONTENT_EDUCATION_04_게시_신청` / `SCR_CONTENT_EDUCATION_04_게시_신청`
- 경로: `/work/content-education/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CONTENT_EDUCATION_04_게시_신청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 출석·진도·평가

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CONTENT_EDUCATION_05_출석_진도_평가` / `API_CONTENT_EDUCATION_05_출석_진도_평가` / `SCR_CONTENT_EDUCATION_05_출석_진도_평가`
- 경로: `/work/content-education/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CONTENT_EDUCATION_05_출석_진도_평가`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 수료증

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CONTENT_EDUCATION_06_수료증` / `API_CONTENT_EDUCATION_06_수료증` / `SCR_CONTENT_EDUCATION_06_수료증`
- 경로: `/work/content-education/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CONTENT_EDUCATION_06_수료증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 보존·폐기

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CONTENT_EDUCATION_07_보존_폐기` / `API_CONTENT_EDUCATION_07_보존_폐기` / `SCR_CONTENT_EDUCATION_07_보존_폐기`
- 경로: `/work/content-education/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CONTENT_EDUCATION_07_보존_폐기`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 문의·장애·개선 요청 (`CUSTOMER_SUPPORT`)

- 담당 액터: `SUPPORT_AGENT`
- 영역: `SUPPORT` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY

#### 1. 요청 접수

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_CUSTOMER_SUPPORT_01_요청_접수` / `API_CUSTOMER_SUPPORT_01_요청_접수` / `SCR_CUSTOMER_SUPPORT_01_요청_접수`
- 경로: `/work/customer-support/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CUSTOMER_SUPPORT_01_요청_접수`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 개인정보·긴급도 분류

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_CUSTOMER_SUPPORT_02_개인정보_긴급도_분류` / `API_CUSTOMER_SUPPORT_02_개인정보_긴급도_분류` / `SCR_CUSTOMER_SUPPORT_02_개인정보_긴급도_분류`
- 경로: `/work/customer-support/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CUSTOMER_SUPPORT_02_개인정보_긴급도_분류`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 담당자 배정

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_CUSTOMER_SUPPORT_03_담당자_배정` / `API_CUSTOMER_SUPPORT_03_담당자_배정` / `SCR_CUSTOMER_SUPPORT_03_담당자_배정`
- 경로: `/work/customer-support/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CUSTOMER_SUPPORT_03_담당자_배정`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 조사·답변

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_CUSTOMER_SUPPORT_04_조사_답변` / `API_CUSTOMER_SUPPORT_04_조사_답변` / `SCR_CUSTOMER_SUPPORT_04_조사_답변`
- 경로: `/work/customer-support/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CUSTOMER_SUPPORT_04_조사_답변`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 개발·운영 이관

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_CUSTOMER_SUPPORT_05_개발_운영_이관` / `API_CUSTOMER_SUPPORT_05_개발_운영_이관` / `SCR_CUSTOMER_SUPPORT_05_개발_운영_이관`
- 경로: `/work/customer-support/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CUSTOMER_SUPPORT_05_개발_운영_이관`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 해결 확인

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_CUSTOMER_SUPPORT_06_해결_확인` / `API_CUSTOMER_SUPPORT_06_해결_확인` / `SCR_CUSTOMER_SUPPORT_06_해결_확인`
- 경로: `/work/customer-support/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CUSTOMER_SUPPORT_06_해결_확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 종결·지식화

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_CUSTOMER_SUPPORT_07_종결_지식화` / `API_CUSTOMER_SUPPORT_07_종결_지식화` / `SCR_CUSTOMER_SUPPORT_07_종결_지식화`
- 경로: `/work/customer-support/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_CUSTOMER_SUPPORT_07_종결_지식화`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 메뉴·화면·API·DB 변경관리 (`GOVERNANCE_CHANGE`)

- 담당 액터: `PLATFORM_OPERATOR`
- 영역: `PLATFORM` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: RULE-PRIVACY-SAFETY

#### 1. 변경 요청

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_01_변경_요청` / `API_GOVERNANCE_CHANGE_01_변경_요청` / `SCR_GOVERNANCE_CHANGE_01_변경_요청`
- 경로: `/work/governance-change/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_01_변경_요청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 요구·법령 근거 연결

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_02_요구_법령_근거_연결` / `API_GOVERNANCE_CHANGE_02_요구_법령_근거_연결` / `SCR_GOVERNANCE_CHANGE_02_요구_법령_근거_연결`
- 경로: `/work/governance-change/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_02_요구_법령_근거_연결`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 영향도 분석

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_03_영향도_분석` / `API_GOVERNANCE_CHANGE_03_영향도_분석` / `SCR_GOVERNANCE_CHANGE_03_영향도_분석`
- 경로: `/work/governance-change/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_03_영향도_분석`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 명세·테스트 생성

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_04_명세_테스트_생성` / `API_GOVERNANCE_CHANGE_04_명세_테스트_생성` / `SCR_GOVERNANCE_CHANGE_04_명세_테스트_생성`
- 경로: `/work/governance-change/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_04_명세_테스트_생성`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 승인

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_05_승인` / `API_GOVERNANCE_CHANGE_05_승인` / `SCR_GOVERNANCE_CHANGE_05_승인`
- 경로: `/work/governance-change/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_05_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 구현·배포

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_06_구현_배포` / `API_GOVERNANCE_CHANGE_06_구현_배포` / `SCR_GOVERNANCE_CHANGE_06_구현_배포`
- 경로: `/work/governance-change/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_06_구현_배포`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 캐시 무효화

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_07_캐시_무효화` / `API_GOVERNANCE_CHANGE_07_캐시_무효화` / `SCR_GOVERNANCE_CHANGE_07_캐시_무효화`
- 경로: `/work/governance-change/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_07_캐시_무효화`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 운영 검증·복구

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_GOVERNANCE_CHANGE_08_운영_검증_복구` / `API_GOVERNANCE_CHANGE_08_운영_검증_복구` / `SCR_GOVERNANCE_CHANGE_08_운영_검증_복구`
- 경로: `/work/governance-change/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_GOVERNANCE_CHANGE_08_운영_검증_복구`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 시스템 운영·관측·복구 (`PLATFORM_OPERATION`)

- 담당 액터: `PLATFORM_OPERATOR`
- 영역: `PLATFORM` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: RULE-PRIVACY-SAFETY

#### 1. 상태 수집

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_01_상태_수집` / `API_PLATFORM_OPERATION_01_상태_수집` / `SCR_PLATFORM_OPERATION_01_상태_수집`
- 경로: `/work/platform-operation/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_01_상태_수집`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 경보 분류

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_02_경보_분류` / `API_PLATFORM_OPERATION_02_경보_분류` / `SCR_PLATFORM_OPERATION_02_경보_분류`
- 경로: `/work/platform-operation/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_02_경보_분류`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 장애 대응

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_03_장애_대응` / `API_PLATFORM_OPERATION_03_장애_대응` / `SCR_PLATFORM_OPERATION_03_장애_대응`
- 경로: `/work/platform-operation/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_03_장애_대응`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. DB·백업 보호

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_04_DB_백업_보호` / `API_PLATFORM_OPERATION_04_DB_백업_보호` / `SCR_PLATFORM_OPERATION_04_DB_백업_보호`
- 경로: `/work/platform-operation/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_04_DB_백업_보호`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 배포·롤백

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_05_배포_롤백` / `API_PLATFORM_OPERATION_05_배포_롤백` / `SCR_PLATFORM_OPERATION_05_배포_롤백`
- 경로: `/work/platform-operation/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_05_배포_롤백`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 복구 검증

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_06_복구_검증` / `API_PLATFORM_OPERATION_06_복구_검증` / `SCR_PLATFORM_OPERATION_06_복구_검증`
- 경로: `/work/platform-operation/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_06_복구_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 사후 분석

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_07_사후_분석` / `API_PLATFORM_OPERATION_07_사후_분석` / `SCR_PLATFORM_OPERATION_07_사후_분석`
- 경로: `/work/platform-operation/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_07_사후_분석`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 재발방지

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_PLATFORM_OPERATION_08_재발방지` / `API_PLATFORM_OPERATION_08_재발방지` / `SCR_PLATFORM_OPERATION_08_재발방지`
- 경로: `/work/platform-operation/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PLATFORM_OPERATION_08_재발방지`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 개인정보 열람·정정·삭제·처리정지 (`PRIVACY_RIGHTS`)

- 담당 액터: `PRIVACY_OFFICER`
- 영역: `IDENTITY` / 위험: `HIGH`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY

#### 1. 권리 요청

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_PRIVACY_RIGHTS_01_권리_요청` / `API_PRIVACY_RIGHTS_01_권리_요청` / `SCR_PRIVACY_RIGHTS_01_권리_요청`
- 경로: `/work/privacy-rights/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PRIVACY_RIGHTS_01_권리_요청`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 본인확인

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_PRIVACY_RIGHTS_02_본인확인` / `API_PRIVACY_RIGHTS_02_본인확인` / `SCR_PRIVACY_RIGHTS_02_본인확인`
- 경로: `/work/privacy-rights/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PRIVACY_RIGHTS_02_본인확인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 대상 정보 검색

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_PRIVACY_RIGHTS_03_대상_정보_검색` / `API_PRIVACY_RIGHTS_03_대상_정보_검색` / `SCR_PRIVACY_RIGHTS_03_대상_정보_검색`
- 경로: `/work/privacy-rights/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PRIVACY_RIGHTS_03_대상_정보_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 법적 예외 검토

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_PRIVACY_RIGHTS_04_법적_예외_검토` / `API_PRIVACY_RIGHTS_04_법적_예외_검토` / `SCR_PRIVACY_RIGHTS_04_법적_예외_검토`
- 경로: `/work/privacy-rights/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PRIVACY_RIGHTS_04_법적_예외_검토`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 승인·처리

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_PRIVACY_RIGHTS_05_승인_처리` / `API_PRIVACY_RIGHTS_05_승인_처리` / `SCR_PRIVACY_RIGHTS_05_승인_처리`
- 경로: `/work/privacy-rights/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PRIVACY_RIGHTS_05_승인_처리`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 결과 통지

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_PRIVACY_RIGHTS_06_결과_통지` / `API_PRIVACY_RIGHTS_06_결과_통지` / `SCR_PRIVACY_RIGHTS_06_결과_통지`
- 경로: `/work/privacy-rights/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PRIVACY_RIGHTS_06_결과_통지`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 증적 보존

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_PRIVACY_RIGHTS_07_증적_보존` / `API_PRIVACY_RIGHTS_07_증적_보존` / `SCR_PRIVACY_RIGHTS_07_증적_보존`
- 경로: `/work/privacy-rights/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_PRIVACY_RIGHTS_07_증적_보존`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 보안·개인정보 사고 대응 (`SECURITY_INCIDENT`)

- 담당 액터: `SECURITY_ADMIN`
- 영역: `PLATFORM` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY, RULE-PRIVACY-SAFETY

#### 1. 탐지·신고

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_01_탐지_신고` / `API_SECURITY_INCIDENT_01_탐지_신고` / `SCR_SECURITY_INCIDENT_01_탐지_신고`
- 경로: `/work/security-incident/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_01_탐지_신고`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 분류·초동조치

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_02_분류_초동조치` / `API_SECURITY_INCIDENT_02_분류_초동조치` / `SCR_SECURITY_INCIDENT_02_분류_초동조치`
- 경로: `/work/security-incident/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_02_분류_초동조치`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 영향범위 조사

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_03_영향범위_조사` / `API_SECURITY_INCIDENT_03_영향범위_조사` / `SCR_SECURITY_INCIDENT_03_영향범위_조사`
- 경로: `/work/security-incident/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_03_영향범위_조사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 접근차단·보존

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_04_접근차단_보존` / `API_SECURITY_INCIDENT_04_접근차단_보존` / `SCR_SECURITY_INCIDENT_04_접근차단_보존`
- 경로: `/work/security-incident/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_04_접근차단_보존`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 통지·신고 판단

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_05_통지_신고_판단` / `API_SECURITY_INCIDENT_05_통지_신고_판단` / `SCR_SECURITY_INCIDENT_05_통지_신고_판단`
- 경로: `/work/security-incident/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_05_통지_신고_판단`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 복구

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_06_복구` / `API_SECURITY_INCIDENT_06_복구` / `SCR_SECURITY_INCIDENT_06_복구`
- 경로: `/work/security-incident/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_06_복구`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 원인분석·재발방지

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_07_원인분석_재발방지` / `API_SECURITY_INCIDENT_07_원인분석_재발방지` / `SCR_SECURITY_INCIDENT_07_원인분석_재발방지`
- 경로: `/work/security-incident/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_07_원인분석_재발방지`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 8. 감사

- 상태: `S07_DONE` → `S08_DONE`
- 명령/API/화면: `CMD_SECURITY_INCIDENT_08_감사` / `API_SECURITY_INCIDENT_08_감사` / `SCR_SECURITY_INCIDENT_08_감사`
- 경로: `/work/security-incident/8`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_SECURITY_INCIDENT_08_감사`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

### 감사·법정자료 제출 (`AUDIT_EXPORT`)

- 담당 액터: `AUDITOR`
- 영역: `PLATFORM` / 위험: `MEDIUM`
- 시작: 필요한 사용자·기업·프로젝트 문맥과 담당 액터 배정이 유효하다.
- 완료: 최종 상태, 업무 산출물, 감사 증적과 후속 업무가 모두 확정되었다.
- 근거: LAW-PRIVACY, LAW-E-DOCUMENT

#### 1. 감사범위·권한 승인

- 상태: `READY` → `S01_DONE`
- 명령/API/화면: `CMD_AUDIT_EXPORT_01_감사범위_권한_승인` / `API_AUDIT_EXPORT_01_감사범위_권한_승인` / `SCR_AUDIT_EXPORT_01_감사범위_권한_승인`
- 경로: `/work/audit-export/1`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_AUDIT_EXPORT_01_감사범위_권한_승인`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 2. 로그·증적 검색

- 상태: `S01_DONE` → `S02_DONE`
- 명령/API/화면: `CMD_AUDIT_EXPORT_02_로그_증적_검색` / `API_AUDIT_EXPORT_02_로그_증적_검색` / `SCR_AUDIT_EXPORT_02_로그_증적_검색`
- 경로: `/work/audit-export/2`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_AUDIT_EXPORT_02_로그_증적_검색`
- 검색 팝업: 빈 검색 허용, 테넌트·프로젝트·상태·분류·유효일 필터, 20건 페이지 처리
- 후보 정렬: exactNormalizedName, exactAlias, prefix, tokenSimilarity, domainPriority, recentUse
- 선택 반환값: canonicalId, displayName, version, unit, source, validity, confidence, reason
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 3. 무결성 검증

- 상태: `S02_DONE` → `S03_DONE`
- 명령/API/화면: `CMD_AUDIT_EXPORT_03_무결성_검증` / `API_AUDIT_EXPORT_03_무결성_검증` / `SCR_AUDIT_EXPORT_03_무결성_검증`
- 경로: `/work/audit-export/3`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_AUDIT_EXPORT_03_무결성_검증`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 4. 예외·위반 분석

- 상태: `S03_DONE` → `S04_DONE`
- 명령/API/화면: `CMD_AUDIT_EXPORT_04_예외_위반_분석` / `API_AUDIT_EXPORT_04_예외_위반_분석` / `SCR_AUDIT_EXPORT_04_예외_위반_분석`
- 경로: `/work/audit-export/4`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_AUDIT_EXPORT_04_예외_위반_분석`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 5. 보고서 작성

- 상태: `S04_DONE` → `S05_DONE`
- 명령/API/화면: `CMD_AUDIT_EXPORT_05_보고서_작성` / `API_AUDIT_EXPORT_05_보고서_작성` / `SCR_AUDIT_EXPORT_05_보고서_작성`
- 경로: `/work/audit-export/5`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_AUDIT_EXPORT_05_보고서_작성`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 6. 제출·열람통제

- 상태: `S05_DONE` → `S06_DONE`
- 명령/API/화면: `CMD_AUDIT_EXPORT_06_제출_열람통제` / `API_AUDIT_EXPORT_06_제출_열람통제` / `SCR_AUDIT_EXPORT_06_제출_열람통제`
- 경로: `/work/audit-export/6`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_AUDIT_EXPORT_06_제출_열람통제`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

#### 7. 보존·파기

- 상태: `S06_DONE` → `S07_DONE`
- 명령/API/화면: `CMD_AUDIT_EXPORT_07_보존_파기` / `API_AUDIT_EXPORT_07_보존_파기` / `SCR_AUDIT_EXPORT_07_보존_파기`
- 경로: `/work/audit-export/7`
- 필수 섹션: contextSummary, decisionInformation, workInput, validationResult, evidenceHistory, actions
- 화면 상태: loading, ready, empty, validationError, permissionDenied, conflict, offline, completed
- 완료조건: requiredFieldsValid, businessRulesPass, evidencePersisted, stateTransitionCommitted, auditEventCommitted
- 오류·복구: VALIDATION_FAILED, AUTHORITY_DENIED, CONFLICT, INTEGRATION_FAILED; `ROLLBACK_AUDIT_EXPORT_07_보존_파기`
- 테스트: 42건 (ACCESSIBILITY, AUDIT, AUTHORITY, CONCURRENCY, DEADLINE, HAPPY_PATH, IDEMPOTENCY, INTEGRATION, ISOLATION, PRIVACY, RECOVERY, STATE, VALIDATION)

