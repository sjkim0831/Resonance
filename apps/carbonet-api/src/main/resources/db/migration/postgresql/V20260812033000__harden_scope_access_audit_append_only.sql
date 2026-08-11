CREATE TEMP TABLE IF NOT EXISTS scope_access_audit_migration_baseline(
    row_count bigint NOT NULL
) ON COMMIT DROP;
TRUNCATE scope_access_audit_migration_baseline;
INSERT INTO scope_access_audit_migration_baseline(row_count)
SELECT count(*) FROM framework_scope_access_audit;

-- A Flyway repair/rehearsal may execute this script against an already-hardened
-- table. Drop only our three guards inside this transaction, then recreate and
-- revalidate them before commit.
DROP TRIGGER IF EXISTS trg_scope_access_audit_prepare_insert ON framework_scope_access_audit;
DROP TRIGGER IF EXISTS trg_scope_access_audit_reject_row_mutation ON framework_scope_access_audit;
DROP TRIGGER IF EXISTS trg_scope_access_audit_reject_truncate ON framework_scope_access_audit;

ALTER TABLE framework_scope_access_audit
    ADD COLUMN IF NOT EXISTS action_code varchar(80) DEFAULT 'LEGACY_SCOPE_CHECK',
    ADD COLUMN IF NOT EXISTS resource_type varchar(80) DEFAULT 'EMISSION_PROJECT',
    ADD COLUMN IF NOT EXISTS schema_version smallint DEFAULT 2,
    ADD COLUMN IF NOT EXISTS row_hash varchar(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
         WHERE attrelid='framework_scope_access_audit'::regclass
           AND attname='outcome_code' AND NOT attisdropped
    ) THEN
        ALTER TABLE framework_scope_access_audit
            ADD COLUMN outcome_code varchar(32)
            GENERATED ALWAYS AS (
                CASE decision_code
                    WHEN 'DENIED' THEN 'ACCESS_DENIED'
                    WHEN 'ALLOWED' THEN 'ACCESS_ALLOWED'
                    ELSE 'INVALID_DECISION'
                END
            ) STORED;
    END IF;
END
$$;

UPDATE framework_scope_access_audit
   SET action_code=coalesce(nullif(trim(action_code),''),'LEGACY_SCOPE_CHECK'),
       resource_type=coalesce(nullif(trim(resource_type),''),'EMISSION_PROJECT'),
       schema_version=2;

CREATE OR REPLACE FUNCTION framework_scope_access_audit_hash(
    p_audit_id bigint,
    p_account_id text,
    p_tenant_id text,
    p_project_id text,
    p_decision_code text,
    p_reason_code text,
    p_action_code text,
    p_resource_type text,
    p_outcome_code text,
    p_schema_version smallint,
    p_created_at timestamp
) RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
SELECT encode(sha256(convert_to(concat_ws(E'\x1f',
    p_audit_id::text,p_account_id,p_tenant_id,p_project_id,p_decision_code,
    p_reason_code,p_action_code,p_resource_type,p_outcome_code,
    p_schema_version::text,(extract(epoch FROM p_created_at)::numeric(30,6))::text
),'UTF8')),'hex')
$$;

UPDATE framework_scope_access_audit
   SET row_hash=framework_scope_access_audit_hash(
       audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
       action_code,resource_type,outcome_code,schema_version,created_at
   );

