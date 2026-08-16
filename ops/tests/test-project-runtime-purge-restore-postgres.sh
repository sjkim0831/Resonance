#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816134500__install_project_runtime_purge_restore_contract.sql"
REINSTALL_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816153500__reinstall_project_runtime_write_fences.sql"
IMAGE="${PROJECT_PURGE_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER_ID="codex-project-purge-$RANDOM-$$"
PASSWORD="project-purge-$RANDOM"
PORT=""
started=0

fail() { printf 'PROJECT_RUNTIME_PURGE_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  set +e
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

[[ -f "$MIGRATION" ]] || fail 'migration missing'
[[ -f "$REINSTALL_MIGRATION" ]] || fail 'post-composite fence migration missing'
command -v psql >/dev/null || fail 'psql missing'
command -v python3 >/dev/null || fail 'python3 missing'
sudo -n true >/dev/null || fail 'passwordless sudo required'
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" ||
  fail "cached image missing: $IMAGE"
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=purge_contract \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER_ID"
started=1
export PGPASSWORD="$PASSWORD"
psql_base=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d purge_contract -X)
for _ in $(seq 1 40); do
  "${psql_base[@]}" -Atqc 'select 1' >/dev/null 2>&1 && break
  sleep 1
done
[[ "$("${psql_base[@]}" -Atqc 'select 1')" == 1 ]] || fail 'postgres readiness timeout'
db() { "${psql_base[@]}" -v ON_ERROR_STOP=1 "$@"; }
scalar() { "${psql_base[@]}" -v ON_ERROR_STOP=1 -Atqc "$1"; }
expect_purged_fence() {
  local label="$1" statement="$2" output
  if output="$(db -Atqc "$statement" 2>&1)"; then
    fail "PURGED fence admitted $label"
  fi
  grep -Fq 'durably purged' <<<"$output" ||
    fail "PURGED fence reason drifted for $label: $output"
}

db <<'SQL'
CREATE ROLE carbonet_app NOLOGIN;
CREATE TABLE comtnemplyrinfo(
 esntl_id varchar(80) PRIMARY KEY,emplyr_id varchar(120) NOT NULL UNIQUE,
 emplyr_sttus_code varchar(8) NOT NULL);
CREATE TABLE comtnentrprsmber(
 esntl_id varchar(80) PRIMARY KEY,entrprs_mber_id varchar(120) NOT NULL UNIQUE,
 entrprs_mber_sttus varchar(8) NOT NULL);
CREATE TABLE comtnemplyrscrtyestbs(
 scrty_dtrmn_trget_id varchar(80) NOT NULL,author_code varchar(80) NOT NULL,
 PRIMARY KEY(scrty_dtrmn_trget_id,author_code));
CREATE TABLE framework_process_definition(
 process_code varchar(80) PRIMARY KEY,process_name varchar(160) NOT NULL,
 domain_code varchar(60) NOT NULL,process_version varchar(20) NOT NULL,
 goal text NOT NULL,start_condition text NOT NULL,completion_condition text NOT NULL,
 process_status varchar(30) NOT NULL,lifecycle_status varchar(30) NOT NULL,
 parent_process_code varchar(80),definition_locked boolean NOT NULL DEFAULT false,
 definition_lock_reason text,created_at timestamp NOT NULL DEFAULT now(),
 updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE framework_process_design_revision_lease(
 backend_pid integer NOT NULL,transaction_id bigint NOT NULL,
 process_code varchar(80) NOT NULL,requested_actor varchar(100) NOT NULL,
 opened_at timestamp NOT NULL DEFAULT now(),
 PRIMARY KEY(backend_pid,transaction_id,process_code));
CREATE TABLE framework_process_step(
 step_id bigserial PRIMARY KEY,process_code varchar(80) NOT NULL
   REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 step_code varchar(80) NOT NULL,step_order integer NOT NULL,
 actor_code varchar(60) NOT NULL,step_name varchar(160) NOT NULL,
 from_state varchar(60) NOT NULL,command_code varchar(80) NOT NULL,
 to_state varchar(60) NOT NULL,decision_rule text NOT NULL,
 UNIQUE(process_code,step_code));
CREATE TABLE framework_simulation_case(
 case_code varchar(100) PRIMARY KEY,process_code varchar(80) NOT NULL
   REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 case_name varchar(180) NOT NULL,case_type varchar(30) NOT NULL,
 preconditions text NOT NULL,steps_json text NOT NULL,assertions_json text NOT NULL);
CREATE TABLE framework_actor_process_design_release(
 project_id varchar(64) NOT NULL,design_version integer NOT NULL,
 contract_sha256 char(64) NOT NULL,contract_payload jsonb NOT NULL,
 source_system varchar(32) NOT NULL DEFAULT 'BACKSTAGE',release_status varchar(32) NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),applied_at timestamptz,
 generation_result jsonb,PRIMARY KEY(project_id,design_version));
CREATE TABLE framework_process_execution(
 execution_id uuid PRIMARY KEY,project_id varchar(100) NOT NULL,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code),
 current_step_code varchar(80) NOT NULL,
 FOREIGN KEY(process_code,current_step_code)
   REFERENCES framework_process_step(process_code,step_code));
CREATE TABLE framework_process_execution_event(
 event_id bigserial PRIMARY KEY,execution_id uuid NOT NULL
   REFERENCES framework_process_execution(execution_id) ON DELETE CASCADE,
 result_json jsonb NOT NULL);
CREATE TABLE framework_process_work_draft(
 draft_id uuid PRIMARY KEY,project_id varchar(100) NOT NULL,
 process_code varchar(80) NOT NULL,step_code varchar(80) NOT NULL,
 payload_json jsonb NOT NULL,evidence_json jsonb NOT NULL,
 FOREIGN KEY(process_code,step_code)
   REFERENCES framework_process_step(process_code,step_code));
CREATE TABLE framework_account_actor_assignment(
 assignment_id bigserial PRIMARY KEY,project_id varchar(100) NOT NULL,
 account_id varchar(100) NOT NULL,actor_code varchar(60) NOT NULL);
CREATE TABLE framework_project_actor_assignment(
 project_id varchar(100) NOT NULL,actor_code varchar(60) NOT NULL,
 user_id varchar(100) NOT NULL,PRIMARY KEY(project_id,actor_code,user_id));
CREATE TABLE framework_development_job(
 job_id bigserial PRIMARY KEY,process_code varchar(80) NOT NULL
   REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 step_code varchar(80),created_by varchar(100) NOT NULL,
 job_status varchar(30) NOT NULL DEFAULT 'PLANNED',
 FOREIGN KEY(process_code,step_code)
   REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE);
CREATE TABLE framework_development_job_event(
 event_id bigserial PRIMARY KEY,job_id bigint NOT NULL
   REFERENCES framework_development_job(job_id) ON DELETE CASCADE);
CREATE TABLE framework_screen_blueprint(
 blueprint_id bigserial PRIMARY KEY,process_code varchar(80) NOT NULL
   REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 step_code varchar(80) NOT NULL,created_by varchar(100) NOT NULL);
