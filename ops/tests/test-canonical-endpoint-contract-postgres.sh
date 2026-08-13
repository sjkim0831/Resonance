#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if (( $# )); then ROOT="$1"; else ROOT="$(cd "$(dirname "$BASH_SOURCE")/../.." && pwd)"; fi
BASE="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813093000__compile_canonical_screen_design_release.sql"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813113000__compile_canonical_endpoint_contract_catalog.sql"
GENERATOR="$ROOT/ops/scripts/generate-spring-api-from-design.py"
IMAGE="docker.io/library/postgres:16"
NAMESPACE="k8s.io"
CONTAINER_ID="codex-canonical-endpoint-$RANDOM-$$"
PASSWORD="endpoint-$RANDOM-$$"
WORK="$(mktemp -d)"
started=0
started_ns="$(date +%s%N)"

fail() { printf 'CANONICAL_ENDPOINT_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  set +e
  rm -rf "$WORK"
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM
for file in "$BASE" "$MIGRATION" "$GENERATOR"; do [[ -f "$file" ]] || fail "missing $file"; done
sudo -n true >/dev/null || fail 'passwordless sudo required'
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" || fail "cached image missing"
! rg -q 'FOR screen|array_append|endpoints[[:space:]]*:=' "$MIGRATION" ||
  fail 'quadratic endpoint accumulator returned'
for token in 'WITH ORDINALITY' 'jsonb_agg' 'string_agg' \
  'count(*) OVER (PARTITION BY' 'IS DISTINCT FROM' \
  'framework_canonical_endpoint_readiness' \
  'framework_canonical_design_catalog(integer,varchar)'; do
  rg -Fq "$token" "$MIGRATION" || fail "deterministic token missing: $token"
done

PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=canonical \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER_ID"
started=1
export PGPASSWORD="$PASSWORD"
psql_base=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d canonical -X)
for _ in $(seq 1 100); do
  "${psql_base[@]}" -Atqc 'select 1' >/dev/null 2>&1 && break
  sleep .1
done
"${psql_base[@]}" -Atqc 'select 1' >/dev/null 2>&1 || fail 'postgres readiness timeout'
db() { "${psql_base[@]}" -v ON_ERROR_STOP=1 "$@"; }
db_scalar() { "${psql_base[@]}" -v ON_ERROR_STOP=1 -Atqc "$1"; }

db >/dev/null <<'SQL'
CREATE ROLE carbonet_app NOLOGIN;
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
 created_at timestamp default now(),updated_at timestamp default now());
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
   'rollback',jsonb_build_object(
     'strategy','TRANSACTION','commandCode',command_code)
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
   '["READY","DONE"]',
   test_endpoint_api(i,process_code,step_code,actor_code,command_code),
   test_endpoint_database(),'["AUDIT"]','responsive','accessible','secure',
   true,true,true,true,true,true,'evidence://endpoint','VERIFIED'
  FROM source;
END
$$;
SELECT test_add_screens(1,1);
SELECT test_add_screens(1001,1001);
GRANT SELECT ON framework_process_definition,framework_process_step,
 framework_screen_blueprint,framework_professional_screen_contract TO carbonet_app;
SQL

db -f "$BASE" >/dev/null
db -f "$MIGRATION" >/dev/null

db >/dev/null <<'SQL'
BEGIN;
DELETE FROM framework_screen_blueprint;
DO $$
DECLARE readiness jsonb:=framework_canonical_endpoint_readiness(100);
DECLARE denied boolean:=false;
BEGIN
 IF readiness->>'status'<>'PARTIAL'
    OR readiness->>'sourceDesignCount'<>'0'
    OR readiness->>'canonicalScreenCount'<>'0'
    OR readiness->>'designBlockerCount'<>'0'
    OR readiness->>'blockerCount'<>'1'
    OR readiness#>>'{reasonCounts,EMPTY_SCOPE}'<>'1'
 THEN RAISE EXCEPTION 'empty source readiness mismatch: %',readiness; END IF;
 BEGIN PERFORM framework_canonical_endpoint_catalog(100);
 EXCEPTION WHEN SQLSTATE 'P0002' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'empty source escaped catalog gate'; END IF;