ALTER TABLE framework_scope_access_audit
    ALTER COLUMN action_code SET NOT NULL,
    ALTER COLUMN resource_type SET NOT NULL,
    ALTER COLUMN outcome_code SET NOT NULL,
    ALTER COLUMN schema_version SET NOT NULL,
    ALTER COLUMN row_hash SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_scope_access_audit_action' AND conrelid='framework_scope_access_audit'::regclass) THEN
        ALTER TABLE framework_scope_access_audit ADD CONSTRAINT chk_scope_access_audit_action
            CHECK (action_code IN (
                'LEGACY_SCOPE_CHECK','PROJECT_PARTICIPANT_READ','EMISSION_PROJECT_OPERATION',
                'REGULATORY_SUBMISSION_CREATE','REGULATORY_SUBMISSION_TRANSITION'
            ));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_scope_access_audit_resource' AND conrelid='framework_scope_access_audit'::regclass) THEN
        ALTER TABLE framework_scope_access_audit ADD CONSTRAINT chk_scope_access_audit_resource
            CHECK (resource_type IN ('EMISSION_PROJECT','REGULATORY_SUBMISSION'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_scope_access_audit_schema_version' AND conrelid='framework_scope_access_audit'::regclass) THEN
        ALTER TABLE framework_scope_access_audit ADD CONSTRAINT chk_scope_access_audit_schema_version
            CHECK (schema_version=2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_scope_access_audit_row_hash' AND conrelid='framework_scope_access_audit'::regclass) THEN
        ALTER TABLE framework_scope_access_audit ADD CONSTRAINT chk_scope_access_audit_row_hash
            CHECK (
                row_hash ~ '^[0-9a-f]{64}$'
                AND row_hash=framework_scope_access_audit_hash(
                    audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
                    action_code,resource_type,outcome_code,schema_version,created_at
                )
            );
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION framework_prepare_scope_access_audit_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    derived_outcome text;
BEGIN
    NEW.action_code:=upper(trim(NEW.action_code));
    NEW.resource_type:=upper(trim(NEW.resource_type));
    NEW.schema_version:=2;
    derived_outcome:=CASE NEW.decision_code
        WHEN 'DENIED' THEN 'ACCESS_DENIED'
        WHEN 'ALLOWED' THEN 'ACCESS_ALLOWED'
        ELSE 'INVALID_DECISION'
    END;
    NEW.row_hash:=framework_scope_access_audit_hash(
        NEW.audit_id,NEW.account_id,NEW.tenant_id,NEW.project_id,NEW.decision_code,
        NEW.reason_code,NEW.action_code,NEW.resource_type,derived_outcome,
        NEW.schema_version,NEW.created_at
    );
    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION framework_reject_scope_access_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'framework_scope_access_audit is append-only: % is forbidden',TG_OP
        USING ERRCODE='55000';
END
$$;

DROP TRIGGER IF EXISTS trg_scope_access_audit_prepare_insert ON framework_scope_access_audit;
CREATE TRIGGER trg_scope_access_audit_prepare_insert
BEFORE INSERT ON framework_scope_access_audit
FOR EACH ROW EXECUTE FUNCTION framework_prepare_scope_access_audit_insert();

DROP TRIGGER IF EXISTS trg_scope_access_audit_reject_row_mutation ON framework_scope_access_audit;
CREATE TRIGGER trg_scope_access_audit_reject_row_mutation
BEFORE UPDATE OR DELETE ON framework_scope_access_audit
FOR EACH ROW EXECUTE FUNCTION framework_reject_scope_access_audit_mutation();

DROP TRIGGER IF EXISTS trg_scope_access_audit_reject_truncate ON framework_scope_access_audit;
CREATE TRIGGER trg_scope_access_audit_reject_truncate
BEFORE TRUNCATE ON framework_scope_access_audit
FOR EACH STATEMENT EXECUTE FUNCTION framework_reject_scope_access_audit_mutation();

CREATE UNIQUE INDEX IF NOT EXISTS uq_scope_access_audit_row_hash
    ON framework_scope_access_audit(row_hash);
CREATE INDEX IF NOT EXISTS idx_scope_access_audit_action_resource_time
    ON framework_scope_access_audit(action_code,resource_type,created_at DESC,audit_id DESC);

ALTER TABLE framework_scope_access_audit
    ALTER COLUMN action_code SET DEFAULT 'LEGACY_SCOPE_CHECK',
    ALTER COLUMN resource_type SET DEFAULT 'EMISSION_PROJECT',
    ALTER COLUMN schema_version SET DEFAULT 2;

COMMENT ON TABLE framework_scope_access_audit IS
    'Append-only fail-closed scope authorization decisions; bind external evidence by audit_id and row_hash';
COMMENT ON COLUMN framework_scope_access_audit.action_code IS 'Server-callsite action; never accepted from an HTTP request body';
COMMENT ON COLUMN framework_scope_access_audit.resource_type IS 'Server-callsite resource type; never accepted from an HTTP request body';
COMMENT ON COLUMN framework_scope_access_audit.outcome_code IS 'Database-derived authorization outcome';
COMMENT ON COLUMN framework_scope_access_audit.row_hash IS 'Database-derived SHA-256 integrity binding for this immutable row';

DO $$
DECLARE
    baseline_count bigint;
    current_count bigint;
    bad_count bigint;
    generated_kind "char";
    enabled_trigger_count integer;
    actual_keys smallint[];
    expected_keys smallint[];
    actual_expression text;
    index_definition text;
    index_keys text;
    index_options text;
    index_unique boolean;
    index_valid boolean;
    index_ready boolean;
BEGIN
    SELECT row_count INTO baseline_count FROM scope_access_audit_migration_baseline;
    SELECT count(*) INTO current_count FROM framework_scope_access_audit;
    IF current_count<>baseline_count THEN
        RAISE EXCEPTION 'scope audit row count changed during hardening: before %, after %',baseline_count,current_count;
    END IF;

    SELECT count(*) INTO bad_count
      FROM framework_scope_access_audit
     WHERE schema_version<>2
        OR action_code NOT IN ('LEGACY_SCOPE_CHECK','PROJECT_PARTICIPANT_READ','EMISSION_PROJECT_OPERATION','REGULATORY_SUBMISSION_CREATE','REGULATORY_SUBMISSION_TRANSITION')
        OR resource_type NOT IN ('EMISSION_PROJECT','REGULATORY_SUBMISSION')
        OR outcome_code<>CASE decision_code WHEN 'DENIED' THEN 'ACCESS_DENIED' WHEN 'ALLOWED' THEN 'ACCESS_ALLOWED' ELSE 'INVALID_DECISION' END
        OR row_hash<>framework_scope_access_audit_hash(
            audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
            action_code,resource_type,outcome_code,schema_version,created_at
        );
    IF bad_count<>0 THEN RAISE EXCEPTION 'scope audit integrity postcondition failed for % rows',bad_count; END IF;

    SELECT attgenerated INTO generated_kind
      FROM pg_attribute
     WHERE attrelid='framework_scope_access_audit'::regclass AND attname='outcome_code' AND NOT attisdropped;
    IF generated_kind IS DISTINCT FROM 's' THEN RAISE EXCEPTION 'outcome_code is not a stored generated column'; END IF;

    SELECT count(*) INTO enabled_trigger_count
      FROM pg_trigger
     WHERE tgrelid='framework_scope_access_audit'::regclass
       AND tgname IN ('trg_scope_access_audit_prepare_insert','trg_scope_access_audit_reject_row_mutation','trg_scope_access_audit_reject_truncate')
       AND tgenabled='O' AND NOT tgisinternal;
    IF enabled_trigger_count<>3 THEN RAISE EXCEPTION 'scope audit trigger postcondition failed: %/3',enabled_trigger_count; END IF;

    SELECT conkey,pg_get_expr(conbin,conrelid) INTO actual_keys,actual_expression
      FROM pg_constraint
     WHERE conrelid='framework_scope_access_audit'::regclass AND conname='chk_scope_access_audit_action'
       AND contype='c' AND convalidated AND NOT condeferrable;
    expected_keys:=ARRAY[(SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='action_code')];
    IF actual_keys IS DISTINCT FROM expected_keys OR actual_expression IS DISTINCT FROM
       '((action_code)::text = ANY ((ARRAY[''LEGACY_SCOPE_CHECK''::character varying, ''PROJECT_PARTICIPANT_READ''::character varying, ''EMISSION_PROJECT_OPERATION''::character varying, ''REGULATORY_SUBMISSION_CREATE''::character varying, ''REGULATORY_SUBMISSION_TRANSITION''::character varying])::text[]))' THEN
        RAISE EXCEPTION 'action constraint definition drift: keys %, expression %',actual_keys,actual_expression;
    END IF;

    SELECT conkey,pg_get_expr(conbin,conrelid) INTO actual_keys,actual_expression
      FROM pg_constraint
     WHERE conrelid='framework_scope_access_audit'::regclass AND conname='chk_scope_access_audit_resource'
       AND contype='c' AND convalidated AND NOT condeferrable;
    expected_keys:=ARRAY[(SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='resource_type')];
    IF actual_keys IS DISTINCT FROM expected_keys OR actual_expression IS DISTINCT FROM
       '((resource_type)::text = ANY ((ARRAY[''EMISSION_PROJECT''::character varying, ''REGULATORY_SUBMISSION''::character varying])::text[]))' THEN
        RAISE EXCEPTION 'resource constraint definition drift: keys %, expression %',actual_keys,actual_expression;
    END IF;

    SELECT conkey,pg_get_expr(conbin,conrelid) INTO actual_keys,actual_expression
      FROM pg_constraint
     WHERE conrelid='framework_scope_access_audit'::regclass AND conname='chk_scope_access_audit_schema_version'
       AND contype='c' AND convalidated AND NOT condeferrable;
    expected_keys:=ARRAY[(SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='schema_version')];
    IF actual_keys IS DISTINCT FROM expected_keys OR actual_expression IS DISTINCT FROM '(schema_version = 2)' THEN
        RAISE EXCEPTION 'schema-version constraint definition drift: keys %, expression %',actual_keys,actual_expression;
    END IF;

    SELECT conkey,pg_get_expr(conbin,conrelid) INTO actual_keys,actual_expression
      FROM pg_constraint
     WHERE conrelid='framework_scope_access_audit'::regclass AND conname='chk_scope_access_audit_row_hash'
       AND contype='c' AND convalidated AND NOT condeferrable;
    expected_keys:=ARRAY[
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='row_hash'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='audit_id'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='account_id'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='tenant_id'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='project_id'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='decision_code'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='reason_code'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='action_code'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='resource_type'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='outcome_code'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='schema_version'),
      (SELECT attnum::smallint FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='created_at')
    ];
    IF actual_keys IS DISTINCT FROM expected_keys OR actual_expression IS DISTINCT FROM
       '(((row_hash)::text ~ ''^[0-9a-f]{64}$''::text) AND ((row_hash)::text = framework_scope_access_audit_hash(audit_id, (account_id)::text, (tenant_id)::text, (project_id)::text, (decision_code)::text, (reason_code)::text, (action_code)::text, (resource_type)::text, (outcome_code)::text, schema_version, created_at)))' THEN
        RAISE EXCEPTION 'row-hash constraint definition drift: keys %, expression %',actual_keys,actual_expression;
    END IF;

    SELECT pg_get_indexdef(indexrelid),indkey::text,indoption::text,indisunique,indisvalid,indisready
      INTO index_definition,index_keys,index_options,index_unique,index_valid,index_ready
      FROM pg_index WHERE indexrelid='uq_scope_access_audit_row_hash'::regclass;
    IF index_definition IS DISTINCT FROM 'CREATE UNIQUE INDEX uq_scope_access_audit_row_hash ON public.framework_scope_access_audit USING btree (row_hash)'
       OR index_keys IS DISTINCT FROM (SELECT attnum::text FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='row_hash')
       OR index_options IS DISTINCT FROM '0' OR NOT index_unique OR NOT index_valid OR NOT index_ready THEN
        RAISE EXCEPTION 'row-hash index definition drift: %, keys %, options %',index_definition,index_keys,index_options;
    END IF;

    SELECT pg_get_indexdef(indexrelid),indkey::text,indoption::text,indisunique,indisvalid,indisready
      INTO index_definition,index_keys,index_options,index_unique,index_valid,index_ready
      FROM pg_index WHERE indexrelid='idx_scope_access_audit_action_resource_time'::regclass;
    IF index_definition IS DISTINCT FROM 'CREATE INDEX idx_scope_access_audit_action_resource_time ON public.framework_scope_access_audit USING btree (action_code, resource_type, created_at DESC, audit_id DESC)'
       OR index_keys IS DISTINCT FROM concat_ws(' ',
          (SELECT attnum FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='action_code'),
          (SELECT attnum FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='resource_type'),
          (SELECT attnum FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='created_at'),
          (SELECT attnum FROM pg_attribute WHERE attrelid='framework_scope_access_audit'::regclass AND attname='audit_id'))
       OR index_options IS DISTINCT FROM '0 0 3 3' OR index_unique OR NOT index_valid OR NOT index_ready THEN
        RAISE EXCEPTION 'action/resource index definition drift: %, keys %, options %',index_definition,index_keys,index_options;
    END IF;
END
$$;
