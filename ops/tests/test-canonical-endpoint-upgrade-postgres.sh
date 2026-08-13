#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DESIGN="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813093000__compile_canonical_screen_design_release.sql"
ENDPOINT="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813113000__compile_canonical_endpoint_contract_catalog.sql"
UPGRADE="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813150000__stage_validate_publish_legacy_endpoint_upgrade.sql"
VERIFIER="$ROOT/ops/scripts/verify-canonical-endpoint-upgrade-release.py"
GENERATOR="$ROOT/ops/scripts/generate-spring-api-from-design.py"
IMAGE="${CANONICAL_ENDPOINT_UPGRADE_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER_ID="codex-endpoint-upgrade-$RANDOM-$$"
PASSWORD="upgrade-$RANDOM-$$"
WORK="$(mktemp -d)"
STARTED=0
START_NS="$(date +%s%N)"

fail() { printf 'CANONICAL_ENDPOINT_UPGRADE_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  local rc=$?
  set +e
  rm -rf "$WORK"
  if (( STARTED )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap cleanup EXIT INT TERM

for file in "$DESIGN" "$ENDPOINT" "$UPGRADE" "$VERIFIER" "$GENERATOR"; do
  [[ -f "$file" ]] || fail "missing $file"
done
for tool in psql python3 rg sha256sum; do command -v "$tool" >/dev/null || fail "missing $tool"; done
sudo -n true >/dev/null || fail 'passwordless sudo required'
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" || fail "cached image missing: $IMAGE"

# Surface drift must fail before a container is started. These names form the
# migration-to-orchestrator boundary; the dynamic assertions below check behavior.
for token in \
  'framework_propose_canonical_endpoint_upgrade' \
  'framework_validate_canonical_endpoint_upgrade' \
  'framework_record_canonical_endpoint_upgrade_evidence' \
  'framework_publish_canonical_endpoint_upgrade' \
  'framework_activate_canonical_endpoint_upgrade' \
  'framework_rollback_canonical_endpoint_upgrade' \
  'framework_canonical_endpoint_upgrade_export' \
  'framework_canonical_endpoint_effective_binding'; do
  rg -Fq "$token" "$UPGRADE" || fail "migration function unavailable: $token"
done

PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=canonical \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER_ID"
STARTED=1
export PGPASSWORD="$PASSWORD"
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d canonical -X)
for _ in $(seq 1 100); do
  "${PSQL[@]}" -Atqc 'select 1' >/dev/null 2>&1 && break
  sleep .1
done
"${PSQL[@]}" -Atqc 'select 1' >/dev/null 2>&1 || fail 'postgres readiness timeout'
db() { "${PSQL[@]}" -v ON_ERROR_STOP=1 "$@"; }
scalar() { "${PSQL[@]}" -v ON_ERROR_STOP=1 -Atqc "$1"; }

db >/dev/null <<'SQL'
CREATE ROLE carbonet_app NOLOGIN;
CREATE ROLE upgrade_auditor NOLOGIN;
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb DEFAULT '[]'::jsonb)
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
('LEGACY','Legacy current-like','TEST','1','Upgrade eligible rows','Available','Validated',1,'LEGACY_ACTOR','HIGH',24,'ACTIVE',now(),now()),
('PILOT','Two actor pilot','TEST','1','Complete actor relay','Available','Verified',2,'PILOT_ADMIN','HIGH',1,'ACTIVE',now(),now()),
('CAS','Raw byte CAS','TEST','1','Reject stale raw lineage','Available','Verified',3,'CAS_ACTOR','HIGH',1,'ACTIVE',now(),now());
INSERT INTO framework_process_step VALUES
('LEGACY','LEGACY_STEP',1,'Legacy step','TASK','LEGACY_ACTOR','READY','COMPLETE','DONE','Complete','Done','{}','{}',true,'AUDIT','REVIEWER','COMPLETE','valid'),
('PILOT','PILOT_STEP',1,'Pilot step','TASK','PILOT_ADMIN','READY','COMPLETE','DONE','Complete','Done','{}','{}',true,'AUDIT','REVIEWER','COMPLETE','valid'),
('CAS','CAS_STEP',1,'CAS step','TASK','CAS_ACTOR','READY','COMPLETE','DONE','Complete','Done','{}','{}',true,'AUDIT','REVIEWER','COMPLETE','valid');

CREATE FUNCTION fixture_add_blueprint(code text,process text,step text,actor text,audience text,route text)
RETURNS void LANGUAGE sql AS $$
 INSERT INTO framework_screen_blueprint(
   blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
   route_path,screen_type,template_code,specification_json,traceability_json,
   validation_status,generated_source_path)
 VALUES(code,process,step,actor,audience,lower(code),code,route,'FORM','KRDS_FORM',
        '{"theme":"krds"}','{"requirements":["REQ"]}','VALID','volatile/'||code||'.tsx')
$$;
CREATE FUNCTION fixture_add_contract(process text,step text,actor text,audience text,route text,
                                     raw_api text DEFAULT '[{"legacy":"api"}]',
                                     raw_db text DEFAULT '[{"legacy":"db"}]',
                                     raw_section text DEFAULT '[{"title":"Main"}]',
                                     raw_field text DEFAULT '[{"name":"value"}]')
RETURNS void LANGUAGE sql AS $$
 INSERT INTO framework_professional_screen_contract(
   process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
   entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
   command_contract,state_contract,api_contract,data_contract,evidence_contract,
   responsive_contract,accessibility_contract,security_contract,api_verified,
   database_verified,authority_verified,responsive_verified,accessibility_verified,
   exception_states_verified,audit_evidence_ref,contract_status)
 VALUES(process,step,audience,route,'Work '||route,actor,'Complete work','READY','DONE',
   '["completion"]',raw_section,raw_field,'["COMPLETE"]','["READY","DONE"]',
   raw_api,raw_db,'["AUDIT"]','360,768,1280','KRDS WCAG 2.1 AA','tenant/project/actor',
   true,true,true,true,true,true,'evidence://fixture','VERIFIED')
$$;

