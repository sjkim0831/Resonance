-- Exact, reversible cleanup for a Backstage-owned RFP project runtime.
--
-- The contract is deliberately narrower than a generic "delete by prefix":
-- one immutable Backstage release identifies one project, design version,
-- checksum and process.  A preview snapshots the complete FK descendant graph,
-- reports impact, and refuses shared/manual/adopted state.  Apply and restore
-- lock the same rows in bytewise C order and use the snapshot as a CAS preimage.

CREATE TABLE framework_project_runtime_purge_receipt (
  receipt_id uuid PRIMARY KEY,
  operation_key uuid NOT NULL,
  project_id varchar(64) NOT NULL,
  process_code varchar(80) NOT NULL,
  design_version integer NOT NULL CHECK(design_version>0),
  contract_sha256 varchar(64) NOT NULL
    CHECK(contract_sha256 ~ '^[0-9a-f]{64}$'),
  scope_mode varchar(24) NOT NULL
    CHECK(scope_mode IN ('TEST_OWNED','QA_PROVENANCE','EXACT_PROJECT')),
  receipt_status varchar(16) NOT NULL
    CHECK(receipt_status IN (
      'PREVIEWED','BLOCKED','PURGING','PURGED','RESTORING','RESTORED'
    )),
  snapshot_sha256 varchar(64) NOT NULL
    CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  impact_json jsonb NOT NULL CHECK(jsonb_typeof(impact_json)='object'),
  blocker_json jsonb NOT NULL CHECK(jsonb_typeof(blocker_json)='object'),
  postcondition_json jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK(jsonb_typeof(postcondition_json)='object'),
  requested_by varchar(120) NOT NULL,
  previewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  purged_at timestamptz,
  restored_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,operation_key),
  CHECK(project_id=btrim(project_id)
        AND project_id ~ '^[A-Z][A-Z0-9_-]{2,63}$'),
  CHECK(process_code=btrim(process_code)
        AND process_code ~ '^[A-Z][A-Z0-9_:-]{1,79}$'),
  CHECK(requested_by=btrim(requested_by)
        AND requested_by ~ '^[A-Za-z0-9._@-]{2,120}$')
);

CREATE TABLE framework_project_runtime_purge_snapshot_row (
  receipt_id uuid NOT NULL
    REFERENCES framework_project_runtime_purge_receipt(receipt_id)
    ON DELETE RESTRICT,
  table_oid oid NOT NULL,
  table_name varchar(140) NOT NULL,
  dependency_depth integer NOT NULL CHECK(dependency_depth>=0),
  row_hash varchar(64) NOT NULL CHECK(row_hash ~ '^[0-9a-f]{64}$'),
  row_payload jsonb NOT NULL CHECK(jsonb_typeof(row_payload)='object'),
  PRIMARY KEY(receipt_id,table_name,row_hash),
  CHECK(table_name ~ '^(framework_|integrated_design_)[a-z0-9_]+$')
);

CREATE INDEX idx_project_runtime_purge_active_fence
  ON framework_project_runtime_purge_receipt(project_id,process_code)
  WHERE receipt_status='PURGED';
CREATE INDEX idx_project_runtime_purge_active_process_fence
  ON framework_project_runtime_purge_receipt(process_code)
  WHERE receipt_status='PURGED';

CREATE INDEX idx_project_runtime_purge_snapshot_order
  ON framework_project_runtime_purge_snapshot_row(
    receipt_id,dependency_depth,table_name,row_hash
  );

CREATE TABLE framework_project_runtime_purge_audit (
  audit_id bigserial PRIMARY KEY,
  receipt_id uuid NOT NULL
    REFERENCES framework_project_runtime_purge_receipt(receipt_id)
    ON DELETE RESTRICT,
  event_type varchar(32) NOT NULL
    CHECK(event_type IN ('PREVIEWED','BLOCKED','PURGED','RESTORED')),
  actor_account varchar(120) NOT NULL,
  event_payload jsonb NOT NULL CHECK(jsonb_typeof(event_payload)='object'),
  previous_hash varchar(64),
  row_hash varchar(64) NOT NULL CHECK(row_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_project_runtime_purge_audit_chain
  ON framework_project_runtime_purge_audit(receipt_id,audit_id);

-- A project can exist in Backstage before its first runtime design release.
-- The ACTIVE row is a durable cross-database fence: exact-zero proof and fence
-- activation commit together, then every project-bearing runtime writer must
-- observe it before Backstage is allowed to remove the local project.
CREATE TABLE framework_project_runtime_absence_fence (
  proof_id uuid PRIMARY KEY,
  project_id varchar(64) NOT NULL,
  fence_status varchar(16) NOT NULL
    CHECK(fence_status IN ('ACTIVE','RELEASED')),
  proof_json jsonb NOT NULL CHECK(jsonb_typeof(proof_json)='object'),
  proof_sha256 varchar(64) NOT NULL
    CHECK(proof_sha256~'^[0-9a-f]{64}$'),
  requested_by varchar(120) NOT NULL,
  fenced_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(project_id=btrim(project_id)
        AND project_id~'^[A-Z][A-Z0-9_-]{2,63}$'),
  CHECK(requested_by=btrim(requested_by)
        AND requested_by~'^[A-Za-z0-9._@-]{2,120}$'),
  CHECK((fence_status='ACTIVE' AND released_at IS NULL)
     OR (fence_status='RELEASED' AND released_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_project_runtime_absence_fence_active
  ON framework_project_runtime_absence_fence(project_id)
  WHERE fence_status='ACTIVE';

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF TG_TABLE_NAME='framework_project_runtime_purge_snapshot_row'
     AND TG_OP='UPDATE'
     AND current_setting('carbonet.project_runtime_purge_build',true)=OLD.receipt_id::text
     AND EXISTS(
       SELECT 1 FROM framework_project_runtime_purge_receipt receipt
        WHERE receipt.receipt_id=OLD.receipt_id
          AND receipt.receipt_status='PREVIEWED'
          AND receipt.snapshot_sha256=repeat('0',64)
     ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'project runtime purge evidence is immutable'
    USING ERRCODE='55000';
END
$$;

CREATE TRIGGER trg_project_runtime_purge_snapshot_immutable
  BEFORE UPDATE OR DELETE ON framework_project_runtime_purge_snapshot_row
  FOR EACH ROW EXECUTE FUNCTION framework_project_runtime_purge_immutable();
CREATE TRIGGER trg_project_runtime_purge_audit_immutable
  BEFORE UPDATE OR DELETE ON framework_project_runtime_purge_audit
  FOR EACH ROW EXECUTE FUNCTION framework_project_runtime_purge_immutable();

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_hash(value jsonb)
RETURNS varchar(64)
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,public
AS $$
  SELECT encode(pg_catalog.sha256(convert_to(value::text,'UTF8')),'hex')::varchar(64)
$$;

-- Composite scope provenance is produced by Java's stable(Map): map keys are
-- sorted, text is quoted as lowercase UTF-8 hex and integral values use the
-- IEEE-754 double bit pattern.  Reproducing it here prevents a valid authority
-- hash from being copied into a forged project/release binding.
CREATE OR REPLACE FUNCTION framework_project_runtime_purge_stable_text(value text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,public
AS $$
  SELECT '"'||encode(convert_to(value,'UTF8'),'hex')||'"'
$$;

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_stable_integer(value bigint)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,public
AS $$
  SELECT '@'||encode(pg_catalog.float8send(value::double precision),'hex')
$$;

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_integrated_provenance_hash(
  requested_scope text,requested_project text,requested_design_version bigint,
  requested_contract_sha256 text,requested_process text,requested_step text,
  requested_route text,requested_audience text,requested_authority_id bigint,
  requested_authority_revision bigint,requested_document_set_hash text,
  requested_authority_hash text
) RETURNS varchar(64)
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,public
AS $$
DECLARE material text; pairs text[]:=ARRAY[]::text[];
BEGIN
  IF requested_scope<>'PROJECT' OR requested_project IS NULL
     OR requested_design_version<1 OR requested_contract_sha256 IS NULL
     OR requested_authority_id<1 OR requested_authority_revision<1 THEN
    RAISE EXCEPTION 'exact PROJECT composite provenance is required'
      USING ERRCODE='22023';
  END IF;
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('audience')||':'||
    framework_project_runtime_purge_stable_text(requested_audience));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('authorityHash')||':'||
    framework_project_runtime_purge_stable_text(requested_authority_hash));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('authorityId')||':'||
    framework_project_runtime_purge_stable_integer(requested_authority_id));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('authorityRevision')||':'||
    framework_project_runtime_purge_stable_integer(requested_authority_revision));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('contractSha256')||':'||
    framework_project_runtime_purge_stable_text(requested_contract_sha256));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('designVersion')||':'||
    framework_project_runtime_purge_stable_integer(requested_design_version));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('documentSetHash')||':'||
    framework_project_runtime_purge_stable_text(requested_document_set_hash));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('processCode')||':'||
    framework_project_runtime_purge_stable_text(requested_process));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('projectId')||':'||
    framework_project_runtime_purge_stable_text(requested_project));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('routePath')||':'||
    framework_project_runtime_purge_stable_text(requested_route));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('scopeType')||':'||
    framework_project_runtime_purge_stable_text(requested_scope));
  pairs:=pairs||(
    framework_project_runtime_purge_stable_text('stepCode')||':'||
    framework_project_runtime_purge_stable_text(requested_step));
  material:='{'||array_to_string(pairs,',')||'}';
  RETURN encode(pg_catalog.sha256(convert_to(material,'UTF8')),'hex')::varchar(64);
