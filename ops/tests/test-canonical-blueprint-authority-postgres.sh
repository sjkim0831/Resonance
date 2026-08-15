#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if (( $# )); then ROOT="$1"; else ROOT="$(cd "$(dirname "$BASH_SOURCE")/../.." && pwd)"; fi
BASE="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813093000__compile_canonical_screen_design_release.sql"
ENDPOINT="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813113000__compile_canonical_endpoint_contract_catalog.sql"
PROJECTION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814173000__project_professional_screen_preview_bundle.sql"
AUTHORITY="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815121000__resolve_canonical_blueprint_authority.sql"
DB_NAME="canonical_authority_${RANDOM}_$$"
WORK="$(mktemp -d)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
started_ns="$(date +%s%N)"

fail() { printf 'CANONICAL_BLUEPRINT_AUTHORITY_FAIL %s\n' "$*" >&2; exit 1; }
for file in "$BASE" "$ENDPOINT" "$PROJECTION" "$AUTHORITY"; do
  [[ -f "$file" ]] || fail "missing $file"
done

# Start an unprivileged, disposable PostgreSQL 16 cluster.  This keeps the
# authority mutant hermetic and avoids depending on Docker, sudo or a shared DB.
for executable in initdb pg_ctl; do
  [[ -x "$PG_BIN/$executable" ]] || fail "missing $PG_BIN/$executable"
done
mkdir -p "$WORK/socket"
"$PG_BIN/initdb" -D "$WORK/data" -A trust -U postgres --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" \
  -o "-F -p $PORT -k $WORK/socket" -w start >/dev/null
cleanup() {
  set +e
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate -w stop >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM
createdb -h "$WORK/socket" -p "$PORT" -U postgres "$DB_NAME"
db() { psql -h "$WORK/socket" -p "$PORT" -U postgres -X -v ON_ERROR_STOP=1 -d "$DB_NAME" "$@"; }
db_scalar() { psql -h "$WORK/socket" -p "$PORT" -U postgres -X -v ON_ERROR_STOP=1 -Atqc "$1" -d "$DB_NAME"; }

db >/dev/null <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    CREATE ROLE carbonet_app NOLOGIN;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb DEFAULT '[]')
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN coalesce(nullif(btrim(source),'')::jsonb,fallback);
EXCEPTION WHEN others THEN RETURN fallback; END $$;
CREATE TABLE framework_process_definition(
 process_code varchar(80) PRIMARY KEY,process_name varchar(160) NOT NULL,
 domain_code varchar(60) NOT NULL,process_version varchar(20) NOT NULL,
 goal text NOT NULL,start_condition text NOT NULL,completion_condition text NOT NULL,
 development_order integer NOT NULL,owner_actor_code varchar(60),risk_level varchar(20) NOT NULL,
 sla_hours integer NOT NULL,lifecycle_status varchar(30) NOT NULL,
 created_at timestamp default now(),updated_at timestamp default now());
CREATE TABLE framework_process_step(
 process_code varchar(80) NOT NULL,step_code varchar(80) NOT NULL,
 step_order integer NOT NULL,step_name varchar(160) NOT NULL,step_type varchar(30) NOT NULL,
 actor_code varchar(60) NOT NULL,from_state varchar(60) NOT NULL,
 command_code varchar(80) NOT NULL,to_state varchar(60) NOT NULL,
 requirement_text text NOT NULL,completion_rule text NOT NULL,input_contract text NOT NULL,
 output_contract text NOT NULL,evidence_required boolean NOT NULL,evidence_types text NOT NULL,
 segregation_actor_codes text NOT NULL,rollback_command_code varchar(80) NOT NULL,
 decision_rule text NOT NULL,PRIMARY KEY(process_code,step_code));
CREATE TABLE framework_screen_blueprint(
 blueprint_id bigserial PRIMARY KEY,blueprint_code varchar(140) NOT NULL UNIQUE,
 process_code varchar(80) NOT NULL,step_code varchar(80) NOT NULL,
 actor_code varchar(60) NOT NULL,audience varchar(20) NOT NULL,page_id varchar(160) NOT NULL,
 page_name varchar(200) NOT NULL,route_path varchar(300) NOT NULL,
 screen_type varchar(40) NOT NULL,template_code varchar(80) NOT NULL,
 specification_json text NOT NULL,traceability_json text NOT NULL,
 validation_status varchar(20) NOT NULL,validation_message text,
 generated_source_path varchar(500),created_by varchar(100) default 'SYSTEM',
 created_at timestamp default now(),updated_at timestamp default now(),
 implementation_strategy varchar(30) NOT NULL default 'ADOPT_EXISTING',
 source_reference varchar(500),transition_status varchar(30) NOT NULL default 'PLANNED');
