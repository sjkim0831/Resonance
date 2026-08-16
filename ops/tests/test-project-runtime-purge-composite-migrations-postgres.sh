#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PREREQUISITES="$ROOT/ops/tests/fixtures/project-runtime-purge-composite-prerequisites.sql"
DEVELOPMENT_JOB_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260714005000__automate_process_development.sql"
DEVELOPMENT_ORCHESTRATION_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260714006000__orchestrate_development_jobs.sql"
DEVELOPMENT_QUALITY_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260714009000__govern_parallel_development_quality.sql"
DOCUMENT_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260728170000__create_integrated_design_document_registry.sql"
QA_EVIDENCE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260806153000__add_process_qa_run.sql"
RUNTIME_RELEASE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260807052000__bind_business_e2e_evidence_to_current_contract.sql"
POSTDEPLOY_EVIDENCE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812023000__stage_and_atomically_promote_postdeploy_evidence.sql"
POSTDEPLOY_ATTEMPT_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812080000__bind_postdeploy_attempt_lifecycle.sql"
PURGE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816134500__install_project_runtime_purge_restore_contract.sql"
FENCE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816153500__reinstall_project_runtime_write_fences.sql"
COMPOSITE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql"
IMAGE="${PROJECT_PURGE_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER_ID="codex-project-composite-purge-$RANDOM-$$"
PASSWORD="project-composite-purge-$RANDOM"
PORT=""
started=0

fail() { printf 'PROJECT_RUNTIME_PURGE_COMPOSITE_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  set +e
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

for required in "$PREREQUISITES" "$DEVELOPMENT_JOB_MIGRATION" \
  "$DEVELOPMENT_ORCHESTRATION_MIGRATION" "$DEVELOPMENT_QUALITY_MIGRATION" \
  "$DOCUMENT_MIGRATION" "$QA_EVIDENCE_MIGRATION" \
  "$RUNTIME_RELEASE_MIGRATION" "$POSTDEPLOY_EVIDENCE_MIGRATION" \
  "$POSTDEPLOY_ATTEMPT_MIGRATION" "$PURGE_MIGRATION" \
  "$FENCE_MIGRATION" "$COMPOSITE_MIGRATION"; do
  [[ -f "$required" ]] || fail "required SQL missing: $required"
done
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
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=purge_composite \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER_ID"
started=1
export PGPASSWORD="$PASSWORD"
psql_base=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d purge_composite -X)
for _ in $(seq 1 40); do
  "${psql_base[@]}" -Atqc 'select 1' >/dev/null 2>&1 && break
  sleep 1
done
[[ "$("${psql_base[@]}" -Atqc 'select 1')" == 1 ]] || fail 'postgres readiness timeout'
db() { "${psql_base[@]}" -v ON_ERROR_STOP=1 "$@"; }
scalar() { "${psql_base[@]}" -v ON_ERROR_STOP=1 -Atqc "$1"; }
json_field() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }

started_ns="$(date +%s%N)"
db -f "$PREREQUISITES" >/dev/null
db -f "$DEVELOPMENT_JOB_MIGRATION" >/dev/null
db -f "$DEVELOPMENT_ORCHESTRATION_MIGRATION" >/dev/null
db -f "$DEVELOPMENT_QUALITY_MIGRATION" >/dev/null
db -f "$DOCUMENT_MIGRATION" >/dev/null
# V154000's current-runtime binding uses the production release ledger created
# by these two earlier migrations.  Keep the real DDL in timestamp order; only
# defer unrelated SQL-function body resolution because this focused fixture
# intentionally omits the full page/flow/handoff catalog.
db -f "$QA_EVIDENCE_MIGRATION" >/dev/null
db -c 'set check_function_bodies=off' -f "$RUNTIME_RELEASE_MIGRATION" >/dev/null
db -f "$POSTDEPLOY_EVIDENCE_MIGRATION" >/dev/null
db -f "$POSTDEPLOY_ATTEMPT_MIGRATION" >/dev/null
db -f "$PURGE_MIGRATION" >/dev/null
db -f "$FENCE_MIGRATION" >/dev/null
# This purge-focused fixture does not reproduce every production design-asset
# column consumed by compiler-only fingerprint functions.  Defer those bodies
# while still applying the complete real migration and exercising its physical
# tables, triggers and purge/restore graph below.
db -c 'set check_function_bodies=off' -f "$COMPOSITE_MIGRATION" >/dev/null
migration_ms="$(( ( $(date +%s%N) - started_ns ) / 1000000 ))"

[[ "$(scalar "select count(*) from pg_class where oid='framework_runtime_release_state'::regclass")" == 1 ]] ||
  fail 'actual runtime release dependency migration was not applied'

