#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ "${WORK_EXECUTION_LINEAGE_TIMEOUT_GUARD:-0}" != 1 ]]; then
  export WORK_EXECUTION_LINEAGE_TIMEOUT_GUARD=1
  exec timeout --foreground --signal=TERM --kill-after=5s 30s bash "$0" "$@"
fi

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814172000__normalize_work_execution_process_lineage_contract.sql"
BACKUP_SCOPE_CLASSIFIER="$ROOT/ops/scripts/classify-db-backup-scope.sh"
IMAGE="${WORK_EXECUTION_LINEAGE_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER="work-execution-contract-pg-$RANDOM-$$"
PASSWORD="work-execution-contract-$RANDOM-$$"
PORT=""
started=0
holder_pid=""
started_at="$(date +%s)"
TMP="$(mktemp -d)"

fail() { printf 'WORK_EXECUTION_PROCESS_LINEAGE_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  set +e
  [[ -n "$holder_pid" ]] && kill "$holder_pid" >/dev/null 2>&1 || true
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$TMP"
}
trap cleanup EXIT INT TERM

[[ -f "$MIGRATION" && -f "$BACKUP_SCOPE_CLASSIFIER" ]] || fail "migration or backup classifier missing"
for command_name in python3 psql ctr sudo timeout; do command -v "$command_name" >/dev/null || fail "$command_name missing"; done
sudo -n true >/dev/null || fail "passwordless sudo required"
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" || fail "cached image missing: $IMAGE"

python3 - "$MIGRATION" <<'PY'
from pathlib import Path
import re
import sys

sql = Path(sys.argv[1]).read_text()
required = (
    "SET lock_timeout='5s'", "SET statement_timeout='30s'",
    "LOCK TABLE public.framework_screen_resource IN SHARE MODE",
    "LOCK TABLE public.framework_screen_data_binding IN SHARE ROW EXCLUSIVE MODE",
    "LOCK TABLE public.framework_process_work_draft IN ACCESS SHARE MODE",
    "RESET statement_timeout", "RESET lock_timeout",
    "left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'",
    "left(data_element_code,4)='PSC_'",
    "psc_editable_logical_count<>25", "psc_server_logical_count<>4",
    "canonical_contract_mismatch<>0", "draft_schema_mismatch<>0",
    "psc_resolved_contract_mismatch<>0", "psc_server_contract_mismatch<>0",
    "physical_source_mismatch<>0", "5d489072ab71f9533680c3bd4cc43ea6",
    "EXCEPT ALL",
    "editable_updated<>25", "server_updated<>4",
    "NEW.api_property='draft.payloadJson.'||NEW.field_code",
    "WHEN 'recordId' THEN 'draft_id'",
    "WHEN 'rowVersion' THEN 'draft_version'",
    "WHEN 'statusCode' THEN 'draft_status'",
    "WHEN 'evidenceCount' THEN 'evidence_count'",
    "framework_work_execution_psc_lineage_biu",
    "WORK_EXECUTION stage B object collision",
    "foreign_hash_after IS DISTINCT FROM foreign_hash",
    "post_score<>100", "post_field_count<>69",
)
for token in required:
    if token not in sql:
        raise SystemExit(f"stage B contract missing: {token}")
for pattern in (
    r"\bcreate\s+(?:or\s+replace\s+)?view\b",
    r"\bdelete\s+from\b", r"\btruncate\b", r"\bmerge\s+into\b",
):
    if re.search(pattern, sql, re.I):
        raise SystemExit(f"stage B contains forbidden operation: {pattern}")
if len(re.findall(r"\bupdate\s+public\.framework_screen_data_binding\b", sql, re.I)) != 2:
    raise SystemExit("stage B must contain exactly two scoped binding updates")
if re.search(r"(?i)like\s+'(?:PSC_|PLATFORM\.WORK_EXECUTION\.)", sql):
    raise SystemExit("stage B uses wildcard-sensitive LIKE for literal prefixes")
if re.search(r"(?i)create\s+or\s+replace\s+function|drop\s+trigger", sql):
    raise SystemExit("stage B can overwrite a preexisting function or trigger")
PY

migration_path='apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814172000__normalize_work_execution_process_lineage_contract.sql'
[[ "$(printf '%s\n' "$migration_path" | bash "$BACKUP_SCOPE_CLASSIFIER")" == governance ]] \
  || fail "stage B migration is not governance backup scoped"

PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --null-io --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=work_execution_contract \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER"
started=1
export PGPASSWORD="$PASSWORD"
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d work_execution_contract -X -v ON_ERROR_STOP=1)

ready=0
for _ in $(seq 1 40); do
  if "${PSQL[@]}" -Atqc 'select 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
(( ready )) || fail "postgres readiness timeout"

expect_migration_fail() {
  local label="$1" started_ms elapsed_ms rc
  started_ms="$(date +%s%N)"
  if timeout --foreground 8s "${PSQL[@]}" -f "$MIGRATION" >"$TMP/$label.log" 2>&1; then
    fail "$label mutant passed"
  else
    rc=$?
  fi
  [[ "$rc" -ne 124 ]] || fail "$label mutant exceeded 8s; see $TMP/$label.log"
  elapsed_ms=$(( ($(date +%s%N) - started_ms) / 1000000 ))
  printf 'WORK_EXECUTION_PROCESS_LINEAGE_PHASE %s=%sms\n' "$label" "$elapsed_ms"
}

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE TABLE framework_screen_resource(
  screen_resource_id bigint PRIMARY KEY,
  route_key text NOT NULL
);
CREATE TABLE framework_screen_data_binding(
  screen_resource_id bigint NOT NULL,
  data_element_code text NOT NULL,
  field_code text NOT NULL,
  field_name text NOT NULL DEFAULT '',
  control_type text NOT NULL DEFAULT 'TEXT',
  api_property text,
  source_table text,
  source_column text,
  required boolean NOT NULL DEFAULT false,
  editable boolean NOT NULL DEFAULT false,
  validation_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  lineage_status text NOT NULL,
  PRIMARY KEY(screen_resource_id,data_element_code,field_code)
);
CREATE TABLE framework_process_work_draft(
  draft_id uuid PRIMARY KEY,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_count integer GENERATED ALWAYS AS (
    CASE WHEN (jsonb_typeof(evidence_json->'documentId')='string'
                 AND btrim(evidence_json->>'documentId', E' \t\n\r\f\v')<>'')
           OR (jsonb_typeof(evidence_json->'sourceUrl')='string'
                 AND btrim(evidence_json->>'sourceUrl', E' \t\n\r\f\v')<>'')
           OR (jsonb_typeof(evidence_json->'checksum')='string'
                 AND btrim(evidence_json->>'checksum', E' \t\n\r\f\v')<>'')
         THEN 1 ELSE 0 END
  ) STORED,
  draft_version integer NOT NULL DEFAULT 1,
  draft_status varchar(30) NOT NULL DEFAULT 'DRAFT'
);
CREATE TABLE framework_account_actor_assignment(tenant_id text);
CREATE TABLE framework_process_execution(
  project_id text,execution_id text,execution_status text,current_step_code text,current_state text
);
CREATE TABLE framework_process_definition(process_code text);
CREATE TABLE framework_process_step(
  step_code text,step_name text,actor_code text,command_code text,from_state text,to_state text,
  requirement_text text,completion_rule text,input_contract text,output_contract text
);
CREATE TABLE framework_process_execution_event(
  event_id text,actor_code text,command_code text,to_state text,executed_at timestamptz
);
CREATE TABLE emission_project_registry(
  tenant_id text,reporting_year integer,project_id text,created_at timestamptz,updated_at timestamptz
);
ALTER TABLE framework_screen_resource SET (autovacuum_enabled=false);
ALTER TABLE framework_screen_data_binding SET (autovacuum_enabled=false);
ALTER TABLE framework_process_work_draft SET (autovacuum_enabled=false);

CREATE VIEW framework_page_design_assurance AS
WITH lineage AS (
  SELECT screen_resource_id,count(*)::integer field_count,
         bool_and(nullif(btrim(api_property),'') IS NOT NULL
           AND nullif(btrim(source_table),'') IS NOT NULL
           AND nullif(btrim(source_column),'') IS NOT NULL
           AND lineage_status IN('DB_RESOLVED','IMPLEMENTATION_VERIFIED')) lineage_passed
    FROM framework_screen_data_binding
   GROUP BY screen_resource_id
)
SELECT screen_resource_id,lineage_passed,field_count,
       CASE WHEN lineage_passed THEN 100 ELSE 90 END design_gate_score,
       CASE WHEN lineage_passed THEN 'PASSED' ELSE 'FAILED' END design_gate_status,
       CASE WHEN lineage_passed THEN ARRAY[]::text[]
            ELSE ARRAY['INPUT_OUTPUT_LINEAGE_INCOMPLETE']::text[] END design_gate_issues
  FROM lineage;