END
$$;

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_append_audit(
  requested_receipt uuid,requested_event text,requested_actor text,
  requested_payload jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE prior_hash text; next_hash text;
BEGIN
  IF requested_event NOT IN ('PREVIEWED','BLOCKED','PURGED','RESTORED')
     OR requested_actor IS NULL OR requested_actor<>btrim(requested_actor)
     OR requested_actor!~'^[A-Za-z0-9._@-]{2,120}$'
     OR jsonb_typeof(requested_payload)<>'object' THEN
    RAISE EXCEPTION 'invalid project runtime purge audit event'
      USING ERRCODE='22023';
  END IF;
  SELECT row_hash INTO prior_hash
    FROM framework_project_runtime_purge_audit
   WHERE receipt_id=requested_receipt
   ORDER BY audit_id DESC LIMIT 1 FOR UPDATE;
  next_hash:=framework_project_runtime_purge_hash(jsonb_build_object(
    'schema','carbonet.project-runtime-purge-audit/v1',
    'receiptId',requested_receipt,'eventType',requested_event,
    'actorAccount',requested_actor,'payload',requested_payload,
    'previousHash',prior_hash
  ));
  INSERT INTO framework_project_runtime_purge_audit(
    receipt_id,event_type,actor_account,event_payload,previous_hash,row_hash
  ) VALUES(
    requested_receipt,requested_event,requested_actor,requested_payload,
    prior_hash,next_hash
  );
END
$$;

-- The SECURITY DEFINER boundary revalidates the named account in PostgreSQL.
-- A caller-controlled GUC is never authority: carbonet_app can set arbitrary
-- custom settings.  Both the active account row and its qualifying role row
-- are locked so authority cannot be revoked between preview/apply/restore and
-- the destructive statement in the same transaction.
CREATE OR REPLACE FUNCTION framework_project_runtime_purge_require_admin(
  requested_actor text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE account_row record; qualifying_role_count integer:=0; qualifying_role text;
BEGIN
  requested_actor:=btrim(coalesce(requested_actor,''));
  IF requested_actor!~'^[A-Za-z0-9._@-]{2,120}$' THEN
    RAISE EXCEPTION 'runtime system administrator account is required'
      USING ERRCODE='42501';
  END IF;
  SELECT candidate.esntl_id,candidate.account_status,candidate.account_type
    INTO account_row
    FROM (
      SELECT employee.esntl_id,
             upper(coalesce(employee.emplyr_sttus_code,'')) account_status,
             'EMPLOYEE'::text account_type
        FROM comtnemplyrinfo employee
       WHERE lower(employee.emplyr_id)=lower(requested_actor)
       FOR UPDATE
    ) candidate
   UNION ALL
  SELECT candidate.esntl_id,candidate.account_status,candidate.account_type
    FROM (
      SELECT member.esntl_id,
             upper(coalesce(member.entrprs_mber_sttus,'')) account_status,
             'ENTERPRISE'::text account_type
        FROM comtnentrprsmber member
       WHERE lower(member.entrprs_mber_id)=lower(requested_actor)
       FOR UPDATE
    ) candidate;
  IF NOT FOUND OR account_row.account_status NOT IN ('P','A') THEN
    RAISE EXCEPTION 'active runtime system administrator account is required'
      USING ERRCODE='42501';
  END IF;
  -- Duplicate employee/member identifiers are ambiguous and therefore denied.
  IF (SELECT count(*) FROM (
        SELECT 1 FROM comtnemplyrinfo
         WHERE lower(emplyr_id)=lower(requested_actor)
        UNION ALL
        SELECT 1 FROM comtnentrprsmber
         WHERE lower(entrprs_mber_id)=lower(requested_actor)
      ) accounts)<>1 THEN
    RAISE EXCEPTION 'runtime system administrator account is ambiguous'
      USING ERRCODE='42501';
  END IF;
  FOR qualifying_role IN
    SELECT security.author_code
      FROM comtnemplyrscrtyestbs security
     WHERE security.scrty_dtrmn_trget_id=account_row.esntl_id
       AND security.author_code IN ('ROLE_SYSTEM_MASTER','ROLE_SYSTEM_ADMIN')
     ORDER BY security.author_code COLLATE "C"
     FOR UPDATE
  LOOP
    qualifying_role_count:=qualifying_role_count+1;
  END LOOP;
  IF qualifying_role_count<1 THEN
    RAISE EXCEPTION 'runtime system administrator authority is required'
      USING ERRCODE='42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_guard_allows(
  requested_process text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT EXISTS(
    SELECT 1
      FROM framework_project_runtime_purge_receipt receipt
     WHERE receipt.receipt_id::text=
             current_setting('carbonet.project_runtime_purge_receipt',true)
       AND receipt.process_code=requested_process
       AND receipt.receipt_status IN ('PURGING','RESTORING')
  )
$$;

-- Keep the immutable-process protection, but admit only the exact receipt that
-- the SECURITY DEFINER purge/restore transaction has already locked and moved
-- into its transient state.  An arbitrary session GUC is insufficient.
CREATE OR REPLACE FUNCTION framework_guard_locked_process_definition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE revision_allowed boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM framework_process_design_revision_lease lease
     WHERE lease.backend_pid=pg_backend_pid()
       AND lease.transaction_id=txid_current()
       AND lease.process_code=OLD.process_code)
    INTO revision_allowed;
  IF TG_OP='DELETE' AND OLD.definition_locked
     AND NOT (revision_allowed OR
       framework_project_runtime_purge_guard_allows(OLD.process_code)) THEN
    RAISE EXCEPTION 'Implemented process % is read-only',OLD.process_code
      USING ERRCODE='55000';
  END IF;
  IF TG_OP='UPDATE' AND OLD.definition_locked
     AND NOT (revision_allowed OR
       framework_project_runtime_purge_guard_allows(OLD.process_code)) AND (
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
    RAISE EXCEPTION 'Implemented process % structure is read-only',OLD.process_code
      USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION framework_guard_locked_process_step()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE target_process_code text; target_locked boolean;
DECLARE revision_allowed boolean;
BEGIN
  target_process_code:=CASE WHEN TG_OP='DELETE'
    THEN OLD.process_code ELSE NEW.process_code END;
  SELECT definition_locked INTO target_locked
    FROM framework_process_definition
   WHERE process_code=target_process_code;
  SELECT EXISTS(
    SELECT 1 FROM framework_process_design_revision_lease lease
     WHERE lease.backend_pid=pg_backend_pid()
       AND lease.transaction_id=txid_current()
       AND lease.process_code=target_process_code)
    INTO revision_allowed;
  IF coalesce(target_locked,false)
     AND NOT (revision_allowed OR
       framework_project_runtime_purge_guard_allows(target_process_code)) THEN
    RAISE EXCEPTION 'Implemented process % steps are read-only',target_process_code
      USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION framework_guard_locked_simulation_case()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE target_process_code text; target_locked boolean;
DECLARE revision_allowed boolean;
BEGIN
  target_process_code:=CASE WHEN TG_OP='DELETE'
    THEN OLD.process_code ELSE NEW.process_code END;
  SELECT definition_locked INTO target_locked
    FROM framework_process_definition
   WHERE process_code=target_process_code;
  SELECT EXISTS(
    SELECT 1 FROM framework_process_design_revision_lease lease
     WHERE lease.backend_pid=pg_backend_pid()
       AND lease.transaction_id=txid_current()
       AND lease.process_code=target_process_code)
    INTO revision_allowed;
  IF NOT coalesce(target_locked,false)
     OR revision_allowed
     OR framework_project_runtime_purge_guard_allows(target_process_code) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP IN ('INSERT','DELETE') THEN
    RAISE EXCEPTION 'Implemented process % simulation contract is read-only',
      target_process_code USING ERRCODE='55000';
  END IF;
  IF NEW.case_code IS DISTINCT FROM OLD.case_code OR
     NEW.process_code IS DISTINCT FROM OLD.process_code OR
     NEW.case_name IS DISTINCT FROM OLD.case_name OR
     NEW.case_type IS DISTINCT FROM OLD.case_type OR
     NEW.preconditions IS DISTINCT FROM OLD.preconditions OR
     NEW.steps_json IS DISTINCT FROM OLD.steps_json OR
     NEW.assertions_json IS DISTINCT FROM OLD.assertions_json THEN
    RAISE EXCEPTION 'Implemented process % simulation contract is read-only',
      target_process_code USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_lock_keys(
  requested_project text,requested_process text
) RETURNS void
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
DECLARE lock_key text;
BEGIN
  FOR lock_key IN
    SELECT key_value FROM unnest(ARRAY[
      'BACKSTAGE_DESIGN_RELEASE_V1:'||requested_project,
      'CANONICAL_PROCESS_PUBLICATION_V1:'||requested_process,
      'PROJECT_RUNTIME_PURGE_V1:'||requested_project
    ]) key_value ORDER BY key_value COLLATE "C"
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key,0));
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_snapshot_insert(
  requested_receipt uuid,requested_table oid,requested_depth integer,
  requested_sql text,requested_project text,requested_process text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE inserted integer;
BEGIN
  IF requested_sql IS NULL OR requested_sql!~'^SELECT to_jsonb\(row_value\) '
     OR requested_table IS NULL THEN
    RAISE EXCEPTION 'unsafe runtime purge inventory query'
      USING ERRCODE='22023';
  END IF;
  EXECUTE format(
    'insert into framework_project_runtime_purge_snapshot_row('
    'receipt_id,table_oid,table_name,dependency_depth,row_hash,row_payload) '
    'select $1,%s,%L,$2,framework_project_runtime_purge_hash(payload),payload '
    'from (%s) scoped(payload) on conflict do nothing',
    requested_table,requested_table::regclass::text,requested_sql
  ) USING requested_receipt,requested_depth,requested_project,requested_process;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN inserted;
END
$$;

-- Runtime tables have INSERT/UPDATE projection triggers (screen generation
-- state, endpoint runtime resources, applicability history). A restore must
-- reproduce captured rows without executing those projections a second time.
-- PostgreSQL constraint triggers stay enabled; ALTER TABLE and all row changes
-- roll back together on any failure.
CREATE OR REPLACE FUNCTION framework_project_runtime_purge_set_user_triggers(
  requested_receipt uuid,requested_enabled boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE table_row record;
BEGIN
  FOR table_row IN
    SELECT captured.table_oid,captured.table_name
      FROM (SELECT DISTINCT snapshot.table_oid,snapshot.table_name
              FROM framework_project_runtime_purge_snapshot_row snapshot
             WHERE snapshot.receipt_id=requested_receipt) captured
     ORDER BY captured.table_name COLLATE "C",captured.table_oid
  LOOP
    IF NOT requested_enabled THEN
      EXECUTE format('lock table %s in access exclusive mode',
        table_row.table_oid::regclass);
      IF EXISTS(
        SELECT 1 FROM pg_trigger trigger_row
         WHERE trigger_row.tgrelid=table_row.table_oid
           AND NOT trigger_row.tgisinternal
           AND trigger_row.tgenabled<>'O'
      ) THEN
        RAISE EXCEPTION 'runtime table has nonstandard user-trigger state: %',
          table_row.table_name USING ERRCODE='55000';
      END IF;
      EXECUTE format('alter table %s disable trigger user',
        table_row.table_oid::regclass);
    ELSE
      EXECUTE format('alter table %s enable trigger user',
        table_row.table_oid::regclass);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION framework_project_runtime_purge_build_snapshot(
  requested_receipt uuid,requested_project text,requested_process text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE table_row record; constraint_row record; join_contract text;
DECLARE snapshot_join_contract text;
DECLARE inserted integer:=0; round_inserted integer; has_project boolean;
DECLARE depth_round integer; depth_updates integer:=0; updated_rows integer;
DECLARE max_depth integer;
DECLARE query_text text;
BEGIN
  PERFORM set_config('carbonet.project_runtime_purge_build',
    requested_receipt::text,true);
  -- Root process and immutable runtime release receipt.
  IF to_regclass('public.framework_process_definition') IS NOT NULL THEN
    inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
      requested_receipt,'framework_process_definition'::regclass,0,
      'SELECT to_jsonb(row_value) FROM public.framework_process_definition row_value WHERE row_value.process_code=$4',
      requested_project,requested_process);
  END IF;
  inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
    requested_receipt,'framework_actor_process_design_release'::regclass,0,
    'SELECT to_jsonb(row_value) FROM public.framework_actor_process_design_release row_value WHERE row_value.project_id=$3',
    requested_project,requested_process);

  -- Every process-owned row is in scope.  Project-bearing tables are narrowed
  -- to the exact project so an execution belonging to another project blocks
  -- later instead of being silently captured.
  FOR table_row IN
    SELECT relation.oid table_oid,namespace.nspname schema_name,
           relation.relname table_name,
           EXISTS(SELECT 1 FROM pg_attribute attribute
                    WHERE attribute.attrelid=relation.oid
                      AND attribute.attname='project_id'
                      AND attribute.attnum>0 AND NOT attribute.attisdropped) has_project
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
      JOIN pg_attribute process_column
        ON process_column.attrelid=relation.oid
       AND process_column.attname='process_code'
       AND process_column.attnum>0 AND NOT process_column.attisdropped
     WHERE namespace.nspname='public' AND relation.relkind IN ('r','p')
       AND (relation.relname LIKE 'framework\_%' ESCAPE '\'
            OR (to_regclass('public.integrated_design_scope_binding') IS NULL
                AND relation.relname IN(
                  'integrated_design_document','integrated_design_authority')))
       AND relation.relname NOT LIKE 'framework_project_runtime_purge_%'
     ORDER BY relation.relname COLLATE "C"
  LOOP
    query_text:=format(
      'SELECT to_jsonb(row_value) FROM %I.%I row_value WHERE row_value.process_code=$4%s',
      table_row.schema_name,table_row.table_name,
      CASE WHEN table_row.has_project THEN ' AND row_value.project_id=$3' ELSE '' END
    );
    inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
      requested_receipt,table_row.table_oid,1,query_text,
      requested_project,requested_process);
  END LOOP;

  -- Composite design rows are project-owned only through the append-only
  -- scope binding installed by the later composite-authority migration. Never
  -- infer ownership from process_code once that binding contract exists.
  IF to_regclass('public.integrated_design_scope_binding') IS NOT NULL THEN
    inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
      requested_receipt,'integrated_design_scope_binding'::regclass,2,
      'SELECT to_jsonb(row_value) FROM public.integrated_design_scope_binding row_value '
      'WHERE row_value.scope_type=''PROJECT'' AND row_value.project_id=$3 '
      'AND row_value.process_code=$4',
      requested_project,requested_process);
    IF to_regclass('public.integrated_design_authority') IS NOT NULL THEN
      inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
        requested_receipt,'integrated_design_authority'::regclass,0,
        'SELECT to_jsonb(row_value) FROM public.integrated_design_authority row_value '
        'WHERE EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
        'WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$3 '
        'AND binding.process_code=$4 AND binding.authority_id=row_value.authority_id)',
        requested_project,requested_process);
    END IF;
    IF to_regclass('public.integrated_design_document') IS NOT NULL THEN
      inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
        requested_receipt,'integrated_design_document'::regclass,0,
        'SELECT to_jsonb(row_value) FROM public.integrated_design_document row_value '
        'WHERE EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
        'WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$3 '
        'AND binding.process_code=$4 AND binding.process_code=row_value.process_code '
        'AND binding.step_code=row_value.step_code AND binding.route_path=row_value.route_path '
        'AND binding.audience=row_value.audience)',
        requested_project,requested_process);
    END IF;
  END IF;

  -- Exact project-scoped actor/step assignments do not carry process_code.
  FOR table_row IN
    SELECT to_regclass(table_name) table_oid,table_name
      FROM unnest(ARRAY[
        'public.framework_account_actor_assignment',
        'public.framework_project_actor_assignment',
        'public.framework_project_process_step_assignment'
      ]) table_name
     WHERE to_regclass(table_name) IS NOT NULL
     ORDER BY table_name COLLATE "C"
  LOOP
    query_text:=format(
      'SELECT to_jsonb(row_value) FROM %s row_value WHERE row_value.project_id=$3',
      table_row.table_oid::regclass
    );
    inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
      requested_receipt,table_row.table_oid,0,query_text,
      requested_project,requested_process);
  END LOOP;

  -- Generated source/runtime rows must self-identify the exact process and may
  -- optionally repeat the exact project.  Prefix-only matching is forbidden.
  IF to_regclass('public.framework_source_artifact') IS NOT NULL THEN
    inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
      requested_receipt,'framework_source_artifact'::regclass,0,
      'SELECT to_jsonb(row_value) FROM public.framework_source_artifact row_value '
      'WHERE upper(coalesce(row_value.metadata_json->>''processCode'',row_value.metadata_json->>''process_code'',''''))=$4 '
      'AND (nullif(coalesce(row_value.metadata_json->>''projectId'',row_value.metadata_json->>''project_id'',''''),'''') IS NULL '
      'OR upper(coalesce(row_value.metadata_json->>''projectId'',row_value.metadata_json->>''project_id''))=$3)',
      requested_project,requested_process);
  END IF;
  IF to_regclass('public.framework_runtime_resource') IS NOT NULL THEN
    inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
      requested_receipt,'framework_runtime_resource'::regclass,0,
      'SELECT to_jsonb(row_value) FROM public.framework_runtime_resource row_value '
      'WHERE (upper(coalesce(row_value.contract_json->>''processCode'',row_value.contract_json->>''process_code'',''''))=$4 '
      'AND (nullif(coalesce(row_value.contract_json->>''projectId'',row_value.contract_json->>''project_id'',''''),'''') IS NULL '
      'OR upper(coalesce(row_value.contract_json->>''projectId'',row_value.contract_json->>''project_id''))=$3)) '
      'OR (row_value.resource_kind=''ENDPOINT'' AND row_value.scope_code=''GLOBAL'' '
      'AND row_value.resource_key~''^[A-Z][A-Z0-9_-]{1,79}(:[^:]+)+$'' '
      'AND split_part(row_value.resource_key,'':'',1)=$4 '
      'AND row_value.contract_json->>''endpointKey''=row_value.resource_key)',
      requested_project,requested_process);
  END IF;
  IF to_regclass('public.framework_api_endpoint_registry') IS NOT NULL THEN
    inserted:=inserted+framework_project_runtime_purge_snapshot_insert(
      requested_receipt,'framework_api_endpoint_registry'::regclass,3,
      'SELECT to_jsonb(row_value) FROM public.framework_api_endpoint_registry row_value '
      'WHERE row_value.endpoint_key~''^[A-Z][A-Z0-9_-]{1,79}(:[^:]+)+$'' '
      'AND split_part(row_value.endpoint_key,'':'',1)=$4 '
      'AND (row_value.implementation_ref LIKE ''Generated%'' OR row_value.implementation_ref LIKE ''%/generated/%'')',
      requested_project,requested_process);
  END IF;

  -- Expand the complete FK descendant graph.  Only downward references are
  -- followed, so shared actors/common packages are never pulled into scope.
  LOOP
    round_inserted:=0;
    FOR constraint_row IN
      SELECT foreign_key.oid,foreign_key.conrelid child_oid,
             foreign_key.confrelid parent_oid,
             child_namespace.nspname child_schema,child.relname child_name,
             EXISTS(SELECT 1 FROM pg_attribute attribute
                      WHERE attribute.attrelid=foreign_key.conrelid
                        AND attribute.attname='project_id'
                        AND attribute.attnum>0 AND NOT attribute.attisdropped) child_has_project
        FROM pg_constraint foreign_key
        JOIN pg_class child ON child.oid=foreign_key.conrelid
        JOIN pg_namespace child_namespace ON child_namespace.oid=child.relnamespace
       WHERE foreign_key.contype='f'
         AND child_namespace.nspname='public'
         AND child.relkind IN ('r','p')
         AND (child.relname LIKE 'framework\_%' ESCAPE '\'
              OR child.relname IN(
                'integrated_design_document','integrated_design_document_version',
                'integrated_design_authority','integrated_design_authority_version',
                'integrated_design_scope_binding'))
         AND child.relname NOT LIKE 'framework_project_runtime_purge_%'
         AND EXISTS(
           SELECT 1 FROM framework_project_runtime_purge_snapshot_row scoped
            WHERE scoped.receipt_id=requested_receipt
              AND scoped.table_oid=foreign_key.confrelid)
       ORDER BY child.relname COLLATE "C",foreign_key.conname COLLATE "C"
    LOOP
      SELECT string_agg(format(
               '(to_jsonb(row_value)->%L)=(parent.row_payload->%L)',
               child_attribute.attname,parent_attribute.attname),
               ' AND ' ORDER BY key_position)
        INTO join_contract
        FROM generate_subscripts(
               (SELECT conkey FROM pg_constraint WHERE oid=constraint_row.oid),1
             ) key_position
        JOIN pg_attribute child_attribute
          ON child_attribute.attrelid=constraint_row.child_oid
         AND child_attribute.attnum=(
           SELECT conkey[key_position] FROM pg_constraint
            WHERE oid=constraint_row.oid)
        JOIN pg_attribute parent_attribute
          ON parent_attribute.attrelid=constraint_row.parent_oid
         AND parent_attribute.attnum=(
           SELECT confkey[key_position] FROM pg_constraint
            WHERE oid=constraint_row.oid);
      IF join_contract IS NULL THEN CONTINUE; END IF;
      query_text:=format(
        'SELECT to_jsonb(row_value) FROM %I.%I row_value '
        'WHERE %s AND EXISTS(SELECT 1 FROM public.framework_project_runtime_purge_snapshot_row parent '
        'WHERE parent.receipt_id=%L::uuid AND parent.table_oid=%s AND %s)%s',
        constraint_row.child_schema,constraint_row.child_name,
        CASE WHEN constraint_row.child_has_project THEN 'row_value.project_id=$3' ELSE 'true' END,
        requested_receipt,constraint_row.parent_oid,join_contract,
        ''
      );
      -- A descendant can be reachable through several parents.  ON CONFLICT
      -- makes expansion finite even for self-referential FK graphs.
      round_inserted:=round_inserted+framework_project_runtime_purge_snapshot_insert(
        requested_receipt,constraint_row.child_oid,2,query_text,
        requested_project,requested_process);
    END LOOP;
    inserted:=inserted+round_inserted;
    EXIT WHEN round_inserted=0;
  END LOOP;

  -- Compute row-level (not merely table-level) FK depth.  Nullable FK values
  -- are excluded and composite keys are matched exactly.  A 33rd possible
  -- increase proves either a captured FK cycle or a graph beyond the audited
  -- bound, so preview fails before any runtime row can be mutated.
  FOR depth_round IN 1..32 LOOP
    depth_updates:=0;
    FOR constraint_row IN
      SELECT foreign_key.oid,foreign_key.conrelid child_oid,
             foreign_key.confrelid parent_oid
        FROM pg_constraint foreign_key
       WHERE foreign_key.contype='f'
         AND EXISTS(SELECT 1
               FROM framework_project_runtime_purge_snapshot_row scoped
              WHERE scoped.receipt_id=requested_receipt
                AND scoped.table_oid=foreign_key.conrelid)
         AND EXISTS(SELECT 1
               FROM framework_project_runtime_purge_snapshot_row scoped
              WHERE scoped.receipt_id=requested_receipt
                AND scoped.table_oid=foreign_key.confrelid)
       ORDER BY foreign_key.conrelid,foreign_key.conname COLLATE "C"
    LOOP
      SELECT string_agg(format(
               'child.row_payload->%L is distinct from ''null''::jsonb '
               'and child.row_payload->%L is not null '
               'and child.row_payload->%L=parent.row_payload->%L',
               child_attribute.attname,child_attribute.attname,
               child_attribute.attname,parent_attribute.attname),
               ' AND ' ORDER BY key_position)
        INTO snapshot_join_contract
        FROM generate_subscripts(
               (SELECT conkey FROM pg_constraint WHERE oid=constraint_row.oid),1
             ) key_position
        JOIN pg_attribute child_attribute
          ON child_attribute.attrelid=constraint_row.child_oid
         AND child_attribute.attnum=(SELECT conkey[key_position]
               FROM pg_constraint WHERE oid=constraint_row.oid)
        JOIN pg_attribute parent_attribute
          ON parent_attribute.attrelid=constraint_row.parent_oid
         AND parent_attribute.attnum=(SELECT confkey[key_position]
               FROM pg_constraint WHERE oid=constraint_row.oid);
      IF snapshot_join_contract IS NULL THEN CONTINUE; END IF;
      EXECUTE format(
        'with parent_depth as ('
        ' select child.table_name,child.row_hash,'
        '        max(parent.dependency_depth)+1 next_depth'
        ' from public.framework_project_runtime_purge_snapshot_row child'
        ' join public.framework_project_runtime_purge_snapshot_row parent'
        '   on parent.receipt_id=child.receipt_id'
        '  and parent.table_oid=%s and %s'
        ' where child.receipt_id=$1 and child.table_oid=%s'
        ' group by child.table_name,child.row_hash)'
        ' update public.framework_project_runtime_purge_snapshot_row child'
        ' set dependency_depth=parent_depth.next_depth'
        ' from parent_depth where child.receipt_id=$1'
        ' and child.table_name=parent_depth.table_name'
        ' and child.row_hash=parent_depth.row_hash'
        ' and child.dependency_depth<parent_depth.next_depth',
        constraint_row.parent_oid,snapshot_join_contract,
        constraint_row.child_oid
      ) USING requested_receipt;
      GET DIAGNOSTICS updated_rows=ROW_COUNT;
      depth_updates:=depth_updates+updated_rows;
    END LOOP;
    EXIT WHEN depth_updates=0;
  END LOOP;
  IF depth_updates<>0 THEN
    RAISE EXCEPTION 'captured runtime FK graph exceeds depth 32 or contains a cycle'
      USING ERRCODE='54001';
  END IF;
  SELECT coalesce(max(dependency_depth),0) INTO max_depth
    FROM framework_project_runtime_purge_snapshot_row
   WHERE receipt_id=requested_receipt;
  IF max_depth>32 THEN
    RAISE EXCEPTION 'captured runtime FK depth % exceeds audited bound 32',max_depth
      USING ERRCODE='54001';
  END IF;
  PERFORM set_config('carbonet.project_runtime_purge_build','',true);
  RETURN inserted;