END
$$;
ROLLBACK;

DO $$
DECLARE full_ready jsonb:=framework_canonical_endpoint_readiness(100);
DECLARE ready_a jsonb:=framework_canonical_endpoint_readiness(100,'PROC_A');
DECLARE ready_b jsonb:=framework_canonical_endpoint_readiness(100,'PROC_B');
DECLARE full_catalog jsonb:=framework_canonical_endpoint_catalog(100);
DECLARE catalog_a jsonb:=framework_canonical_endpoint_catalog(100,'PROC_A');
DECLARE catalog_b jsonb:=framework_canonical_endpoint_catalog(100,'PROC_B');
DECLARE design_a jsonb:=framework_canonical_design_catalog(100,'PROC_A');
BEGIN
 IF full_ready->>'status'<>'COMPLETE' OR full_ready->>'totalCount'<>'2'
    OR full_ready->>'sourceDesignCount'<>'2'
    OR full_ready->>'canonicalScreenCount'<>'2'
    OR full_ready->>'designBlockerCount'<>'0'
    OR full_ready->>'sourceReadyCount'<>'2' OR full_ready->>'blockerCount'<>'0'
    OR ready_a->>'status'<>'COMPLETE' OR ready_a->>'totalCount'<>'1'
    OR ready_b->>'status'<>'COMPLETE' OR ready_b->>'totalCount'<>'1'
 THEN RAISE EXCEPTION 'two-process readiness mismatch: % % %',
   full_ready,ready_a,ready_b; END IF;
 IF jsonb_array_length(full_catalog->'endpoints')<>2
    OR jsonb_array_length(catalog_a->'endpoints')<>1
    OR jsonb_array_length(catalog_b->'endpoints')<>1
    OR design_a->>'screenCount'<>'1'
    OR catalog_a->>'catalogHash'=catalog_b->>'catalogHash'
    OR catalog_a#>>'{endpoints,0,endpointContract,operations,0,processCode}'<>'PROC_A'
    OR catalog_b#>>'{endpoints,0,endpointContract,operations,0,processCode}'<>'PROC_B'
 THEN RAISE EXCEPTION 'two-process catalog/filter mismatch'; END IF;
END
$$;

-- The endpoint denominator is every VALID blueprint, not merely the subset
-- V93000 can compile. Exercise one missing, duplicate and incomplete design.
INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,generated_source_path)
VALUES('SCREEN_BLOCKER_MISSING','PROC_A','STEP_A','ACTOR_A','USER',
 'blocker-missing','Missing Contract','/blocker/missing','FORM','KRDS_FORM',
 '{}','{"requirements":["REQ"]}','VALID','volatile');
INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,generated_source_path)
SELECT 'SCREEN_BLOCKER_DUPLICATE',process_code,step_code,actor_code,audience,
       'duplicate-'||page_id,page_name,route_path,screen_type,template_code,
       specification_json,traceability_json,validation_status,'volatile'
  FROM framework_screen_blueprint WHERE route_path='/screen/1';
UPDATE framework_professional_screen_contract SET data_contract='[]'
 WHERE route_path='/screen/1001';
