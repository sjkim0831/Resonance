-- Normalize the first delivery process so the automation compiler can derive
-- DB/API/page/test jobs without relying on damaged legacy labels.
UPDATE framework_process_definition
SET process_name='탄소배출 프로젝트 수행',
    goal='프로젝트 생성부터 자료수집, 산정, 검증, 승인, 보고서 발급까지 감사 가능한 흐름으로 완료한다.',
    start_condition='기업, 사업장, 산정기간, Scope, 담당 액터와 마감일이 지정되어 있다.',
    completion_condition='승인된 산정 결과와 검증 가능한 보고서가 존재하고 모든 상태 전이와 증적이 기록되어 있다.',
    automation_mode='AUTOMATIC', updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT';

UPDATE framework_process_step SET
 step_name=CASE step_code
  WHEN 'EMISSION_PROJECT_SETUP' THEN '프로젝트 기본정보 및 책임 확정'
  WHEN 'EMISSION_PROJECT_COLLECT' THEN '활동자료·증빙 수집'
  WHEN 'EMISSION_PROJECT_CALCULATE' THEN '배출계수 매핑·배출량 산정'
  WHEN 'EMISSION_PROJECT_VALIDATE' THEN '데이터·산정 결과 검증'
  WHEN 'EMISSION_PROJECT_CORRECT' THEN '보완·재산정'
  WHEN 'EMISSION_PROJECT_APPROVE' THEN '검토·승인·확정'
  WHEN 'EMISSION_PROJECT_REPORT' THEN '보고서 생성·제출·진위 확인'
  ELSE step_name END,
 completion_rule=CASE step_code
  WHEN 'EMISSION_PROJECT_SETUP' THEN '조직·사업장·산정기간·Scope·단계별 책임자·마감일이 저장되고 프로젝트 상태가 자료수집 가능으로 전이된다.'
  WHEN 'EMISSION_PROJECT_COLLECT' THEN '필수 활동자료의 값·단위·기간·출처·증빙이 저장되고 누락 또는 보완 요청이 0건이다.'
  WHEN 'EMISSION_PROJECT_CALCULATE' THEN '모든 활동자료에 승인된 배출계수와 단위 환산 근거가 연결되고 계산식·버전·결과가 감사 이력과 함께 저장된다.'
  WHEN 'EMISSION_PROJECT_VALIDATE' THEN '필수값·이상치·중복·단위·배출계수 검증의 차단 오류가 0건이고 검증 증적이 존재한다.'
  WHEN 'EMISSION_PROJECT_CORRECT' THEN '모든 보완 요청에 조치 내용과 변경 사유가 기록되고 재산정·재검증을 통과한다.'
  WHEN 'EMISSION_PROJECT_APPROVE' THEN '검토 의견·승인 이력·확정 버전이 저장되고 승인 권한과 업무 분리가 검증된다.'
  WHEN 'EMISSION_PROJECT_REPORT' THEN '확정 데이터로 보고서가 발급되고 정규화 데이터셋·OCR·시각 지문으로 원본 진위 검증을 통과한다.'
  ELSE completion_rule END,
 requirement_text=CASE step_code
  WHEN 'EMISSION_PROJECT_SETUP' THEN '프로젝트 범위, 조직 경계, 담당 액터, 일정과 책임을 확정한다.'
  WHEN 'EMISSION_PROJECT_COLLECT' THEN '산정에 필요한 활동자료와 원본 증빙을 책임자별로 수집하고 품질을 관리한다.'
  WHEN 'EMISSION_PROJECT_CALCULATE' THEN '승인된 배출계수와 단위 환산 규칙으로 재현 가능한 배출량을 산정한다.'
  WHEN 'EMISSION_PROJECT_VALIDATE' THEN '입력·산정·증빙의 완전성, 정확성, 일관성과 이상치를 검증한다.'
  WHEN 'EMISSION_PROJECT_CORRECT' THEN '검증 결과의 보완 요청을 처리하고 영향 범위를 재산정·재검증한다.'
  WHEN 'EMISSION_PROJECT_APPROVE' THEN '검토자와 승인자가 확정 결과를 독립적으로 검토하고 승인한다.'
  WHEN 'EMISSION_PROJECT_REPORT' THEN '승인된 결과로 검증 가능한 보고서를 생성·제출·발급한다.'
  ELSE completion_rule END,
 input_contract=json_build_object('processCode','EMISSION_PROJECT','stepCode',step_code,'fromState',from_state)::text,
 output_contract=json_build_object('toState',to_state,'completionRule',completion_rule)::text,
 requires_user_page=true,
 requires_admin_page=(admin_path IS NOT NULL AND trim(admin_path)<>''),
 requires_api=true,
 requires_database=true,
 requires_notification=true,
 automation_status=CASE WHEN automation_status='VERIFIED' THEN automation_status ELSE 'NOT_ANALYZED' END
WHERE process_code='EMISSION_PROJECT';

INSERT INTO framework_process_artifact(
 process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,
 contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,notes
) VALUES(
 'EMISSION_PROJECT','EMISSION_PROJECT_SETUP','EMISSION_PROJECT_WORKSPACE','PAGE',
 '내 업무 통합 실행 화면','/emission/my-tasks','WORKSPACE:MY_TASKS',true,'IN_REVIEW',
 'COMPANY_MANAGER',
 '로그인 액터에게 배정된 업무, 선행조건, 마감, 완료조건, 다음 액션과 프로젝트 진행률을 실제 데이터로 제공한다.',
 '프로세스 자동화 이후 첫 번째로 완성할 사용자 업무 관제 화면'
) ON CONFLICT(process_code,artifact_code) DO UPDATE SET
 artifact_name=excluded.artifact_name,target_path=excluded.target_path,contract_ref=excluded.contract_ref,
 acceptance_criteria=excluded.acceptance_criteria,notes=excluded.notes,updated_at=current_timestamp;