CREATE TABLE framework_screen_generation_state(
 blueprint_id bigint PRIMARY KEY
   REFERENCES framework_screen_blueprint(blueprint_id) ON DELETE CASCADE,
 ownership_mode varchar(16) NOT NULL,design_hash varchar(64) NOT NULL DEFAULT repeat('1',64),
 generated_hash varchar(64),sync_status varchar(16) NOT NULL DEFAULT 'DIRTY',
 generated_at timestamp,updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE framework_screen_feature_binding(
 process_code varchar(80) NOT NULL,step_code varchar(80) NOT NULL,
 feature_code varchar(80) NOT NULL,PRIMARY KEY(process_code,step_code,feature_code),
 FOREIGN KEY(process_code,step_code)
   REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE);
CREATE TABLE framework_source_artifact(
 source_artifact_id bigserial PRIMARY KEY,source_path text NOT NULL UNIQUE,
 ownership_mode varchar(16) NOT NULL,metadata_json jsonb NOT NULL);
CREATE TABLE framework_source_artifact_version(
 source_artifact_id bigint NOT NULL REFERENCES framework_source_artifact(source_artifact_id)
   ON DELETE CASCADE,revision integer NOT NULL,PRIMARY KEY(source_artifact_id,revision));
CREATE TABLE framework_source_materialization_state(
 source_artifact_id bigint PRIMARY KEY REFERENCES framework_source_artifact(source_artifact_id)
   ON DELETE CASCADE,source_hash varchar(64) NOT NULL DEFAULT repeat('2',64),
 materialized_hash varchar(64),sync_status varchar(16) NOT NULL,
 materialized_at timestamp,updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE framework_runtime_resource(
 resource_id bigserial PRIMARY KEY,resource_kind varchar(24) NOT NULL,
 resource_key varchar(600) NOT NULL,scope_code varchar(80) NOT NULL DEFAULT 'GLOBAL',
 contract_json jsonb NOT NULL,UNIQUE(resource_kind,resource_key,scope_code));
CREATE TABLE framework_runtime_generation_state(
 resource_id bigint PRIMARY KEY REFERENCES framework_runtime_resource(resource_id)
   ON DELETE CASCADE,source_hash varchar(64) NOT NULL DEFAULT repeat('3',64),
 generated_hash varchar(64),sync_status varchar(16) NOT NULL,
 generated_at timestamp,updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE framework_api_endpoint_registry(
 endpoint_key varchar(240) PRIMARY KEY,http_method varchar(10) NOT NULL,
 route_path varchar(300) NOT NULL,implementation_ref text NOT NULL);
INSERT INTO comtnemplyrinfo VALUES
 ('ADMIN-1','runtime.admin','A'),
 ('MASTER-1','master.admin','A'),
 ('BOTH-1','both.admin','A'),
 ('NOROLE-1','norole.admin','A'),
 ('INACTIVE-1','inactive.admin','I'),
 ('RACE-1','race.admin','A');
INSERT INTO comtnemplyrscrtyestbs VALUES
 ('ADMIN-1','ROLE_SYSTEM_ADMIN'),
 ('MASTER-1','ROLE_SYSTEM_MASTER'),
 ('BOTH-1','ROLE_SYSTEM_ADMIN'),
 ('BOTH-1','ROLE_SYSTEM_MASTER'),
 ('INACTIVE-1','ROLE_SYSTEM_ADMIN'),
 ('RACE-1','ROLE_SYSTEM_ADMIN');
SQL

db -f "$MIGRATION" >/dev/null

# These tables model V20260816152000 and intentionally appear after the purge
# contract. The post-composite migration must discover and fence them without
# any static dependency from the earlier migration.
db <<'SQL'
CREATE TABLE integrated_design_document(
 document_id bigserial PRIMARY KEY,process_code varchar(100) NOT NULL,
 step_code varchar(100) NOT NULL,route_path varchar(500) NOT NULL,
 audience varchar(20) NOT NULL,document_type varchar(50) NOT NULL,
 title text NOT NULL,content text NOT NULL,
 UNIQUE(process_code,step_code,route_path,audience,document_type));
CREATE TABLE integrated_design_document_version(
 document_id bigint NOT NULL REFERENCES integrated_design_document(document_id)
   ON DELETE CASCADE,revision bigint NOT NULL,content text NOT NULL,
 PRIMARY KEY(document_id,revision));
CREATE TABLE integrated_design_authority(
 authority_id bigserial PRIMARY KEY,process_code varchar(100) NOT NULL,
 step_code varchar(100) NOT NULL,route_path varchar(500) NOT NULL,
 audience varchar(20) NOT NULL,authority_revision bigint NOT NULL,
 document_set_hash varchar(64) NOT NULL,authority_hash varchar(64) NOT NULL,
 UNIQUE(process_code,step_code,route_path,audience));
CREATE TABLE integrated_design_authority_version(
 authority_id bigint NOT NULL REFERENCES integrated_design_authority(authority_id)
   ON DELETE CASCADE,authority_revision bigint NOT NULL,
 document_set_hash varchar(64) NOT NULL,authority_hash varchar(64) NOT NULL,
 PRIMARY KEY(authority_id,authority_revision));
CREATE TABLE integrated_design_scope_binding(
 binding_id bigserial PRIMARY KEY,authority_id bigint NOT NULL
   REFERENCES integrated_design_authority(authority_id) ON DELETE RESTRICT,
 authority_revision bigint NOT NULL,scope_type varchar(10) NOT NULL,
 project_id varchar(64),design_version integer,contract_sha256 varchar(64),
 process_code varchar(100) NOT NULL,step_code varchar(100) NOT NULL,
 route_path varchar(500) NOT NULL,audience varchar(20) NOT NULL,
 document_set_hash varchar(64) NOT NULL,authority_hash varchar(64) NOT NULL,
 provenance_hash varchar(64) NOT NULL,bound_by varchar(100) NOT NULL,
 bound_at timestamp NOT NULL DEFAULT now());
SQL
db -f "$REINSTALL_MIGRATION" >/dev/null
missing_fences="$(scalar "select count(*) from pg_class relation
 join pg_namespace namespace on namespace.oid=relation.relnamespace
 where namespace.nspname='public' and relation.relkind in ('r','p')
   and not relation.relispartition
   and relation.relname not like 'framework_project_runtime_purge_%'
   and relation.relname<>'framework_project_runtime_absence_fence'
   and (relation.relname in(
     'framework_actor_process_design_release','framework_api_endpoint_registry',
     'framework_source_artifact','framework_runtime_resource')
     or ((relation.relname like 'framework\_%' escape '\'
          or relation.relname like 'integrated_design\_%' escape '\')
       and exists(select 1 from pg_attribute attribute
        where attribute.attrelid=relation.oid
          and attribute.attname in('project_id','process_code')
          and attribute.attnum>0 and not attribute.attisdropped)))
   and not exists(select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid=relation.oid
      and trigger_row.tgname='trg_project_runtime_write_fence'
      and not trigger_row.tgisinternal)")"
[[ "$missing_fences" == 0 ]] ||
  fail "runtime write-fence catalog coverage missing tables: $missing_fences"

db <<'SQL'
CREATE OR REPLACE FUNCTION test_live_purge_snapshot_hash(requested_receipt uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE captured record; live_payload jsonb; canonical_rows jsonb:='[]'::jsonb;
BEGIN
  FOR captured IN
    SELECT * FROM framework_project_runtime_purge_snapshot_row
     WHERE receipt_id=requested_receipt
     ORDER BY table_name COLLATE "C",row_hash COLLATE "C"
  LOOP
    EXECUTE format('select to_jsonb(row_value) from %s row_value '
                   'where to_jsonb(row_value)=$1',captured.table_oid::regclass)
      INTO live_payload USING captured.row_payload;
    canonical_rows:=canonical_rows||jsonb_build_array(jsonb_build_object(
      'table',captured.table_name,'row',live_payload));
  END LOOP;
  RETURN framework_project_runtime_purge_hash(canonical_rows);
END $$;
CREATE OR REPLACE FUNCTION test_runtime_sequence_hash()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE sequence_row record; sequence_last bigint; sequence_called boolean;
DECLARE canonical_rows jsonb:='[]'::jsonb;
BEGIN
  FOR sequence_row IN
    SELECT relation.oid,relation.relname
      FROM pg_class relation JOIN pg_namespace namespace
        ON namespace.oid=relation.relnamespace
     WHERE namespace.nspname='public' AND relation.relkind='S'
       AND relation.relname LIKE 'framework\_%' ESCAPE '\'
       AND relation.relname NOT LIKE 'framework_project_runtime_purge_%'
     ORDER BY relation.relname COLLATE "C"
  LOOP
    EXECUTE format('select last_value,is_called from %s',
      sequence_row.oid::regclass) INTO sequence_last,sequence_called;
    canonical_rows:=canonical_rows||jsonb_build_array(jsonb_build_object(
      'sequence',sequence_row.relname,'lastValue',sequence_last,
      'isCalled',sequence_called));
  END LOOP;
  RETURN framework_project_runtime_purge_hash(canonical_rows);
END $$;
CREATE TRIGGER trg_guard_locked_process_definition
 BEFORE UPDATE OR DELETE ON framework_process_definition
 FOR EACH ROW EXECUTE FUNCTION framework_guard_locked_process_definition();
CREATE TRIGGER trg_guard_locked_process_step
 BEFORE INSERT OR UPDATE OR DELETE ON framework_process_step
 FOR EACH ROW EXECUTE FUNCTION framework_guard_locked_process_step();
CREATE TRIGGER trg_guard_locked_simulation_case
 BEFORE INSERT OR UPDATE OR DELETE ON framework_simulation_case
 FOR EACH ROW EXECUTE FUNCTION framework_guard_locked_simulation_case();
CREATE OR REPLACE FUNCTION test_sync_blueprint_generation_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO framework_screen_generation_state(blueprint_id,ownership_mode)
  VALUES(NEW.blueprint_id,'GENERATED')
  ON CONFLICT(blueprint_id) DO UPDATE SET ownership_mode=excluded.ownership_mode;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_blueprint_generation_dirty AFTER INSERT OR UPDATE
 ON framework_screen_blueprint FOR EACH ROW
 EXECUTE FUNCTION test_sync_blueprint_generation_state();
CREATE OR REPLACE FUNCTION test_sync_endpoint_runtime_resource()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resolved_id bigint;
BEGIN
  INSERT INTO framework_runtime_resource(
    resource_kind,resource_key,scope_code,contract_json)
  VALUES('ENDPOINT',NEW.endpoint_key,'GLOBAL',jsonb_build_object(
    'endpointKey',NEW.endpoint_key,'method',NEW.http_method,
    'routePath',NEW.route_path,'implementationRef',NEW.implementation_ref))
  ON CONFLICT(resource_kind,resource_key,scope_code) DO UPDATE
    SET contract_json=excluded.contract_json
  RETURNING resource_id INTO resolved_id;
  INSERT INTO framework_runtime_generation_state(resource_id,sync_status)
  VALUES(resolved_id,'DIRTY') ON CONFLICT(resource_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_endpoint_runtime_resource AFTER INSERT OR UPDATE
 ON framework_api_endpoint_registry FOR EACH ROW
 EXECUTE FUNCTION test_sync_endpoint_runtime_resource();

INSERT INTO framework_process_definition VALUES
 ('RFP_TEST','RFP Test','TEST','1.0.0','goal','start','done','ACTIVE','ACTIVE',
  NULL,false,NULL,now(),now());
INSERT INTO framework_process_step(process_code,step_code,step_order,actor_code,
 step_name,from_state,command_code,to_state,decision_rule)
VALUES('RFP_TEST','STEP_A',1,'ACTOR_A','Step A','READY','SUBMIT','DONE',
 'SOURCE:REQUIREMENT_DOCUMENT');
INSERT INTO framework_simulation_case VALUES
 ('RFP_TEST_HAPPY','RFP_TEST','happy','HAPPY_PATH','{}','[]','[]');
UPDATE framework_process_definition SET definition_locked=true,
 definition_lock_reason='TEST_LOCK' WHERE process_code='RFP_TEST';
INSERT INTO framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
VALUES
 ('RFP-PURGE-001',1,repeat('a',64),
  '{"process":{"processCode":"RFP_TEST"},"source":{"testOwned":true},"state":"A"}','APPLIED'),
 ('RFP-PURGE-001',2,repeat('b',64),
  '{"process":{"processCode":"RFP_TEST"},"source":{"testOwned":true},"state":"B"}','APPLIED'),
 ('RFP-PURGE-001',3,repeat('a',64),
  '{"process":{"processCode":"RFP_TEST"},"source":{"testOwned":true},"state":"A"}','APPLIED');
INSERT INTO framework_process_execution VALUES
 ('11111111-1111-1111-1111-111111111111','RFP-PURGE-001','RFP_TEST','STEP_A');
INSERT INTO framework_process_execution_event(execution_id,result_json)
VALUES('11111111-1111-1111-1111-111111111111','{"ok":true}');
INSERT INTO framework_process_work_draft VALUES
 ('22222222-2222-2222-2222-222222222222','RFP-PURGE-001','RFP_TEST','STEP_A',
  '{"value":"A"}','{"qaProvenance":"fixture"}');
INSERT INTO framework_account_actor_assignment(project_id,account_id,actor_code)
VALUES('RFP-PURGE-001','runtime.admin','ACTOR_A');
INSERT INTO framework_project_actor_assignment VALUES
 ('RFP-PURGE-001','ACTOR_A','runtime.admin');
INSERT INTO framework_development_job(process_code,step_code,created_by)
VALUES('RFP_TEST','STEP_A','BACKSTAGE_REQUIREMENT_AUTOMATION');
INSERT INTO framework_development_job_event(job_id)
SELECT job_id FROM framework_development_job;
INSERT INTO framework_screen_blueprint(process_code,step_code,created_by)
VALUES('RFP_TEST','STEP_A','ordinary.human.account');
INSERT INTO framework_screen_feature_binding VALUES('RFP_TEST','STEP_A','JSON_FORM');
INSERT INTO framework_source_artifact(source_path,ownership_mode,metadata_json)
VALUES('/generated/rfp-test.ts','GENERATED',
 '{"projectId":"RFP-PURGE-001","processCode":"RFP_TEST"}');
INSERT INTO framework_source_artifact_version
SELECT source_artifact_id,1 FROM framework_source_artifact;
INSERT INTO framework_source_materialization_state(source_artifact_id,sync_status)
SELECT source_artifact_id,'DIRTY' FROM framework_source_artifact;
INSERT INTO framework_runtime_resource(resource_kind,resource_key,contract_json)
VALUES('ENDPOINT','RFP_TEST:TAGGED:RESOURCE',
 '{"projectId":"RFP-PURGE-001","processCode":"RFP_TEST"}');
INSERT INTO framework_runtime_generation_state(resource_id,sync_status)
SELECT resource_id,'DIRTY' FROM framework_runtime_resource;
INSERT INTO framework_api_endpoint_registry VALUES
 ('RFP_TEST:STEP_A:SUBMIT','POST','/api/generated/rfp-test/submit',
  'GeneratedRfpTestController#submit');
INSERT INTO integrated_design_document(
 process_code,step_code,route_path,audience,document_type,title,content)
SELECT 'RFP_TEST','STEP_A','/rfp-test','USER','AXIS_'||axis,
       'axis '||axis,'content '||axis
  FROM generate_series(1,18) axis;
INSERT INTO integrated_design_document_version(document_id,revision,content)
SELECT document_id,1,content FROM integrated_design_document;
INSERT INTO integrated_design_authority(
 process_code,step_code,route_path,audience,authority_revision,
 document_set_hash,authority_hash)
VALUES('RFP_TEST','STEP_A','/rfp-test','USER',3,repeat('5',64),repeat('4',64));
INSERT INTO integrated_design_authority_version(
 authority_id,authority_revision,document_set_hash,authority_hash)
SELECT authority_id,revision,
       repeat(CASE revision WHEN 2 THEN '7' ELSE '5' END,64),
       repeat(CASE revision WHEN 2 THEN '8' ELSE '4' END,64)
  FROM integrated_design_authority CROSS JOIN generate_series(1,2) revision;
INSERT INTO integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,
 document_set_hash,authority_hash,provenance_hash,bound_by)
SELECT authority_id,revision,'PROJECT','RFP-PURGE-001',revision,
       repeat(CASE revision WHEN 2 THEN 'b' ELSE 'a' END,64),
       'RFP_TEST','STEP_A','/rfp-test','USER',
       repeat(CASE revision WHEN 2 THEN '7' ELSE '5' END,64),
       repeat(CASE revision WHEN 2 THEN '8' ELSE '4' END,64),
       framework_project_runtime_purge_integrated_provenance_hash(
         'PROJECT','RFP-PURGE-001',revision::bigint,
         repeat(CASE revision WHEN 2 THEN 'b' ELSE 'a' END,64),
         'RFP_TEST','STEP_A','/rfp-test','USER',authority_id,revision::bigint,
         repeat(CASE revision WHEN 2 THEN '7' ELSE '5' END,64),
         repeat(CASE revision WHEN 2 THEN '8' ELSE '4' END,64)),
       'RFP_IMPORT'
  FROM integrated_design_authority CROSS JOIN generate_series(1,3) revision;
SQL

# The prior controlled-design-revision contract must survive this migration.
# All three locked-structure guards still deny ordinary writes and a forged
# receipt GUC, while the transaction-local exact design lease admits revisions.
set +e
definition_denied="$(db -Atqc "update framework_process_definition
 set process_name='forbidden' where process_code='RFP_TEST'" 2>&1)"
definition_status=$?
step_denied="$(db -Atqc "update framework_process_step set step_name='forbidden'
 where process_code='RFP_TEST' and step_code='STEP_A'" 2>&1)"
step_status=$?
simulation_denied="$(db -Atqc "update framework_simulation_case set case_name='forbidden'
 where case_code='RFP_TEST_HAPPY'" 2>&1)"
simulation_status=$?
fake_guc_denied="$(db -Atqc "begin;
 select set_config('carbonet.project_runtime_purge_receipt',
 '12121212-1212-1212-1212-121212121212',true);
 delete from framework_process_step
 where process_code='RFP_TEST' and step_code='STEP_A'; commit" 2>&1)"
fake_guc_status=$?
set -e
(( definition_status != 0 && step_status != 0 && simulation_status != 0 )) ||
  fail 'locked design write without lease was accepted'
(( fake_guc_status != 0 )) || fail 'forged purge receipt GUC bypassed design guard'
grep -Fq 'read-only' <<<"$definition_denied$step_denied$simulation_denied$fake_guc_denied" ||
  fail 'locked design guard denial reason drifted'

db -qc "begin;
 insert into framework_process_design_revision_lease(
   backend_pid,transaction_id,process_code,requested_actor)
 values(pg_backend_pid(),txid_current(),'RFP_TEST','revision.tester');
 update framework_process_definition set process_name='leased'
  where process_code='RFP_TEST';
 update framework_process_step set step_name='leased'
  where process_code='RFP_TEST' and step_code='STEP_A';
 update framework_simulation_case set case_name='leased'
  where case_code='RFP_TEST_HAPPY';
 rollback"
[[ "$(scalar "select process_name from framework_process_definition where process_code='RFP_TEST'")" == 'RFP Test' ]] ||
  fail 'controlled design lease regression test did not roll back exactly'

set +e
admin_denied="$(db -Atqc "begin; set local role carbonet_app;
 select set_config('carbonet.runtime.system_admin','true',true);
 select framework_preview_project_runtime_purge(
 'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','spoofed.admin'); commit" 2>&1)"
admin_status=$?
set -e
(( admin_status != 0 )) || fail 'preview accepted missing runtime admin context'
grep -Fq 'runtime system administrator' <<<"$admin_denied" ||
  fail 'runtime admin denial reason drifted'

for authority_case in \
  'runtime.admin:99999999-0000-0000-0000-000000000011' \
  'master.admin:99999999-0000-0000-0000-000000000012' \
  'both.admin:99999999-0000-0000-0000-000000000013'; do
  authority_actor="${authority_case%%:*}"
  authority_proof="${authority_case#*:}"
  authority_result="$(db -Atqc "select framework_prove_project_runtime_absent(
    '$authority_proof','RFP-PURGE-AUTH-${authority_actor%%.*}','$authority_actor')" | tail -1)"
  [[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$authority_result")" == PROVEN_ABSENT ]] ||
    fail "valid administrator authority rejected: $authority_actor"
done

set +e
norole_denied="$(db -Atqc "select framework_prove_project_runtime_absent(
 '99999999-0000-0000-0000-000000000014','RFP-PURGE-NOROLE','norole.admin')" 2>&1)"
norole_status=$?
inactive_denied="$(db -Atqc "select framework_prove_project_runtime_absent(
 '99999999-0000-0000-0000-000000000015','RFP-PURGE-INACTIVE','inactive.admin')" 2>&1)"
inactive_status=$?
set -e
(( norole_status != 0 )) || fail 'administrator account without role was accepted'
(( inactive_status != 0 )) || fail 'inactive administrator account was accepted'
grep -Fq 'authority is required' <<<"$norole_denied" || fail 'missing-role denial drifted'
grep -Fq 'active runtime system administrator' <<<"$inactive_denied" ||
  fail 'inactive-account denial drifted'

# Authority rows are row-locked through the protected operation. A concurrent
# revoke must serialize, and the next retry must observe the revocation.
( db -qc "begin; select framework_prove_project_runtime_absent(
 '99999999-0000-0000-0000-000000000016','RFP-PURGE-RACE','race.admin');
 select pg_sleep(2); commit" >/dev/null ) &
role_locker_pid=$!
sleep 0.3
role_started_ns="$(date +%s%N)"
db -qc "delete from comtnemplyrscrtyestbs
 where scrty_dtrmn_trget_id='RACE-1' and author_code='ROLE_SYSTEM_ADMIN'"
wait "$role_locker_pid"
role_elapsed_ms="$(( ( $(date +%s%N) - role_started_ns ) / 1000000 ))"
(( role_elapsed_ms >= 1200 )) ||
  fail "authority revoke did not serialize: ${role_elapsed_ms}ms"
set +e
revoked_denied="$(db -Atqc "select framework_prove_project_runtime_absent(
 '99999999-0000-0000-0000-000000000017','RFP-PURGE-REVOKED','race.admin')" 2>&1)"
revoked_status=$?
set -e
(( revoked_status != 0 )) || fail 'revoked administrator authority was accepted'
grep -Fq 'authority is required' <<<"$revoked_denied" || fail 'revoked-role denial drifted'

empty_proof="$(db -Atqc "select framework_prove_project_runtime_absent(
 '99999999-0000-0000-0000-000000000001','RFP-PURGE-EMPTY','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$empty_proof")" == PROVEN_ABSENT ]] ||
  fail "empty project runtime proof failed: $empty_proof"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["residualRows"])' <<<"$empty_proof")" == 0 ]] ||
  fail 'empty project runtime proof was not exact zero'
[[ "$(scalar "select count(*) from framework_project_runtime_absence_fence where proof_id='99999999-0000-0000-0000-000000000001'")" == 0 ]] ||
  fail 'dry absence proof unexpectedly installed a write fence'

preactivation_release="$(db -Atqc "select framework_release_project_runtime_absence_fence(
 '99999999-0000-0000-0000-000000000023','RFP-PURGE-NOT-ACTIVATED',
 'runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["neverActivated"])' <<<"$preactivation_release")" == True ]] ||
  fail 'PREPARED recovery did not persist a no-activation tombstone'
delayed_activation="$(db -Atqc "select framework_activate_project_runtime_absence_fence(
 '99999999-0000-0000-0000-000000000023','RFP-PURGE-NOT-ACTIVATED',
 'runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["fenceStatus"])' <<<"$delayed_activation")" == RELEASED ]] ||
  fail 'delayed activation bypassed a recovery tombstone'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["activated"])' <<<"$delayed_activation")" == False ]] ||
  fail 'delayed activation installed an orphan absence fence'

# Activation and the exact-zero observation commit atomically.  A concurrent
# design release waits on the shared project key, then observes ACTIVE and
# fails with write0.  Lost-response retry is idempotent; another proof cannot
# steal the project fence; explicit release permits project reuse again.
absence_result_file="$(mktemp)"
( db -Atqc "begin;
 select framework_activate_project_runtime_absence_fence(
  '99999999-0000-0000-0000-000000000020','RFP-PURGE-FENCE','runtime.admin');
 select pg_sleep(2); commit" >"$absence_result_file" ) &
absence_fence_pid=$!
sleep 0.3
absence_writer_started_ns="$(date +%s%N)"
set +e
absence_writer_error="$(db -Atqc "insert into framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
 values('RFP-PURGE-FENCE',1,repeat('1',64),
 '{\"process\":{\"processCode\":\"RFP_FENCE\"},\"source\":{\"testOwned\":true}}',
 'QUEUED')" 2>&1)"
absence_writer_status=$?
set -e
wait "$absence_fence_pid"
absence_writer_elapsed_ms="$(( ( $(date +%s%N) - absence_writer_started_ns ) / 1000000 ))"
(( absence_writer_status != 0 )) || fail 'ACTIVE absence fence admitted a release writer'
(( absence_writer_elapsed_ms >= 1200 )) ||
  fail "absence-fence writer did not serialize: ${absence_writer_elapsed_ms}ms"
grep -Fq 'active runtime absence fence' <<<"$absence_writer_error" ||
  fail 'absence-fence writer denial reason drifted'
activated_absence="$(head -1 "$absence_result_file")"
rm -f "$absence_result_file"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["fenceStatus"])' <<<"$activated_absence")" == ACTIVE ]] ||
  fail 'absence fence activation receipt missing'
activation_retry="$(db -Atqc "select framework_activate_project_runtime_absence_fence(
 '99999999-0000-0000-0000-000000000020','RFP-PURGE-FENCE','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["idempotent"])' <<<"$activation_retry")" == True ]] ||
  fail 'absence fence lost-response retry was not idempotent'
set +e
absence_takeover="$(db -Atqc "select framework_activate_project_runtime_absence_fence(
 '99999999-0000-0000-0000-000000000021','RFP-PURGE-FENCE','runtime.admin')" 2>&1)"
absence_takeover_status=$?
set -e
(( absence_takeover_status != 0 )) || fail 'another proof stole an ACTIVE absence fence'
released_absence="$(db -Atqc "select framework_release_project_runtime_absence_fence(
 '99999999-0000-0000-0000-000000000020','RFP-PURGE-FENCE','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["fenceStatus"])' <<<"$released_absence")" == RELEASED ]] ||
  fail 'absence fence release receipt missing'
db -qc "insert into framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
 values('RFP-PURGE-FENCE',1,repeat('1',64),
 '{\"process\":{\"processCode\":\"RFP_FENCE\"},\"source\":{\"testOwned\":true}}',
 'QUEUED');
delete from framework_actor_process_design_release
 where project_id='RFP-PURGE-FENCE'"
reactivated_absence="$(db -Atqc "select framework_activate_project_runtime_absence_fence(
 '99999999-0000-0000-0000-000000000022','RFP-PURGE-FENCE','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["fenceStatus"])' <<<"$reactivated_absence")" == ACTIVE ]] ||
  fail 'released absence tombstone blocked a new project incarnation fence'
db -qc "select framework_release_project_runtime_absence_fence(
 '99999999-0000-0000-0000-000000000022','RFP-PURGE-FENCE','runtime.admin')" >/dev/null

db -qc "insert into integrated_design_document(
 process_code,step_code,route_path,audience,document_type,title,content)
 values('RFP_ORPHAN','STEP_O','/orphan','USER','AXIS_1','orphan','orphan')"
orphan_proof="$(db -Atqc "select framework_prove_project_runtime_absent(
 '99999999-0000-0000-0000-000000000018','RFP-PURGE-ORPHAN-CHECK','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$orphan_proof")" == PROVEN_ABSENT ]] ||
  fail 'unrelated orphan integrated design row blocked an empty project'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["globalIntegrityWarning"])' <<<"$orphan_proof")" == True ]] ||
  fail 'global integrated design warning was not surfaced'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["globalIntegratedIntegrityWarningRows"])' <<<"$orphan_proof")" == 1 ]] ||
  fail 'global integrated design warning count drifted'
db -qc "delete from integrated_design_document where process_code='RFP_ORPHAN'"

integrated_xmin_before="$(scalar "select xmin::text from integrated_design_authority where process_code='RFP_TEST'")"
db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,
 document_set_hash,authority_hash,provenance_hash,bound_by)