DO $$
DECLARE readiness jsonb:=framework_canonical_endpoint_readiness(100);
DECLARE ready_a jsonb:=framework_canonical_endpoint_readiness(100,'PROC_A');
DECLARE ready_b jsonb:=framework_canonical_endpoint_readiness(100,'PROC_B');
DECLARE denied boolean:=false;
BEGIN
 IF readiness->>'status'<>'PARTIAL'
    OR readiness->>'sourceDesignCount'<>'4'
    OR readiness->>'canonicalScreenCount'<>'0'
    OR readiness->>'designBlockerCount'<>'4'
    OR readiness->>'sourceReadyCount'<>'0'
    OR readiness->>'blockerCount'<>'4'
    OR readiness#>>'{reasonCounts,DESIGN_CONTRACT_MISSING}'<>'1'
    OR readiness#>>'{reasonCounts,DESIGN_BLUEPRINT_DUPLICATE}'<>'2'
    OR readiness#>>'{reasonCounts,DESIGN_LANES_INCOMPLETE}'<>'1'
 THEN RAISE EXCEPTION 'design denominator/readiness mismatch: %',readiness; END IF;
 IF ready_a->>'status'<>'PARTIAL' OR ready_a->>'sourceDesignCount'<>'3'
    OR ready_a->>'designBlockerCount'<>'3'
    OR ready_b->>'status'<>'PARTIAL' OR ready_b->>'sourceDesignCount'<>'1'
    OR ready_b->>'designBlockerCount'<>'1'
 THEN RAISE EXCEPTION 'process design blocker mismatch: % %',ready_a,ready_b; END IF;
 BEGIN PERFORM framework_canonical_endpoint_catalog(100);
 EXCEPTION WHEN SQLSTATE 'P0002' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'design blockers escaped catalog gate'; END IF;
END
$$;
DELETE FROM framework_screen_blueprint
 WHERE blueprint_code IN ('SCREEN_BLOCKER_MISSING','SCREEN_BLOCKER_DUPLICATE');
UPDATE framework_professional_screen_contract SET data_contract=test_endpoint_database()
 WHERE route_path='/screen/1001';

-- A duplicate professional contract is a separate blocker. It must not
-- contaminate a complete process scope or cancel compiler mismatch accounting.
INSERT INTO framework_professional_screen_contract
SELECT (jsonb_populate_record(
  NULL::framework_professional_screen_contract,
  to_jsonb(c)||jsonb_build_object(
    'contract_id',nextval('framework_professional_screen_contract_contract_id_seq')
  )
)).*
FROM framework_professional_screen_contract c WHERE route_path='/screen/1';
DO $$
DECLARE readiness jsonb:=framework_canonical_endpoint_readiness(100);
DECLARE ready_a jsonb:=framework_canonical_endpoint_readiness(100,'PROC_A');
DECLARE ready_b jsonb:=framework_canonical_endpoint_readiness(100,'PROC_B');
BEGIN
 IF readiness->>'status'<>'PARTIAL'
    OR readiness->>'sourceDesignCount'<>'2'
    OR readiness->>'canonicalScreenCount'<>'1'
    OR readiness->>'designBlockerCount'<>'1'
    OR readiness#>>'{reasonCounts,DESIGN_CONTRACT_DUPLICATE}'<>'1'
    OR readiness#>'{reasonCounts,DESIGN_COMPILER_MISMATCH}' IS NOT NULL
 THEN RAISE EXCEPTION 'contract duplicate mismatch: %',readiness; END IF;
 IF ready_a->>'status'<>'PARTIAL' OR ready_a->>'designBlockerCount'<>'1'
    OR ready_b->>'status'<>'COMPLETE' OR ready_b->>'designBlockerCount'<>'0'
 THEN RAISE EXCEPTION 'contract duplicate process isolation mismatch: % %',
   ready_a,ready_b; END IF;
END
$$;
DELETE FROM framework_professional_screen_contract
 WHERE contract_id=(SELECT max(contract_id)
   FROM framework_professional_screen_contract WHERE route_path='/screen/1');

-- Legacy source stays diagnosable but can never be published as COMPLETE.
UPDATE framework_professional_screen_contract
   SET api_contract='[{"method":"POST"}]';
