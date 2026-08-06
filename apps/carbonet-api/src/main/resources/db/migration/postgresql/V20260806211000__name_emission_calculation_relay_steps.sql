-- Customer-facing step names must identify the result being produced, rather
-- than expose a generic plan/work/verify/approve template.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,
    definition_lock_reason='VERSIONED_MAINTENANCE_CALCULATION_RELAY_NAMES_2026_08_06'
WHERE process_code='EMISSION_CALCULATION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

WITH names(step_code,step_name) AS (VALUES
 ('EMISSION_CALCULATION_01_PLAN','산정 기준·입력 스냅샷 확정'),
 ('EMISSION_CALCULATION_02_WORK','배출량 계산·결과 생성'),
 ('EMISSION_CALCULATION_03_VERIFY','산정 결과 검증·오류 보완'),
 ('EMISSION_CALCULATION_04_APPROVE','산정 결과 승인·버전 잠금')
)
UPDATE framework_process_step step SET step_name=names.step_name
FROM names WHERE step.process_code='EMISSION_CALCULATION' AND step.step_code=names.step_code;

WITH names(step_code,step_name) AS (VALUES
 ('EMISSION_CALCULATION_01_PLAN','산정 기준·입력 스냅샷 확정'),
 ('EMISSION_CALCULATION_02_WORK','배출량 계산·결과 생성'),
 ('EMISSION_CALCULATION_03_VERIFY','산정 결과 검증·오류 보완'),
 ('EMISSION_CALCULATION_04_APPROVE','산정 결과 승인·버전 잠금')
)
UPDATE framework_page_design page SET page_title=names.step_name,updated_at=current_timestamp
FROM names WHERE page.process_code='EMISSION_CALCULATION' AND page.step_code=names.step_code;

WITH names(step_code,step_name) AS (VALUES
 ('EMISSION_CALCULATION_01_PLAN','산정 기준·입력 스냅샷 확정'),
 ('EMISSION_CALCULATION_02_WORK','배출량 계산·결과 생성'),
 ('EMISSION_CALCULATION_03_VERIFY','산정 결과 검증·오류 보완'),
 ('EMISSION_CALCULATION_04_APPROVE','산정 결과 승인·버전 잠금')
)
UPDATE framework_professional_screen_contract screen
SET screen_name=names.step_name,updated_by='CUSTOMER_EMISSION_RELAY_PROFESSIONALIZATION',updated_at=current_timestamp
FROM names WHERE screen.process_code='EMISSION_CALCULATION' AND screen.step_code=names.step_code;

WITH names(step_code,step_name) AS (VALUES
 ('EMISSION_CALCULATION_01_PLAN','산정 기준·입력 스냅샷 확정'),
 ('EMISSION_CALCULATION_02_WORK','배출량 계산·결과 생성'),
 ('EMISSION_CALCULATION_03_VERIFY','산정 결과 검증·오류 보완'),
 ('EMISSION_CALCULATION_04_APPROVE','산정 결과 승인·버전 잠금')
)
UPDATE framework_step_execution_spec spec
SET business_contract=jsonb_set(spec.business_contract,'{stepName}',to_jsonb(names.step_name),true),
    guide_contract=jsonb_set(spec.guide_contract,'{title}',to_jsonb(names.step_name),true),
    spec_version=spec.spec_version+1,updated_at=current_timestamp
FROM names WHERE spec.process_code='EMISSION_CALCULATION' AND spec.step_code=names.step_code;

UPDATE framework_process_definition
SET process_version='1.3.0',definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: customer calculation relay names verified',
    updated_at=current_timestamp
WHERE process_code='EMISSION_CALCULATION';

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM framework_process_step WHERE process_code='EMISSION_CALCULATION'
   AND step_name IN ('계획·범위 확정','자료 입력·업무 수행','검증·보완','승인·확정')) THEN
   RAISE EXCEPTION 'generic emission calculation relay names remain';
 END IF;
END $$;