select authority_id,3,'PROJECT','RFP-PURGE-001',4,repeat('c',64),
 'RFP_OTHER',step_code,route_path,audience,document_set_hash,authority_hash,
 repeat('3',64),'MULTI_PROCESS_FIXTURE'
 from integrated_design_authority where process_code='RFP_TEST'"
multi_process_binding_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 '86868686-0000-0000-0000-000000000001','86868686-0000-0000-0000-000000000002',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$multi_process_binding_preview")" == BLOCKED ]] ||
  fail 'stale integrated binding with another process was not blocked'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["blockers"]["projectProcessIdentityCount"])' <<<"$multi_process_binding_preview")" == 2 ]] ||
  fail 'integrated binding process identity blocker drifted'
[[ "$(scalar "select xmin::text from integrated_design_authority where process_code='RFP_TEST'")" == "$integrated_xmin_before" ]] ||
  fail 'multi-process binding preview changed authority xmin'
db -qc "delete from integrated_design_scope_binding
 where bound_by='MULTI_PROCESS_FIXTURE'"

db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,
 document_set_hash,authority_hash,provenance_hash,bound_by)
select authority_id,1,'GLOBAL',null,null,null,process_code,step_code,route_path,
 audience,document_set_hash,authority_hash,repeat('9',64),'GLOBAL_FIXTURE'
 from integrated_design_authority where process_code='RFP_TEST'"