missing_fences="$(scalar "select count(*) from pg_class relation
 join pg_namespace namespace on namespace.oid=relation.relnamespace
 where namespace.nspname='public' and relation.relkind in('r','p')
   and not relation.relispartition
   and relation.relname like 'integrated_design\\_%' escape '\\'
   and exists(select 1 from pg_attribute attribute
     where attribute.attrelid=relation.oid
       and attribute.attname in('project_id','process_code')
       and attribute.attnum>0 and not attribute.attisdropped)
   and (select count(*) from pg_trigger trigger_row
         where trigger_row.tgrelid=relation.oid
           and trigger_row.tgname='trg_project_runtime_write_fence'
           and trigger_row.tgfoid=to_regprocedure('framework_guard_project_runtime_write_fence()')
           and trigger_row.tgenabled<>'D' and trigger_row.tgtype=23
           and not trigger_row.tgisinternal)<>1")"
[[ "$missing_fences" == 0 ]] || fail "V154000 integrated fence coverage missing=$missing_fences"
integrated_fence_count="$(scalar "select count(*) from pg_class relation
 join pg_namespace namespace on namespace.oid=relation.relnamespace
 where namespace.nspname='public' and relation.relkind in('r','p')
   and relation.relname like 'integrated_design\\_%' escape '\\'
   and exists(select 1 from pg_attribute attribute
     where attribute.attrelid=relation.oid
       and attribute.attname in('project_id','process_code')
       and attribute.attnum>0 and not attribute.attisdropped)")"
[[ "$(scalar "select count(*) from pg_trigger trigger_row
 where trigger_row.tgname='trg_project_runtime_write_fence'
   and trigger_row.tgrelid in('integrated_design_live_smoke_evidence'::regclass,
                              'integrated_design_live_smoke_dispatch'::regclass)
   and trigger_row.tgenabled='O' and not trigger_row.tgisinternal")" == 2 ]] ||
  fail 'live evidence/dispatch fences are not installed and enabled'

db <<'SQL'
CREATE OR REPLACE FUNCTION test_composite_purge_live_set_hash(requested_receipt uuid)
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

