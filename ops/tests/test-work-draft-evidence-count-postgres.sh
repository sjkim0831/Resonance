#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814171000__add_process_work_draft_evidence_count_runtime_bridge.sql"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
IMAGE="${WORK_DRAFT_EVIDENCE_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER="work-draft-evidence-pg-$RANDOM-$$"
PASSWORD="work-draft-evidence-$RANDOM-$$"
PORT=""
started=0
holder_pid=""
started_at="$(date +%s)"
TMP="$(mktemp -d)"

fail() { printf 'WORK_DRAFT_EVIDENCE_COUNT_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
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

[[ -f "$MIGRATION" && -f "$SERVICE" ]] || fail "migration or service source missing"
for command_name in python3 psql ctr sudo; do command -v "$command_name" >/dev/null || fail "$command_name missing"; done
sudo -n true >/dev/null || fail "passwordless sudo required"
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" || fail "cached image missing: $IMAGE"

python3 - "$MIGRATION" "$SERVICE" <<'PY'
from pathlib import Path
import re
import sys

migration = Path(sys.argv[1]).read_text()
service = Path(sys.argv[2]).read_text()

required = (
    "SET lock_timeout='5s'",
    "SET statement_timeout='30s'",
    "RESET statement_timeout",
    "RESET lock_timeout",
    "ADD COLUMN evidence_count integer",
    "GENERATED ALWAYS AS",
    "jsonb_typeof(evidence_json->'documentId')='string'",
    "jsonb_typeof(evidence_json->'sourceUrl')='string'",
    "jsonb_typeof(evidence_json->'checksum')='string'",
    "btrim(evidence_json->>'documentId', E' \\t\\n\\r\\f\\v')<>''",
    "evidence_count IS NULL OR evidence_count NOT IN(0,1)",
)
for token in required:
    if token not in migration:
        raise SystemExit(f"stage A contract missing: {token}")
for forbidden in (
    "framework_screen_data_binding", "framework_page_design_assurance",
    "CREATE TRIGGER", "CREATE FUNCTION", "CREATE OR REPLACE VIEW",
):
    if forbidden.lower() in migration.lower():
        raise SystemExit(f"stage A changes contract/gate scope: {forbidden}")
if re.search(r"(?im)^\s*(insert|update|delete|merge|truncate)\b", migration):
    raise SystemExit("stage A migration contains data DML")
if r'evidence_count as \"evidenceCount\"' not in service:
    raise SystemExit("draft response does not select generated evidence_count")
if 'Map.of("draftVersion",0,"draftStatus","NOT_SAVED","evidenceCount",0)' not in service:
    raise SystemExit("empty draft response does not expose evidenceCount=0")
PY

PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=work_draft_evidence \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER"
started=1
export PGPASSWORD="$PASSWORD"
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d work_draft_evidence -X -v ON_ERROR_STOP=1)

ready=0
for _ in $(seq 1 40); do
  if "${PSQL[@]}" -Atqc 'select 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