shared_binding_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 '89898989-0000-0000-0000-000000000001','89898989-0000-0000-0000-000000000002',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$shared_binding_preview")" == BLOCKED ]] ||
  fail 'mixed GLOBAL/PROJECT integrated scope was not blocked'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["blockers"]["sharedIntegratedScopeCount"])' <<<"$shared_binding_preview")" == 1 ]] ||
  fail 'shared integrated scope blocker count drifted'
[[ "$(scalar "select xmin::text from integrated_design_authority where process_code='RFP_TEST'")" == "$integrated_xmin_before" ]] ||
  fail 'shared integrated scope preview changed authority xmin'
db -qc "delete from integrated_design_scope_binding where scope_type='GLOBAL'"

db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,
 document_set_hash,authority_hash,provenance_hash,bound_by)
select authority_id,2,'PROJECT','RFP-PURGE-001',1,repeat('a',64),
 process_code,step_code,route_path,audience,document_set_hash,repeat('8',64),
 repeat('8',64),'FORGED_FIXTURE' from integrated_design_authority
 where process_code='RFP_TEST'"
forged_binding_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 '87878787-0000-0000-0000-000000000001','87878787-0000-0000-0000-000000000002',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$forged_binding_preview")" == BLOCKED ]] ||
  fail 'forged integrated scope binding was not blocked'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["blockers"]["forgedIntegratedBindingCount"])' <<<"$forged_binding_preview")" == 1 ]] ||
  fail 'forged integrated binding blocker count drifted'
