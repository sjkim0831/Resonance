-- Milestone 1: authoritative design dirty signals, canonical root, and stage CAS.
--
-- AFTER triggers coalesce only a GLOBAL bit mask in the source transaction.
-- A post-commit compiler running at REPEATABLE READ recomputes five semantic
-- component hashes, advances one global head with CAS, and starts an immutable
-- event at CANONICAL_COMPILED.  RUNTIME_APPLIED is intentionally later than
-- DEPLOYED/DEPLOY_NOT_REQUIRED and requires independent exact-hash evidence.
-- This migration installs no generator, deployment, runtime-probe, or relay worker.

DO $$
DECLARE object_name text; object_owner name;
BEGIN
  IF current_user='carbonet_app' THEN
    RAISE EXCEPTION 'design causality migration must run as object owner'
      USING ERRCODE='42501';
  END IF;
  FOREACH object_name IN ARRAY ARRAY[
    'framework_process_definition','framework_process_step',
    'framework_actor_definition','framework_account_actor_assignment',
    'framework_page_design','framework_page_field_definition',
    'framework_professional_screen_contract','comtnmenufunctioninfo',
    'comtnauthorfunctionrelate','comtnuserfeatureoverride',
    'comtnemplyrscrtyestbs'
  ] LOOP
    SELECT pg_get_userbyid(relowner) INTO object_owner
      FROM pg_class WHERE oid=to_regclass('public.'||object_name);
    IF object_owner IS NULL OR object_owner<>current_user THEN
      RAISE EXCEPTION 'migration role % does not own public.% (owner=%)',
        current_user,object_name,coalesce(object_owner::text,'MISSING')
        USING ERRCODE='42501';
    END IF;
  END LOOP;
END
$$;

-- Ground the legacy permission projection in the live eGov schema.  The
-- canonical compiler must fail before installing any object if a referenced
-- column is missing or has drifted to an incompatible PostgreSQL type.
DO $$
DECLARE schema_drift text;
BEGIN
  WITH expected(table_name,column_name,udt_name) AS (VALUES
    ('comtnmenufunctioninfo','menu_code','varchar'),
    ('comtnmenufunctioninfo','feature_code','varchar'),
    ('comtnmenufunctioninfo','feature_nm','varchar'),
    ('comtnmenufunctioninfo','feature_nm_en','varchar'),
    ('comtnmenufunctioninfo','feature_dc','varchar'),
    ('comtnmenufunctioninfo','use_at','bpchar'),
    ('comtnmenufunctioninfo','frst_regist_pnttm','timestamp'),
    ('comtnmenufunctioninfo','last_updt_pnttm','timestamp'),
    ('comtnauthorfunctionrelate','author_code','varchar'),
    ('comtnauthorfunctionrelate','feature_code','varchar'),
    ('comtnauthorfunctionrelate','grant_authority_yn','bpchar'),
    ('comtnauthorfunctionrelate','creat_dt','timestamp'),
    ('comtnuserfeatureoverride','scrty_dtrmn_trget_id','varchar'),
    ('comtnuserfeatureoverride','mber_ty_code','bpchar'),
    ('comtnuserfeatureoverride','feature_code','varchar'),
    ('comtnuserfeatureoverride','override_type','bpchar'),
    ('comtnuserfeatureoverride','use_at','bpchar'),
    ('comtnuserfeatureoverride','frst_register_id','varchar'),
    ('comtnuserfeatureoverride','frst_regist_dt','timestamp'),
    ('comtnuserfeatureoverride','last_updusr_id','varchar'),
    ('comtnuserfeatureoverride','last_updt_dt','timestamp'),
    ('comtnemplyrscrtyestbs','scrty_dtrmn_trget_id','varchar'),
    ('comtnemplyrscrtyestbs','mber_ty_code','bpchar'),
    ('comtnemplyrscrtyestbs','author_code','varchar')
  )
  SELECT string_agg(
    format('%I.%I expected %s, found %s',e.table_name,e.column_name,
           e.udt_name,coalesce(c.udt_name,'MISSING')),
    ', ' ORDER BY e.table_name COLLATE "C",e.column_name COLLATE "C"
  ) INTO schema_drift
    FROM expected e
    LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name=e.table_name
     AND c.column_name=e.column_name
   WHERE c.column_name IS NULL OR c.udt_name<>e.udt_name;
  IF schema_drift IS NOT NULL THEN
    RAISE EXCEPTION 'legacy permission schema preflight failed: %',schema_drift
      USING ERRCODE='55000';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_sha256(value jsonb)