END
$$;

-- Fresh, predicate-based counts are intentionally independent from immutable
-- snapshot membership.  They detect rows inserted after preview and prevent a
-- misleading exactZero=true when a generator-owned endpoint/job/execution was
-- absent from (or concurrently added beyond) the captured preimage.
CREATE OR REPLACE FUNCTION framework_project_runtime_purge_scope_counts(
  requested_project text,requested_process text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE table_row record; table_count integer; process_count integer:=0;
DECLARE release_count integer:=0; endpoint_count integer:=0;
DECLARE package_count integer:=0; job_count integer:=0;
DECLARE execution_count integer:=0; draft_count integer:=0;
DECLARE assignment_count integer:=0; source_count integer:=0;
DECLARE runtime_resource_count integer:=0; integrated_count integer:=0;
DECLARE residual_count integer:=0;
BEGIN
  requested_project:=upper(btrim(coalesce(requested_project,'')));
  requested_process:=upper(btrim(coalesce(requested_process,'')));
  SELECT count(*)::integer INTO release_count
    FROM framework_actor_process_design_release
   WHERE project_id=requested_project;
  FOR table_row IN
    SELECT relation.oid,namespace.nspname schema_name,
           relation.relname table_name,
           EXISTS(SELECT 1 FROM pg_attribute attribute
                    WHERE attribute.attrelid=relation.oid
                      AND attribute.attname='project_id'
                      AND attribute.attnum>0 AND NOT attribute.attisdropped) has_project
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
      JOIN pg_attribute process_column
        ON process_column.attrelid=relation.oid
       AND process_column.attname='process_code'
       AND process_column.attnum>0 AND NOT process_column.attisdropped
     WHERE namespace.nspname='public' AND relation.relkind IN ('r','p')
       AND (relation.relname LIKE 'framework\_%' ESCAPE '\'
            OR (to_regclass('public.integrated_design_scope_binding') IS NULL
                AND relation.relname IN(
                  'integrated_design_document','integrated_design_authority')))
       AND relation.relname NOT LIKE 'framework_project_runtime_purge_%'
     ORDER BY relation.relname COLLATE "C"
  LOOP
    EXECUTE format('select count(*)::integer from %I.%I where process_code=$1%s',
      table_row.schema_name,table_row.table_name,
      CASE WHEN table_row.has_project THEN ' and project_id=$2' ELSE '' END)
      INTO table_count USING requested_process,requested_project;
    process_count:=process_count+table_count;
  END LOOP;
  IF to_regclass('public.integrated_design_scope_binding') IS NOT NULL THEN
    EXECUTE
      'SELECT '
      '(SELECT count(*) FROM public.integrated_design_scope_binding binding '
      '  WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$1 '
      '    AND binding.process_code=$2)+'
      '(SELECT count(*) FROM public.integrated_design_authority authority '
      '  WHERE EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
      '    WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$1 '
      '      AND binding.process_code=$2 AND binding.authority_id=authority.authority_id))+'
      '(SELECT count(*) FROM public.integrated_design_authority_version version '
      '  WHERE EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
      '    WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$1 '
      '      AND binding.process_code=$2 AND binding.authority_id=version.authority_id))+'
      '(SELECT count(*) FROM public.integrated_design_document document '
      '  WHERE EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
      '    WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$1 '
      '      AND binding.process_code=$2 AND binding.process_code=document.process_code '
      '      AND binding.step_code=document.step_code AND binding.route_path=document.route_path '
      '      AND binding.audience=document.audience))+'
      '(SELECT count(*) FROM public.integrated_design_document_version version '
      '  JOIN public.integrated_design_document document USING(document_id) '
      '  WHERE EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
      '    WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$1 '
      '      AND binding.process_code=$2 AND binding.process_code=document.process_code '
      '      AND binding.step_code=document.step_code AND binding.route_path=document.route_path '
      '      AND binding.audience=document.audience))'
      INTO integrated_count USING requested_project,requested_process;
    process_count:=process_count+integrated_count;
  END IF;
  IF to_regclass('public.framework_api_endpoint_registry') IS NOT NULL THEN
    SELECT count(*)::integer INTO endpoint_count
      FROM framework_api_endpoint_registry
     WHERE endpoint_key~'^[A-Z][A-Z0-9_-]{1,79}(:[^:]+)+$'
       AND split_part(endpoint_key,':',1)=requested_process;
  END IF;
  IF to_regclass('public.framework_screen_feature_binding') IS NOT NULL THEN
    SELECT count(*)::integer INTO package_count
      FROM framework_screen_feature_binding
     WHERE process_code=requested_process;
  END IF;
  IF to_regclass('public.framework_development_job') IS NOT NULL THEN
    SELECT count(*)::integer INTO job_count
      FROM framework_development_job
     WHERE process_code=requested_process;
  END IF;
  IF to_regclass('public.framework_process_execution') IS NOT NULL THEN
    SELECT count(*)::integer INTO execution_count
      FROM framework_process_execution
     WHERE process_code=requested_process AND project_id=requested_project;
  END IF;
  IF to_regclass('public.framework_process_work_draft') IS NOT NULL THEN
    SELECT count(*)::integer INTO draft_count
      FROM framework_process_work_draft
     WHERE process_code=requested_process AND project_id=requested_project;
  END IF;
  IF to_regclass('public.framework_account_actor_assignment') IS NOT NULL THEN
    SELECT assignment_count+count(*)::integer INTO assignment_count
      FROM framework_account_actor_assignment WHERE project_id=requested_project;
  END IF;
  IF to_regclass('public.framework_project_actor_assignment') IS NOT NULL THEN
    SELECT assignment_count+count(*)::integer INTO assignment_count
      FROM framework_project_actor_assignment WHERE project_id=requested_project;
  END IF;
  IF to_regclass('public.framework_project_process_step_assignment') IS NOT NULL THEN
    SELECT assignment_count+count(*)::integer INTO assignment_count
      FROM framework_project_process_step_assignment
     WHERE project_id=requested_project;
  END IF;
  IF to_regclass('public.framework_source_artifact') IS NOT NULL THEN
    SELECT count(*)::integer INTO source_count
      FROM framework_source_artifact source
     WHERE upper(coalesce(source.metadata_json->>'processCode',
                          source.metadata_json->>'process_code',''))=requested_process
       AND (nullif(coalesce(source.metadata_json->>'projectId',
                            source.metadata_json->>'project_id',''),'') IS NULL
            OR upper(coalesce(source.metadata_json->>'projectId',
                              source.metadata_json->>'project_id'))=requested_project);
  END IF;
  IF to_regclass('public.framework_runtime_resource') IS NOT NULL THEN
    SELECT count(*)::integer INTO runtime_resource_count
      FROM framework_runtime_resource resource
     WHERE (upper(coalesce(resource.contract_json->>'processCode',
                           resource.contract_json->>'process_code',''))=requested_process
       AND (nullif(coalesce(resource.contract_json->>'projectId',
                            resource.contract_json->>'project_id',''),'') IS NULL
            OR upper(coalesce(resource.contract_json->>'projectId',
                              resource.contract_json->>'project_id'))=requested_project))
        OR (resource.resource_kind='ENDPOINT' AND resource.scope_code='GLOBAL'
            AND resource.resource_key~'^[A-Z][A-Z0-9_-]{1,79}(:[^:]+)+$'
            AND split_part(resource.resource_key,':',1)=requested_process
            AND resource.contract_json->>'endpointKey'=resource.resource_key);
  END IF;
  residual_count:=release_count+process_count+assignment_count+source_count+
                  runtime_resource_count+endpoint_count;
  RETURN jsonb_build_object(
    'releaseRows',release_count,'processScopedRows',process_count,
    'endpointRows',endpoint_count,'packageBindings',package_count,
    'jobRows',job_count,'executionRows',execution_count,
    'draftRows',draft_count,'assignmentRows',assignment_count,
    'sourceRows',source_count,'runtimeResourceRows',runtime_resource_count,
    'residualRows',residual_count,'exactZero',residual_count=0);
END
$$;

-- Copy/upload failures can leave a Backstage project before the first design
-- release exists.  Local absence is never treated as runtime absence: this
-- read-only proof independently counts every exact project-bearing runtime row
-- and every generated source/resource carrying the exact project identity.
CREATE OR REPLACE FUNCTION framework_prove_project_runtime_absent(
  requested_proof uuid,requested_project text,requested_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE table_row record; table_count integer; project_count integer:=0;
DECLARE release_count integer:=0; source_count integer:=0;
DECLARE runtime_resource_count integer:=0; orphan_integrated_count integer:=0;
DECLARE residual_count integer;
DECLARE counts jsonb; proof_hash text;
BEGIN
  PERFORM framework_project_runtime_purge_require_admin(requested_actor);
  requested_project:=upper(btrim(coalesce(requested_project,'')));
  IF requested_proof IS NULL
     OR requested_project!~'^[A-Z][A-Z0-9_-]{2,63}$' THEN
    RAISE EXCEPTION 'canonical project runtime absence proof identity is required'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'BACKSTAGE_DESIGN_RELEASE_V1:'||requested_project,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'PROJECT_RUNTIME_PURGE_V1:'||requested_project,0));
  FOR table_row IN
    SELECT relation.oid,namespace.nspname schema_name,relation.relname table_name
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
      JOIN pg_attribute project_column
        ON project_column.attrelid=relation.oid
       AND project_column.attname='project_id'
       AND project_column.attnum>0 AND NOT project_column.attisdropped
     WHERE namespace.nspname='public' AND relation.relkind IN ('r','p')
       AND (relation.relname LIKE 'framework\_%' ESCAPE '\'
            OR relation.relname='integrated_design_scope_binding')
       AND relation.relname NOT LIKE 'framework_project_runtime_purge_%'
       AND relation.relname<>'framework_project_runtime_absence_fence'
     ORDER BY relation.relname COLLATE "C"
  LOOP
    EXECUTE format('select count(*)::integer from %I.%I where project_id=$1',
      table_row.schema_name,table_row.table_name)
      INTO table_count USING requested_project;
    project_count:=project_count+table_count;
    IF table_row.table_name='framework_actor_process_design_release' THEN
      release_count:=table_count;
    END IF;
  END LOOP;
  IF to_regclass('public.framework_source_artifact') IS NOT NULL THEN
    SELECT count(*)::integer INTO source_count
      FROM framework_source_artifact source
     WHERE upper(coalesce(source.metadata_json->>'projectId',
                          source.metadata_json->>'project_id',''))=requested_project;
  END IF;
  IF to_regclass('public.framework_runtime_resource') IS NOT NULL THEN
    SELECT count(*)::integer INTO runtime_resource_count
      FROM framework_runtime_resource resource
     WHERE upper(coalesce(resource.contract_json->>'projectId',
                          resource.contract_json->>'project_id',''))=requested_project;
  END IF;
  IF to_regclass('public.integrated_design_scope_binding') IS NOT NULL THEN
    EXECUTE
      'SELECT '
      '(SELECT count(*) FROM public.integrated_design_authority authority '
      '  WHERE NOT EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
      '    WHERE binding.authority_id=authority.authority_id))+'
      '(SELECT count(*) FROM public.integrated_design_document document '
      '  WHERE NOT EXISTS(SELECT 1 FROM public.integrated_design_scope_binding binding '
      '    WHERE binding.process_code=document.process_code '
      '      AND binding.step_code=document.step_code AND binding.route_path=document.route_path '
      '      AND binding.audience=document.audience))'
      INTO orphan_integrated_count;
  ELSIF to_regclass('public.integrated_design_document') IS NOT NULL
        OR to_regclass('public.integrated_design_authority') IS NOT NULL THEN
    IF to_regclass('public.integrated_design_document') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.integrated_design_document'
        INTO table_count;
      orphan_integrated_count:=orphan_integrated_count+table_count;
    END IF;
    IF to_regclass('public.integrated_design_authority') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.integrated_design_authority'
        INTO table_count;
      orphan_integrated_count:=orphan_integrated_count+table_count;
    END IF;
  END IF;
  -- Unbound composite rows have no project provenance. Treating unrelated
  -- legacy/global workbench data as this project's residue would make every
  -- empty-project deletion fail forever.  They are surfaced as a global
  -- integrity warning, while exact PROJECT bindings remain blocking through
  -- project_count above.
  residual_count:=project_count+source_count+runtime_resource_count;
  counts:=jsonb_build_object(
    'projectScopedRows',project_count,'releaseRows',release_count,
    'sourceRows',source_count,'runtimeResourceRows',runtime_resource_count,
    'globalIntegrityWarning',orphan_integrated_count>0,
    'globalIntegratedIntegrityWarningRows',orphan_integrated_count,
    'residualRows',residual_count,'exactZero',residual_count=0);
  proof_hash:=framework_project_runtime_purge_hash(jsonb_build_object(
    'schema','carbonet.project-runtime-absence-proof/v1',
    'proofId',requested_proof,'projectId',requested_project,'counts',counts));
  RETURN jsonb_build_object(
    'success',residual_count=0,
    'status',CASE WHEN residual_count=0 THEN 'PROVEN_ABSENT' ELSE 'BLOCKED' END,
    'proofId',requested_proof,'projectId',requested_project,
    'projectScopedRows',project_count,'releaseRows',release_count,
    'sourceRows',source_count,'runtimeResourceRows',runtime_resource_count,
    'globalIntegrityWarning',orphan_integrated_count>0,
    'globalIntegratedIntegrityWarningRows',orphan_integrated_count,
    'residualRows',residual_count,'exactZero',residual_count=0,
    'proofSha256',proof_hash);