[[ "$(scalar "select xmin::text from integrated_design_authority where process_code='RFP_TEST'")" == "$integrated_xmin_before" ]] ||
  fail 'forged integrated binding preview changed authority xmin'
db -qc "delete from integrated_design_scope_binding where bound_by='FORGED_FIXTURE'"

# Authority hashes alone are insufficient ownership proof.  A copied binding
# must also name an existing immutable runtime release and carry the exact
# Java-stable provenance hash for that project/version/checksum tuple.
db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,
 document_set_hash,authority_hash,provenance_hash,bound_by)
select authority_id,3,'PROJECT','RFP-PURGE-001',4,repeat('c',64),
 process_code,step_code,route_path,audience,document_set_hash,authority_hash,
 framework_project_runtime_purge_integrated_provenance_hash(
   'PROJECT','RFP-PURGE-001',4::bigint,repeat('c',64),process_code,step_code,
   route_path,audience,authority_id,3::bigint,document_set_hash,authority_hash),
 'FORGED_VERSION_FIXTURE' from integrated_design_authority
 where process_code='RFP_TEST'"
forged_version_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 '81818181-0000-0000-0000-000000000001','81818181-0000-0000-0000-000000000002',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$forged_version_preview")" == BLOCKED ]] ||
  fail 'forged integrated design version was not blocked'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["blockers"]["forgedIntegratedBindingCount"])' <<<"$forged_version_preview")" == 1 ]] ||
  fail 'forged integrated design version count drifted'
[[ "$(scalar "select xmin::text from integrated_design_authority where process_code='RFP_TEST'")" == "$integrated_xmin_before" ]] ||
  fail 'forged design version preview changed authority xmin'
db -qc "delete from integrated_design_scope_binding where bound_by='FORGED_VERSION_FIXTURE'"

db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,
 document_set_hash,authority_hash,provenance_hash,bound_by)
select authority_id,3,'PROJECT','RFP-PURGE-001',1,repeat('c',64),
 process_code,step_code,route_path,audience,document_set_hash,authority_hash,
 framework_project_runtime_purge_integrated_provenance_hash(
   'PROJECT','RFP-PURGE-001',1::bigint,repeat('c',64),process_code,step_code,
   route_path,audience,authority_id,3::bigint,document_set_hash,authority_hash),
 'FORGED_CHECKSUM_FIXTURE' from integrated_design_authority
 where process_code='RFP_TEST'"
forged_checksum_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 '82828282-0000-0000-0000-000000000001','82828282-0000-0000-0000-000000000002',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$forged_checksum_preview")" == BLOCKED ]] ||
  fail 'forged integrated contract checksum was not blocked'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["blockers"]["forgedIntegratedBindingCount"])' <<<"$forged_checksum_preview")" == 1 ]] ||
  fail 'forged integrated checksum count drifted'
[[ "$(scalar "select xmin::text from integrated_design_authority where process_code='RFP_TEST'")" == "$integrated_xmin_before" ]] ||
  fail 'forged checksum preview changed authority xmin'
db -qc "delete from integrated_design_scope_binding where bound_by='FORGED_CHECKSUM_FIXTURE'"