INSERT INTO framework_screen_resource VALUES(1,'/work/execution'),(8,'/unrelated/logical');
INSERT INTO framework_process_work_draft(draft_id,evidence_json)
VALUES('00000000-0000-0000-0000-000000000001','{"documentId":"DOC-1"}');

INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
)
SELECT 1,'PLATFORM.WORK_EXECUTION.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),
       field_code,field_code,api_property,source_table,source_column,required,editable,'DB_RESOLVED'
  FROM (VALUES
    ('tenantId','query.tenantId','framework_account_actor_assignment','tenant_id',true,true),
    ('projectId','query.projectId','framework_process_execution','project_id',true,true),
    ('processCode','query.processCode','framework_process_definition','process_code',true,true),
    ('stepCode','query.stepCode','framework_process_step','step_code',true,true),
    ('stepName','contract.stepName','framework_process_step','step_name',true,false),
    ('actorCode','contract.actorCode','framework_process_step','actor_code',true,false),
    ('commandCode','contract.commandCode','framework_process_step','command_code',true,false),
    ('fromState','contract.fromState','framework_process_step','from_state',true,false),
    ('toState','contract.toState','framework_process_step','to_state',true,false),
    ('requirementText','contract.requirementText','framework_process_step','requirement_text',true,false),
    ('completionRule','contract.completionRule','framework_process_step','completion_rule',true,false),
    ('inputContract','contract.inputContract','framework_process_step','input_contract',true,false),
    ('outputContract','contract.outputContract','framework_process_step','output_contract',true,false),
    ('draftId','draft.draftId','framework_process_work_draft','draft_id',false,false),
    ('draftVersion','draft.draftVersion','framework_process_work_draft','draft_version',true,false),
    ('draftStatus','draft.draftStatus','framework_process_work_draft','draft_status',true,false),
    ('workSummary','draft.payloadJson.workSummary','framework_process_work_draft','payload_json',true,true),
    ('decisionBasis','draft.payloadJson.decisionBasis','framework_process_work_draft','payload_json',true,true),
    ('resultValue','draft.payloadJson.resultValue','framework_process_work_draft','payload_json',false,true),
    ('resultUnit','draft.payloadJson.resultUnit','framework_process_work_draft','payload_json',false,true),
    ('exceptionReason','draft.payloadJson.exceptionReason','framework_process_work_draft','payload_json',false,true),
    ('documentId','draft.evidenceJson.documentId','framework_process_work_draft','evidence_json',true,true),
    ('sourceUrl','draft.evidenceJson.sourceUrl','framework_process_work_draft','evidence_json',false,true),
    ('checksum','draft.evidenceJson.checksum','framework_process_work_draft','evidence_json',false,true),
    ('executionId','execution.executionId','framework_process_execution','execution_id',false,false),
    ('executionStatus','execution.executionStatus','framework_process_execution','execution_status',false,false),
    ('currentStepCode','execution.currentStepCode','framework_process_execution','current_step_code',false,false),
    ('currentState','execution.currentState','framework_process_execution','current_state',false,false),
    ('eventId','events[].eventId','framework_process_execution_event','event_id',false,false),
    ('eventActor','events[].actorCode','framework_process_execution_event','actor_code',false,false),
    ('eventCommand','events[].commandCode','framework_process_execution_event','command_code',false,false),
    ('eventTransition','events[].fromState+toState','framework_process_execution_event','to_state',false,false),
    ('eventAt','events[].executedAt','framework_process_execution_event','executed_at',false,false)
  ) expected(field_code,api_property,source_table,source_column,required,editable);

INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
)
SELECT 1,'PSC_EDITABLE_'||lpad(i::text,2,'0'),'editable_'||i,'editable '||i,
       'draft.payloadJson.editable_'||i,NULL,NULL,i<=12,true,'LOGICAL_CONTRACT'
  FROM generate_series(1,25) i;

INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
)
SELECT 1,'PSC_SERVER_'||field_code,field_code,field_code,field_code,
       NULL,NULL,required,false,'LOGICAL_CONTRACT'
  FROM (VALUES
    ('recordId',false),('rowVersion',true),('statusCode',true),('evidenceCount',false)
  ) value(field_code,required);

INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
)
SELECT 1,data_element_code,field_code,field_code,api_property,
       source_table,source_column,required,editable,'DB_RESOLVED'
  FROM (VALUES
    ('PSC_11D99FED59D571DD36F40840','stepCode','stepCode','framework_process_step','step_code',true,false),
    ('PSC_4ED7441162E444B6DB6916A4','tenantId','tenantId','emission_project_registry','tenant_id',true,false),
    ('PSC_582A4FC69651C4F123CFB2DC','reportingYear','reportingYear','emission_project_registry','reporting_year',true,true),
    ('PSC_8E6EDCAD0B45FDD7D8728391','processCode','processCode','framework_process_definition','process_code',true,false),
    ('PSC_AAF648FDD29AB51B3E8E3808','updatedAt','updatedAt','emission_project_registry','updated_at',false,false),
    ('PSC_C795DEEC45D3428648AC7676','projectId','projectId','emission_project_registry','project_id',true,true),
    ('PSC_FFA9D486F435E5BBFD976D57','createdAt','createdAt','emission_project_registry','created_at',false,false)
  ) resolved(data_element_code,field_code,api_property,source_table,source_column,required,editable);

INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
) VALUES(8,'OTHER.LOGICAL.FIELD','otherField','other','other.value',NULL,NULL,false,true,'LOGICAL_CONTRACT');
SQL

gate_pre="$("${PSQL[@]}" -AtF '|' -c "select lineage_passed,design_gate_score,design_gate_status,design_gate_issues,field_count from framework_page_design_assurance where screen_resource_id=1")"
[[ "$gate_pre" == 'f|90|FAILED|{INPUT_OUTPUT_LINEAGE_INCOMPLETE}|69' ]] || fail "invalid pre-gate fixture: $gate_pre"

# Physical bridge columns are part of the source contract, not merely names.
evidence_expr_hash="$("${PSQL[@]}" -Atqc "select md5(pg_get_expr(d.adbin,d.adrelid)) from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.framework_process_work_draft'::regclass and a.attname='evidence_count'")"
[[ "$evidence_expr_hash" == '5d489072ab71f9533680c3bd4cc43ea6' ]] \
  || fail "fixture does not reproduce deployed A expression: $evidence_expr_hash"
"${PSQL[@]}" >/dev/null <<'SQL'
ALTER TABLE framework_process_work_draft DROP COLUMN evidence_count;
ALTER TABLE framework_process_work_draft ADD COLUMN evidence_count integer
  GENERATED ALWAYS AS (
    CASE WHEN jsonb_typeof(evidence_json->'documentId')='string'
                   AND btrim(evidence_json->>'documentId',E' \t\n\r\f\v')<>''
         THEN 1 ELSE 0 END
  ) STORED;
SQL
expect_migration_fail wrong-evidence-expression
"${PSQL[@]}" >/dev/null <<'SQL'
ALTER TABLE framework_process_work_draft DROP COLUMN evidence_count;
ALTER TABLE framework_process_work_draft ADD COLUMN evidence_count integer
  GENERATED ALWAYS AS (
    CASE WHEN (jsonb_typeof(evidence_json->'documentId')='string'
                 AND btrim(evidence_json->>'documentId', E' \t\n\r\f\v')<>'')
           OR (jsonb_typeof(evidence_json->'sourceUrl')='string'
                 AND btrim(evidence_json->>'sourceUrl', E' \t\n\r\f\v')<>'')
           OR (jsonb_typeof(evidence_json->'checksum')='string'
                 AND btrim(evidence_json->>'checksum', E' \t\n\r\f\v')<>'')
         THEN 1 ELSE 0 END
  ) STORED;
SQL
"${PSQL[@]}" -c "alter table framework_process_work_draft rename column draft_status to draft_status_missing" >/dev/null
expect_migration_fail missing-draft-column
"${PSQL[@]}" -c "alter table framework_process_work_draft rename column draft_status_missing to draft_status" >/dev/null
"${PSQL[@]}" -c "alter table framework_process_work_draft alter column draft_version type bigint" >/dev/null
expect_migration_fail wrong-draft-type
"${PSQL[@]}" -c "alter table framework_process_work_draft alter column draft_version type integer" >/dev/null
"${PSQL[@]}" -c "alter table framework_process_execution_event rename column executed_at to executed_at_missing" >/dev/null
expect_migration_fail missing-physical-source
"${PSQL[@]}" -c "alter table framework_process_execution_event rename column executed_at_missing to executed_at" >/dev/null

