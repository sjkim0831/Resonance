#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815110000__create_design_causality_outbox.sql"
WORKER_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815113000__install_design_causality_compiler_worker_api.sql"
CODEGEN_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815120000__extend_design_causality_codegen_input_v2.sql"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
PG_BINDIR="${DESIGN_CAUSALITY_PG_BINDIR:-$(pg_config --bindir 2>/dev/null || true)}"
[[ -x "$PG_BINDIR/initdb" && -x "$PG_BINDIR/pg_ctl" ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL PostgreSQL server binaries missing" >&2
  exit 1
}
[[ -f "$MIGRATION" ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL migration missing" >&2
  exit 1
}
[[ -f "$ORCHESTRATOR" ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL orchestrator missing" >&2
  exit 1
}
[[ -f "$WORKER_MIGRATION" ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL worker migration missing" >&2
  exit 1
}
[[ -f "$CODEGEN_MIGRATION" ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL codegen-input migration missing" >&2
  exit 1
}

# The transaction-held source locks must precede the baseline snapshot and
# remain held until the capture triggers are installed.  This ordering closes
# the online Flyway installation window where a concurrent commit could vanish.
lock_line="$(grep -nF 'LOCK TABLE framework_process_definition' "$MIGRATION" | head -n1 | cut -d: -f1)"
baseline_line="$(grep -nF 'INSERT INTO public.framework_design_causality_head(' "$MIGRATION" | head -n1 | cut -d: -f1)"
trigger_line="$(grep -nF 'CREATE TRIGGER trg_design_causality_process_definition_dirty' "$MIGRATION" | head -n1 | cut -d: -f1)"
if [[ -z "$lock_line" || -z "$baseline_line" || -z "$trigger_line" ]] ||
   ! (( lock_line < baseline_line && baseline_line < trigger_line )); then
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL unsafe baseline/trigger install order" >&2
  exit 1
fi
legacy_preflight_rows="$(grep -Ec "^[[:space:]]+\('comtn(menu|author|user|emplyr)" "$MIGRATION")"
[[ "$legacy_preflight_rows" -eq 24 ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL incomplete legacy schema preflight" >&2
  exit 1
}
canonical_collations="$(grep -Fc 'COLLATE "C"' "$MIGRATION")"
[[ "$canonical_collations" -ge 15 ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL canonical sort lacks C collation" >&2
  exit 1
}

TMP="$(mktemp -d)"
DATA="$TMP/data"
SOCKET="$TMP/socket"
PORT="$((56000 + RANDOM % 8000))"
mkdir -p "$SOCKET"
cleanup() {
  set +e
  "$PG_BINDIR/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$TMP"
}
trap cleanup EXIT INT TERM

"$PG_BINDIR/initdb" -D "$DATA" --no-locale --encoding=UTF8 --auth=trust >/dev/null
"$PG_BINDIR/pg_ctl" -D "$DATA" -w start \
  -o "-F -k '$SOCKET' -h '' -p $PORT" >/dev/null
PSQL=("$PG_BINDIR/psql" -h "$SOCKET" -p "$PORT" -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
db() { "${PSQL[@]}" "$@"; }
scalar() { "${PSQL[@]}" -qAtc "$1"; }

db >/dev/null <<'SQL'
CREATE ROLE carbonet_app NOLOGIN;
CREATE TABLE framework_process_definition(
 process_code varchar(80) PRIMARY KEY,process_name varchar(160),domain_code varchar(60),
 process_version varchar(20),goal text,start_condition text,completion_condition text,
 process_status varchar(30),created_at timestamp default now(),updated_at timestamp default now(),
 development_order integer,prerequisite_codes text,parent_process_code varchar(80),
 process_level integer,automation_mode varchar(30),owner_actor_code varchar(60),
 regulation_refs text,risk_level varchar(20),sla_hours integer,review_cycle_days integer,
 lifecycle_status varchar(30),effective_from date,effective_until date,
 last_reviewed_at timestamp,next_review_at timestamp,definition_locked boolean,
 definition_lock_reason text
);
CREATE TABLE framework_process_step(
 step_id bigserial PRIMARY KEY,process_code varchar(80) NOT NULL,
 step_order integer NOT NULL,step_code varchar(100) NOT NULL,step_name varchar(160),
 actor_code varchar(60),from_state varchar(60),command_code varchar(80),to_state varchar(60),
 completion_rule text,user_path varchar(300),admin_path varchar(300),api_contract text,
 parent_step_code varchar(100),step_type varchar(30),requirement_text text,
 input_contract text,output_contract text,requires_user_page boolean,
 requires_admin_page boolean,requires_api boolean,requires_database boolean,
 requires_notification boolean,automation_status varchar(30),sla_hours integer,
 escalation_actor_code varchar(60),evidence_required boolean,evidence_types text,
 segregation_actor_codes text,rollback_command_code varchar(80),decision_rule text,
 UNIQUE(process_code,step_code),UNIQUE(process_code,step_order)
);
CREATE TABLE framework_actor_definition(
 actor_code varchar(60) PRIMARY KEY,actor_name varchar(120),actor_name_en varchar(120),
 actor_type varchar(30),purpose text,capability_codes text,delegation_allowed boolean,
 use_at char(1),created_at timestamp default now(),updated_at timestamp default now(),
 responsibility_text text,accountability_text text,competency_requirements text,
 conflict_actor_codes text,max_concurrent_assignments integer,review_cycle_days integer
);
CREATE TABLE framework_account_actor_assignment(
 assignment_id bigserial PRIMARY KEY,account_id varchar(100),tenant_id varchar(100),
 project_id varchar(100),actor_code varchar(60),data_scope varchar(300),valid_from date,
 valid_until date,assignment_status varchar(20),created_at timestamp default now()
);
CREATE TABLE framework_page_design(
 page_design_id bigserial PRIMARY KEY,process_code varchar(80),step_code varchar(100),
 audience varchar(16),page_code varchar(220),page_title varchar(300),page_purpose text,
 screen_type varchar(40),planned_route_path varchar(500),actual_route_path varchar(500),
 route_status varchar(24),primary_entity varchar(160),upstream_step_code varchar(100),
 downstream_step_code varchar(100),actor_code varchar(80),entry_condition text,
 exit_condition text,responsive_contract jsonb,accessibility_contract jsonb,
 security_contract jsonb,exception_contract jsonb,design_status varchar(24),
 design_version integer,updated_by varchar(100),created_at timestamp default now(),
 updated_at timestamp default now(),UNIQUE(process_code,step_code,audience),UNIQUE(page_code)
);
CREATE TABLE framework_page_field_definition(
 page_field_id bigserial PRIMARY KEY,page_design_id bigint,field_order integer,
 field_group varchar(80),field_code varchar(120),field_name varchar(240),data_type varchar(40),
 control_type varchar(40),required boolean,editable boolean,list_visible boolean,
 search_enabled boolean,source_table varchar(160),source_column varchar(160),
 api_property varchar(160),mapping_status varchar(24),validation_contract jsonb,
 privacy_class varchar(24),permission_code varchar(120),evidence_required boolean,
 responsive_priority integer,help_text text,design_source varchar(40),
 created_at timestamp default now(),updated_at timestamp default now(),
 UNIQUE(page_design_id,field_code)
);
CREATE TABLE framework_professional_screen_contract(
 contract_id bigserial PRIMARY KEY,process_code varchar(80),step_code varchar(100),
 audience varchar(20),route_path varchar(400),screen_name varchar(200) default 'Screen',
 actor_code varchar(60),business_purpose text default 'Purpose',
 entry_condition text default 'READY',exit_condition text default 'DONE',
 kpi_contract text default '["done"]',section_contract text default '["main"]',
 field_contract text default '["value"]',command_contract text default '["SAVE"]',
 state_contract text default '["READY"]',api_contract text default '["POST"]',
 data_contract text default '["record"]',evidence_contract text default '["audit"]',
 responsive_contract text default 'responsive',accessibility_contract text default 'accessible',
 security_contract text default 'secure',api_verified boolean default true,
 database_verified boolean default true,authority_verified boolean default true,
 responsive_verified boolean default true,accessibility_verified boolean default true,
 exception_states_verified boolean default true,audit_evidence_ref text default 'fixture://evidence',
 contract_status varchar(30),permission_codes jsonb default '[]'::jsonb,
 created_at timestamp default now(),updated_at timestamp default now(),
 updated_by varchar(100),design_version varchar(30),contract_revision bigint
 );
CREATE TABLE framework_screen_blueprint(
 blueprint_id bigserial PRIMARY KEY,blueprint_code varchar(140) UNIQUE,
 process_code varchar(80),step_code varchar(100),actor_code varchar(60),
 audience varchar(20),page_id varchar(160),page_name varchar(200),
 route_path varchar(300),screen_type varchar(40),template_code varchar(80),
 specification_json text default '{}',traceability_json text default '{}',
 validation_status varchar(20),validation_message text,generated_source_path varchar(500),
 created_by varchar(100),created_at timestamp default now(),updated_at timestamp default now(),
 implementation_strategy varchar(30) default 'GENERATED_RUNTIME',
 transition_status varchar(30),source_reference text
 );
CREATE TABLE framework_step_execution_spec(
 process_code varchar(80),step_code varchar(100),spec_version integer,
 actor_contract jsonb,business_contract jsonb,transition_contract jsonb,
 input_contract jsonb,output_contract jsonb,screen_contract jsonb,field_contract jsonb,
 command_contract jsonb,api_contract jsonb,persistence_contract jsonb,
 handoff_contract jsonb,test_contract jsonb,guide_contract jsonb,
 nonfunctional_contract jsonb,design_status varchar(32),approval_status varchar(24),
 generation_status varchar(24),blocker_codes jsonb,source_hash varchar(64),
 approved_by varchar(100),approved_at timestamp,created_at timestamp default now(),
 updated_at timestamp default now(),PRIMARY KEY(process_code,step_code)
 );
CREATE TABLE comtnmenufunctioninfo(
 menu_code varchar(20),feature_code varchar(100) PRIMARY KEY,feature_nm varchar(200),
 feature_nm_en varchar(200),feature_dc varchar(500),use_at char(1),
 frst_regist_pnttm timestamp,last_updt_pnttm timestamp
);
CREATE TABLE comtnauthorfunctionrelate(
 author_code varchar(50),feature_code varchar(100),grant_authority_yn char(1),
 creat_dt timestamp,PRIMARY KEY(author_code,feature_code)
);
CREATE TABLE comtnuserfeatureoverride(
 scrty_dtrmn_trget_id varchar(100),mber_ty_code char(1),feature_code varchar(100),
 override_type char(1),use_at char(1),frst_register_id varchar(100),
 frst_regist_dt timestamp,last_updusr_id varchar(100),last_updt_dt timestamp
);
CREATE TABLE comtnemplyrscrtyestbs(
 scrty_dtrmn_trget_id varchar(100) PRIMARY KEY,mber_ty_code char(1),author_code varchar(50)
);
CREATE OR REPLACE FUNCTION framework_try_jsonb(value text,fallback jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
BEGIN
 IF value IS NULL OR btrim(value)='' THEN RETURN fallback; END IF;
 RETURN value::jsonb;
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_array(value); END
$$;
CREATE OR REPLACE FUNCTION framework_strict_jsonb_array(value text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog,public AS $$
DECLARE parsed jsonb;
BEGIN
 parsed:=value::jsonb;
 IF jsonb_typeof(parsed)<>'array' THEN RETURN NULL; END IF;
 RETURN parsed;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END
$$;
CREATE OR REPLACE FUNCTION framework_screen_blueprint_export(
 requested_limit integer DEFAULT 5000
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('schemaVersion','2.0.0','blueprints','[]'::jsonb)
$$;
CREATE OR REPLACE FUNCTION framework_screen_ownership(requested_blueprint_id bigint)
RETURNS varchar LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN implementation_strategy='GENERATED_RUNTIME' THEN 'GENERATED'
             WHEN implementation_strategy='ADOPT_EXISTING' AND EXISTS(
               SELECT 1 FROM framework_professional_screen_contract c
                WHERE c.process_code=b.process_code AND c.step_code=b.step_code
                  AND c.audience=b.audience AND lower(c.route_path)=lower(b.route_path)
             ) THEN 'HYBRID'
             ELSE 'MANUAL' END::varchar
 FROM framework_screen_blueprint b WHERE blueprint_id=requested_blueprint_id
$$;
CREATE OR REPLACE FUNCTION framework_screen_design_hash(requested_blueprint_id bigint)
RETURNS varchar LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT (md5(concat_ws('|',b.blueprint_code,b.process_code,b.step_code,b.actor_code,
          b.audience,b.route_path,b.screen_type,b.template_code,b.specification_json,
          b.traceability_json,b.validation_status,coalesce((select string_agg(concat_ws('|',
          c.contract_id,c.contract_status,c.business_purpose,c.entry_condition,
          c.exit_condition,c.kpi_contract,c.section_contract,c.field_contract,
          c.command_contract,c.state_contract,c.api_contract,c.data_contract,
          c.evidence_contract,c.responsive_contract,c.accessibility_contract,
          c.security_contract),E'\n' order by c.contract_id)
          from framework_professional_screen_contract c
          where c.process_code=b.process_code and c.step_code=b.step_code
            and c.audience=b.audience and lower(c.route_path)=lower(b.route_path)),'')))||
         md5('SCREEN_CONTRACT_V1|'||concat_ws('|',b.blueprint_code,b.process_code,
          b.step_code,b.actor_code,b.audience,b.route_path,coalesce((select string_agg(
          c.contract_id::text||'|'||c.kpi_contract,E'\n' order by c.contract_id)
          from framework_professional_screen_contract c
          where c.process_code=b.process_code and c.step_code=b.step_code
            and c.audience=b.audience and lower(c.route_path)=lower(b.route_path)),''))))::varchar
 FROM framework_screen_blueprint b
 WHERE b.blueprint_id=requested_blueprint_id
$$;
CREATE OR REPLACE FUNCTION framework_canonical_design_catalog(requested_limit integer DEFAULT 5000)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 WITH source AS (
  SELECT upper(b.process_code)||'|'||upper(b.step_code)||'|'||upper(b.audience)||'|'||
           lower(b.route_path) screen_key,
         upper(b.process_code) process_code,upper(b.step_code) step_code,
          upper(b.audience) audience,lower(b.route_path) route_path,
          jsonb_build_object('blueprintCode',b.blueprint_code,'pageId',b.page_id,
            'specification',b.specification_json,'businessPurpose',c.business_purpose,
            'sections',c.section_contract,'fields',c.field_contract,
            'evidenceTypes',s.evidence_types,
            'segregationActorCodes',s.segregation_actor_codes,
            'inputContract',framework_try_jsonb(s.input_contract,'{}'::jsonb),
            'outputContract',framework_try_jsonb(s.output_contract,'{}'::jsonb)) design
   FROM framework_screen_blueprint b JOIN framework_professional_screen_contract c
     ON c.process_code=b.process_code AND c.step_code=b.step_code
    AND c.audience=b.audience AND lower(c.route_path)=lower(b.route_path)
   JOIN framework_process_step s ON s.process_code=b.process_code
    AND s.step_code=b.step_code
  WHERE b.validation_status='VALID' ORDER BY
    (upper(b.process_code)||'|'||upper(b.step_code)||'|'||upper(b.audience)||'|'||
     lower(b.route_path)) COLLATE "C" LIMIT requested_limit
 ), hashed AS (
  SELECT *,encode(sha256(convert_to(design::text,'UTF8')),'hex') design_hash FROM source
 ), aggregate AS (
  SELECT count(*)::integer screen_count,
    encode(sha256(convert_to(coalesce(string_agg(screen_key||':'||design_hash,E'\n'
      ORDER BY screen_key COLLATE "C"),''),'UTF8')),'hex') catalog_hash,
    coalesce(jsonb_agg(jsonb_build_object('screenKey',screen_key,
      'processCode',process_code,'stepCode',step_code,'audience',audience,
      'routePath',route_path,'designHash',design_hash)
      ORDER BY screen_key COLLATE "C"),'[]'::jsonb) screens FROM hashed
 ) SELECT jsonb_build_object('schema','carbonet.canonical-design/v1',
      'catalogHash',catalog_hash,'screenCount',screen_count,'screens',screens)
   FROM aggregate
$$;
CREATE TABLE framework_canonical_endpoint_upgrade_activation_event(
 activation_event_id bigserial PRIMARY KEY,scope_process varchar(80),action varchar(20)
);
CREATE OR REPLACE FUNCTION framework_canonical_endpoint_effective_binding(
 requested_process varchar
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('status',CASE WHEN EXISTS(
   SELECT 1 FROM framework_canonical_endpoint_upgrade_activation_event
    WHERE scope_process=requested_process
 ) THEN 'ACTIVE' ELSE 'SOURCE' END,'processCode',requested_process)
$$;
CREATE TABLE framework_project_completion_run(
 run_id varchar(36) PRIMARY KEY,run_status varchar(30) NOT NULL DEFAULT 'RUNNING',
 result_json text,completed_at timestamp,
 selected_process_count integer,executable_job_count integer,
 retried_job_count integer,blocked_process_count integer
);
SQL

# A drifted live permission column must abort and roll the whole Flyway unit
# back before any causality object becomes visible.
set +e
db --single-transaction \
  -c "ALTER TABLE comtnmenufunctioninfo ALTER COLUMN feature_code TYPE text" \
  -f "$MIGRATION" >"$TMP/schema-drift.out" 2>&1
drift_rc=$?
set -e
if [[ "$drift_rc" -eq 0 ]] ||
   ! grep -Fq 'legacy permission schema preflight failed' "$TMP/schema-drift.out" ||
   [[ "$(scalar "select data_type from information_schema.columns where table_schema='public' and table_name='comtnmenufunctioninfo' and column_name='feature_code'")" != 'character varying' ]] ||
   [[ -n "$(scalar "select to_regclass('public.framework_design_causality_head')")" ]]; then
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL legacy schema drift was not atomic/fail-closed" >&2
  exit 1
fi

# Flyway applies this PostgreSQL migration transactionally.  Exercise the same
# boundary so the source locks cover baseline creation through trigger install.
db --single-transaction -f "$MIGRATION" >/dev/null
# Mutant: a preexisting cluster role may carry old M1 grants.  M2 must remove
# them rather than merely granting its new narrow wrapper.
db >/dev/null <<'SQL'
CREATE ROLE carbonet_design_compiler
  NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOLOGIN
  NOREPLICATION NOBYPASSRLS;
GRANT EXECUTE ON FUNCTION framework_mark_design_causality_dirty(integer),
  framework_cas_design_causality_stage(
    bigint,varchar,bigint,varchar,varchar,jsonb
  ) TO carbonet_design_compiler;
SQL
db --single-transaction -f "$WORKER_MIGRATION" >/dev/null

db >/dev/null <<'SQL'
-- Three source tables and both source/runtime-only classes coalesce to one signal.
BEGIN;
INSERT INTO framework_actor_definition VALUES(
 'ACTOR_A','Actor A','Actor A','BUSINESS','Own test work','WRITE,READ',true,'Y',
 now(),now(),'Responsible','Accountable','Trained','ACTOR_C,ACTOR_B',10,90
);
INSERT INTO framework_process_definition VALUES(
 'PROC_A','Process A','TEST','1.0.0','Complete work','READY','DONE','DESIGN',
 now(),now(),10,'PROC_Z,PROC_B',NULL,1,'GENERATOR_READY','ACTOR_A','ISO,LAW',
 'HIGH',24,90,'DESIGN',current_date,NULL,NULL,NULL,false,''
);
INSERT INTO framework_process_step(
 process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
 completion_rule,user_path,admin_path,api_contract,parent_step_code,step_type,
 requirement_text,input_contract,output_contract,requires_user_page,requires_admin_page,
 requires_api,requires_database,requires_notification,automation_status,sla_hours,
 escalation_actor_code,evidence_required,evidence_types,segregation_actor_codes,
 rollback_command_code,decision_rule
) VALUES
('PROC_A',2,'STEP_B','Second','ACTOR_A','MID','FINISH','DONE','complete','/b',NULL,
 '{"method":"POST"}',NULL,'TASK','finish','{"z":1,"a":2}','{"ok":true}',true,false,
 true,true,false,'READY',4,'ACTOR_A',true,'LOG,FILE','ACTOR_C,ACTOR_B','BACK','ok'),
('PROC_A',1,'STEP_A','First','ACTOR_A','READY','START','MID','start','/a',NULL,
 '{"method":"POST"}',NULL,'TASK','start','{"x":1}','{"id":"uuid"}',true,false,
 true,true,false,'READY',4,'ACTOR_A',true,'FILE,LOG','ACTOR_B,ACTOR_C','BACK','ok');
INSERT INTO framework_account_actor_assignment(
 account_id,tenant_id,project_id,actor_code,data_scope,valid_from,assignment_status
) VALUES('pii-account@example.test','private-tenant','private-project','ACTOR_A',
         'private-scope',current_date,'ACTIVE');
COMMIT;

DO $$
BEGIN
 IF (SELECT count(*) FROM framework_design_change_signal)<>1 THEN
   RAISE EXCEPTION 'multi-table transaction did not coalesce to one signal';
 END IF;
 IF (SELECT change_mask FROM framework_design_change_signal)<>7 THEN
   RAISE EXCEPTION 'coalesced change mask mismatch';
 END IF;
END $$;

-- Timestamp-only and normalized-set reorder mutations are semantic no-ops.
UPDATE framework_actor_definition SET updated_at=clock_timestamp() WHERE actor_code='ACTOR_A';
UPDATE framework_actor_definition
   SET capability_codes='READ,WRITE,READ',conflict_actor_codes='ACTOR_B,ACTOR_C'
 WHERE actor_code='ACTOR_A';
UPDATE framework_process_step SET evidence_types='FILE,LOG,FILE'
 WHERE process_code='PROC_A' AND step_code='STEP_A';

-- Rolled-back source mutations leave no committed dirty signal.
BEGIN;
UPDATE framework_process_definition SET goal='rolled back secret goal' WHERE process_code='PROC_A';
ROLLBACK;
DO $$
BEGIN
 IF (SELECT count(*) FROM framework_design_change_signal)<>1 THEN
   RAISE EXCEPTION 'no-op/rollback signal invariant failed';
 END IF;
END $$;

-- Two later committed transactions remain separately attributable to one event.
UPDATE framework_process_definition SET goal='Semantically changed goal'
 WHERE process_code='PROC_A';
BEGIN;
INSERT INTO comtnmenufunctioninfo VALUES(
 'MENU_A','PERM_A','Permission A','Permission A','Test permission','Y',now(),now()
);
INSERT INTO framework_page_design(
 process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
 planned_route_path,actual_route_path,route_status,primary_entity,actor_code,
 entry_condition,exit_condition,responsive_contract,accessibility_contract,
 security_contract,exception_contract,design_status,design_version,updated_by
) VALUES(
 'PROC_A','STEP_A','USER','PAGE_A','Page A','Test','FORM','/planned/a','/a',
 'IMPLEMENTED','test','ACTOR_A','READY','DONE','{}','{}',
 '{"authority":"PERM_A"}','{}','DESIGN_COMPLETE',1,'TEST'
);
INSERT INTO framework_page_field_definition(
 page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,api_property,mapping_status,
 validation_contract,privacy_class,permission_code,evidence_required,
 responsive_priority,help_text,design_source
) SELECT page_design_id,1,'MAIN','value','Value','STRING','TEXT',true,true,false,false,
          'value','LOGICAL_CONTRACT','{}','INTERNAL','PERM_A',false,10,'Help','TEST'
    FROM framework_page_design WHERE page_code='PAGE_A';
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,actor_code,api_contract,security_contract,
 authority_verified,contract_status,permission_codes,updated_by,design_version,
 contract_revision
) VALUES(
 'PROC_A','STEP_A','USER','/a','ACTOR_A','["POST /api/a"]',
 '{"authority":"PERM_A"}',true,'VERIFIED','["PERM_A"]','TEST','1.0.0',1
);
COMMIT;
DO $$
BEGIN
 IF (SELECT count(*) FROM framework_design_change_signal)<>3 THEN
   RAISE EXCEPTION 'visible transaction attribution setup failed';
 END IF;
 IF EXISTS(SELECT 1 FROM framework_design_causality_event) THEN
   RAISE EXCEPTION 'new DB/old script window consumed signals without worker';
 END IF;
END $$;
SQL

head_revision="$(scalar "select revision from framework_design_causality_head where scope_key='GLOBAL'")"
head_hash="$(scalar "select canonical_hash from framework_design_causality_head where scope_key='GLOBAL'")"
compile_result="$(db -qAt <<SQL
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT framework_compile_design_changes('pg-test',$head_revision,'$head_hash');
COMMIT;
SQL
)"
[[ "$compile_result" == *'"status": "COMPILED"'* ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL initial compile: $compile_result" >&2
  exit 1
}

db >/dev/null <<'SQL'
DO $$
DECLARE event_row framework_design_causality_event%ROWTYPE;
BEGIN
 SELECT * INTO STRICT event_row FROM framework_design_causality_event;
 IF event_row.change_mask<>15 OR event_row.revision<>1 THEN
   RAISE EXCEPTION 'compiled event mask/revision mismatch';
 END IF;
 IF (SELECT count(*) FROM framework_design_causality_event_signal)<>3 THEN
   RAISE EXCEPTION 'visible dirty transactions were not both attributed';
 END IF;
 IF (SELECT current_stage FROM framework_design_causality_stage
      WHERE event_id=event_row.event_id)<>'CANONICAL_COMPILED' THEN
   RAISE EXCEPTION 'compiler falsely claimed runtime applied';
 END IF;
 IF (SELECT count(*) FROM framework_design_change_signal WHERE signal_status='DIRTY')<>0 THEN
   RAISE EXCEPTION 'compiled dirty signals remain';
 END IF;
 IF EXISTS(
   SELECT 1 FROM framework_design_causality_event e
    WHERE to_jsonb(e)::text ~ '(pii-account@example.test|private-tenant|private-project|private-scope)'
 ) OR EXISTS(
   SELECT 1 FROM framework_design_change_signal s
    WHERE to_jsonb(s)::text ~ '(pii-account@example.test|private-tenant|private-project|private-scope)'
 ) THEN
   RAISE EXCEPTION 'raw account data leaked into causality ledger';
 END IF;
 IF (SELECT row_counts#>>'{accountAssignment,assignmentCount}'
       FROM framework_design_causality_event)<>'1' THEN
   RAISE EXCEPTION 'privacy-safe account count missing';
 END IF;
END $$;
SQL

# ACL: the application may observe status, but no installed role may compile,
# forge stage evidence, or mutate the ledger directly.
db >/dev/null <<'SQL'
CREATE ROLE app_caller LOGIN IN ROLE carbonet_app;
CREATE ROLE public_caller LOGIN;
SQL
APP_PSQL=("$PG_BINDIR/psql" -h "$SOCKET" -p "$PORT" -U app_caller -d postgres -X -v ON_ERROR_STOP=1)
PUBLIC_PSQL=("$PG_BINDIR/psql" -h "$SOCKET" -p "$PORT" -U public_caller -d postgres -X -v ON_ERROR_STOP=1)
expect_sqlstate() {
  local expected="$1" label="$2" output rc
  shift 2
  set +e
  output="$("$@" 2>&1)"; rc=$?
  set -e
  if (( rc == 0 )) || ! grep -Eq "(ERROR|FATAL):[[:space:]]+$expected:" <<<"$output"; then
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label expected=$expected rc=$rc" >&2
    exit 1
  fi
}
"${APP_PSQL[@]}" -qAtc "select framework_design_causality_status()->>'schema'" \
  | grep -Fxq 'carbonet.design-causality-status/v1'
if "${APP_PSQL[@]}" -qAtc \
  "select framework_compile_design_changes('forged',1,repeat('0',64))" \
  >/dev/null 2>&1; then
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL app compiler ACL' >&2; exit 1
fi
if "${APP_PSQL[@]}" -qAtc \
  "select framework_cas_design_causality_stage(1,'CANONICAL_COMPILED',0,'RUNTIME_APPLIED','forged','{}')" \
  >/dev/null 2>&1; then
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL app CAS ACL' >&2; exit 1
fi
if "${APP_PSQL[@]}" -qAtc \
  "update framework_design_causality_head set revision=999" >/dev/null 2>&1; then
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL app table DML ACL' >&2; exit 1
fi
if "${PUBLIC_PSQL[@]}" -qAtc \
  "select framework_compile_design_changes('forged',1,repeat('0',64))" \
  >/dev/null 2>&1; then
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL PUBLIC compiler ACL' >&2; exit 1
fi
if "${PUBLIC_PSQL[@]}" -qAtc "select framework_design_causality_status()" \
  >/dev/null 2>&1; then
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL PUBLIC status ACL' >&2; exit 1
fi
expect_sqlstate 42501 'owner bypassed SET LOCAL ROLE guard' \
  "${PSQL[@]}" -v VERBOSITY=verbose -qAtc \
  'select framework_run_design_causality_compiler_worker()'
expect_sqlstate 25001 'READ COMMITTED bypassed isolation guard' \
  "${PSQL[@]}" -v VERBOSITY=verbose -qAtc \
  'begin; set local role carbonet_design_compiler; select framework_run_design_causality_compiler_worker(); commit'
expect_sqlstate 42501 'compiler role read causality table directly' \
  "${PSQL[@]}" -v VERBOSITY=verbose -qAtc \
  'begin isolation level repeatable read; set local role carbonet_design_compiler; select count(*) from framework_design_causality_head; commit'
expect_sqlstate 42501 'compiler role invoked owner compiler directly' \
  "${PSQL[@]}" -v VERBOSITY=verbose -qAtc \
  "begin isolation level repeatable read; set local role carbonet_design_compiler; select framework_compile_design_changes('forged',0,repeat('0',64)); commit"
expect_sqlstate 42501 'application invoked compiler worker API' \
  "${APP_PSQL[@]}" -v VERBOSITY=verbose -qAtc \
  'select framework_run_design_causality_compiler_worker()'
expect_sqlstate 42501 'PUBLIC invoked compiler worker API' \
  "${PUBLIC_PSQL[@]}" -v VERBOSITY=verbose -qAtc \
  'select framework_run_design_causality_compiler_worker()'

event_id="$(scalar "select current_event_id from framework_design_causality_head")"
event_hash="$(scalar "select canonical_hash from framework_design_causality_event where event_id=$event_id")"
db >/dev/null <<SQL
DO \$\$
BEGIN
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $event_id,'CANONICAL_COMPILED',99,'CHANGE_CLASSIFIED','stale-worker',
   '{"classification":"SOURCE_REQUIRED","evidenceRef":"db://classification/stale"}'::jsonb
  );
  RAISE EXCEPTION 'stale version was accepted';
 EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $event_id,'CANONICAL_COMPILED',0,'RUNTIME_APPLIED','pg-test',
   jsonb_build_object('runtimeHash','$event_hash','runtimeIdentityHash',repeat('a',64),
                      'evidenceRef','db://runtime/illegal')
  );
  RAISE EXCEPTION 'illegal stage jump was accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $event_id,'CANONICAL_COMPILED',0,'SUPERSEDED','forged-worker',
   '{"evidenceRef":"db://supersede/forged"}'::jsonb
  );
  RAISE EXCEPTION 'external worker superseded the current head';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $event_id,'CANONICAL_COMPILED',0,'CHANGE_CLASSIFIED','pg-test',
   '{"classification":"SOURCE_REQUIRED"}'::jsonb
  );
  RAISE EXCEPTION 'source classification without evidenceRef was accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM framework_cas_design_causality_stage(
  $event_id,'CANONICAL_COMPILED',0,'CHANGE_CLASSIFIED','pg-test',
  '{"classification":"SOURCE_REQUIRED","evidenceRef":"db://classification/source"}'::jsonb
 );
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $event_id,'CHANGE_CLASSIFIED',1,'SOURCE_NOT_REQUIRED','pg-test',
   '{"evidenceRef":"db://classification/wrong-branch"}'::jsonb
  );
  RAISE EXCEPTION 'source-required event entered N/A branch';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END
\$\$;
SQL

# Two workers race the exact same version; the single-row CAS permits one winner.
CAS_SQL="select framework_cas_design_causality_stage($event_id,'CHANGE_CLASSIFIED',1,'SOURCE_GENERATED','race-worker',jsonb_build_object('sourceCommit',repeat('a',40),'treeHash',repeat('b',64),'evidenceRef','db://source/generated'));"
set +e
"${PSQL[@]}" -qAtc "$CAS_SQL" >"$TMP/cas-a.out" 2>&1 & cas_a=$!
"${PSQL[@]}" -qAtc "$CAS_SQL" >"$TMP/cas-b.out" 2>&1 & cas_b=$!
wait "$cas_a"; rc_a=$?
wait "$cas_b"; rc_b=$?
set -e
if ! { [[ "$rc_a" -eq 0 && "$rc_b" -ne 0 ]] ||
       [[ "$rc_b" -eq 0 && "$rc_a" -ne 0 ]]; }; then
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL concurrent CAS rc=$rc_a/$rc_b" >&2
  exit 1
fi

db >/dev/null <<SQL
DO \$\$
BEGIN
 PERFORM framework_cas_design_causality_stage(
  $event_id,'SOURCE_GENERATED',2,'BUILT','pg-test',
  jsonb_build_object('artifactHash',repeat('c',64),'evidenceRef','db://build/attestation')
 );
 PERFORM framework_cas_design_causality_stage(
  $event_id,'BUILT',3,'DEPLOYED','pg-test',
  jsonb_build_object('deploymentHash',repeat('d',64),'evidenceRef','db://deploy/promotion')
 );
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $event_id,'DEPLOYED',4,'RUNTIME_APPLIED','pg-test',
   jsonb_build_object('runtimeHash',repeat('0',64),
     'runtimeIdentityHash',repeat('e',64),'evidenceRef','db://runtime/wrong-hash')
  );
  RAISE EXCEPTION 'wrong runtime hash was accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM framework_cas_design_causality_stage(
  $event_id,'DEPLOYED',4,'RUNTIME_APPLIED','pg-test',
  jsonb_build_object('runtimeHash','$event_hash',
    'runtimeIdentityHash',repeat('e',64),'evidenceRef','db://runtime/exact-probe')
 );
 PERFORM framework_cas_design_causality_stage(
  $event_id,'RUNTIME_APPLIED',5,'RELAY_E2E_PASSED','pg-test',
  jsonb_build_object('relayHash',repeat('f',64),'evidenceRef','db://relay/e2e')
 );
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $event_id,'RELAY_E2E_PASSED',6,'TERMINAL_FAILED','pg-test',
   '{"evidenceRef":"db://terminal/illegal"}'::jsonb
  );
  RAISE EXCEPTION 'terminal stage advanced';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 IF (SELECT count(*) FROM framework_design_causality_stage_transition t
      LEFT JOIN framework_design_causality_stage_transition p
        ON p.event_id=t.event_id AND p.new_version=t.new_version-1
     WHERE t.event_id=$event_id AND t.new_version>0
       AND t.previous_transition_hash IS DISTINCT FROM p.row_hash)<>0 THEN
  RAISE EXCEPTION 'transition hash chain is broken';
 END IF;
 IF EXISTS(
   SELECT 1 FROM framework_design_causality_stage_transition t
    WHERE t.event_id=$event_id AND (
      NOT framework_design_causality_valid_evidence_ref(t.evidence_ref)
      OR t.row_hash<>framework_design_causality_transition_hash(
        t.event_id,t.new_version,t.from_stage,t.to_stage,t.evidence_hash,
        t.evidence_ref,t.transition_actor,t.previous_transition_hash
      )
    )
 ) OR (SELECT count(*) FROM framework_design_causality_stage_transition
        WHERE event_id=$event_id)<>7 THEN
  RAISE EXCEPTION 'immutable transition evidence registry is incomplete';
 END IF;
 IF (SELECT source_tree_hash FROM framework_design_causality_stage
      WHERE event_id=$event_id)<>repeat('b',64)
    OR (SELECT artifact_hash FROM framework_design_causality_stage
        WHERE event_id=$event_id)<>repeat('c',64)
    OR (SELECT deployment_hash FROM framework_design_causality_stage
        WHERE event_id=$event_id)<>repeat('d',64)
    OR (SELECT evidence_ref FROM framework_design_causality_stage_transition
        WHERE event_id=$event_id AND new_version=2)<>'db://source/generated' THEN
  RAISE EXCEPTION 'source/build/deploy evidence was overwritten';
 END IF;
END
\$\$;
SQL

compile_current() {
  local worker="$1" revision canonical
  revision="$(scalar "select revision from framework_design_causality_head where scope_key='GLOBAL'")"
  canonical="$(scalar "select canonical_hash from framework_design_causality_head where scope_key='GLOBAL'")"
  db -qAt <<SQL
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT framework_compile_design_changes('$worker',$revision,'$canonical');
COMMIT;
SQL
}

no_work_result="$(compile_current no-work-test)"
[[ "$no_work_result" == *'"status": "NO_WORK"'* ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL no-work: $no_work_result" >&2; exit 1;
}
event_count_before="$(scalar 'select count(*) from framework_design_causality_event')"
db -qAtc "select framework_mark_design_causality_dirty(1)" >/dev/null
noop_result="$(compile_current explicit-noop-test)"
[[ "$noop_result" == *'"status": "NO_SEMANTIC_CHANGE"'* ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL explicit no-op: $noop_result" >&2; exit 1;
}
[[ "$(scalar 'select count(*) from framework_design_causality_event')" == "$event_count_before" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL no-op created event' >&2; exit 1;
}

# Physical delete/reinsert and set reordering preserve the semantic component hash.
process_hash_before="$(scalar "select framework_design_causality_sha256(framework_design_causality_process_component())")"
db >/dev/null <<'SQL'
BEGIN;
CREATE TEMP TABLE saved_step ON COMMIT DROP AS
 SELECT * FROM framework_process_step WHERE process_code='PROC_A' AND step_code='STEP_B';
DELETE FROM framework_process_step WHERE process_code='PROC_A' AND step_code='STEP_B';
INSERT INTO framework_process_step SELECT * FROM saved_step;
UPDATE framework_process_definition SET prerequisite_codes='PROC_B,PROC_Z,PROC_B',
 regulation_refs='LAW,ISO,LAW' WHERE process_code='PROC_A';
COMMIT;
SQL
process_hash_after="$(scalar "select framework_design_causality_sha256(framework_design_causality_process_component())")"
[[ "$process_hash_before" == "$process_hash_after" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL row/set order changed component hash' >&2; exit 1;
}
reorder_result="$(compile_current reorder-noop-test)"
[[ "$reorder_result" == *'"status": "NO_SEMANTIC_CHANGE"'* ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL reorder no-op: $reorder_result" >&2; exit 1;
}

# Account assignment is runtime-policy-only only with explicit DB-per-request ownership evidence.
db -qAtc "update framework_account_actor_assignment set assignment_status='SUSPENDED' where account_id='pii-account@example.test'" >/dev/null
account_compile="$(compile_current account-compile-test)"
[[ "$account_compile" == *'"changeMask": 4'* ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL account mask: $account_compile" >&2; exit 1;
}
account_event="$(scalar 'select current_event_id from framework_design_causality_head')"
account_hash="$(scalar "select canonical_hash from framework_design_causality_event where event_id=$account_event")"
db >/dev/null <<SQL
DO \$\$
BEGIN
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $account_event,'CANONICAL_COMPILED',0,'CHANGE_CLASSIFIED','account-worker',
   '{"classification":"RUNTIME_ONLY"}'::jsonb
  );
  RAISE EXCEPTION 'runtime-only classification without ownership evidence passed';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM framework_cas_design_causality_stage(
  $account_event,'CANONICAL_COMPILED',0,'CHANGE_CLASSIFIED','account-worker',
  jsonb_build_object(
   'classification','RUNTIME_ONLY','runtimeOwnership','DATABASE_PER_REQUEST_V1',
   'runtimeOwnershipHash',repeat('1',64),
   'runtimeOwnershipEvidenceRef','db://runtime-ownership/account-v1',
   'evidenceRef','db://runtime-ownership/account-v1'
  )
 );
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $account_event,'CHANGE_CLASSIFIED',1,'SOURCE_GENERATED','account-worker',
   jsonb_build_object('sourceCommit',repeat('a',40),'treeHash',repeat('b',64),
                      'evidenceRef','db://source/illegal-account')
  );
  RAISE EXCEPTION 'account assignment entered source generation branch';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM framework_cas_design_causality_stage(
  $account_event,'CHANGE_CLASSIFIED',1,'SOURCE_NOT_REQUIRED','account-worker',
  '{"evidenceRef":"db://runtime-ownership/account-source-na"}'::jsonb
 );
 PERFORM framework_cas_design_causality_stage(
  $account_event,'SOURCE_NOT_REQUIRED',2,'BUILD_NOT_REQUIRED','account-worker',
  '{"evidenceRef":"db://runtime-ownership/account-build-na"}'::jsonb
 );
 PERFORM framework_cas_design_causality_stage(
  $account_event,'BUILD_NOT_REQUIRED',3,'DEPLOY_NOT_REQUIRED','account-worker',
  '{"evidenceRef":"db://runtime-ownership/account-deploy-na"}'::jsonb
 );
END
\$\$;
SQL

# A newer canonical event atomically supersedes the unfinished account event.
db -qAtc "update framework_actor_definition set purpose='Own changed test work' where actor_code='ACTOR_A'" >/dev/null
actor_compile="$(compile_current actor-compile-test)"
[[ "$actor_compile" == *'"changeMask": 2'* ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL actor mask: $actor_compile" >&2; exit 1;
}
new_event="$(scalar 'select current_event_id from framework_design_causality_head')"
db >/dev/null <<SQL
DO \$\$
BEGIN
 IF (SELECT current_stage FROM framework_design_causality_stage
      WHERE event_id=$account_event)<>'SUPERSEDED' THEN
  RAISE EXCEPTION 'unfinished prior event was not superseded';
 END IF;
 IF (SELECT previous_transition_hash FROM framework_design_causality_stage_transition
      WHERE event_id=$account_event AND new_version=5) IS DISTINCT FROM
    (SELECT row_hash FROM framework_design_causality_stage_transition
      WHERE event_id=$account_event AND new_version=4) THEN
  RAISE EXCEPTION 'supersede transition broke hash chain';
 END IF;
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $account_event,'DEPLOY_NOT_REQUIRED',4,'RUNTIME_APPLIED','stale-account-worker',
   jsonb_build_object('runtimeHash','$account_hash','runtimeIdentityHash',repeat('2',64),
                      'evidenceRef','db://runtime/stale-event')
  );
  RAISE EXCEPTION 'superseded event advanced';
 EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $account_event,'SUPERSEDED',5,'RUNTIME_APPLIED','stale-account-worker',
   jsonb_build_object('runtimeHash','$account_hash','runtimeIdentityHash',repeat('2',64),
                      'evidenceRef','db://runtime/terminal-event')
  );
  RAISE EXCEPTION 'terminal superseded event advanced';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
END
\$\$;
SQL

# Stale/null head arguments fail closed and leave the dirty signal for a fresh worker.
old_revision="$head_revision"
old_hash="$head_hash"
db -qAtc "update framework_process_definition set goal='Second semantic goal' where process_code='PROC_A'" >/dev/null
if db -qAt <<SQL >/dev/null 2>&1
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT framework_compile_design_changes('stale-worker',$old_revision,'$old_hash');
COMMIT;
SQL
then echo 'DESIGN_CAUSALITY_POSTGRES_FAIL stale head accepted' >&2; exit 1; fi
if db -qAt <<'SQL' >/dev/null 2>&1
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT framework_compile_design_changes(NULL,NULL,NULL);
COMMIT;
SQL
then echo 'DESIGN_CAUSALITY_POSTGRES_FAIL null compiler CAS accepted' >&2; exit 1; fi
[[ "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")" == 1 ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL stale compile consumed signal' >&2; exit 1;
}
fresh_compile="$(compile_current fresh-worker)"
[[ "$fresh_compile" == *'"status": "COMPILED"'* ]] || {
  echo "DESIGN_CAUSALITY_POSTGRES_FAIL fresh compile: $fresh_compile" >&2; exit 1;
}

db >/dev/null <<'SQL'
DO $$
BEGIN
 BEGIN
  INSERT INTO framework_permission_requirement_v1(
   process_code,step_code,permission_code,scope_type,resource_contract,guard_contract
  ) VALUES('proc_a','STEP_A','PERM_A','PROJECT','{}','{}');
  RAISE EXCEPTION 'lowercase normalized permission identifier accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO framework_permission_grant_v1(
   actor_code,permission_code,scope_type,effect
  ) VALUES('ACTOR_A','PERM_A','PROJECT','ALLOW');
  INSERT INTO framework_permission_grant_v1(
   actor_code,permission_code,scope_type,effect
  ) VALUES('ACTOR_A','PERM_A','PROJECT','DENY');
  RAISE EXCEPTION 'simultaneous ALLOW and DENY accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SQL

# ENABLE ALWAYS is tested under replica mode for source capture and audit rejection.
# This head snapshot models a signal/ERR exit: source DIRTY may commit, while no
# causality head/event bytes are published until the next PRE_WORK recovery.
deferred_head_before="$(scalar "select revision||'|'||canonical_hash||'|'||current_event_id||'|'||extract(epoch from updated_at) from framework_design_causality_head where scope_key='GLOBAL'")"
db >/dev/null <<'SQL'
BEGIN;
SET LOCAL session_replication_role=replica;
UPDATE framework_actor_definition SET accountability_text='Replica-mode semantic change'
 WHERE actor_code='ACTOR_A';
DO $$
BEGIN
 BEGIN
  UPDATE framework_design_causality_event SET canonical_hash=canonical_hash;
  RAISE EXCEPTION 'event update bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  DELETE FROM framework_design_causality_event
   WHERE event_id=(SELECT min(event_id) FROM framework_design_causality_event);
  RAISE EXCEPTION 'event delete bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  TRUNCATE framework_design_causality_event CASCADE;
  RAISE EXCEPTION 'event truncate bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  UPDATE framework_design_causality_event_signal SET event_id=event_id;
  RAISE EXCEPTION 'event-signal update bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  DELETE FROM framework_design_causality_event_signal
   WHERE signal_id=(SELECT min(signal_id) FROM framework_design_causality_event_signal);
  RAISE EXCEPTION 'event-signal delete bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  TRUNCATE framework_design_causality_event_signal;
  RAISE EXCEPTION 'event-signal truncate bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  UPDATE framework_design_causality_stage_transition SET evidence_hash=evidence_hash;
  RAISE EXCEPTION 'transition update bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  DELETE FROM framework_design_causality_stage_transition
   WHERE event_id=(SELECT min(event_id) FROM framework_design_causality_stage_transition);
  RAISE EXCEPTION 'transition delete bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
  TRUNCATE framework_design_causality_stage_transition;
  RAISE EXCEPTION 'transition truncate bypassed immutable trigger';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
END $$;
COMMIT;
SQL
[[ "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY' and change_mask=2")" == 1 ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL replica-mode source trigger bypassed' >&2; exit 1;
}
deferred_head_after="$(scalar "select revision||'|'||canonical_hash||'|'||current_event_id||'|'||extract(epoch from updated_at) from framework_design_causality_head where scope_key='GLOBAL'")"
[[ "$deferred_head_before" == "$deferred_head_after" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL deferred recovery published partial head' >&2; exit 1;
}

# The next run's PRE_WORK gate must compile the preserved signal and reach a
# fresh NO_WORK linearization point before any project DML.  A second dirty=0
# invocation must not change ledger or head timestamps.
PROJECT_AUTO_COMPLETION_LIBRARY_ONLY=true source "$ORCHESTRATOR"
unset PROJECT_AUTO_COMPLETION_LIBRARY_ONLY
psqlq(){ "${PSQL[@]}" -qAt "$@"; }
recovery_run_id='00000000-0000-0000-0000-000000000001'
db -qAtc "insert into framework_project_completion_run(run_id,result_json) values('$recovery_run_id','{\"designCausality\":{\"compilerInvocation\":{\"preWork\":{\"result\":\"NO_WORK\"}}}}')" >/dev/null
record_design_causality_deferred_recovery \
  "$recovery_run_id" ORCHESTRATOR_ERROR null 75 777
[[ "$(scalar "select run_status||'|'||(result_json::jsonb#>>'{designCausality,compilerInvocation,preWork,result}')||'|'||(result_json::jsonb#>>'{designCausality,compilerInvocation,postWork,result}')||'|'||(result_json::jsonb#>>'{designCausality,compilerInvocation,postWork,invoked}') from framework_project_completion_run where run_id='$recovery_run_id'")" == 'FAILED|NO_WORK|DEFERRED_RECOVERY_REQUIRED|false' ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL deferred recovery evidence did not preserve PRE' >&2; exit 1;
}
[[ "$deferred_head_after" == "$(scalar "select revision||'|'||canonical_hash||'|'||current_event_id||'|'||extract(epoch from updated_at) from framework_design_causality_head where scope_key='GLOBAL'")" &&
   "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY' and change_mask=2")" == 1 ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL deferred handler consumed or published dirty state' >&2; exit 1;
}
# Install one exact codegen source cohort before M1.1. The migration must leave
# every existing v1 head/event byte untouched and append one bit-63 signal.
db >/dev/null <<'SQL'
INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,created_by,implementation_strategy
) VALUES(
 'BP_A','PROC_A','STEP_A','ACTOR_A','USER','page-a','Page A','/a','FORM','KRDS_TASK',
 '{"sections":["main"]}','{"rfx":"REQ-A"}','VALID','TEST','GENERATED_RUNTIME'
);
INSERT INTO framework_step_execution_spec(
 process_code,step_code,spec_version,actor_contract,business_contract,
 transition_contract,input_contract,output_contract,screen_contract,field_contract,
 command_contract,api_contract,persistence_contract,handoff_contract,test_contract,
 guide_contract,nonfunctional_contract,design_status,approval_status,generation_status,
 blocker_codes,source_hash
) VALUES(
 'PROC_A','STEP_A',1,'{"actorCode":"ACTOR_A"}','{"goal":"test"}',
 '{"from":"READY","to":"DONE"}','{"schema":{}}','{"schema":{}}',
 '[{"audience":"USER"}]','[]','[{"commandCode":"START"}]','[]',
 '{"transactional":true}','{"transitions":[]}','[]','{"title":"Guide"}',
 '{"accessibility":"AA"}','DESIGN_COMPLETE','APPROVED','READY','[]',repeat('a',64)
);
SQL
v1_head_guard="$(scalar "select framework_design_causality_sha256(to_jsonb(h)) from framework_design_causality_head h where scope_key='GLOBAL'")"
v1_event_guard="$(scalar "select count(*)||'|'||coalesce(framework_design_causality_sha256(jsonb_agg(to_jsonb(e) order by event_id)),repeat('0',64)) from framework_design_causality_event e")"

# Exact consumed-column/type drift must abort the complete Flyway transaction.
set +e
db --single-transaction \
  -c "alter table framework_screen_blueprint alter column page_id type text" \
  -f "$CODEGEN_MIGRATION" >"$TMP/codegen-schema-drift.out" 2>&1
codegen_drift_rc=$?
set -e
if [[ "$codegen_drift_rc" -eq 0 ]] ||
   ! grep -Fq 'codegen-input source column preflight failed' "$TMP/codegen-schema-drift.out" ||
   [[ "$(scalar "select udt_name from information_schema.columns where table_schema='public' and table_name='framework_screen_blueprint' and column_name='page_id'")" != varchar ]] ||
   [[ -n "$(scalar "select column_name from information_schema.columns where table_schema='public' and table_name='framework_design_causality_head' and column_name='codegen_input_hash'")" ]]; then
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL codegen schema drift was not atomic/fail-closed' >&2; exit 1
fi

db --single-transaction -f "$CODEGEN_MIGRATION" >/dev/null
[[ "$v1_head_guard" == "$(scalar "select framework_design_causality_sha256(to_jsonb(h)-'codegen_input_hash') from framework_design_causality_head h where scope_key='GLOBAL'")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL M1.1 rewrote v1 head' >&2; exit 1;
}
[[ "$v1_event_guard" == "$(scalar "select count(*)||'|'||coalesce(framework_design_causality_sha256(jsonb_agg(to_jsonb(e)-'codegen_input_hash' order by event_id)),repeat('0',64)) from framework_design_causality_event e")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL M1.1 rewrote v1 event history' >&2; exit 1;
}
[[ "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY' and change_mask=63")" == 1 ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL exact bit-63 seed missing' >&2; exit 1;
}
[[ "$(scalar "select
  (select count(*) from framework_screen_blueprint)||'|'||
  (select count(*) from framework_design_codegen_blueprint_leaf_cache)||'|'||
  (select count(*) from framework_professional_screen_contract)||'|'||
  (select count(*) from framework_design_codegen_contract_leaf_cache)||'|'||
  (select count(*) from framework_step_execution_spec)||'|'||
  (select count(*) from framework_design_codegen_step_leaf_cache)")" == '1|1|1|1|1|1' ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL M1.1 cache baseline cardinality drifted' >&2; exit 1;
}
if "${APP_PSQL[@]}" -qAtc "update framework_design_codegen_blueprint_leaf_cache set inventory_base_hash=repeat('0',64)" >/dev/null 2>&1; then
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL app mutated design leaf cache' >&2; exit 1
fi

# Runtime readiness binds every trigger to its exact table, function and ALWAYS
# state. A rolling/disabled trigger must block before any project/source write.
readiness_write_guard="$(scalar "select
  (select revision from framework_design_causality_head where scope_key='GLOBAL')||'|'||
  (select count(*) from framework_design_causality_event)||'|'||
  (select count(*) from framework_design_change_signal)||'|'||
  (select count(*) from framework_permission_requirement_v1)||'|'||
  (select count(*) from framework_process_definition)")"
for disabled_trigger in \
  framework_permission_requirement_v1:trg_design_causality_permission_requirement_cache_dirty \
  framework_process_step:trg_design_causality_process_step_raw_csv_dirty \
  framework_process_definition:trg_design_causality_process_definition_truncate_dirty; do
  disabled_table="${disabled_trigger%%:*}"
  disabled_name="${disabled_trigger##*:}"
  db -qAtc "alter table $disabled_table disable trigger $disabled_name" >/dev/null
  set +e
  disabled_output="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=2 \
    DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 \
    run_design_causality_post_commit_compiler PRE_WORK 2>/dev/null)"
  disabled_rc=$?
  set -e
  [[ "$disabled_rc" -eq 75 && -z "$disabled_output" &&
     "$readiness_write_guard" == "$(scalar "select
       (select revision from framework_design_causality_head where scope_key='GLOBAL')||'|'||
       (select count(*) from framework_design_causality_event)||'|'||
       (select count(*) from framework_design_change_signal)||'|'||
       (select count(*) from framework_permission_requirement_v1)||'|'||
       (select count(*) from framework_process_definition)")" ]] || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL disabled trigger $disabled_name was not write-blocking" >&2; exit 1;
  }
  db -qAtc "alter table $disabled_table enable always trigger $disabled_name" >/dev/null
done

# Runtime drift mutant: an owner grant after migration must make readiness fail
# closed until the protected-function ACL is repaired.
for protected_function in \
  'framework_cas_design_causality_stage(bigint,varchar,bigint,varchar,varchar,jsonb)' \
  'framework_capture_design_causality_process_step_raw_dirty()'; do
  db -qAtc "grant execute on function $protected_function to carbonet_design_compiler" >/dev/null
  set +e
  forged_acl_output="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=3 \
    DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 \
    run_design_causality_post_commit_compiler PRE_WORK 2>/dev/null)"
  forged_acl_rc=$?
  set -e
  [[ "$forged_acl_rc" -eq 78 && -z "$forged_acl_output" ]] || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL runtime grant was accepted: $protected_function" >&2; exit 1;
  }
  db -qAtc "revoke all on function $protected_function from carbonet_design_compiler" >/dev/null
done
worker_result="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=3 \
  DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 \
  run_design_causality_post_commit_compiler PRE_WORK)"
WORKER_RESULT="$worker_result" python3 - <<'PY'
import json, os
d=json.loads(os.environ['WORKER_RESULT'])
assert d['result']=='DRAINED' and d['compiledEvents']==1
assert d['phase']=='PRE_WORK'
assert d['attempts']==2 and d['dirtyAtLinearization']==0
assert d['revisionAfter']==d['revisionBefore']+1
assert isinstance(d['currentEventId'],int) and d['currentEventId']>0
assert len(d['canonicalHash'])==64
assert d['canonicalSchemaVersion']==2 and len(d['codegenInputHash'])==64
assert d['codegenReadiness']=='BLOCKED' and d['activeBindingCount']==0
assert 'STEP_PACKAGE_SHAPE_ATTESTATION_PENDING' in d['codegenReadinessReasons']
assert d['currentStage']=='CANONICAL_COMPILED'
PY
[[ "$(scalar "select canonical_schema_version||'|'||change_mask||'|'||length(codegen_input_hash) from framework_design_causality_event where event_id=(select current_event_id from framework_design_causality_head where scope_key='GLOBAL')")" == '2|63|64' ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL v2 compiler event/mask closure mismatch' >&2; exit 1;
}
before_no_work="$(scalar "
  select revision||'|'||current_event_id||'|'||extract(epoch from updated_at)||'|'||
    (select count(*) from framework_design_causality_event)||'|'||
    (select count(*) from framework_design_change_signal)||'|'||
    (select count(*) from framework_design_causality_stage_transition)
  from framework_design_causality_head where scope_key='GLOBAL'
")"
no_work_result="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=3 \
  DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 \
  run_design_causality_post_commit_compiler PRE_WORK)"
after_no_work="$(scalar "
  select revision||'|'||current_event_id||'|'||extract(epoch from updated_at)||'|'||
    (select count(*) from framework_design_causality_event)||'|'||
    (select count(*) from framework_design_change_signal)||'|'||
    (select count(*) from framework_design_causality_stage_transition)
  from framework_design_causality_head where scope_key='GLOBAL'
")"
NO_WORK_RESULT="$no_work_result" python3 - <<'PY'
import json, os
d=json.loads(os.environ['NO_WORK_RESULT'])
assert d['result']=='NO_WORK' and d['attempts']==1 and d['dirtyAtLinearization']==0
assert d['revisionAfter']==d['revisionBefore']
assert isinstance(d['currentEventId'],int) and d['currentEventId']>0
assert len(d['canonicalHash'])==64
assert d['canonicalSchemaVersion']==2 and len(d['codegenInputHash'])==64
assert d['codegenReadiness']=='BLOCKED' and d['activeBindingCount']==0
assert 'STEP_PACKAGE_SHAPE_ATTESTATION_PENDING' in d['codegenReadinessReasons']
PY
[[ "$before_no_work" == "$after_no_work" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL dirty=0 worker changed ledger' >&2; exit 1;
}

db >/dev/null <<'SQL'
DO $$
DECLARE snapshot jsonb; source_triggers integer; immutable_triggers integer;
        public_privileges integer; pii_pattern text:=
          '(pii-account@example.test|private-tenant|private-project|private-scope)';
BEGIN
 snapshot:=framework_design_causality_snapshot();
 IF (SELECT canonical_hash FROM framework_design_causality_head WHERE scope_key='GLOBAL')
      <>framework_design_causality_sha256(snapshot) THEN
  RAISE EXCEPTION 'head does not recompute from current canonical source';
 END IF;
 IF EXISTS(
   SELECT 1 FROM framework_design_causality_head h
    WHERE h.process_hash<>snapshot#>>'{process,hash}'
       OR h.actor_hash<>snapshot#>>'{actor,hash}'
       OR h.account_assignment_hash<>snapshot#>>'{accountAssignment,hash}'
       OR h.permission_requirement_hash<>snapshot#>>'{permissionRequirement,hash}'
       OR h.permission_grant_hash<>snapshot#>>'{permissionGrant,hash}'
       OR h.codegen_input_hash<>snapshot#>>'{codegenInput,hash}'
 ) THEN RAISE EXCEPTION 'component head hashes mismatch'; END IF;
 SELECT count(*) INTO source_triggers FROM pg_trigger
  WHERE NOT tgisinternal AND tgenabled='A'
    AND tgname LIKE 'trg_design_causality_%_dirty';
 SELECT count(*) INTO immutable_triggers FROM pg_trigger
  WHERE NOT tgisinternal AND tgenabled='A'
    AND tgname IN(
      'trg_design_causality_event_immutable','trg_design_causality_event_truncate_immutable',
      'trg_design_causality_event_signal_immutable','trg_design_causality_event_signal_truncate_immutable',
      'trg_design_causality_transition_immutable','trg_design_causality_transition_truncate_immutable'
    );
  IF source_triggers<>39 OR immutable_triggers<>6 THEN
  RAISE EXCEPTION 'trigger catalog invariant mismatch %/%',source_triggers,immutable_triggers;
 END IF;
 SELECT count(*) INTO public_privileges
   FROM unnest(ARRAY[
     'framework_compile_design_changes(character varying,bigint,character varying)'::regprocedure,
     'framework_cas_design_causality_stage(bigint,character varying,bigint,character varying,character varying,jsonb)'::regprocedure,
     'framework_run_design_causality_compiler_worker()'::regprocedure
   ]) function_oid
   JOIN pg_proc p ON p.oid=function_oid
   CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
  WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE';
 IF public_privileges<>0 OR has_function_privilege(
    'carbonet_app','framework_compile_design_changes(character varying,bigint,character varying)','EXECUTE'
  ) OR has_function_privilege(
    'carbonet_app',
    'framework_cas_design_causality_stage(bigint,character varying,bigint,character varying,character varying,jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'carbonet_app','framework_run_design_causality_compiler_worker()','EXECUTE'
  ) THEN RAISE EXCEPTION 'privileged function ACL mismatch'; END IF;
 IF EXISTS(
   SELECT 1 FROM pg_roles r JOIN pg_authid a USING(oid)
    WHERE r.rolname='carbonet_design_compiler' AND (
      r.rolsuper OR r.rolinherit OR r.rolcreaterole OR r.rolcreatedb OR
      r.rolcanlogin OR r.rolreplication OR r.rolbypassrls OR
      r.rolconnlimit<>-1 OR r.rolvaliduntil IS NOT NULL OR
      r.rolconfig IS NOT NULL OR a.rolpassword IS NOT NULL
    )
 ) OR (SELECT count(*) FROM pg_auth_members
        WHERE roleid='carbonet_design_compiler'::regrole)<>1 THEN
  RAISE EXCEPTION 'compiler worker role catalog contract drifted';
 END IF;
 IF EXISTS(SELECT 1 FROM framework_design_change_signal WHERE signal_status='DIRTY') THEN
  RAISE EXCEPTION 'final dirty signals remain';
 END IF;
 IF (SELECT count(*) FROM framework_design_causality_stage_transition t
      LEFT JOIN framework_design_causality_stage_transition p
        ON p.event_id=t.event_id AND p.new_version=t.new_version-1
     WHERE t.new_version>0 AND
       t.previous_transition_hash IS DISTINCT FROM p.row_hash)<>0 THEN
  RAISE EXCEPTION 'global transition hash chain mismatch';
 END IF;
 IF (SELECT string_agg(to_jsonb(e)::text,'') FROM framework_design_causality_event e)
       ~ pii_pattern
    OR (SELECT string_agg(to_jsonb(s)::text,'') FROM framework_design_change_signal s)
       ~ pii_pattern
    OR (SELECT string_agg(to_jsonb(t)::text,'') FROM framework_design_causality_stage_transition t)
       ~ pii_pattern
    OR framework_design_causality_status()::text ~ pii_pattern
    OR framework_design_causality_account_component()::text ~ pii_pattern THEN
  RAISE EXCEPTION 'raw PII leaked into ledger/status/fingerprint projection';
 END IF;
 IF framework_design_causality_status()#>>'{producerCoverage,postCommitCompiler}'<>'0'
    OR framework_design_causality_status()#>>'{producerCoverage,deployment}'<>'0' THEN
  RAISE EXCEPTION 'persistent producer coverage is overstated';
 END IF;
END $$;
SQL

compile_current_design() {
  local revision canonical_hash
  revision="$(scalar "select revision from framework_design_causality_head where scope_key='GLOBAL'")"
  canonical_hash="$(scalar "select canonical_hash from framework_design_causality_head where scope_key='GLOBAL'")"
  db -qAt <<SQL
begin isolation level repeatable read;
select (framework_compile_design_changes('m11-pg-mutant',$revision,'$canonical_hash')->>'status');
commit;
SQL
}

# The canonical compiler currently serializes these CSV fields as raw text.
# Set-equivalent whitespace/order changes are therefore causal, while rollback
# leaves both the signal ledger and current head unchanged.
raw_csv_components_before="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
raw_csv_catalog_before="$(scalar "select framework_canonical_design_catalog(5000)->>'catalogHash'")"
raw_csv_sets_before="$(scalar "select framework_design_causality_csv_set(evidence_types)::text||'|'||framework_design_causality_csv_set(segregation_actor_codes)::text from framework_process_step where process_code='PROC_A' and step_code='STEP_A'")"
db -qAtc "update framework_process_step set evidence_types=' LOG , FILE , FILE ',segregation_actor_codes=' ACTOR_C , ACTOR_B ' where process_code='PROC_A' and step_code='STEP_A'" >/dev/null
[[ "$(scalar "select coalesce(bit_or(change_mask),0) from framework_design_change_signal where signal_status='DIRTY'")" == 1 ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL raw CSV change missed exact mask-1 signal' >&2; exit 1;
}
raw_csv_status="$(compile_current_design)"
raw_csv_components_after="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
raw_csv_catalog_after="$(scalar "select framework_canonical_design_catalog(5000)->>'catalogHash'")"
raw_csv_sets_after="$(scalar "select framework_design_causality_csv_set(evidence_types)::text||'|'||framework_design_causality_csv_set(segregation_actor_codes)::text from framework_process_step where process_code='PROC_A' and step_code='STEP_A'")"
RAW_CSV_BEFORE="$raw_csv_components_before" RAW_CSV_AFTER="$raw_csv_components_after" \
RAW_CSV_STATUS="$raw_csv_status" python3 - <<'PY'
import os
b=os.environ['RAW_CSV_BEFORE'].split('|'); a=os.environ['RAW_CSV_AFTER'].split('|')
assert len(b)==len(a)==7 and os.environ['RAW_CSV_STATUS']=='COMPILED'
assert a[0]!=b[0] and a[1:6]==b[1:6] and int(a[6])==int(b[6])+1
PY
[[ "$raw_csv_catalog_before" != "$raw_csv_catalog_after" &&
   "$raw_csv_sets_before" == "$raw_csv_sets_after" &&
   "$(scalar "select change_mask from framework_design_causality_event where event_id=(select current_event_id from framework_design_causality_head where scope_key='GLOBAL')")" == 1 ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL raw CSV canonical/root closure mismatch' >&2; exit 1;
}
raw_csv_rollback_guard="$(scalar "select (select revision||'|'||canonical_hash from framework_design_causality_head where scope_key='GLOBAL')||'|'||(select count(*) from framework_design_change_signal where signal_status='DIRTY')")"
db >/dev/null <<'SQL'
BEGIN;
UPDATE framework_process_step
 SET evidence_types='FILE,LOG,FILE',segregation_actor_codes='ACTOR_B,ACTOR_C',
     input_contract=' rollback-malformed-input ',
     output_contract=' rollback-malformed-output '
 WHERE process_code='PROC_A' AND step_code='STEP_A';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM framework_design_change_signal
   WHERE source_txid=txid_current() AND signal_status='DIRTY' AND change_mask=1)
 THEN RAISE EXCEPTION 'raw CSV rollback mutation missed transaction-local signal'; END IF;
END $$;
ROLLBACK;
SQL
[[ "$raw_csv_rollback_guard" == "$(scalar "select (select revision||'|'||canonical_hash from framework_design_causality_head where scope_key='GLOBAL')||'|'||(select count(*) from framework_design_change_signal where signal_status='DIRTY')")" &&
   "$raw_csv_catalog_after" == "$(scalar "select framework_canonical_design_catalog(5000)->>'catalogHash'")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL raw CSV rollback changed durable state' >&2; exit 1;
}

run_process_contract_mutant() {
  local label="$1" expected="$2" expected_signal="$3" sql="$4"
  local before after catalog_before catalog_after dirty_mask status
  before="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
  catalog_before="$(scalar "select framework_canonical_design_catalog(5000)->>'catalogHash'")"
  db -qAtc "$sql" >/dev/null
  dirty_mask="$(scalar "select coalesce(bit_or(change_mask),0) from framework_design_change_signal where signal_status='DIRTY'")"
  if [[ "$expected_signal" == 1 ]]; then
    (( (dirty_mask & 1) == 1 )) || {
      echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label missed mask-1 signal" >&2; exit 1;
    }
  else
    [[ "$dirty_mask" == 0 ]] || {
      echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label emitted a false signal" >&2; exit 1;
    }
    db -qAtc "select framework_mark_design_causality_dirty(1)" >/dev/null
  fi
  status="$(compile_current_design)"
  after="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
  catalog_after="$(scalar "select framework_canonical_design_catalog(5000)->>'catalogHash'")"
  PROCESS_BEFORE="$before" PROCESS_AFTER="$after" PROCESS_STATUS="$status" \
  PROCESS_EXPECTED="$expected" PROCESS_LABEL="$label" python3 - <<'PY'
import os
b=os.environ['PROCESS_BEFORE'].split('|'); a=os.environ['PROCESS_AFTER'].split('|')
assert len(b)==len(a)==7, os.environ['PROCESS_LABEL']
if os.environ['PROCESS_EXPECTED']=='COMPILED':
    assert os.environ['PROCESS_STATUS']=='COMPILED', os.environ['PROCESS_LABEL']
    assert a[0]!=b[0] and a[1:6]==b[1:6], os.environ['PROCESS_LABEL']
    assert int(a[6])==int(b[6])+1, os.environ['PROCESS_LABEL']
else:
    assert os.environ['PROCESS_STATUS']=='NO_SEMANTIC_CHANGE', (
        os.environ['PROCESS_LABEL'],os.environ['PROCESS_STATUS'])
    assert a==b, (os.environ['PROCESS_LABEL'],b,a)
PY
  if [[ "$expected" == COMPILED ]]; then
    [[ "$catalog_before" != "$catalog_after" ]] || {
      echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label missed canonical byte change" >&2; exit 1;
    }
  else
    [[ "$catalog_before" == "$catalog_after" ]] || {
      echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label false no-op disagreed with canonical bytes" >&2; exit 1;
    }
  fi
}

# The v2 process hash exactly mirrors framework_try_jsonb(value,'{}'): valid
# formatting is normalized, malformed source keeps its raw text in an array,
# and blank input is semantically the same as an empty object.
run_process_contract_mutant valid_contract_formatting NO_SEMANTIC_CHANGE 0 \
  "update framework_process_step set input_contract=jsonb_build_object('x',1)::text,output_contract=jsonb_build_object('id','uuid')::text where process_code='PROC_A' and step_code='STEP_A'"
run_process_contract_mutant malformed_contract_seed COMPILED 1 \
  "update framework_process_step set input_contract='malformed-input',output_contract='malformed-output' where process_code='PROC_A' and step_code='STEP_A'"
run_process_contract_mutant malformed_contract_outer_space COMPILED 1 \
  "update framework_process_step set input_contract=' malformed-input ',output_contract=' malformed-output ' where process_code='PROC_A' and step_code='STEP_A'"
run_process_contract_mutant malformed_to_valid_string COMPILED 1 \
  "update framework_process_step set input_contract=to_jsonb('malformed-input'::text)::text,output_contract=to_jsonb('malformed-output'::text)::text where process_code='PROC_A' and step_code='STEP_A'"
run_process_contract_mutant blank_contract_seed COMPILED 1 \
  "update framework_process_step set input_contract='   ',output_contract='   ' where process_code='PROC_A' and step_code='STEP_A'"
run_process_contract_mutant blank_to_empty_object NO_SEMANTIC_CHANGE 1 \
  "update framework_process_step set input_contract='{}',output_contract='{}' where process_code='PROC_A' and step_code='STEP_A'"

run_codegen_mutant() {
  local label="$1" expected="$2" sql="$3"
  local before_hash before_revision dirty_mask status after_hash after_revision
  before_hash="$(scalar "select codegen_input_hash from framework_design_causality_head where scope_key='GLOBAL'")"
  before_revision="$(scalar "select revision from framework_design_causality_head where scope_key='GLOBAL'")"
  db -qAtc "$sql" >/dev/null
  dirty_mask="$(scalar "select coalesce(bit_or(change_mask),0) from framework_design_change_signal where signal_status='DIRTY'")"
  (( (dirty_mask & 32) == 32 )) || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label missed bit-32 signal" >&2; exit 1;
  }
  status="$(compile_current_design)"
  after_hash="$(scalar "select codegen_input_hash from framework_design_causality_head where scope_key='GLOBAL'")"
  after_revision="$(scalar "select revision from framework_design_causality_head where scope_key='GLOBAL'")"
  if [[ "$expected" == COMPILED ]]; then
    [[ "$status" == COMPILED && "$before_hash" != "$after_hash" && "$after_revision" -eq $((before_revision+1)) ]] || {
      echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label did not compile exact v2 change" >&2; exit 1;
    }
  else
    [[ "$status" == NO_SEMANTIC_CHANGE && "$before_hash" == "$after_hash" && "$after_revision" == "$before_revision" ]] || {
      echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label produced false semantic change" >&2; exit 1;
    }
  fi
}

# generation_status is bookkeeping only. Approval/design/contracts remain
# authoritative inputs, but READY -> GENERATED creates neither signal nor hash.
generation_head="$(scalar "select revision||'|'||codegen_input_hash from framework_design_causality_head where scope_key='GLOBAL'")"
db -qAtc "update framework_step_execution_spec set generation_status='GENERATED',updated_at=clock_timestamp() where process_code='PROC_A' and step_code='STEP_A'" >/dev/null
[[ "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")" == 0 &&
   "$generation_head" == "$(scalar "select revision||'|'||codegen_input_hash from framework_design_causality_head where scope_key='GLOBAL'")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL generation_status self-invalidated v2 root' >&2; exit 1;
}

run_codegen_mutant step_contract COMPILED \
  "update framework_step_execution_spec set guide_contract=jsonb_build_object('title','Changed') where process_code='PROC_A' and step_code='STEP_A'"
run_codegen_mutant generated_blueprint_id COMPILED \
  "update framework_screen_blueprint set blueprint_id=blueprint_id+100 where blueprint_code='BP_A'"
run_codegen_mutant generated_contract_id COMPILED \
  "update framework_professional_screen_contract set contract_id=contract_id+100 where process_code='PROC_A' and step_code='STEP_A'"
run_codegen_mutant generated_kpi COMPILED \
  "update framework_professional_screen_contract set kpi_contract=json_build_array('changed')::text where process_code='PROC_A' and step_code='STEP_A'"
run_codegen_mutant ownership_manual COMPILED \
  "update framework_screen_blueprint set implementation_strategy='GENERATE_NEW' where blueprint_code='BP_A'"
run_codegen_mutant manual_kpi NO_SEMANTIC_CHANGE \
  "update framework_professional_screen_contract set kpi_contract=json_build_array('manual-only')::text where process_code='PROC_A' and step_code='STEP_A'"
run_codegen_mutant manual_contract_id NO_SEMANTIC_CHANGE \
  "update framework_professional_screen_contract set contract_id=contract_id+100 where process_code='PROC_A' and step_code='STEP_A'"
run_codegen_mutant manual_blueprint_id NO_SEMANTIC_CHANGE \
  "update framework_screen_blueprint set blueprint_id=blueprint_id+100 where blueprint_code='BP_A'"
run_codegen_mutant ownership_hybrid COMPILED \
  "update framework_screen_blueprint set implementation_strategy='ADOPT_EXISTING' where blueprint_code='BP_A'"
run_codegen_mutant hybrid_kpi COMPILED \
  "update framework_professional_screen_contract set kpi_contract=json_build_array('hybrid-change')::text where process_code='PROC_A' and step_code='STEP_A'"

# Catalog-excluded GENERATED input remains closed by incrementalEmitted.
run_codegen_mutant no_contract_generated COMPILED \
  "insert into framework_screen_blueprint(blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,route_path,screen_type,template_code,specification_json,traceability_json,validation_status,created_by,implementation_strategy) values('BP_B','PROC_A','STEP_B','ACTOR_A','ADMIN','page-b','Page B','/b','FORM','KRDS_TASK','{}','{}','VALID','TEST','GENERATED_RUNTIME')"
run_codegen_mutant no_contract_page_id COMPILED \
  "update framework_screen_blueprint set page_id='page-b-v2' where blueprint_code='BP_B'"

run_codegen_mutant invalid_page_slug COMPILED \
  "update framework_screen_blueprint set page_id='---' where blueprint_code='BP_B'"
[[ "$(scalar "select (framework_design_causality_codegen_readiness()->'reasons') ? 'DESIGN_PAGE_ID_INVALID'")" == t ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL invalid page slug was not BLOCKED' >&2; exit 1;
}
run_codegen_mutant repair_page_slug COMPILED \
  "update framework_screen_blueprint set page_id='page-b-v2' where blueprint_code='BP_B'"
run_codegen_mutant duplicate_page_slug COMPILED \
  "update framework_screen_blueprint set page_id='PAGE-A' where blueprint_code='BP_B'"
[[ "$(scalar "select (framework_design_causality_codegen_readiness()->'reasons') ? 'DESIGN_PAGE_ID_DUPLICATE'")" == t ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL duplicate normalized page slug was not BLOCKED' >&2; exit 1;
}
run_codegen_mutant repair_duplicate_page_slug COMPILED \
  "update framework_screen_blueprint set page_id='page-b-v2' where blueprint_code='BP_B'"
bp_a_id="$(scalar "select blueprint_id from framework_screen_blueprint where blueprint_code='BP_A'")"
run_codegen_mutant zero_blueprint_id COMPILED \
  "update framework_screen_blueprint set blueprint_id=0 where blueprint_code='BP_A'"
[[ "$(scalar "select (framework_design_causality_codegen_readiness()->'reasons') ? 'INCREMENTAL_EMITTED_INVALID'")" == t ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL zero blueprint id was not BLOCKED' >&2; exit 1;
}
run_codegen_mutant restore_positive_blueprint_id COMPILED \
  "update framework_screen_blueprint set blueprint_id=$bp_a_id where blueprint_code='BP_A'"
run_codegen_mutant hybrid_raw_spec_seed COMPILED \
  "update framework_screen_blueprint set specification_json=json_build_object('x',1)::text where blueprint_code='BP_A'"
run_codegen_mutant hybrid_raw_spec_spacing COMPILED \
  "update framework_screen_blueprint set specification_json='{ \"x\" : 1 }' where blueprint_code='BP_A'"

# Whitespace required text exactly mirrors Python .strip() and blocks work.
run_codegen_mutant invalid_generated_page_name COMPILED \
  "update framework_screen_blueprint set page_name='   ' where blueprint_code='BP_B'"
invalid_head="$(scalar "select revision||'|'||canonical_hash||'|'||current_event_id from framework_design_causality_head where scope_key='GLOBAL'")"
set +e
invalid_output="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=2 DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 run_design_causality_post_commit_compiler PRE_WORK 2>/dev/null)"
invalid_rc=$?
set -e
[[ "$invalid_rc" -eq 0 && -n "$invalid_output" && "$invalid_head" == "$(scalar "select revision||'|'||canonical_hash||'|'||current_event_id from framework_design_causality_head where scope_key='GLOBAL'")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL invalid incremental telemetry did not preserve remediation path' >&2; exit 1;
}
INVALID_OUTPUT="$invalid_output" python3 - <<'PY'
import json, os
d=json.loads(os.environ['INVALID_OUTPUT'])
assert d['result']=='NO_WORK' and d['codegenReadiness']=='BLOCKED'
assert 'INCREMENTAL_EMITTED_INVALID' in d['codegenReadinessReasons']
PY
run_codegen_mutant repair_generated_page_name COMPILED \
  "update framework_screen_blueprint set page_name='Page B repaired' where blueprint_code='BP_B'"
run_codegen_mutant ownership_manual_second COMPILED \
  "update framework_screen_blueprint set implementation_strategy='GENERATE_NEW' where blueprint_code='BP_B'"
run_codegen_mutant manual_spec_seed COMPILED \
  "update framework_screen_blueprint set specification_json=json_build_object('manual',1)::text where blueprint_code='BP_B'"
run_codegen_mutant manual_spec_spacing NO_SEMANTIC_CHANGE \
  "update framework_screen_blueprint set specification_json='{ \"manual\" : 1 }' where blueprint_code='BP_B'"
[[ "$(scalar "select (framework_design_causality_codegen_readiness()#>>'{ownership,hybrid}')||'|'||(framework_design_causality_codegen_readiness()#>>'{ownership,manual}')")" == '1|1' ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL MANUAL/HYBRID ownership counts drifted' >&2; exit 1;
}

run_permission_mutant() {
  local label="$1" expected_mask="$2" expected_codegen="$3" expected_grant="$4" sql="$5"
  local before after status dirty_mask
  before="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
  db -qAtc "$sql" >/dev/null
  dirty_mask="$(scalar "select coalesce(bit_or(change_mask),0) from framework_design_change_signal where signal_status='DIRTY'")"
  (( (dirty_mask & expected_mask) == expected_mask )) || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label missed mask $expected_mask" >&2; exit 1;
  }
  status="$(compile_current_design)"
  after="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
  BEFORE_COMPONENTS="$before" AFTER_COMPONENTS="$after" EXPECTED_CODEGEN="$expected_codegen" EXPECTED_GRANT="$expected_grant" LABEL="$label" python3 - <<'PY'
import os
b=os.environ['BEFORE_COMPONENTS'].split('|'); a=os.environ['AFTER_COMPONENTS'].split('|')
assert len(b)==len(a)==7 and int(a[6])==int(b[6])+1, os.environ['LABEL']
assert a[:3]==b[:3], os.environ['LABEL']
assert a[3]!=b[3], os.environ['LABEL']
assert (a[4]!=b[4]) == (os.environ['EXPECTED_GRANT']=='CHANGED'), os.environ['LABEL']
assert (a[5]!=b[5]) == (os.environ['EXPECTED_CODEGEN']=='CHANGED'), os.environ['LABEL']
PY
  [[ "$status" == COMPILED ]] || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label did not compile" >&2; exit 1;
  }
}

# Permission requirement v2 is a narrow leaf summary. Each authority changes
# only its dependent component; professional security is shared with codegen.
run_permission_mutant normalized_requirement 8 STABLE STABLE \
  "insert into framework_permission_requirement_v1(process_code,step_code,permission_code,scope_type,resource_contract,guard_contract) values('PROC_A','STEP_A','PERM_A','PROJECT','{}','{}')"
run_permission_mutant normalized_requirement_pk 8 STABLE STABLE \
  "update framework_permission_requirement_v1 set permission_code='PERM_B' where process_code='PROC_A' and step_code='STEP_A' and permission_code='PERM_A' and scope_type='PROJECT'"
run_permission_mutant menu_feature 8 STABLE STABLE \
  "update comtnmenufunctioninfo set feature_dc='Changed permission description' where feature_code='PERM_A'"
run_permission_mutant page_field_permission 8 STABLE STABLE \
  "update framework_page_field_definition set permission_code='PERM_B' where field_code='value'"
run_permission_mutant professional_security 40 CHANGED STABLE \
  "update framework_professional_screen_contract set security_contract='{\"authority\":\"PERM_B\"}' where process_code='PROC_A' and step_code='STEP_A'"
run_permission_mutant mapping_control 24 STABLE CHANGED \
  "update framework_permission_mapping_control_v1 set requirement_mapping_complete=true,grant_mapping_complete=true,mapping_note='normalized fixture complete' where control_id=1"

run_narrow_component_mutant() {
  local label="$1" expected_mask="$2" changed_index="$3" sql="$4"
  local before after status dirty_mask
  before="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
  db -qAtc "$sql" >/dev/null
  dirty_mask="$(scalar "select coalesce(bit_or(change_mask),0) from framework_design_change_signal where signal_status='DIRTY'")"
  (( (dirty_mask & expected_mask) == expected_mask )) || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label missed mask $expected_mask" >&2; exit 1;
  }
  status="$(compile_current_design)"
  after="$(scalar "select process_hash||'|'||actor_hash||'|'||account_assignment_hash||'|'||permission_requirement_hash||'|'||permission_grant_hash||'|'||codegen_input_hash||'|'||revision from framework_design_causality_head where scope_key='GLOBAL'")"
  BEFORE_COMPONENTS="$before" AFTER_COMPONENTS="$after" CHANGED_INDEX="$changed_index" LABEL="$label" python3 - <<'PY'
import os
b=os.environ['BEFORE_COMPONENTS'].split('|'); a=os.environ['AFTER_COMPONENTS'].split('|')
changed=int(os.environ['CHANGED_INDEX'])
assert len(b)==len(a)==7 and int(a[6])==int(b[6])+1, os.environ['LABEL']
for index in range(6):
    assert (a[index]!=b[index]) == (index==changed), (os.environ['LABEL'],index)
PY
  [[ "$status" == COMPILED ]] || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL $label did not compile" >&2; exit 1;
  }
}

# The four legacy full-root lanes are count-bound leaf summaries. Selective
# recomputation changes exactly one immutable component hash per source mask.
run_narrow_component_mutant process_leaf_summary 1 0 \
  "update framework_process_definition set goal='V2 narrow process goal' where process_code='PROC_A'"
run_narrow_component_mutant actor_leaf_summary 2 1 \
  "update framework_actor_definition set purpose='V2 narrow actor purpose' where actor_code='ACTOR_A'"
run_narrow_component_mutant account_leaf_summary 4 2 \
  "update framework_account_actor_assignment set data_scope='private-scope-v2' where actor_code='ACTOR_A'"
run_narrow_component_mutant grant_leaf_summary 16 4 \
  "insert into framework_permission_grant_v1(actor_code,permission_code,scope_type,effect) values('ACTOR_A','PERM_B','PROJECT','ALLOW')"

# Surrogate page-field key churn refreshes OLD+NEW cache keys but is a semantic
# NOOP because v1 field-binding bytes deliberately exclude page_field_id.
field_id_before="$(scalar "select page_field_id from framework_page_field_definition where field_code='value'")"
field_head_before="$(scalar "select revision||'|'||permission_requirement_hash from framework_design_causality_head where scope_key='GLOBAL'")"
db -qAtc "update framework_page_field_definition set page_field_id=page_field_id+1000 where page_field_id=$field_id_before" >/dev/null
[[ "$(scalar "select count(*) from framework_design_permission_field_leaf_cache where page_field_id=$field_id_before")" == 0 &&
   "$(scalar "select count(*) from framework_design_permission_field_leaf_cache where page_field_id=$((field_id_before+1000))")" == 1 &&
   "$(compile_current_design)" == NO_SEMANTIC_CHANGE &&
   "$field_head_before" == "$(scalar "select revision||'|'||permission_requirement_hash from framework_design_causality_head where scope_key='GLOBAL'")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL page-field OLD/NEW cache key contract drifted' >&2; exit 1;
}

permission_cache_before="$(scalar "select framework_design_causality_sha256(jsonb_build_object('r',(select jsonb_agg(to_jsonb(c) order by process_code,step_code,permission_code,scope_type) from framework_design_permission_requirement_leaf_cache c),'f',(select jsonb_agg(to_jsonb(c) order by feature_code) from framework_design_permission_feature_leaf_cache c),'p',(select jsonb_agg(to_jsonb(c) order by page_field_id) from framework_design_permission_field_leaf_cache c)))")"
permission_dirty_before="$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")"
db >/dev/null <<'SQL'
BEGIN;
UPDATE comtnmenufunctioninfo SET feature_nm='rollback mutation' WHERE feature_code='PERM_A';
UPDATE framework_page_field_definition SET privacy_class='SECRET' WHERE field_code='value';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM framework_design_change_signal
   WHERE source_txid=txid_current() AND signal_status='DIRTY' AND (change_mask&8)=8)
 THEN RAISE EXCEPTION 'permission rollback signal missing'; END IF;
END $$;
ROLLBACK;
SQL
[[ "$permission_cache_before" == "$(scalar "select framework_design_causality_sha256(jsonb_build_object('r',(select jsonb_agg(to_jsonb(c) order by process_code,step_code,permission_code,scope_type) from framework_design_permission_requirement_leaf_cache c),'f',(select jsonb_agg(to_jsonb(c) order by feature_code) from framework_design_permission_feature_leaf_cache c),'p',(select jsonb_agg(to_jsonb(c) order by page_field_id) from framework_design_permission_field_leaf_cache c)))")" &&
   "$permission_dirty_before" == "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL permission cache rollback leaked' >&2; exit 1;
}

# Orphan ACTIVE scopes are authoritative even without process/source rows.
db -qAtc "insert into framework_canonical_endpoint_upgrade_activation_event(scope_process,action) values('ORPHAN_ACTIVE','ACTIVATE')" >/dev/null
active_head="$(scalar "select revision||'|'||canonical_hash||'|'||current_event_id from framework_design_causality_head where scope_key='GLOBAL'")"
set +e
active_output="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=2 DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 run_design_causality_post_commit_compiler PRE_WORK 2>/dev/null)"
active_rc=$?
set -e
[[ "$active_rc" -eq 0 && -n "$active_output" && "$active_head" == "$(scalar "select revision||'|'||canonical_hash||'|'||current_event_id from framework_design_causality_head where scope_key='GLOBAL'")" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL orphan ACTIVE telemetry blocked remediation' >&2; exit 1;
}
ACTIVE_OUTPUT="$active_output" python3 - <<'PY'
import json, os
d=json.loads(os.environ['ACTIVE_OUTPUT'])
assert d['result']=='NO_WORK' and d['codegenReadiness']=='BLOCKED'
assert d['activeBindingCount']==1
assert 'ACTIVE_RELEASE_BINDING_SOURCE_ONLY' in d['codegenReadinessReasons']
PY
db -qAtc "delete from framework_canonical_endpoint_upgrade_activation_event where scope_process='ORPHAN_ACTIVE'" >/dev/null
source_ready="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=2 DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 run_design_causality_post_commit_compiler PRE_WORK)"
SOURCE_READY="$source_ready" python3 - <<'PY'
import json, os
d=json.loads(os.environ['SOURCE_READY'])
assert d['result']=='NO_WORK' and d['codegenReadiness']=='BLOCKED'
assert d['canonicalSchemaVersion']==2 and d['activeBindingCount']==0
assert 'ACTIVE_RELEASE_BINDING_SOURCE_ONLY' not in d['codegenReadinessReasons']
PY

# Bit 32 joins 1|2|8 in the source-required mask (43). Runtime-only is rejected,
# then a later v2 head makes the prior stage CAS deterministically stale.
run_codegen_mutant source_required_classification_event COMPILED \
  "update framework_step_execution_spec set source_hash=repeat('c',64) where process_code='PROC_A' and step_code='STEP_A'"
v2_event="$(scalar "select current_event_id from framework_design_causality_head where scope_key='GLOBAL'")"
db >/dev/null <<SQL
DO \$\$
BEGIN
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $v2_event,'CANONICAL_COMPILED',0,'CHANGE_CLASSIFIED','m11-pg-mutant',
   jsonb_build_object('classification','RUNTIME_ONLY','evidenceRef','db://m11/classification',
    'runtimeOwnership','DATABASE_PER_REQUEST_V1','runtimeOwnershipEvidenceRef','db://m11/runtime-owner',
    'runtimeOwnershipHash',repeat('a',64)));
  RAISE EXCEPTION 'bit32 runtime-only classification accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END \$\$;
SELECT framework_cas_design_causality_stage(
 $v2_event,'CANONICAL_COMPILED',0,'CHANGE_CLASSIFIED','m11-pg-mutant',
 '{"classification":"SOURCE_REQUIRED","evidenceRef":"db://m11/source-required"}'::jsonb
);
SQL
run_codegen_mutant stale_head_source COMPILED \
  "update framework_step_execution_spec set source_hash=repeat('b',64) where process_code='PROC_A' and step_code='STEP_A'"
db >/dev/null <<SQL
DO \$\$
BEGIN
 BEGIN
  PERFORM framework_cas_design_causality_stage(
   $v2_event,'CHANGE_CLASSIFIED',1,'SOURCE_GENERATED','m11-stale',
   jsonb_build_object('sourceCommit',repeat('a',40),'treeHash',repeat('b',64),
                      'evidenceRef','db://m11/stale-source'));
  RAISE EXCEPTION 'stale v2 stage CAS accepted';
 EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
END \$\$;
SQL

db >/dev/null <<'SQL'
DO $$
DECLARE event_row framework_design_causality_event%ROWTYPE;
BEGIN
 SELECT * INTO STRICT event_row FROM framework_design_causality_event
  WHERE event_id=(SELECT current_event_id FROM framework_design_causality_head WHERE scope_key='GLOBAL');
 IF event_row.canonical_schema_version<>2 OR event_row.event_hash<>
   framework_design_causality_event_hash_v2(
    event_row.revision,event_row.previous_hash,event_row.canonical_hash,
    event_row.process_hash,event_row.actor_hash,event_row.account_assignment_hash,
    event_row.permission_requirement_hash,event_row.permission_grant_hash,
    event_row.codegen_input_hash,event_row.row_counts,event_row.change_mask
   ) THEN RAISE EXCEPTION 'v2 event hash contract mismatch'; END IF;
 IF has_function_privilege('carbonet_design_compiler',
      'framework_design_causality_codegen_input_component()','EXECUTE')
    OR has_table_privilege('carbonet_design_compiler',
      'framework_canonical_endpoint_upgrade_activation_event','SELECT') THEN
   RAISE EXCEPTION 'M1.1 compiler privilege escaped wrapper';
 END IF;
END $$;
SQL

# Live-sized cache acceptance: 1,732 inventories, 2,038 professional rows and
# 572 step specs must keep the DB component below 1s and the actual selective
# permission+codegen compiler below the worker's 2s timeout. The cohort rolls back.
perf_dirty_before="$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")"
db >/dev/null <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO framework_screen_blueprint(
 blueprint_id,blueprint_code,process_code,step_code,actor_code,audience,
 page_id,page_name,route_path,screen_type,template_code,
 specification_json,traceability_json,validation_status,implementation_strategy
)
SELECT 2000000+g,'BP_PERF_'||g,'PROC_A','STEP_A','ACTOR_A',
       CASE WHEN g%2=0 THEN 'ADMIN' ELSE 'USER' END,
       'PERF_PAGE_'||g,'Performance page '||g,'/perf/'||g,'FORM','KRDS_TASK',
       '{}','{}','VALID',
       CASE WHEN g%3=0 THEN 'ADOPT_EXISTING' ELSE 'GENERATED_RUNTIME' END
  FROM generate_series(1,1730) g;
INSERT INTO framework_professional_screen_contract(
 contract_id,process_code,step_code,audience,route_path,contract_status
)
SELECT 3000000+g,'PROC_A','STEP_A',
       CASE WHEN ((g-1)%1730+1)%2=0 THEN 'ADMIN' ELSE 'USER' END,
       '/perf/'||((g-1)%1730+1),'COMPLETE'
  FROM generate_series(1,2037) g;
INSERT INTO framework_step_execution_spec(
 process_code,step_code,spec_version,design_status,approval_status,
 generation_status,blocker_codes,source_hash
)
SELECT 'PROC_PERF_'||g,'STEP_PERF_'||g,1,'DESIGN_COMPLETE','APPROVED',
       'READY','[]'::jsonb,repeat('a',64)
  FROM generate_series(1,571) g;
DO $$
DECLARE started_at timestamptz; elapsed_ms numeric; component jsonb;
        worker_result jsonb; head_revision bigint; head_hash varchar(64);
        full_root_samples numeric[]:='{}'; full_root_p95 numeric;
        full_root_max numeric; sample_index integer;
BEGIN
 IF (SELECT count(*) FROM framework_design_codegen_blueprint_leaf_cache)<>1732
    OR (SELECT count(*) FROM framework_design_codegen_contract_leaf_cache)<>2038
    OR (SELECT count(*) FROM framework_design_codegen_step_leaf_cache)<>572 THEN
   RAISE EXCEPTION 'live-sized source/cache cardinality mismatch';
 END IF;
 started_at:=clock_timestamp();
 component:=framework_design_causality_codegen_input_component();
 elapsed_ms:=extract(epoch FROM clock_timestamp()-started_at)*1000;
 IF elapsed_ms>=1000 THEN
   RAISE EXCEPTION 'codegen component exceeded 1s: %ms',elapsed_ms;
 END IF;
  IF (component#>>'{designInventory,screenCount}')::integer<>1732
    OR (component#>>'{canonicalSource,professionalContractCount}')::integer<>2038
    OR (component#>>'{stepExecution,stepCount}')::integer<>572 THEN
    RAISE EXCEPTION 'live-sized component counts mismatch';
  END IF;
  FOR sample_index IN 1..10 LOOP
    started_at:=clock_timestamp();
    PERFORM framework_design_causality_snapshot();
    full_root_samples:=array_append(full_root_samples,
      extract(epoch FROM clock_timestamp()-started_at)*1000);
  END LOOP;
  SELECT percentile_cont(0.95) WITHIN GROUP(ORDER BY sample),max(sample)
    INTO full_root_p95,full_root_max FROM unnest(full_root_samples) sample;
  IF full_root_p95>=2000 OR full_root_max>=2000 THEN
    RAISE EXCEPTION 'full-root 10x exceeded 2s p95/max: %/%ms',
      full_root_p95,full_root_max;
  END IF;
  RAISE NOTICE 'M1.1 full-root10 p95=%ms max=%ms',full_root_p95,full_root_max;
  SELECT revision,canonical_hash INTO STRICT head_revision,head_hash
    FROM framework_design_causality_head WHERE scope_key='GLOBAL';
  started_at:=clock_timestamp();
  worker_result:=framework_compile_design_changes(
    'm11-live-size-perf',head_revision,head_hash);
  elapsed_ms:=extract(epoch FROM clock_timestamp()-started_at)*1000;
  IF worker_result->>'status'<>'COMPILED' OR elapsed_ms>=2000 THEN
    RAISE EXCEPTION 'selective design compiler failed 2s contract: % / %ms',
      worker_result,elapsed_ms;
  END IF;
END $$;
ROLLBACK;
SQL
[[ "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")" == "$perf_dirty_before" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL perf rollback leaked dirty signal' >&2; exit 1;
}

# All 16 source statement triggers fire under rollback without leaving a signal
# or cache drift. CASCADE proves coalesced cross-component masks are preserved.
truncate_dirty_before="$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")"
cache_digest() {
  scalar "select framework_design_causality_sha256(jsonb_build_object(
   'b',(select jsonb_agg(to_jsonb(c) order by blueprint_id) from framework_design_codegen_blueprint_leaf_cache c),
   'c',(select jsonb_agg(to_jsonb(c) order by contract_id) from framework_design_codegen_contract_leaf_cache c),
   's',(select jsonb_agg(to_jsonb(c) order by process_code,step_code) from framework_design_codegen_step_leaf_cache c),
   'r',(select jsonb_agg(to_jsonb(c) order by process_code,step_code,permission_code,scope_type) from framework_design_permission_requirement_leaf_cache c),
   'f',(select jsonb_agg(to_jsonb(c) order by feature_code) from framework_design_permission_feature_leaf_cache c),
   'p',(select jsonb_agg(to_jsonb(c) order by page_field_id) from framework_design_permission_field_leaf_cache c)))"
}
cache_shape_before="$(cache_digest)"
truncate_specs=(
  framework_process_definition:1 framework_process_step:1
  framework_actor_definition:2 framework_account_actor_assignment:4
  framework_permission_requirement_v1:8 framework_permission_grant_v1:16
  framework_permission_mapping_control_v1:24 framework_page_design:8
  framework_page_field_definition:8 framework_professional_screen_contract:40
  comtnmenufunctioninfo:8 comtnauthorfunctionrelate:16
  comtnuserfeatureoverride:16 comtnemplyrscrtyestbs:16
  framework_screen_blueprint:32 framework_step_execution_spec:32
)
for truncate_spec in "${truncate_specs[@]}"; do
  truncate_table="${truncate_spec%%:*}"
  expected_truncate_mask="${truncate_spec##*:}"
  db >/dev/null <<SQL
BEGIN;
TRUNCATE $truncate_table CASCADE;
DO \$\$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM framework_design_change_signal
   WHERE source_txid=txid_current() AND signal_status='DIRTY'
     AND (change_mask&$expected_truncate_mask)=$expected_truncate_mask)
 THEN RAISE EXCEPTION 'truncate trigger missed $truncate_table'; END IF;
END \$\$;
ROLLBACK;
SQL
  [[ "$(cache_digest)" == "$cache_shape_before" ]] || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL rollback drifted $truncate_table cache" >&2; exit 1;
  }
done
[[ "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")" == "$truncate_dirty_before" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL rollback leaked truncate signal' >&2; exit 1;
}

# Disposable terminal commits prove each TRUNCATE trigger independently.
truncate_commit_dirty_before="$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")"
for truncate_spec in "${truncate_specs[@]}"; do
  truncate_table="${truncate_spec%%:*}"
  expected_truncate_mask="${truncate_spec##*:}"
  db -qAtc "truncate $truncate_table cascade" >/dev/null
  committed_mask="$(scalar "select change_mask from framework_design_change_signal where signal_id=(select max(signal_id) from framework_design_change_signal)")"
  (( (committed_mask & expected_truncate_mask) == expected_truncate_mask )) || {
    echo "DESIGN_CAUSALITY_POSTGRES_FAIL committed truncate missed $truncate_table/$expected_truncate_mask" >&2; exit 1;
  }
done
[[ "$(scalar "select count(*) from framework_design_change_signal where signal_status='DIRTY'")" -eq $((truncate_commit_dirty_before+16)) ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL committed truncate signals missing' >&2; exit 1;
}
[[ "$(scalar "select
  (select count(*) from framework_design_codegen_blueprint_leaf_cache)+
  (select count(*) from framework_design_codegen_contract_leaf_cache)+
  (select count(*) from framework_design_codegen_step_leaf_cache)+
  (select count(*) from framework_design_permission_requirement_leaf_cache)+
  (select count(*) from framework_design_permission_feature_leaf_cache)+
  (select count(*) from framework_design_permission_field_leaf_cache)")" == 0 ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL committed truncate left cache rows' >&2; exit 1;
}

echo "DESIGN_CAUSALITY_POSTGRES_PASS mutants=112 schemaV2=1 codegenInput=6-components legacyComponents=leaf-v2 permissionRequirement=leaf-v2 selectiveReuse=6 rawCsvHashes=2 canonicalJsonContracts=2 generationStatusNoop=1 activeBindingTelemetry=1 sourceMask=43 exactTriggerReadiness=26 truncateCommit=16 truncateRollback=16 cacheRollback=6 cacheTruncate=6 compilerInvocation=pre-post-wired generationEnforcement=false persistentProducerCoverage=dirty-signal-only deploymentWiring=0"