(( ready )) || fail "postgres readiness timeout"

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE TABLE framework_process_work_draft(
  draft_id integer PRIMARY KEY,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE framework_screen_data_binding(
  binding_id integer PRIMARY KEY,
  lineage_status text NOT NULL,
  source_table text,
  source_column text
);
CREATE TABLE framework_page_design_assurance(
  screen_resource_id bigint PRIMARY KEY,
  lineage_passed boolean NOT NULL,
  design_gate_score integer NOT NULL,
  design_gate_status text NOT NULL
);

INSERT INTO framework_process_work_draft VALUES
  (1,'{}'),(2,'{"documentId":"DOC-existing"}'),(3,'{"unknown":"ignored"}');
INSERT INTO framework_screen_data_binding
SELECT i,CASE WHEN i<=29 THEN 'LOGICAL_CONTRACT' ELSE 'DB_RESOLVED' END,
       CASE WHEN i<=29 THEN NULL ELSE 'existing_table' END,
       CASE WHEN i<=29 THEN NULL ELSE 'existing_column' END
  FROM generate_series(1,69) i;
INSERT INTO framework_page_design_assurance VALUES(1,false,90,'FAILED');
SQL

draft_before="$("${PSQL[@]}" -Atqc "select count(*)||':'||md5(string_agg(draft_id||':'||evidence_json::text,',' order by draft_id)) from framework_process_work_draft")"
binding_before="$("${PSQL[@]}" -Atqc "select count(*)||':'||md5(string_agg(binding_id||':'||lineage_status||':'||coalesce(source_table,'')||':'||coalesce(source_column,''),',' order by binding_id)) from framework_screen_data_binding")"
gate_before="$("${PSQL[@]}" -AtF '|' -c 'select lineage_passed,design_gate_score,design_gate_status from framework_page_design_assurance where screen_resource_id=1')"
trigger_before="$("${PSQL[@]}" -Atqc "select count(*) from pg_trigger where tgrelid='framework_screen_data_binding'::regclass and not tgisinternal")"
[[ "$gate_before" == 'f|90|FAILED' ]] || fail "invalid gate fixture: $gate_before"

# ACCESS SHARE conflicts with ALTER TABLE ACCESS EXCLUSIVE.  The migration must
# fail within its bounded lock timeout and leave every existing row untouched.
"${PSQL[@]}" -c "begin; lock table framework_process_work_draft in access share mode; select pg_sleep(7); commit" \
  >"$TMP/lock-holder.log" 2>&1 &
holder_pid=$!
lock_ready=0
for _ in $(seq 1 30); do
  if [[ "$("${PSQL[@]}" -Atqc "select count(*) from pg_locks where relation='framework_process_work_draft'::regclass and mode='AccessShareLock' and granted")" -ge 1 ]]; then
    lock_ready=1; break
  fi
  sleep 0.1
done
(( lock_ready )) || fail "lock holder did not acquire ACCESS SHARE"
lock_started="$(date +%s)"
if "${PSQL[@]}" -f "$MIGRATION" >"$TMP/locked-migration.log" 2>&1; then
  fail "migration ignored conflicting lock"
fi
lock_elapsed=$(( $(date +%s) - lock_started ))
(( lock_elapsed >= 4 && lock_elapsed <= 7 )) || fail "lock timeout was not bounded: ${lock_elapsed}s"
wait "$holder_pid"
holder_pid=""

[[ "$("${PSQL[@]}" -Atqc "select count(*) from information_schema.columns where table_name='framework_process_work_draft' and column_name='evidence_count'")" == 0 ]] \
  || fail "failed ALTER left evidence_count behind"
[[ "$("${PSQL[@]}" -Atqc "select count(*)||':'||md5(string_agg(draft_id||':'||evidence_json::text,',' order by draft_id)) from framework_process_work_draft")" == "$draft_before" ]] \
  || fail "lock-timeout path changed work draft rows"

"${PSQL[@]}" -f "$MIGRATION" >/dev/null

"${PSQL[@]}" >/dev/null <<'SQL'
INSERT INTO framework_process_work_draft(draft_id,evidence_json) VALUES
  (4,jsonb_build_object('documentId',E' \t\n\r','sourceUrl','','checksum','  ')),
  (5,'{"documentId":"DOC-1"}'),
  (6,'{"sourceUrl":"https://evidence"}'),
  (7,'{"checksum":"sha256:abc"}'),
  (8,'{"documentId":"DOC-1","sourceUrl":"https://evidence","checksum":"sha256:abc"}'),
  (9,'{"unknown":"value"}'),
  (10,'null'),
  (11,'[]'),
  (12,'{"documentId":7}'),
  (13,'{"sourceUrl":true}'),
  (14,'{"checksum":{"value":"x"}}'),
  (15,'{"documentId":["DOC-1"]}');
SQL

counts="$("${PSQL[@]}" -Atqc "select string_agg(draft_id||':'||evidence_count,',' order by draft_id) from framework_process_work_draft")"
expected='1:0,2:1,3:0,4:0,5:1,6:1,7:1,8:1,9:0,10:0,11:0,12:0,13:0,14:0,15:0'
[[ "$counts" == "$expected" ]] || fail "generated count semantics mismatch: $counts"

"${PSQL[@]}" -c "update framework_process_work_draft set evidence_json='{\"documentId\":\"DOC-updated\"}' where draft_id=1" >/dev/null
[[ "$("${PSQL[@]}" -Atqc 'select evidence_count from framework_process_work_draft where draft_id=1')" == 1 ]] \
  || fail "generated count did not recalculate 0->1"
"${PSQL[@]}" -c "update framework_process_work_draft set evidence_json='{}' where draft_id=1" >/dev/null
[[ "$("${PSQL[@]}" -Atqc 'select evidence_count from framework_process_work_draft where draft_id=1')" == 0 ]] \
  || fail "generated count did not recalculate 1->0"

row_count_before_direct="$("${PSQL[@]}" -Atqc 'select count(*) from framework_process_work_draft')"
if "${PSQL[@]}" -c "insert into framework_process_work_draft(draft_id,evidence_json,evidence_count) values(99,'{}',1)" \
  >"$TMP/generated-write.log" 2>&1; then
  fail "generated column accepted a direct write"
fi
[[ "$("${PSQL[@]}" -Atqc 'select count(*) from framework_process_work_draft')" == "$row_count_before_direct" ]] \
  || fail "rejected generated write changed row count"
if "${PSQL[@]}" -c "insert into framework_process_work_draft(draft_id,evidence_json) values(99,'{malformed')" \
  >"$TMP/malformed-json.log" 2>&1; then
  fail "jsonb source accepted malformed evidence"
fi
[[ "$("${PSQL[@]}" -Atqc 'select count(*) from framework_process_work_draft')" == "$row_count_before_direct" ]] \
  || fail "rejected malformed evidence changed row count"

if "${PSQL[@]}" -f "$MIGRATION" >"$TMP/reapply.log" 2>&1; then
  fail "one-shot migration unexpectedly reapplied"
fi

binding_after="$("${PSQL[@]}" -Atqc "select count(*)||':'||md5(string_agg(binding_id||':'||lineage_status||':'||coalesce(source_table,'')||':'||coalesce(source_column,''),',' order by binding_id)) from framework_screen_data_binding")"
gate_after="$("${PSQL[@]}" -AtF '|' -c 'select lineage_passed,design_gate_score,design_gate_status from framework_page_design_assurance where screen_resource_id=1')"
trigger_after="$("${PSQL[@]}" -Atqc "select count(*) from pg_trigger where tgrelid='framework_screen_data_binding'::regclass and not tgisinternal")"
[[ "$binding_after" == "$binding_before" ]] || fail "stage A changed screen bindings"
[[ "$gate_after" == "$gate_before" ]] || fail "stage A changed assurance gate: $gate_after"
[[ "$trigger_after" == "$trigger_before" ]] || fail "stage A changed screen binding triggers"

elapsed=$(( $(date +%s) - started_at ))
(( elapsed < 300 )) || fail "test exceeded five-minute budget duration=${elapsed}s"
printf 'WORK_DRAFT_EVIDENCE_COUNT_POSTGRES_PASS existingRows=3 generatedSemantics=15 validSingleObject=1 invalidTypedValues=4 malformedJson=rejected updateRecalculation=0-1-0 directWrite=rejected lockTimeout=%ss bindingUpdates=0 triggerChanges=0 gate=90 reapply=rejected duration=%ss\n' "$lock_elapsed" "$elapsed"