fingerprint() {
  local predicate="$1"
  "${PSQL[@]}" -Atqc "select count(*)||':'||coalesce(md5(string_agg(to_jsonb(binding)::text,E'\\n' order by screen_resource_id,data_element_code,field_code)),'EMPTY') from framework_screen_data_binding binding where $predicate"
}
all_before="$(fingerprint 'true')"
foreign_before="$(fingerprint 'screen_resource_id<>1')"
immutable_predicate="screen_resource_id=1 and (left(data_element_code,24)='PLATFORM.WORK_EXECUTION.' or data_element_code in('PSC_11D99FED59D571DD36F40840','PSC_4ED7441162E444B6DB6916A4','PSC_582A4FC69651C4F123CFB2DC','PSC_8E6EDCAD0B45FDD7D8728391','PSC_AAF648FDD29AB51B3E8E3808','PSC_C795DEEC45D3428648AC7676','PSC_FFA9D486F435E5BBFD976D57'))"
immutable_before="$(fingerprint "$immutable_predicate")"
view_before="$("${PSQL[@]}" -Atqc "select md5(pg_get_viewdef('framework_page_design_assurance'::regclass,true))")"
draft_before="$("${PSQL[@]}" -Atqc "select count(*)||':'||md5(string_agg(to_jsonb(draft)::text,E'\\n' order by draft_id)) from framework_process_work_draft draft")"

# Exact inventory mutants must fail before creating a function or trigger.
"${PSQL[@]}" -c "delete from framework_screen_data_binding where screen_resource_id=1 and data_element_code='PLATFORM.WORK_EXECUTION.EVENTAT'" >/dev/null
expect_migration_fail missing-canonical
[[ "$("${PSQL[@]}" -Atqc "select count(*) from pg_trigger where tgname='framework_work_execution_psc_lineage_biu'")" == 0 ]] \
  || fail "failed precondition left trigger behind"
"${PSQL[@]}" >/dev/null <<'SQL'
INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
) VALUES(1,'PLATFORM.WORK_EXECUTION.EVENTAT','eventAt','eventAt','events[].executedAt',
  'framework_process_execution_event','executed_at',false,false,'DB_RESOLVED');
SQL

"${PSQL[@]}" -c "update framework_screen_data_binding set source_column='wrong_nonblank' where screen_resource_id=1 and data_element_code='PLATFORM.WORK_EXECUTION.EVENTAT'" >/dev/null
expect_migration_fail wrong-canonical-source
"${PSQL[@]}" -c "update framework_screen_data_binding set source_column='executed_at' where screen_resource_id=1 and data_element_code='PLATFORM.WORK_EXECUTION.EVENTAT'" >/dev/null

"${PSQL[@]}" -c "update framework_screen_data_binding set api_property=case field_code when 'tenantId' then 'query.projectId' when 'projectId' then 'query.tenantId' else api_property end where screen_resource_id=1 and field_code in('tenantId','projectId') and left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'" >/dev/null
expect_migration_fail swapped-canonical-api
"${PSQL[@]}" -c "update framework_screen_data_binding set api_property=case field_code when 'tenantId' then 'query.tenantId' when 'projectId' then 'query.projectId' else api_property end where screen_resource_id=1 and field_code in('tenantId','projectId') and left(data_element_code,24)='PLATFORM.WORK_EXECUTION.'" >/dev/null
"${PSQL[@]}" -c "update framework_screen_data_binding set required=true where screen_resource_id=1 and data_element_code='PLATFORM.WORK_EXECUTION.EVENTAT'" >/dev/null
expect_migration_fail wrong-canonical-required
"${PSQL[@]}" -c "update framework_screen_data_binding set required=false where screen_resource_id=1 and data_element_code='PLATFORM.WORK_EXECUTION.EVENTAT'" >/dev/null

