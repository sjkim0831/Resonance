CREATE TABLE IF NOT EXISTS framework_project_registration_requirement (
    requirement_code varchar(80) PRIMARY KEY,
    requirement_group varchar(60) NOT NULL,
    requirement_name varchar(200) NOT NULL,
    mandatory boolean NOT NULL DEFAULT true,
    lifecycle_phase varchar(30) NOT NULL DEFAULT 'CREATE',
    implementation_status varchar(30) NOT NULL
        CHECK (implementation_status IN ('SUPPORTED', 'PARTIAL', 'MISSING', 'NOT_APPLICABLE')),
    target_route varchar(400),
    management_route varchar(400),
    data_owner varchar(200),
    common_code_group varchar(80),
    actor_codes text NOT NULL DEFAULT '',
    acceptance_criteria text NOT NULL,
    implementation_note text NOT NULL DEFAULT '',
    sort_order integer NOT NULL,
    updated_at timestamp NOT NULL DEFAULT current_timestamp
);

INSERT INTO framework_project_registration_requirement
(requirement_code, requirement_group, requirement_name, mandatory, lifecycle_phase,
 implementation_status, target_route, management_route, data_owner, common_code_group,
 actor_codes, acceptance_criteria, implementation_note, sort_order)
VALUES
('PRJ_BASIC_NAME','01 기본정보','프로젝트명·설명',true,'CREATE','SUPPORTED','/emission/project/create','/admin/emission/project-operations','emission_project_registry',null,'COMPANY_MANAGER','중복되지 않는 프로젝트 식별정보를 저장한다.','현재 생성·운영 화면 재사용',101),
('PRJ_BASIC_TYPE','01 기본정보','프로젝트 유형·보고 목적',true,'CREATE','PARTIAL','/emission/project/create','/admin/system/common-code','emission_project_registry','EMISSION_PROJECT_TYPE','COMPANY_MANAGER','유형과 보고 목적을 공통코드로 저장한다.','공통코드와 생성 화면 연결 필요',102),
('PRJ_BASIC_SCHEDULE','01 기본정보','보고연도·산정기간·단계별 마감',true,'CREATE','PARTIAL','/emission/project/create','/admin/emission/project-operations','emission_project_registry',null,'COMPANY_MANAGER','수집·검증·보고 마감이 Task에 반영된다.','산정기간 외 단계별 마감 보강 필요',103),
('PRJ_BASIC_TEMPLATE','01 기본정보','템플릿·이전 프로젝트 복사',false,'CREATE','PARTIAL','/emission/project/create','/admin/emission/input-template','emission_project_registry',null,'COMPANY_MANAGER','승인된 템플릿 또는 이전 버전으로 초기화한다.','복사 API와 생성 마법사 연결 필요',104),

('PRJ_ORG_COMPANY','02 조직경계','기업·법인·조직·부서',true,'CREATE','PARTIAL','/emission/project/create','/admin/company/company_list','company,department',null,'COMPANY_MANAGER','로그인 테넌트의 조직만 선택한다.','회원·기업과 프로젝트 연결 보강 필요',201),
('PRJ_ORG_SITE','02 조직경계','사업장·국가·주소',true,'CREATE','SUPPORTED','/emission/project/create','/admin/emission/site-management','emission_project_site',null,'COMPANY_MANAGER,SITE_DATA_OWNER','등록 사업장과 프로젝트 범위를 연결한다.','기존 사업장 기준정보 재사용',202),
('PRJ_ORG_BOUNDARY','02 조직경계','지분율·재무통제·운영통제 방식',true,'SETTINGS','MISSING','/emission/project/settings','/admin/emission/project-registration-policy','emission_project_boundary','ORG_BOUNDARY_METHOD','COMPANY_MANAGER','조직경계 방식과 적용 근거를 버전 관리한다.','프로젝트 설정과 정책 관리 화면 필요',203),
('PRJ_ORG_INCLUDE','02 조직경계','포함·제외 조직과 제외 사유',true,'SETTINGS','MISSING','/emission/project/settings','/admin/emission/project-registration-policy','emission_project_boundary_member','EXCLUSION_REASON','COMPANY_MANAGER,VERIFIER','포함·제외 목록과 사유를 감사 이력에 남긴다.','경계 편집 기능 필요',204),

