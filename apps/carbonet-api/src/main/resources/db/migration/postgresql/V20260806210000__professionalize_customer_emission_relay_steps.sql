-- Replace generic four-phase labels with customer-visible carbon work names.
-- Keep the detailed relay canonical: the seven-step EMISSION_PROJECT record is
-- an assignment/orchestration view and must not duplicate these executions.

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,
    definition_lock_reason='VERSIONED_MAINTENANCE_CUSTOMER_RELAY_2026_08_06'
WHERE process_code IN ('ACTIVITY_DATA','REPORT_CERTIFICATION');
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

WITH definition(step_code,step_name,requirement_text,completion_rule,user_path) AS (
  VALUES
    ('ACTIVITY_DATA_01_PLAN','활동자료 수집 계획 확정',
      '사업장·배출원별 수집 대상, 보고기간, 단위, 담당자, 제출기한과 필수 증빙 기준을 확정한다.',
      '모든 대상 사업장과 배출원에 담당자·수집주기·단위·제출기한·필수 증빙이 지정되고 누락 대상이 없어야 완료한다.',
      '/emission/project/detail'),
    ('ACTIVITY_DATA_02_WORK','활동자료 입력·증빙 제출',
      '계량기·ERP·구매·연료·전력 등 원천자료를 입력하거나 연계하고 단위와 증빙을 함께 제출한다.',
      '필수 활동자료가 기간별로 입력되고 단위가 표준화되며 원천 증빙 해시와 제출 버전이 저장되어야 완료한다.',
      '/emission/activity-data'),
    ('ACTIVITY_DATA_03_VERIFY','활동자료 품질검증·보완',
      '누락·중복·이상치·기간·단위·증빙 일치 여부를 검증하고 보완 요청과 재제출을 관리한다.',
      '중대 검증 오류가 모두 해소되고 보완 이력·검증 의견·품질 점수·검증 증적이 저장되어야 완료한다.',
      '/emission/validate'),
    ('ACTIVITY_DATA_04_APPROVE','활동자료 승인·스냅샷 확정',
      '검증 완료 자료와 보완 이력을 검토하고 산정 입력으로 사용할 불변 스냅샷을 승인한다.',
      '미해결 중대 오류가 없고 승인자·결정일시·승인 의견·입력 스냅샷 해시가 저장되어야 완료한다.',
      '/emission/validate?tab=approval'),
    ('REPORT_CERTIFICATION_01_PLAN','보고서 작성 범위·양식 확정',
      '승인된 산정 버전, 보고 기준, 언어, 보고기간, 책임자와 제출·인증서 양식을 확정한다.',
      '잠금 산정 버전과 보고 기준·언어·양식·책임자·기한이 지정되고 보고서 생성 준비상태가 확인되어야 완료한다.',
      '/emission/report_submit'),
    ('REPORT_CERTIFICATION_02_WORK','보고서 생성·데이터셋 봉인',
      '승인 결과로 보고서와 정규화 데이터셋을 생성하고 시각지문·데이터셋 해시·리포트 해시를 봉인한다.',
      '보고서·데이터셋·QR·시각지문이 생성되고 모든 합계가 승인 스냅샷과 일치하며 무결성 해시가 저장되어야 완료한다.',
      '/emission/report_submit'),
    ('REPORT_CERTIFICATION_03_VERIFY','보고서·인증 데이터 교차검증',
      '보고서 수치, 데이터셋, OCR 결과, QR, 시각지문과 무결성 해시를 승인 결과와 교차검증한다.',
      '제품·물질·질량·배출계수·배출량·총계·GWP·해시 대조가 끝나고 모든 중대 불일치가 해소되어야 완료한다.',
      '/emission/report_submit?mode=verify'),
    ('REPORT_CERTIFICATION_04_APPROVE','보고서 확정·인증서 발급',
      '검증 완료 보고서를 확정하고 인증서 ID, QR, 진위확인 정보와 다운로드 권한을 발급한다.',
      '승인 이력과 잠금 보고서가 저장되고 인증서 ID·QR·공개 진위확인 레코드·감사 이력이 생성되어야 완료한다.',
      '/emission/report-download')
)
UPDATE framework_process_step step
SET step_name=definition.step_name,
    requirement_text=definition.requirement_text,
    completion_rule=definition.completion_rule,
    user_path=definition.user_path
FROM definition
WHERE step.step_code=definition.step_code
  AND step.process_code=CASE WHEN definition.step_code LIKE 'ACTIVITY_DATA_%' THEN 'ACTIVITY_DATA' ELSE 'REPORT_CERTIFICATION' END;