-- 1,359 exact eligible rows. Raw text deliberately differs from jsonb::text.
DO $$ DECLARE i integer; route text; BEGIN
 FOR i IN 1..1359 LOOP
   route:='/legacy/'||i;
   PERFORM fixture_add_blueprint('LEGACY_OK_'||lpad(i::text,4,'0'),'LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
   PERFORM fixture_add_contract('LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route,
     '[ { "legacy" : "api", "ordinal" : '||i||' } ]',
     '[ { "legacy" : "db", "ordinal" : '||i||' } ]');
 END LOOP;
 -- 101 missing contract rows.
 FOR i IN 1..101 LOOP
   PERFORM fixture_add_blueprint('LEGACY_MISSING_'||lpad(i::text,3,'0'),'LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER','/legacy/missing/'||i);
 END LOOP;
 -- 189 duplicate blueprint rows: 93 pairs plus one triple = 94 identities, 189 rows.
 FOR i IN 1..93 LOOP
   route:='/legacy/duplicate-blueprint/'||i;
   PERFORM fixture_add_blueprint('LEGACY_DUP_BP_A_'||lpad(i::text,3,'0'),'LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
   PERFORM fixture_add_blueprint('LEGACY_DUP_BP_B_'||lpad(i::text,3,'0'),'LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route||'?copy=1');
   PERFORM fixture_add_contract('LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
 END LOOP;
 route:='/legacy/duplicate-blueprint/94';
 PERFORM fixture_add_blueprint('LEGACY_DUP_BP_A_094','LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
 PERFORM fixture_add_blueprint('LEGACY_DUP_BP_B_094','LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route||'?copy=1');
 PERFORM fixture_add_blueprint('LEGACY_DUP_BP_C_094','LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route||'?copy=2');
 PERFORM fixture_add_contract('LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
 -- 13 blueprint rows each bind two contracts.
 FOR i IN 1..13 LOOP
   route:='/legacy/duplicate-contract/'||i;
   PERFORM fixture_add_blueprint('LEGACY_DUP_C_'||lpad(i::text,3,'0'),'LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
   PERFORM fixture_add_contract('LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
   PERFORM fixture_add_contract('LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route||'?second=1');
 END LOOP;
 -- 66 exact contracts with one mandatory lane empty.
 FOR i IN 1..66 LOOP
   route:='/legacy/incomplete/'||i;
   PERFORM fixture_add_blueprint('LEGACY_INCOMPLETE_'||lpad(i::text,3,'0'),'LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route);
   PERFORM fixture_add_contract('LEGACY','LEGACY_STEP','LEGACY_ACTOR','USER',route,'[]','[{"legacy":"db"}]');
 END LOOP;
END $$;

-- COMPLETE two-actor pilot. A second immutable release is created after a
-- source-only metadata change to prove rollback switches releases, not source.
SELECT fixture_add_blueprint('PILOT_ADMIN','PILOT','PILOT_STEP','PILOT_ADMIN','ADMIN','/pilot/admin');
SELECT fixture_add_contract('PILOT','PILOT_STEP','PILOT_ADMIN','ADMIN','/pilot/admin',
  '[ { "legacy" : "admin-api" } ]','[ { "legacy" : "admin-db" } ]');
SELECT fixture_add_blueprint('PILOT_USER','PILOT','PILOT_STEP','PILOT_USER','USER','/pilot/user');
SELECT fixture_add_contract('PILOT','PILOT_STEP','PILOT_USER','USER','/pilot/user',
  '[ { "legacy" : "user-api" } ]','[ { "legacy" : "user-db" } ]');
SELECT fixture_add_blueprint('CAS_USER','CAS','CAS_STEP','CAS_ACTOR','USER','/cas/user');
SELECT fixture_add_contract('CAS','CAS_STEP','CAS_ACTOR','USER','/cas/user',
  '[ { "legacy" : "cas-api" } ]','[ { "legacy" : "cas-db" } ]');

GRANT SELECT ON framework_process_definition,framework_process_step,
 framework_screen_blueprint,framework_professional_screen_contract TO carbonet_app;
SQL

# Prove the fixture creates the advertised population independently of either
# readiness implementation. This catches an accidental off-by-one in the 94
# pairs + one triple duplicate-blueprint construction.
db >/dev/null <<'SQL'
DO $$
DECLARE source_count integer; member_count integer; missing_count integer;
DECLARE duplicate_blueprint_count integer; duplicate_contract_count integer;
DECLARE incomplete_count integer;
BEGIN
 WITH raw_blueprints AS MATERIALIZED (
   SELECT b.process_code,b.step_code,b.audience,
          lower(split_part(b.route_path,'?',1)) route_path
     FROM framework_screen_blueprint b
    WHERE b.process_code='LEGACY' AND b.validation_status='VALID'
 ), blueprints AS MATERIALIZED (
   SELECT *,count(*) OVER (PARTITION BY upper(process_code),upper(step_code),
     upper(audience),route_path)::integer blueprint_count FROM raw_blueprints
 ), contracts AS MATERIALIZED (
   SELECT c.process_code,c.step_code,c.audience,
          lower(split_part(c.route_path,'?',1)) route_path,
          count(*)::integer contract_count,
          count(*) FILTER (WHERE c.api_contract::jsonb<>'[]'::jsonb
            AND c.data_contract::jsonb<>'[]'::jsonb
            AND c.section_contract::jsonb<>'[]'::jsonb
            AND c.field_contract::jsonb<>'[]'::jsonb)::integer complete_count
     FROM framework_professional_screen_contract c WHERE c.process_code='LEGACY'
    GROUP BY c.process_code,c.step_code,c.audience,lower(split_part(c.route_path,'?',1))
 ), scoped AS MATERIALIZED (
   SELECT b.*,coalesce(c.contract_count,0) contract_count,
          coalesce(c.complete_count,0) complete_count
     FROM blueprints b LEFT JOIN contracts c USING(process_code,step_code,audience,route_path)
 )
 SELECT count(*)::integer,
   count(*) FILTER (WHERE blueprint_count=1 AND contract_count=1 AND complete_count=1)::integer,
   count(*) FILTER (WHERE blueprint_count=1 AND contract_count=0)::integer,
   count(*) FILTER (WHERE blueprint_count>1)::integer,
   count(*) FILTER (WHERE blueprint_count=1 AND contract_count>1)::integer,
   count(*) FILTER (WHERE blueprint_count=1 AND contract_count=1 AND complete_count<>1)::integer
 INTO source_count,member_count,missing_count,duplicate_blueprint_count,
      duplicate_contract_count,incomplete_count FROM scoped;
 IF ARRAY[source_count,member_count,missing_count,duplicate_blueprint_count,
          duplicate_contract_count,incomplete_count]
      <>ARRAY[1728,1359,101,189,13,66]
 THEN RAISE EXCEPTION 'fixture population mismatch: %',ARRAY[source_count,
   member_count,missing_count,duplicate_blueprint_count,duplicate_contract_count,incomplete_count]; END IF;
 IF (SELECT count(*) FROM framework_screen_blueprint WHERE process_code='PILOT')<>2
 THEN RAISE EXCEPTION 'pilot actor fixture mismatch'; END IF;
END $$;
SQL

db -f "$DESIGN" >/dev/null
db -f "$ENDPOINT" >/dev/null

# Capture every source byte and tuple version before the overlay migration.
db -At -F $'\x1f' >"$WORK/source-before-legacy.txt" <<'SQL'
SELECT 'B',blueprint_id,xmin::text,encode(sha256(convert_to(row_to_json(b)::text,'UTF8')),'hex')
  FROM framework_screen_blueprint b WHERE process_code='LEGACY' ORDER BY blueprint_id;
SELECT 'C',contract_id,xmin::text,encode(sha256(convert_to(row_to_json(c)::text,'UTF8')),'hex')
  FROM framework_professional_screen_contract c WHERE process_code='LEGACY' ORDER BY contract_id;
SQL

db -f "$UPGRADE" >/dev/null

db >/dev/null <<'SQL'
DO $$
DECLARE c jsonb:=framework_canonical_endpoint_upgrade_coverage('LEGACY');
DECLARE global_readiness jsonb;
DECLARE global_design_source_failure boolean:=false;
DECLARE returned_state text;
BEGIN
 IF c->>'status'<>'PARTIAL' OR c->>'sourceDesignCount'<>'1728'
    OR c->>'memberCount'<>'1359' OR c->>'missingContractCount'<>'101'
    OR c->>'duplicateBlueprintCount'<>'189' OR c->>'duplicateContractCount'<>'13'
    OR c->>'incompleteLaneCount'<>'66' OR c->>'blockerCount'<>'369'
    OR c->>'coverageHash' !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'strict current-like coverage mismatch: %',c; END IF;
 IF framework_canonical_endpoint_upgrade_coverage('PILOT')->>'status'<>'COMPLETE'
    OR framework_canonical_endpoint_upgrade_coverage('PILOT')->>'memberCount'<>'2'
 THEN RAISE EXCEPTION 'pilot coverage mismatch'; END IF;
 -- Existing one-argument compiler overloads remain callable after the
 -- effective two-argument functions are rebound.
 BEGIN
   PERFORM framework_canonical_design_catalog(5000);
 EXCEPTION WHEN others THEN
   GET STACKED DIAGNOSTICS returned_state=RETURNED_SQLSTATE;
   IF returned_state<>'P0003' THEN
     RAISE EXCEPTION 'global design source behavior changed to SQLSTATE %',returned_state;
   END IF;
   global_design_source_failure:=true;
 END;
 global_readiness:=framework_canonical_endpoint_readiness(5000);
 IF NOT global_design_source_failure OR global_readiness->>'status'<>'PARTIAL'
 THEN RAISE EXCEPTION 'global source compiler overload regressed: %',global_readiness; END IF;
END $$;
SQL

# Raw-byte compare-and-swap: an identical request is idempotent, but one extra
# whitespace byte in legacy API text invalidates the old proposal even though
# parsed JSON and the semantic source design catalog remain identical.
db -Atqc "SELECT framework_propose_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-request/v1','policy','RUNTIME_CONTEXT_ONLY_V1',
 'requestedBy','PG_TEST','requestedLimit',100,'requestedProcess','CAS'))" >"$WORK/cas-proposal-one.json"
db -Atqc "SELECT framework_propose_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-request/v1','policy','RUNTIME_CONTEXT_ONLY_V1',
 'requestedBy','PG_TEST','requestedLimit',100,'requestedProcess','CAS'))" >"$WORK/cas-proposal-idempotent.json"
CAS_PROPOSAL_1="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalId"])' "$WORK/cas-proposal-one.json")"
CAS_HASH_1="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalHash"])' "$WORK/cas-proposal-one.json")"
python3 - "$WORK/cas-proposal-one.json" "$WORK/cas-proposal-idempotent.json" <<'PY'
import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
assert a['proposalId']==b['proposalId'] and a['proposalHash']==b['proposalHash'],(a,b)
PY
db -c "UPDATE framework_professional_screen_contract SET api_contract='[  { \"legacy\" : \"cas-api\" } ]' WHERE process_code='CAS'" >/dev/null
db >/dev/null <<SQL
DO \$\$
DECLARE rejected boolean:=false; state text; before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM framework_canonical_endpoint_upgrade_validation
  WHERE proposal_id=$CAS_PROPOSAL_1;
 BEGIN
   PERFORM framework_validate_canonical_endpoint_upgrade(jsonb_build_object(
    'schema','carbonet.endpoint-upgrade-validation-request/v1',
    'proposalId',$CAS_PROPOSAL_1,'expectedProposalHash','$CAS_HASH_1','validatedBy','PG_TEST'));
 EXCEPTION WHEN SQLSTATE '40001' THEN
   rejected:=true;
 WHEN others THEN
   GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE;
   RAISE EXCEPTION 'raw stale CAS returned SQLSTATE %',state;
 END;
 SELECT count(*) INTO after_count FROM framework_canonical_endpoint_upgrade_validation
  WHERE proposal_id=$CAS_PROPOSAL_1;
 IF NOT rejected OR before_count<>after_count THEN
   RAISE EXCEPTION 'raw stale CAS wrote validation rows: % -> %',before_count,after_count;
 END IF;
END \$\$;
SQL
db -Atqc "SELECT framework_propose_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-request/v1','policy','RUNTIME_CONTEXT_ONLY_V1',
 'requestedBy','PG_TEST','requestedLimit',100,'requestedProcess','CAS'))" >"$WORK/cas-proposal-two.json"
python3 - "$WORK/cas-proposal-one.json" "$WORK/cas-proposal-two.json" <<'PY'
import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
assert a['proposalId']!=b['proposalId'] and a['proposalHash']!=b['proposalHash'],(a,b)
assert a['sourceDesignCatalogHash']==b['sourceDesignCatalogHash']
assert a['sourceDesignCatalogTextHash']==b['sourceDesignCatalogTextHash']
assert a['proposalCatalogHash']!=b['proposalCatalogHash']
PY

# Propose/validate/publish PARTIAL. Selected members are valid; excluded source
# debt stays in coverage and must not be reclassified as validation failure.
db -Atqc "SELECT framework_propose_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-request/v1','policy','RUNTIME_CONTEXT_ONLY_V1',
 'requestedBy','PG_TEST','requestedLimit',5000,'requestedProcess','LEGACY'))" >"$WORK/legacy-proposal.json"
