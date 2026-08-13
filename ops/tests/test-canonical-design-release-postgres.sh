#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260813093000__compile_canonical_screen_design_release.sql"
IMAGE="${CANONICAL_DESIGN_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER_ID="codex-canonical-design-$RANDOM-$$"
PORT=""
PASSWORD="canonical-test-$RANDOM"
started=0

fail() { printf 'CANONICAL_DESIGN_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  set +e
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

[[ -f "$MIGRATION" ]] || fail "migration missing"
command -v psql >/dev/null || fail "psql missing"
command -v python3 >/dev/null || fail "python3 missing"
sudo -n true >/dev/null || fail "passwordless sudo required"
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" ||
  fail "cached image missing: $IMAGE"
PORT="$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(("127.0.0.1",0))
print(s.getsockname()[1])
s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=canonical \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER_ID"
started=1

psql_base=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d canonical -X)
export PGPASSWORD="$PASSWORD"
ready=0
for _ in $(seq 1 40); do
  if "${psql_base[@]}" -Atqc 'select 1' >/dev/null 2>&1; then
    sleep 1
    if "${psql_base[@]}" -Atqc 'select 1' >/dev/null 2>&1; then
      ready=1
      break
    fi
  fi
  sleep 1
done
(( ready )) || fail "postgres readiness timeout"

db() { "${psql_base[@]}" -v ON_ERROR_STOP=1 "$@"; }
db_scalar() { "${psql_base[@]}" -v ON_ERROR_STOP=1 -Atqc "$1"; }

db <<'SQL'
CREATE ROLE carbonet_app NOLOGIN;
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF source IS NULL OR btrim(source)='' THEN RETURN fallback; END IF;
 RETURN source::jsonb;
EXCEPTION WHEN others THEN RETURN jsonb_build_array(source);
END $$;
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
('PROC','Test Process','TEST','1.0.0','Complete test work','Assigned','Verified',
 10,'ACTOR','HIGH',24,'ACTIVE',now(),now());
INSERT INTO framework_process_step VALUES
('PROC','STEP',1,'Test Step','TASK','ACTOR','READY','SUBMIT','DONE',
 'Submit valid input','State DONE','{"request":"value"}','{"result":"id"}',
 true,'AUDIT_LOG','REVIEWER','REOPEN','All validations pass');
INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,generated_source_path)
VALUES('SCREEN_0001','PROC','STEP','ACTOR','USER','page-0001','Test Page 1',
 '/screen/1?legacy=1','FORM','KRDS_FORM','{"ratio":1.00,"negative":-0.0}',
 '{"requirements":["REQ-1"]}','VALID','volatile/source.tsx');
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
 command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,
 database_verified,authority_verified,responsive_verified,accessibility_verified,
 exception_states_verified,audit_evidence_ref,contract_status)
VALUES('PROC','STEP','USER','/screen/1','Test Work 1','ACTOR',
 'Complete professional test work 1','Assigned and READY','State is DONE',
 '["completion"]','[{"title":"Main work"}]','[{"name":"value"}]','["SUBMIT"]',
 '["LOADING","EMPTY","ERROR","FORBIDDEN","READY"]',
 '[{"method":"POST","path":"/api/test"}]','[{"table":"test_record"}]',
 '["AUDIT_LOG","E2E"]','360,768,1280','KRDS WCAG 2.1 AA',
 'tenant,project,actor checked server-side',true,true,true,true,true,true,
 'evidence://test','VERIFIED');
GRANT SELECT ON framework_process_definition,framework_process_step,
 framework_screen_blueprint,framework_professional_screen_contract TO carbonet_app;
SQL

db -f "$MIGRATION" >/dev/null

db <<'SQL'
DO $$
DECLARE
  before_bundle jsonb;
  metadata_bundle jsonb;
  changed_bundle jsonb;
