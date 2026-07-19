CREATE TABLE IF NOT EXISTS emission_factor_mapping_decision (
    decision_id bigserial PRIMARY KEY,
    tenant_id varchar(100) NOT NULL,
    project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
    activity_id bigint NOT NULL REFERENCES emission_activity_data(activity_id) ON DELETE CASCADE,
    factor_id varchar(40) NOT NULL REFERENCES emission_factor_reference(factor_id),
    mapping_method varchar(20) NOT NULL CHECK (mapping_method IN ('AUTO','MANUAL')),
    confidence_score numeric(5,4),
    unit_match boolean NOT NULL,
    decision_reason varchar(500) NOT NULL,
    decided_by varchar(100) NOT NULL,
    active_yn char(1) NOT NULL DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
    decided_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_emission_factor_mapping_active
    ON emission_factor_mapping_decision(project_id,activity_id) WHERE active_yn='Y';
CREATE INDEX IF NOT EXISTS ix_emission_factor_mapping_audit
    ON emission_factor_mapping_decision(tenant_id,project_id,decided_at DESC);

ALTER TABLE emission_calculation_run
    ADD COLUMN IF NOT EXISTS tenant_id varchar(100),
    ADD COLUMN IF NOT EXISTS accepted_submission_ids text,
    ADD COLUMN IF NOT EXISTS input_snapshot_hash varchar(64),
    ADD COLUMN IF NOT EXISTS methodology_code varchar(80) NOT NULL DEFAULT 'ACTIVITY_X_FACTOR',
    ADD COLUMN IF NOT EXISTS result_unit varchar(30) NOT NULL DEFAULT 'tCO2e',
    ADD COLUMN IF NOT EXISTS calculated_by varchar(100);

ALTER TABLE emission_calculation_item
    ADD COLUMN IF NOT EXISTS activity_name varchar(200),
    ADD COLUMN IF NOT EXISTS category varchar(80),
    ADD COLUMN IF NOT EXISTS activity_period varchar(20),
    ADD COLUMN IF NOT EXISTS activity_unit varchar(30),
    ADD COLUMN IF NOT EXISTS factor_id varchar(40),
    ADD COLUMN IF NOT EXISTS factor_name varchar(200),
    ADD COLUMN IF NOT EXISTS factor_unit varchar(30),
    ADD COLUMN IF NOT EXISTS factor_source varchar(100),
    ADD COLUMN IF NOT EXISTS formula_text varchar(500);

COMMENT ON TABLE emission_factor_mapping_decision IS
    '관리자 접수 활동자료에 적용한 자동·수동 배출계수 결정과 근거의 변경 불가 감사 이력';
COMMENT ON COLUMN emission_calculation_run.input_snapshot_hash IS
    '접수 제출본, 활동량, 배출계수와 산정값을 정규화한 SHA-256 입력 지문';

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,definition_lock_reason='VERSIONED_MAINTENANCE_V1.2.0'
WHERE process_code='EMISSION_CALCULATION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
UPDATE framework_process_step
SET input_contract='{"required":["manager-accepted submission snapshot","calculator actor assignment","factor source and unit","mapping decision evidence"],"forbidden":["unaccepted mutable activity rows","unit-mismatched factor without conversion"]}',
    output_contract='{"required":["immutable calculation version","accepted submission ids","factor decision audit","reconciled item total","SHA-256 input fingerprint","validation handoff"]}',
    completion_rule='접수 제출본만 사용하고 모든 행의 배출계수 출처·단위·결정 근거를 확정하며 항목 합계와 총배출량 및 입력 지문이 일치해야 완료한다.',
    api_contract=CASE WHEN step_code='EMISSION_CALCULATION_02_WORK'
      THEN 'GET /home/api/emission-projects/{id}/calculation; POST /home/api/emission-projects/{id}/activities/{activityId}/factor; POST /home/api/emission-projects/{id}/activities/auto-map; POST /home/api/emission-projects/{id}/calculation'
      ELSE api_contract END,
    automation_status='IMPLEMENTED'
WHERE process_code='EMISSION_CALCULATION';
ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_professional_screen_contract
SET entry_condition='기업 담당자가 활동자료 요청을 접수 완료했고 산정 담당자에게 CALCULATION 태스크가 배정되어 있다.',
    exit_condition='접수 제출본의 모든 행에 단위가 일치하는 배출계수 결정이 존재하고 불변 산정 버전·항목 합계·입력 지문이 생성된다.',
    data_contract='["emission_activity_request","emission_activity_submission_item","emission_factor_reference","emission_factor_mapping_decision","emission_calculation_run","emission_calculation_item"]',
    evidence_contract='accepted submission ids; factor source/unit/confidence/reason; calculator actor; immutable version; reconciled total; SHA-256 input snapshot; validation handoff',
    audit_evidence_ref='implemented:accepted-snapshot+factor-decision-audit+calculation-fingerprint',
    contract_status='VERIFIED',updated_by='FLYWAY',updated_at=current_timestamp
WHERE process_code='EMISSION_CALCULATION' AND step_code='EMISSION_CALCULATION_02_WORK';

UPDATE framework_simulation_case
SET assertions_json=CASE case_type
  WHEN 'HAPPY_PATH' THEN '["접수 제출본만 산정 대상","모든 계수 결정 이력 존재","항목 합계와 총배출량 일치","입력 지문 존재","검증 태스크 개방"]'
  WHEN 'EXCEPTION' THEN '["미접수 자료 거부","미매핑 행 산정 거부","단위 불일치 산정 거부","상태와 기존 버전 불변"]'
  WHEN 'AUTHORITY' THEN '["비산정 담당자 매핑·산정 403","산정 담당자만 실행","결정자 감사 이력 존재"]'
  WHEN 'ISOLATION' THEN '["타 테넌트 제출본 0건","타 프로젝트 활동자료 매핑 거부","결과 조회 범위 격리"]'
  ELSE '["동시 산정 직렬화","기존 산정 버전 보존","재실행 시 새 버전과 새 지문","실패 후 안전 재개"]' END,
    case_status='READY',updated_at=current_timestamp
WHERE process_code='EMISSION_CALCULATION';

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET process_version='1.2.0',process_status='IN_DEVELOPMENT',definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: accepted snapshot calculation v1.2',updated_at=current_timestamp
WHERE process_code='EMISSION_CALCULATION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;