CREATE OR REPLACE FUNCTION test_composite_purge_sequence_hash()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE sequence_row record; sequence_last bigint; sequence_called boolean;
DECLARE canonical_rows jsonb:='[]'::jsonb;
BEGIN
  FOR sequence_row IN
    SELECT relation.oid,relation.relname
      FROM pg_class relation JOIN pg_namespace namespace
        ON namespace.oid=relation.relnamespace
     WHERE namespace.nspname='public' AND relation.relkind='S'
       AND (relation.relname LIKE 'framework\_%' ESCAPE '\'
         OR relation.relname LIKE 'integrated_design\_%' ESCAPE '\')
       AND relation.relname NOT LIKE 'framework_project_runtime_purge_%'
     ORDER BY relation.relname COLLATE "C"
  LOOP
    EXECUTE format('select last_value,is_called from %s',sequence_row.oid::regclass)
      INTO sequence_last,sequence_called;
    canonical_rows:=canonical_rows||jsonb_build_array(jsonb_build_object(
      'sequence',sequence_row.relname,'lastValue',sequence_last,'isCalled',sequence_called));
  END LOOP;
  RETURN framework_project_runtime_purge_hash(canonical_rows);
END $$;

INSERT INTO framework_process_definition(
 process_code,process_name,domain_code,owner_actor_code,process_version,goal,
 start_condition,completion_condition,process_status,lifecycle_status)
VALUES('RFP_COMPOSITE','Composite purge','TEST','ACTOR_A','1.0.0','goal',
 'start','done','ACTIVE','ACTIVE');
INSERT INTO framework_process_step(
 process_code,step_code,step_order,actor_code,step_name,command_code,from_state,
 to_state,completion_rule,decision_rule,requires_notification,input_contract,
 output_contract,requires_user_page,requires_admin_page,user_path,admin_path)
VALUES('RFP_COMPOSITE','STEP_A',1,'ACTOR_A','Step A','SAVE','DRAFT','DONE',
 'saved','SOURCE:REQUIREMENT_DOCUMENT',false,'{"name":"string"}',
 '{"id":"integer"}',true,false,'/rfp-composite',null);
INSERT INTO framework_screen_resource(route_key,layout_type)
VALUES('/rfp-composite','KRDS_WORKSPACE');
INSERT INTO framework_process_step_screen_binding(
 process_code,step_code,screen_resource_id,actor_code,audience,binding_status)
SELECT 'RFP_COMPOSITE','STEP_A',screen_resource_id,'ACTOR_A','USER','ACTIVE'
  FROM framework_screen_resource WHERE route_key='/rfp-composite';
INSERT INTO comtnthemedefinition VALUES('KRDS_GOV_DEFAULT','Y','Y');
INSERT INTO ui_section_registry VALUES('MAIN','Y');
INSERT INTO ui_component_registry VALUES('JSON_FORM','JSON_FORM','Y');
INSERT INTO framework_professional_screen_contract(
 process_code,step_code,route_path,audience,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
 command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,permission_codes,
 api_verified,database_verified,authority_verified,responsive_verified,
 accessibility_verified,exception_states_verified,audit_evidence_ref,updated_by)
VALUES('RFP_COMPOSITE','STEP_A','/rfp-composite','USER','ACTOR_A',
 'Complete governed work','draft exists','record saved','[]',
 '[{"sectionId":"MAIN","componentCodes":["JSON_FORM"]}]',
 '[{"fieldCode":"name","direction":"INPUT","dataSource":"ITEM"},'
  '{"fieldCode":"id","direction":"OUTPUT","dataSource":"ITEM"}]',
 '[{"commandCode":"SAVE","actorCode":"ACTOR_A","primary":true}]',
 '[{"fromState":"DRAFT","commandCode":"SAVE","toState":"DONE"}]',
 '[{"method":"POST","path":"/api/actual/items","commandCode":"SAVE",'
  '"requestFields":["name"],"responseFields":["id"],'
  '"permissionCodes":["PERM_SAVE"]}]',
 '[{"entity":"ITEM","fields":["name","id"]}]',
 '[{"evidenceType":"E2E","reference":"evidence://save"}]',
 '360 768 1280','KRDS WCAG AA','server actor scope','["PERM_SAVE"]',
 true,true,true,true,true,true,'audit://save','TEST');
INSERT INTO framework_screen_blueprint(
 process_code,step_code,audience,route_path,actor_code,validation_status,
 transition_status,source_reference,implementation_strategy,specification_json,created_by)
VALUES('RFP_COMPOSITE','STEP_A','USER','/rfp-composite','ACTOR_A','VALID',
 'GENERATED','','GENERATED_RUNTIME',
 '{"layout":"KRDS_WORKSPACE","theme":"KRDS_GOV_DEFAULT",'
 '"assetBindings":[{"assetType":"THEME","assetCode":"KRDS_GOV_DEFAULT"},'
 '{"assetType":"SECTION","assetCode":"MAIN"},'
 '{"assetType":"COMPONENT","assetCode":"JSON_FORM"}]}',
 'BACKSTAGE_REQUIREMENT_AUTOMATION');
INSERT INTO framework_screen_generation_state(blueprint_id,ownership_mode)
SELECT blueprint_id,'GENERATED' FROM framework_screen_blueprint
 WHERE process_code='RFP_COMPOSITE';
INSERT INTO framework_development_job(
 process_code,step_code,job_type,job_name,specification_json,job_group_code,
 created_by,job_status,quality_status,result_json)
VALUES('RFP_COMPOSITE','STEP_A','FULL_STACK_GENERATION',
 'Composite authority generation',
 jsonb_build_object('processInputHash',repeat('3',64))::text,
 'RFP_COMPOSITE_CANONICAL_PUBLICATION','BACKSTAGE_REQUIREMENT_AUTOMATION',
 'PLANNED','PENDING','{}');
INSERT INTO framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
VALUES('RFP-COMPOSITE-001',1,repeat('a',64),
 '{"process":{"processCode":"RFP_COMPOSITE"},"source":{"testOwned":true}}',
 'APPLIED');

INSERT INTO integrated_design_document(
 process_code,step_code,route_path,audience,document_type,title,content,status,updated_by)
SELECT 'RFP_COMPOSITE','STEP_A','/rfp-composite','USER',axis,axis,
       jsonb_build_object('axis',axis,'fixture','PROJECT')::text,'IN_REVIEW','TEST'
  FROM unnest(ARRAY['REQUIREMENT','ACTOR_RACI','AUTHORITY','PROCESS','STATE','NAVIGATION',
    'ACTIVE_UI','DESIGN_ASSET','FIELD_DICTIONARY','DATA_HANDOFF','DATABASE','API',
    'BUSINESS_RULE','VALIDATION','NOTIFICATION','TEST','TASK_EVIDENCE','RELEASE_AUDIT']) axis;
INSERT INTO integrated_design_document_version(
 document_id,revision,title,content,status,archived_by)
SELECT document_id,revision,title,content,status,'TEST'
  FROM integrated_design_document WHERE process_code='RFP_COMPOSITE';

INSERT INTO integrated_design_authority(
 process_code,step_code,route_path,audience,contract_id,selected_blueprint_id,
 ownership_strategy,document_set_hash,authority_hash,composite_json,source_hash,
 design_set_hash,design_catalog_hash,endpoint_catalog_hash,package_binding_hash,
 job_id,activation_policy,updated_by)
SELECT 'RFP_COMPOSITE','STEP_A','/rfp-composite','USER',contract.contract_id,
 blueprint.blueprint_id,'EXACT_SINGLE',repeat('1',64),repeat('2',64),
 jsonb_build_object('schema','carbonet.composite-executable-design-authority/v1',
   'activationPolicy','SOURCE_IMMEDIATE_V1','axes',
   (SELECT jsonb_agg(value) FROM generate_series(1,18) value)),
 repeat('3',64),repeat('4',64),repeat('5',64),repeat('6',64),repeat('7',64),
 job.job_id,'SOURCE_IMMEDIATE_V1','TEST'
 FROM framework_professional_screen_contract contract
 CROSS JOIN framework_screen_blueprint blueprint
 CROSS JOIN framework_development_job job
 WHERE contract.process_code='RFP_COMPOSITE'
   AND blueprint.process_code='RFP_COMPOSITE' AND job.process_code='RFP_COMPOSITE';
INSERT INTO integrated_design_authority_version(
 authority_id,authority_revision,document_set_hash,authority_hash,composite_json,
 source_hash,design_set_hash,design_catalog_hash,endpoint_catalog_hash,
 package_binding_hash,job_id,archived_by)
SELECT authority_id,authority_revision,document_set_hash,authority_hash,composite_json,
 source_hash,design_set_hash,design_catalog_hash,endpoint_catalog_hash,
 package_binding_hash,job_id,'TEST' FROM integrated_design_authority
 WHERE process_code='RFP_COMPOSITE';
INSERT INTO integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,document_set_hash,
 authority_hash,provenance_hash,bound_by)