"${PSQL[@]}" -c "update framework_screen_data_binding set source_column='wrong_nonblank' where screen_resource_id=1 and data_element_code='PSC_AAF648FDD29AB51B3E8E3808'" >/dev/null
expect_migration_fail wrong-resolved-source
"${PSQL[@]}" -c "update framework_screen_data_binding set source_column='updated_at' where screen_resource_id=1 and data_element_code='PSC_AAF648FDD29AB51B3E8E3808'" >/dev/null
"${PSQL[@]}" -c "update framework_screen_data_binding set data_element_code='PSC_WRONG_STEP_CODE' where screen_resource_id=1 and data_element_code='PSC_11D99FED59D571DD36F40840'" >/dev/null
expect_migration_fail wrong-resolved-data-element
"${PSQL[@]}" -c "update framework_screen_data_binding set data_element_code='PSC_11D99FED59D571DD36F40840' where screen_resource_id=1 and data_element_code='PSC_WRONG_STEP_CODE'" >/dev/null
"${PSQL[@]}" -c "update framework_screen_data_binding set required=false where screen_resource_id=1 and data_element_code='PSC_4ED7441162E444B6DB6916A4'" >/dev/null
expect_migration_fail wrong-resolved-required
"${PSQL[@]}" -c "update framework_screen_data_binding set required=true where screen_resource_id=1 and data_element_code='PSC_4ED7441162E444B6DB6916A4'" >/dev/null
"${PSQL[@]}" -c "update framework_screen_data_binding set editable=false where screen_resource_id=1 and data_element_code='PSC_582A4FC69651C4F123CFB2DC'" >/dev/null
expect_migration_fail wrong-resolved-editable
"${PSQL[@]}" -c "update framework_screen_data_binding set editable=true where screen_resource_id=1 and data_element_code='PSC_582A4FC69651C4F123CFB2DC'" >/dev/null

"${PSQL[@]}" -c "update framework_screen_data_binding set api_property='wrong.editable_1' where screen_resource_id=1 and data_element_code='PSC_EDITABLE_01'" >/dev/null
expect_migration_fail wrong-editable-api
"${PSQL[@]}" -c "update framework_screen_data_binding set api_property='draft.payloadJson.editable_1' where screen_resource_id=1 and data_element_code='PSC_EDITABLE_01'" >/dev/null

"${PSQL[@]}" -c "update framework_screen_data_binding set api_property='custom.recordId' where screen_resource_id=1 and data_element_code='PSC_SERVER_recordId'" >/dev/null
expect_migration_fail custom-server-api
"${PSQL[@]}" -c "update framework_screen_data_binding set api_property='recordId' where screen_resource_id=1 and data_element_code='PSC_SERVER_recordId'" >/dev/null

"${PSQL[@]}" -c "update framework_screen_data_binding set source_table='custom_partial' where screen_resource_id=1 and data_element_code='PSC_EDITABLE_02'" >/dev/null
expect_migration_fail partial-source
"${PSQL[@]}" -c "update framework_screen_data_binding set source_table=NULL where screen_resource_id=1 and data_element_code='PSC_EDITABLE_02'" >/dev/null

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE FUNCTION framework_normalize_work_execution_psc_lineage()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER framework_work_execution_psc_lineage_biu
BEFORE INSERT ON framework_screen_data_binding
FOR EACH ROW EXECUTE FUNCTION framework_normalize_work_execution_psc_lineage();
SQL
collision_before="$("${PSQL[@]}" -Atqc "select md5(pg_get_functiondef('framework_normalize_work_execution_psc_lineage()'::regprocedure))")"
expect_migration_fail object-collision
[[ "$("${PSQL[@]}" -Atqc "select md5(pg_get_functiondef('framework_normalize_work_execution_psc_lineage()'::regprocedure))")" == "$collision_before" ]] \
  || fail "collision path overwrote existing function"
"${PSQL[@]}" -c "drop trigger framework_work_execution_psc_lineage_biu on framework_screen_data_binding; drop function framework_normalize_work_execution_psc_lineage()" >/dev/null

[[ "$(fingerprint 'true')" == "$all_before" ]] || fail "precondition mutants did not restore exact fixture"

# Trigger creation/update must fail closed under a conflicting table lock.
"${PSQL[@]}" -c "begin; lock table framework_screen_data_binding in share mode; select pg_sleep(7); commit" \
  >"$TMP/lock-holder.log" 2>&1 &
holder_pid=$!
lock_ready=0
for _ in $(seq 1 30); do
  if [[ "$("${PSQL[@]}" -Atqc "select count(*) from pg_locks where relation='framework_screen_data_binding'::regclass and mode='ShareLock' and granted")" -ge 1 ]]; then
    lock_ready=1; break
  fi
  sleep 0.1
