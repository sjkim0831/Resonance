CREATE TABLE IF NOT EXISTS framework_project_step_applicability_decision (
    tenant_id varchar(100) NOT NULL,
    project_id varchar(100) NOT NULL,
    process_code varchar(100) NOT NULL,
    step_code varchar(100) NOT NULL,
    decision_status varchar(30) NOT NULL DEFAULT 'PENDING',
    reason_text text,
    evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
    decided_by varchar(100),
    decided_at timestamp,
    reassess_at timestamp,
    decision_version integer NOT NULL DEFAULT 1,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (tenant_id, project_id, process_code, step_code),
    CONSTRAINT ck_step_applicability_decision_status CHECK
        (decision_status IN ('PENDING','APPLICABLE','NOT_APPLICABLE','REASSESS_REQUIRED'))
);

CREATE INDEX IF NOT EXISTS ix_project_step_applicability_project
    ON framework_project_step_applicability_decision (tenant_id, project_id, decision_status);

CREATE TABLE IF NOT EXISTS framework_project_step_applicability_history (
    history_id bigserial PRIMARY KEY,
    tenant_id varchar(100) NOT NULL,
    project_id varchar(100) NOT NULL,
    process_code varchar(100) NOT NULL,
    step_code varchar(100) NOT NULL,
    decision_status varchar(30) NOT NULL,
    reason_text text,
    evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
    decided_by varchar(100),
    decided_at timestamp,
    decision_version integer NOT NULL,
    recorded_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE OR REPLACE FUNCTION record_project_step_applicability_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO framework_project_step_applicability_history(
        tenant_id,project_id,process_code,step_code,decision_status,reason_text,
        evidence_refs,decided_by,decided_at,decision_version)
    VALUES(NEW.tenant_id,NEW.project_id,NEW.process_code,NEW.step_code,
        NEW.decision_status,NEW.reason_text,NEW.evidence_refs,NEW.decided_by,
        NEW.decided_at,NEW.decision_version);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_project_step_applicability_history
    ON framework_project_step_applicability_decision;
CREATE TRIGGER trg_project_step_applicability_history
AFTER INSERT OR UPDATE ON framework_project_step_applicability_decision
FOR EACH ROW EXECUTE FUNCTION record_project_step_applicability_history();

INSERT INTO framework_project_step_applicability_decision(
    tenant_id,project_id,process_code,step_code,decision_status)
SELECT p.tenant_id,p.project_id,c.process_code,c.step_code,'PENDING'
FROM emission_project_registry p
CROSS JOIN framework_step_guidance_contract c
WHERE c.use_at='Y' AND c.applicability_type='CONDITIONAL'
ON CONFLICT (tenant_id,project_id,process_code,step_code) DO NOTHING;

COMMENT ON TABLE framework_project_step_applicability_decision IS
    '프로젝트별 조건부 절차 적용 판정 원장';
COMMENT ON TABLE framework_project_step_applicability_history IS
    '조건부 절차 판정 변경 불변 이력';