SELECT authority_id,authority_revision,'PROJECT','RFP-COMPOSITE-001',1,repeat('a',64),
 process_code,step_code,route_path,audience,document_set_hash,authority_hash,
 framework_project_runtime_purge_integrated_provenance_hash(
   'PROJECT','RFP-COMPOSITE-001',1,repeat('a',64),process_code,step_code,
   route_path,audience,authority_id,authority_revision,document_set_hash,authority_hash),
 'TEST' FROM integrated_design_authority WHERE process_code='RFP_COMPOSITE';

INSERT INTO integrated_design_live_smoke_dispatch(
 job_id,process_code,project_id,runtime_commit,runtime_identity_hash,canary_attempt,
 authority_revision_set_hash,artifact_manifest_hash,process_source_hash,expected_evidence_count)
SELECT job_id,process_code,'RFP-COMPOSITE-001',repeat('a',40),repeat('b',64),0,
 framework_composite_authority_revision_set_hash(job_id),repeat('8',64),source_hash,15
 FROM integrated_design_authority WHERE process_code='RFP_COMPOSITE';

WITH base AS (
 SELECT dispatch.dispatch_id,authority.job_id,authority.authority_id,
   authority.authority_revision,authority.process_code,authority.step_code,
   authority.route_path,authority.audience,
   'API'::text lane,'SUCCESS'::text status_case,'SAVE_SUCCESS'::text scenario_code,
   'actor.account'::text account_id,'TENANT_TEST'::text tenant_id,
   'RFP-COMPOSITE-001'::text project_id,'ACTOR_A'::text actor_code,
   'SAVE'::text command_code,'{"name":"A"}'::jsonb input_json,
   '{"id":1,"status":"SUCCESS"}'::jsonb output_json,'DRAFT'::text from_state,
   'DONE'::text to_state,'DONE'::text observed_state,'SUCCESS'::text expected_status,
   'SUCCESS'::text observed_status,source_hash,authority_hash,
   'http://runtime/api/actual/items'::text target_ref,
   '{"httpStatus":200}'::jsonb lane_evidence,'evidence://api/save'::text evidence_ref
 FROM integrated_design_authority authority
 JOIN integrated_design_live_smoke_dispatch dispatch USING(job_id,process_code)
 WHERE authority.process_code='RFP_COMPOSITE'
), hashed AS (
 SELECT *,
   framework_composite_live_smoke_hash(jsonb_build_object('accountId',account_id,
     'tenantId',tenant_id,'projectId',project_id,'actorCode',actor_code)) account_hash,
   framework_composite_live_smoke_hash(jsonb_build_object('commandCode',command_code)) command_hash,
   framework_composite_live_smoke_hash(input_json) input_hash,
   framework_composite_live_smoke_hash(output_json) output_hash,
   framework_composite_live_smoke_hash(jsonb_build_object('fromState',from_state,
     'toState',to_state,'observedState',observed_state)) state_hash,
   framework_composite_live_smoke_hash(jsonb_build_object('expectedStatus',expected_status,
     'observedStatus',observed_status)) status_hash,
   framework_composite_live_smoke_hash(lane_evidence) lane_evidence_hash
 FROM base
), complete AS (
 SELECT *,framework_composite_live_smoke_hash(jsonb_build_object(
   'schema','carbonet.composite-live-smoke-evidence/v1','dispatchId',dispatch_id,'jobId',job_id,
   'authorityId',authority_id,'authorityRevision',authority_revision,
   'processCode',process_code,'stepCode',step_code,'routePath',route_path,
   'audience',audience,'lane',lane,'statusCase',status_case,
   'scenarioCode',scenario_code,'accountHash',account_hash,'commandHash',command_hash,
   'inputHash',input_hash,'outputHash',output_hash,'stateHash',state_hash,
   'statusHash',status_hash,'sourceHash',source_hash,'authorityHash',authority_hash,
   'targetRef',target_ref,'laneEvidenceHash',lane_evidence_hash,'evidenceRef',evidence_ref
 )) evidence_hash FROM hashed
)
INSERT INTO integrated_design_live_smoke_evidence(
 dispatch_id,job_id,authority_id,authority_revision,process_code,step_code,route_path,audience,lane,
 status_case,scenario_code,account_id,tenant_id,project_id,actor_code,command_code,
 input_json,output_json,from_state,to_state,observed_state,expected_status,observed_status,
 source_hash,authority_hash,target_ref,lane_evidence,account_hash,command_hash,input_hash,
 output_hash,state_hash,status_hash,lane_evidence_hash,evidence_hash,evidence_ref,
 recorded_by,observed_at)
