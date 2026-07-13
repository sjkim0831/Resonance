-- Every process receives the same non-negotiable delivery dimensions.
WITH dimensions(type_code,suffix,name_suffix,criteria) AS (VALUES
 ('MENU','MENU','메뉴·진입 경로','DB 메뉴·순서·URL·화면·권한·다국어가 단일 트랜잭션 등록되고 즉시 조회됨'),
 ('DESIGN','DESIGN','KRDS·반응형 디자인','공통 토큰·헤더·GNB를 사용하고 360·768·1280px 및 접근성 검증 완료'),
 ('PAGE','USER_PAGE','사용자 업무 화면','액터가 시작조건부터 완료조건까지 실제 데이터로 업무를 수행 가능'),
 ('PAGE','ADMIN_PAGE','관리자 대응 화면','운영자가 조회·검토·승인·복구·감사할 수 있음'),
 ('API','API','업무 API','입력검증·권한·트랜잭션·멱등성·오류계약·감사 추적 완료'),
 ('DATA','DATA','데이터 계약','테넌트·프로젝트 격리, 참조무결성, 버전·보존·삭제 정책 완료'),
 ('AUTHORITY','AUTH','액터·기능·데이터 권한','서버 최소권한과 교차 테넌트·프로젝트 차단 테스트 완료'),
 ('RULE','RULE','업무·검증 규칙','규칙 버전과 판정 근거가 저장되고 동일 입력 결과 재현 가능'),
 ('NOTIFICATION','NOTICE','알림·마감 정책','수신자·채널·중복방지·재시도·발송 결과 추적 완료'),
 ('AUDIT','AUDIT','감사·변경 이력','행위자·시각·전후값·사유·traceId가 변경 불가 이력으로 보존'),
 ('TEST','TEST_HAPPY','정상 시나리오','실제 계정·프로젝트·데이터로 처음부터 완료까지 통과'),
 ('TEST','TEST_SAFETY','예외·권한·격리·복구 시나리오','4종 안전 시나리오 통과와 증적 등록'),
 ('OPERATION','OPS','운영·관측·백업·복구','상태·오류·성능 관측과 백업·복구·무중단 배포 검증 완료')
)
INSERT INTO framework_process_artifact(process_code,artifact_code,artifact_type,artifact_name,contract_ref,owner_actor_code,acceptance_criteria,delivery_status,notes)
SELECT p.process_code,p.process_code||'-BASE-'||d.suffix,d.type_code,p.process_name||' · '||d.name_suffix,'process-baseline/'||lower(d.suffix),'PLATFORM_OPERATOR',d.criteria,'PLANNED','전 프로세스 공통 필수 산출물'
FROM framework_process_definition p CROSS JOIN dimensions d
ON CONFLICT(process_code,artifact_code) DO UPDATE SET artifact_type=excluded.artifact_type,artifact_name=excluded.artifact_name,acceptance_criteria=excluded.acceptance_criteria,updated_at=current_timestamp;

-- Actual primary page mappings already present in the application.
WITH routes(process_code,user_path,admin_path) AS (VALUES
 ('GOVERNANCE_CHANGE','/admin/system/actor-process','/admin/system/build-studio'),
 ('DATA_INTEGRATION','/emission/data_input','/admin/external/sync'),
 ('ACTIVITY_DATA','/emission/data_input','/admin/emission/survey-admin-data'),
 ('EMISSION_CALCULATION','/emission/simulate','/admin/emission/calculation-rule'),
 ('EMISSION_PROJECT','/emission/project/detail','/admin/emission/management'),
 ('LCA_EXECUTION','/admin/emission/survey-admin','/admin/emission/survey-admin-data'),
 ('REDUCTION_EXECUTION','/emission/reduction','/admin/emission/result_list'),
 ('REPORT_CERTIFICATION','/emission/report_submit','/admin/emission/survey-report')
)
UPDATE framework_process_artifact a SET target_path=case when a.artifact_code like '%USER_PAGE' then r.user_path else r.admin_path end,
 delivery_status='IMPLEMENTED',updated_at=current_timestamp
FROM routes r WHERE a.process_code=r.process_code AND a.artifact_code IN(r.process_code||'-BASE-USER_PAGE',r.process_code||'-BASE-ADMIN_PAGE');

