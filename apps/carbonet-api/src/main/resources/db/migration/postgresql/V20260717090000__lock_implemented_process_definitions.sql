-- Implemented process contracts are source-of-truth assets.  Operational state
-- may advance, but their structure can only change through a deliberate new
-- migration that explicitly unlocks/version-copies the contract.
ALTER TABLE framework_process_definition
    ADD COLUMN IF NOT EXISTS definition_locked boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS definition_lock_reason text;

UPDATE framework_process_definition
SET definition_locked = true,
    definition_lock_reason = COALESCE(
        NULLIF(definition_lock_reason, ''),
        'IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY'
    )
WHERE definition_locked = false;

CREATE OR REPLACE FUNCTION framework_guard_locked_process_definition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.definition_locked THEN
        RAISE EXCEPTION 'Implemented process % is read-only', OLD.process_code
            USING ERRCODE = '55000';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.definition_locked AND (
        NEW.process_code IS DISTINCT FROM OLD.process_code OR
        NEW.process_name IS DISTINCT FROM OLD.process_name OR
        NEW.domain_code IS DISTINCT FROM OLD.domain_code OR
        NEW.process_version IS DISTINCT FROM OLD.process_version OR
        NEW.goal IS DISTINCT FROM OLD.goal OR
        NEW.start_condition IS DISTINCT FROM OLD.start_condition OR
        NEW.completion_condition IS DISTINCT FROM OLD.completion_condition OR
        NEW.definition_locked IS DISTINCT FROM OLD.definition_locked OR
        NEW.definition_lock_reason IS DISTINCT FROM OLD.definition_lock_reason
    ) THEN
        RAISE EXCEPTION 'Implemented process % structure is read-only', OLD.process_code
            USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_locked_process_definition ON framework_process_definition;
CREATE TRIGGER trg_guard_locked_process_definition
BEFORE UPDATE OR DELETE ON framework_process_definition
FOR EACH ROW EXECUTE FUNCTION framework_guard_locked_process_definition();

CREATE OR REPLACE FUNCTION framework_guard_locked_process_step()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_process_code varchar(80);
    target_locked boolean;
BEGIN
    target_process_code := CASE WHEN TG_OP = 'DELETE' THEN OLD.process_code ELSE NEW.process_code END;
    SELECT definition_locked INTO target_locked
    FROM framework_process_definition
    WHERE process_code = target_process_code;

    IF COALESCE(target_locked, false) THEN
        RAISE EXCEPTION 'Implemented process % steps are read-only', target_process_code
            USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_locked_process_step ON framework_process_step;
CREATE TRIGGER trg_guard_locked_process_step
BEFORE INSERT OR UPDATE OR DELETE ON framework_process_step
FOR EACH ROW EXECUTE FUNCTION framework_guard_locked_process_step();

CREATE OR REPLACE FUNCTION framework_guard_locked_simulation_case()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_process_code varchar(80);
    target_locked boolean;
BEGIN
    target_process_code := CASE WHEN TG_OP = 'DELETE' THEN OLD.process_code ELSE NEW.process_code END;
    SELECT definition_locked INTO target_locked
    FROM framework_process_definition
    WHERE process_code = target_process_code;

    IF NOT COALESCE(target_locked, false) THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_OP IN ('INSERT', 'DELETE') THEN
        RAISE EXCEPTION 'Implemented process % simulation contract is read-only', target_process_code
            USING ERRCODE = '55000';
    END IF;

    IF (
        NEW.case_code IS DISTINCT FROM OLD.case_code OR
        NEW.process_code IS DISTINCT FROM OLD.process_code OR
        NEW.case_name IS DISTINCT FROM OLD.case_name OR
        NEW.case_type IS DISTINCT FROM OLD.case_type OR
        NEW.preconditions IS DISTINCT FROM OLD.preconditions OR
        NEW.steps_json IS DISTINCT FROM OLD.steps_json OR
        NEW.assertions_json IS DISTINCT FROM OLD.assertions_json
    ) THEN
        RAISE EXCEPTION 'Implemented process % simulation contract is read-only', target_process_code
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_locked_simulation_case ON framework_simulation_case;
CREATE TRIGGER trg_guard_locked_simulation_case
BEFORE INSERT OR UPDATE OR DELETE ON framework_simulation_case
FOR EACH ROW EXECUTE FUNCTION framework_guard_locked_simulation_case();

COMMENT ON COLUMN framework_process_definition.definition_locked IS
    'True when the implemented process structure is immutable; operational status remains mutable.';