SELECT dispatch_id,job_id,authority_id,authority_revision,process_code,step_code,route_path,audience,lane,
 status_case,scenario_code,account_id,tenant_id,project_id,actor_code,command_code,
 input_json,output_json,from_state,to_state,observed_state,expected_status,observed_status,
 source_hash,authority_hash,target_ref,lane_evidence,account_hash,command_hash,input_hash,
 output_hash,state_hash,status_hash,lane_evidence_hash,evidence_hash,evidence_ref,
 'TEST',clock_timestamp() FROM complete;
INSERT INTO integrated_design_autocompletion_receipt(
 process_code,completion_status,job_id,dependency_fingerprint,receipt_json)
SELECT 'RFP_COMPOSITE','SOURCE_APPLIED_PHYSICAL_QUEUED',job_id,repeat('9',64),
 '{"fixture":"PROJECT"}' FROM framework_development_job
 WHERE process_code='RFP_COMPOSITE';

INSERT INTO framework_process_execution(
 execution_id,project_id,process_code,current_step_code)
VALUES('50000000-0000-0000-0000-000000000001','RFP-COMPOSITE-001',
 'RFP_COMPOSITE','STEP_A');
INSERT INTO framework_process_execution_event(execution_id,result_json)
VALUES('50000000-0000-0000-0000-000000000001','{"status":"SUCCESS"}');
INSERT INTO integrated_design_notification_template(
 template_code,title_template,message_template,updated_by)
VALUES('SAVE_COMPLETE','Saved','The record was saved.','TEST');
INSERT INTO integrated_design_notification_outbox(
 authority_id,authority_revision,authority_hash,execution_id,event_id,tenant_id,
 project_id,process_code,step_code,command_code,event_code,channel,
 recipient_actor_code,template_code,payload_hash)
SELECT authority.authority_id,authority.authority_revision,authority.authority_hash,
 execution.execution_id,event.event_id,'TENANT_TEST','RFP-COMPOSITE-001',
 'RFP_COMPOSITE','STEP_A','SAVE','SAVE_COMPLETE','IN_APP','ACTOR_A',
 'SAVE_COMPLETE',repeat('d',64)
 FROM integrated_design_authority authority
 CROSS JOIN framework_process_execution execution
 CROSS JOIN framework_process_execution_event event
 WHERE authority.process_code='RFP_COMPOSITE'
   AND execution.process_code='RFP_COMPOSITE'
   AND event.execution_id=execution.execution_id;
INSERT INTO integrated_design_notification_inbox(
 notification_id,tenant_id,project_id,account_id,actor_code,payload_hash,
 title,message_text,target_url)
SELECT notification_id,'TENANT_TEST','RFP-COMPOSITE-001','actor.account','ACTOR_A',
 repeat('d',64),'Saved','The record was saved.','/rfp-composite'
 FROM integrated_design_notification_outbox WHERE process_code='RFP_COMPOSITE';
SQL

authority_id="$(scalar "select authority_id from integrated_design_authority where process_code='RFP_COMPOSITE'")"
job_id="$(scalar "select job_id from framework_development_job where process_code='RFP_COMPOSITE'")"
authority_revision="$(scalar "select authority_revision from integrated_design_authority where authority_id=$authority_id")"
document_set_hash="$(scalar "select document_set_hash from integrated_design_authority where authority_id=$authority_id")"
authority_hash="$(scalar "select authority_hash from integrated_design_authority where authority_id=$authority_id")"

absence_proof="$(db -Atqc "select framework_prove_project_runtime_absent(
 '60000000-0000-0000-0000-000000000001','RFP-COMPOSITE-001',
 'runtime.composite.admin')" | tail -1)"
[[ "$(json_field '["status"]' <<<"$absence_proof")" == BLOCKED ]] ||
  fail 'V154000 project rows escaped runtime absence proof'
[[ "$(json_field '["projectScopedRows"]' <<<"$absence_proof")" == 7 ]] ||
  fail "V154000 absence project-row catalog drifted: $absence_proof"