LEGACY_PROPOSAL_ID="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalId"])' "$WORK/legacy-proposal.json")"
LEGACY_PROPOSAL_HASH="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalHash"])' "$WORK/legacy-proposal.json")"
db -Atqc "SELECT framework_validate_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-validation-request/v1','proposalId',$LEGACY_PROPOSAL_ID,
 'expectedProposalHash','$LEGACY_PROPOSAL_HASH','validatedBy','PG_TEST'))" >"$WORK/legacy-validation.json"
LEGACY_VALIDATION_HASH="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["validationHash"])' "$WORK/legacy-validation.json")"
python3 - "$WORK/legacy-validation.json" <<'PY'
import json,sys
v=json.load(open(sys.argv[1]))
assert v['status']=='VALIDATED' and v['readyCount']==1359 and v['blockerCount']==0,v
PY
db -Atqc "SELECT framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$LEGACY_PROPOSAL_ID,
 'expectedProposalHash','$LEGACY_PROPOSAL_HASH','expectedValidationHash','$LEGACY_VALIDATION_HASH',
 'idempotencyKey','legacy-publish-1','publishedBy','PG_TEST'))" >"$WORK/legacy-release.json"
LEGACY_RELEASE_ID="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["releaseId"])' "$WORK/legacy-release.json")"
python3 - "$WORK/legacy-release.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
assert r['status']=='PUBLISHED' and r['coverageStatus']=='PARTIAL' and r['eligibility']=='VALIDATED_ONLY',r
PY
db >/dev/null <<SQL
DO \$\$
DECLARE denied_proposal boolean:=false; denied_validation boolean:=false;
DECLARE state text; before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM framework_canonical_endpoint_upgrade_release;
 BEGIN
  PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$LEGACY_PROPOSAL_ID,
   'expectedProposalHash',repeat('1',64)::numeric,
   'expectedValidationHash','$LEGACY_VALIDATION_HASH',
   'idempotencyKey','numeric-proposal-hash','publishedBy','PG_TEST'));
 EXCEPTION WHEN others THEN
  GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE;
  IF state<>'22023' THEN RAISE EXCEPTION 'numeric proposal hash returned SQLSTATE %',state; END IF;
  denied_proposal:=true;
 END;
 BEGIN
  PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$LEGACY_PROPOSAL_ID,
   'expectedProposalHash','$LEGACY_PROPOSAL_HASH',
   'expectedValidationHash',repeat('1',64)::numeric,
   'idempotencyKey','numeric-validation-hash','publishedBy','PG_TEST'));
 EXCEPTION WHEN others THEN
  GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE;
  IF state<>'22023' THEN RAISE EXCEPTION 'numeric validation hash returned SQLSTATE %',state; END IF;
  denied_validation:=true;
 END;
 SELECT count(*) INTO after_count FROM framework_canonical_endpoint_upgrade_release;
 IF NOT denied_proposal OR NOT denied_validation OR before_count<>after_count THEN
  RAISE EXCEPTION 'numeric publish hash type gate escaped: %, %, % -> %',
   denied_proposal,denied_validation,before_count,after_count;
 END IF;