RETURNS varchar(64)
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT encode(pg_catalog.sha256(convert_to(value::text,'UTF8')),'hex')::varchar(64)
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_text_json(value text)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF value IS NULL OR btrim(value)='' THEN RETURN NULL; END IF;
  RETURN value::jsonb;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN to_jsonb(btrim(value));
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_csv_set(value text)
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(jsonb_agg(item ORDER BY item COLLATE "C"),'[]'::jsonb)
    FROM (
      SELECT DISTINCT upper(btrim(part)) item
        FROM regexp_split_to_table(coalesce(value,''),',') part
       WHERE btrim(part)<>''
    ) normalized
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_json_set(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
  IF value IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF jsonb_typeof(value)<>'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(value) item
     WHERE jsonb_typeof(item)<>'string' OR btrim(item#>>'{}')=''
  ) THEN
    RAISE EXCEPTION 'canonical set must contain non-empty strings'
      USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(item ORDER BY item COLLATE "C"),'[]'::jsonb) INTO result
    FROM (SELECT DISTINCT upper(btrim(member#>>'{}')) item
            FROM jsonb_array_elements(value) member) normalized;
  RETURN result;
END
$$;

-- v1 normalized permission namespaces.  Step commands and actor capability CSVs
-- are deliberately not treated as feature permissions.
CREATE TABLE framework_permission_requirement_v1 (
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  permission_code varchar(120) NOT NULL,
  scope_type varchar(20) NOT NULL
    CHECK(scope_type IN ('GLOBAL','TENANT','PROJECT','RECORD','FIELD')),
  resource_contract jsonb NOT NULL,
  guard_contract jsonb NOT NULL,
  use_at char(1) NOT NULL DEFAULT 'Y' CHECK(use_at IN ('Y','N')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(process_code,step_code,permission_code,scope_type),
  CHECK(process_code=btrim(process_code) AND process_code ~ '^[A-Z][A-Z0-9_:-]{1,79}$'),
  CHECK(step_code=btrim(step_code) AND step_code ~ '^[A-Z][A-Z0-9_:-]{1,99}$'),
  CHECK(permission_code=btrim(permission_code)
        AND permission_code ~ '^[A-Z][A-Z0-9_:-]{1,119}$'),
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE,
  CHECK(jsonb_typeof(resource_contract)='object'),
  CHECK(jsonb_typeof(guard_contract)='object')
);

CREATE TABLE framework_permission_grant_v1 (
  actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
  permission_code varchar(120) NOT NULL,
  scope_type varchar(20) NOT NULL
    CHECK(scope_type IN ('GLOBAL','TENANT','PROJECT','RECORD','FIELD')),
  effect varchar(8) NOT NULL CHECK(effect IN ('ALLOW','DENY')),
  use_at char(1) NOT NULL DEFAULT 'Y' CHECK(use_at IN ('Y','N')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(actor_code,permission_code,scope_type),
  CHECK(actor_code=btrim(actor_code) AND actor_code ~ '^[A-Z][A-Z0-9_:-]{1,59}$'),
  CHECK(permission_code=btrim(permission_code)
        AND permission_code ~ '^[A-Z][A-Z0-9_:-]{1,119}$')
);

CREATE TABLE framework_permission_mapping_control_v1 (
  control_id smallint PRIMARY KEY CHECK(control_id=1),
  requirement_mapping_complete boolean NOT NULL DEFAULT false,
  grant_mapping_complete boolean NOT NULL DEFAULT false,
  mapping_note text NOT NULL DEFAULT 'legacy declarations observed; normalized v1 mapping incomplete',
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);
INSERT INTO framework_permission_mapping_control_v1(control_id) VALUES(1);

CREATE TABLE framework_design_change_signal (
  signal_id bigserial PRIMARY KEY,
  source_txid bigint NOT NULL,
  scope_key varchar(16) NOT NULL DEFAULT 'GLOBAL' CHECK(scope_key='GLOBAL'),
  change_mask integer NOT NULL CHECK(change_mask BETWEEN 1 AND 31),
  signal_status varchar(12) NOT NULL DEFAULT 'DIRTY'
    CHECK(signal_status IN ('DIRTY','COMPILED','NOOP')),
  compiled_event_id bigint,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(scope_key,source_txid),
  CHECK((signal_status='COMPILED')=(compiled_event_id IS NOT NULL))
);

CREATE INDEX idx_design_change_signal_dirty
  ON framework_design_change_signal(signal_id) WHERE signal_status='DIRTY';

CREATE TABLE framework_design_causality_head (
  scope_key varchar(16) PRIMARY KEY CHECK(scope_key='GLOBAL'),
  revision bigint NOT NULL CHECK(revision>=0),
  canonical_schema_version smallint NOT NULL CHECK(canonical_schema_version=1),
  canonical_hash varchar(64) NOT NULL CHECK(canonical_hash ~ '^[0-9a-f]{64}$'),
  process_hash varchar(64) NOT NULL CHECK(process_hash ~ '^[0-9a-f]{64}$'),
  actor_hash varchar(64) NOT NULL CHECK(actor_hash ~ '^[0-9a-f]{64}$'),
  account_assignment_hash varchar(64) NOT NULL
    CHECK(account_assignment_hash ~ '^[0-9a-f]{64}$'),
  permission_requirement_hash varchar(64) NOT NULL
    CHECK(permission_requirement_hash ~ '^[0-9a-f]{64}$'),
  permission_grant_hash varchar(64) NOT NULL
    CHECK(permission_grant_hash ~ '^[0-9a-f]{64}$'),
  row_counts jsonb NOT NULL CHECK(jsonb_typeof(row_counts)='object'),
  current_event_id bigint,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK((revision=0 AND current_event_id IS NULL) OR
        (revision>0 AND current_event_id IS NOT NULL))
);

CREATE OR REPLACE FUNCTION framework_design_causality_event_hash(
  requested_revision bigint,requested_previous_hash text,requested_canonical_hash text,
  requested_process_hash text,requested_actor_hash text,requested_account_hash text,
  requested_requirement_hash text,requested_grant_hash text,requested_counts jsonb,
  requested_change_mask integer
) RETURNS varchar(64)
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_design_causality_sha256(jsonb_build_object(
    'schema','carbonet.design-causality-event/v1','scope','GLOBAL',
    'revision',requested_revision,'previousHash',requested_previous_hash,
    'canonicalHash',requested_canonical_hash,
    'processHash',requested_process_hash,'actorHash',requested_actor_hash,
    'accountAssignmentHash',requested_account_hash,
    'permissionRequirementHash',requested_requirement_hash,
    'permissionGrantHash',requested_grant_hash,'rowCounts',requested_counts,
    'changeMask',requested_change_mask
  ))
$$;

CREATE TABLE framework_design_causality_event (
  event_id bigserial PRIMARY KEY,
  scope_key varchar(16) NOT NULL CHECK(scope_key='GLOBAL'),
  revision bigint NOT NULL CHECK(revision>0),
  previous_hash varchar(64) NOT NULL CHECK(previous_hash ~ '^[0-9a-f]{64}$'),
  canonical_hash varchar(64) NOT NULL CHECK(canonical_hash ~ '^[0-9a-f]{64}$'),
  process_hash varchar(64) NOT NULL CHECK(process_hash ~ '^[0-9a-f]{64}$'),
  actor_hash varchar(64) NOT NULL CHECK(actor_hash ~ '^[0-9a-f]{64}$'),
  account_assignment_hash varchar(64) NOT NULL
    CHECK(account_assignment_hash ~ '^[0-9a-f]{64}$'),
  permission_requirement_hash varchar(64) NOT NULL
    CHECK(permission_requirement_hash ~ '^[0-9a-f]{64}$'),
  permission_grant_hash varchar(64) NOT NULL
    CHECK(permission_grant_hash ~ '^[0-9a-f]{64}$'),
  row_counts jsonb NOT NULL CHECK(jsonb_typeof(row_counts)='object'),
  canonical_schema_version smallint NOT NULL CHECK(canonical_schema_version=1),
  change_mask integer NOT NULL CHECK(change_mask BETWEEN 1 AND 31),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  event_hash varchar(64) NOT NULL CHECK(event_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE(scope_key,revision),
  CHECK(event_hash=framework_design_causality_event_hash(
    revision,previous_hash,canonical_hash,process_hash,actor_hash,
    account_assignment_hash,permission_requirement_hash,permission_grant_hash,
    row_counts,change_mask
  ))
);

CREATE TABLE framework_design_causality_event_signal (
  event_id bigint NOT NULL REFERENCES framework_design_causality_event(event_id),
  signal_id bigint NOT NULL UNIQUE REFERENCES framework_design_change_signal(signal_id),
  PRIMARY KEY(event_id,signal_id)
);

ALTER TABLE framework_design_change_signal
  ADD CONSTRAINT fk_design_change_signal_compiled_event
  FOREIGN KEY(compiled_event_id) REFERENCES framework_design_causality_event(event_id);
ALTER TABLE framework_design_causality_head
  ADD CONSTRAINT fk_design_causality_head_current_event
  FOREIGN KEY(current_event_id) REFERENCES framework_design_causality_event(event_id);

CREATE TABLE framework_design_causality_stage (
  event_id bigint PRIMARY KEY REFERENCES framework_design_causality_event(event_id),
  current_stage varchar(32) NOT NULL CHECK(current_stage IN (
    'CANONICAL_COMPILED','CHANGE_CLASSIFIED','SOURCE_GENERATED','SOURCE_NOT_REQUIRED',
    'BUILT','BUILD_NOT_REQUIRED','DEPLOYED','DEPLOY_NOT_REQUIRED',
    'RUNTIME_APPLIED','RELAY_E2E_PASSED','SUPERSEDED','TERMINAL_FAILED'
  )),
  stage_version bigint NOT NULL CHECK(stage_version>=0),
  classification varchar(20) NOT NULL DEFAULT 'UNCLASSIFIED'
    CHECK(classification IN ('UNCLASSIFIED','SOURCE_REQUIRED','RUNTIME_ONLY')),
  lease_owner varchar(100),
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  source_commit varchar(40),
  source_tree_hash varchar(64),
  artifact_hash varchar(64),
  deployment_hash varchar(64),
  runtime_hash varchar(64),
  evidence_ref varchar(500),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK((lease_owner IS NULL)=(lease_expires_at IS NULL)),
  CHECK(source_commit IS NULL OR source_commit ~ '^[0-9a-f]{40}$'),
  CHECK(source_tree_hash IS NULL OR source_tree_hash ~ '^[0-9a-f]{64}$'),
  CHECK(artifact_hash IS NULL OR artifact_hash ~ '^[0-9a-f]{64}$'),
  CHECK(deployment_hash IS NULL OR deployment_hash ~ '^[0-9a-f]{64}$'),
  CHECK(runtime_hash IS NULL OR runtime_hash ~ '^[0-9a-f]{64}$')
);

CREATE OR REPLACE FUNCTION framework_design_causality_transition_hash(
  requested_event_id bigint,requested_version bigint,requested_from text,
  requested_to text,requested_evidence_hash text,requested_evidence_ref text,
  requested_actor text,requested_previous_transition_hash text
) RETURNS varchar(64)
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT public.framework_design_causality_sha256(jsonb_build_object(
    'schema','carbonet.design-causality-transition/v1','eventId',requested_event_id,
    'version',requested_version,'from',requested_from,'to',requested_to,
    'evidenceHash',requested_evidence_hash,'evidenceRef',requested_evidence_ref,
    'actor',requested_actor,
    'previousTransitionHash',requested_previous_transition_hash
  ))
$$;

CREATE TABLE framework_design_causality_stage_transition (
  event_id bigint NOT NULL REFERENCES framework_design_causality_event(event_id),
  new_version bigint NOT NULL CHECK(new_version>=0),
  from_stage varchar(32) NOT NULL,
  to_stage varchar(32) NOT NULL,
  evidence_hash varchar(64) NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  evidence_ref varchar(500) NOT NULL
    CHECK(length(evidence_ref) BETWEEN 8 AND 500 AND
          evidence_ref ~ '^[a-z][a-z0-9+.-]*://[A-Za-z0-9._:/-]+$'),
  previous_transition_hash varchar(64),
  transition_actor varchar(100) NOT NULL
    CHECK(transition_actor ~ '^[A-Za-z0-9._:-]{1,100}$'),
  transitioned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  row_hash varchar(64) NOT NULL CHECK(row_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(event_id,new_version),
  CHECK((new_version=0)=(previous_transition_hash IS NULL)),
  CHECK(previous_transition_hash IS NULL OR
        previous_transition_hash ~ '^[0-9a-f]{64}$'),
  CHECK(row_hash=framework_design_causality_transition_hash(
    event_id,new_version,from_stage,to_stage,evidence_hash,evidence_ref,
    transition_actor,previous_transition_hash
  ))
);

CREATE OR REPLACE FUNCTION framework_design_causality_process_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH process_rows AS (
    SELECT upper(btrim(p.process_code)) business_key,
      ((to_jsonb(p)-ARRAY[
        'created_at','updated_at','last_reviewed_at','next_review_at',
        'prerequisite_codes','regulation_refs'
      ]) || jsonb_build_object(
        'prerequisite_codes',public.framework_design_causality_csv_set(p.prerequisite_codes),
        'regulation_refs',public.framework_design_causality_csv_set(p.regulation_refs),
        'steps',coalesce((
          SELECT jsonb_agg(
            (to_jsonb(s)-ARRAY[
              'step_id','evidence_types','segregation_actor_codes',
              'api_contract','input_contract','output_contract'
            ]) || jsonb_build_object(
              'evidence_types',public.framework_design_causality_csv_set(s.evidence_types),
              'segregation_actor_codes',
                public.framework_design_causality_csv_set(s.segregation_actor_codes),
              'api_contract',public.framework_design_causality_text_json(s.api_contract),
              'input_contract',public.framework_design_causality_text_json(s.input_contract),
              'output_contract',public.framework_design_causality_text_json(s.output_contract)
            ) ORDER BY s.step_order,upper(btrim(s.step_code)) COLLATE "C"
          ) FROM public.framework_process_step s
             WHERE s.process_code=p.process_code
        ),'[]'::jsonb)
      )) canonical_row
      FROM public.framework_process_definition p
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-process/v1',
    'sourceSchema','framework_process_definition+framework_process_step/v1',
    'processCount',(SELECT count(*) FROM public.framework_process_definition),
    'stepCount',(SELECT count(*) FROM public.framework_process_step),
    'processes',coalesce(
      jsonb_agg(canonical_row ORDER BY business_key COLLATE "C"),'[]'::jsonb
    )
  ) FROM process_rows
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_actor_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH actor_rows AS (
    SELECT upper(btrim(actor_code)) business_key,
      (to_jsonb(a)-ARRAY[
        'created_at','updated_at','capability_codes','conflict_actor_codes'
      ]) || jsonb_build_object(
        'capability_codes',public.framework_design_causality_csv_set(capability_codes),
        'conflict_actor_codes',public.framework_design_causality_csv_set(conflict_actor_codes)
      ) canonical_row
      FROM public.framework_actor_definition a
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-actor/v1',
    'sourceSchema','framework_actor_definition/v1',
    'actorCount',(SELECT count(*) FROM public.framework_actor_definition),
    'actors',coalesce(
      jsonb_agg(canonical_row ORDER BY business_key COLLATE "C"),'[]'::jsonb
    )
  ) FROM actor_rows
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_account_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH assignment_rows AS (
    SELECT public.framework_design_causality_sha256(jsonb_build_object(
      'account',a.account_id,'tenant',a.tenant_id,'project',a.project_id,
      'actor',a.actor_code,'dataScope',a.data_scope,'validFrom',a.valid_from,
      'validUntil',a.valid_until,'status',a.assignment_status
    )) assignment_fingerprint
      FROM public.framework_account_actor_assignment a
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-account-assignment/v1',
    'sourceSchema','framework_account_actor_assignment/v1',
    'sourceMutationExpected',false,
    'assignmentCount',(SELECT count(*) FROM assignment_rows),
    'assignmentFingerprints',coalesce(
      jsonb_agg(assignment_fingerprint ORDER BY assignment_fingerprint COLLATE "C"),
      '[]'::jsonb
    )
  ) FROM assignment_rows
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_permission_requirement_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH normalized AS (
    SELECT process_code||chr(31)||step_code||chr(31)||permission_code||chr(31)||scope_type key,
      to_jsonb(r)-ARRAY['created_at','updated_at'] canonical_row
      FROM public.framework_permission_requirement_v1 r
  ), feature_catalog AS (
    SELECT feature_code key,
      to_jsonb(f)-ARRAY['frst_regist_pnttm','last_updt_pnttm'] canonical_row
      FROM public.comtnmenufunctioninfo f
  ), field_bindings AS (
    SELECT d.process_code||chr(31)||d.step_code||chr(31)||d.audience||chr(31)||
           f.field_order::text||chr(31)||f.field_code key,
      jsonb_build_object(
        'processCode',d.process_code,'stepCode',d.step_code,'audience',d.audience,
        'pageCode',d.page_code,'plannedRoute',d.planned_route_path,
        'actualRoute',d.actual_route_path,'actorCode',d.actor_code,
        'pageSecurityContract',d.security_contract,
        'fieldOrder',f.field_order,'fieldCode',f.field_code,'apiProperty',f.api_property,
        'permissionCode',f.permission_code,'privacyClass',f.privacy_class,
        'validationContract',f.validation_contract,'required',f.required,
        'editable',f.editable,'mappingStatus',f.mapping_status,'useAt',d.design_status
      ) canonical_row
      FROM public.framework_page_field_definition f
      JOIN public.framework_page_design d USING(page_design_id)
  ), screen_guards AS (
    SELECT c.process_code||chr(31)||c.step_code||chr(31)||c.audience||chr(31)||
           lower(split_part(c.route_path,'?',1)) key,
      jsonb_build_object(
        'processCode',c.process_code,'stepCode',c.step_code,'audience',c.audience,
        'routePath',lower(split_part(c.route_path,'?',1)),
        'actorCode',c.actor_code,
        'permissionCodes',public.framework_design_causality_json_set(c.permission_codes),
        'apiContract',public.framework_design_causality_text_json(c.api_contract),
        'securityContract',public.framework_design_causality_text_json(c.security_contract),
        'authorityVerified',c.authority_verified,'contractStatus',c.contract_status
      ) canonical_row
      FROM public.framework_professional_screen_contract c
  ), control AS (
    SELECT requirement_mapping_complete,mapping_note
      FROM public.framework_permission_mapping_control_v1 WHERE control_id=1
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-permission-requirement/v1',
    'sourceSchema','normalized-v1+legacy-observation/v1',
    'mappingComplete',coalesce((SELECT requirement_mapping_complete FROM control),false),
    'mappingNote',coalesce((SELECT mapping_note FROM control),'mapping control missing'),
    'normalizedCount',(SELECT count(*) FROM normalized),
    'featureCount',(SELECT count(*) FROM feature_catalog),
    'fieldBindingCount',(SELECT count(*) FROM field_bindings),
    'screenGuardCount',(SELECT count(*) FROM screen_guards),
    'normalized',coalesce((
      SELECT jsonb_agg(canonical_row ORDER BY key COLLATE "C") FROM normalized
    ),'[]'),
    'legacyFeatureCatalog',coalesce((
      SELECT jsonb_agg(canonical_row ORDER BY key COLLATE "C") FROM feature_catalog
    ),'[]'),
    'legacyFieldBindings',coalesce((
      SELECT jsonb_agg(canonical_row ORDER BY key COLLATE "C") FROM field_bindings
    ),'[]'),
    'legacyScreenGuards',coalesce((
      SELECT jsonb_agg(canonical_row ORDER BY key COLLATE "C") FROM screen_guards
    ),'[]')
  )
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_permission_grant_component()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH normalized AS (
    SELECT actor_code||chr(31)||permission_code||chr(31)||scope_type||chr(31)||effect key,
      to_jsonb(g)-ARRAY['created_at','updated_at'] canonical_row
      FROM public.framework_permission_grant_v1 g
  ), role_grants AS (
    SELECT author_code||chr(31)||feature_code key,
      to_jsonb(g)-'creat_dt' canonical_row
      FROM public.comtnauthorfunctionrelate g
  ), user_overrides AS (
    SELECT public.framework_design_causality_sha256(jsonb_build_object(
      'principal',scrty_dtrmn_trget_id,'memberType',mber_ty_code,
      'featureCode',feature_code,'overrideType',override_type,'useAt',use_at
    )) grant_fingerprint
      FROM public.comtnuserfeatureoverride
  ), account_roles AS (
    SELECT public.framework_design_causality_sha256(jsonb_build_object(
      'principal',scrty_dtrmn_trget_id,'memberType',mber_ty_code,'role',author_code
    )) grant_fingerprint
      FROM public.comtnemplyrscrtyestbs
  ), control AS (
    SELECT grant_mapping_complete,mapping_note
      FROM public.framework_permission_mapping_control_v1 WHERE control_id=1
  )
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-permission-grant/v1',
    'sourceSchema','normalized-v1+legacy-observation/v1',
    'sourceMutationExpected',false,
    'mappingComplete',coalesce((SELECT grant_mapping_complete FROM control),false),
    'mappingNote',coalesce((SELECT mapping_note FROM control),'mapping control missing'),
    'normalizedCount',(SELECT count(*) FROM normalized),
    'legacyRoleGrantCount',(SELECT count(*) FROM role_grants),
    'legacyUserOverrideCount',(SELECT count(*) FROM user_overrides),
    'legacyAccountRoleCount',(SELECT count(*) FROM account_roles),
    'normalized',coalesce((
      SELECT jsonb_agg(canonical_row ORDER BY key COLLATE "C") FROM normalized
    ),'[]'),
    'legacyRoleGrants',coalesce((
      SELECT jsonb_agg(canonical_row ORDER BY key COLLATE "C") FROM role_grants
    ),'[]'),
    'legacyUserOverrideFingerprints',coalesce((
      SELECT jsonb_agg(grant_fingerprint ORDER BY grant_fingerprint COLLATE "C")
        FROM user_overrides
    ),'[]'),
    'legacyAccountRoleFingerprints',coalesce((
      SELECT jsonb_agg(grant_fingerprint ORDER BY grant_fingerprint COLLATE "C")
        FROM account_roles
    ),'[]')
  )
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_snapshot()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE process_doc jsonb; actor_doc jsonb; account_doc jsonb;
        requirement_doc jsonb; grant_doc jsonb;
BEGIN
  process_doc:=public.framework_design_causality_process_component();
  actor_doc:=public.framework_design_causality_actor_component();
  account_doc:=public.framework_design_causality_account_component();
  requirement_doc:=public.framework_design_causality_permission_requirement_component();
  grant_doc:=public.framework_design_causality_permission_grant_component();
  RETURN jsonb_build_object(
    'schema','carbonet.design-causality-root/v1',
    'process',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(process_doc),
      'processCount',(process_doc->>'processCount')::bigint,
      'stepCount',(process_doc->>'stepCount')::bigint
    ),
    'actor',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(actor_doc),
      'actorCount',(actor_doc->>'actorCount')::bigint
    ),
    'accountAssignment',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(account_doc),
      'assignmentCount',(account_doc->>'assignmentCount')::bigint
    ),
    'permissionRequirement',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(requirement_doc),
      'normalizedCount',(requirement_doc->>'normalizedCount')::bigint,
      'featureCount',(requirement_doc->>'featureCount')::bigint,
      'fieldBindingCount',(requirement_doc->>'fieldBindingCount')::bigint,
      'screenGuardCount',(requirement_doc->>'screenGuardCount')::bigint,
      'mappingComplete',(requirement_doc->>'mappingComplete')::boolean
    ),
    'permissionGrant',jsonb_build_object(
      'hash',public.framework_design_causality_sha256(grant_doc),
      'normalizedCount',(grant_doc->>'normalizedCount')::bigint,
      'legacyRoleGrantCount',(grant_doc->>'legacyRoleGrantCount')::bigint,
      'legacyUserOverrideCount',(grant_doc->>'legacyUserOverrideCount')::bigint,
      'legacyAccountRoleCount',(grant_doc->>'legacyAccountRoleCount')::bigint,
      'mappingComplete',(grant_doc->>'mappingComplete')::boolean
    )
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_row_counts(snapshot jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'process',(snapshot->'process')-'hash',
    'actor',(snapshot->'actor')-'hash',
    'accountAssignment',(snapshot->'accountAssignment')-'hash',
    'permissionRequirement',(snapshot->'permissionRequirement')-'hash',
    'permissionGrant',(snapshot->'permissionGrant')-'hash'
  )
$$;

-- Close the online-installation race: no source DML may commit between the
-- baseline snapshot and installation of its ENABLE ALWAYS capture trigger.
-- PostgreSQL Flyway migrations are transactional, so these locks remain held
-- until every trigger and migration postcondition below has committed.
LOCK TABLE framework_process_definition,framework_process_step,
  framework_actor_definition,framework_account_actor_assignment,
  framework_permission_requirement_v1,framework_permission_grant_v1,
  framework_permission_mapping_control_v1,framework_page_design,
  framework_page_field_definition,framework_professional_screen_contract,
  comtnmenufunctioninfo,comtnauthorfunctionrelate,comtnuserfeatureoverride,
  comtnemplyrscrtyestbs IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE snapshot jsonb;
BEGIN
  snapshot:=public.framework_design_causality_snapshot();
  INSERT INTO public.framework_design_causality_head(
    scope_key,revision,canonical_schema_version,canonical_hash,
    process_hash,actor_hash,account_assignment_hash,
    permission_requirement_hash,permission_grant_hash,row_counts,current_event_id
  ) VALUES (
    'GLOBAL',0,1,public.framework_design_causality_sha256(snapshot),
    snapshot#>>'{process,hash}',snapshot#>>'{actor,hash}',
    snapshot#>>'{accountAssignment,hash}',
    snapshot#>>'{permissionRequirement,hash}',
    snapshot#>>'{permissionGrant,hash}',
    public.framework_design_causality_row_counts(snapshot),NULL
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_mark_design_causality_dirty(requested_mask integer)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_mask<1 OR requested_mask>31 THEN
    RAISE EXCEPTION 'design causality change mask must be between 1 and 31'
      USING ERRCODE='22023';
  END IF;
  INSERT INTO public.framework_design_change_signal(
    source_txid,scope_key,change_mask
  ) VALUES(txid_current(),'GLOBAL',requested_mask)
  ON CONFLICT(scope_key,source_txid) DO UPDATE
    SET change_mask=public.framework_design_change_signal.change_mask |
                    excluded.change_mask;
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_semantic_row(
  requested_table text,source_row jsonb
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  CASE requested_table
    WHEN 'framework_process_definition' THEN
      RETURN (source_row-ARRAY[
        'created_at','updated_at','last_reviewed_at','next_review_at',
        'prerequisite_codes','regulation_refs'
      ]) || jsonb_build_object(
        'prerequisite_codes',public.framework_design_causality_csv_set(
          source_row->>'prerequisite_codes'
        ),
        'regulation_refs',public.framework_design_causality_csv_set(
          source_row->>'regulation_refs'
        )
      );
    WHEN 'framework_process_step' THEN
      RETURN (source_row-ARRAY[
        'step_id','evidence_types','segregation_actor_codes',
        'api_contract','input_contract','output_contract'
      ]) || jsonb_build_object(
        'evidence_types',public.framework_design_causality_csv_set(
          source_row->>'evidence_types'
        ),
        'segregation_actor_codes',public.framework_design_causality_csv_set(
          source_row->>'segregation_actor_codes'
        ),
        'api_contract',public.framework_design_causality_text_json(
          source_row->>'api_contract'
        ),
        'input_contract',public.framework_design_causality_text_json(
          source_row->>'input_contract'
        ),
        'output_contract',public.framework_design_causality_text_json(
          source_row->>'output_contract'
        )
      );
    WHEN 'framework_actor_definition' THEN
      RETURN (source_row-ARRAY[
        'created_at','updated_at','capability_codes','conflict_actor_codes'
      ]) || jsonb_build_object(
        'capability_codes',public.framework_design_causality_csv_set(
          source_row->>'capability_codes'
        ),
        'conflict_actor_codes',public.framework_design_causality_csv_set(
          source_row->>'conflict_actor_codes'
        )
      );
    WHEN 'framework_account_actor_assignment' THEN
      RETURN source_row-ARRAY['assignment_id','created_at'];
    WHEN 'framework_permission_requirement_v1' THEN
      RETURN source_row-ARRAY['created_at','updated_at'];
    WHEN 'framework_permission_grant_v1' THEN
      RETURN source_row-ARRAY['created_at','updated_at'];
    WHEN 'framework_permission_mapping_control_v1' THEN
      RETURN source_row-'updated_at';
    WHEN 'framework_page_design' THEN
      RETURN source_row-ARRAY[
        'page_design_id','page_title','page_purpose','screen_type','primary_entity',
        'upstream_step_code','downstream_step_code','entry_condition','exit_condition',
        'responsive_contract','accessibility_contract','exception_contract','design_version',
        'updated_by','created_at','updated_at'
      ];
    WHEN 'framework_page_field_definition' THEN
      RETURN source_row-ARRAY[
        'page_field_id','field_name','data_type','control_type','list_visible',
        'search_enabled','source_table','source_column','evidence_required',
        'responsive_priority','help_text','design_source','created_at','updated_at'
      ];
    WHEN 'framework_professional_screen_contract' THEN
      RETURN jsonb_build_object(
        'process_code',source_row->'process_code','step_code',source_row->'step_code',
        'audience',source_row->'audience','route_path',source_row->'route_path',
        'actor_code',source_row->'actor_code','api_contract',source_row->'api_contract',
        'security_contract',source_row->'security_contract',
        'permission_codes',public.framework_design_causality_json_set(
          source_row->'permission_codes'
        ),
        'authority_verified',source_row->'authority_verified',
        'contract_status',source_row->'contract_status'
      );
    WHEN 'comtnmenufunctioninfo' THEN
      RETURN source_row-ARRAY['frst_regist_pnttm','last_updt_pnttm'];
    WHEN 'comtnauthorfunctionrelate' THEN
      RETURN source_row-'creat_dt';
    WHEN 'comtnuserfeatureoverride' THEN
      RETURN source_row-ARRAY[
        'frst_register_id','frst_regist_dt','last_updusr_id','last_updt_dt'
      ];
    WHEN 'comtnemplyrscrtyestbs' THEN
      RETURN source_row;
    ELSE
      RAISE EXCEPTION 'unsupported design causality source table: %',requested_table
        USING ERRCODE='22023';
  END CASE;
END
$$;

CREATE OR REPLACE FUNCTION framework_capture_design_causality_dirty()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE requested_mask integer:=TG_ARGV[0]::integer;
BEGIN
  IF TG_OP='UPDATE' AND
     public.framework_design_causality_semantic_row(TG_TABLE_NAME,to_jsonb(OLD))
       IS NOT DISTINCT FROM
     public.framework_design_causality_semantic_row(TG_TABLE_NAME,to_jsonb(NEW)) THEN
    RETURN NEW;
  END IF;
  PERFORM public.framework_mark_design_causality_dirty(requested_mask);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE TRIGGER trg_design_causality_process_definition_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_process_definition
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('1');
CREATE TRIGGER trg_design_causality_process_step_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_process_step
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('1');
CREATE TRIGGER trg_design_causality_actor_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_actor_definition
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('2');
CREATE TRIGGER trg_design_causality_account_assignment_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_account_actor_assignment
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('4');
CREATE TRIGGER trg_design_causality_permission_requirement_v1_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_permission_requirement_v1
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('8');
CREATE TRIGGER trg_design_causality_permission_grant_v1_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_permission_grant_v1
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('16');
CREATE TRIGGER trg_design_causality_permission_mapping_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_permission_mapping_control_v1
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('24');
CREATE TRIGGER trg_design_causality_page_design_permission_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_page_design
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('8');
CREATE TRIGGER trg_design_causality_page_field_permission_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_page_field_definition
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('8');
CREATE TRIGGER trg_design_causality_professional_screen_permission_dirty
AFTER INSERT OR UPDATE OR DELETE ON framework_professional_screen_contract
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('8');
CREATE TRIGGER trg_design_causality_menu_function_requirement_dirty
AFTER INSERT OR UPDATE OR DELETE ON comtnmenufunctioninfo
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('8');
CREATE TRIGGER trg_design_causality_role_function_grant_dirty
AFTER INSERT OR UPDATE OR DELETE ON comtnauthorfunctionrelate
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('16');
CREATE TRIGGER trg_design_causality_user_override_grant_dirty
AFTER INSERT OR UPDATE OR DELETE ON comtnuserfeatureoverride
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('16');
CREATE TRIGGER trg_design_causality_account_role_grant_dirty
AFTER INSERT OR UPDATE OR DELETE ON comtnemplyrscrtyestbs
FOR EACH ROW EXECUTE FUNCTION framework_capture_design_causality_dirty('16');

ALTER TABLE framework_process_definition ENABLE ALWAYS TRIGGER
  trg_design_causality_process_definition_dirty;
ALTER TABLE framework_process_step ENABLE ALWAYS TRIGGER
  trg_design_causality_process_step_dirty;
ALTER TABLE framework_actor_definition ENABLE ALWAYS TRIGGER
  trg_design_causality_actor_dirty;
ALTER TABLE framework_account_actor_assignment ENABLE ALWAYS TRIGGER
  trg_design_causality_account_assignment_dirty;
ALTER TABLE framework_permission_requirement_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_permission_requirement_v1_dirty;
ALTER TABLE framework_permission_grant_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_permission_grant_v1_dirty;
ALTER TABLE framework_permission_mapping_control_v1 ENABLE ALWAYS TRIGGER
  trg_design_causality_permission_mapping_dirty;
ALTER TABLE framework_page_design ENABLE ALWAYS TRIGGER
  trg_design_causality_page_design_permission_dirty;
ALTER TABLE framework_page_field_definition ENABLE ALWAYS TRIGGER
  trg_design_causality_page_field_permission_dirty;
ALTER TABLE framework_professional_screen_contract ENABLE ALWAYS TRIGGER
  trg_design_causality_professional_screen_permission_dirty;
ALTER TABLE comtnmenufunctioninfo ENABLE ALWAYS TRIGGER
  trg_design_causality_menu_function_requirement_dirty;
ALTER TABLE comtnauthorfunctionrelate ENABLE ALWAYS TRIGGER
  trg_design_causality_role_function_grant_dirty;
ALTER TABLE comtnuserfeatureoverride ENABLE ALWAYS TRIGGER
  trg_design_causality_user_override_grant_dirty;
ALTER TABLE comtnemplyrscrtyestbs ENABLE ALWAYS TRIGGER
  trg_design_causality_account_role_grant_dirty;

CREATE OR REPLACE FUNCTION framework_compile_design_changes(
  worker_name varchar,expected_revision bigint,expected_canonical_hash varchar
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  worker varchar(100):=btrim(worker_name);
  head_row public.framework_design_causality_head%ROWTYPE;
  snapshot jsonb; root_hash varchar(64); counts jsonb;
  signal_ids bigint[]; combined_mask integer; signal_count integer;
  new_event public.framework_design_causality_event%ROWTYPE;
  old_stage varchar(32); old_version bigint; supersede_evidence varchar(64);
  supersede_evidence_ref varchar(500); initial_evidence_ref varchar(500);
  old_transition_hash varchar(64); initial_evidence varchar(64); affected integer;
BEGIN
  IF current_setting('transaction_isolation') NOT IN ('repeatable read','serializable') THEN
    RAISE EXCEPTION 'design compiler requires REPEATABLE READ or SERIALIZABLE'
      USING ERRCODE='25001';
  END IF;
  IF worker IS NULL OR worker !~ '^[A-Za-z0-9._:-]{1,100}$' THEN
    RAISE EXCEPTION 'invalid design compiler worker name' USING ERRCODE='22023';
  END IF;
  IF expected_revision IS NULL OR expected_canonical_hash IS NULL OR
     expected_canonical_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid expected canonical hash' USING ERRCODE='22023';
  END IF;
  IF NOT pg_try_advisory_xact_lock(1128354388,1380271955) THEN
    RETURN jsonb_build_object('status','BUSY');
  END IF;

  SELECT * INTO STRICT head_row FROM public.framework_design_causality_head
   WHERE scope_key='GLOBAL' FOR UPDATE;
  IF head_row.revision<>expected_revision OR
     head_row.canonical_hash<>expected_canonical_hash THEN
    RAISE EXCEPTION 'stale design head: expected revision/hash %/%, actual %/%',
      expected_revision,expected_canonical_hash,head_row.revision,head_row.canonical_hash
      USING ERRCODE='40001';
  END IF;

  SELECT array_agg(signal_id ORDER BY signal_id),bit_or(change_mask),count(*)
    INTO signal_ids,combined_mask,signal_count
    FROM (
      SELECT signal_id,change_mask FROM public.framework_design_change_signal
       WHERE signal_status='DIRTY' ORDER BY signal_id FOR UPDATE
    ) locked_signals;
  IF signal_count=0 THEN
    RETURN jsonb_build_object(
      'status','NO_WORK','revision',head_row.revision,
      'canonicalHash',head_row.canonical_hash
    );
  END IF;

  snapshot:=public.framework_design_causality_snapshot();
  root_hash:=public.framework_design_causality_sha256(snapshot);
  counts:=public.framework_design_causality_row_counts(snapshot);
  IF root_hash=head_row.canonical_hash THEN
    UPDATE public.framework_design_change_signal SET signal_status='NOOP'
     WHERE signal_id=ANY(signal_ids) AND signal_status='DIRTY';
    RETURN jsonb_build_object(
      'status','NO_SEMANTIC_CHANGE','revision',head_row.revision,
      'canonicalHash',head_row.canonical_hash,'signalCount',signal_count
    );
  END IF;

  INSERT INTO public.framework_design_causality_event(
    scope_key,revision,previous_hash,canonical_hash,process_hash,actor_hash,
    account_assignment_hash,permission_requirement_hash,permission_grant_hash,
    row_counts,canonical_schema_version,change_mask,event_hash
  ) VALUES (
    'GLOBAL',head_row.revision+1,head_row.canonical_hash,root_hash,
    snapshot#>>'{process,hash}',snapshot#>>'{actor,hash}',
    snapshot#>>'{accountAssignment,hash}',snapshot#>>'{permissionRequirement,hash}',
    snapshot#>>'{permissionGrant,hash}',counts,1,combined_mask,
    public.framework_design_causality_event_hash(
      head_row.revision+1,head_row.canonical_hash,root_hash,
      snapshot#>>'{process,hash}',snapshot#>>'{actor,hash}',
      snapshot#>>'{accountAssignment,hash}',snapshot#>>'{permissionRequirement,hash}',
      snapshot#>>'{permissionGrant,hash}',counts,combined_mask
    )
  ) RETURNING * INTO new_event;

  INSERT INTO public.framework_design_causality_event_signal(event_id,signal_id)
  SELECT new_event.event_id,unnest(signal_ids);

  IF head_row.current_event_id IS NOT NULL THEN
    SELECT s.current_stage,s.stage_version,t.row_hash
      INTO old_stage,old_version,old_transition_hash
      FROM public.framework_design_causality_stage s
      JOIN public.framework_design_causality_stage_transition t
        ON t.event_id=s.event_id AND t.new_version=s.stage_version
     WHERE s.event_id=head_row.current_event_id FOR UPDATE OF s;
    IF old_stage NOT IN ('RELAY_E2E_PASSED','SUPERSEDED','TERMINAL_FAILED') THEN
      supersede_evidence:=public.framework_design_causality_sha256(jsonb_build_object(
        'action','SUPERSEDED_BY_NEW_CANONICAL_HEAD',
        'newEventId',new_event.event_id,'newCanonicalHash',root_hash
      ));
      supersede_evidence_ref:=format(
        'db://design-causality/event/%s/superseded-by/%s',
        head_row.current_event_id,new_event.event_id
      );
      UPDATE public.framework_design_causality_stage
         SET current_stage='SUPERSEDED',stage_version=old_version+1,
             lease_owner=NULL,lease_expires_at=NULL,
             evidence_ref=supersede_evidence_ref,
             updated_at=clock_timestamp()
       WHERE event_id=head_row.current_event_id AND stage_version=old_version;
      GET DIAGNOSTICS affected=ROW_COUNT;
      IF affected<>1 THEN
        RAISE EXCEPTION 'superseded stage CAS lost' USING ERRCODE='40001';
      END IF;
      INSERT INTO public.framework_design_causality_stage_transition(
        event_id,new_version,from_stage,to_stage,evidence_hash,evidence_ref,
        previous_transition_hash,transition_actor,row_hash
      ) VALUES(
        head_row.current_event_id,old_version+1,old_stage,'SUPERSEDED',
        supersede_evidence,supersede_evidence_ref,old_transition_hash,worker,
        public.framework_design_causality_transition_hash(
          head_row.current_event_id,old_version+1,old_stage,'SUPERSEDED',
          supersede_evidence,supersede_evidence_ref,worker,old_transition_hash
        )
      );
    END IF;
  END IF;

  INSERT INTO public.framework_design_causality_stage(event_id,current_stage,stage_version)
  VALUES(new_event.event_id,'CANONICAL_COMPILED',0);
  initial_evidence:=public.framework_design_causality_sha256(jsonb_build_object(
    'action','CANONICAL_COMPILED','canonicalHash',root_hash,
    'signalCount',signal_count,'changeMask',combined_mask
  ));
  initial_evidence_ref:=format(
    'db://design-causality/event/%s/canonical-compiled',new_event.event_id
  );
  INSERT INTO public.framework_design_causality_stage_transition(
    event_id,new_version,from_stage,to_stage,evidence_hash,evidence_ref,
    previous_transition_hash,transition_actor,row_hash
  ) VALUES(
    new_event.event_id,0,'NONE','CANONICAL_COMPILED',initial_evidence,
    initial_evidence_ref,NULL,worker,
    public.framework_design_causality_transition_hash(
      new_event.event_id,0,'NONE','CANONICAL_COMPILED',initial_evidence,
      initial_evidence_ref,worker,NULL
    )
  );

  UPDATE public.framework_design_causality_head SET
    revision=new_event.revision,canonical_hash=root_hash,
    process_hash=new_event.process_hash,actor_hash=new_event.actor_hash,
    account_assignment_hash=new_event.account_assignment_hash,
    permission_requirement_hash=new_event.permission_requirement_hash,
    permission_grant_hash=new_event.permission_grant_hash,row_counts=counts,
    current_event_id=new_event.event_id,updated_at=clock_timestamp()
   WHERE scope_key='GLOBAL' AND revision=head_row.revision
     AND canonical_hash=head_row.canonical_hash;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN
    RAISE EXCEPTION 'design head CAS lost' USING ERRCODE='40001';
  END IF;
  UPDATE public.framework_design_change_signal
     SET signal_status='COMPILED',compiled_event_id=new_event.event_id
   WHERE signal_id=ANY(signal_ids) AND signal_status='DIRTY';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>signal_count THEN
    RAISE EXCEPTION 'dirty signal attribution CAS lost' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object(
    'status','COMPILED','eventId',new_event.event_id,'revision',new_event.revision,
    'canonicalHash',root_hash,'signalCount',signal_count,'changeMask',combined_mask,
    'currentStage','CANONICAL_COMPILED'
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_valid_evidence_ref(value text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT value IS NOT NULL AND length(value) BETWEEN 8 AND 500
     AND value ~ '^[a-z][a-z0-9+.-]*://[A-Za-z0-9._:/-]+$'
$$;

CREATE OR REPLACE FUNCTION framework_cas_design_causality_stage(
  requested_event_id bigint,expected_stage varchar,expected_version bigint,
  requested_next_stage varchar,worker_name varchar,evidence jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  worker varchar(100):=btrim(worker_name);
  current_row public.framework_design_causality_stage%ROWTYPE;
  event_row public.framework_design_causality_event%ROWTYPE;
  next_classification varchar(20);
  evidence_hash varchar(64); requested_evidence_ref varchar(500);
  next_source_commit varchar(40); next_source_tree_hash varchar(64);
  next_artifact_hash varchar(64); next_deployment_hash varchar(64);
  next_runtime_hash varchar(64); previous_transition_hash varchar(64);
  new_version bigint;
BEGIN
  IF worker IS NULL OR worker !~ '^[A-Za-z0-9._:-]{1,100}$' THEN
    RAISE EXCEPTION 'invalid design stage worker name' USING ERRCODE='22023';
  END IF;
  IF evidence IS NULL OR jsonb_typeof(evidence)<>'object' THEN
    RAISE EXCEPTION 'stage evidence must be a JSON object' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT current_row FROM public.framework_design_causality_stage
   WHERE event_id=requested_event_id;
  SELECT * INTO STRICT event_row FROM public.framework_design_causality_event
   WHERE event_id=requested_event_id;
  IF current_row.current_stage<>expected_stage OR
     current_row.stage_version<>expected_version THEN
    RAISE EXCEPTION 'stale design stage version' USING ERRCODE='40001';
  END IF;
  IF current_row.current_stage IN ('RELAY_E2E_PASSED','SUPERSEDED','TERMINAL_FAILED') THEN
    RAISE EXCEPTION 'terminal design stage cannot advance: %',current_row.current_stage
      USING ERRCODE='55000';
  END IF;
  SELECT t.row_hash INTO STRICT previous_transition_hash
    FROM public.framework_design_causality_stage_transition t
   WHERE t.event_id=requested_event_id
     AND t.new_version=current_row.stage_version;

  next_classification:=current_row.classification;
  requested_evidence_ref:=evidence->>'evidenceRef';
  next_source_commit:=current_row.source_commit;
  next_source_tree_hash:=current_row.source_tree_hash;
  next_artifact_hash:=current_row.artifact_hash;
  next_deployment_hash:=current_row.deployment_hash;
  next_runtime_hash:=current_row.runtime_hash;

  -- SUPERSEDED is reserved for the compiler's atomic head replacement.  A
  -- generic worker must never be able to invalidate the current head event.
  IF requested_next_stage='TERMINAL_FAILED' THEN
    IF NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'terminal transition requires an immutable evidenceRef'
        USING ERRCODE='22023';
    END IF;
  ELSIF expected_stage='CANONICAL_COMPILED' AND
        requested_next_stage='CHANGE_CLASSIFIED' THEN
    IF NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'classification requires an immutable evidenceRef'
        USING ERRCODE='22023';
    END IF;
    next_classification:=evidence->>'classification';
    IF next_classification NOT IN ('SOURCE_REQUIRED','RUNTIME_ONLY') THEN
      RAISE EXCEPTION 'classification must be SOURCE_REQUIRED or RUNTIME_ONLY'
        USING ERRCODE='22023';
    END IF;
    IF next_classification='RUNTIME_ONLY' THEN
      IF (event_row.change_mask & 11)<>0 THEN
        RAISE EXCEPTION 'process, actor, or permission requirement changes require source generation'
          USING ERRCODE='22023';
      END IF;
      IF evidence->>'runtimeOwnership'<>'DATABASE_PER_REQUEST_V1'
         OR NOT public.framework_design_causality_valid_evidence_ref(
           evidence->>'runtimeOwnershipEvidenceRef'
         )
         OR coalesce(evidence->>'runtimeOwnershipHash','') !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'runtime-only classification lacks DB-per-request authority evidence'
          USING ERRCODE='22023';
      END IF;
    END IF;
  ELSIF expected_stage='CHANGE_CLASSIFIED' AND
        requested_next_stage='SOURCE_GENERATED' AND
        current_row.classification='SOURCE_REQUIRED' THEN
    IF coalesce(evidence->>'sourceCommit','') !~ '^[0-9a-f]{40}$'
       OR coalesce(evidence->>'treeHash','') !~ '^[0-9a-f]{64}$'
       OR NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'generated source requires commit, treeHash, and immutable evidenceRef'
        USING ERRCODE='22023';
    END IF;
    next_source_commit:=evidence->>'sourceCommit';
    next_source_tree_hash:=evidence->>'treeHash';
  ELSIF expected_stage='CHANGE_CLASSIFIED' AND
        requested_next_stage='SOURCE_NOT_REQUIRED' AND
        current_row.classification='RUNTIME_ONLY' THEN
    IF NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'SOURCE_NOT_REQUIRED requires ownership evidenceRef'
        USING ERRCODE='22023';
    END IF;
  ELSIF expected_stage='SOURCE_GENERATED' AND requested_next_stage='BUILT' THEN
    IF coalesce(evidence->>'artifactHash','') !~ '^[0-9a-f]{64}$'
       OR NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'BUILT requires artifactHash and immutable evidenceRef'
        USING ERRCODE='22023';
    END IF;
    next_artifact_hash:=evidence->>'artifactHash';
  ELSIF expected_stage='SOURCE_NOT_REQUIRED' AND
        requested_next_stage='BUILD_NOT_REQUIRED' THEN
    IF NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'BUILD_NOT_REQUIRED requires ownership evidenceRef'
        USING ERRCODE='22023';
    END IF;
  ELSIF expected_stage='BUILT' AND requested_next_stage='DEPLOYED' THEN
    IF coalesce(evidence->>'deploymentHash','') !~ '^[0-9a-f]{64}$'
       OR NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'DEPLOYED requires deploymentHash and immutable evidenceRef'
        USING ERRCODE='22023';
    END IF;
    next_deployment_hash:=evidence->>'deploymentHash';
  ELSIF expected_stage='BUILD_NOT_REQUIRED' AND
        requested_next_stage='DEPLOY_NOT_REQUIRED' THEN
    IF NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'DEPLOY_NOT_REQUIRED requires ownership evidenceRef'
        USING ERRCODE='22023';
    END IF;
  ELSIF expected_stage IN ('DEPLOYED','DEPLOY_NOT_REQUIRED') AND
        requested_next_stage='RUNTIME_APPLIED' THEN
    IF evidence->>'runtimeHash'<>event_row.canonical_hash
       OR coalesce(evidence->>'runtimeIdentityHash','') !~ '^[0-9a-f]{64}$'
       OR NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'RUNTIME_APPLIED requires exact canonical hash and runtime identity evidence'
        USING ERRCODE='22023';
    END IF;
    next_runtime_hash:=evidence->>'runtimeHash';
  ELSIF expected_stage='RUNTIME_APPLIED' AND
        requested_next_stage='RELAY_E2E_PASSED' THEN
    IF coalesce(evidence->>'relayHash','') !~ '^[0-9a-f]{64}$'
       OR NOT public.framework_design_causality_valid_evidence_ref(requested_evidence_ref) THEN
      RAISE EXCEPTION 'relay pass requires relayHash and immutable evidenceRef'
        USING ERRCODE='22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'illegal design stage transition: % -> %',
      expected_stage,requested_next_stage USING ERRCODE='22023';
  END IF;

  IF next_source_commit IS NOT NULL AND
     next_source_commit !~ '^[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'invalid source commit' USING ERRCODE='22023';
  END IF;
  IF next_source_tree_hash IS NOT NULL AND
     next_source_tree_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid source tree hash' USING ERRCODE='22023';
  END IF;
  IF next_artifact_hash IS NOT NULL AND next_artifact_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid artifact hash' USING ERRCODE='22023';
  END IF;
  IF next_deployment_hash IS NOT NULL AND
     next_deployment_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid deployment hash' USING ERRCODE='22023';
  END IF;
  IF next_runtime_hash IS NOT NULL AND next_runtime_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid runtime hash' USING ERRCODE='22023';
  END IF;
  evidence_hash:=public.framework_design_causality_sha256(evidence);

  UPDATE public.framework_design_causality_stage stage SET
    current_stage=requested_next_stage,stage_version=stage.stage_version+1,
    classification=next_classification,lease_owner=NULL,lease_expires_at=NULL,
    attempt_count=stage.attempt_count+1,source_commit=next_source_commit,
    source_tree_hash=next_source_tree_hash,artifact_hash=next_artifact_hash,
    deployment_hash=next_deployment_hash,runtime_hash=next_runtime_hash,
    evidence_ref=coalesce(requested_evidence_ref,stage.evidence_ref),
    updated_at=clock_timestamp()
   WHERE stage.event_id=requested_event_id
     AND stage.current_stage=expected_stage AND stage.stage_version=expected_version
     AND stage.event_id=(
       SELECT current_event_id FROM public.framework_design_causality_head
        WHERE scope_key='GLOBAL'
     )
  RETURNING stage_version INTO new_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'design stage CAS conflict or event is no longer current'
      USING ERRCODE='40001';
  END IF;
  INSERT INTO public.framework_design_causality_stage_transition(
    event_id,new_version,from_stage,to_stage,evidence_hash,evidence_ref,
    previous_transition_hash,transition_actor,row_hash
  ) VALUES(
    requested_event_id,new_version,expected_stage,requested_next_stage,
    evidence_hash,requested_evidence_ref,previous_transition_hash,worker,
    public.framework_design_causality_transition_hash(
      requested_event_id,new_version,expected_stage,requested_next_stage,
      evidence_hash,requested_evidence_ref,worker,previous_transition_hash
    )
  );
  RETURN jsonb_build_object(
    'status','ADVANCED','eventId',requested_event_id,
    'fromStage',expected_stage,'stage',requested_next_stage,
    'stageVersion',new_version,'classification',next_classification,
    'evidenceHash',evidence_hash,'evidenceRef',requested_evidence_ref
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_design_causality_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-status/v1',
    'producerCoverage',jsonb_build_object(
      'databaseDirtySignal',1,'postCommitCompiler',0,'generator',0,
      'deployment',0,'runtimeProbe',0,'relayE2e',0
    ),
    'head',jsonb_build_object(
      'revision',h.revision,'canonicalHash',h.canonical_hash,
      'currentEventId',h.current_event_id,
      'currentStage',s.current_stage,'stageVersion',s.stage_version
    ),
    'dirtySignalCount',(
      SELECT count(*) FROM public.framework_design_change_signal
       WHERE signal_status='DIRTY'
    ),
    'mappingComplete',jsonb_build_object(
      'permissionRequirement',h.row_counts#>'{permissionRequirement,mappingComplete}',
      'permissionGrant',h.row_counts#>'{permissionGrant,mappingComplete}'
    )
  )
  FROM public.framework_design_causality_head h
  LEFT JOIN public.framework_design_causality_stage s
    ON s.event_id=h.current_event_id
  WHERE h.scope_key='GLOBAL'
$$;

CREATE OR REPLACE FUNCTION framework_reject_design_causality_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'design causality event history is append-only'
    USING ERRCODE='55000';
END
$$;

CREATE TRIGGER trg_design_causality_event_immutable
BEFORE UPDATE OR DELETE ON framework_design_causality_event
FOR EACH ROW EXECUTE FUNCTION framework_reject_design_causality_audit_mutation();
CREATE TRIGGER trg_design_causality_event_truncate_immutable
BEFORE TRUNCATE ON framework_design_causality_event
FOR EACH STATEMENT EXECUTE FUNCTION framework_reject_design_causality_audit_mutation();
CREATE TRIGGER trg_design_causality_event_signal_immutable
BEFORE UPDATE OR DELETE ON framework_design_causality_event_signal
FOR EACH ROW EXECUTE FUNCTION framework_reject_design_causality_audit_mutation();
CREATE TRIGGER trg_design_causality_event_signal_truncate_immutable
BEFORE TRUNCATE ON framework_design_causality_event_signal
FOR EACH STATEMENT EXECUTE FUNCTION framework_reject_design_causality_audit_mutation();
CREATE TRIGGER trg_design_causality_transition_immutable
BEFORE UPDATE OR DELETE ON framework_design_causality_stage_transition
FOR EACH ROW EXECUTE FUNCTION framework_reject_design_causality_audit_mutation();
CREATE TRIGGER trg_design_causality_transition_truncate_immutable
BEFORE TRUNCATE ON framework_design_causality_stage_transition
FOR EACH STATEMENT EXECUTE FUNCTION framework_reject_design_causality_audit_mutation();

ALTER TABLE framework_design_causality_event ENABLE ALWAYS TRIGGER
  trg_design_causality_event_immutable;
ALTER TABLE framework_design_causality_event ENABLE ALWAYS TRIGGER
  trg_design_causality_event_truncate_immutable;
ALTER TABLE framework_design_causality_event_signal ENABLE ALWAYS TRIGGER
  trg_design_causality_event_signal_immutable;
ALTER TABLE framework_design_causality_event_signal ENABLE ALWAYS TRIGGER
  trg_design_causality_event_signal_truncate_immutable;
ALTER TABLE framework_design_causality_stage_transition ENABLE ALWAYS TRIGGER
  trg_design_causality_transition_immutable;
ALTER TABLE framework_design_causality_stage_transition ENABLE ALWAYS TRIGGER
  trg_design_causality_transition_truncate_immutable;

REVOKE ALL ON TABLE framework_permission_requirement_v1,
  framework_permission_grant_v1,framework_permission_mapping_control_v1,
  framework_design_change_signal,framework_design_causality_head,
  framework_design_causality_event,framework_design_causality_event_signal,
  framework_design_causality_stage,framework_design_causality_stage_transition
  FROM PUBLIC;
REVOKE ALL ON SEQUENCE framework_design_change_signal_signal_id_seq,
  framework_design_causality_event_event_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION framework_mark_design_causality_dirty(integer),
  framework_capture_design_causality_dirty(),
  framework_design_causality_snapshot(),
  framework_design_causality_process_component(),
  framework_design_causality_actor_component(),
  framework_design_causality_account_component(),
  framework_design_causality_permission_requirement_component(),
  framework_design_causality_permission_grant_component(),
  framework_compile_design_changes(varchar,bigint,varchar),
  framework_cas_design_causality_stage(bigint,varchar,bigint,varchar,varchar,jsonb),
  framework_design_causality_status() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    REVOKE ALL ON TABLE framework_permission_requirement_v1,
      framework_permission_grant_v1,framework_permission_mapping_control_v1,
      framework_design_change_signal,framework_design_causality_head,
      framework_design_causality_event,framework_design_causality_event_signal,
      framework_design_causality_stage,framework_design_causality_stage_transition
      FROM carbonet_app;
    REVOKE ALL ON SEQUENCE framework_design_change_signal_signal_id_seq,
      framework_design_causality_event_event_id_seq FROM carbonet_app;
    REVOKE ALL ON FUNCTION framework_mark_design_causality_dirty(integer),
      framework_capture_design_causality_dirty(),
      framework_design_causality_snapshot(),
      framework_design_causality_process_component(),
      framework_design_causality_actor_component(),
      framework_design_causality_account_component(),
      framework_design_causality_permission_requirement_component(),
      framework_design_causality_permission_grant_component(),
      framework_compile_design_changes(varchar,bigint,varchar),
      framework_cas_design_causality_stage(
        bigint,varchar,bigint,varchar,varchar,jsonb
      ),framework_design_causality_status() FROM carbonet_app;
    GRANT EXECUTE ON FUNCTION framework_design_causality_status() TO carbonet_app;
  END IF;
END
$$;

DO $$
DECLARE source_trigger_count integer; immutable_trigger_count integer;
        snapshot jsonb; public_execute_count integer;
BEGIN
  SELECT count(*) INTO source_trigger_count FROM pg_trigger
   WHERE NOT tgisinternal AND tgenabled='A' AND tgname=ANY(ARRAY[
    'trg_design_causality_process_definition_dirty',
    'trg_design_causality_process_step_dirty','trg_design_causality_actor_dirty',
    'trg_design_causality_account_assignment_dirty',
    'trg_design_causality_permission_requirement_v1_dirty',
    'trg_design_causality_permission_grant_v1_dirty',
    'trg_design_causality_permission_mapping_dirty',
    'trg_design_causality_page_design_permission_dirty',
    'trg_design_causality_page_field_permission_dirty',
    'trg_design_causality_professional_screen_permission_dirty',
    'trg_design_causality_menu_function_requirement_dirty',
    'trg_design_causality_role_function_grant_dirty',
    'trg_design_causality_user_override_grant_dirty',
    'trg_design_causality_account_role_grant_dirty'
  ]);
  IF source_trigger_count<>14 THEN
    RAISE EXCEPTION 'expected 14 enabled-always design source triggers, found %',
      source_trigger_count USING ERRCODE='55000';
  END IF;
  SELECT count(*) INTO immutable_trigger_count FROM pg_trigger
   WHERE NOT tgisinternal AND tgenabled='A' AND tgname=ANY(ARRAY[
    'trg_design_causality_event_immutable',
    'trg_design_causality_event_truncate_immutable',
    'trg_design_causality_event_signal_immutable',
    'trg_design_causality_event_signal_truncate_immutable',
    'trg_design_causality_transition_immutable',
    'trg_design_causality_transition_truncate_immutable'
  ]);
  IF immutable_trigger_count<>6 THEN
    RAISE EXCEPTION 'expected 6 enabled-always immutable triggers, found %',
      immutable_trigger_count USING ERRCODE='55000';
  END IF;
  SELECT count(*) INTO public_execute_count
    FROM unnest(ARRAY[
      'framework_compile_design_changes(character varying,bigint,character varying)'::regprocedure,
      'framework_cas_design_causality_stage(bigint,character varying,bigint,character varying,character varying,jsonb)'::regprocedure,
      'framework_design_causality_status()'::regprocedure
    ]) function_oid
    JOIN pg_proc p ON p.oid=function_oid
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
   WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE';
  IF public_execute_count<>0 THEN
    RAISE EXCEPTION 'PUBLIC can execute privileged design causality functions'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    IF has_function_privilege(
         'carbonet_app',
         'framework_compile_design_changes(character varying,bigint,character varying)',
         'EXECUTE'
       ) OR has_function_privilege(
         'carbonet_app',
         'framework_cas_design_causality_stage(bigint,character varying,bigint,character varying,character varying,jsonb)',
         'EXECUTE'
       ) OR NOT has_function_privilege(
         'carbonet_app','framework_design_causality_status()','EXECUTE'
       ) THEN
      RAISE EXCEPTION 'carbonet_app causality ACL postcondition failed'
        USING ERRCODE='42501';
    END IF;
  END IF;
  snapshot:=public.framework_design_causality_snapshot();
  IF (SELECT count(*) FROM public.framework_design_causality_head)<>1
     OR (SELECT revision FROM public.framework_design_causality_head)<>0
     OR (SELECT current_event_id FROM public.framework_design_causality_head) IS NOT NULL
     OR (SELECT canonical_hash FROM public.framework_design_causality_head)<>
        public.framework_design_causality_sha256(snapshot) THEN
    RAISE EXCEPTION 'canonical baseline head postcondition failed'
      USING ERRCODE='55000';
  END IF;
  IF (SELECT count(*) FROM public.framework_permission_mapping_control_v1)<>1
     OR EXISTS(SELECT 1 FROM public.framework_design_change_signal) THEN
    RAISE EXCEPTION 'mapping-control/signal baseline postcondition failed'
      USING ERRCODE='55000';
  END IF;
END
$$;

COMMENT ON TABLE framework_design_change_signal IS
  'Transaction-local GLOBAL dirty masks; rollback leaves zero rows and one transaction coalesces to one signal';
COMMENT ON TABLE framework_design_causality_event IS
  'Immutable global canonical root revisions; contains five hashes and counts, never canonical account data';
COMMENT ON TABLE framework_design_causality_stage_transition IS
  'Immutable evidence-hash chain for CAS-controlled design delivery stages';
COMMENT ON FUNCTION framework_mark_design_causality_dirty(integer) IS
  'Internal trigger/Flyway hook; future DDL migrations must call explicitly because DDL does not fire row triggers';
COMMENT ON FUNCTION framework_compile_design_changes(varchar,bigint,varchar) IS
  'Post-commit REPEATABLE READ compiler; no worker is installed by milestone 1';