END
$$;

CREATE OR REPLACE FUNCTION framework_activate_project_runtime_absence_fence(
  requested_proof uuid,requested_project text,requested_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE existing framework_project_runtime_absence_fence%ROWTYPE;
DECLARE proof jsonb; proof_hash text;
BEGIN
  PERFORM framework_project_runtime_purge_require_admin(requested_actor);
  requested_project:=upper(btrim(coalesce(requested_project,'')));
  requested_actor:=btrim(coalesce(requested_actor,''));
  IF requested_proof IS NULL
     OR requested_project!~'^[A-Z][A-Z0-9_-]{2,63}$' THEN
    RAISE EXCEPTION 'canonical project runtime absence fence identity is required'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'BACKSTAGE_DESIGN_RELEASE_V1:'||requested_project,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'PROJECT_RUNTIME_PURGE_V1:'||requested_project,0));
  SELECT * INTO existing
    FROM framework_project_runtime_absence_fence
   WHERE proof_id=requested_proof FOR UPDATE;
  IF FOUND THEN
    IF existing.project_id<>requested_project THEN
      RAISE EXCEPTION 'project runtime absence fence identity conflict'
        USING ERRCODE='23505';
    END IF;
    RETURN existing.proof_json||jsonb_build_object(
      'fenceStatus',existing.fence_status,'activated',
      existing.fence_status='ACTIVE','idempotent',true);
  END IF;
  IF EXISTS(
    SELECT 1 FROM framework_project_runtime_absence_fence fence
     WHERE fence.project_id=requested_project
       AND fence.fence_status='ACTIVE' FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'project runtime absence fence is already active'
      USING ERRCODE='23505';
  END IF;
  proof:=framework_prove_project_runtime_absent(
    requested_proof,requested_project,requested_actor);
  IF coalesce((proof->>'exactZero')::boolean,false) IS NOT TRUE
     OR proof->>'status'<>'PROVEN_ABSENT' THEN
    RETURN proof||jsonb_build_object(
      'fenceStatus','NOT_ACTIVE','activated',false,'idempotent',false);
  END IF;
  proof_hash:=proof->>'proofSha256';
  INSERT INTO framework_project_runtime_absence_fence(
    proof_id,project_id,fence_status,proof_json,proof_sha256,requested_by
  ) VALUES(
    requested_proof,requested_project,'ACTIVE',proof,proof_hash,requested_actor
  );
  RETURN proof||jsonb_build_object(
    'fenceStatus','ACTIVE','activated',true,'idempotent',false);
END
$$;

CREATE OR REPLACE FUNCTION framework_release_project_runtime_absence_fence(
  requested_proof uuid,requested_project text,requested_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE existing framework_project_runtime_absence_fence%ROWTYPE;
DECLARE release_proof jsonb; release_hash text;
BEGIN
  PERFORM framework_project_runtime_purge_require_admin(requested_actor);
  requested_project:=upper(btrim(coalesce(requested_project,'')));
  requested_actor:=btrim(coalesce(requested_actor,''));
  IF requested_proof IS NULL
     OR requested_project!~'^[A-Z][A-Z0-9_-]{2,63}$' THEN
    RAISE EXCEPTION 'canonical project runtime absence fence identity is required'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'BACKSTAGE_DESIGN_RELEASE_V1:'||requested_project,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'PROJECT_RUNTIME_PURGE_V1:'||requested_project,0));
  SELECT * INTO existing
    FROM framework_project_runtime_absence_fence
   WHERE proof_id=requested_proof FOR UPDATE;
  IF NOT FOUND THEN
    -- Recovery can own an expired PREPARED saga before the original caller's
    -- activation reaches PostgreSQL.  Persisting a RELEASED tombstone makes
    -- that proof id non-reactivatable, so a delayed activation cannot install
    -- an orphan fence after recovery has declared no mutation.
    release_proof:=jsonb_build_object(
      'success',true,'status','NOT_ACTIVATED','proofId',requested_proof,
      'projectId',requested_project,'exactZero',false,
      'neverActivated',true);
    release_hash:=framework_project_runtime_purge_hash(release_proof);
    INSERT INTO framework_project_runtime_absence_fence(
      proof_id,project_id,fence_status,proof_json,proof_sha256,requested_by,
      released_at
    ) VALUES(
      requested_proof,requested_project,'RELEASED',release_proof,release_hash,
      requested_actor,clock_timestamp()
    );
    RETURN jsonb_build_object(
      'success',true,'proofId',requested_proof,'projectId',requested_project,
      'fenceStatus','RELEASED','neverActivated',true,'idempotent',false);
  END IF;
  IF existing.project_id<>requested_project THEN
    RAISE EXCEPTION 'project runtime absence fence not found'
      USING ERRCODE='P0002';
  END IF;
  IF existing.fence_status='RELEASED' THEN
    RETURN jsonb_build_object(
      'success',true,'proofId',requested_proof,'projectId',requested_project,
      'fenceStatus','RELEASED','idempotent',true);
  END IF;
  UPDATE framework_project_runtime_absence_fence SET
    fence_status='RELEASED',released_at=clock_timestamp(),
    updated_at=clock_timestamp()
   WHERE proof_id=requested_proof AND fence_status='ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project runtime absence fence CAS is not exact'
      USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object(
    'success',true,'proofId',requested_proof,'projectId',requested_project,
    'fenceStatus','RELEASED','idempotent',false);