END \$\$;
SQL

# Export schema, raw/parsed lineage, hash-bound membership, verifier and actual
# Spring generator all run against the database-produced immutable envelope.
db -Atqc "BEGIN READ ONLY; SELECT framework_canonical_endpoint_upgrade_export($LEGACY_RELEASE_ID,5000,'LEGACY'); COMMIT" >"$WORK/legacy-export.json"
python3 - "$WORK/legacy-export.json" <<'PY'
import hashlib,json,sys
x=json.load(open(sys.argv[1])); us='\x1f'
assert set(x)=={'schemaVersion','source','coverage','members','catalog','proposals','validations','release'}
assert set(x['source'])=={'scopeProcess','sourceDesignCatalogText','sourceDesignCatalogTextHash','sourceDesignCatalogHash','sourceDesignCount','policyText','policyHash'}
assert len(x['members'])==1359 and x['validations'][0]['status']=='VALIDATED'
assert x['validations'][0]['readyCount']==1359 and x['validations'][0]['blockerCount']==0
assert x['catalog']['catalogHash']==x['proposals'][0]['proposalCatalogHash']==x['release']['proposalCatalogHash']
assert x['catalog']['catalogHash']!=hashlib.sha256(x['proposals'][0]['proposalHash'].encode()).hexdigest()
expected_member={'ordinal','sourceContractId','processCode','stepCode','screenKey','sourceDesignHash','sourceApiRawText','sourceApiRawHash','sourceApiParsedCanonicalText','sourceApiParsedHash','sourceDatabaseRawText','sourceDatabaseRawHash','sourceDatabaseParsedCanonicalText','sourceDatabaseParsedHash','projectedDesignCanonicalText','projectedDesignHash','endpointCanonicalText','endpointHash','operation','memberHash'}
assert set(x['members'][0])==expected_member
m=x['members'][0]
assert m['sourceApiRawText']!=m['sourceApiParsedCanonicalText']
assert hashlib.sha256(m['sourceApiRawText'].encode()).hexdigest()==m['sourceApiRawHash']
assert hashlib.sha256(m['sourceApiParsedCanonicalText'].encode()).hexdigest()==m['sourceApiParsedHash']
assert len(x['release'])==15 and set(x['release']['evidence'])=={'accountRelay','businessE2E','visualQA'}
assert x['coverage']['sourceDesignCount']==len(x['members'])+x['coverage']['blockerCount']==1728
PY
python3 "$VERIFIER" --check "$WORK/legacy-export.json" >/dev/null
python3 - "$WORK/legacy-export.json" "$WORK/legacy-wrong-proposal-catalog.json" <<'PY'
import copy,hashlib,json,sys
x=json.load(open(sys.argv[1])); bad=copy.deepcopy(x)
wrong=hashlib.sha256(x['proposals'][0]['proposalHash'].encode()).hexdigest()
bad['proposals'][0]['proposalCatalogHash']=wrong
bad['release']['proposalCatalogHash']=wrong
json.dump(bad,open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
PY
if python3 "$VERIFIER" --check "$WORK/legacy-wrong-proposal-catalog.json" >/dev/null 2>&1; then
  fail 'verifier accepted sha256(proposalHash) as proposalCatalogHash'
fi
python3 - "$WORK/legacy-export.json" "$WORK/legacy-endpoint.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1])); json.dump(x['catalog']['endpoint'],open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
PY
python3 "$GENERATOR" "$WORK/legacy-endpoint.json" --out "$WORK/generated-legacy" --workers 16 --check >/dev/null
db >/dev/null <<SQL
DO \$\$
DECLARE denied boolean:=false; unfiltered jsonb;
BEGIN
 unfiltered:=framework_canonical_endpoint_upgrade_export($LEGACY_RELEASE_ID,5000);
 IF unfiltered#>>'{coverage,status}'<>'PARTIAL'
    OR unfiltered#>>'{coverage,sourceDesignCount}'<>'1728'
 THEN RAISE EXCEPTION 'unfiltered export hid proposal coverage'; END IF;
 BEGIN
   PERFORM framework_canonical_endpoint_upgrade_export(
     $LEGACY_RELEASE_ID,5000,'PILOT');
 EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'cross-process export selector escaped'; END IF;
END \$\$;
SQL

# A global '*' release is never a safe activation unit because it can override
# unrelated process routes atomically. The current fixture is PARTIAL globally;
# the static function contract additionally proves exact-process enforcement is
# present independent of eligibility ordering.
db >/dev/null <<'SQL'
DO $$
DECLARE activation_definition text:=pg_get_functiondef(
  'framework_activate_canonical_endpoint_upgrade(jsonb)'::regprocedure);
BEGIN
 IF position('scope_process' IN activation_definition)=0
    OR position($needle$='*'$needle$ IN activation_definition)=0
 THEN RAISE EXCEPTION 'global scope activation rejection is absent'; END IF;
END $$;
SQL

# PARTIAL never activates. Stale compare-and-swap and idempotency collisions
# must be closed before any active marker exists.
db >/dev/null <<SQL
DO \$\$
DECLARE denied boolean:=false; idem boolean:=false;
BEGIN
 BEGIN PERFORM framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$LEGACY_RELEASE_ID,
   'idempotencyKey','legacy-activate','activatedBy','PG_TEST'));
 EXCEPTION WHEN others THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'PARTIAL release activation escaped'; END IF;
 denied:=false;
 BEGIN PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$LEGACY_PROPOSAL_ID,
   'expectedProposalHash',repeat('0',64),'expectedValidationHash','$LEGACY_VALIDATION_HASH',
   'idempotencyKey','legacy-publish-stale','publishedBy','PG_TEST'));
 EXCEPTION WHEN others THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'stale proposal CAS escaped'; END IF;
 BEGIN PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$LEGACY_PROPOSAL_ID,
   'expectedProposalHash','$LEGACY_PROPOSAL_HASH','expectedValidationHash','$LEGACY_VALIDATION_HASH',
   'idempotencyKey','legacy-publish-1','publishedBy','DIFFERENT_ACTOR'));
 EXCEPTION WHEN others THEN idem:=true; END;
 IF NOT idem THEN RAISE EXCEPTION 'idempotency payload collision escaped'; END IF;