WITH definition(step_code,step_name,requirement_text,completion_rule,user_path) AS (
  SELECT step_code,step_name,requirement_text,completion_rule,user_path
  FROM framework_process_step
  WHERE process_code IN ('ACTIVITY_DATA','REPORT_CERTIFICATION')
)
UPDATE framework_page_design page
SET page_title=definition.step_name,
    page_purpose=definition.requirement_text,
    planned_route_path=CASE WHEN page.audience='USER' THEN definition.user_path ELSE page.planned_route_path END,
    actual_route_path=CASE WHEN page.audience='USER' THEN definition.user_path ELSE page.actual_route_path END,
    updated_at=current_timestamp
FROM definition
WHERE page.step_code=definition.step_code;

WITH definition(process_code,step_code,step_name,requirement_text,completion_rule,user_path) AS (
  SELECT process_code,step_code,step_name,requirement_text,completion_rule,user_path
  FROM framework_process_step
  WHERE process_code IN ('ACTIVITY_DATA','REPORT_CERTIFICATION')
)
UPDATE framework_professional_screen_contract screen
SET screen_name=definition.step_name,
    business_purpose=definition.requirement_text,
    exit_condition=definition.completion_rule,
    route_path=CASE WHEN screen.audience='USER' THEN definition.user_path ELSE screen.route_path END,
    updated_by='CUSTOMER_EMISSION_RELAY_PROFESSIONALIZATION',
    updated_at=current_timestamp
FROM definition
WHERE screen.process_code=definition.process_code AND screen.step_code=definition.step_code;

WITH definition(process_code,step_code,step_name,requirement_text,completion_rule,user_path) AS (
  SELECT process_code,step_code,step_name,requirement_text,completion_rule,user_path
  FROM framework_process_step
  WHERE process_code IN ('ACTIVITY_DATA','REPORT_CERTIFICATION')
)
UPDATE framework_step_execution_spec spec
SET business_contract=jsonb_set(jsonb_set(jsonb_set(spec.business_contract,
      '{stepName}',to_jsonb(definition.step_name),true),
      '{requirement}',to_jsonb(definition.requirement_text),true),
      '{completionRule}',to_jsonb(definition.completion_rule),true),
    transition_contract=jsonb_set(spec.transition_contract,'{completionRule}',to_jsonb(definition.completion_rule),true),
    guide_contract=jsonb_set(jsonb_set(jsonb_set(jsonb_set(spec.guide_contract,
      '{title}',to_jsonb(definition.step_name),true),
      '{purpose}',to_jsonb(definition.requirement_text),true),
      '{completionCondition}',to_jsonb(definition.completion_rule),true),
      '{userPath}',to_jsonb(definition.user_path),true),
    spec_version=spec.spec_version+1,
    updated_at=current_timestamp
FROM definition
WHERE spec.process_code=definition.process_code AND spec.step_code=definition.step_code;

UPDATE framework_process_definition
SET process_version=CASE process_code
      WHEN 'ACTIVITY_DATA' THEN '1.3.0'
      WHEN 'REPORT_CERTIFICATION' THEN '1.2.0'
      ELSE process_version END,
    definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: customer emission relay semantics verified',
    updated_at=current_timestamp
WHERE process_code IN ('ACTIVITY_DATA','REPORT_CERTIFICATION');

DO $$
DECLARE generic_count integer; public_verify_count integer;
BEGIN
  SELECT count(*) INTO generic_count FROM framework_process_step
  WHERE process_code IN ('ACTIVITY_DATA','REPORT_CERTIFICATION')
    AND (step_name IN ('계획·범위 확정','자료 입력·업무 수행','검증·보완','승인·확정')
      OR completion_rule IN ('책임자·기간·범위가 지정됨','필수 입력과 증빙이 제출됨','오류가 없고 검증 근거가 남음','승인 이력과 최종 결과가 확정됨'));
  SELECT count(*) INTO public_verify_count FROM framework_process_step
  WHERE process_code='REPORT_CERTIFICATION' AND step_code='REPORT_CERTIFICATION_03_VERIFY'
    AND user_path LIKE '/home/%';
  IF generic_count<>0 OR public_verify_count<>0 THEN
    RAISE EXCEPTION 'customer emission relay quality gate failed generic=% publicVerify=%',generic_count,public_verify_count;
  END IF;
END $$;
