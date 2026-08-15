#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION_ROOT="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql"
DESIGN="$MIGRATION_ROOT/V20260813093000__compile_canonical_screen_design_release.sql"
ENDPOINT="$MIGRATION_ROOT/V20260813113000__compile_canonical_endpoint_contract_catalog.sql"
UPGRADE="$MIGRATION_ROOT/V20260813150000__stage_validate_publish_legacy_endpoint_upgrade.sql"
PROJECTION="$MIGRATION_ROOT/V20260814173000__project_professional_screen_preview_bundle.sql"
AUTHORITY="$MIGRATION_ROOT/V20260815121000__resolve_canonical_blueprint_authority.sql"
PROCESS_INPUT="$MIGRATION_ROOT/V20260815121600__enforce_one_canonical_generation_job.sql"
PERMISSIONS="$MIGRATION_ROOT/V20260815121700__bind_professional_screen_permissions.sql"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DB_NAME="source_immediate_${RANDOM}_$$"
WORK="$(mktemp -d)"
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
START_NS="$(date +%s%N)"

fail() { printf 'SOURCE_IMMEDIATE_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
for file in "$DESIGN" "$ENDPOINT" "$UPGRADE" "$PROJECTION" "$AUTHORITY" "$PROCESS_INPUT" "$PERMISSIONS"; do
  [[ -f "$file" ]] || fail "missing $file"
done
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
PSQL=(psql -h "$WORK/socket" -p "$PORT" -U postgres -X -v ON_ERROR_STOP=1 -d "$DB_NAME")
db() { "${PSQL[@]}" "$@"; }
scalar() { "${PSQL[@]}" -Atqc "$1"; }

db >/dev/null <<'SQL'
CREATE EXTENSION pgcrypto;
CREATE ROLE carbonet_app NOLOGIN;
CREATE ROLE upgrade_auditor NOLOGIN;
CREATE FUNCTION framework_try_jsonb(source text,fallback jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF source IS NULL OR btrim(source)='' THEN RETURN fallback; END IF;
 RETURN source::jsonb;
EXCEPTION WHEN others THEN RETURN fallback; END $$;
CREATE TABLE framework_process_definition(
 process_code varchar(80) PRIMARY KEY,process_name varchar(160) NOT NULL,
 domain_code varchar(60) NOT NULL,process_version varchar(20) NOT NULL,
 goal text NOT NULL,start_condition text NOT NULL,completion_condition text NOT NULL,
 development_order integer NOT NULL,owner_actor_code varchar(60),risk_level varchar(20) NOT NULL,
 sla_hours integer NOT NULL,lifecycle_status varchar(30) NOT NULL,
 definition_locked boolean NOT NULL default true,
 created_at timestamp default now(),updated_at timestamp default now());
CREATE TABLE framework_process_step(
 step_id bigserial,process_code varchar(80) NOT NULL,step_code varchar(100) NOT NULL,
 step_order integer NOT NULL,step_name varchar(160) NOT NULL,step_type varchar(30) NOT NULL,
 actor_code varchar(60) NOT NULL,from_state varchar(60) NOT NULL,
 command_code varchar(80) NOT NULL,to_state varchar(60) NOT NULL,
 requirement_text text NOT NULL,completion_rule text NOT NULL,input_contract text NOT NULL,
 output_contract text NOT NULL,evidence_required boolean NOT NULL,evidence_types text NOT NULL,
 segregation_actor_codes text NOT NULL,rollback_command_code varchar(80) NOT NULL,
 decision_rule text NOT NULL,created_at timestamp default now(),updated_at timestamp default now(),
 PRIMARY KEY(process_code,step_code));
CREATE TABLE framework_screen_blueprint(
 blueprint_id bigserial PRIMARY KEY,blueprint_code varchar(140) NOT NULL UNIQUE,
 process_code varchar(80) NOT NULL,step_code varchar(100) NOT NULL,
 actor_code varchar(60) NOT NULL,audience varchar(20) NOT NULL,page_id varchar(160) NOT NULL,
 page_name varchar(200) NOT NULL,route_path varchar(400) NOT NULL,
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
 permission_codes jsonb NOT NULL default '["H1_PERMISSION"]'::jsonb,
 updated_by varchar(100) default 'SYSTEM',created_at timestamp default now(),
 updated_at timestamp default now());
CREATE TABLE framework_step_execution_spec(
 process_code varchar(80) NOT NULL,step_code varchar(100) NOT NULL,
 design_status varchar(30) NOT NULL,approval_status varchar(30) NOT NULL,
 generation_status varchar(30) NOT NULL,source_hash varchar(64),
 actor_contract jsonb NOT NULL,business_contract jsonb NOT NULL,
 transition_contract jsonb NOT NULL,input_contract jsonb NOT NULL,
 output_contract jsonb NOT NULL,screen_contract jsonb NOT NULL,
 field_contract jsonb NOT NULL,command_contract jsonb NOT NULL,
 api_contract jsonb NOT NULL,persistence_contract jsonb NOT NULL,
 handoff_contract jsonb NOT NULL,test_contract jsonb NOT NULL,
 guide_contract jsonb NOT NULL,nonfunctional_contract jsonb NOT NULL,
 updated_at timestamp default now(),PRIMARY KEY(process_code,step_code));
CREATE TABLE framework_development_job(
 job_id bigserial PRIMARY KEY,process_code varchar(80),job_type varchar(40),
 job_group_code varchar(180));
CREATE TABLE framework_permission_requirement_v1(
 process_code varchar(80),step_code varchar(100),permission_code varchar(120),
 scope_type varchar(20),resource_contract jsonb,guard_contract jsonb,use_at char(1));
CREATE TABLE framework_permission_grant_v1(
 actor_code varchar(60),permission_code varchar(120),scope_type varchar(20),
 effect varchar(8),use_at char(1));
CREATE FUNCTION framework_design_causality_json_set(value jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT coalesce(jsonb_agg(item ORDER BY item COLLATE "C"),'[]'::jsonb)
 FROM (SELECT DISTINCT upper(btrim(member#>>'{}')) item
         FROM jsonb_array_elements(coalesce(value,'[]'::jsonb)) member) normalized
$$;
CREATE FUNCTION framework_process_generation_snapshot(requested_process varchar)
RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object(
   'processCode',requested_process,
   'steps',coalesce(jsonb_agg(jsonb_build_object(
     'stepCode',step_code,'business',business_contract)
     ORDER BY step_code),'[]'::jsonb))
 FROM framework_step_execution_spec WHERE process_code=requested_process
$$;

INSERT INTO framework_process_definition VALUES
('PROC','Process','TEST','1','Goal','Start','Done',1,'ACTOR','LOW',1,'ACTIVE',true,now(),now());
INSERT INTO framework_process_step(
 process_code,step_code,step_order,step_name,step_type,actor_code,from_state,
 command_code,to_state,requirement_text,completion_rule,input_contract,
 output_contract,evidence_required,evidence_types,segregation_actor_codes,
 rollback_command_code,decision_rule)
VALUES('PROC','STEP',1,'Step','TASK','ACTOR','READY','SUBMIT','DONE',
 'Submit','Done','{}','{}',true,'AUDIT','REVIEWER','ROLLBACK','Valid');
INSERT INTO framework_step_execution_spec VALUES(
 'PROC','STEP','DESIGN_COMPLETE','APPROVED','READY',repeat('0',64),
 '{}','{"marker":"H1_ONLY"}','{}','{}','{}','{}','{}','{}','{}','{}',
 '{}','{}','{}','{}',now());

CREATE FUNCTION test_endpoint_api() RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_array(jsonb_build_object(
   'operationId','SubmitProcStep','implementationKind','PROCESS_COMMAND_ADAPTER',
   'method','POST','path','/api/generated/proc/{executionId}/submit',
   'processCode','PROC','stepCode','STEP','commandCode','SUBMIT',
   'authority',jsonb_build_object('audience','USER','actorCodes',jsonb_build_array('ACTOR'),
     'authenticated',true,'tenantScoped',true,'projectScoped',true),
   'request',jsonb_build_object('contentType','application/json','schema',jsonb_build_object(
     'type','object','properties',jsonb_build_object(
       'tenantId',jsonb_build_object('type','string'),'projectId',jsonb_build_object('type','string'),
       'actorCode',jsonb_build_object('type','string'),'idempotencyKey',jsonb_build_object('type','string')),
     'required',jsonb_build_array('tenantId','projectId','actorCode','idempotencyKey'))),
   'response',jsonb_build_object('successStatus',200,'schema',jsonb_build_object(
     'type','object','properties',jsonb_build_object(
       'success',jsonb_build_object('type','boolean'),'idempotent',jsonb_build_object('type','boolean'),
       'eventId',jsonb_build_object('type','integer'),'toState',jsonb_build_object('type','string')),
     'required',jsonb_build_array('success','idempotent','eventId','toState')),
     'errors',jsonb_build_array(jsonb_build_object('status',400,'code','INVALID_REQUEST'),
       jsonb_build_object('status',401,'code','AUTHENTICATION_REQUIRED'),
       jsonb_build_object('status',403,'code','ACCESS_DENIED'),
       jsonb_build_object('status',500,'code','INTERNAL_ERROR'))),
   'persistenceRef','PROCESS_EXECUTION_AGGREGATE','transactionPolicy','REQUIRED',
   'idempotencyRequired',true,'rollback',jsonb_build_object('strategy','TRANSACTION','commandCode','SUBMIT'))
 )::text
$$;
CREATE FUNCTION test_endpoint_database() RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_array(jsonb_build_object(
   'persistenceId','PROCESS_EXECUTION_AGGREGATE','entity','framework_process_execution',
   'operation','UPDATE','primaryKey',jsonb_build_array('execution_id'),
   'tenantColumn','tenant_id','projectColumn','project_id','versionColumn','execution_version',
   'transactional',true))::text
$$;
INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,generated_source_path,implementation_strategy,source_reference,transition_status)
VALUES('PROC_STEP_USER','PROC','STEP','ACTOR','USER','proc-step','Process step','/proc/step',
 'FORM','KRDS_FORM','{"assetBindings":[{"assetCode":"KRDS_FORM"}]}','{"requirements":["REQ"]}',
 'VALID','generated/proc-step.tsx','GENERATE_NEW',
 'framework_professional_screen_contract:1','CONTRACT_LINKED');
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
 command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,
 database_verified,authority_verified,responsive_verified,accessibility_verified,
 exception_states_verified,audit_evidence_ref,contract_status)
VALUES('PROC','STEP','USER','/proc/step','Process step','ACTOR','H1_ONLY',
 'READY','DONE','["completion"]','[{"title":"Main"}]','[{"name":"amount"}]',
 '["SUBMIT"]','["READY","DONE"]',test_endpoint_api(),test_endpoint_database(),
 '[{"type":"AUDIT"}]','mobile/tablet/desktop','KRDS WCAG 2.1 AA','tenant/project/actor',
 true,true,true,true,true,true,'evidence://H1_ONLY','VERIFIED');
GRANT SELECT ON framework_process_definition,framework_process_step,
 framework_screen_blueprint,framework_professional_screen_contract,
 framework_step_execution_spec TO carbonet_app;
SQL

db -f "$DESIGN" >/dev/null
db -f "$ENDPOINT" >/dev/null
db -f "$UPGRADE" >/dev/null
db -f "$PROJECTION" >/dev/null
db -f "$AUTHORITY" >/dev/null
db -f "$PROCESS_INPUT" >/dev/null
db -f "$PERMISSIONS" >/dev/null

H1_RELEASE="$(scalar "with proposal as (
 select framework_propose_canonical_endpoint_upgrade(jsonb_build_object(
  'schema','carbonet.endpoint-upgrade-request/v1','policy','RUNTIME_CONTEXT_ONLY_V1',
  'requestedLimit',5000,'requestedProcess','PROC','requestedBy','PG_TEST')) value
), validation as (
 select framework_validate_canonical_endpoint_upgrade(jsonb_build_object(
  'schema','carbonet.endpoint-upgrade-validation-request/v1',
  'proposalId',(value->>'proposalId')::bigint,'expectedProposalHash',value->>'proposalHash',
  'validatedBy','PG_TEST')) value,proposal.value proposal from proposal
), evidence as materialized (
 select framework_record_canonical_endpoint_upgrade_evidence(jsonb_build_object(
  'schema','carbonet.endpoint-upgrade-evidence-request/v1',
  'proposalId',(proposal->>'proposalId')::bigint,'validationId',(value->>'validationId')::bigint,
  'evidenceKind',kind,'evidenceHash',repeat(case kind when 'ACCOUNT_RELAY' then 'a'
    when 'BUSINESS_E2E' then 'b' else 'c' end,64),'recordedBy','PG_TEST')) value,
  validation.value validation,proposal from validation cross join unnest(array['ACCOUNT_RELAY','BUSINESS_E2E','VISUAL_QA']) kind
), evidence_count as (
 select count(value) recorded from evidence
), published as (
 select framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
  'schema','carbonet.endpoint-upgrade-publish-request/v1',
  'proposalId',(proposal->>'proposalId')::bigint,'expectedProposalHash',proposal->>'proposalHash',
  'expectedValidationHash',validation.value->>'validationHash','idempotencyKey','h1-publish',
  'publishedBy','PG_TEST')) value from validation,evidence_count where recorded=3
) select value->>'releaseId' from published")"
[[ "$H1_RELEASE" =~ ^[1-9][0-9]*$ ]] || fail 'H1 release was not published'
scalar "select framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$H1_RELEASE,
 'idempotencyKey','h1-active','activatedBy','PG_TEST'))" >/dev/null