('PRJ_SCOPE_SELECT','03 산정범위','Scope 1·2·3 선택',true,'CREATE','SUPPORTED','/emission/project/create','/admin/emission/definition-studio','emission_project_registry','EMISSION_SCOPE','COMPANY_MANAGER','한 개 이상의 Scope와 적용 범위를 저장한다.','현재 생성 화면 재사용',301),
('PRJ_SCOPE_CATEGORY','03 산정범위','Scope별 배출원·Scope 3 카테고리',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/definition-studio','emission_project_scope_category','EMISSION_CATEGORY','COMPANY_MANAGER,CALCULATOR','포함 카테고리를 자료 수집계획과 연결한다.','배출 정의와 프로젝트 선택 연결 필요',302),
('PRJ_SCOPE_EXCLUSION','03 산정범위','범위 제외 사유·중요성 기준',true,'SETTINGS','MISSING','/emission/project/settings','/admin/emission/project-registration-policy','emission_project_scope_policy','MATERIALITY_LEVEL','COMPANY_MANAGER,VERIFIER','제외 사유와 중요성 판단 근거를 보존한다.','정책 편집 기능 필요',303),
('PRJ_SCOPE2_METHOD','03 산정범위','Scope 2 위치기반·시장기반',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/definition-studio','emission_project_scope_policy','SCOPE2_METHOD','CALCULATOR','산정 방식별 계수 적용 기준을 저장한다.','방식 공통코드 연결 필요',304),

('PRJ_METHOD_STANDARD','04 산정기준','규정·표준·방법론·버전',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/definition-studio','emission_project_methodology','EMISSION_STANDARD','CALCULATOR,VERIFIER','적용 표준과 버전을 프로젝트에 고정한다.','정의 스튜디오와 프로젝트 연결 필요',401),
('PRJ_METHOD_FACTOR','04 산정기준','배출계수 DB·연도·버전',true,'SETTINGS','SUPPORTED','/emission/simulate','/admin/emission/ecoinvent','emission_factor_mapping','FACTOR_SOURCE','CALCULATOR','계수 출처와 버전을 재현할 수 있다.','기존 매핑·ecoinvent 기능 재사용',402),
('PRJ_METHOD_GWP','04 산정기준','GWP·IPCC 평가보고서 버전',true,'SETTINGS','SUPPORTED','/emission/simulate','/admin/emission/gwp-values','emission_gwp_value','GWP_VERSION','CALCULATOR','프로젝트 GWP 기준과 계산 버전을 포함한다.','기존 GWP 관리 기능 재사용',403),
('PRJ_METHOD_UNIT','04 산정기준','단위·환산·반올림·유효숫자',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/definition-studio','emission_project_calculation_policy','UNIT_POLICY','CALCULATOR','모든 계산에 동일한 환산·반올림 규칙을 적용한다.','프로젝트 정책 연결 필요',404),
('PRJ_METHOD_QUALITY','04 산정기준','불확도·데이터 품질·재산정 정책',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/validation-rule','emission_project_quality_policy','DATA_QUALITY_GRADE','VERIFIER','품질과 재산정 임계값을 검증 규칙에 반영한다.','검증 규칙과 프로젝트 연결 필요',405),

('PRJ_DATA_ITEMS','05 수집계획','활동자료 항목·형식·단위',true,'SETTINGS','SUPPORTED','/emission/data_input','/admin/emission/survey-admin-data','emission_project_activity','EMISSION_INPUT_ITEM','SITE_DATA_OWNER','수집 대상과 필수 단위를 데이터셋에 반영한다.','기존 입력·업로드 화면 재사용',501),
('PRJ_DATA_ASSIGN','05 수집계획','사업장별 담당자·주기·마감',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/project-operations','emission_project_activity_request','COLLECTION_CYCLE','COMPANY_MANAGER,SITE_DATA_OWNER','사업장별 제출 Task와 마감을 생성한다.','자료 요청과 생성 화면 연결 필요',502),
('PRJ_DATA_EVIDENCE','05 수집계획','자료 출처·필수 증빙·외부 연계',true,'SETTINGS','SUPPORTED','/emission/data_input','/admin/emission/survey-admin-data','emission_project_activity,evidence','EVIDENCE_TYPE','SITE_DATA_OWNER,VERIFIER','활동자료에 원본 증빙과 출처를 연결한다.','기존 증빙·외부 연계 재사용',503),
('PRJ_DATA_ESCALATION','05 수집계획','미제출 알림·지연·에스컬레이션',true,'SETTINGS','PARTIAL','/emission/deadline-status','/admin/emission/project-operations','emission_project_task','ESCALATION_POLICY','COMPANY_MANAGER,SITE_DATA_OWNER','지연 시 담당자와 상위 액터에게 알림 Task를 생성한다.','Task 정책 연결 필요',504),

('PRJ_ACTOR_OWNER','06 액터·권한','책임자·자료·산정·검증·승인 액터',true,'CREATE','SUPPORTED','/emission/project/create','/admin/auth/group','framework_account_actor_assignment',null,'COMPANY_MANAGER,SITE_DATA_OWNER,CALCULATOR,VERIFIER,APPROVER','프로젝트별 액터 배정과 Task 권한을 생성한다.','기존 액터·권한그룹 재사용',601),
('PRJ_ACTOR_SEGREGATION','06 액터·권한','산정·검증·승인 업무 분리',true,'CREATE','PARTIAL','/emission/project/create','/admin/auth/group','framework_account_actor_assignment','SEGREGATION_POLICY','CALCULATOR,VERIFIER,APPROVER','동일 액터의 상충 역할 배정을 서버에서 차단한다.','서버 강제 검증 보강 필요',602),
('PRJ_ACTOR_SCOPE','06 액터·권한','데이터 범위·명령·대리 권한',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/permissions','framework_account_actor_assignment','DATA_SCOPE','COMPANY_MANAGER','사업장·데이터·명령 범위와 대리기간을 적용한다.','권한 화면과 프로젝트 연결 필요',603),

('PRJ_VERIFY_RULE','07 검증·승인','검증 규칙 세트·차단 오류',true,'SETTINGS','SUPPORTED','/emission/validate','/admin/emission/validation-rule','emission_project_quality_issue','VALIDATION_RULE_SET','VERIFIER','필수·이상치·중복·단위 오류를 검증한다.','기존 검증 화면 재사용',701),
('PRJ_VERIFY_LINE','07 검증·승인','검증자·승인자·승인 단계',true,'SETTINGS','SUPPORTED','/emission/validate','/admin/emission/approval-workflow','emission_project_submission','APPROVAL_LINE','VERIFIER,APPROVER','검증과 승인 상태 전이를 권한 계약에 따라 수행한다.','기존 승인 워크플로 재사용',702),
('PRJ_VERIFY_CORRECTION','07 검증·승인','반려·보완·재제출·재산정',true,'EXECUTION','PARTIAL','/emission/validate','/admin/emission/project-operations','emission_project_quality_issue','CORRECTION_REASON','SITE_DATA_OWNER,CALCULATOR,VERIFIER','반려 사유부터 재제출 결과까지 추적한다.','Task와 변경이력 연결 보강 필요',703),

('PRJ_REPORT_PLAN','08 보고·제출','보고서 유형·언어·제출기관·기한',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/report-template','emission_project_report_plan','REPORT_TYPE','COMPANY_MANAGER,APPROVER','보고 유형별 양식·언어·기한을 고정한다.','보고서 양식과 프로젝트 연결 필요',801),
('PRJ_REPORT_SECURITY','08 보고·제출','공개범위·보존·다운로드 권한',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/security/policy','emission_project_security_policy','SECURITY_GRADE','COMPANY_MANAGER','공개·보존·다운로드 정책을 서버에서 적용한다.','보안 정책 연결 필요',802),
('PRJ_REPORT_VERIFY','08 보고·제출','진위 확인·데이터셋·시각지문',true,'EXECUTION','SUPPORTED','/home/certificate-verify','/admin/emission/survey-report-verify','emission_report_verification',null,'APPROVER,AUDITOR','보고서 원본 데이터와 진위 확인 결과를 재현한다.','기존 PDF·OCR·진위 확인 재사용',803),

('PRJ_TARGET_BASELINE','09 기준선·목표','기준연도·기준 배출량·목표',false,'SETTINGS','PARTIAL','/emission/project/settings','/admin/emission/reduction-target','emission_project_target','TARGET_TYPE','COMPANY_MANAGER','기준선과 목표의 근거·버전을 저장한다.','감축 목표와 프로젝트 연결 필요',901),
('PRJ_TARGET_MEASURE','09 기준선·목표','감축 과제·예상 효과·실적',false,'EXECUTION','PARTIAL','/emission/reduction','/admin/emission/reduction-task','emission_reduction_task','REDUCTION_MEASURE','COMPANY_MANAGER,CALCULATOR','과제의 예상·실제 감축량을 프로젝트 결과와 연결한다.','감축 과제 연결 필요',902),

('PRJ_AUDIT_REASON','10 감사·보안','변경사유·버전·확정·재개방',true,'EXECUTION','SUPPORTED','/emission/project_list','/admin/emission/audit-log','emission_project_audit',null,'COMPANY_MANAGER,VERIFIER,APPROVER,AUDITOR','중요 변경과 상태 전이를 행위자·시각과 기록한다.','기존 감사 로그 재사용',1001),
('PRJ_AUDIT_RETENTION','10 감사·보안','보존기간·보안등급·외부 공유',true,'SETTINGS','PARTIAL','/emission/project/settings','/admin/security/policy','emission_project_security_policy','SECURITY_GRADE','COMPANY_MANAGER','보존·공유·출력·API 정책을 서버에서 집행한다.','보안 정책 연결 필요',1002)
ON CONFLICT (requirement_code) DO UPDATE SET
 requirement_group=excluded.requirement_group,
 requirement_name=excluded.requirement_name,
 mandatory=excluded.mandatory,
 lifecycle_phase=excluded.lifecycle_phase,
 implementation_status=excluded.implementation_status,
 target_route=excluded.target_route,
 management_route=excluded.management_route,
 data_owner=excluded.data_owner,
 common_code_group=excluded.common_code_group,
 actor_codes=excluded.actor_codes,
 acceptance_criteria=excluded.acceptance_criteria,
 implementation_note=excluded.implementation_note,
 sort_order=excluded.sort_order,
 updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_project_registration_coverage AS
SELECT r.*,
       CASE implementation_status
           WHEN 'SUPPORTED' THEN 100
           WHEN 'PARTIAL' THEN 50
           WHEN 'NOT_APPLICABLE' THEN 100
           ELSE 0
       END AS coverage_score,
       CASE
           WHEN implementation_status = 'MISSING' THEN 'CREATE'
           WHEN implementation_status = 'PARTIAL' THEN 'CONNECT_OR_REPAIR'
           ELSE 'REUSE_AND_TEST'
       END AS recommended_action
FROM framework_project_registration_requirement r;
