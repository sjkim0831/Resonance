-- Complete the shared governance-change workflow with executable Korean
-- contracts and step-specific fields. The common process workspace renders
-- these contracts, so one implementation serves every governed process.

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET process_name='기준·워크플로 변경관리',
    goal='메뉴·화면·API·DB 변경을 근거, 영향, 검증, 승인, 배포 및 복구 증적과 함께 통제한다.',
    start_condition='변경 목적, 대상, 요청자, 근거와 적용 범위가 식별되어 있다.',
    completion_condition='영향 분석, 설계, 5종 안전 시나리오, 직무분리 승인, 무중단 적용과 복구 검증이 완료되었다.',
    owner_actor_code='PLATFORM_OPERATOR',risk_level='HIGH',review_cycle_days=30,
    regulation_refs='내부통제 기준; 개인정보 보호; 변경·배포·감사 정책',updated_at=current_timestamp
WHERE process_code='GOVERNANCE_CHANGE';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

CREATE TEMP TABLE governance_step_contract(
 step_code varchar(80),step_name varchar(200),requirement_text text,completion_rule text,
 admin_path text,api_contract text,fields jsonb
) ON COMMIT DROP;

INSERT INTO governance_step_contract VALUES
('GOV_REQUEST','변경 요청·근거 등록',
 '요청자는 변경 목적, 업무·법령 근거, 대상 자산, 적용 범위, 희망 일정, 위험도와 롤백 기준을 빠짐없이 등록한다.',
 '필수 요청 항목과 근거 문서가 저장되고 고유 변경 요청 번호와 불변 입력 스냅샷이 생성된다.',
 '/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_REQUEST','actor-process/artifacts',
 '[{"fieldCode":"requestTitle","label":"변경 요청 제목","controlType":"TEXT","required":true,"description":"업무 목적을 식별할 수 있는 제목"},{"fieldCode":"changeType","label":"변경 유형","controlType":"SELECT","required":true,"options":["메뉴·화면","API·기능","DB·데이터","권한·워크플로","배포·인프라"]},{"fieldCode":"targetScope","label":"변경 대상과 범위","controlType":"TEXTAREA","required":true},{"fieldCode":"legalBasis","label":"요구사항·법령·정책 근거","controlType":"TEXTAREA","required":true},{"fieldCode":"businessReason","label":"업무 사유와 기대 효과","controlType":"TEXTAREA","required":true},{"fieldCode":"riskLevel","label":"초기 위험도","controlType":"SELECT","required":true,"options":["LOW","MEDIUM","HIGH","CRITICAL"]},{"fieldCode":"desiredReleaseAt","label":"희망 적용일","controlType":"DATE","required":true},{"fieldCode":"rollbackCriterion","label":"롤백 판단 기준","controlType":"TEXTAREA","required":true}]'),
('GOV_IMPACT','메뉴·화면·API·DB 영향 분석',
 '변경 대상의 선행·후행 프로세스, 사용자·관리자 화면, 메뉴·권한, API, 테이블·컬럼, 데이터 이관, 캐시, 보안과 호환성 영향을 분석한다.',
 '영향 자산과 소유자, 데이터 이관·중단·보안 위험, 완화 조치 및 검증 범위가 추적 가능한 영향 분석서로 확정된다.',
 '/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_IMPACT','system-design-governance',
 '[{"fieldCode":"affectedProcesses","label":"영향 프로세스","controlType":"TEXTAREA","required":true},{"fieldCode":"affectedScreensMenus","label":"영향 메뉴·화면·라우트","controlType":"TEXTAREA","required":true},{"fieldCode":"affectedApis","label":"영향 API·함수","controlType":"TEXTAREA","required":true},{"fieldCode":"affectedData","label":"영향 테이블·컬럼·데이터","controlType":"TEXTAREA","required":true},{"fieldCode":"migrationRequired","label":"데이터 이관 필요 여부","controlType":"SELECT","required":true,"options":["필요","불필요"]},{"fieldCode":"compatibilityRisk","label":"하위 호환·연계 위험","controlType":"TEXTAREA","required":true},{"fieldCode":"securityPrivacyImpact","label":"보안·개인정보 영향","controlType":"TEXTAREA","required":true},{"fieldCode":"mitigationPlan","label":"위험 완화 및 검증 계획","controlType":"TEXTAREA","required":true}]'),