DO $$
DECLARE readiness jsonb:=framework_canonical_endpoint_readiness(100);
DECLARE denied boolean:=false;
BEGIN
 IF readiness->>'status'<>'PARTIAL' OR readiness->>'totalCount'<>'2'
    OR readiness->>'sourceReadyCount'<>'0' OR readiness->>'blockerCount'<>'2'
    OR (readiness#>>'{reasonCounts,API_SOURCE_KEYS_INVALID}')::integer<>2
 THEN RAISE EXCEPTION 'legacy readiness mismatch: %',readiness; END IF;
 BEGIN PERFORM framework_canonical_endpoint_catalog(100);
 EXCEPTION WHEN SQLSTATE 'P0002' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'legacy PARTIAL catalog escaped'; END IF;
END
$$;
UPDATE framework_professional_screen_contract c
   SET api_contract=test_endpoint_api(
     substring(c.route_path from '[0-9]+$')::integer,c.process_code,c.step_code,
     c.actor_code,CASE c.process_code WHEN 'PROC_A' THEN 'SUBMIT_A' ELSE 'SUBMIT_B' END);
SQL

db -Atqc "SELECT framework_canonical_endpoint_catalog(100)::text" >"$WORK/catalog-two.json"
python3 "$GENERATOR" "$WORK/catalog-two.json" --out "$WORK/generated-two" --workers 2 >/dev/null
python3 "$GENERATOR" "$WORK/catalog-two.json" --out "$WORK/generated-two" --workers 2 --check >/dev/null
[[ "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["adapter"])' \
  "$WORK/generated-two/manifest.json")" == "EXISTING_PROCESS_COMMAND_RUNTIME" ]] ||
  fail 'runtime adapter manifest missing'
controller="$(find "$WORK/generated-two" -name '*Controller.java' -print -quit)"
rg -Fq 'payload.put("requireDraft",true)' "$controller" ||
  fail 'draft prerequisite binding missing'
! find "$WORK/generated-two" -name '*Request.java' -exec rg -l 'requireDraft' {} + |
  grep -q . || fail 'requireDraft leaked into request DTO'

before_source_hash="$(db_scalar "SELECT encode(sha256(convert_to(string_agg(
 api_contract||E'\\x1f'||data_contract,E'\\n' ORDER BY contract_id
),'UTF8')),'hex') FROM framework_professional_screen_contract")"
db >/dev/null <<'SQL'
BEGIN;
DO $$
DECLARE original_api jsonb;
DECLARE original_api_b jsonb;
DECLARE original_db jsonb;
DECLARE mutation jsonb;
DECLARE denied boolean;
DECLARE api_mutations jsonb[];
DECLARE db_mutations jsonb[];
DECLARE first_path text;
BEGIN
 SELECT api_contract::jsonb,data_contract::jsonb
   INTO original_api,original_db
   FROM framework_professional_screen_contract WHERE route_path='/screen/1';
 SELECT api_contract::jsonb INTO original_api_b
   FROM framework_professional_screen_contract WHERE route_path='/screen/1001';
 api_mutations:=ARRAY[
   jsonb_set(original_api,'{0,persistenceRef}','null'),
   jsonb_set(original_api,'{0,method}','null'),
   jsonb_set(original_api,'{0,authority}','{}'),
   jsonb_set(original_api,'{0,authority,tenantScoped}','false'),
   jsonb_set(original_api,'{0,authority,projectScoped}','false'),
   jsonb_set(original_api,'{0,request,schema,required}',
     '["projectId","actorCode","idempotencyKey","amount"]'),
   jsonb_set(original_api,'{0,response,errors}',
     '[{"status":400,"code":"INVALID_REQUEST"}]'),
   jsonb_set(original_api,'{0,request,schema,properties,amount,sql}',
     '"select"',true),
   jsonb_set(original_api,'{0,path}',
     to_jsonb((original_api#>>'{0,path}')||'/')),
   jsonb_set(original_api,'{0,request,schema,properties,requireDraft}',
     '{"type":"boolean"}',true),
   jsonb_set(original_api,'{0,rollback,strategy}','"COMPENSATING"'),
   jsonb_set(original_api,'{0,rollback,commandCode}','"ROLLBACK"'),
   jsonb_set(original_api,'{0,response,successStatus}','"200"'),
   jsonb_set(original_api,'{0,response,successStatus}','200.0')
 ];
 FOREACH mutation IN ARRAY api_mutations LOOP
   UPDATE framework_professional_screen_contract SET api_contract=mutation::text
    WHERE route_path='/screen/1';
   IF framework_canonical_endpoint_readiness(100)->>'status'<>'PARTIAL' THEN
     RAISE EXCEPTION 'API mutant escaped readiness: %',mutation; END IF;
   denied:=false;
   BEGIN PERFORM framework_canonical_endpoint_catalog(100);
   EXCEPTION WHEN SQLSTATE 'P0002' THEN denied:=true; END;
   IF NOT denied THEN RAISE EXCEPTION 'API mutant escaped catalog'; END IF;
 END LOOP;
 UPDATE framework_professional_screen_contract SET api_contract=original_api::text
  WHERE route_path='/screen/1';
 db_mutations:=ARRAY[
   jsonb_set(original_db,'{0,entity}','"BadIdentifier"'),
   jsonb_set(original_db,'{0,primaryKey}','["execution_id","execution_id"]')
 ];
 FOREACH mutation IN ARRAY db_mutations LOOP
   UPDATE framework_professional_screen_contract SET data_contract=mutation::text
    WHERE route_path='/screen/1';
   IF framework_canonical_endpoint_readiness(100)->>'status'<>'PARTIAL' THEN
     RAISE EXCEPTION 'DATABASE mutant escaped readiness'; END IF;
   denied:=false;
   BEGIN PERFORM framework_canonical_endpoint_catalog(100);
   EXCEPTION WHEN SQLSTATE 'P0002' THEN denied:=true; END;
   IF NOT denied THEN RAISE EXCEPTION 'DATABASE mutant escaped catalog'; END IF;
 END LOOP;
 UPDATE framework_professional_screen_contract SET data_contract=original_db::text
  WHERE route_path='/screen/1';

 -- Java artifact names collide even though operationId casefold values differ.
 UPDATE framework_professional_screen_contract
    SET api_contract=jsonb_set(original_api,'{0,operationId}','"foo_bar"')::text
  WHERE route_path='/screen/1';
 UPDATE framework_professional_screen_contract
    SET api_contract=jsonb_set(original_api_b,'{0,operationId}','"fooBar"')::text
  WHERE route_path='/screen/1001';
 IF framework_canonical_endpoint_readiness(100)->>'status'<>'PARTIAL'
    OR framework_canonical_endpoint_readiness(100,'PROC_A')->>'status'<>'PARTIAL'
    OR framework_canonical_endpoint_readiness(100,'PROC_B')->>'status'<>'PARTIAL'
 THEN RAISE EXCEPTION 'global Java artifact collision escaped filter'; END IF;

 UPDATE framework_professional_screen_contract SET api_contract=original_api::text
  WHERE route_path='/screen/1';
 UPDATE framework_professional_screen_contract SET api_contract=original_api_b::text
  WHERE route_path='/screen/1001';
 first_path:=original_api#>>'{0,path}';
 UPDATE framework_professional_screen_contract
    SET api_contract=jsonb_set(original_api_b,'{0,path}',to_jsonb(first_path))::text
  WHERE route_path='/screen/1001';
 IF framework_canonical_endpoint_readiness(100)->>'status'<>'PARTIAL'
    OR framework_canonical_endpoint_readiness(100,'PROC_A')->>'status'<>'PARTIAL'
 THEN RAISE EXCEPTION 'global route collision escaped filter'; END IF;
END
$$;
ROLLBACK;
SQL
after_source_hash="$(db_scalar "SELECT encode(sha256(convert_to(string_agg(
 api_contract||E'\\x1f'||data_contract,E'\\n' ORDER BY contract_id
),'UTF8')),'hex') FROM framework_professional_screen_contract")"
[[ "$before_source_hash" == "$after_source_hash" ]] ||
  fail 'mutation transaction changed source bytes'

db -c "SELECT test_add_screens(2,1000); SELECT test_add_screens(1002,1427);" >/dev/null
readiness_ms="$(db_scalar "WITH started AS MATERIALIZED (
 SELECT clock_timestamp() started_at
), compiled AS MATERIALIZED (
 SELECT started_at,framework_canonical_endpoint_readiness(5000) value FROM started
) SELECT round(extract(epoch FROM (clock_timestamp()-started_at))*1000)::bigint
 FROM compiled WHERE value->>'status'='COMPLETE'")"
catalog_ms="$(db_scalar "WITH started AS MATERIALIZED (
 SELECT clock_timestamp() started_at
), compiled AS MATERIALIZED (
 SELECT started_at,framework_canonical_endpoint_catalog(5000) value FROM started
) SELECT round(extract(epoch FROM (clock_timestamp()-started_at))*1000)::bigint
 FROM compiled WHERE jsonb_array_length(value->'endpoints')=1427")"
[[ "$readiness_ms" =~ ^[0-9]+$ && "$catalog_ms" =~ ^[0-9]+$ ]] ||
  fail "1427 timing missing: readiness=$readiness_ms catalog=$catalog_ms"
(( readiness_ms < 10000 && catalog_ms < 10000 )) ||
  fail "1427 scale exceeded 10s: readiness=${readiness_ms}ms catalog=${catalog_ms}ms"

db >/dev/null <<'SQL'
DO $$
DECLARE ready jsonb:=framework_canonical_endpoint_readiness(5000);
DECLARE ready_a jsonb:=framework_canonical_endpoint_readiness(5000,'PROC_A');
DECLARE ready_b jsonb:=framework_canonical_endpoint_readiness(5000,'PROC_B');
DECLARE full_one jsonb:=framework_canonical_endpoint_catalog(5000);
DECLARE full_two jsonb:=framework_canonical_endpoint_catalog(5000);
DECLARE catalog_a jsonb:=framework_canonical_endpoint_catalog(5000,'PROC_A');
DECLARE catalog_b jsonb:=framework_canonical_endpoint_catalog(5000,'PROC_B');
DECLARE design_a jsonb:=framework_canonical_design_catalog(5000,'PROC_A');
BEGIN
 IF ready->>'status'<>'COMPLETE' OR ready->>'totalCount'<>'1427'
    OR ready->>'sourceDesignCount'<>'1427'
    OR ready->>'canonicalScreenCount'<>'1427'
    OR ready->>'designBlockerCount'<>'0'
    OR ready->>'sourceReadyCount'<>'1427' OR ready->>'blockerCount'<>'0'
    OR ready_a->>'totalCount'<>'1000' OR ready_b->>'totalCount'<>'427'
    OR ready_a->>'sourceDesignCount'<>'1000'
    OR ready_b->>'sourceDesignCount'<>'427'
    OR ready_a->>'designBlockerCount'<>'0'
    OR ready_b->>'designBlockerCount'<>'0'
    OR ready_a->>'status'<>'COMPLETE' OR ready_b->>'status'<>'COMPLETE'
 THEN RAISE EXCEPTION 'scale readiness mismatch: % % %',ready,ready_a,ready_b; END IF;
 IF full_one IS DISTINCT FROM full_two
    OR jsonb_array_length(full_one->'endpoints')<>1427
    OR jsonb_array_length(catalog_a->'endpoints')<>1000
    OR jsonb_array_length(catalog_b->'endpoints')<>427
    OR design_a->>'screenCount'<>'1000'
    OR catalog_a->>'catalogHash'=catalog_b->>'catalogHash'
 THEN RAISE EXCEPTION 'scale deterministic/filter mismatch'; END IF;
 IF full_one->>'catalogHash'<>(
      SELECT encode(sha256(convert_to(string_agg(
        (endpoint->>'screenKey')||E'\x1f'||(endpoint->>'endpointHash'),E'\n'
        ORDER BY ordinal),'UTF8')),'hex')
        FROM jsonb_array_elements(full_one->'endpoints')
             WITH ORDINALITY e(endpoint,ordinal))
    OR catalog_a->>'catalogHash'<>(
      SELECT encode(sha256(convert_to(string_agg(
        (endpoint->>'screenKey')||E'\x1f'||(endpoint->>'endpointHash'),E'\n'
        ORDER BY ordinal),'UTF8')),'hex')
        FROM jsonb_array_elements(catalog_a->'endpoints')
             WITH ORDINALITY e(endpoint,ordinal))
 THEN RAISE EXCEPTION 'ordered catalog hash mismatch'; END IF;
END
$$;
SQL

db -Atqc "SELECT framework_canonical_endpoint_catalog(5000)::text" >"$WORK/catalog.json"
python3 "$GENERATOR" "$WORK/catalog.json" --out "$WORK/generated" --workers 16 >/dev/null
python3 "$GENERATOR" "$WORK/catalog.json" --out "$WORK/generated" --workers 16 --check >/dev/null
python3 "$ROOT/ops/scripts/test-generate-spring-api-from-design.py" >/dev/null

db >/dev/null <<'SQL'
DO $$
DECLARE function_signature regprocedure;
BEGIN
 FOREACH function_signature IN ARRAY ARRAY[
   'public.framework_canonical_design_catalog(integer,character varying)'::regprocedure,
   'public.framework_canonical_endpoint_exact_keys(jsonb,text[])'::regprocedure,
   'public.framework_canonical_endpoint_schema_valid(jsonb,boolean)'::regprocedure,
   'public.framework_canonical_endpoint_java_name(text)'::regprocedure,
   'public.framework_canonical_endpoint_has_forbidden_key(jsonb)'::regprocedure,
   'public.framework_canonical_endpoint_diagnostic(jsonb)'::regprocedure,
   'public.framework_canonical_endpoint_readiness(integer)'::regprocedure,
   'public.framework_canonical_endpoint_readiness(integer,character varying)'::regprocedure,
   'public.framework_canonical_endpoint_catalog(integer)'::regprocedure,
   'public.framework_canonical_endpoint_catalog(integer,character varying)'::regprocedure
 ] LOOP
   IF has_function_privilege('public',function_signature,'EXECUTE')
      OR NOT has_function_privilege('carbonet_app',function_signature,'EXECUTE') THEN
     RAISE EXCEPTION 'function ACL mismatch: %',function_signature; END IF;
   IF EXISTS(
     SELECT 1 FROM pg_proc WHERE oid=function_signature
       AND (prosecdef OR proconfig<>ARRAY['search_path=pg_catalog, public'])
   ) THEN RAISE EXCEPTION 'function security/search_path mismatch: %',
     function_signature; END IF;
 END LOOP;
END
$$;
SET ROLE carbonet_app;
SELECT framework_canonical_endpoint_readiness(5000)->>'status';
SELECT framework_canonical_endpoint_catalog(5000,'PROC_B')->>'catalogHash';
DO $$ BEGIN
 BEGIN UPDATE framework_professional_screen_contract SET business_purpose='write';
   RAISE EXCEPTION 'application write escaped';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SQL

cleanup
started=0
sudo ctr -n "$NAMESPACE" containers info "$CONTAINER_ID" >/dev/null 2>&1 &&
  fail 'cleanup left container'
elapsed_ms="$(( ($(date +%s%N)-started_ns)/1000000 ))"
printf 'CANONICAL_ENDPOINT_POSTGRES_PASS endpoints=1427 processes=2 generatorTests=8 generatorCheck=1 mutations=16 designBlockers=5 collisions=2 legacyReady=0 acl=1 readOnly=1 cleanup=0 readinessMs=%s catalogMs=%s elapsedMs=%s\n' \
  "$readiness_ms" "$catalog_ms" "$elapsed_ms"