CREATE TABLE framework_professional_screen_contract(
 contract_id bigserial PRIMARY KEY,process_code varchar(80) NOT NULL,
 step_code varchar(100) NOT NULL,audience varchar(20) NOT NULL,route_path varchar(400) NOT NULL,
 screen_name varchar(200) NOT NULL,actor_code varchar(60) NOT NULL,
 business_purpose text NOT NULL,entry_condition text NOT NULL,exit_condition text NOT NULL,
 kpi_contract text NOT NULL,section_contract text NOT NULL,field_contract text NOT NULL,
 command_contract text NOT NULL,state_contract text NOT NULL,api_contract text NOT NULL,
 data_contract text NOT NULL,evidence_contract text NOT NULL,responsive_contract text NOT NULL,
 accessibility_contract text NOT NULL,security_contract text NOT NULL,
 api_verified boolean NOT NULL,database_verified boolean NOT NULL,
 authority_verified boolean NOT NULL,responsive_verified boolean NOT NULL,
 accessibility_verified boolean NOT NULL,exception_states_verified boolean NOT NULL,
 audit_evidence_ref text NOT NULL,contract_status varchar(30) NOT NULL,
 updated_by varchar(100) default 'SYSTEM',created_at timestamp default now(),
 updated_at timestamp default now());
INSERT INTO framework_process_definition VALUES
('PROC_A','Process A','TEST','1','Goal','Start','Done',1,'ACTOR_A','LOW',1,'ACTIVE',now(),now()),
('PROC_B','Process B','TEST','1','Goal','Start','Done',2,'ACTOR_B','LOW',1,'ACTIVE',now(),now());
INSERT INTO framework_process_step VALUES
('PROC_A','STEP_A',1,'Step A','TASK','ACTOR_A','READY','SUBMIT_A','DONE',
 'Submit','Done','{}','{}',true,'AUDIT','REVIEWER','ROLLBACK','Valid'),
('PROC_B','STEP_B',1,'Step B','TASK','ACTOR_B','READY','SUBMIT_B','DONE',
 'Submit','Done','{}','{}',true,'AUDIT','REVIEWER','ROLLBACK','Valid');