done
(( lock_ready )) || fail "lock holder did not acquire SHARE"
lock_started="$(date +%s)"
expect_migration_fail locked-migration
lock_elapsed=$(( $(date +%s) - lock_started ))
(( lock_elapsed >= 4 && lock_elapsed <= 7 )) || fail "lock timeout was not bounded: ${lock_elapsed}s"
wait "$holder_pid"
holder_pid=""
[[ "$(fingerprint 'true')" == "$all_before" ]] || fail "lock timeout changed bindings"
[[ "$("${PSQL[@]}" -Atqc "select count(*) from pg_trigger where tgname='framework_work_execution_psc_lineage_biu'")" == 0 ]] \
  || fail "lock timeout left trigger behind"

"${PSQL[@]}" -f "$MIGRATION" >/dev/null

base_counts="$("${PSQL[@]}" -AtF '|' -c "
  select count(*),
         count(*) filter(where lineage_status in('DB_RESOLVED','IMPLEMENTATION_VERIFIED')
           and source_table is not null and source_column is not null),
         count(*) filter(where left(data_element_code,4)='PSC_' and editable
           and source_column='payload_json'),
         count(*) filter(where left(data_element_code,4)='PSC_' and not editable
           and field_code in('recordId','rowVersion','statusCode','evidenceCount')
           and source_table='framework_process_work_draft'),
         count(*) filter(where lineage_status='LOGICAL_CONTRACT')
    from framework_screen_data_binding where screen_resource_id=1")"
[[ "$base_counts" == '69|69|25|4|0' ]] || fail "base normalization mismatch: $base_counts"

server_mapping="$("${PSQL[@]}" -AtF '|' -c "
  select field_code,api_property,source_column,lineage_status
    from framework_screen_data_binding
   where screen_resource_id=1 and data_element_code like 'PSC_SERVER_%'
   order by field_code")"
expected_server=$'evidenceCount|draft.evidenceCount|evidence_count|DB_RESOLVED\nrecordId|draft.draftId|draft_id|DB_RESOLVED\nrowVersion|draft.draftVersion|draft_version|DB_RESOLVED\nstatusCode|draft.draftStatus|draft_status|DB_RESOLVED'
[[ "$server_mapping" == "$expected_server" ]] || fail "server mapping mismatch: $server_mapping"

gate_post="$("${PSQL[@]}" -AtF '|' -c "select lineage_passed,design_gate_score,design_gate_status,design_gate_issues,field_count from framework_page_design_assurance where screen_resource_id=1")"
[[ "$gate_post" == 't|100|PASSED|{}|69' ]] || fail "post gate mismatch: $gate_post"
[[ "$(fingerprint 'screen_resource_id<>1')" == "$foreign_before" ]] || fail "foreign binding fingerprint changed"
[[ "$(fingerprint "$immutable_predicate")" == "$immutable_before" ]] \
  || fail "canonical or pre-resolved PSC fingerprint changed"
[[ "$("${PSQL[@]}" -Atqc "select md5(pg_get_viewdef('framework_page_design_assurance'::regclass,true))")" == "$view_before" ]] \
  || fail "stage B changed assurance view"
[[ "$("${PSQL[@]}" -Atqc "select count(*)||':'||md5(string_agg(to_jsonb(draft)::text,E'\\n' order by draft_id)) from framework_process_work_draft draft")" == "$draft_before" ]] \
  || fail "stage B changed work draft rows"

expect_migration_fail reapply
[[ "$("${PSQL[@]}" -Atqc "select count(*) from pg_trigger where tgname='framework_work_execution_psc_lineage_biu'")" == 1 ]] \
  || fail "reapply failure changed trigger"

# Future safe contract rows normalize; partial/custom/unsupported/foreign rows
# remain logical so the all-binding assurance gate fails closed.
"${PSQL[@]}" >/dev/null <<'SQL'
INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
) VALUES
  (1,'PSC_FUTURE_EDIT','futureEdit','future edit','draft.payloadJson.futureEdit',NULL,NULL,false,true,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_RECORD','recordId','record','recordId',NULL,NULL,false,false,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_VERSION','rowVersion','version','rowVersion',NULL,NULL,true,false,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_STATUS','statusCode','status','statusCode',NULL,NULL,true,false,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_EVIDENCE','evidenceCount','evidence','evidenceCount',NULL,NULL,true,false,'LOGICAL_CONTRACT');
