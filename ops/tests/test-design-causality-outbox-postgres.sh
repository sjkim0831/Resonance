#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815110000__create_design_causality_outbox.sql"
WORKER_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815113000__install_design_causality_compiler_worker_api.sql"
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
 audience varchar(20),route_path varchar(400),actor_code varchar(60),api_contract text,
 security_contract text,authority_verified boolean,contract_status varchar(30),
 permission_codes jsonb default '[]'::jsonb,created_at timestamp default now(),
 updated_at timestamp default now(),updated_by varchar(100),design_version varchar(30),
 contract_revision bigint
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
CREATE OR REPLACE FUNCTION framework_try_jsonb(value text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
BEGIN RETURN value::jsonb; EXCEPTION WHEN OTHERS THEN RETURN '{}'::jsonb; END
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
 'PROC_A','STEP_A','USER','/a','ACTOR_A','{"method":"POST","path":"/api/a"}',
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
# Runtime drift mutant: an owner grant after migration must make readiness fail
# closed until the protected-function ACL is repaired.
db -qAtc "grant execute on function framework_cas_design_causality_stage(bigint,varchar,bigint,varchar,varchar,jsonb) to carbonet_design_compiler" >/dev/null
set +e
forged_acl_output="$(DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS=3 \
  DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 \
  run_design_causality_post_commit_compiler PRE_WORK 2>/dev/null)"
forged_acl_rc=$?
set -e
[[ "$forged_acl_rc" -eq 78 && -z "$forged_acl_output" ]] || {
  echo 'DESIGN_CAUSALITY_POSTGRES_FAIL runtime protected-function grant was accepted' >&2; exit 1;
}
db -qAtc "revoke all on function framework_cas_design_causality_stage(bigint,varchar,bigint,varchar,varchar,jsonb) from carbonet_design_compiler" >/dev/null
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
assert d['currentStage']=='CANONICAL_COMPILED'
PY
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
 IF source_triggers<>14 OR immutable_triggers<>6 THEN
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

echo "DESIGN_CAUSALITY_POSTGRES_PASS mutants=46 compilerInvocation=pre-post-wired abnormalCompilerCalls=0 nextPreRecovery=1 persistentProducerCoverage=dirty-signal-only deploymentWiring=0"