CREATE FUNCTION test_endpoint_api(
 i integer,process_code text,step_code text,actor_code text,command_code text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_array(jsonb_build_object(
   'operationId','SubmitEndpoint'||lpad(i::text,4,'0'),
   'implementationKind','PROCESS_COMMAND_ADAPTER','method','POST',
   'path','/api/generated/endpoint/'||i||'/{executionId}/submit',
   'processCode',process_code,'stepCode',step_code,'commandCode',command_code,
   'authority',jsonb_build_object(
     'audience','USER','actorCodes',jsonb_build_array(actor_code),
     'authenticated',true,'tenantScoped',true,'projectScoped',true),
   'request',jsonb_build_object(
     'contentType','application/json','schema',jsonb_build_object(
       'type','object','properties',jsonb_build_object(
         'tenantId',jsonb_build_object('type','string'),
         'projectId',jsonb_build_object('type','string'),
         'actorCode',jsonb_build_object('type','string'),
         'idempotencyKey',jsonb_build_object('type','string'),
         'amount',jsonb_build_object('type','number')),
       'required',jsonb_build_array(
         'tenantId','projectId','actorCode','idempotencyKey','amount'))),
   'response',jsonb_build_object(
     'successStatus',200,'schema',jsonb_build_object(
       'type','object','properties',jsonb_build_object(
         'success',jsonb_build_object('type','boolean'),
         'idempotent',jsonb_build_object('type','boolean'),
         'eventId',jsonb_build_object('type','integer'),
         'toState',jsonb_build_object('type','string')),
       'required',jsonb_build_array('success','idempotent','eventId','toState')),
     'errors',jsonb_build_array(
       jsonb_build_object('status',400,'code','INVALID_REQUEST'),
       jsonb_build_object('status',401,'code','AUTHENTICATION_REQUIRED'),
       jsonb_build_object('status',403,'code','ACCESS_DENIED'),
       jsonb_build_object('status',500,'code','INTERNAL_ERROR'))),
   'persistenceRef','PROCESS_EXECUTION_AGGREGATE',
   'transactionPolicy','REQUIRED','idempotencyRequired',true,
   'rollback',jsonb_build_object('strategy','TRANSACTION','commandCode',command_code)
 ))::text
$$;
CREATE FUNCTION test_endpoint_database()
RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_array(jsonb_build_object(
   'persistenceId','PROCESS_EXECUTION_AGGREGATE',
   'entity','framework_process_execution','operation','UPDATE',
   'primaryKey',jsonb_build_array('execution_id'),
   'tenantColumn','tenant_id','projectColumn','project_id',
   'versionColumn','execution_version','transactional',true
 ))::text
$$;
CREATE FUNCTION test_add_screens(first_i integer,last_i integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 WITH source AS (
   SELECT i,CASE WHEN i<=1000 THEN 'PROC_A' ELSE 'PROC_B' END process_code,
          CASE WHEN i<=1000 THEN 'STEP_A' ELSE 'STEP_B' END step_code,
          CASE WHEN i<=1000 THEN 'ACTOR_A' ELSE 'ACTOR_B' END actor_code,
          CASE WHEN i<=1000 THEN 'SUBMIT_A' ELSE 'SUBMIT_B' END command_code
     FROM generate_series(first_i,last_i) i
 )
 INSERT INTO framework_screen_blueprint(
   blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
   route_path,screen_type,template_code,specification_json,traceability_json,
   validation_status,generated_source_path)
 SELECT 'SCREEN_'||lpad(i::text,4,'0'),process_code,step_code,actor_code,'USER',
        'page-'||lpad(i::text,4,'0'),'Page '||i,'/screen/'||i,
        'FORM','KRDS_FORM','{}','{"requirements":["REQ"]}','VALID','volatile'
   FROM source;
 WITH source AS (
   SELECT i,CASE WHEN i<=1000 THEN 'PROC_A' ELSE 'PROC_B' END process_code,
          CASE WHEN i<=1000 THEN 'STEP_A' ELSE 'STEP_B' END step_code,
          CASE WHEN i<=1000 THEN 'ACTOR_A' ELSE 'ACTOR_B' END actor_code,
          CASE WHEN i<=1000 THEN 'SUBMIT_A' ELSE 'SUBMIT_B' END command_code
     FROM generate_series(first_i,last_i) i
 )
 INSERT INTO framework_professional_screen_contract(
   process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
   entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
   command_contract,state_contract,api_contract,data_contract,evidence_contract,
   responsive_contract,accessibility_contract,security_contract,api_verified,
   database_verified,authority_verified,responsive_verified,accessibility_verified,
   exception_states_verified,audit_evidence_ref,contract_status)
 SELECT process_code,step_code,'USER','/screen/'||i,'Screen '||i,actor_code,
   'Purpose','READY','DONE','["completion"]','[{"title":"Main"}]',
   '[{"name":"amount"}]',jsonb_build_array(command_code)::text,
   '["READY","DONE"]',test_endpoint_api(i,process_code,step_code,actor_code,command_code),
   test_endpoint_database(),'["AUDIT"]','responsive','accessible','secure',
   true,true,true,true,true,true,'evidence://endpoint','VERIFIED'
  FROM source;
END
$$;
GRANT SELECT ON framework_process_definition,framework_process_step,
 framework_screen_blueprint,framework_professional_screen_contract TO carbonet_app;
SQL

db -f "$BASE" >/dev/null
db -f "$ENDPOINT" >/dev/null

# Model the existing V20260813150000 SOURCE indirection without installing its
# unrelated upgrade tables in this focused fixture.
db >/dev/null <<'SQL'
ALTER FUNCTION public.framework_canonical_design_catalog(integer,varchar)
  RENAME TO framework_source_canonical_design_catalog;
ALTER FUNCTION public.framework_canonical_endpoint_readiness(integer,varchar)
  RENAME TO framework_source_canonical_endpoint_readiness;
ALTER FUNCTION public.framework_canonical_endpoint_catalog(integer,varchar)
  RENAME TO framework_source_canonical_endpoint_catalog;
CREATE FUNCTION public.framework_canonical_design_catalog(integer,varchar)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
AS 'SELECT public.framework_source_canonical_design_catalog($1,$2)';
CREATE FUNCTION public.framework_canonical_endpoint_readiness(integer,varchar)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
AS 'SELECT public.framework_source_canonical_endpoint_readiness($1,$2)';
CREATE FUNCTION public.framework_canonical_endpoint_catalog(integer,varchar)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
AS 'SELECT public.framework_source_canonical_endpoint_catalog($1,$2)';
SQL
db -f "$PROJECTION" >/dev/null
db -f "$AUTHORITY" >/dev/null

# 1 row and duplicate explicit-link mutants: exactly one wins; zero or two
# fail before an endpoint catalog can be returned.
db >/dev/null <<'SQL'
SELECT test_add_screens(1,1);
DO $$
DECLARE contract bigint;
DECLARE original bigint;
DECLARE selected bigint;
DECLARE catalog jsonb;
BEGIN
 SELECT contract_id INTO contract FROM framework_professional_screen_contract;
 SELECT blueprint_id INTO original FROM framework_screen_blueprint;
 selected:=framework_canonical_blueprint_authority(
   'PROC_A','STEP_A','USER','/screen/1',contract);
 IF selected<>original THEN RAISE EXCEPTION 'single authority mismatch'; END IF;
 catalog:=framework_canonical_design_catalog(10,'PROC_A');
 IF catalog->>'screenCount'<>'1' THEN RAISE EXCEPTION 'single catalog mismatch'; END IF;
END
$$;

INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,generated_source_path,source_reference,transition_status)
SELECT 'SCREEN_LINKED_0001',b.process_code,b.step_code,b.actor_code,b.audience,
       'linked-'||b.page_id,b.page_name,b.route_path||'?variant=linked',b.screen_type,
       b.template_code,b.specification_json,b.traceability_json,b.validation_status,
       b.generated_source_path,'PROFESSIONAL_SCREEN_CONTRACT:'||c.contract_id,
       'CONTRACT_LINKED'
  FROM framework_screen_blueprint b
  CROSS JOIN framework_professional_screen_contract c
 WHERE b.blueprint_code='SCREEN_0001';

DO $$
DECLARE contract bigint;
DECLARE linked bigint;
DECLARE selected bigint;
DECLARE design jsonb;
DECLARE readiness jsonb;
BEGIN
 SELECT contract_id INTO contract FROM framework_professional_screen_contract;
 SELECT blueprint_id INTO linked FROM framework_screen_blueprint
  WHERE blueprint_code='SCREEN_LINKED_0001';
 selected:=framework_canonical_blueprint_authority(
   'PROC_A','STEP_A','USER','/screen/1',contract);
 IF selected<>linked THEN RAISE EXCEPTION 'explicit-one authority mismatch'; END IF;
 design:=framework_canonical_design_catalog(10,'PROC_A');
 readiness:=framework_canonical_endpoint_readiness(10,'PROC_A');
 IF design->>'screenCount'<>'1'
    OR design#>>'{screens,0,canonicalDesign,identity,blueprintCode}'<>'SCREEN_LINKED_0001'
    OR readiness->>'status'<>'COMPLETE'
    OR readiness->>'sourceDesignCount'<>'1'
 THEN RAISE EXCEPTION 'explicit-one compile mismatch: % %',design,readiness; END IF;
END
$$;

UPDATE framework_screen_blueprint SET transition_status='PLANNED'
 WHERE blueprint_code='SCREEN_LINKED_0001';
DO $$
DECLARE denied_authority boolean:=false;
DECLARE denied_design boolean:=false;
DECLARE denied_endpoint boolean:=false;
DECLARE contract bigint;
DECLARE readiness jsonb;
BEGIN
 SELECT contract_id INTO contract FROM framework_professional_screen_contract;
 BEGIN PERFORM framework_canonical_blueprint_authority(
   'PROC_A','STEP_A','USER','/screen/1',contract);
 EXCEPTION WHEN SQLSTATE 'P0003' THEN denied_authority:=true; END;
 BEGIN PERFORM framework_canonical_design_catalog(10,'PROC_A');
 EXCEPTION WHEN SQLSTATE 'P0003' THEN denied_design:=true; END;
 readiness:=framework_canonical_endpoint_readiness(10,'PROC_A');
 BEGIN PERFORM framework_canonical_endpoint_catalog(10,'PROC_A');
 EXCEPTION WHEN SQLSTATE 'P0002' THEN denied_endpoint:=true; END;
 IF NOT denied_authority OR NOT denied_design OR NOT denied_endpoint
    OR readiness->>'status'<>'PARTIAL'
    OR readiness->>'sourceDesignCount'<>'1'
    OR readiness->>'canonicalScreenCount'<>'0'
    OR readiness#>>'{reasonCounts,DESIGN_BLUEPRINT_DUPLICATE}'<>'1'
 THEN RAISE EXCEPTION 'explicit-zero escaped publish gate: %',readiness; END IF;
END
$$;

UPDATE framework_screen_blueprint SET transition_status='CONTRACT_LINKED'
 WHERE blueprint_code='SCREEN_LINKED_0001';
UPDATE framework_screen_blueprint b
   SET transition_status='CONTRACT_LINKED',
       source_reference='framework_professional_screen_contract:'||c.contract_id
  FROM framework_professional_screen_contract c
 WHERE b.blueprint_code='SCREEN_0001';
DO $$
DECLARE denied_authority boolean:=false;
DECLARE denied_design boolean:=false;
DECLARE contract bigint;
BEGIN
 SELECT contract_id INTO contract FROM framework_professional_screen_contract;
 BEGIN PERFORM framework_canonical_blueprint_authority(
   'PROC_A','STEP_A','USER','/screen/1',contract);
 EXCEPTION WHEN SQLSTATE 'P0003' THEN denied_authority:=true; END;
 BEGIN PERFORM framework_canonical_design_catalog(10,'PROC_A');
 EXCEPTION WHEN SQLSTATE 'P0003' THEN denied_design:=true; END;
 IF NOT denied_authority OR NOT denied_design THEN
   RAISE EXCEPTION 'explicit-two escaped publish gate';
 END IF;
END
$$;
SQL

# Live-equivalent eligible population: 1,430 physical rows, 1,396 normalized
# screens, 34 duplicate groups, and exactly one explicit authority in each.
db >/dev/null <<'SQL'
TRUNCATE framework_screen_blueprint,framework_professional_screen_contract
  RESTART IDENTITY;
SELECT test_add_screens(1,1396);
INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,generated_source_path,source_reference,transition_status)
SELECT 'SCREEN_LINKED_'||lpad(i::text,4,'0'),b.process_code,b.step_code,
       b.actor_code,b.audience,'linked-'||b.page_id,b.page_name,
       b.route_path||'?variant=linked',b.screen_type,b.template_code,
       b.specification_json,b.traceability_json,b.validation_status,
       b.generated_source_path,'PROFESSIONAL_SCREEN_CONTRACT:'||c.contract_id,
       'CONTRACT_LINKED'
  FROM generate_series(1,34) i
  JOIN framework_screen_blueprint b
    ON b.blueprint_code='SCREEN_'||lpad(i::text,4,'0')
  JOIN framework_professional_screen_contract c
    ON c.route_path='/screen/'||i;