SQL
[[ "$("${PSQL[@]}" -AtF '|' -c "select lineage_passed,design_gate_score,field_count from framework_page_design_assurance where screen_resource_id=1")" == 't|100|74' ]] \
  || fail "safe future rows did not preserve gate"

"${PSQL[@]}" >/dev/null <<'SQL'
INSERT INTO framework_screen_data_binding(
  screen_resource_id,data_element_code,field_code,field_name,api_property,
  source_table,source_column,required,editable,lineage_status
) VALUES
  (1,'PSC_FUTURE_WRONG_API','wrongApi','wrong api','wrong.api',NULL,NULL,false,true,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_PARTIAL','partial','partial','draft.payloadJson.partial','custom_table',NULL,false,true,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_CUSTOM','custom','custom','draft.payloadJson.custom','custom_table','custom_column',false,true,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_UNSUPPORTED','unsupported','unsupported','unsupported',NULL,NULL,false,false,'LOGICAL_CONTRACT'),
  (1,'PSC_FUTURE_CUSTOM_SERVER','recordId','custom server','custom.recordId',NULL,NULL,false,false,'LOGICAL_CONTRACT'),
  (8,'PSC_FOREIGN_EDIT','foreignEdit','foreign','draft.payloadJson.foreignEdit',NULL,NULL,false,true,'LOGICAL_CONTRACT');
SQL

fail_closed="$("${PSQL[@]}" -AtF '|' -c "
  select data_element_code,lineage_status,coalesce(source_table,'<null>'),coalesce(source_column,'<null>')
    from framework_screen_data_binding
   where data_element_code in('PSC_FUTURE_WRONG_API','PSC_FUTURE_PARTIAL','PSC_FUTURE_CUSTOM','PSC_FUTURE_UNSUPPORTED','PSC_FUTURE_CUSTOM_SERVER','PSC_FOREIGN_EDIT')
   order by data_element_code")"
expected_fail_closed=$'PSC_FOREIGN_EDIT|LOGICAL_CONTRACT|<null>|<null>\nPSC_FUTURE_CUSTOM|LOGICAL_CONTRACT|custom_table|custom_column\nPSC_FUTURE_CUSTOM_SERVER|LOGICAL_CONTRACT|<null>|<null>\nPSC_FUTURE_PARTIAL|LOGICAL_CONTRACT|custom_table|<null>\nPSC_FUTURE_UNSUPPORTED|LOGICAL_CONTRACT|<null>|<null>\nPSC_FUTURE_WRONG_API|LOGICAL_CONTRACT|<null>|<null>'
[[ "$fail_closed" == "$expected_fail_closed" ]] || fail "trigger overwrote unsafe or foreign rows: $fail_closed"

"${PSQL[@]}" -c "update framework_screen_data_binding set api_property='draft.payloadJson.wrongApi' where screen_resource_id=1 and data_element_code='PSC_FUTURE_WRONG_API'" >/dev/null
[[ "$("${PSQL[@]}" -AtF '|' -c "select lineage_status,source_table,source_column from framework_screen_data_binding where data_element_code='PSC_FUTURE_WRONG_API'")" == 'DB_RESOLVED|framework_process_work_draft|payload_json' ]] \
  || fail "safe UPDATE did not normalize"
[[ "$("${PSQL[@]}" -AtF '|' -c "select lineage_passed,design_gate_score,field_count from framework_page_design_assurance where screen_resource_id=1")" == 'f|90|79' ]] \
  || fail "unsupported future rows did not fail gate closed"
[[ "$("${PSQL[@]}" -AtF '|' -c "select lineage_passed,design_gate_score,field_count from framework_page_design_assurance where screen_resource_id=8")" == 'f|90|2' ]] \
  || fail "unrelated route all-binding semantics changed"

elapsed=$(( $(date +%s) - started_at ))
(( elapsed < 30 )) || fail "test exceeded 30-second budget duration=${elapsed}s"
printf 'WORK_EXECUTION_PROCESS_LINEAGE_POSTGRES_PASS pre=33+25+4+7 updates=25+4 gate=90-100 physicalSources=69 immutableCanonical=33 immutableResolvedPsc=7 foreignFingerprint=unchanged viewFingerprint=unchanged triggerInsert=5 triggerUpdate=1 failClosedRows=5 unrelatedLogical=true lockTimeout=%ss mutants=18 objectCollision=rejected reapply=rejected duration=%ss\n' "$lock_elapsed" "$elapsed"