END \$\$;
SQL

make_pilot_release() {
  local suffix="$1" proposal validation release
  db -Atqc "SELECT framework_propose_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-request/v1','policy','RUNTIME_CONTEXT_ONLY_V1',
   'requestedBy','PG_TEST','requestedLimit',100,'requestedProcess','PILOT'))" >"$WORK/pilot-proposal-$suffix.json"
  proposal="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalId"])' "$WORK/pilot-proposal-$suffix.json")"
  local proposal_hash="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalHash"])' "$WORK/pilot-proposal-$suffix.json")"
  db -Atqc "SELECT framework_validate_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-validation-request/v1','proposalId',$proposal,
   'expectedProposalHash','$proposal_hash','validatedBy','PG_TEST'))" >"$WORK/pilot-validation-$suffix.json"
  validation="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["validationId"])' "$WORK/pilot-validation-$suffix.json")"
  local validation_hash="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["validationHash"])' "$WORK/pilot-validation-$suffix.json")"
  # Publishing a COMPLETE proposal before all three delivery proofs would make
  # the immutable unique proposal release impossible to promote later.
  db >/dev/null <<SQL
DO \$\$
DECLARE denied boolean:=false; state text; before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM framework_canonical_endpoint_upgrade_release
  WHERE proposal_id=$proposal;
 BEGIN
   PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
    'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$proposal,
    'expectedProposalHash','$proposal_hash','expectedValidationHash','$validation_hash',
    'idempotencyKey','pilot-premature-$suffix','publishedBy','PG_TEST'));
 EXCEPTION WHEN others THEN
   GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE;
   IF state<>'55000' THEN RAISE EXCEPTION 'premature publish returned SQLSTATE %',state; END IF;
   denied:=true;
 END;
 SELECT count(*) INTO after_count FROM framework_canonical_endpoint_upgrade_release
  WHERE proposal_id=$proposal;
 IF NOT denied OR before_count<>0 OR after_count<>0 THEN
   RAISE EXCEPTION 'premature publish persisted immutable dead-end: % -> %',before_count,after_count;
 END IF;
END \$\$;
SQL
  for evidence in ACCOUNT_RELAY BUSINESS_E2E VISUAL_QA; do
    local evidence_hash="$(printf '%s-%s' "$suffix" "$evidence" | sha256sum | cut -d' ' -f1)"
    db -Atqc "SELECT framework_record_canonical_endpoint_upgrade_evidence(jsonb_build_object(
     'schema','carbonet.endpoint-upgrade-evidence-request/v1','proposalId',$proposal,
     'validationId',$validation,'evidenceKind','$evidence','evidenceHash','$evidence_hash',
     'recordedBy','PG_TEST'))" >/dev/null
  done
  db -Atqc "SELECT framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$proposal,
   'expectedProposalHash','$proposal_hash','expectedValidationHash','$validation_hash',
   'idempotencyKey','pilot-publish-$suffix','publishedBy','PG_TEST'))" >"$WORK/pilot-release-$suffix.json"
  release="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["releaseId"])' "$WORK/pilot-release-$suffix.json")"
  python3 - "$WORK/pilot-release-$suffix.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1])); assert r['status']=='PUBLISHED' and r['coverageStatus']=='COMPLETE' and r['eligibility']=='PUBLISHABLE',r
PY
  printf '%s\n' "$release"
}

PILOT_RELEASE_1="$(make_pilot_release one)"
# Once a release exists, its idempotency record is authoritative even if raw
# source bytes drift. Exact retry returns the same immutable response/write-zero;
# actor or expected-hash drift under that key is a 23505 payload conflict.
PILOT_PROPOSAL_1="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalId"])' "$WORK/pilot-proposal-one.json")"
PILOT_PROPOSAL_HASH_1="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proposalHash"])' "$WORK/pilot-release-one.json")"
PILOT_VALIDATION_HASH_1="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["validationHash"])' "$WORK/pilot-release-one.json")"
PILOT_RELEASE_COUNT_1="$(scalar 'SELECT count(*) FROM framework_canonical_endpoint_upgrade_release')"
db -c "UPDATE framework_professional_screen_contract SET api_contract=' '||api_contract WHERE process_code='PILOT'" >/dev/null
db -Atqc "SELECT framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$PILOT_PROPOSAL_1,
 'expectedProposalHash','$PILOT_PROPOSAL_HASH_1','expectedValidationHash','$PILOT_VALIDATION_HASH_1',
 'idempotencyKey','pilot-publish-one','publishedBy','PG_TEST'))" >"$WORK/pilot-release-one-retry.json"