db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,
 document_set_hash,authority_hash,provenance_hash,bound_by)
select authority_id,3,'PROJECT','RFP-PURGE-001',1,repeat('a',64),
 process_code,step_code,route_path,audience,document_set_hash,authority_hash,
 repeat('0',64),'FORGED_PROVENANCE_FIXTURE' from integrated_design_authority
 where process_code='RFP_TEST'"
forged_provenance_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 '83838383-0000-0000-0000-000000000001','83838383-0000-0000-0000-000000000002',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$forged_provenance_preview")" == BLOCKED ]] ||
  fail 'forged integrated provenance hash was not blocked'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["blockers"]["forgedIntegratedBindingCount"])' <<<"$forged_provenance_preview")" == 1 ]] ||
  fail 'forged integrated provenance count drifted'
[[ "$(scalar "select xmin::text from integrated_design_authority where process_code='RFP_TEST'")" == "$integrated_xmin_before" ]] ||
  fail 'forged provenance preview changed authority xmin'
db -qc "delete from integrated_design_scope_binding where bound_by='FORGED_PROVENANCE_FIXTURE'"

preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',
 'RFP-PURGE-001','RFP_TEST',3,repeat('a',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$preview")" == PREVIEWED ]] ||
  fail "preview failed: $preview"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["scopeMode"])' <<<"$preview")" == EXACT_PROJECT ]] ||
  fail 'explicit exact project scope drifted under testOwned provenance'
snapshot="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["snapshotSha256"])' <<<"$preview")"
[[ "$snapshot" =~ ^[0-9a-f]{64}$ ]] || fail 'snapshot hash invalid'
[[ "$(scalar "select count(*) from framework_project_runtime_purge_snapshot_row where receipt_id='aaaaaaaa-0000-0000-0000-000000000001' and table_name='framework_actor_process_design_release'")" == 3 ]] ||
  fail 'A-to-B-to-A release history was not captured'
[[ "$(scalar "select count(*) from framework_project_runtime_purge_snapshot_row where receipt_id='aaaaaaaa-0000-0000-0000-000000000001' and table_name='integrated_design_scope_binding'")" == 3 ]] ||
  fail 'A-to-B-to-A integrated binding history was not captured'
depth="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["impact"]["capturedDependencyMaxDepth"])' <<<"$preview")"
(( depth <= 32 )) || fail "captured FK depth exceeded bound: $depth"
state_a_hash="$(scalar "select test_live_purge_snapshot_hash('aaaaaaaa-0000-0000-0000-000000000001')")"
sequence_a_hash="$(scalar 'select test_runtime_sequence_hash()')"

# Session A holds the canonical purge key; session B must serialize behind it.
( db -qc "begin; select pg_advisory_xact_lock(hashtextextended(
 'PROJECT_RUNTIME_PURGE_V1:RFP-PURGE-001',0)); select pg_sleep(2); commit" >/dev/null ) &
locker_pid=$!
sleep 0.3
started_ns="$(date +%s%N)"
purged="$(db -Atqc "select framework_apply_project_runtime_purge(
 'aaaaaaaa-0000-0000-0000-000000000001','RFP-PURGE-001','RFP_TEST',3,
 repeat('a',64),'$snapshot','runtime.admin')" | tail -1)"
wait "$locker_pid"
elapsed_ms="$(( ( $(date +%s%N) - started_ns ) / 1000000 ))"
(( elapsed_ms >= 1200 )) || fail "two-session serialization missing: ${elapsed_ms}ms"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$purged")" == PURGED ]] ||
  fail "purge failed: $purged"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["operationKey"])' <<<"$purged")" == bbbbbbbb-0000-0000-0000-000000000001 ]] ||
  fail 'purge response omitted exact operation identity'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["postcondition"]["capturedEqualsDeleted"])' <<<"$purged")" == True ]] ||
  fail 'captured/deleted count equality missing'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["postcondition"]["residualScopeCounts"]["residualRows"])' <<<"$purged")" == 0 ]] ||
  fail 'independent residual scope count was not zero'
[[ "$(scalar "select count(*) from framework_process_definition where process_code='RFP_TEST'")" == 0 ]] ||
  fail 'process residue survived'
[[ "$(scalar "select count(*) from framework_actor_process_design_release where project_id='RFP-PURGE-001'")" == 0 ]] ||
  fail 'release residue survived'
[[ "$(scalar "select count(*) from framework_process_execution where project_id='RFP-PURGE-001'")" == 0 ]] ||
  fail 'execution residue survived'
[[ "$(scalar "select count(*) from framework_process_work_draft where project_id='RFP-PURGE-001'")" == 0 ]] ||
  fail 'draft residue survived'
[[ "$(scalar "select count(*) from framework_source_artifact")" == 0 ]] || fail 'source residue survived'
[[ "$(scalar "select count(*) from framework_runtime_resource")" == 0 ]] ||
  fail 'projected endpoint runtime resource residue survived'
[[ "$(scalar "select count(*) from framework_api_endpoint_registry")" == 0 ]] || fail 'endpoint residue survived'
[[ "$(scalar "select count(*) from integrated_design_document")" == 0 ]] ||
  fail 'integrated design document residue survived'
[[ "$(scalar "select count(*) from integrated_design_document_version")" == 0 ]] ||
  fail 'integrated design document version residue survived'
[[ "$(scalar "select count(*) from integrated_design_authority")" == 0 ]] ||
  fail 'integrated design authority residue survived'
[[ "$(scalar "select count(*) from integrated_design_authority_version")" == 0 ]] ||
  fail 'integrated design authority version residue survived'
[[ "$(scalar "select count(*) from integrated_design_scope_binding")" == 0 ]] ||
  fail 'integrated design scope binding residue survived'

purged_again="$(db -Atqc "select framework_apply_project_runtime_purge(
 'aaaaaaaa-0000-0000-0000-000000000001','RFP-PURGE-001','RFP_TEST',3,
 repeat('a',64),'$snapshot','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["idempotent"])' <<<"$purged_again")" == True ]] ||
  fail 'purge retry was not idempotent'

# The durable PURGED fence rejects a late writer after the runtime transaction
# has committed, before Backstage can delete its local project.
set +e
late_process_write="$(db -Atqc "insert into framework_process_definition values(
 'RFP_TEST','late','TEST','9.0.0','x','x','x','DRAFT','DRAFT',
 null,false,null,now(),now())" 2>&1)"
late_process_status=$?
set -e
(( late_process_status != 0 )) || fail 'PURGED fence admitted a late process writer'
grep -Fq 'durably purged' <<<"$late_process_write" ||
  fail 'PURGED fence denial reason drifted'
[[ "$(scalar "select count(*) from framework_process_definition where process_code='RFP_TEST'")" == 0 ]] ||
  fail 'PURGED fence denial wrote a process row'
expect_purged_fence 'design release writer' "insert into framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
 values('RFP-PURGE-001',4,repeat('d',64),
 '{\"process\":{\"processCode\":\"RFP_TEST\"},\"source\":{\"testOwned\":true}}','FAILED')"
expect_purged_fence 'development job writer' "insert into framework_development_job(
 job_id,process_code,step_code,created_by) values(9001,'RFP_TEST',null,'LATE_WRITER')"
expect_purged_fence 'execution writer' "insert into framework_process_execution values(
 '91919191-0000-0000-0000-000000000001','RFP-PURGE-001','RFP_TEST','STEP_A')"
expect_purged_fence 'draft writer' "insert into framework_process_work_draft values(
 '92929292-0000-0000-0000-000000000001','RFP-PURGE-001','RFP_TEST','STEP_A','{}','{}')"
expect_purged_fence 'assignment writer' "insert into framework_account_actor_assignment(
 assignment_id,project_id,account_id,actor_code)
 values(9001,'RFP-PURGE-001','late.writer','ACTOR_A')"
expect_purged_fence 'package binding writer' "insert into framework_screen_feature_binding
 values('RFP_TEST','STEP_A','LATE_PACKAGE')"
expect_purged_fence 'source writer' "insert into framework_source_artifact(
 source_artifact_id,source_path,ownership_mode,metadata_json)
 values(9001,'/generated/late.ts','GENERATED',
 '{\"projectId\":\"RFP-PURGE-001\",\"processCode\":\"RFP_TEST\"}')"