-- First priority process: reference/standard/workflow change lifecycle.
DELETE FROM framework_process_step WHERE process_code='GOVERNANCE_CHANGE';
INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule,user_path,admin_path,api_contract)
SELECT 'GOVERNANCE_CHANGE',v.ord,v.code,v.name,v.actor,v.from_state,v.command,v.to_state,v.rule,v.user_path,v.admin_path,v.api_contract
FROM (VALUES
 (1,'GOV_REQUEST','변경 요청·근거 등록','PLATFORM_OPERATOR','DRAFT','REQUEST_CHANGE','IMPACT_REVIEW','요청 목적·대상·근거·영향 범위·롤백 기준이 등록됨','/admin/system/actor-process','/admin/system/actor-process','actor-process/artifacts'),
 (2,'GOV_IMPACT','메뉴·화면·API·DB 영향 분석','PLATFORM_OPERATOR','IMPACT_REVIEW','ANALYZE_IMPACT','DESIGNING','선행 프로세스와 모든 산출물 영향 및 마이그레이션 위험이 식별됨','/admin/system/design-governance','/admin/system/design-governance','system-design-governance'),
 (3,'GOV_DESIGN','기준·워크플로 설계','PLATFORM_OPERATOR','DESIGNING','SAVE_DESIGN','SIMULATION_READY','액터·단계·상태·완료조건·권한·데이터 계약과 5종 시나리오가 정의됨','/admin/system/actor-process','/admin/system/build-studio','actor-process'),
 (4,'GOV_SIMULATE','정상·안전 시나리오 검증','VERIFIER','SIMULATION_READY','RUN_SIMULATION','APPROVAL_READY','정상·예외·권한·격리·복구 테스트가 모두 승인됨','/admin/system/actor-process?process=GOVERNANCE_CHANGE','/admin/system/verification-center','actor-process/runs'),
 (5,'GOV_APPROVE','변경 승인·버전 잠금','APPROVER','APPROVAL_READY','APPROVE_CHANGE','APPROVED','검증 증적과 배포·롤백 계획을 승인하고 변경 버전을 잠금','/admin/system/actor-process','/admin/system/version','governance-approval'),
 (6,'GOV_PUBLISH','적용·캐시 무효화·운영 확인','PLATFORM_OPERATOR','APPROVED','PUBLISH_CHANGE','COMPLETED','백업 후 적용, 캐시 무효화, 2복제 health, 실제 화면·DB·감사로그 확인','/admin/system/build-studio','/admin/system/deploy','auto-deploy-main')
) v(ord,code,name,actor,from_state,command,to_state,rule,user_path,admin_path,api_contract)
JOIN framework_process_definition p ON p.process_code='GOVERNANCE_CHANGE';

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status)
SELECT v.case_code,'GOVERNANCE_CHANGE',v.case_name,v.case_type,v.preconditions,v.steps_json,v.assertions_json,'DRAFT'
FROM (VALUES
 ('GOVERNANCE_CHANGE_HAPPY','정상 변경 요청부터 무중단 적용','HAPPY_PATH','변경 요청자·검증자·승인자와 테스트 환경이 존재','["요청","영향분석","설계","시뮬레이션","승인","적용"]','["상태=COMPLETED","모든 산출물 VERIFIED","감사로그 존재"]'),
 ('GOVERNANCE_CHANGE_EXCEPTION','검증 실패 후 설계 보완','EXCEPTION','완료조건 또는 데이터 계약이 누락된 설계','["설계","검증실패","보완","재검증"]','["승인 차단","보완 전후 이력","재검증 통과 후만 승인"]'),
 ('GOVERNANCE_CHANGE_AUTH','비인가 변경·승인 차단','AUTHORITY','서로 다른 운영자·검증자·승인자 계정','["비인가 적용 시도","비인가 승인 시도","정상 승인"]','["비인가 403","직무분리","거부 시도 감사"]'),
 ('GOVERNANCE_CHANGE_ISOLATION','프로젝트별 설정 격리','ISOLATION','서로 다른 두 프로젝트 설정이 존재','["A 설정으로 B 변경 시도","A 정상 변경"]','["교차 변경 차단","A만 변경","캐시 키 격리"]'),
 ('GOVERNANCE_CHANGE_RECOVERY','적용 실패 후 자동 복구','RECOVERY','DB 백업과 이전 배포 버전이 존재','["적용 실패","트랜잭션 롤백","이전 버전 복구","재시도"]','["부분 적용 없음","데이터 보존","2복제 정상","실패 증적 보존"]')
) v(case_code,case_name,case_type,preconditions,steps_json,assertions_json)
JOIN framework_process_definition p ON p.process_code='GOVERNANCE_CHANGE'
ON CONFLICT(case_code) DO UPDATE SET case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status='DRAFT',updated_at=current_timestamp;