cmp "$WORK/pilot-release-one.json" "$WORK/pilot-release-one-retry.json" >/dev/null || fail 'publish exact retry result drifted after raw source drift'
[[ "$(scalar 'SELECT count(*) FROM framework_canonical_endpoint_upgrade_release')" == "$PILOT_RELEASE_COUNT_1" ]] || fail 'publish exact retry wrote a release'
db >/dev/null <<SQL
DO \$\$
DECLARE denied_actor boolean:=false; denied_proposal_hash boolean:=false;
DECLARE denied_validation_hash boolean:=false; before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM framework_canonical_endpoint_upgrade_release;
 BEGIN
  PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$PILOT_PROPOSAL_1,
   'expectedProposalHash','$PILOT_PROPOSAL_HASH_1',
   'expectedValidationHash','$PILOT_VALIDATION_HASH_1',
   'idempotencyKey','pilot-publish-one','publishedBy','DRIFTED_ACTOR'));
 EXCEPTION WHEN unique_violation THEN denied_actor:=true; END;
 BEGIN
  PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$PILOT_PROPOSAL_1,
   'expectedProposalHash',repeat('0',64),
   'expectedValidationHash','$PILOT_VALIDATION_HASH_1',
   'idempotencyKey','pilot-publish-one','publishedBy','PG_TEST'));
 EXCEPTION WHEN unique_violation THEN denied_proposal_hash:=true; END;
 BEGIN
  PERFORM framework_publish_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-publish-request/v1','proposalId',$PILOT_PROPOSAL_1,
   'expectedProposalHash','$PILOT_PROPOSAL_HASH_1',
   'expectedValidationHash',repeat('0',64),
   'idempotencyKey','pilot-publish-one','publishedBy','PG_TEST'));
 EXCEPTION WHEN unique_violation THEN denied_validation_hash:=true; END;
 SELECT count(*) INTO after_count FROM framework_canonical_endpoint_upgrade_release;
 IF NOT denied_actor OR NOT denied_proposal_hash OR NOT denied_validation_hash
    OR before_count<>after_count THEN
   RAISE EXCEPTION 'publish idempotency drift escaped: actor=%, proposalHash=%, validationHash=%, % -> %',
    denied_actor,denied_proposal_hash,denied_validation_hash,before_count,after_count;
 END IF;
END \$\$;
SQL
db -Atqc "SELECT framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$PILOT_RELEASE_1,
 'idempotencyKey','pilot-activate-one','activatedBy','PG_TEST'))" >"$WORK/pilot-active-one.json"
# Exact retry returns the immutable original event and writes zero. Actor drift
# under the same key is a payload conflict even when releaseId is unchanged.
PILOT_EVENT_COUNT_1="$(scalar 'SELECT count(*) FROM framework_canonical_endpoint_upgrade_activation_event')"
db -Atqc "SELECT framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$PILOT_RELEASE_1,
 'idempotencyKey','pilot-activate-one','activatedBy','PG_TEST'))" >"$WORK/pilot-active-one-retry.json"
cmp "$WORK/pilot-active-one.json" "$WORK/pilot-active-one-retry.json" >/dev/null || fail 'activation exact retry result drifted'
[[ "$(scalar 'SELECT count(*) FROM framework_canonical_endpoint_upgrade_activation_event')" == "$PILOT_EVENT_COUNT_1" ]] || fail 'activation exact retry wrote an event'
db >/dev/null <<SQL
DO \$\$
DECLARE denied boolean:=false; before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM framework_canonical_endpoint_upgrade_activation_event;
 BEGIN
  PERFORM framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$PILOT_RELEASE_1,
   'idempotencyKey','pilot-activate-one','activatedBy','DRIFTED_ACTOR'));
 EXCEPTION WHEN unique_violation THEN denied:=true; END;
 SELECT count(*) INTO after_count FROM framework_canonical_endpoint_upgrade_activation_event;
 IF NOT denied OR before_count<>after_count THEN
   RAISE EXCEPTION 'activation actor idempotency drift escaped: % -> %',before_count,after_count;
 END IF;
END \$\$;
SQL
PILOT_ACTIVE_HASH_1="$(scalar "SELECT payload_hash FROM framework_canonical_endpoint_upgrade_activation_event ORDER BY activation_event_id DESC LIMIT 1")"
db -Atqc "SELECT framework_canonical_endpoint_upgrade_export($PILOT_RELEASE_1,100,'PILOT')" >"$WORK/pilot-export-active-one.json"
python3 "$VERIFIER" --check --require-publishable "$WORK/pilot-export-active-one.json" >/dev/null
PILOT_ACTIVE_DESIGN_HASH_1="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["catalog"]["design"]["catalogHash"])' "$WORK/pilot-export-active-one.json")"
PILOT_SOURCE_HASH_1="$(scalar "SELECT (framework_strict_legacy_design_catalog(100,'PILOT')->>'catalogHash')")"
python3 - "$WORK/pilot-release-one.json" "$WORK/pilot-export-active-one.json" "$PILOT_ACTIVE_HASH_1" <<'PY'
import json,sys
published=json.load(open(sys.argv[1])); active=json.load(open(sys.argv[2]))
assert active['release']['status']=='ACTIVE' and active['release']['eligibility']=='PUBLISHABLE'
assert active['release']['releaseHash']!=published['releaseHash'],('published-active-hash-collision',published,active['release'],sys.argv[3])
assert active['release']['releaseHash']==sys.argv[3],('active-event-export-mismatch',published,active['release'],sys.argv[3])
PY
db >/dev/null <<SQL
DO \$\$
DECLARE b jsonb:=framework_canonical_endpoint_effective_binding('PILOT');
DECLARE d jsonb:=framework_canonical_design_catalog(100,'PILOT');
DECLARE e jsonb:=framework_canonical_endpoint_catalog(100,'PILOT');
DECLARE r jsonb:=framework_canonical_endpoint_readiness(100,'PILOT');
BEGIN
 IF b->>'status'<>'ACTIVE' OR b->>'releaseId'<>'$PILOT_RELEASE_1'
    OR b->>'eligibility'<>'PUBLISHABLE' OR r->>'status'<>'COMPLETE'
    OR b->>'processCode'<>'PILOT'
    OR b->>'designCatalogHash'<>d->>'catalogHash'
    OR b->>'endpointCatalogHash'<>e->>'catalogHash'
 THEN RAISE EXCEPTION 'effective compiler binding mismatch: % %',b,r; END IF;
END \$\$;
SQL