expect_purged_fence 'runtime resource writer' "insert into framework_runtime_resource(
 resource_id,resource_kind,resource_key,scope_code,contract_json)
 values(9001,'ENDPOINT','RFP_TEST:LATE:RUN','GLOBAL',
 '{\"endpointKey\":\"RFP_TEST:LATE:RUN\"}')"
expect_purged_fence 'endpoint writer' "insert into framework_api_endpoint_registry values(
 'RFP_TEST:LATE:RUN','POST','/api/generated/rfp-test/late','GeneratedLate#run')"
expect_purged_fence 'integrated design writer' "insert into integrated_design_document(
 document_id,process_code,step_code,route_path,audience,document_type,title,content)
 values(9001,'RFP_TEST','STEP_A','/rfp-test','USER','LATE','late','late')"
[[ "$(scalar "select count(*) from framework_runtime_resource where resource_key='RFP_TEST:LATE:RUN'")" == 0 ]] ||
  fail 'denied endpoint writer created a projected runtime resource'

# Simulate privileged out-of-band drift by temporarily disabling only the new
# fence trigger.  Ordinary writers cannot do this; restore must still fail
# atomically if physical state was changed outside the contract.
db -qc "alter table framework_process_definition
 disable trigger trg_project_runtime_write_fence;
insert into framework_process_definition values(
 'RFP_TEST','conflict','TEST','9.0.0','x','x','x','DRAFT','DRAFT',
 null,false,null,now(),now());
alter table framework_process_definition
 enable trigger trg_project_runtime_write_fence"
set +e
restore_failure="$(db -Atqc "select framework_restore_project_runtime_purge(
 'aaaaaaaa-0000-0000-0000-000000000001','RFP-PURGE-001','RFP_TEST',3,
 repeat('a',64),'$snapshot','runtime.admin')" 2>&1)"
restore_status=$?
set -e
(( restore_status != 0 )) || fail 'conflicting restore unexpectedly succeeded'
[[ "$(scalar "select receipt_status from framework_project_runtime_purge_receipt where receipt_id='aaaaaaaa-0000-0000-0000-000000000001'")" == PURGED ]] ||
  fail 'failed restore did not roll back receipt state'
[[ "$(scalar 'select count(*) from framework_process_step')" == 0 ]] ||
  fail 'failed restore left partial descendants'
db -qc "delete from framework_process_definition where process_code='RFP_TEST'"

# A non-conflicting row inserted after purge must also prevent a false A state.
# Restore inserts are rolled back, the receipt stays PURGED, and the unrelated
# drift row is left untouched for the caller to resolve explicitly.
db -qc "alter table framework_actor_process_design_release
 disable trigger trg_project_runtime_write_fence;
insert into framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
 values('RFP-PURGE-001',4,repeat('d',64),
 '{\"process\":{\"processCode\":\"RFP_TEST\"},\"source\":{\"testOwned\":true}}',
 'FAILED');
alter table framework_actor_process_design_release
 enable trigger trg_project_runtime_write_fence"
extra_release_xmin="$(scalar "select xmin::text from framework_actor_process_design_release where project_id='RFP-PURGE-001' and design_version=4")"
set +e
scope_restore_failure="$(db -Atqc "select framework_restore_project_runtime_purge(
 'aaaaaaaa-0000-0000-0000-000000000001','RFP-PURGE-001','RFP_TEST',3,
 repeat('a',64),'$snapshot','runtime.admin')" 2>&1)"
scope_restore_status=$?
set -e
(( scope_restore_status != 0 )) || fail 'restore accepted extra exact-scope row'
grep -Fq 'restore requires an exact-zero purged scope' <<<"$scope_restore_failure" ||
  fail 'restore scope-drift denial reason drifted'
[[ "$(scalar "select receipt_status from framework_project_runtime_purge_receipt where receipt_id='aaaaaaaa-0000-0000-0000-000000000001'")" == PURGED ]] ||
  fail 'scope-drift restore did not roll back receipt state'
[[ "$(scalar "select count(*) from framework_process_definition where process_code='RFP_TEST'")" == 0 ]] ||
  fail 'scope-drift restore left partial preimage rows'
[[ "$(scalar "select xmin::text from framework_actor_process_design_release where project_id='RFP-PURGE-001' and design_version=4")" == "$extra_release_xmin" ]] ||
  fail 'scope-drift restore changed extra row xmin'
db -qc "delete from framework_actor_process_design_release
 where project_id='RFP-PURGE-001' and design_version=4"

restored="$(db -Atqc "select framework_restore_project_runtime_purge(
 'aaaaaaaa-0000-0000-0000-000000000001','RFP-PURGE-001','RFP_TEST',3,
 repeat('a',64),'$snapshot','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$restored")" == RESTORED ]] ||
  fail "restore failed: $restored"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["aToBToA"])' <<<"$restored")" == True ]] ||
  fail 'A-to-B-to-A evidence missing'
[[ "$(scalar "select count(*) from framework_process_definition where process_code='RFP_TEST' and definition_locked")" == 1 ]] ||
  fail 'locked process was not restored exactly'
[[ "$(scalar "select count(*) from framework_process_execution_event")" == 1 ]] ||
  fail 'execution event was not restored'
[[ "$(scalar "select count(*) from integrated_design_document")" == 18 ]] ||
  fail '18/18 integrated design documents were not restored'
[[ "$(scalar "select count(*) from integrated_design_document_version")" == 18 ]] ||
  fail 'integrated design document versions were not restored'
[[ "$(scalar "select count(*) from integrated_design_authority")" == 1 ]] ||
  fail 'integrated design authority was not restored'
[[ "$(scalar "select count(*) from integrated_design_authority_version")" == 2 ]] ||
  fail 'integrated design authority version was not restored'
[[ "$(scalar "select count(*) from integrated_design_scope_binding")" == 3 ]] ||
  fail 'integrated design scope binding was not restored'
[[ "$(scalar "select count(*) from framework_actor_process_design_release where project_id='RFP-PURGE-001'")" == 3 ]] ||
  fail 'A-to-B-to-A release history was not restored'
[[ "$(scalar "select count(*) from pg_trigger where not tgisinternal and tgenabled<>'O' and tgrelid in ('framework_screen_blueprint'::regclass,'framework_api_endpoint_registry'::regclass)")" == 0 ]] ||
  fail 'runtime projection trigger state was not restored'
state_restored_hash="$(scalar "select test_live_purge_snapshot_hash('aaaaaaaa-0000-0000-0000-000000000001')")"
sequence_restored_hash="$(scalar 'select test_runtime_sequence_hash()')"
[[ "$state_restored_hash" == "$state_a_hash" ]] ||
  fail 'A-to-B-to-A live row hash mismatch'
[[ "$sequence_restored_hash" == "$sequence_a_hash" ]] ||
  fail 'A-to-B-to-A runtime sequence state changed'
db -qc "insert into framework_api_endpoint_registry values(
 'RFP_TEST:POST_RESTORE:RUN','POST','/api/generated/rfp-test/post-restore',
 'GeneratedPostRestore#run');
delete from framework_api_endpoint_registry
 where endpoint_key='RFP_TEST:POST_RESTORE:RUN';
delete from framework_runtime_resource
 where resource_kind='ENDPOINT' and scope_code='GLOBAL'
   and resource_key='RFP_TEST:POST_RESTORE:RUN'"

# RESTORING is also an exact receipt state. Exercise the guard path under a
# rollback so the restored A state remains byte-identical for later checks.
db -qc "begin;
 update framework_project_runtime_purge_receipt set receipt_status='RESTORING'
  where receipt_id='aaaaaaaa-0000-0000-0000-000000000001';
 select set_config('carbonet.project_runtime_purge_receipt',
  'aaaaaaaa-0000-0000-0000-000000000001',true);
 delete from framework_simulation_case where process_code='RFP_TEST';
 rollback"
[[ "$(scalar "select count(*) from framework_simulation_case where process_code='RFP_TEST'")" == 1 ]] ||
  fail 'RESTORING guard regression rollback changed locked simulation'

# LIKE wildcard semantics must never widen an exact endpoint identity. RFP_A
# is purged while the colliding RFPXA endpoint retains its row hash and xmin.
db <<'SQL'
INSERT INTO framework_process_definition VALUES
 ('RFP_A','wildcard exact','TEST','1.0.0','g','s','d','ACTIVE','ACTIVE',
  NULL,false,NULL,now(),now());
INSERT INTO framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
VALUES('RFP-PURGE-LIKE',1,repeat('f',64),
 '{"process":{"processCode":"RFP_A"},"source":{"testOwned":true}}','APPLIED');