H1_ACTIVE_HASH="$(scalar "select framework_canonical_design_catalog(100,'PROC')->>'catalogHash'")"

db >/dev/null <<'SQL'
UPDATE framework_professional_screen_contract
   SET business_purpose='H2_ONLY',audit_evidence_ref='evidence://H2_ONLY',
       permission_codes='["H2_PERMISSION"]'::jsonb
 WHERE process_code='PROC';
UPDATE framework_step_execution_spec
   SET business_contract='{"marker":"H2_ONLY"}'::jsonb
 WHERE process_code='PROC';
SQL

H2_DESIGN_HASH="$(scalar "select framework_source_canonical_design_catalog(100,'PROC')->>'catalogHash'")"
H2_ENDPOINT_HASH="$(scalar "select framework_source_canonical_endpoint_catalog(100,'PROC')->>'catalogHash'")"
[[ "$H2_DESIGN_HASH" != "$H1_ACTIVE_HASH" ]] || fail 'SOURCE H2 design hash did not change'
[[ "$(scalar "select framework_canonical_design_catalog(100,'PROC')->>'catalogHash'")" == "$H1_ACTIVE_HASH" ]] \
  || fail 'ACTIVE wrapper was modified instead of remaining H1'

HEAD="$(scalar "select framework_process_generation_input('PROC')::text")"
BUNDLE="$(scalar "with source_snapshot as materialized (
 select framework_process_generation_snapshot('PROC') runtime,
        framework_source_canonical_design_catalog(100,'PROC') design,
        framework_source_canonical_endpoint_readiness(100,'PROC') readiness
), complete_snapshot as materialized (
 select runtime,design,readiness,case when readiness->>'status'='COMPLETE'
   then framework_source_canonical_endpoint_catalog(100,'PROC') end endpoint
 from source_snapshot
) select jsonb_build_object('runtime',runtime,'design',design,
 'endpointReadiness',readiness,'endpoint',endpoint)::text from complete_snapshot")"