# Produce two more immutable sources/proposals, race releases 2 and 3, then
# explicitly rollback to release 1. Both racers differ from current release 1,
# so lock ordering cannot turn either valid request into a self-activation.
db -c "UPDATE framework_professional_screen_contract SET business_purpose=business_purpose||' v2' WHERE process_code='PILOT'" >/dev/null
PILOT_RELEASE_2="$(make_pilot_release two)"
db -c "UPDATE framework_professional_screen_contract SET business_purpose=business_purpose||' v3' WHERE process_code='PILOT'" >/dev/null
PILOT_MUTABLE_SOURCE_HASH="$(scalar "SELECT (framework_strict_legacy_design_catalog(100,'PILOT')->>'catalogHash')")"
PILOT_RELEASE_3="$(make_pilot_release three)"
# A prior activation key cannot be rebound to another release target.
db >/dev/null <<SQL
DO \$\$
DECLARE denied boolean:=false; before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM framework_canonical_endpoint_upgrade_activation_event;
 BEGIN
  PERFORM framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$PILOT_RELEASE_2,
   'idempotencyKey','pilot-activate-one','activatedBy','PG_TEST'));
 EXCEPTION WHEN unique_violation THEN denied:=true; END;
 SELECT count(*) INTO after_count FROM framework_canonical_endpoint_upgrade_activation_event;
 IF NOT denied OR before_count<>after_count THEN
   RAISE EXCEPTION 'activation target idempotency drift escaped: % -> %',before_count,after_count;
 END IF;
END \$\$;
SQL
# Advisory locking must serialize both; every non-first event's
# previous_release_id equals the immediately preceding event's release_id.
db -Atqc "SELECT framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$PILOT_RELEASE_2,
 'idempotencyKey','pilot-activate-two','activatedBy','PG_TEST_RACE_A'))" >"$WORK/pilot-active-two.json" &
RACE_PID_A=$!
db -Atqc "SELECT framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$PILOT_RELEASE_3,
 'idempotencyKey','pilot-activate-three','activatedBy','PG_TEST_RACE_B'))" >"$WORK/pilot-active-three.json" &
RACE_PID_B=$!
RACE_RC_A=0; RACE_RC_B=0
wait "$RACE_PID_A" || RACE_RC_A=$?
wait "$RACE_PID_B" || RACE_RC_B=$?
(( RACE_RC_A==0 && RACE_RC_B==0 )) || fail "parallel activation failed: $RACE_RC_A/$RACE_RC_B"
db >/dev/null <<'SQL'
DO $$
DECLARE broken integer;
BEGIN
 WITH ordered AS (
   SELECT activation_event_id,release_id,previous_release_id,
          lag(release_id) OVER (ORDER BY activation_event_id) predecessor
     FROM framework_canonical_endpoint_upgrade_activation_event
    WHERE scope_process='PILOT'
 )
 SELECT count(*) INTO broken FROM ordered
  WHERE predecessor IS NOT NULL AND previous_release_id IS DISTINCT FROM predecessor;
 IF broken<>0 THEN RAISE EXCEPTION 'parallel activation chain is broken: %',broken; END IF;
END $$;
SQL
# Ensure release 2 is current before exercising an explicit rollback to 1.
if [[ "$(scalar "SELECT framework_canonical_endpoint_effective_binding('PILOT')->>'releaseId'")" != "$PILOT_RELEASE_2" ]]; then
  db -Atqc "SELECT framework_activate_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-activation-request/v1','releaseId',$PILOT_RELEASE_2,
   'idempotencyKey','pilot-activate-two-final','activatedBy','PG_TEST'))" >"$WORK/pilot-active-two-final.json"
fi
[[ "$(scalar "SELECT framework_canonical_endpoint_effective_binding('PILOT')->>'releaseId'")" == "$PILOT_RELEASE_2" ]] || fail 'second activation missing'
db -Atqc "SELECT framework_rollback_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-rollback-request/v1','releaseId',$PILOT_RELEASE_1,
 'idempotencyKey','pilot-rollback-one','activatedBy','PG_TEST'))" >"$WORK/pilot-rollback.json"
# Rollback retries have the same payload-binding semantics as activation.
PILOT_EVENT_COUNT_ROLLBACK="$(scalar 'SELECT count(*) FROM framework_canonical_endpoint_upgrade_activation_event')"
db -Atqc "SELECT framework_rollback_canonical_endpoint_upgrade(jsonb_build_object(
 'schema','carbonet.endpoint-upgrade-rollback-request/v1','releaseId',$PILOT_RELEASE_1,
 'idempotencyKey','pilot-rollback-one','activatedBy','PG_TEST'))" >"$WORK/pilot-rollback-retry.json"
cmp "$WORK/pilot-rollback.json" "$WORK/pilot-rollback-retry.json" >/dev/null || fail 'rollback exact retry result drifted'
[[ "$(scalar 'SELECT count(*) FROM framework_canonical_endpoint_upgrade_activation_event')" == "$PILOT_EVENT_COUNT_ROLLBACK" ]] || fail 'rollback exact retry wrote an event'
db >/dev/null <<SQL
DO \$\$
DECLARE denied_actor boolean:=false; denied_target boolean:=false;
DECLARE before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM framework_canonical_endpoint_upgrade_activation_event;
 BEGIN
  PERFORM framework_rollback_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-rollback-request/v1','releaseId',$PILOT_RELEASE_1,
   'idempotencyKey','pilot-rollback-one','activatedBy','DRIFTED_ACTOR'));
 EXCEPTION WHEN unique_violation THEN denied_actor:=true; END;
 BEGIN
  PERFORM framework_rollback_canonical_endpoint_upgrade(jsonb_build_object(
   'schema','carbonet.endpoint-upgrade-rollback-request/v1','releaseId',$PILOT_RELEASE_2,
   'idempotencyKey','pilot-rollback-one','activatedBy','PG_TEST'));
 EXCEPTION WHEN unique_violation THEN denied_target:=true; END;
 SELECT count(*) INTO after_count FROM framework_canonical_endpoint_upgrade_activation_event;
 IF NOT denied_actor OR NOT denied_target OR before_count<>after_count THEN
   RAISE EXCEPTION 'rollback idempotency drift escaped: actor=%, target=%, % -> %',
     denied_actor,denied_target,before_count,after_count;
 END IF;
END \$\$;
SQL
PILOT_ROLLBACK_HASH="$(scalar "SELECT payload_hash FROM framework_canonical_endpoint_upgrade_activation_event ORDER BY activation_event_id DESC LIMIT 1")"
db -Atqc "SELECT framework_canonical_endpoint_upgrade_export($PILOT_RELEASE_1,100,'PILOT')" >"$WORK/pilot-export-rollback.json"
python3 - "$WORK/pilot-rollback.json" "$WORK/pilot-export-rollback.json" "$PILOT_ACTIVE_HASH_1" "$PILOT_ROLLBACK_HASH" <<'PY'
import json,sys
r=json.load(open(sys.argv[1])); active=json.load(open(sys.argv[2]))
assert r['action']=='ROLLBACK' and r['status']=='ACTIVE' and r['releaseId']!=r['previousReleaseId'],r
assert sys.argv[3]==sys.argv[4] and active['release']['releaseHash']==sys.argv[4],('rollback-hash-mismatch',r,active['release'],sys.argv[3],sys.argv[4])
PY
[[ "$(scalar "SELECT framework_canonical_endpoint_effective_binding('PILOT')->>'releaseId'")" == "$PILOT_RELEASE_1" ]] || fail 'rollback did not restore release 1'
[[ "$(scalar "SELECT scope_process FROM framework_canonical_endpoint_upgrade_activation_event ORDER BY activation_event_id DESC LIMIT 1")" == 'PILOT' ]] || fail 'activation event scope is not exact PILOT'
[[ "$PILOT_SOURCE_HASH_1" != "$PILOT_MUTABLE_SOURCE_HASH" ]] || fail 'pilot mutable source did not change across immutable releases'
[[ "$(scalar "SELECT framework_canonical_design_catalog(100,'PILOT')->>'catalogHash'")" == "$PILOT_ACTIVE_DESIGN_HASH_1" ]] || fail 'rollback did not restore release 1 design catalog'