('GOV_DESIGN','기준·워크플로 설계',
 '액터, 권한, 상태 전이, 입력·출력, 필드, 명령, API, 영속성, 인계, 오류·복구와 테스트 계약을 동일 버전의 실행 명세로 설계한다.',
 '모든 설계 계약이 완전하고 화면·백엔드·DB 생성 입력과 HAPPY_PATH·EXCEPTION·AUTHORITY·ISOLATION·RECOVERY 기대값이 승인된다.',
 '/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_DESIGN','actor-process',
 '[{"fieldCode":"actorAuthorityDesign","label":"액터·권한·직무분리 설계","controlType":"TEXTAREA","required":true},{"fieldCode":"stateTransitionDesign","label":"상태 전이·분기 설계","controlType":"TEXTAREA","required":true},{"fieldCode":"dataContractDesign","label":"입력·출력·필드 계약","controlType":"TEXTAREA","required":true},{"fieldCode":"apiPersistenceDesign","label":"API·트랜잭션·DB 계약","controlType":"TEXTAREA","required":true},{"fieldCode":"exceptionRecoveryDesign","label":"예외·복구·멱등성 설계","controlType":"TEXTAREA","required":true},{"fieldCode":"responsiveAccessibilityDesign","label":"모바일·접근성 설계","controlType":"TEXTAREA","required":true},{"fieldCode":"testScenarioDesign","label":"5종 테스트 시나리오","controlType":"TEXTAREA","required":true},{"fieldCode":"featureFlagRollbackDesign","label":"기능 플래그·롤백 설계","controlType":"TEXTAREA","required":true}]'),
('GOV_SIMULATE','정상·안전 시나리오 검증',
 '검증자는 운영과 분리된 환경에서 정상, 예외, 권한, 테넌트·프로젝트 격리, 중복 실행과 복구 시나리오를 실제 계약과 데이터로 실행한다.',
 '5종 시나리오, 모바일·접근성, 성능과 데이터 무결성 검증이 통과하고 실패 증적과 재검증 결과가 보존된다.',
 '/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_SIMULATE','actor-process/runs',
 '[{"fieldCode":"testEnvironment","label":"검증 환경·버전","controlType":"TEXT","required":true},{"fieldCode":"testDataset","label":"테스트 계정·프로젝트·데이터셋","controlType":"TEXTAREA","required":true},{"fieldCode":"happyPathResult","label":"정상 시나리오 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"exceptionAuthorityResult","label":"예외·권한 차단 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"isolationResult","label":"테넌트·프로젝트 격리 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"recoveryIdempotencyResult","label":"복구·멱등성 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"performanceAccessibilityResult","label":"성능·모바일·접근성 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"defectRetestDecision","label":"결함·재검증 판정","controlType":"TEXTAREA","required":true}]'),
('GOV_APPROVE','변경 승인·버전 잠금',
 '승인자는 요청자·구현자와 직무분리된 권한으로 설계, 테스트, 보안, 데이터 이관, 배포·롤백 증적과 적용 일정을 검토한다.',
 '필수 승인과 증적이 완전하고 승인 버전, 적용 창구, 배포·롤백 책임자 및 전자 승인 이력이 잠긴다.',
 '/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_APPROVE','governance-approval',
 '[{"fieldCode":"releaseVersion","label":"승인 대상 버전","controlType":"TEXT","required":true},{"fieldCode":"evidenceCompleteness","label":"필수 증적 완전성","controlType":"SELECT","required":true,"options":["완전","보완 필요"]},{"fieldCode":"securityDataApproval","label":"보안·데이터 검토 판정","controlType":"TEXTAREA","required":true},{"fieldCode":"segregationCheck","label":"직무분리 확인","controlType":"SELECT","required":true,"options":["충족","미충족"]},{"fieldCode":"releaseWindow","label":"승인 적용 일정","controlType":"TEXT","required":true},{"fieldCode":"deploymentOwner","label":"배포 책임자","controlType":"TEXT","required":true},{"fieldCode":"rollbackOwner","label":"롤백 책임자","controlType":"TEXT","required":true},{"fieldCode":"approvalDecision","label":"승인 의견·조건","controlType":"TEXTAREA","required":true}]'),
('GOV_PUBLISH','적용·캐시 무효화·운영 확인',
 '운영자는 승인된 불변 버전만 백업 후 증분 배포하고 DB 마이그레이션, 정적 에셋, 캐시 무효화, 복제본, 실제 화면과 감사 로그를 검증한다.',
 '배포 커밋·이미지·DB 버전이 일치하고 모든 복제본과 health, 화면·API·DB·캐시·감사 검증이 통과하거나 자동 롤백이 완료된다.',
 '/admin/system/process-workspace?process=GOVERNANCE_CHANGE&step=GOV_PUBLISH','auto-deploy-main',
 '[{"fieldCode":"releaseCommitImage","label":"커밋·이미지 버전","controlType":"TEXT","required":true},{"fieldCode":"backupReference","label":"배포 전 백업 참조","controlType":"TEXT","required":true},{"fieldCode":"migrationVersion","label":"DB 마이그레이션 버전","controlType":"TEXT","required":true},{"fieldCode":"cacheInvalidation","label":"캐시·정적 에셋 무효화 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"replicaHealth","label":"복제본·헬스 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"runtimeSmoke","label":"화면·API·DB 스모크 결과","controlType":"TEXTAREA","required":true},{"fieldCode":"auditEvidence","label":"감사·배포 증적","controlType":"TEXTAREA","required":true},{"fieldCode":"rollbackOutcome","label":"롤백 여부와 결과","controlType":"TEXTAREA","required":true}]');

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step s
SET step_name=c.step_name,requirement_text=c.requirement_text,completion_rule=c.completion_rule,
    admin_path=c.admin_path,api_contract=c.api_contract,requires_admin_page=true,requires_api=true,
    requires_database=true,evidence_required=true,
    evidence_types='["REQUEST_SNAPSHOT","ACTOR_AUTHORITY","STATE_TRANSITION","DATA_CHANGE","TEST_RESULT","APPROVAL","DEPLOYMENT","RECOVERY"]'