DO $$
DECLARE global_catalog jsonb:=framework_canonical_design_catalog(5000);
DECLARE process_a jsonb:=framework_canonical_design_catalog(5000,'PROC_A');
DECLARE process_b jsonb:=framework_canonical_design_catalog(5000,'PROC_B');
DECLARE readiness jsonb:=framework_canonical_endpoint_readiness(5000,NULL::varchar);
DECLARE manual_a_hash text;
BEGIN
 SELECT encode(sha256(convert_to(string_agg(
          (screen->>'screenKey')||E'\\x1f'||(screen->>'designHash'),E'\\n'
          ORDER BY ordinal
        ),'UTF8')),'hex')
   INTO manual_a_hash
   FROM jsonb_array_elements(global_catalog->'screens')
        WITH ORDINALITY source(screen,ordinal)
  WHERE screen->>'processCode'='PROC_A';
 IF global_catalog->>'screenCount'<>'1396'
    OR jsonb_array_length(global_catalog->'screens')<>1396
    OR (SELECT count(DISTINCT screen->>'screenKey')
          FROM jsonb_array_elements(global_catalog->'screens') source(screen))<>1396
    OR process_a->>'screenCount'<>'1000'
    OR process_b->>'screenCount'<>'396'
    OR process_a->>'catalogHash'<>manual_a_hash
    OR readiness->>'status'<>'COMPLETE'
    OR readiness->>'sourceDesignCount'<>'1396'
    OR readiness->>'canonicalScreenCount'<>'1396'
    OR readiness->>'sourceReadyCount'<>'1396'
    OR readiness->>'blockerCount'<>'0'
 THEN
   RAISE EXCEPTION 'live-equivalent authority mismatch: global=% a=% b=% ready=%',
     global_catalog->>'screenCount',process_a,process_b,readiness;
 END IF;
 IF global_catalog->>'catalogHash'<>
    (framework_canonical_design_catalog(5000)->>'catalogHash') THEN
   RAISE EXCEPTION 'authority catalog hash is not deterministic';
 END IF;
END
$$;
SQL

elapsed_ms=$(( ($(date +%s%N)-started_ns)/1000000 ))
printf 'CANONICAL_BLUEPRINT_AUTHORITY_OK cases=5 physical=1430 logical=1396 elapsedMs=%s\n' "$elapsed_ms"