# Release snapshots and evidence are append-only; source rows are not writable
# by the app role. Direct table reads and sequences are also denied.
db >/dev/null <<'SQL'
DO $$
DECLARE denied integer:=0;
BEGIN
 BEGIN UPDATE framework_canonical_endpoint_upgrade_proposal SET proposed_by='X'; EXCEPTION WHEN others THEN denied:=denied+1; END;
 BEGIN DELETE FROM framework_canonical_endpoint_upgrade_member; EXCEPTION WHEN others THEN denied:=denied+1; END;
 BEGIN UPDATE framework_canonical_endpoint_upgrade_validation SET validated_by='X'; EXCEPTION WHEN others THEN denied:=denied+1; END;
 BEGIN DELETE FROM framework_canonical_endpoint_upgrade_release; EXCEPTION WHEN others THEN denied:=denied+1; END;
 BEGIN UPDATE framework_canonical_endpoint_upgrade_release_member SET ordinal=ordinal; EXCEPTION WHEN others THEN denied:=denied+1; END;
 BEGIN DELETE FROM framework_canonical_endpoint_upgrade_delivery_evidence; EXCEPTION WHEN others THEN denied:=denied+1; END;
 BEGIN UPDATE framework_canonical_endpoint_upgrade_activation_event SET activated_by='X'; EXCEPTION WHEN others THEN denied:=denied+1; END;
 IF denied<>7 THEN RAISE EXCEPTION 'append-only gates missing: %/7',denied; END IF;
END $$;
SET ROLE carbonet_app;
DO $$ DECLARE denied integer:=0; alias_denied integer:=0;
 active_binding jsonb; source_binding jsonb; BEGIN
 BEGIN PERFORM count(*) FROM framework_canonical_endpoint_upgrade_release; EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 BEGIN PERFORM nextval('framework_canonical_endpoint_upgrade_release_release_id_seq'); EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 BEGIN UPDATE framework_professional_screen_contract SET business_purpose='X'; EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 IF denied<>3 THEN RAISE EXCEPTION 'ACL gates missing: %/3',denied; END IF;
 BEGIN PERFORM framework_source_canonical_design_catalog(100,'PILOT'); EXCEPTION WHEN insufficient_privilege THEN alias_denied:=alias_denied+1; END;
 BEGIN PERFORM framework_source_canonical_endpoint_readiness(100,'PILOT'); EXCEPTION WHEN insufficient_privilege THEN alias_denied:=alias_denied+1; END;
 BEGIN PERFORM framework_source_canonical_endpoint_catalog(100,'PILOT'); EXCEPTION WHEN insufficient_privilege THEN alias_denied:=alias_denied+1; END;
 IF alias_denied<>3 THEN RAISE EXCEPTION 'internal source alias EXECUTE ACL missing: %/3',alias_denied; END IF;
 active_binding:=framework_canonical_endpoint_effective_binding('PILOT');
 source_binding:=framework_canonical_endpoint_effective_binding('CAS');
 IF active_binding->>'status'<>'ACTIVE' OR active_binding->>'processCode'<>'PILOT'
    OR source_binding->>'status'<>'SOURCE' OR source_binding->>'processCode'<>'CAS'
    OR framework_canonical_endpoint_readiness(100,'PILOT')->>'status'<>'COMPLETE'
    OR framework_canonical_design_catalog(100,'PILOT')->>'screenCount'<>'2'
    OR jsonb_array_length(framework_canonical_endpoint_catalog(100,'PILOT')->'endpoints')<>2
 THEN RAISE EXCEPTION 'app effective compiler ACL path failed: % %',active_binding,source_binding; END IF;
END $$;
RESET ROLE;
SET ROLE upgrade_auditor;
DO $$ DECLARE denied integer:=0; BEGIN
 BEGIN PERFORM framework_canonical_design_catalog(100,'PILOT'); EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 BEGIN PERFORM framework_canonical_endpoint_readiness(100,'PILOT'); EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 BEGIN PERFORM framework_canonical_endpoint_catalog(100,'PILOT'); EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 IF denied<>3 THEN RAISE EXCEPTION 'PUBLIC effective wrapper EXECUTE ACL missing: %/3',denied; END IF;
END $$;
RESET ROLE;
SQL

# The legacy source never changed throughout all overlay operations. PILOT was
# intentionally mutated once to create release 2, so compare LEGACY bytes/xmin.
db -At -F $'\x1f' >"$WORK/source-after.txt" <<'SQL'
SELECT 'B',blueprint_id,xmin::text,encode(sha256(convert_to(row_to_json(b)::text,'UTF8')),'hex')
  FROM framework_screen_blueprint b WHERE process_code='LEGACY' ORDER BY blueprint_id;
SELECT 'C',contract_id,xmin::text,encode(sha256(convert_to(row_to_json(c)::text,'UTF8')),'hex')
  FROM framework_professional_screen_contract c WHERE process_code='LEGACY' ORDER BY contract_id;
SQL
cmp "$WORK/source-before-legacy.txt" "$WORK/source-after.txt" >/dev/null || fail 'legacy source bytes/xmin changed'

elapsed_ms="$(( ($(date +%s%N)-START_NS)/1000000 ))"
printf '{"success":true,"postgres":16,"sourceDesignCount":1728,"selectedMembers":1359,"excluded":369,"missing":101,"duplicateBlueprintRows":189,"duplicateContractRows":13,"incompleteLanes":66,"pilotActors":2,"immutableReleases":4,"activationSwitchesMin":4,"parallelActivations":2,"idempotencyRetries":3,"idempotencyDriftsRejected":7,"numericHashTypesRejected":2,"sourceAliasAclDenied":3,"publicEffectiveAclDenied":3,"verifierRuns":2,"generatorChecks":1,"liveWrites":0,"elapsedMs":%s}\n' "$elapsed_ms"