INSERT INTO framework_api_endpoint_registry VALUES
 ('RFP_A:STEP:RUN','POST','/api/generated/rfp-a/run','GeneratedRfpA#run'),
 ('RFPXA:STEP:RUN','POST','/api/generated/rfpxa/run','GeneratedRfpXa#run');
SQL
endpoint_collision_xmin="$(scalar "select xmin::text from framework_api_endpoint_registry where endpoint_key='RFPXA:STEP:RUN'")"
endpoint_collision_hash="$(scalar "select md5(to_jsonb(endpoint)::text) from framework_api_endpoint_registry endpoint where endpoint_key='RFPXA:STEP:RUN'")"
endpoint_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 'abababab-0000-0000-0000-000000000001','abababab-0000-0000-0000-000000000002',
 'RFP-PURGE-LIKE','RFP_A',1,repeat('f',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$endpoint_preview")" == PREVIEWED ]] ||
  fail "exact endpoint preview failed: $endpoint_preview"
endpoint_snapshot="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["snapshotSha256"])' <<<"$endpoint_preview")"
[[ "$(scalar "select count(*) from framework_project_runtime_purge_snapshot_row where receipt_id='abababab-0000-0000-0000-000000000001' and table_name='framework_api_endpoint_registry'")" == 1 ]] ||
  fail 'endpoint delimiter mutant captured a colliding process'
endpoint_purged="$(db -Atqc "select framework_apply_project_runtime_purge(
 'abababab-0000-0000-0000-000000000001','RFP-PURGE-LIKE','RFP_A',1,
 repeat('f',64),'$endpoint_snapshot','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$endpoint_purged")" == PURGED ]] ||
  fail "exact endpoint purge failed: $endpoint_purged"
[[ "$(scalar "select count(*) from framework_api_endpoint_registry where endpoint_key='RFP_A:STEP:RUN'")" == 0 ]] ||
  fail 'exact endpoint survived purge'
[[ "$(scalar "select xmin::text from framework_api_endpoint_registry where endpoint_key='RFPXA:STEP:RUN'")" == "$endpoint_collision_xmin" ]] ||
  fail 'endpoint delimiter mutant changed colliding xmin'
[[ "$(scalar "select md5(to_jsonb(endpoint)::text) from framework_api_endpoint_registry endpoint where endpoint_key='RFPXA:STEP:RUN'")" == "$endpoint_collision_hash" ]] ||
  fail 'endpoint delimiter mutant changed colliding row hash'

# A MANUAL screen is visible in dry-run impact, but no runtime row is changed.
db <<'SQL'
INSERT INTO framework_process_definition VALUES
 ('RFP_MANUAL','manual','TEST','1.0.0','g','s','d','ACTIVE','ACTIVE',
  NULL,false,NULL,now(),now());
INSERT INTO framework_process_step(process_code,step_code,step_order,actor_code,
 step_name,from_state,command_code,to_state,decision_rule)
VALUES('RFP_MANUAL','STEP_M',1,'ACTOR_M','Manual','READY','SAVE','DONE',
 'SOURCE:REQUIREMENT_DOCUMENT');
INSERT INTO framework_screen_blueprint(process_code,step_code,created_by)
VALUES('RFP_MANUAL','STEP_M','BACKSTAGE_REQUIREMENT_AUTOMATION');
INSERT INTO framework_screen_generation_state
SELECT blueprint_id,'MANUAL' FROM framework_screen_blueprint
 WHERE process_code='RFP_MANUAL'
ON CONFLICT(blueprint_id) DO UPDATE
 SET ownership_mode=excluded.ownership_mode;
INSERT INTO framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
VALUES('RFP-PURGE-MANUAL',1,repeat('c',64),
 '{"process":{"processCode":"RFP_MANUAL"},"source":{"testOwned":true}}','APPLIED');
SQL
manual_before="$(scalar "select count(*) from framework_screen_blueprint where process_code='RFP_MANUAL'")"
manual_xmin_before="$(scalar "select state.xmin::text from framework_screen_generation_state state join framework_screen_blueprint blueprint using(blueprint_id) where blueprint.process_code='RFP_MANUAL'")"
manual_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 'cccccccc-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',
 'RFP-PURGE-MANUAL','RFP_MANUAL',1,repeat('c',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$manual_preview")" == BLOCKED ]] ||
  fail 'MANUAL preview was not blocked'
[[ "$(scalar "select count(*) from framework_screen_blueprint where process_code='RFP_MANUAL'")" == "$manual_before" ]] ||
  fail 'MANUAL preview changed runtime rows'
[[ "$(scalar "select state.xmin::text from framework_screen_generation_state state join framework_screen_blueprint blueprint using(blueprint_id) where blueprint.process_code='RFP_MANUAL'")" == "$manual_xmin_before" ]] ||
  fail 'MANUAL preview changed runtime xmin'

# A VERIFIED job is evidence that files/git/deployment may exist.  Without an
# exact external rollback receipt the preview must block and leave runtime xmin
# unchanged even though every DB row is generator-owned.
db <<'SQL'
INSERT INTO framework_process_definition VALUES
 ('RFP_MATERIAL','materialized','TEST','1.0.0','g','s','d','ACTIVE','ACTIVE',
  NULL,false,NULL,now(),now());
INSERT INTO framework_process_step(process_code,step_code,step_order,actor_code,
 step_name,from_state,command_code,to_state,decision_rule)
VALUES('RFP_MATERIAL','STEP_X',1,'ACTOR_X','Generated','READY','RUN','DONE',
 'SOURCE:REQUIREMENT_DOCUMENT');
INSERT INTO framework_development_job(process_code,step_code,created_by,job_status)
VALUES('RFP_MATERIAL','STEP_X','BACKSTAGE_CONTROL_PLANE','VERIFIED');
INSERT INTO framework_source_artifact(source_path,ownership_mode,metadata_json)
VALUES('/generated/rfp-material.ts','GENERATED',
 '{"projectId":"RFP-PURGE-MATERIAL","processCode":"RFP_MATERIAL"}');
INSERT INTO framework_source_materialization_state(
 source_artifact_id,materialized_hash,sync_status,materialized_at)
SELECT source_artifact_id,repeat('7',64),'DIRTY',now()
  FROM framework_source_artifact WHERE source_path='/generated/rfp-material.ts';
INSERT INTO framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
VALUES('RFP-PURGE-MATERIAL',1,repeat('e',64),
 '{"process":{"processCode":"RFP_MATERIAL"},"source":{"testOwned":true}}','APPLIED');
SQL
material_xmin_before="$(scalar "select xmin::text from framework_development_job where process_code='RFP_MATERIAL'")"
material_preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 'eeeeeeee-0000-0000-0000-000000000001','ffffffff-0000-0000-0000-000000000001',
 'RFP-PURGE-MATERIAL','RFP_MATERIAL',1,repeat('e',64),'EXACT_PROJECT','runtime.admin')" | tail -1)"
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$material_preview")" == BLOCKED ]] ||
  fail 'VERIFIED materialization preview was not blocked'
[[ "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["blockers"]["materializedArtifactBlockerCount"])' <<<"$material_preview")" == 2 ]] ||
  fail 'VERIFIED materialization blocker count drifted'
[[ "$(scalar "select xmin::text from framework_development_job where process_code='RFP_MATERIAL'")" == "$material_xmin_before" ]] ||
  fail 'VERIFIED materialization preview changed runtime xmin'

audit_events="$(scalar "select string_agg(event_type,',' order by audit_id) from framework_project_runtime_purge_audit where receipt_id='aaaaaaaa-0000-0000-0000-000000000001'")"
[[ "$audit_events" == 'PREVIEWED,PURGED,RESTORED' ]] || fail "audit chain drift: $audit_events"

printf 'PROJECT_RUNTIME_PURGE_POSTGRES_PASS previewRows=%s depth=%s purgeSerializedMs=%s absenceSerializedMs=%s releases=3 bindings=3 purgedFenceWriters=11 purge=0 restore=A hash=A sequence=A rollback=atomic manualWrite=0 materialWrite=0 audit=%s\n' \
  "$(python3 -c 'import json,sys; print(json.load(sys.stdin)["impact"]["totalRows"])' <<<"$preview")" \
  "$depth" "$elapsed_ms" "$absence_writer_elapsed_ms" "$audit_events"