END
$$;

-- Persistent cross-database write fence.  Every relevant writer takes the
-- same C-ordered advisory keys as purge/absence activation, then checks the
-- committed PURGED tombstone or ACTIVE no-release fence.  There is no
-- caller-controlled bypass; restore changes the receipt to RESTORING before
-- re-inserting its exact snapshot.
CREATE OR REPLACE FUNCTION framework_guard_project_runtime_write_fence()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE payload jsonb; payloads jsonb[]; identity jsonb;
DECLARE identities jsonb[]:=ARRAY[]::jsonb[];
DECLARE lock_key text; lock_keys text[]:=ARRAY[]::text[];
DECLARE resolved_project text; resolved_process text;
BEGIN
  payloads:=ARRAY[to_jsonb(NEW)];
  IF TG_OP='UPDATE' THEN payloads:=array_append(payloads,to_jsonb(OLD)); END IF;
  FOREACH payload IN ARRAY payloads LOOP
    resolved_project:=upper(btrim(coalesce(
      payload->>'project_id',payload->>'projectId','')));
    resolved_process:=upper(btrim(coalesce(
      payload->>'process_code',payload->>'processCode','')));
    IF TG_TABLE_NAME='framework_actor_process_design_release' THEN
      resolved_project:=upper(btrim(coalesce(payload->>'project_id','')));
      resolved_process:=upper(btrim(coalesce(
        payload#>>'{contract_payload,process,processCode}','')));
    ELSIF TG_TABLE_NAME='framework_source_artifact' THEN
      resolved_project:=upper(btrim(coalesce(
        payload#>>'{metadata_json,projectId}',
        payload#>>'{metadata_json,project_id}','')));
      resolved_process:=upper(btrim(coalesce(
        payload#>>'{metadata_json,processCode}',
        payload#>>'{metadata_json,process_code}','')));
    ELSIF TG_TABLE_NAME='framework_runtime_resource' THEN
      resolved_project:=upper(btrim(coalesce(
        payload#>>'{contract_json,projectId}',
        payload#>>'{contract_json,project_id}','')));
      resolved_process:=upper(btrim(coalesce(
        payload#>>'{contract_json,processCode}',
        payload#>>'{contract_json,process_code}','')));
      IF resolved_process=''
         AND payload->>'resource_kind'='ENDPOINT'
         AND payload->>'scope_code'='GLOBAL'
         AND payload->>'resource_key'~'^[A-Z][A-Z0-9_-]{1,79}(:[^:]+)+$'
         AND payload#>>'{contract_json,endpointKey}'=payload->>'resource_key' THEN
        resolved_process:=split_part(payload->>'resource_key',':',1);
      END IF;
    ELSIF TG_TABLE_NAME='framework_api_endpoint_registry' THEN
      resolved_project:='';
      IF payload->>'endpoint_key'~'^[A-Z][A-Z0-9_-]{1,79}(:[^:]+)+$' THEN
        resolved_process:=split_part(payload->>'endpoint_key',':',1);
      ELSE
        resolved_process:='';
      END IF;
    END IF;
    IF resolved_project!~'^[A-Z][A-Z0-9_-]{2,63}$' THEN
      resolved_project:=NULL;
    END IF;
    IF resolved_process!~'^[A-Z][A-Z0-9_:-]{1,79}$' THEN
      resolved_process:=NULL;
    END IF;
    identities:=array_append(identities,jsonb_build_object(
      'projectId',resolved_project,'processCode',resolved_process));
    IF resolved_project IS NOT NULL THEN
      lock_keys:=array_append(lock_keys,
        'BACKSTAGE_DESIGN_RELEASE_V1:'||resolved_project);
      lock_keys:=array_append(lock_keys,
        'PROJECT_RUNTIME_PURGE_V1:'||resolved_project);
    END IF;
    IF resolved_process IS NOT NULL THEN
      lock_keys:=array_append(lock_keys,
        'CANONICAL_PROCESS_PUBLICATION_V1:'||resolved_process);
    END IF;
  END LOOP;
  FOR lock_key IN
    SELECT unique_key.candidate FROM (
      SELECT DISTINCT candidate COLLATE "C" candidate
        FROM unnest(lock_keys) candidate
       WHERE candidate IS NOT NULL
    ) unique_key ORDER BY unique_key.candidate
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key,0));
  END LOOP;
  FOREACH identity IN ARRAY identities LOOP
    resolved_project:=nullif(identity->>'projectId','');
    resolved_process:=nullif(identity->>'processCode','');
    IF resolved_project IS NOT NULL AND EXISTS(
      SELECT 1 FROM framework_project_runtime_absence_fence fence
       WHERE fence.project_id=resolved_project AND fence.fence_status='ACTIVE'
    ) THEN
      RAISE EXCEPTION 'project % has an active runtime absence fence',
        resolved_project USING ERRCODE='55000';
    END IF;
    IF EXISTS(
      SELECT 1 FROM framework_project_runtime_purge_receipt receipt
       WHERE receipt.receipt_status='PURGED'
         AND ((resolved_project IS NOT NULL
               AND receipt.project_id=resolved_project)
           OR (resolved_process IS NOT NULL
               AND receipt.process_code=resolved_process))
    ) THEN
      RAISE EXCEPTION 'project runtime is durably purged for project % process %',
        coalesce(resolved_project,'?'),coalesce(resolved_process,'?')
        USING ERRCODE='55000';
    END IF;
  END LOOP;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION framework_install_project_runtime_write_fences()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE table_row record; installed integer:=0;
BEGIN
  FOR table_row IN
    SELECT relation.oid,namespace.nspname,relation.relname
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
     WHERE namespace.nspname='public' AND relation.relkind IN ('r','p')
       AND NOT relation.relispartition
       AND relation.relname NOT LIKE 'framework_project_runtime_purge_%'
       AND relation.relname<>'framework_project_runtime_absence_fence'
       AND (
         relation.relname IN(
           'framework_actor_process_design_release',
           'framework_api_endpoint_registry','framework_source_artifact',
           'framework_runtime_resource')
         OR ((relation.relname LIKE 'framework\_%' ESCAPE '\'
              OR relation.relname LIKE 'integrated_design\_%' ESCAPE '\')
           AND EXISTS(
             SELECT 1 FROM pg_attribute attribute
              WHERE attribute.attrelid=relation.oid
                AND attribute.attname IN ('project_id','process_code')
                AND attribute.attnum>0 AND NOT attribute.attisdropped))
       )
     ORDER BY relation.relname COLLATE "C",relation.oid
  LOOP
    IF NOT EXISTS(
      SELECT 1 FROM pg_trigger trigger_row
       WHERE trigger_row.tgrelid=table_row.oid
         AND trigger_row.tgname='trg_project_runtime_write_fence'
         AND NOT trigger_row.tgisinternal
    ) THEN
      EXECUTE format(
        'create trigger trg_project_runtime_write_fence '
        'before insert or update on %I.%I for each row '
        'execute function framework_guard_project_runtime_write_fence()',
        table_row.nspname,table_row.relname);
      installed:=installed+1;
    END IF;
  END LOOP;
  RETURN installed;
END
$$;

CREATE OR REPLACE FUNCTION framework_preview_project_runtime_purge(
  requested_receipt uuid,requested_operation uuid,requested_project text,
  requested_process text,requested_design_version integer,
  requested_contract_sha256 text,requested_scope_mode text,
  requested_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE release_row framework_actor_process_design_release%ROWTYPE;
DECLARE resolved_scope text; snapshot_hash text; impact jsonb; blockers jsonb;
DECLARE captured_scope_counts jsonb;
DECLARE shared_release_count integer:=0; external_project_count integer:=0;
DECLARE project_process_identity_count integer:=0;
DECLARE external_handoff_count integer:=0; manual_count integer:=0;
DECLARE unsafe_endpoint_count integer:=0; snapshot_count integer:=0;
DECLARE materialized_artifact_count integer:=0;
DECLARE shared_integrated_scope_count integer:=0;
DECLARE forged_integrated_binding_count integer:=0;
DECLARE existing framework_project_runtime_purge_receipt%ROWTYPE;
DECLARE table_row record; external_count integer; test_owned boolean; qa_owned boolean;
DECLARE requirement_owned boolean;
BEGIN
  PERFORM framework_project_runtime_purge_require_admin(requested_actor);
  requested_project:=upper(btrim(coalesce(requested_project,'')));
  requested_process:=upper(btrim(coalesce(requested_process,'')));
  requested_contract_sha256:=lower(btrim(coalesce(requested_contract_sha256,'')));
  requested_scope_mode:=upper(btrim(coalesce(requested_scope_mode,'')));
  requested_actor:=btrim(coalesce(requested_actor,''));
  IF requested_receipt IS NULL OR requested_operation IS NULL
     OR requested_project!~'^[A-Z][A-Z0-9_-]{2,63}$'
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$'
     OR requested_design_version<1
     OR requested_contract_sha256!~'^[0-9a-f]{64}$'
     OR requested_actor!~'^[A-Za-z0-9._@-]{2,120}$' THEN
    RAISE EXCEPTION 'canonical project runtime purge identity is required'
      USING ERRCODE='22023';
  END IF;
  PERFORM framework_project_runtime_purge_lock_keys(
    requested_project,requested_process);

  SELECT * INTO existing
    FROM framework_project_runtime_purge_receipt
   WHERE project_id=requested_project AND operation_key=requested_operation
   FOR UPDATE;
  IF FOUND THEN
    IF existing.receipt_id<>requested_receipt
       OR existing.process_code<>requested_process
       OR existing.design_version<>requested_design_version
       OR existing.contract_sha256<>requested_contract_sha256 THEN
      RAISE EXCEPTION 'project runtime purge idempotency identity conflict'
        USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'success',existing.receipt_status<>'BLOCKED','idempotent',true,
      'receiptId',existing.receipt_id,'status',existing.receipt_status,
      'operationKey',existing.operation_key,
      'projectId',existing.project_id,'processCode',existing.process_code,
      'designVersion',existing.design_version,
      'contractSha256',existing.contract_sha256,
      'scopeMode',existing.scope_mode,'snapshotSha256',existing.snapshot_sha256,
      'impact',existing.impact_json,'blockers',existing.blocker_json,
      'postcondition',existing.postcondition_json
    );
  END IF;

  SELECT * INTO release_row
    FROM framework_actor_process_design_release release
   WHERE release.project_id=requested_project
     AND release.design_version=requested_design_version
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project runtime design release not found'
      USING ERRCODE='P0002';
  END IF;
  IF release_row.contract_sha256<>requested_contract_sha256
     OR upper(coalesce(release_row.contract_payload#>>'{process,processCode}',''))
          <>requested_process THEN
    RAISE EXCEPTION 'project runtime design release CAS mismatch'
      USING ERRCODE='40001';
  END IF;
  IF EXISTS(
    SELECT 1 FROM framework_actor_process_design_release newer
     WHERE newer.project_id=requested_project
       AND newer.design_version>requested_design_version
  ) THEN
    RAISE EXCEPTION 'project runtime design release is not the exact head'
      USING ERRCODE='40001';
  END IF;

  test_owned:=jsonb_path_exists(
    release_row.contract_payload,'strict $.**.testOwned ? (@ == true)');
  qa_owned:=jsonb_path_exists(
    release_row.contract_payload,'strict $.**.qaProvenance ? (@ != null)');
  requirement_owned:=
    upper(coalesce(release_row.source_system,''))='BACKSTAGE'
    AND upper(coalesce(release_row.contract_payload#>>'{source,type}',''))=
          'REQUIREMENT_DOCUMENT'
    AND upper(coalesce(release_row.contract_payload#>>'{source,processCode}',''))=
          requested_process
    AND coalesce(release_row.contract_payload#>>'{source,documentSha256}','')
          ~'^[0-9a-f]{64}$'
    AND coalesce(release_row.contract_payload#>>'{source,textSha256}','')
          ~'^[0-9a-f]{64}$'
    AND coalesce(release_row.contract_payload#>>'{source,contentSha256}','')=
          coalesce(release_row.contract_payload->>'contentSha256','')
    AND release_row.contract_payload#>>'{generation,strategy}'=
          'METADATA_FIRST_INCREMENTAL'
    AND release_row.contract_payload#>>'{reconciliation,staleIdentityIntent}'=
          'REMOVE_GENERATOR_OWNED_MISSING';
  resolved_scope:=CASE
    WHEN requested_scope_mode='EXACT_PROJECT'
         AND (test_owned OR qa_owned OR requirement_owned)
      THEN 'EXACT_PROJECT'
    WHEN test_owned THEN 'TEST_OWNED'
    WHEN qa_owned THEN 'QA_PROVENANCE'
    ELSE NULL END;
  IF resolved_scope IS NULL THEN
    RAISE EXCEPTION 'signed testOwned, qaProvenance or exact Backstage requirement provenance is required'
      USING ERRCODE='42501';
  END IF;

  SELECT count(*)::integer INTO shared_release_count
    FROM framework_actor_process_design_release other_release
   WHERE other_release.project_id<>requested_project
     AND upper(coalesce(
       other_release.contract_payload#>>'{process,processCode}',''))=requested_process;
  SELECT count(DISTINCT upper(coalesce(
           release.contract_payload#>>'{process,processCode}','')))::integer
    INTO project_process_identity_count
    FROM framework_actor_process_design_release release
   WHERE release.project_id=requested_project
     AND nullif(release.contract_payload#>>'{process,processCode}','') IS NOT NULL;

  -- Project-bearing process rows outside the exact project are shared runtime
  -- state.  They are blockers, never deletion candidates.
  FOR table_row IN
    SELECT relation.oid,namespace.nspname schema_name,relation.relname table_name
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
     WHERE namespace.nspname='public' AND relation.relkind IN ('r','p')
       AND EXISTS(SELECT 1 FROM pg_attribute attribute
                    WHERE attribute.attrelid=relation.oid
                      AND attribute.attname='process_code'
                      AND attribute.attnum>0 AND NOT attribute.attisdropped)
       AND EXISTS(SELECT 1 FROM pg_attribute attribute
                    WHERE attribute.attrelid=relation.oid
                      AND attribute.attname='project_id'
                      AND attribute.attnum>0 AND NOT attribute.attisdropped)
       AND relation.relname NOT LIKE 'framework_project_runtime_purge_%'
     ORDER BY relation.relname COLLATE "C"
  LOOP
    EXECUTE format(
      'select count(*)::integer from %I.%I where process_code=$1 and project_id<>$2',
      table_row.schema_name,table_row.table_name
    ) INTO external_count USING requested_process,requested_project;
    external_project_count:=external_project_count+external_count;
  END LOOP;
  IF to_regclass('public.framework_process_data_handoff') IS NOT NULL THEN
    SELECT count(*)::integer INTO external_handoff_count
      FROM framework_process_data_handoff
     WHERE to_process_code=requested_process
       AND process_code<>requested_process;
  END IF;
  IF to_regclass('public.framework_process_definition') IS NOT NULL THEN
    SELECT external_handoff_count+count(*)::integer INTO external_handoff_count
      FROM framework_process_definition
     WHERE parent_process_code=requested_process
       AND process_code<>requested_process;
  END IF;
  IF to_regclass('public.framework_api_endpoint_registry') IS NOT NULL THEN
    SELECT count(*)::integer INTO unsafe_endpoint_count
      FROM framework_api_endpoint_registry endpoint
     WHERE endpoint.endpoint_key~'^[A-Z][A-Z0-9_-]{1,79}(:[^:]+)+$'
       AND split_part(endpoint.endpoint_key,':',1)=requested_process
       AND endpoint.implementation_ref NOT LIKE 'Generated%'
       AND endpoint.implementation_ref NOT LIKE '%/generated/%';
  END IF;
  IF to_regclass('public.integrated_design_scope_binding') IS NOT NULL THEN
    EXECUTE
      'SELECT count(DISTINCT identity.process_code)::integer FROM ('
      ' SELECT upper(coalesce(release.contract_payload#>>''{process,processCode}'','''')) process_code '
      '   FROM public.framework_actor_process_design_release release '
      '  WHERE release.project_id=$1 '
      ' UNION ALL '
      ' SELECT upper(binding.process_code) process_code '
      '   FROM public.integrated_design_scope_binding binding '
      '  WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$1'
      ') identity WHERE nullif(identity.process_code,'''') IS NOT NULL'
      INTO project_process_identity_count USING requested_project;
    EXECUTE
      'SELECT count(DISTINCT (owned.process_code,owned.step_code,'
      ' owned.route_path,owned.audience))::integer '
      'FROM public.integrated_design_scope_binding owned '
      'WHERE owned.scope_type=''PROJECT'' AND owned.project_id=$1 '
      '  AND owned.process_code=$4 AND EXISTS('
      '    SELECT 1 FROM public.integrated_design_scope_binding shared '
      '     WHERE shared.process_code=owned.process_code '
      '       AND shared.step_code=owned.step_code '
      '       AND shared.route_path=owned.route_path '
      '       AND shared.audience=owned.audience '
      '       AND coalesce(shared.project_id,''GLOBAL'')<>$1)'
      INTO shared_integrated_scope_count
      USING requested_project,requested_design_version,
            requested_contract_sha256,requested_process;
    EXECUTE
      'SELECT count(*)::integer '
      'FROM public.integrated_design_scope_binding binding '
      'LEFT JOIN public.integrated_design_authority authority '
      '  ON authority.authority_id=binding.authority_id '
      ' AND authority.process_code=binding.process_code '
      ' AND authority.step_code=binding.step_code '
      ' AND authority.route_path=binding.route_path '
      ' AND authority.audience=binding.audience '
      'WHERE binding.scope_type=''PROJECT'' AND binding.project_id=$1 '
      '  AND binding.process_code=$4 AND ('
      '    authority.authority_id IS NULL OR NOT ('
      '      (authority.authority_revision=binding.authority_revision '
      '       AND authority.document_set_hash=binding.document_set_hash '
      '       AND authority.authority_hash=binding.authority_hash) OR EXISTS('
      '        SELECT 1 FROM public.integrated_design_authority_version version '
      '         WHERE version.authority_id=binding.authority_id '
      '           AND version.authority_revision=binding.authority_revision '
      '           AND version.document_set_hash=binding.document_set_hash '
      '           AND version.authority_hash=binding.authority_hash)) '
      '    OR NOT EXISTS('
      '        SELECT 1 FROM public.framework_actor_process_design_release release '
      '         WHERE release.project_id=binding.project_id '
      '           AND release.design_version=binding.design_version '
      '           AND lower(release.contract_sha256)=binding.contract_sha256 '
      '           AND upper(coalesce(release.contract_payload#>>''{process,processCode}'',''''))='
      '               binding.process_code) '
      '    OR binding.provenance_hash<>'
      '       framework_project_runtime_purge_integrated_provenance_hash('
      '         binding.scope_type,binding.project_id,binding.design_version::bigint,'
      '         binding.contract_sha256,binding.process_code,binding.step_code,'
      '         binding.route_path,binding.audience,binding.authority_id,'
      '         binding.authority_revision,binding.document_set_hash,'
      '         binding.authority_hash))'
      INTO forged_integrated_binding_count
      USING requested_project,requested_design_version,
            requested_contract_sha256,requested_process;
  END IF;

  -- A placeholder hash lets the receipt own its immutable snapshot rows while
  -- the snapshot is assembled in this same transaction.
  INSERT INTO framework_project_runtime_purge_receipt(
    receipt_id,operation_key,project_id,process_code,design_version,
    contract_sha256,scope_mode,receipt_status,snapshot_sha256,
    impact_json,blocker_json,requested_by
  ) VALUES(
    requested_receipt,requested_operation,requested_project,requested_process,
    requested_design_version,requested_contract_sha256,resolved_scope,
    'PREVIEWED',repeat('0',64),'{}','{}',requested_actor
  );
  PERFORM framework_project_runtime_purge_build_snapshot(
    requested_receipt,requested_project,requested_process);

  SELECT count(*)::integer,
         count(*) FILTER(WHERE upper(coalesce(
           row_payload->>'ownership_mode',row_payload->>'ownershipMode',
           row_payload->>'implementation_strategy',
           row_payload->>'implementationStrategy',row_payload->>'decision',''))
           IN ('MANUAL','HYBRID','ADOPT','ADOPTED','ADOPT_EXISTING'))::integer
    INTO snapshot_count,manual_count
    FROM framework_project_runtime_purge_snapshot_row
   WHERE receipt_id=requested_receipt;
  -- Only explicit ownership/provenance fields are authority.  created_by is
  -- deliberately ignored: legitimate RFP automation accounts are not stable
  -- ownership evidence, and a human-looking string is not proof of MANUAL.
  SELECT count(*)::integer INTO materialized_artifact_count
    FROM framework_project_runtime_purge_snapshot_row
   WHERE receipt_id=requested_receipt
     AND (
       table_name='framework_source_materialization_state'
         AND (upper(coalesce(row_payload->>'sync_status',''))='MATERIALIZED'
              OR nullif(row_payload->>'materialized_hash','') IS NOT NULL
              OR nullif(row_payload->>'materialized_at','') IS NOT NULL)
       OR table_name='framework_runtime_generation_state'
         AND (upper(coalesce(row_payload->>'sync_status',''))='GENERATED'
              OR nullif(row_payload->>'generated_hash','') IS NOT NULL
              OR nullif(row_payload->>'generated_at','') IS NOT NULL)
       OR table_name='framework_screen_generation_state'
         AND (upper(coalesce(row_payload->>'sync_status',''))='GENERATED'
              OR nullif(row_payload->>'generated_hash','') IS NOT NULL
              OR nullif(row_payload->>'generated_at','') IS NOT NULL)
       OR table_name='framework_development_job'
         AND upper(coalesce(row_payload->>'job_status','')) IN
             ('RUNNING','COMPLETED','VERIFIED','APPLIED')
     );

  SELECT coalesce(jsonb_object_agg(table_name,row_count
           ORDER BY table_name COLLATE "C"),'{}'::jsonb)
    INTO impact
    FROM (
      SELECT table_name,count(*)::integer row_count
        FROM framework_project_runtime_purge_snapshot_row
       WHERE receipt_id=requested_receipt GROUP BY table_name
    ) counted;
  captured_scope_counts:=framework_project_runtime_purge_scope_counts(
    requested_project,requested_process);
  impact:=impact||jsonb_build_object(
    'schema','carbonet.project-runtime-purge-impact/v1',
    'totalRows',snapshot_count,
    'capturedScopeCounts',captured_scope_counts,
    'capturedDependencyMaxDepth',(SELECT coalesce(max(dependency_depth),0)
      FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt),
    'releaseRows',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt
        AND table_name='framework_actor_process_design_release'),
    'endpointRows',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt AND (
        table_name='framework_api_endpoint_registry'
        OR table_name='framework_runtime_resource'
           AND row_payload->>'resource_kind'='ENDPOINT')),
    'packageBindings',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt
        AND table_name='framework_screen_feature_binding'),
    'jobRows',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt
        AND table_name LIKE 'framework_development_job%'),
    'executionRows',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt
        AND table_name LIKE 'framework_process_execution%'),
    'draftRows',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt
        AND table_name='framework_process_work_draft'),
    'assignmentRows',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt AND table_name IN(
        'framework_account_actor_assignment','framework_project_actor_assignment',
        'framework_project_process_step_assignment')),
    'sourceRows',(SELECT count(*) FROM framework_project_runtime_purge_snapshot_row
      WHERE receipt_id=requested_receipt
        AND table_name LIKE 'framework_source_%'),
    'ownershipEvidence',jsonb_build_object(
      'testOwned',test_owned,'qaProvenance',qa_owned,
      'backstageRequirement',requirement_owned)
  );
  blockers:=jsonb_build_object(
    'sharedReleaseCount',shared_release_count,
    'projectProcessIdentityCount',project_process_identity_count,
    'multiProcessProjectCount',greatest(project_process_identity_count-1,0),
    'externalProjectRowCount',external_project_count,
    'externalProcessReferenceCount',external_handoff_count,
    'manualOrAdoptRowCount',manual_count,
    'materializedArtifactBlockerCount',materialized_artifact_count,
    'unsafeEndpointCount',unsafe_endpoint_count,
    'sharedIntegratedScopeCount',shared_integrated_scope_count,
    'forgedIntegratedBindingCount',forged_integrated_binding_count,
    'blocked',shared_release_count+greatest(project_process_identity_count-1,0)+
      external_project_count+
      external_handoff_count+manual_count+materialized_artifact_count+
      unsafe_endpoint_count+shared_integrated_scope_count+
      forged_integrated_binding_count>0
  );
  SELECT framework_project_runtime_purge_hash(jsonb_build_object(
           'schema','carbonet.project-runtime-purge-snapshot/v1',
           'projectId',requested_project,'processCode',requested_process,
           'designVersion',requested_design_version,
           'contractSha256',requested_contract_sha256,
           'rows',coalesce(jsonb_agg(jsonb_build_object(
             'table',table_name,'depth',dependency_depth,'rowHash',row_hash)
             ORDER BY table_name COLLATE "C",row_hash COLLATE "C"),'[]'::jsonb)
         )) INTO snapshot_hash
    FROM framework_project_runtime_purge_snapshot_row
   WHERE receipt_id=requested_receipt;

  UPDATE framework_project_runtime_purge_receipt SET
    snapshot_sha256=snapshot_hash,impact_json=impact,blocker_json=blockers,
    receipt_status=CASE WHEN (blockers->>'blocked')::boolean
      THEN 'BLOCKED' ELSE 'PREVIEWED' END,
    updated_at=clock_timestamp()
   WHERE receipt_id=requested_receipt;
  PERFORM framework_project_runtime_purge_append_audit(
    requested_receipt,
    CASE WHEN (blockers->>'blocked')::boolean THEN 'BLOCKED' ELSE 'PREVIEWED' END,
    requested_actor,jsonb_build_object(
      'projectId',requested_project,'processCode',requested_process,
      'designVersion',requested_design_version,
      'contractSha256',requested_contract_sha256,
      'scopeMode',resolved_scope,'snapshotSha256',snapshot_hash,
      'impact',impact,'blockers',blockers));
  RETURN jsonb_build_object(
    'success',NOT (blockers->>'blocked')::boolean,'idempotent',false,
    'receiptId',requested_receipt,'operationKey',requested_operation,
    'status',CASE WHEN (blockers->>'blocked')::boolean
      THEN 'BLOCKED' ELSE 'PREVIEWED' END,
    'projectId',requested_project,'processCode',requested_process,
    'designVersion',requested_design_version,
    'contractSha256',requested_contract_sha256,'scopeMode',resolved_scope,
    'snapshotSha256',snapshot_hash,'impact',impact,'blockers',blockers
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_apply_project_runtime_purge(
  requested_receipt uuid,requested_project text,requested_process text,
  requested_design_version integer,requested_contract_sha256 text,
  requested_snapshot_sha256 text,requested_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE receipt framework_project_runtime_purge_receipt%ROWTYPE;
DECLARE snapshot_row record; exact_count integer; residual_count integer:=0;
DECLARE postcondition jsonb; pre_scope_counts jsonb;
DECLARE residual_scope_counts jsonb; deleted_scope_counts jsonb;
BEGIN
  PERFORM framework_project_runtime_purge_require_admin(requested_actor);
  requested_project:=upper(btrim(coalesce(requested_project,'')));
  requested_process:=upper(btrim(coalesce(requested_process,'')));
  requested_contract_sha256:=lower(btrim(coalesce(requested_contract_sha256,'')));
  requested_snapshot_sha256:=lower(btrim(coalesce(requested_snapshot_sha256,'')));
  requested_actor:=btrim(coalesce(requested_actor,''));
  PERFORM framework_project_runtime_purge_lock_keys(
    requested_project,requested_process);
  SELECT * INTO receipt FROM framework_project_runtime_purge_receipt
   WHERE receipt_id=requested_receipt FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project runtime purge receipt not found'
    USING ERRCODE='P0002'; END IF;
  IF receipt.project_id<>requested_project
     OR receipt.process_code<>requested_process
     OR receipt.design_version<>requested_design_version
     OR receipt.contract_sha256<>requested_contract_sha256
     OR receipt.snapshot_sha256<>requested_snapshot_sha256 THEN
    RAISE EXCEPTION 'project runtime purge receipt CAS mismatch'
      USING ERRCODE='40001';
  END IF;
  IF receipt.receipt_status='PURGED' THEN
    residual_scope_counts:=framework_project_runtime_purge_scope_counts(
      requested_project,requested_process);
    IF coalesce((residual_scope_counts->>'exactZero')::boolean,false) IS NOT TRUE
       OR coalesce((residual_scope_counts->>'residualRows')::integer,-1)<>0 THEN
      RAISE EXCEPTION 'idempotent purge retry found runtime residuals: %',
        residual_scope_counts USING ERRCODE='55000';
    END IF;
    RETURN jsonb_build_object('success',true,'idempotent',true,
      'status','PURGED','receiptId',receipt.receipt_id,
      'operationKey',receipt.operation_key,'projectId',receipt.project_id,
      'processCode',receipt.process_code,'designVersion',receipt.design_version,
      'contractSha256',receipt.contract_sha256,'scopeMode',receipt.scope_mode,
      'snapshotSha256',receipt.snapshot_sha256,
      'postcondition',receipt.postcondition_json);
  END IF;
  IF receipt.receipt_status NOT IN ('PREVIEWED','RESTORED')
     OR coalesce((receipt.blocker_json->>'blocked')::boolean,true) THEN
    RAISE EXCEPTION 'project runtime purge receipt is not applicable: %',
      receipt.receipt_status USING ERRCODE='55000';
  END IF;

  pre_scope_counts:=framework_project_runtime_purge_scope_counts(
    requested_project,requested_process);
  IF pre_scope_counts IS DISTINCT FROM
       receipt.impact_json->'capturedScopeCounts' THEN
    RAISE EXCEPTION 'project runtime purge independent scope CAS mismatch: % / %',
      receipt.impact_json->'capturedScopeCounts',pre_scope_counts
      USING ERRCODE='40001';
  END IF;

  PERFORM framework_project_runtime_purge_set_user_triggers(
    requested_receipt,false);

  -- Lock and verify every exact preimage before the first runtime mutation.
  FOR snapshot_row IN
    SELECT * FROM framework_project_runtime_purge_snapshot_row
     WHERE receipt_id=requested_receipt
     ORDER BY table_name COLLATE "C",row_hash COLLATE "C"
  LOOP
    EXECUTE format(
      'select count(*)::integer from ('
      'select 1 from %s row_value where to_jsonb(row_value)=$1 for update'
      ') exact_locked',snapshot_row.table_oid::regclass
    ) INTO exact_count USING snapshot_row.row_payload;
    IF exact_count<>1 THEN
      RAISE EXCEPTION 'project runtime purge row CAS mismatch: % / %',
        snapshot_row.table_name,snapshot_row.row_hash USING ERRCODE='40001';
    END IF;
  END LOOP;
  UPDATE framework_project_runtime_purge_receipt
     SET receipt_status='PURGING',updated_at=clock_timestamp()
   WHERE receipt_id=requested_receipt;
  PERFORM set_config('carbonet.project_runtime_purge_receipt',
    requested_receipt::text,true);

  FOR snapshot_row IN
    SELECT * FROM framework_project_runtime_purge_snapshot_row
     WHERE receipt_id=requested_receipt
     ORDER BY dependency_depth DESC,table_name COLLATE "C" DESC,
              row_hash COLLATE "C" DESC
  LOOP
    EXECUTE format('delete from %s row_value where to_jsonb(row_value)=$1',
      snapshot_row.table_oid::regclass) USING snapshot_row.row_payload;
  END LOOP;
  PERFORM framework_project_runtime_purge_set_user_triggers(
    requested_receipt,true);
  FOR snapshot_row IN
    SELECT * FROM framework_project_runtime_purge_snapshot_row
     WHERE receipt_id=requested_receipt
     ORDER BY table_name COLLATE "C",row_hash COLLATE "C"
  LOOP
    EXECUTE format('select count(*)::integer from %s row_value where to_jsonb(row_value)=$1',
      snapshot_row.table_oid::regclass)
      INTO exact_count USING snapshot_row.row_payload;
    residual_count:=residual_count+exact_count;
  END LOOP;
  IF residual_count<>0 THEN
    RAISE EXCEPTION 'project runtime purge exact-zero postcondition failed: %',
      residual_count USING ERRCODE='55000';
  END IF;
  residual_scope_counts:=framework_project_runtime_purge_scope_counts(
    requested_project,requested_process);
  IF coalesce((residual_scope_counts->>'exactZero')::boolean,false) IS NOT TRUE
     OR coalesce((residual_scope_counts->>'residualRows')::integer,-1)<>0 THEN
    RAISE EXCEPTION 'project runtime purge independent scope postcondition failed: %',
      residual_scope_counts USING ERRCODE='55000';
  END IF;
  SELECT jsonb_object_agg(captured.key,
           to_jsonb((captured.value::text)::integer-
                    coalesce((residual_scope_counts->>captured.key)::integer,0))
           ORDER BY captured.key COLLATE "C")
    INTO deleted_scope_counts
    FROM jsonb_each(pre_scope_counts) captured
   WHERE jsonb_typeof(captured.value)='number';
  IF EXISTS(
    SELECT 1 FROM jsonb_each(deleted_scope_counts) deleted
     WHERE (deleted.value::text)::integer<0
       OR (deleted.value::text)::integer<>
          (pre_scope_counts->>deleted.key)::integer
  ) THEN
    RAISE EXCEPTION 'project runtime purge captured/deleted count mismatch: % / %',
      pre_scope_counts,deleted_scope_counts USING ERRCODE='55000';
  END IF;
  postcondition:=jsonb_build_object(
    'schema','carbonet.project-runtime-purge-postcondition/v1',
    'capturedScopeCounts',pre_scope_counts,
    'deletedScopeCounts',deleted_scope_counts,
    'residualScopeCounts',residual_scope_counts,
    'capturedSnapshotRows',(receipt.impact_json->>'totalRows')::integer,
    'deletedSnapshotRows',(receipt.impact_json->>'totalRows')::integer,
    'snapshotResidualRows',0,
    'capturedEqualsDeleted',true,'exactZero',true);
  UPDATE framework_project_runtime_purge_receipt SET
    receipt_status='PURGED',postcondition_json=postcondition,
    purged_at=clock_timestamp(),restored_at=NULL,updated_at=clock_timestamp()
   WHERE receipt_id=requested_receipt;
  PERFORM framework_project_runtime_purge_append_audit(
    requested_receipt,'PURGED',requested_actor,jsonb_build_object(
      'snapshotSha256',receipt.snapshot_sha256,
      'deletedRows',(receipt.impact_json->>'totalRows')::integer,
      'postcondition',postcondition));
  RETURN jsonb_build_object('success',true,'idempotent',false,
    'status','PURGED','receiptId',requested_receipt,
    'operationKey',receipt.operation_key,'projectId',receipt.project_id,
    'processCode',receipt.process_code,'designVersion',receipt.design_version,
    'contractSha256',receipt.contract_sha256,'scopeMode',receipt.scope_mode,
    'snapshotSha256',receipt.snapshot_sha256,
    'deletedRows',(receipt.impact_json->>'totalRows')::integer,
    'postcondition',postcondition);
END
$$;

CREATE OR REPLACE FUNCTION framework_restore_project_runtime_purge(
  requested_receipt uuid,requested_project text,requested_process text,
  requested_design_version integer,requested_contract_sha256 text,
  requested_snapshot_sha256 text,requested_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE receipt framework_project_runtime_purge_receipt%ROWTYPE;
DECLARE snapshot_row record; exact_count integer; restored_count integer:=0;
DECLARE restored_hash text; restored_scope_counts jsonb;
BEGIN
  PERFORM framework_project_runtime_purge_require_admin(requested_actor);
  requested_project:=upper(btrim(coalesce(requested_project,'')));
  requested_process:=upper(btrim(coalesce(requested_process,'')));
  requested_contract_sha256:=lower(btrim(coalesce(requested_contract_sha256,'')));
  requested_snapshot_sha256:=lower(btrim(coalesce(requested_snapshot_sha256,'')));
  requested_actor:=btrim(coalesce(requested_actor,''));
  PERFORM framework_project_runtime_purge_lock_keys(
    requested_project,requested_process);
  SELECT * INTO receipt FROM framework_project_runtime_purge_receipt
   WHERE receipt_id=requested_receipt FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project runtime purge receipt not found'
    USING ERRCODE='P0002'; END IF;
  IF receipt.project_id<>requested_project
     OR receipt.process_code<>requested_process
     OR receipt.design_version<>requested_design_version
     OR receipt.contract_sha256<>requested_contract_sha256
     OR receipt.snapshot_sha256<>requested_snapshot_sha256 THEN
    RAISE EXCEPTION 'project runtime restore receipt CAS mismatch'
      USING ERRCODE='40001';
  END IF;
  IF receipt.receipt_status='RESTORED' THEN
    IF framework_project_runtime_purge_scope_counts(
         requested_project,requested_process) IS DISTINCT FROM
         receipt.impact_json->'capturedScopeCounts' THEN
      RAISE EXCEPTION 'idempotent restore retry found scope drift'
        USING ERRCODE='40001';
    END IF;
    FOR snapshot_row IN
      SELECT * FROM framework_project_runtime_purge_snapshot_row
       WHERE receipt_id=requested_receipt
       ORDER BY table_name COLLATE "C",row_hash COLLATE "C"
    LOOP
      EXECUTE format(
        'select count(*)::integer from %s row_value where to_jsonb(row_value)=$1',
        snapshot_row.table_oid::regclass)
        INTO exact_count USING snapshot_row.row_payload;
      IF exact_count<>1 THEN
        RAISE EXCEPTION 'idempotent restore retry row drift: % / %',
          snapshot_row.table_name,snapshot_row.row_hash USING ERRCODE='40001';
      END IF;
    END LOOP;
    RETURN jsonb_build_object('success',true,'idempotent',true,
      'status','RESTORED','receiptId',receipt.receipt_id,
      'operationKey',receipt.operation_key,'projectId',receipt.project_id,
      'processCode',receipt.process_code,'designVersion',receipt.design_version,
      'contractSha256',receipt.contract_sha256,'scopeMode',receipt.scope_mode,
      'snapshotSha256',receipt.snapshot_sha256,
      'restoredRows',(receipt.impact_json->>'totalRows')::integer,
      'postcondition',receipt.postcondition_json,'aToBToA',true);
  END IF;
  IF receipt.receipt_status<>'PURGED' THEN
    RAISE EXCEPTION 'only a PURGED runtime receipt can be restored: %',
      receipt.receipt_status USING ERRCODE='55000';
  END IF;
  IF coalesce((framework_project_runtime_purge_scope_counts(
       requested_project,requested_process)->>'exactZero')::boolean,false)
       IS NOT TRUE THEN
    RAISE EXCEPTION 'project runtime restore requires an exact-zero purged scope'
      USING ERRCODE='40001';
  END IF;
  UPDATE framework_project_runtime_purge_receipt
     SET receipt_status='RESTORING',updated_at=clock_timestamp()
   WHERE receipt_id=requested_receipt;
  PERFORM set_config('carbonet.project_runtime_purge_receipt',
    requested_receipt::text,true);
  PERFORM framework_project_runtime_purge_set_user_triggers(
    requested_receipt,false);

  -- Parent first, then each FK descendant.  Any unique/FK conflict aborts the
  -- whole transaction, returning the database to PURGED rather than half A.
  FOR snapshot_row IN
    SELECT * FROM framework_project_runtime_purge_snapshot_row
     WHERE receipt_id=requested_receipt
     ORDER BY dependency_depth,table_name COLLATE "C",row_hash COLLATE "C"
  LOOP
    EXECUTE format(
      'insert into %s select * from jsonb_populate_record(null::%s,$1)',
      snapshot_row.table_oid::regclass,snapshot_row.table_oid::regclass
    ) USING snapshot_row.row_payload;
    restored_count:=restored_count+1;
  END LOOP;
  PERFORM framework_project_runtime_purge_set_user_triggers(
    requested_receipt,true);
  FOR snapshot_row IN
    SELECT * FROM framework_project_runtime_purge_snapshot_row
     WHERE receipt_id=requested_receipt
     ORDER BY table_name COLLATE "C",row_hash COLLATE "C"
  LOOP
    EXECUTE format('select count(*)::integer from %s row_value where to_jsonb(row_value)=$1',
      snapshot_row.table_oid::regclass)
      INTO exact_count USING snapshot_row.row_payload;
    IF exact_count<>1 THEN
      RAISE EXCEPTION 'project runtime restore postcondition failed: % / %',
        snapshot_row.table_name,snapshot_row.row_hash USING ERRCODE='55000';
    END IF;
  END LOOP;
  SELECT framework_project_runtime_purge_hash(jsonb_build_object(
           'schema','carbonet.project-runtime-purge-snapshot/v1',
           'projectId',receipt.project_id,'processCode',receipt.process_code,
           'designVersion',receipt.design_version,
           'contractSha256',receipt.contract_sha256,
           'rows',coalesce(jsonb_agg(jsonb_build_object(
             'table',table_name,'depth',dependency_depth,'rowHash',row_hash)
             ORDER BY table_name COLLATE "C",row_hash COLLATE "C"),'[]'::jsonb)
         )) INTO restored_hash
    FROM framework_project_runtime_purge_snapshot_row
   WHERE receipt_id=requested_receipt;
  IF restored_hash<>receipt.snapshot_sha256 THEN
    RAISE EXCEPTION 'project runtime restored snapshot hash mismatch'
      USING ERRCODE='55000';
  END IF;
  restored_scope_counts:=framework_project_runtime_purge_scope_counts(
    requested_project,requested_process);
  IF restored_scope_counts IS DISTINCT FROM
       receipt.impact_json->'capturedScopeCounts' THEN
    RAISE EXCEPTION 'project runtime restored scope does not equal preimage: % / %',
      receipt.impact_json->'capturedScopeCounts',restored_scope_counts
      USING ERRCODE='40001';
  END IF;
  UPDATE framework_project_runtime_purge_receipt SET
    receipt_status='RESTORED',restored_at=clock_timestamp(),
    updated_at=clock_timestamp()
   WHERE receipt_id=requested_receipt;
  PERFORM framework_project_runtime_purge_append_audit(
    requested_receipt,'RESTORED',requested_actor,jsonb_build_object(
      'snapshotSha256',receipt.snapshot_sha256,'restoredRows',restored_count,
      'aToBToA',true));
  RETURN jsonb_build_object('success',true,'idempotent',false,
    'status','RESTORED','receiptId',requested_receipt,
    'operationKey',receipt.operation_key,'projectId',receipt.project_id,
    'processCode',receipt.process_code,'designVersion',receipt.design_version,
    'contractSha256',receipt.contract_sha256,'scopeMode',receipt.scope_mode,
    'snapshotSha256',receipt.snapshot_sha256,
    'restoredRows',restored_count,'postcondition',receipt.postcondition_json,
    'aToBToA',true);
END
$$;

-- Install fences for every table present at this migration version.  The
-- later composite-design migration and the post-composite reinstall migration
-- call the same idempotent installer for tables introduced afterwards.
SELECT framework_install_project_runtime_write_fences();

REVOKE ALL ON TABLE framework_project_runtime_purge_receipt,
  framework_project_runtime_purge_snapshot_row,
  framework_project_runtime_purge_audit,
  framework_project_runtime_absence_fence FROM PUBLIC;
REVOKE ALL ON FUNCTION
  framework_project_runtime_purge_append_audit(uuid,text,text,jsonb),
  framework_project_runtime_purge_require_admin(text),
  framework_project_runtime_purge_guard_allows(text),
  framework_project_runtime_purge_lock_keys(text,text),
  framework_project_runtime_purge_set_user_triggers(uuid,boolean),
  framework_project_runtime_purge_snapshot_insert(uuid,oid,integer,text,text,text),
  framework_project_runtime_purge_build_snapshot(uuid,text,text),
  framework_project_runtime_purge_scope_counts(text,text),
  framework_prove_project_runtime_absent(uuid,text,text),
  framework_activate_project_runtime_absence_fence(uuid,text,text),
  framework_release_project_runtime_absence_fence(uuid,text,text),
  framework_guard_project_runtime_write_fence(),
  framework_install_project_runtime_write_fences(),
  framework_preview_project_runtime_purge(uuid,uuid,text,text,integer,text,text,text),
  framework_apply_project_runtime_purge(uuid,text,text,integer,text,text,text),
  framework_restore_project_runtime_purge(uuid,text,text,integer,text,text,text)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    GRANT EXECUTE ON FUNCTION
      framework_preview_project_runtime_purge(uuid,uuid,text,text,integer,text,text,text),
      framework_apply_project_runtime_purge(uuid,text,text,integer,text,text,text),
      framework_restore_project_runtime_purge(uuid,text,text,integer,text,text,text),
      framework_prove_project_runtime_absent(uuid,text,text),
      framework_activate_project_runtime_absence_fence(uuid,text,text),
      framework_release_project_runtime_absence_fence(uuid,text,text)
      TO carbonet_app;
  END IF;
END
$$;

COMMENT ON TABLE framework_project_runtime_purge_receipt IS
  'Exact Backstage release CAS and reversible runtime purge state; no prefix deletion';
COMMENT ON TABLE framework_project_runtime_purge_snapshot_row IS
  'Immutable FK-closed A snapshot used for C-order A-to-B purge and B-to-A restore';
COMMENT ON TABLE framework_project_runtime_purge_audit IS
  'Append-only hash-chained preview, tombstone and restore evidence';
COMMENT ON TABLE framework_project_runtime_absence_fence IS
  'Durable exact-zero project fence retained across Backstage local deletion';