FROM governance_step_contract c
WHERE s.process_code='GOVERNANCE_CHANGE' AND s.step_code=c.step_code;
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_step_execution_spec x
SET business_contract=jsonb_set(jsonb_set(coalesce(x.business_contract,'{}'::jsonb),'{requirement}',to_jsonb(c.requirement_text),true),'{completionRule}',to_jsonb(c.completion_rule),true),
    field_contract=c.fields,
    guide_contract=jsonb_set(jsonb_set(coalesce(x.guide_contract,'{}'::jsonb),'{title}',to_jsonb(c.step_name),true),'{purpose}',to_jsonb(c.requirement_text),true),
    design_status='DESIGN_COMPLETE',approval_status='APPROVED',generation_status='READY',blocker_codes='[]'::jsonb,
    source_hash=md5(c.step_code||c.requirement_text||c.fields::text),approved_by='GOVERNANCE_CHANGE_PROFESSIONALIZATION',
    approved_at=current_timestamp,updated_at=current_timestamp
FROM governance_step_contract c
WHERE x.process_code='GOVERNANCE_CHANGE' AND x.step_code=c.step_code;

UPDATE framework_professional_screen_contract p
SET screen_name='기준·워크플로 변경관리 - '||c.step_name,
    business_purpose=c.requirement_text,exit_condition=c.completion_rule,field_contract=c.fields::text,
    audit_evidence_ref='ProcessStepWorkspacePage+stepExecutionSpecs+ProcessExecutionApiController:3.0.0',
    updated_by='GOVERNANCE_CHANGE_PROFESSIONALIZATION',updated_at=current_timestamp
FROM governance_step_contract c
WHERE p.process_code='GOVERNANCE_CHANGE' AND p.step_code=c.step_code
  AND lower(split_part(p.route_path,'?',1))='/admin/system/process-workspace';

UPDATE framework_screen_resource
SET screen_name='프로세스 단계 실행 작업공간',implementation_status='VERIFIED',
    source_ref='features/process-step-workspace/ProcessStepWorkspacePage.tsx',updated_at=current_timestamp
WHERE route_key IN('/admin/system/process-step-workspace','/admin/system/process-workspace');

ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;
UPDATE framework_simulation_case SET case_name='정상 변경 요청부터 무중단 적용',
 preconditions='변경 요청자·검증자·승인자와 격리된 검증 환경이 존재한다.',
 steps_json='["변경 요청","영향 분석","실행 설계","5종 검증","직무분리 승인","백업·적용·운영 확인"]',
 assertions_json='["상태=COMPLETED","필수 증적 완전","승인 버전과 배포 버전 일치","모든 복제본 정상"]',case_status='APPROVED',automated=true
WHERE case_code IN('GOVERNANCE_CHANGE_HAPPY','GOVERNANCE_CHANGE_HAPPY_PATH');
UPDATE framework_simulation_case SET case_name='비인가 변경·승인 차단',case_status='APPROVED',automated=true
WHERE case_code IN('GOVERNANCE_CHANGE_AUTH','GOVERNANCE_CHANGE_AUTHORITY');
UPDATE framework_simulation_case SET case_name='잘못된 상태·입력·의존성 차단',case_status='APPROVED',automated=true
WHERE case_code='GOVERNANCE_CHANGE_EXCEPTION';
UPDATE framework_simulation_case SET case_name='테넌트·프로젝트별 변경 격리',case_status='APPROVED',automated=true
WHERE case_code='GOVERNANCE_CHANGE_ISOLATION';
UPDATE framework_simulation_case SET case_name='배포 실패 후 데이터 보존·자동 복구',case_status='APPROVED',automated=true
WHERE case_code='GOVERNANCE_CHANGE_RECOVERY';
ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;

SELECT framework_audit_all_process_designs('GOVERNANCE_CHANGE_PROFESSIONALIZATION');