negative_preview() {
  local receipt="$1" operation="$2" label="$3" field="$4" expected="$5" result
  result="$(db -Atqc "select framework_preview_project_runtime_purge(
    '$receipt','$operation','RFP-COMPOSITE-001','RFP_COMPOSITE',1,
    repeat('a',64),'EXACT_PROJECT','runtime.composite.admin')" | tail -1)"
  [[ "$(json_field '["status"]' <<<"$result")" == BLOCKED ]] ||
    fail "$label binding was not blocked: $result"
  [[ "$(json_field "[\"blockers\"][\"$field\"]" <<<"$result")" == "$expected" ]] ||
    fail "$label blocker $field drifted: $result"
}

# GLOBAL, another project, and forged provenance must never be inferred as
# ownership of the exact requested project.
db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,document_set_hash,
 authority_hash,provenance_hash,bound_by)
 values($authority_id,$authority_revision,'GLOBAL',null,null,null,'RFP_COMPOSITE',
 'STEP_A','/rfp-composite','USER','$document_set_hash','$authority_hash',repeat('b',64),'GLOBAL_TEST')"
negative_preview '10000000-0000-0000-0000-000000000001' \
  '20000000-0000-0000-0000-000000000001' GLOBAL sharedIntegratedScopeCount 1
db -qc "delete from integrated_design_scope_binding where bound_by='GLOBAL_TEST'"

db -qc "insert into framework_actor_process_design_release(
 project_id,design_version,contract_sha256,contract_payload,release_status)
 values('RFP-COMPOSITE-OTHER',1,repeat('c',64),
 '{\"process\":{\"processCode\":\"RFP_COMPOSITE\"},\"source\":{\"testOwned\":true}}','APPLIED');
 insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,document_set_hash,
 authority_hash,provenance_hash,bound_by)
 values($authority_id,$authority_revision,'PROJECT','RFP-COMPOSITE-OTHER',1,
 repeat('c',64),'RFP_COMPOSITE','STEP_A','/rfp-composite','USER',
 '$document_set_hash','$authority_hash',
 framework_project_runtime_purge_integrated_provenance_hash(
  'PROJECT','RFP-COMPOSITE-OTHER',1,repeat('c',64),'RFP_COMPOSITE','STEP_A',
  '/rfp-composite','USER',$authority_id,$authority_revision,
  '$document_set_hash','$authority_hash'),'OTHER_PROJECT_TEST')"
negative_preview '10000000-0000-0000-0000-000000000002' \
  '20000000-0000-0000-0000-000000000002' OTHER_PROJECT sharedIntegratedScopeCount 1
db -qc "delete from integrated_design_scope_binding where bound_by='OTHER_PROJECT_TEST';
 delete from framework_actor_process_design_release where project_id='RFP-COMPOSITE-OTHER'"

db -qc "insert into integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,
 contract_sha256,process_code,step_code,route_path,audience,document_set_hash,
 authority_hash,provenance_hash,bound_by)
 values($authority_id,2,'PROJECT','RFP-COMPOSITE-001',1,repeat('a',64),
 'RFP_COMPOSITE','STEP_A','/rfp-composite','USER','$document_set_hash',
 '$authority_hash',repeat('0',64),'FORGED_TEST')"
negative_preview '10000000-0000-0000-0000-000000000003' \
  '20000000-0000-0000-0000-000000000003' FORGED forgedIntegratedBindingCount 1
db -qc "delete from integrated_design_scope_binding where bound_by='FORGED_TEST'"

preview="$(db -Atqc "select framework_preview_project_runtime_purge(
 '30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
 'RFP-COMPOSITE-001','RFP_COMPOSITE',1,repeat('a',64),'EXACT_PROJECT',
 'runtime.composite.admin')" | tail -1)"
[[ "$(json_field '["status"]' <<<"$preview")" == PREVIEWED ]] || fail "preview failed: $preview"
snapshot="$(json_field '["snapshotSha256"]' <<<"$preview")"
preview_rows="$(json_field '["impact"]["totalRows"]' <<<"$preview")"
[[ "$snapshot" =~ ^[0-9a-f]{64}$ ]] || fail 'snapshot hash invalid'
[[ "$(scalar "select count(*) from framework_project_runtime_purge_snapshot_row
 where receipt_id='30000000-0000-0000-0000-000000000001'
   and table_name='integrated_design_live_smoke_evidence'")" == 1 ]] ||
  fail 'exact PROJECT live evidence was not captured'
[[ "$(scalar "select count(*) from framework_project_runtime_purge_snapshot_row
 where receipt_id='30000000-0000-0000-0000-000000000001'
   and table_name='integrated_design_live_smoke_dispatch'")" == 1 ]] ||
  fail 'exact PROJECT live dispatch was not captured'
[[ "$(scalar "select count(*) from framework_project_runtime_purge_snapshot_row
 where receipt_id='30000000-0000-0000-0000-000000000001'
   and table_name in('integrated_design_notification_outbox',
                     'integrated_design_notification_inbox')")" == 2 ]] ||
  fail 'exact PROJECT notification parent/child graph was not captured'
[[ "$(scalar "select count(*) from framework_project_runtime_purge_snapshot_row
 where receipt_id='30000000-0000-0000-0000-000000000001'
   and table_name='integrated_design_autocompletion_receipt'")" == 1 ]] ||
  fail 'exact process-owned autocompletion receipt was not captured'