BEGIN
  before_bundle:=framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1');
  IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(before_bundle) key)
       <>ARRAY['canonicalDesign','canonicalText','catalogHash','designHash','schema']
     OR before_bundle->>'schema'<>'carbonet.canonical-design/v1'
     OR before_bundle->>'designHash' !~ '^[0-9a-f]{64}$'
     OR before_bundle->'catalogHash'<>'null'::jsonb
     OR encode(sha256(convert_to(before_bundle->>'canonicalText','UTF8')),'hex')
          <>before_bundle->>'designHash'
     OR (before_bundle->>'canonicalText')::jsonb<>before_bundle->'canonicalDesign'
  THEN RAISE EXCEPTION 'bundle envelope/hash preimage mismatch'; END IF;
  IF (SELECT array_agg(key ORDER BY key)
        FROM jsonb_object_keys(before_bundle#>'{canonicalDesign,lanes}') key)
       <>ARRAY['API','DATABASE','DESIGN_CARD','FRONTEND','HELP','QA','WORK_GUIDE']
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,API}')<>'array'
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,DATABASE}')<>'array'
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,HELP}')<>'object'
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,WORK_GUIDE}')<>'object'
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,QA}')<>'object'
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,DESIGN_CARD}')<>'object'
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,FRONTEND}')<>'object'
  THEN RAISE EXCEPTION 'lane top-level shape mismatch'; END IF;
  IF (SELECT array_agg(key ORDER BY key)
        FROM jsonb_object_keys(before_bundle#>'{canonicalDesign,lanes,HELP,items,0}') key)
       <>ARRAY['anchorSelector','body','id','title']
     OR NOT starts_with(
          before_bundle#>>'{canonicalDesign,lanes,HELP,items,0,anchorSelector}',
          '[data-help-id="generated-page-0001-'
        )
  THEN RAISE EXCEPTION 'help item/anchor contract mismatch'; END IF;
  IF jsonb_array_length(before_bundle#>'{canonicalDesign,lanes,WORK_GUIDE,steps}')=0
     OR jsonb_typeof(before_bundle#>'{canonicalDesign,lanes,WORK_GUIDE,nextAction}')<>'object'
     OR jsonb_array_length(before_bundle#>'{canonicalDesign,lanes,QA,checks}')<>6
     OR jsonb_array_length(before_bundle#>'{canonicalDesign,lanes,QA,requiredScenarioTypes}')<>5
     OR jsonb_array_length(before_bundle#>'{canonicalDesign,lanes,DESIGN_CARD,assetBindings}')=0
     OR (SELECT array_agg(key ORDER BY key)
           FROM jsonb_object_keys(
             before_bundle#>'{canonicalDesign,lanes,DESIGN_CARD,assetBindings,0}'
           ) key)<>ARRAY['assetCode','assetType','registryKey','slot']
  THEN RAISE EXCEPTION 'work guide/QA/derived asset contract mismatch'; END IF;
  IF before_bundle::text LIKE '%generatedAt%'
     OR before_bundle::text LIKE '%createdAt%'
     OR before_bundle::text LIKE '%updatedAt%'
     OR before_bundle::text LIKE '%volatile/source.tsx%'
  THEN RAISE EXCEPTION 'volatile field leaked into canonical design'; END IF;

  UPDATE framework_screen_blueprint
     SET updated_at=updated_at+interval '1 day',
         generated_source_path='another/volatile/path.tsx'
   WHERE blueprint_code='SCREEN_0001';
  UPDATE framework_professional_screen_contract
     SET updated_at=updated_at+interval '1 day'
   WHERE route_path='/screen/1';
  metadata_bundle:=framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1');
  IF metadata_bundle->>'designHash'<>before_bundle->>'designHash'
     OR metadata_bundle->'catalogHash' IS DISTINCT FROM before_bundle->'catalogHash'
  THEN RAISE EXCEPTION 'volatile metadata changed canonical hashes'; END IF;

  UPDATE framework_professional_screen_contract
     SET business_purpose=business_purpose||' materially changed'
   WHERE route_path='/screen/1';
  changed_bundle:=framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1');
  IF changed_bundle->>'designHash'=before_bundle->>'designHash'
     OR changed_bundle->'catalogHash' IS DISTINCT FROM before_bundle->'catalogHash'
  THEN RAISE EXCEPTION 'single-screen design hash/release hash semantics mismatch'; END IF;
  UPDATE framework_professional_screen_contract
     SET business_purpose='Complete professional test work 1'
   WHERE route_path='/screen/1';
END
$$;
SQL

db <<'SQL'
INSERT INTO framework_screen_blueprint(
 blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
 route_path,screen_type,template_code,specification_json,traceability_json,
 validation_status,generated_source_path)
SELECT 'SCREEN_'||lpad(i::text,4,'0'),'PROC','STEP','ACTOR','USER',
       'page-'||lpad(i::text,4,'0'),'Test Page '||i,'/screen/'||i,
       'FORM','KRDS_FORM','{"theme":"gov"}','{"requirements":["REQ"]}',
       'VALID','volatile/'||i||'.tsx'
  FROM generate_series(2,1728) i;
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
 command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,
 database_verified,authority_verified,responsive_verified,accessibility_verified,
 exception_states_verified,audit_evidence_ref,contract_status)
SELECT 'PROC','STEP','USER','/screen/'||i,'Test Work '||i,'ACTOR',
       'Complete professional test work '||i,'Assigned and READY','State is DONE',
       '["completion"]','[{"title":"Main work"}]',
       CASE WHEN i=1428 THEN '[]' ELSE '[{"name":"value"}]' END,
       '["SUBMIT"]','["LOADING","EMPTY","ERROR","FORBIDDEN","READY"]',
       '[{"method":"POST","path":"/api/test"}]',
       CASE WHEN i BETWEEN 1429 AND 1530 THEN '[]'
            ELSE '[{"table":"test_record"}]' END,
       '["AUDIT_LOG","E2E"]','360,768,1280','KRDS WCAG 2.1 AA',
       'tenant,project,actor checked server-side',true,true,true,true,true,true,
       'evidence://test','VERIFIED'
  FROM generate_series(2,1530) i;
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
 command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,
 database_verified,authority_verified,responsive_verified,accessibility_verified,
 exception_states_verified,audit_evidence_ref,contract_status)
SELECT 'PROC','STEP','USER','/screen/'||i,'Duplicate Work '||i,'ACTOR',
       'Duplicate professional work '||i,'Assigned','Done','[]',
       '[{"title":"Main work"}]','[{"name":"value"}]','["SUBMIT"]',
       '["READY"]','[{"path":"/api/test"}]','[{"table":"test_record"}]',
       '["AUDIT_LOG"]','responsive','accessible','secure',
       true,true,true,true,true,true,'evidence://duplicate','VERIFIED'
  FROM generate_series(1714,1728) i
 CROSS JOIN generate_series(1,2) duplicate;
UPDATE framework_professional_screen_contract
   SET data_contract='[]'
 WHERE contract_id=(
   SELECT max(contract_id)
     FROM framework_professional_screen_contract
    WHERE route_path='/screen/1714'
 );
UPDATE framework_professional_screen_contract
   SET data_contract='{malformed'
 WHERE route_path='/screen/1429';
SQL

db <<'SQL'
REVOKE EXECUTE ON FUNCTION framework_canonical_design_catalog(integer) FROM PUBLIC;
SET ROLE carbonet_app;
SELECT framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1')->>'designHash';
RESET ROLE;
GRANT EXECUTE ON FUNCTION framework_canonical_design_catalog(integer) TO PUBLIC;
SQL

median3() { printf '%s\n' "$1" "$2" "$3" | sort -n | sed -n '2p'; }
bundle_timing_sql="WITH started AS MATERIALIZED (
  SELECT clock_timestamp() started_at
), compiled AS MATERIALIZED (
  SELECT started_at,framework_canonical_screen_bundle(
    'PROC','STEP','USER','/screen/1'
  ) bundle FROM started
), finished AS MATERIALIZED (
  SELECT started_at,clock_timestamp() finished_at,bundle FROM compiled
) SELECT round(extract(epoch FROM (finished_at-started_at))*1000000)::bigint
    FROM finished WHERE bundle IS NOT NULL"
catalog_timing_sql="WITH started AS MATERIALIZED (
  SELECT clock_timestamp() started_at
), compiled AS MATERIALIZED (
  SELECT started_at,framework_canonical_design_catalog(5000) catalog FROM started
), finished AS MATERIALIZED (
  SELECT started_at,clock_timestamp() finished_at,catalog FROM compiled
) SELECT round(extract(epoch FROM (finished_at-started_at))*1000000)::bigint
    FROM finished WHERE catalog->>'screenCount'='1427'"
bundle_us="$(median3 \
  "$(db_scalar "$bundle_timing_sql")" \
  "$(db_scalar "$bundle_timing_sql")" \
  "$(db_scalar "$bundle_timing_sql")")"
catalog_us="$(median3 \
  "$(db_scalar "$catalog_timing_sql")" \
  "$(db_scalar "$catalog_timing_sql")" \
  "$(db_scalar "$catalog_timing_sql")")"
[[ "$bundle_us" =~ ^[0-9]+$ ]] || fail "single-screen compiler timing missing: $bundle_us"
[[ "$catalog_us" =~ ^[0-9]+$ ]] || fail "catalog compiler timing missing: $catalog_us"
(( bundle_us < 250000 )) || fail "single-screen compiler median exceeded 250ms: ${bundle_us}us"
(( catalog_us >= bundle_us * 5 )) ||
  fail "single-screen compiler is not 5x faster: bundle=${bundle_us}us catalog=${catalog_us}us"
bundle_ms="$(( bundle_us / 1000 ))"
catalog_ms="$(( catalog_us / 1000 ))"
catalog_count="$(db_scalar "SELECT jsonb_array_length(framework_canonical_design_catalog(5000)->'screens')")"
[[ "$catalog_count" == 1427 ]] || fail "catalog count $catalog_count != 1427"
(( catalog_ms < 10000 )) || fail "catalog compiler exceeded 10s: ${catalog_ms}ms"

db <<'SQL'
DO $$
DECLARE readiness jsonb:=framework_canonical_design_readiness(200);
DECLARE catalog jsonb:=framework_canonical_design_catalog(5000);
DECLARE partial_one jsonb;
DECLARE partial_two jsonb;
DECLARE changed_release jsonb;
DECLARE released_bundle jsonb;
DECLARE unreleased_change_bundle jsonb;
DECLARE restored_bundle jsonb;
DECLARE incomplete_rejected boolean:=false;
DECLARE missing_rejected boolean:=false;
DECLARE duplicate_rejected boolean:=false;
DECLARE update_rejected boolean:=false;
DECLARE delete_rejected boolean:=false;
DECLARE truncate_rejected boolean:=false;
DECLARE member_update_rejected boolean:=false;
DECLARE member_delete_rejected boolean:=false;
DECLARE member_truncate_rejected boolean:=false;
DECLARE app_publish_rejected boolean:=false;
DECLARE app_dml_rejected boolean:=false;
DECLARE app_member_dml_rejected boolean:=false;
BEGIN
 IF readiness->>'sourceCount'<>'1728'
    OR readiness->>'exactContractCount'<>'1530'
    OR readiness->>'compilableCount'<>'1427'
    OR readiness->>'missingCount'<>'183'
    OR readiness->>'duplicateCount'<>'15'
    OR readiness->>'incompleteLaneCount'<>'103'
    OR readiness->>'blockerCount'<>'301'
    OR readiness->>'blockersTruncated'<>'true'
 THEN RAISE EXCEPTION 'readiness metrics mismatch: %',readiness; END IF;
 IF (catalog->>'screenCount')::integer<>1427 THEN
   RAISE EXCEPTION 'catalog count mismatch';
 END IF;
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(catalog->'screens') screen
    WHERE encode(sha256(convert_to(screen->>'canonicalText','UTF8')),'hex')
            <>screen->>'designHash'
       OR (screen->>'canonicalText')::jsonb<>screen->'canonicalDesign'
 ) THEN RAISE EXCEPTION 'screen canonicalText/hash mismatch'; END IF;

 BEGIN PERFORM framework_canonical_screen_design('PROC','STEP','USER','/screen/1429');
 EXCEPTION WHEN SQLSTATE '22023' THEN incomplete_rejected:=true; END;
 BEGIN PERFORM framework_canonical_screen_design('PROC','STEP','USER','/screen/1531');
 EXCEPTION WHEN no_data_found THEN missing_rejected:=true; END;
 BEGIN PERFORM framework_canonical_screen_design('PROC','STEP','USER','/screen/1714');
 EXCEPTION WHEN too_many_rows THEN duplicate_rejected:=true; END;
 IF NOT (incomplete_rejected AND missing_rejected AND duplicate_rejected) THEN
   RAISE EXCEPTION 'incomplete/missing/duplicate screen did not fail closed';
 END IF;

 partial_one:=framework_publish_canonical_design_release('PARTIAL_TEST');
 partial_two:=framework_publish_canonical_design_release('PARTIAL_RETRY');
 IF partial_one->>'releaseStatus'<>'PARTIAL'
    OR partial_one->>'blockerCount'<>'301'
    OR partial_one->>'releaseId'<>partial_two->>'releaseId'
    OR (SELECT count(*) FROM framework_canonical_design_release_evidence)<>1
    OR (SELECT count(*) FROM framework_canonical_design_release_member)<>1427
 THEN RAISE EXCEPTION 'PARTIAL release idempotency/membership mismatch'; END IF;

 released_bundle:=framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1');
 IF released_bundle->>'catalogHash'<>partial_one->>'catalogHash'
 THEN RAISE EXCEPTION 'bundle did not expose latest immutable release hash'; END IF;
 UPDATE framework_professional_screen_contract
    SET business_purpose=business_purpose||' unreleased change'
  WHERE route_path='/screen/1';
 unreleased_change_bundle:=framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1');
 IF unreleased_change_bundle->>'designHash'=released_bundle->>'designHash'
    OR unreleased_change_bundle->'catalogHash'<>'null'::jsonb
 THEN RAISE EXCEPTION 'unreleased screen falsely claimed release membership'; END IF;
 changed_release:=framework_publish_canonical_design_release('PARTIAL_CHANGED_TEST');
 IF changed_release->>'releaseId'=partial_one->>'releaseId'
    OR changed_release->>'catalogHash'=partial_one->>'catalogHash'
    OR framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1')->>'catalogHash'
         <>changed_release->>'catalogHash'
    OR (SELECT count(*) FROM framework_canonical_design_release_evidence)<>2
    OR (SELECT count(*) FROM framework_canonical_design_release_member)<>2854
 THEN RAISE EXCEPTION 'republished exact membership mismatch'; END IF;
 UPDATE framework_professional_screen_contract
    SET business_purpose='Complete professional test work 1'
  WHERE route_path='/screen/1';
 restored_bundle:=framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1');
 IF restored_bundle->>'designHash'<>released_bundle->>'designHash'
    OR restored_bundle->'catalogHash'<>'null'::jsonb
 THEN RAISE EXCEPTION 'restored older member falsely claimed latest release'; END IF;

 BEGIN UPDATE framework_canonical_design_release_evidence SET published_by='x';
 EXCEPTION WHEN SQLSTATE '55000' THEN update_rejected:=true; END;
 BEGIN DELETE FROM framework_canonical_design_release_evidence;
 EXCEPTION WHEN SQLSTATE '55000' THEN delete_rejected:=true; END;
 BEGIN TRUNCATE framework_canonical_design_release_evidence CASCADE;
 EXCEPTION WHEN SQLSTATE '55000' THEN truncate_rejected:=true; END;
 BEGIN UPDATE framework_canonical_design_release_member SET design_hash=design_hash;
 EXCEPTION WHEN SQLSTATE '55000' THEN member_update_rejected:=true; END;
 BEGIN DELETE FROM framework_canonical_design_release_member;
 EXCEPTION WHEN SQLSTATE '55000' THEN member_delete_rejected:=true; END;
 BEGIN TRUNCATE framework_canonical_design_release_member;
 EXCEPTION WHEN SQLSTATE '55000' THEN member_truncate_rejected:=true; END;
 BEGIN
   SET LOCAL ROLE carbonet_app;
   PERFORM framework_publish_canonical_design_release('APP');
 EXCEPTION WHEN insufficient_privilege THEN app_publish_rejected:=true; END;
 RESET ROLE;
 BEGIN
   SET LOCAL ROLE carbonet_app;
   INSERT INTO framework_canonical_design_release_evidence(
     schema_id,catalog_hash,readiness_hash,screen_count,release_status,
     blocker_count,catalog_json,readiness_json,published_by)
   SELECT schema_id,catalog_hash,readiness_hash,screen_count,release_status,
          blocker_count,catalog_json,readiness_json,'APP'
     FROM framework_canonical_design_release_evidence LIMIT 1;
 EXCEPTION WHEN insufficient_privilege THEN app_dml_rejected:=true; END;
 RESET ROLE;
 BEGIN
   SET LOCAL ROLE carbonet_app;
   INSERT INTO framework_canonical_design_release_member(
     release_id,screen_key,design_hash)
   SELECT release_id,screen_key,design_hash
     FROM framework_canonical_design_release_member LIMIT 1;
 EXCEPTION WHEN insufficient_privilege THEN app_member_dml_rejected:=true; END;
 RESET ROLE;
 IF NOT (update_rejected AND delete_rejected AND truncate_rejected
         AND member_update_rejected AND member_delete_rejected
         AND member_truncate_rejected AND app_publish_rejected
         AND app_dml_rejected AND app_member_dml_rejected) THEN
   RAISE EXCEPTION 'append-only/ACL rejection mismatch';
 END IF;
END
$$;

SET ROLE carbonet_app;
SELECT framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1')->>'designHash';
SELECT framework_canonical_design_catalog(5000)->>'catalogHash';
SELECT framework_canonical_design_readiness(10)->>'compilableCount';
RESET ROLE;

DELETE FROM framework_professional_screen_contract
 WHERE substring(route_path from '[0-9]+$')::integer>1427;
DELETE FROM framework_screen_blueprint
 WHERE substring(route_path from '[0-9]+$')::integer>1427;

DO $$
DECLARE readiness jsonb:=framework_canonical_design_readiness(200);
DECLARE complete_one jsonb;
DECLARE complete_two jsonb;
BEGIN
 IF readiness->>'sourceCount'<>'1427'
    OR readiness->>'compilableCount'<>'1427'
    OR readiness->>'blockerCount'<>'0'
 THEN RAISE EXCEPTION 'COMPLETE readiness mismatch: %',readiness; END IF;
 complete_one:=framework_publish_canonical_design_release('COMPLETE_TEST');
 complete_two:=framework_publish_canonical_design_release('COMPLETE_RETRY');
 IF complete_one->>'releaseStatus'<>'COMPLETE'
    OR complete_one->>'blockerCount'<>'0'
    OR complete_one->>'catalogHash'<>(
      SELECT catalog_hash FROM framework_canonical_design_release_evidence
       WHERE release_status='PARTIAL' ORDER BY release_id LIMIT 1)
    OR complete_one->>'releaseId'<>complete_two->>'releaseId'
    OR framework_canonical_screen_bundle('PROC','STEP','USER','/screen/1')->>'catalogHash'
         <>complete_one->>'catalogHash'
    OR (SELECT count(*) FROM framework_canonical_design_release_evidence)<>3
    OR (SELECT count(*) FROM framework_canonical_design_release_member)<>4281
    OR (SELECT count(DISTINCT readiness_hash)
          FROM framework_canonical_design_release_evidence)<>2
 THEN RAISE EXCEPTION 'COMPLETE release/readiness-hash/membership mismatch'; END IF;
END
$$;
SQL

printf 'CANONICAL_DESIGN_POSTGRES_PASS source=1728 compilable=1427 missing=183 duplicate=15 incomplete=103 bundleMs=%s catalogMs=%s bundleCatalogScan=0 canonicalText=1 lanes=7 releases=3 release_membership=1 append_only=1 app_read=1 app_write=0\n' "$bundle_ms" "$catalog_ms"