python3 - "$HEAD" "$BUNDLE" "$H2_DESIGN_HASH" "$H2_ENDPOINT_HASH" <<'PY'
import json,sys
head,bundle=map(json.loads,sys.argv[1:3]); design_hash,endpoint_hash=sys.argv[3:5]
assert head["activationPolicy"]=="SOURCE_IMMEDIATE_V1"
assert head["designCatalogHash"]==design_hash
assert head["endpointCatalogHash"]==endpoint_hash
assert head["input"]["generatorContract"]["activationPolicy"]=="SOURCE_IMMEDIATE_V1"
assert bundle["endpointReadiness"]["status"]=="COMPLETE"
assert bundle["design"]["catalogHash"]==design_hash
assert bundle["endpoint"]["catalogHash"]==endpoint_hash
for name,value in (("head",head),("bundle",bundle),("runtime",bundle["runtime"]),
                   ("design",bundle["design"]),("endpoint",bundle["endpoint"])):
    text=json.dumps(value,sort_keys=True)
    assert "H1_ONLY" not in text, f"{name} mixed ACTIVE H1"
assert "H2_ONLY" in json.dumps(bundle["runtime"],sort_keys=True)
assert "H2_ONLY" in json.dumps(bundle["design"],sort_keys=True)
assert "H2_ONLY" in json.dumps(bundle["endpoint"],sort_keys=True)
assert bundle["design"]["screens"][0]["canonicalDesign"]["lanes"]["DESIGN_CARD"]["permissionCodes"]==["H2_PERMISSION"]
PY

for function in framework_source_canonical_design_catalog framework_source_canonical_endpoint_readiness framework_source_canonical_endpoint_catalog; do
  [[ "$(scalar "select has_function_privilege('carbonet_app','public.${function}(integer,character varying)','EXECUTE')::text")" == false ]] \
    || fail "carbonet_app can execute private SOURCE compiler: $function"
done
set +e
db -c "set role carbonet_app; select framework_source_canonical_design_catalog(100,'PROC')" \
  >"$WORK/source-acl.out" 2>"$WORK/source-acl.err"
ACL_RC=$?
set -e
(( ACL_RC != 0 )) && grep -Fq 'permission denied for function framework_source_canonical_design_catalog' "$WORK/source-acl.err" \
  || fail 'SOURCE compiler invocation did not fail closed for carbonet_app'

ELAPSED_MS="$(( ($(date +%s%N)-START_NS)/1000000 ))"
printf 'SOURCE_IMMEDIATE_POSTGRES_PASS activeH1=1 sourceH2=1 runtimeH2=1 mixedH1=0 sourceFunctions=3 aclPrivate=3 elapsedMs=%s\n' "$ELAPSED_MS"