state_hash_before="$(scalar "select test_composite_purge_live_set_hash(
 '30000000-0000-0000-0000-000000000001')")"
sequence_hash_before="$(scalar 'select test_composite_purge_sequence_hash()')"

purged="$(db -Atqc "select framework_apply_project_runtime_purge(
 '30000000-0000-0000-0000-000000000001','RFP-COMPOSITE-001','RFP_COMPOSITE',1,
 repeat('a',64),'$snapshot','runtime.composite.admin')" | tail -1)"
[[ "$(json_field '["status"]' <<<"$purged")" == PURGED ]] || fail "purge failed: $purged"
[[ "$(json_field '["postcondition"]["residualScopeCounts"]["residualRows"]' <<<"$purged")" == 0 ]] ||
  fail "purge residual is not zero: $purged"
[[ "$(scalar "select count(*) from integrated_design_document where process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'owned composite documents survived purge'
[[ "$(scalar "select count(*) from integrated_design_live_smoke_evidence
 where project_id='RFP-COMPOSITE-001' and process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'owned live evidence survived purge'
[[ "$(scalar "select count(*) from integrated_design_live_smoke_dispatch
 where project_id='RFP-COMPOSITE-001' and process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'owned live dispatch survived purge'
[[ "$(scalar "select count(*) from integrated_design_notification_outbox
 where project_id='RFP-COMPOSITE-001' and process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'owned notification outbox survived purge'
[[ "$(scalar "select count(*) from integrated_design_notification_inbox
 where project_id='RFP-COMPOSITE-001'")" == 0 ]] ||
  fail 'owned notification inbox survived purge'
[[ "$(scalar "select count(*) from integrated_design_autocompletion_receipt
 where process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'owned autocompletion receipt survived purge'

# Two writers race concurrently against the already committed PURGED receipt;
# both must be denied before either row reaches a table or FK check.
writer_one="$(mktemp)"; writer_two="$(mktemp)"
( db -Atqc "insert into integrated_design_document(
 document_id,process_code,step_code,route_path,audience,document_type,title,content)
 values(9000001,'RFP_COMPOSITE','STEP_A','/rfp-composite','USER','LATE','late','late')" \
    >"$writer_one" 2>&1; echo $? >>"$writer_one" ) & writer_one_pid=$!
( db -Atqc "insert into integrated_design_live_smoke_dispatch(
 dispatch_id,job_id,process_code,project_id,runtime_commit,runtime_identity_hash,canary_attempt,
 authority_revision_set_hash,artifact_manifest_hash,process_source_hash,expected_evidence_count)
 values(9000002,$job_id,'RFP_COMPOSITE','RFP-COMPOSITE-001',repeat('a',40),repeat('b',64),0,
 repeat('1',64),repeat('2',64),repeat('3',64),15)" >"$writer_two" 2>&1; echo $? >>"$writer_two" ) & writer_two_pid=$!
set +e
wait "$writer_one_pid"; writer_one_status=$?
wait "$writer_two_pid"; writer_two_status=$?
set -e
(( writer_one_status != 0 && writer_two_status != 0 )) ||
  fail 'concurrent PURGED writer was admitted'
grep -Fq 'durably purged' "$writer_one" || fail 'document writer fence reason drifted'
grep -Fq 'durably purged' "$writer_two" || fail 'dispatch writer fence reason drifted'
rm -f "$writer_one" "$writer_two"
[[ "$(scalar "select count(*) from integrated_design_document where process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'concurrent PURGED document writer wrote a row'
[[ "$(scalar "select count(*) from integrated_design_live_smoke_dispatch where process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'concurrent PURGED dispatch writer wrote a row'

# A privileged out-of-band conflicting row makes restore fail.  Every restore
# insert and receipt transition must roll back atomically.
db -qc "alter table framework_process_definition disable trigger trg_project_runtime_write_fence;
 insert into framework_process_definition(
 process_code,process_name,domain_code,owner_actor_code,process_version,goal,
 start_condition,completion_condition,process_status,lifecycle_status)
 values('RFP_COMPOSITE','conflict','TEST','ACTOR_A','9.0.0','x','x','x','DRAFT','DRAFT');
 alter table framework_process_definition enable trigger trg_project_runtime_write_fence"
set +e
restore_failure="$(db -Atqc "select framework_restore_project_runtime_purge(
 '30000000-0000-0000-0000-000000000001','RFP-COMPOSITE-001','RFP_COMPOSITE',1,
 repeat('a',64),'$snapshot','runtime.composite.admin')" 2>&1)"
restore_failure_status=$?
set -e
(( restore_failure_status != 0 )) || fail 'conflicting restore unexpectedly succeeded'
[[ "$(scalar "select receipt_status from framework_project_runtime_purge_receipt
 where receipt_id='30000000-0000-0000-0000-000000000001'")" == PURGED ]] ||
  fail 'failed restore did not roll receipt back to PURGED'
[[ "$(scalar "select count(*) from integrated_design_authority where process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'failed restore left a partial authority'
[[ "$(scalar "select count(*) from integrated_design_live_smoke_evidence where process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'failed restore left partial live evidence'
[[ "$(scalar "select count(*) from integrated_design_live_smoke_dispatch where process_code='RFP_COMPOSITE'")" == 0 ]] ||
  fail 'failed restore left partial live dispatch'
db -qc "delete from framework_process_definition where process_code='RFP_COMPOSITE'"

restored="$(db -Atqc "select framework_restore_project_runtime_purge(
 '30000000-0000-0000-0000-000000000001','RFP-COMPOSITE-001','RFP_COMPOSITE',1,
 repeat('a',64),'$snapshot','runtime.composite.admin')" | tail -1)"
[[ "$(json_field '["status"]' <<<"$restored")" == RESTORED ]] || fail "restore failed: $restored"
state_hash_after="$(scalar "select test_composite_purge_live_set_hash(
 '30000000-0000-0000-0000-000000000001')")"
sequence_hash_after="$(scalar 'select test_composite_purge_sequence_hash()')"
[[ "$state_hash_after" == "$state_hash_before" ]] || fail 'restored exact row/set hash drifted'
[[ "$sequence_hash_after" == "$sequence_hash_before" ]] || fail 'restored sequence set hash drifted'
[[ "$(scalar "select count(*) from pg_trigger trigger_row
 where trigger_row.tgrelid in('integrated_design_live_smoke_evidence'::regclass,
                              'integrated_design_live_smoke_dispatch'::regclass)
   and trigger_row.tgname in('trg_integrated_design_live_smoke_evidence_immutable',
                             'trg_integrated_design_live_smoke_dispatch_state',
                             'trg_project_runtime_write_fence')
   and trigger_row.tgenabled='O' and not trigger_row.tgisinternal")" == 4 ]] ||
  fail 'append-only/dispatch/write-fence user triggers were not re-enabled'
[[ "$(scalar "select count(*) from integrated_design_live_smoke_evidence
 where project_id='RFP-COMPOSITE-001' and process_code='RFP_COMPOSITE'")" == 1 ]] ||
  fail 'restore did not recover exact live evidence set'
[[ "$(scalar "select count(*) from integrated_design_live_smoke_dispatch
 where project_id='RFP-COMPOSITE-001' and process_code='RFP_COMPOSITE'")" == 1 ]] ||
  fail 'restore did not recover exact live dispatch set'
[[ "$(scalar "select count(*) from integrated_design_notification_outbox outbox
 join integrated_design_notification_inbox inbox using(notification_id)
 where outbox.project_id='RFP-COMPOSITE-001'")" == 1 ]] ||
  fail 'restore did not recover exact notification parent/child set'
[[ "$(scalar "select count(*) from integrated_design_autocompletion_receipt
 where process_code='RFP_COMPOSITE'")" == 1 ]] ||
  fail 'restore did not recover exact autocompletion receipt'

set +e
append_only_error="$(db -Atqc "delete from integrated_design_live_smoke_evidence
 where project_id='RFP-COMPOSITE-001'" 2>&1)"; append_only_status=$?
dispatch_delete_error="$(db -Atqc "delete from integrated_design_live_smoke_dispatch
 where project_id='RFP-COMPOSITE-001'" 2>&1)"; dispatch_delete_status=$?
set -e
(( append_only_status != 0 && dispatch_delete_status != 0 )) ||
  fail 'restored append-only/dispatch trigger admitted mutation'
grep -Fq 'COMPOSITE_LIVE_SMOKE_EVIDENCE_IS_APPEND_ONLY' <<<"$append_only_error" ||
  fail 'restored append-only trigger reason drifted'
grep -Fq 'COMPOSITE_LIVE_SMOKE_DISPATCH_DELETE_FORBIDDEN' <<<"$dispatch_delete_error" ||
  fail 'restored dispatch trigger reason drifted'

audit_chain="$(scalar "select string_agg(event_type,',' order by audit_id)
 from framework_project_runtime_purge_audit
 where receipt_id='30000000-0000-0000-0000-000000000001'")"
[[ "$audit_chain" == PREVIEWED,PURGED,RESTORED ]] || fail "audit chain drifted: $audit_chain"

printf 'PROJECT_RUNTIME_PURGE_COMPOSITE_POSTGRES_PASS migrationOrder=4 migrationMs=%s integratedFences=%s missingFences=0 previewRows=%s projectBindings=1 liveEvidence=1 liveDispatch=1 notificationGraph=2 autocompletion=1 absenceRows=7 negativeBindings=3 purgeResidue=0 concurrentWriters=2/write0 restoreFailure=atomic restoredHash=exact sequenceHash=exact userTriggers=4/enabled audit=%s\n' \
  "$migration_ms" "$integrated_fence_count" "$preview_rows" "$audit_chain"
