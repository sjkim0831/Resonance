#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
FIXTURE="$ROOT/ops/tests/fixtures/composite-axis-migration-performance-prerequisites.sql"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql"
IMAGE="${COMPOSITE_AXIS_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER_ID="codex-composite-axis-perf-$RANDOM-$$"
PASSWORD="composite-axis-perf-$RANDOM"
CONTEXTS="${COMPOSITE_AXIS_PERF_CONTEXTS:-968}"
SAFETY_CONTEXTS="${COMPOSITE_AXIS_SAFETY_CONTEXTS:-4}"
TARGET_PROCESSES="${COMPOSITE_AXIS_PERF_TARGET_PROCESSES:-144}"
CONTEXT_PROCESSES="${COMPOSITE_AXIS_PERF_CONTEXT_PROCESSES:-136}"
LEGACY_DOCUMENTS="${COMPOSITE_AXIS_PERF_LEGACY_DOCUMENTS:-18702}"
LEGACY_BYTES="${COMPOSITE_AXIS_PERF_LEGACY_BYTES:-36480}"
LEGACY_ENTROPY_BYTES="${COMPOSITE_AXIS_PERF_LEGACY_ENTROPY_BYTES:-4930}"
CONTRACT_PAYLOAD_TOTAL="${COMPOSITE_AXIS_PERF_CONTRACT_PAYLOAD_TOTAL:-17735428}"
BLUEPRINT_SPEC_TOTAL="${COMPOSITE_AXIS_PERF_BLUEPRINT_SPEC_TOTAL:-16071556}"
MIGRATION_BUDGET_MS="${COMPOSITE_AXIS_PERF_BUDGET_MS:-45000}"
PRODUCTION_LOGICAL_BYTES=682172076
PRODUCTION_STORED_BYTES=105517776
PRODUCTION_CONTRACT_PAYLOAD_BYTES=17735428
PRODUCTION_BLUEPRINT_SPEC_BYTES=16071556
CPU_LIMIT_CPUS=0.5
CPU_MAX_EXPECTED='50000 100000'
MEMORY_LIMIT_BYTES=4294967296
DATA_PARENT=/opt/resonance-data/tmp
DATA_ROOT="$DATA_PARENT/composite-axis-pgdata-$RANDOM-$$"
DATA_PARENT_RESOLVED=""
DATA_ROOT_RESOLVED=""
PORT=""
started=0
data_root_created=0
holder_pid=""
work=""

fail() { printf 'COMPOSITE_AXIS_MIGRATION_PERF_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  local original_status=$? cleanup_status=0 resolved=""
  set +e
  if [[ -n "$holder_pid" ]]; then
    kill "$holder_pid" >/dev/null 2>&1 || true
    wait "$holder_pid" >/dev/null 2>&1 || true
  fi
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER_ID" >/dev/null 2>&1 || true
    started=0
  fi
  if (( data_root_created )); then
    resolved="$(sudo realpath -e "$DATA_ROOT" 2>/dev/null)"
    if [[ -n "$resolved" && -n "$DATA_PARENT_RESOLVED"
          && "$resolved" == "$DATA_PARENT_RESOLVED"/composite-axis-pgdata-*
          && "$resolved" != "$DATA_PARENT_RESOLVED" ]]; then
      sudo find "$resolved" -xdev -depth -delete >/dev/null 2>&1 || cleanup_status=1
    else
      printf 'COMPOSITE_AXIS_MIGRATION_PERF_CLEANUP_REFUSED path=%s\n' "$resolved" >&2
      cleanup_status=1
    fi
    data_root_created=0
  fi
  if [[ -n "$work" && -d "$work" ]]; then
    rm -rf -- "$work" || cleanup_status=1
  fi
  if (( original_status == 0 && cleanup_status != 0 )); then return 1; fi
  return "$original_status"
}
trap cleanup EXIT INT TERM

[[ -f "$FIXTURE" ]] || fail "fixture missing: $FIXTURE"
[[ -f "$MIGRATION" ]] || fail "migration missing: $MIGRATION"
[[ "$CONTEXTS" =~ ^[0-9]+$ ]] && (( CONTEXTS >= 1 && CONTEXTS <= 2000 )) ||
  fail 'COMPOSITE_AXIS_PERF_CONTEXTS must be 1..2000'
[[ "$SAFETY_CONTEXTS" =~ ^[0-9]+$ ]] && (( SAFETY_CONTEXTS >= 1 && SAFETY_CONTEXTS <= 20 )) ||
  fail 'COMPOSITE_AXIS_SAFETY_CONTEXTS must be 1..20'
[[ "$TARGET_PROCESSES" =~ ^[0-9]+$ ]] && (( TARGET_PROCESSES >= 1 && TARGET_PROCESSES <= 500 )) ||
  fail 'COMPOSITE_AXIS_PERF_TARGET_PROCESSES must be 1..500'
[[ "$CONTEXT_PROCESSES" =~ ^[0-9]+$ ]] \
  && (( CONTEXT_PROCESSES >= 1 && CONTEXT_PROCESSES <= TARGET_PROCESSES \
        && CONTEXT_PROCESSES <= CONTEXTS )) ||
  fail 'COMPOSITE_AXIS_PERF_CONTEXT_PROCESSES must be 1..min(target processes,contexts)'
[[ "$LEGACY_DOCUMENTS" =~ ^[0-9]+$ ]] \
  && (( LEGACY_DOCUMENTS >= CONTEXTS * 18 && LEGACY_DOCUMENTS <= CONTEXTS * 20 )) ||
  fail 'COMPOSITE_AXIS_PERF_LEGACY_DOCUMENTS must be contexts*18..contexts*20'
[[ "$LEGACY_BYTES" =~ ^[0-9]+$ ]] && (( LEGACY_BYTES >= 128 && LEGACY_BYTES <= 65536 )) ||
  fail 'COMPOSITE_AXIS_PERF_LEGACY_BYTES must be 128..65536'
[[ "$LEGACY_ENTROPY_BYTES" =~ ^[0-9]+$ ]] \
  && (( LEGACY_ENTROPY_BYTES >= 128 && LEGACY_ENTROPY_BYTES <= LEGACY_BYTES )) ||
  fail 'COMPOSITE_AXIS_PERF_LEGACY_ENTROPY_BYTES must be 128..legacy bytes'
[[ "$CONTRACT_PAYLOAD_TOTAL" =~ ^[0-9]+$ ]] \
  && (( CONTRACT_PAYLOAD_TOTAL >= CONTEXTS * 2048 )) ||
  fail 'COMPOSITE_AXIS_PERF_CONTRACT_PAYLOAD_TOTAL must be at least contexts*2048'
[[ "$BLUEPRINT_SPEC_TOTAL" =~ ^[0-9]+$ ]] \
  && (( BLUEPRINT_SPEC_TOTAL >= CONTEXTS * 1024 )) ||
  fail 'COMPOSITE_AXIS_PERF_BLUEPRINT_SPEC_TOTAL must be at least contexts*1024'
[[ "$MIGRATION_BUDGET_MS" =~ ^[0-9]+$ ]] && (( MIGRATION_BUDGET_MS >= 1000 )) ||
  fail 'COMPOSITE_AXIS_PERF_BUDGET_MS must be at least 1000'
command -v psql >/dev/null || fail 'psql missing'
command -v createdb >/dev/null || fail 'createdb missing'
command -v python3 >/dev/null || fail 'python3 missing'
command -v realpath >/dev/null || fail 'realpath missing'
sudo -n true >/dev/null || fail 'passwordless sudo required'
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" ||
  fail "cached image missing: $IMAGE"
ctr_run_help="$(sudo ctr -n "$NAMESPACE" run --help)"
grep -Fq -- '--cpus value' <<<"$ctr_run_help" || fail 'ctr --cpus support missing'
grep -Fq -- '--memory-limit value' <<<"$ctr_run_help" || fail 'ctr --memory-limit support missing'
grep -Fq -- '--mount value' <<<"$ctr_run_help" || fail 'ctr --mount support missing'
python3 - "$MIGRATION" <<'PY'
import pathlib
import re
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r"LOCK TABLE\s+(.*?)\s+IN SHARE MODE NOWAIT;", source, re.S)
if not match:
    raise SystemExit("V154 source lock statement missing")
actual = [table.strip() for table in match.group(1).split(",")]
expected = [
    "framework_process_definition",
    "framework_process_step",
    "framework_process_step_screen_binding",
    "framework_professional_screen_contract",
    "framework_screen_blueprint",
    "framework_screen_resource",
]
if actual != expected:
    raise SystemExit(f"V154 source lock order drifted: {actual!r}")
required = (
    "CREATE TEMP TABLE v154_composite_target_identity_snapshot",
    "CREATE UNIQUE INDEX ux_v154_composite_target_identity_snapshot",
    "CREATE TEMP TABLE v154_composite_target_process_snapshot",
    "CREATE UNIQUE INDEX ux_v154_composite_target_process_snapshot",
    "COMPOSITE_MIGRATION_TARGET_SOURCE_DRIFT",
)
for fragment in required:
    if fragment not in source:
        raise SystemExit(f"V154 stable target snapshot contract missing: {fragment}")
if not source.index("ALTER TABLE integrated_design_document") < match.start():
    raise SystemExit("V154 source locks must follow the document AX acquisition")
PY
[[ -d "$DATA_PARENT" ]] || fail "isolated PGDATA parent missing: $DATA_PARENT"
DATA_PARENT_RESOLVED="$(realpath -e "$DATA_PARENT")"
[[ "$DATA_PARENT_RESOLVED" == /opt/resonance-data/* ]] ||
  fail "isolated PGDATA parent escaped /opt/resonance-data: $DATA_PARENT_RESOLVED"
sudo install -d -m 0700 "$DATA_ROOT"
data_root_created=1
DATA_ROOT_RESOLVED="$(sudo realpath -e "$DATA_ROOT")"
[[ "$DATA_ROOT_RESOLVED" == "$DATA_PARENT_RESOLVED"/composite-axis-pgdata-* \
    && "$DATA_ROOT_RESOLVED" != "$DATA_PARENT_RESOLVED" ]] ||
  fail "isolated PGDATA containment failed: $DATA_ROOT_RESOLVED"

PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --cpus "$CPU_LIMIT_CPUS" --memory-limit "$MEMORY_LIMIT_BYTES" \
  --mount "type=bind,src=$DATA_ROOT_RESOLVED,dst=/var/lib/postgresql/data,options=rbind:rw" \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=postgres \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER_ID"
started=1
sudo ctr -n "$NAMESPACE" containers info "$CONTAINER_ID" | python3 -c '
import json,sys
spec=json.load(sys.stdin)["Spec"]
root=sys.argv[1]
cpu=spec["linux"]["resources"]["cpu"]
memory=spec["linux"]["resources"]["memory"]
mount=[m for m in spec["mounts"] if m["destination"]=="/var/lib/postgresql/data"]
assert cpu.get("quota")==50000 and cpu.get("period")==100000, cpu
assert memory.get("limit")==4294967296, memory
assert len(mount)==1 and mount[0]["type"]=="bind" and mount[0]["source"]==root, mount
assert "rbind" in mount[0]["options"] and "rw" in mount[0]["options"], mount
' "$DATA_ROOT_RESOLVED" || fail 'container resource/mount manifest drifted'
export PGPASSWORD="$PASSWORD"
psql_base=(psql -h 127.0.0.1 -p "$PORT" -U postgres -X -v ON_ERROR_STOP=1)
for _ in $(seq 1 60); do
  "${psql_base[@]}" -d postgres -Atqc 'select 1' >/dev/null 2>&1 && break
  sleep 1
done
[[ "$("${psql_base[@]}" -d postgres -Atqc 'select 1')" == 1 ]] ||
  fail 'postgres readiness timeout'
sudo test -f "$DATA_ROOT_RESOLVED/PG_VERSION" ||
  fail 'PostgreSQL did not initialize isolated bind PGDATA'
task_pid="$(sudo ctr -n "$NAMESPACE" tasks ls | awk -v id="$CONTAINER_ID" '$1==id{print $2}')"
[[ "$task_pid" =~ ^[0-9]+$ ]] || fail "container task PID missing: $task_pid"
task_cgroup="$(awk -F: '$1=="0"{print $3}' "/proc/$task_pid/cgroup")"
[[ "$task_cgroup" == "/$NAMESPACE/$CONTAINER_ID" ]] ||
  fail "container task cgroup escaped expected scope: $task_cgroup"
cpu_max="$(sudo cat "/sys/fs/cgroup$task_cgroup/cpu.max")"
memory_max="$(sudo cat "/sys/fs/cgroup$task_cgroup/memory.max")"
[[ "$cpu_max" == "$CPU_MAX_EXPECTED" ]] || fail "runtime CPU cgroup drifted: $cpu_max"
[[ "$memory_max" == "$MEMORY_LIMIT_BYTES" ]] || fail "runtime memory cgroup drifted: $memory_max"

db() { local database="$1"; shift; "${psql_base[@]}" -d "$database" "$@"; }
scalar() { local database="$1" sql="$2"; db "$database" -Atqc "$sql"; }
prepare_database() {
  local database="$1" context_count="$2" target_process_count="$3"
  local context_process_count="$4" legacy_document_count="$5" legacy_bytes="$6"
  local entropy_bytes="$7" contract_payload_total="$8" blueprint_spec_total="$9"
  createdb -h 127.0.0.1 -p "$PORT" -U postgres "$database"
  db "$database" -v "context_count=$context_count" \
    -v "target_process_count=$target_process_count" \
    -v "context_process_count=$context_process_count" \
    -v "legacy_document_count=$legacy_document_count" -v "legacy_bytes=$legacy_bytes" \
    -v "legacy_entropy_bytes=$entropy_bytes" -v "contract_payload_total=$contract_payload_total" \
    -v "blueprint_spec_total=$blueprint_spec_total" \
    -f "$FIXTURE" >/dev/null
  [[ "$(scalar "$database" 'select count(*) from integrated_design_document')" == "$legacy_document_count" ]] ||
    fail "$database fixture row count drifted"
  [[ "$(scalar "$database" 'select count(*) from framework_process_definition')" == "$target_process_count" ]] ||
    fail "$database target process fixture count drifted"
  [[ "$(scalar "$database" 'select count(distinct process_code) from test_operational_context')" == "$context_process_count" ]] ||
    fail "$database context-bearing process fixture count drifted"
  [[ "$(scalar "$database" 'select sum(octet_length(to_jsonb(contract)::text))
      from framework_professional_screen_contract contract')" == "$contract_payload_total" ]] ||
    fail "$database selected contract payload bytes drifted"
  [[ "$(scalar "$database" 'select sum(octet_length(specification_json))
      from framework_screen_blueprint')" == "$blueprint_spec_total" ]] ||
    fail "$database blueprint specification bytes drifted"
  assert_exact_document_fence "$database"
}
prepare_safety_database() {
  local database="$1"
  prepare_database "$database" "$SAFETY_CONTEXTS" 1 1 \
    "$((SAFETY_CONTEXTS * 18))" 512 256 \
    "$((SAFETY_CONTEXTS * 4096))" "$((SAFETY_CONTEXTS * 2048))"
}
assert_exact_document_fence() {
  local database="$1"
  [[ "$(scalar "$database" "select count(*) from pg_trigger trigger_row
    where trigger_row.tgrelid='integrated_design_document'::regclass
      and trigger_row.tgname='trg_project_runtime_write_fence'
      and trigger_row.tgfoid=to_regprocedure('framework_guard_project_runtime_write_fence()')
      and trigger_row.tgenabled='O' and trigger_row.tgtype=23
      and not trigger_row.tgisinternal")" == 1 ]] ||
    fail "$database exact document write fence missing"
}
assert_rolled_back() {
  local database="$1" expected_rows="$2"
  [[ "$(scalar "$database" "select count(*) from information_schema.columns
    where table_schema='public' and table_name='integrated_design_document'
      and column_name='audience'")" == 0 ]] ||
    fail "$database failed migration left audience column"
  [[ "$(scalar "$database" "select count(*) from pg_class
    where oid=to_regclass('integrated_design_authority')")" == 0 ]] ||
    fail "$database failed migration left authority table"
  [[ "$(scalar "$database" 'select count(*) from integrated_design_document')" == "$expected_rows" ]] ||
    fail "$database failed migration changed document rows"
  assert_exact_document_fence "$database"
}
apply_migration() {
  local database="$1" output="$2"
  PGOPTIONS="-c check_function_bodies=off -c statement_timeout=$MIGRATION_BUDGET_MS" \
    db "$database" -v VERBOSITY=verbose -1 -f "$MIGRATION" >"$output" 2>&1
}
apply_migration_timed() {
  local database="$1" output="$2" start_ns end_ns elapsed_ms
  start_ns="$(date +%s%N)"
  if ! apply_migration "$database" "$output"; then
    tail -n 80 "$output" >&2 || true
    fail "$database migration failed"
  fi
  end_ns="$(date +%s%N)"
  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
  (( elapsed_ms <= MIGRATION_BUDGET_MS )) ||
    fail "$database migration exceeded ${MIGRATION_BUDGET_MS}ms: ${elapsed_ms}ms"
  printf '%s\n' "$elapsed_ms"
}
validate_success() {
  local database="$1" context_count="$2" target_process_count="$3"
  local context_process_count="$4" legacy_document_count="$5" expected
  local before_hash after_hash refresh fence_before_probe fence_probe_count
  expected=$((context_count * 18))
  assert_exact_document_fence "$database"
  [[ "$(scalar "$database" "select count(*) from pg_trigger
    where tgrelid='integrated_design_document'::regclass
      and tgname='trg_test_unrelated_document' and tgenabled='O'")" == 1 ]] ||
    fail "$database unrelated trigger was removed"
  [[ "$(scalar "$database" "select count(*) from test_write_fence_invocation
    where table_name='integrated_design_document'")" == 0 ]] ||
    fail "$database migration invoked the temporarily removed document row fence"
  [[ "$(scalar "$database" "select count(*) from test_write_fence_invocation
    where table_name='integrated_design_autocompletion_receipt' and operation='INSERT'")" == "$target_process_count" ]] ||
    fail "$database post-restore receipt insert did not traverse its write fence"
  [[ "$(scalar "$database" "select count(*) from integrated_design_document
    where audience='' and active_yn='N'")" == "$legacy_document_count" ]] ||
    fail "$database legacy retirement count drifted"
  [[ "$(scalar "$database" "select count(*) from integrated_design_document
    where audience='USER' and active_yn='Y'
      and status='IN_REVIEW' and updated_by='LIVE_CONTRACT_BACKFILL'
      and content::jsonb->>'schemaVersion'='carbonet.integrated-design-axis/v1'")" == "$expected" ]] ||
    fail "$database generated axis count drifted"
  [[ "$(scalar "$database" 'select count(*) from integrated_design_document_version')" == "$expected" ]] ||
    fail "$database legacy archive count drifted"
  [[ "$(scalar "$database" 'select count(distinct process_code)
    from framework_composite_design_target_identity')" == "$target_process_count" ]] ||
    fail "$database target process projection count drifted"
  [[ "$(scalar "$database" 'select count(distinct process_code)
    from framework_composite_design_target_identity where contract_id is not null')" == "$context_process_count" ]] ||
    fail "$database context-bearing process projection count drifted"
  [[ "$(scalar "$database" 'select count(distinct process_code)
    from framework_composite_design_target_identity where contract_id is null')" == "$((target_process_count - context_process_count))" ]] ||
    fail "$database target-only process projection count drifted"
  [[ "$(scalar "$database" 'select count(*) from integrated_design_autocompletion_receipt')" == "$target_process_count" ]] ||
    fail "$database target process receipt count drifted"
  [[ "$(scalar "$database" "select count(*) from integrated_design_autocompletion_receipt receipt
    where receipt.dependency_fingerprint<>
          framework_composite_dependency_fingerprint(receipt.process_code)")" == 0 ]] ||
    fail "$database receipt dependency fingerprint is not current post-refresh H0"

  before_hash="$(scalar "$database" "select encode(digest(string_agg(
    process_code||E'\\x1f'||step_code||E'\\x1f'||route_path||E'\\x1f'||audience||
    E'\\x1f'||document_type||E'\\x1f'||encode(digest(content,'sha256'),'hex'),E'\\n'
    order by process_code,step_code,route_path,document_type),
    'sha256'),'hex') from integrated_design_document
    where audience='USER' and active_yn='Y'")"
  refresh="$(scalar "$database" "select updated_count||','||protected_count||','||ambiguous_count
    from refresh_integrated_design_axis_documents(NULL,false)")"
  [[ "$refresh" == '0,0,0' ]] || fail "$database semantic replay wrote rows: $refresh"
  after_hash="$(scalar "$database" "select encode(digest(string_agg(
    process_code||E'\\x1f'||step_code||E'\\x1f'||route_path||E'\\x1f'||audience||
    E'\\x1f'||document_type||E'\\x1f'||encode(digest(content,'sha256'),'hex'),E'\\n'
    order by process_code,step_code,route_path,document_type),
    'sha256'),'hex') from integrated_design_document
    where audience='USER' and active_yn='Y'")"
  [[ "$before_hash" == "$after_hash" ]] || fail "$database semantic replay hash drifted"

  fence_before_probe="$(scalar "$database" "select count(*) from test_write_fence_invocation
    where table_name='integrated_design_document' and operation='INSERT'")"
  db "$database" -qc "insert into integrated_design_document(
    process_code,step_code,route_path,audience,document_type,title,content,status,updated_by)
    values('PROBE','STEP','/probe','USER','TEST','probe','{}','DRAFT','test')"
  fence_probe_count="$(scalar "$database" "select count(*) from test_write_fence_invocation
    where table_name='integrated_design_document' and operation='INSERT'")"
  [[ "$fence_probe_count" == "$((fence_before_probe + 1))" ]] ||
    fail "$database restored fence probe delta drifted: before=$fence_before_probe after=$fence_probe_count"
  printf '%s\n' "$before_hash"
}

work="$(mktemp -d)"

# A writer that is changing an existing direct target may already own
# process_step RowExclusiveLock before V154 starts.  The migration has document AX first, so
# its C-ordered source lock must fail immediately with 55P03 and roll back every
# catalog change rather than compile an unguarded late process.
prepare_safety_database target_source_busy
PGAPPNAME=composite-axis-target-source-writer db target_source_busy -qc "begin;
  update framework_process_step set user_path='/race/uncommitted'
   where process_code='PROC' and step_code='STEP0001';
  select pg_sleep(120);" >"$work/target-source-writer.log" 2>&1 &
holder_pid=$!
for _ in $(seq 1 100); do
  [[ "$(scalar target_source_busy "select count(*) from pg_stat_activity
    where application_name='composite-axis-target-source-writer'
      and wait_event='PgSleep'")" == 1 ]] && break
  sleep 0.1
done
[[ "$(scalar target_source_busy "select count(*) from pg_stat_activity
  where application_name='composite-axis-target-source-writer'
    and wait_event='PgSleep'")" == 1 ]] || fail 'target source writer did not become ready'
target_source_start_ns="$(date +%s%N)"
if apply_migration target_source_busy "$work/target-source-busy.log"; then
  fail 'pre-held target source RowExclusiveLock was accepted'
fi
target_source_elapsed_ms=$(( ( $(date +%s%N) - target_source_start_ns ) / 1000000 ))
(( target_source_elapsed_ms < 5000 )) ||
  fail "target source lock did not fail fast: ${target_source_elapsed_ms}ms"
grep -Fq 'ERROR:  55P03:' "$work/target-source-busy.log" ||
  fail 'target source lock conflict SQLSTATE drifted from 55P03'
assert_rolled_back target_source_busy "$((SAFETY_CONTEXTS * 18))"
[[ "$(scalar target_source_busy "select count(*) from framework_process_definition
  where process_code='PROC'")" == 1 ]] || fail 'target source fixture disappeared'
[[ "$(scalar target_source_busy "select user_path from framework_process_step
  where process_code='PROC' and step_code='STEP0001'")" == '/work/proc/0001' ]] ||
  fail 'uncommitted target source became visible'
[[ "$(scalar target_source_busy "select count(pg_terminate_backend(pid)) from pg_stat_activity
  where application_name='composite-axis-target-source-writer'")" == 1 ]] ||
  fail 'target source writer release failed'
kill "$holder_pid" >/dev/null 2>&1 || true
wait "$holder_pid" >/dev/null 2>&1 || true
holder_pid=""
[[ "$(scalar target_source_busy "select user_path from framework_process_step
  where process_code='PROC' and step_code='STEP0001'")" == '/work/proc/0001' ]] ||
  fail 'rolled-back target source update remained'
apply_migration target_source_busy "$work/target-source-release-success.log" ||
  fail 'released target source lock did not admit the migration'
validate_success target_source_busy "$SAFETY_CONTEXTS" 1 1 \
  "$((SAFETY_CONTEXTS * 18))" >/dev/null

# Blueprint changes alter the compiled context and its post-refresh H0 even when
# the target tuple itself is unchanged.  A pre-held semantic writer is therefore
# subject to the same native NOWAIT failure and full migration rollback.
prepare_safety_database h0_source_busy
PGAPPNAME=composite-axis-h0-source-writer db h0_source_busy -qc "begin;
  update framework_screen_blueprint set source_reference='UNCOMMITTED_RACE'
   where blueprint_id=1;
  select pg_sleep(120);" >"$work/h0-source-writer.log" 2>&1 &
holder_pid=$!
for _ in $(seq 1 100); do
  [[ "$(scalar h0_source_busy "select count(*) from pg_stat_activity
    where application_name='composite-axis-h0-source-writer'
      and wait_event='PgSleep'")" == 1 ]] && break
  sleep 0.1
done
[[ "$(scalar h0_source_busy "select count(*) from pg_stat_activity
  where application_name='composite-axis-h0-source-writer'
    and wait_event='PgSleep'")" == 1 ]] || fail 'H0 source writer did not become ready'
h0_source_start_ns="$(date +%s%N)"
if apply_migration h0_source_busy "$work/h0-source-busy.log"; then
  fail 'pre-held H0 source RowExclusiveLock was accepted'
fi
h0_source_elapsed_ms=$(( ( $(date +%s%N) - h0_source_start_ns ) / 1000000 ))
(( h0_source_elapsed_ms < 5000 )) ||
  fail "H0 source lock did not fail fast: ${h0_source_elapsed_ms}ms"
grep -Fq 'ERROR:  55P03:' "$work/h0-source-busy.log" ||
  fail 'H0 source lock conflict SQLSTATE drifted from 55P03'
assert_rolled_back h0_source_busy "$((SAFETY_CONTEXTS * 18))"
[[ "$(scalar h0_source_busy "select source_reference from framework_screen_blueprint
  where blueprint_id=1")" == '' ]] || fail 'uncommitted H0 source became visible'
[[ "$(scalar h0_source_busy "select count(pg_terminate_backend(pid)) from pg_stat_activity
  where application_name='composite-axis-h0-source-writer'")" == 1 ]] ||
  fail 'H0 source writer release failed'
kill "$holder_pid" >/dev/null 2>&1 || true
wait "$holder_pid" >/dev/null 2>&1 || true
holder_pid=""

# Pause one real migration after the six source locks have been acquired.  A
# second session must observe all six granted ShareLocks, and a late new-process
# INSERT must fail with 55P03/write0 until the migration commits.
prepare_safety_database source_locks_observed
db source_locks_observed -qc "create function test_pause_v154_with_source_locks()
returns trigger language plpgsql as \$\$
begin
  if current_setting('test.v154_source_pause',true) is distinct from 'done' then
    perform set_config('test.v154_source_pause','done',false);
    perform pg_sleep(8);
  end if;
  return new;
end \$\$;
create trigger trg_test_pause_v154_with_source_locks
before insert on integrated_design_document
for each row execute function test_pause_v154_with_source_locks();"
PGAPPNAME=composite-axis-source-lock-migration \
  apply_migration source_locks_observed "$work/source-lock-migration.log" &
holder_pid=$!
for _ in $(seq 1 120); do
  [[ "$(scalar source_locks_observed "select count(*) from pg_stat_activity
    where application_name='composite-axis-source-lock-migration'
      and wait_event='PgSleep'")" == 1 ]] && break
  sleep 0.1
done
[[ "$(scalar source_locks_observed "select count(*) from pg_stat_activity
  where application_name='composite-axis-source-lock-migration'
    and wait_event='PgSleep'")" == 1 ]] || fail 'source-lock migration pause did not become ready'
[[ "$(scalar source_locks_observed "select count(*) from pg_locks held_lock
  join pg_class relation on relation.oid=held_lock.relation
 where held_lock.pid=(select pid from pg_stat_activity
        where application_name='composite-axis-source-lock-migration')
   and held_lock.mode='ShareLock' and held_lock.granted
   and relation.relname in('framework_process_definition','framework_process_step',
     'framework_process_step_screen_binding','framework_professional_screen_contract',
     'framework_screen_blueprint','framework_screen_resource')")" == 6 ]] ||
  fail 'migration did not hold all six target source ShareLocks'
late_target_start_ns="$(date +%s%N)"
if PGOPTIONS='-c lock_timeout=500ms' db source_locks_observed -v VERBOSITY=verbose \
    -qc "insert into framework_process_definition
      values('PROC_LATE','WORK','ACTOR','1.0.0')" >"$work/late-target-write.log" 2>&1; then
  fail 'late target source write bypassed migration ShareLocks'
fi
late_target_elapsed_ms=$(( ( $(date +%s%N) - late_target_start_ns ) / 1000000 ))
(( late_target_elapsed_ms < 5000 )) ||
  fail "late target source write did not fail fast: ${late_target_elapsed_ms}ms"
grep -Fq 'ERROR:  55P03:' "$work/late-target-write.log" ||
  fail 'late target source write SQLSTATE drifted from 55P03'
[[ "$(scalar source_locks_observed "select count(*) from framework_process_definition
  where process_code='PROC_LATE'")" == 0 ]] || fail 'late target source write was not atomic'
if ! wait "$holder_pid"; then
  holder_pid=""
  tail -n 80 "$work/source-lock-migration.log" >&2 || true
  fail 'source-lock observation migration failed'
fi
holder_pid=""
db source_locks_observed -qc 'drop trigger trg_test_pause_v154_with_source_locks
  on integrated_design_document; drop function test_pause_v154_with_source_locks()'
validate_success source_locks_observed "$SAFETY_CONTEXTS" 1 1 \
  "$((SAFETY_CONTEXTS * 18))" >/dev/null

# Missing prerequisite: fail before any data rewrite and leave the initial
# catalog unchanged.  This also proves the migration never drops an inexact
# or absent trigger by name alone.
prepare_safety_database missing_fence
db missing_fence -qc 'drop trigger trg_project_runtime_write_fence on integrated_design_document'
if apply_migration missing_fence "$work/missing.log"; then
  fail 'missing write fence was accepted'
fi
grep -Fq 'COMPOSITE_MIGRATION_DOCUMENT_WRITE_FENCE_NOT_EXACT' "$work/missing.log" ||
  fail 'missing write fence reason drifted'
[[ "$(scalar missing_fence "select count(*) from information_schema.columns
  where table_schema='public' and table_name='integrated_design_document'
    and column_name='audience'")" == 0 ]] || fail 'missing-fence failure left audience column'

# Fail from an unrelated INSERT trigger after V154000 has dropped the exact
# document fence.  The enclosing Flyway transaction must roll that DROP and
# every prior DDL/DML change back, while retaining the unrelated trigger.
prepare_safety_database late_failure
db late_failure -qc "create function test_fail_after_document_fence_drop()
returns trigger language plpgsql as \$\$
begin
  if exists(select 1 from pg_trigger where
      tgrelid='integrated_design_document'::regclass
      and tgname='trg_project_runtime_write_fence' and not tgisinternal) then
    raise exception 'TEST_LATE_DOCUMENT_FENCE_WAS_NOT_DROPPED';
  end if;
  raise exception 'TEST_LATE_FAILURE_AFTER_DOCUMENT_FENCE_DROP';
end \$\$;
create trigger trg_test_force_late_failure before insert on integrated_design_document
for each row execute function test_fail_after_document_fence_drop();"
if apply_migration late_failure "$work/late-failure.log"; then
  fail 'post-fence-drop failure was not propagated'
fi
grep -Fq 'TEST_LATE_FAILURE_AFTER_DOCUMENT_FENCE_DROP' "$work/late-failure.log" ||
  fail 'post-fence-drop failure did not observe the dropped exact fence'
assert_rolled_back late_failure "$((SAFETY_CONTEXTS * 18))"
[[ "$(scalar late_failure "select count(*) from pg_trigger where
  tgrelid='integrated_design_document'::regclass
  and tgname='trg_test_force_late_failure' and tgenabled='O'")" == 1 ]] ||
  fail 'late unrelated failure trigger was not retained'

# A durable PURGED receipt is checked while the sorted canonical process locks
# are held.  The complete Flyway-style transaction must roll back the ALTER and
# retain the original trigger and rows.
prepare_safety_database purged_target
db purged_target -qc "insert into framework_project_runtime_purge_receipt
  values('PROC','PROJECT_A','PURGED')"
if apply_migration purged_target "$work/purged.log"; then
  fail 'PURGED target was accepted'
fi
grep -Fq 'COMPOSITE_MIGRATION_TARGET_PURGED: PROC' "$work/purged.log" ||
  fail 'PURGED target reason drifted'
assert_rolled_back purged_target "$((SAFETY_CONTEXTS * 18))"

# A worker may already own the canonical publication lock and then need the
# document table.  V154000 owns AX first, so it must try (never wait for) the
# canonical lock, fail with 40001, and roll the whole migration back.
prepare_safety_database lock_race
PGAPPNAME=composite-axis-lock-holder db lock_race -qc "begin;
  select pg_advisory_xact_lock(hashtextextended('CANONICAL_PROCESS_PUBLICATION_V1:PROC',0));
  select pg_sleep(120);" >"$work/holder.log" 2>&1 &
holder_pid=$!
for _ in $(seq 1 100); do
  [[ "$(scalar lock_race "select count(*) from pg_stat_activity
    where application_name='composite-axis-lock-holder' and wait_event='PgSleep'")" == 1 ]] && break
  sleep 0.1
done
[[ "$(scalar lock_race "select count(*) from pg_stat_activity
  where application_name='composite-axis-lock-holder' and wait_event='PgSleep'")" == 1 ]] ||
  fail 'canonical lock holder did not become ready'
lock_start_ns="$(date +%s%N)"
if apply_migration lock_race "$work/lock.log"; then
  fail 'busy canonical process lock was accepted'
fi
lock_elapsed_ms=$(( ( $(date +%s%N) - lock_start_ns ) / 1000000 ))
(( lock_elapsed_ms < 5000 )) || fail "canonical lock did not fail fast: ${lock_elapsed_ms}ms"
grep -Fq 'COMPOSITE_MIGRATION_PROCESS_LOCK_BUSY: PROC' "$work/lock.log" ||
  fail 'canonical lock conflict reason drifted'
grep -Fq 'ERROR:  40001:' "$work/lock.log" ||
  fail 'canonical lock conflict SQLSTATE drifted from 40001'
assert_rolled_back lock_race "$((SAFETY_CONTEXTS * 18))"
[[ "$(scalar lock_race "select count(pg_terminate_backend(pid)) from pg_stat_activity
  where application_name='composite-axis-lock-holder'")" == 1 ]] ||
  fail 'canonical lock holder release failed'
kill "$holder_pid" >/dev/null 2>&1 || true
wait "$holder_pid" >/dev/null 2>&1 || true
holder_pid=""
for _ in $(seq 1 100); do
  [[ "$(scalar lock_race "select count(*) from pg_stat_activity
    where application_name='composite-axis-lock-holder'")" == 0 ]] && break
  sleep 0.1
done
[[ "$(scalar lock_race "select count(*) from pg_stat_activity
  where application_name='composite-axis-lock-holder'")" == 0 ]] ||
  fail 'canonical lock holder session residue remained'

apply_migration lock_race "$work/lock-release-success.log" ||
  fail 'released canonical lock did not admit the migration'
validate_success lock_race "$SAFETY_CONTEXTS" 1 1 "$((SAFETY_CONTEXTS * 18))" >/dev/null

prepare_database performance_one "$CONTEXTS" "$TARGET_PROCESSES" "$CONTEXT_PROCESSES" \
  "$LEGACY_DOCUMENTS" "$LEGACY_BYTES" "$LEGACY_ENTROPY_BYTES" \
  "$CONTRACT_PAYLOAD_TOTAL" "$BLUEPRINT_SPEC_TOTAL"
fixture_logical_bytes="$(scalar performance_one 'select sum(octet_length(content)) from integrated_design_document')"
fixture_stored_bytes="$(scalar performance_one 'select sum(pg_column_size(content)) from integrated_design_document')"
fixture_contract_bytes="$(scalar performance_one 'select sum(octet_length(to_jsonb(contract)::text))
  from framework_professional_screen_contract contract')"
fixture_blueprint_bytes="$(scalar performance_one 'select sum(octet_length(specification_json))
  from framework_screen_blueprint')"
contract_average_bytes=$(((fixture_contract_bytes + CONTEXTS / 2) / CONTEXTS))
blueprint_average_bytes=$(((fixture_blueprint_bytes + CONTEXTS / 2) / CONTEXTS))
if (( CONTEXTS == 968 && LEGACY_DOCUMENTS == 18702 && LEGACY_BYTES == 36480 \
      && LEGACY_ENTROPY_BYTES == 4930 && TARGET_PROCESSES == 144 \
      && CONTEXT_PROCESSES == 136 )); then
  (( fixture_logical_bytes >= PRODUCTION_LOGICAL_BYTES * 99 / 100 \
      && fixture_logical_bytes <= PRODUCTION_LOGICAL_BYTES * 101 / 100 )) ||
    fail "operational fixture logical bytes drifted: $fixture_logical_bytes"
  (( fixture_stored_bytes >= PRODUCTION_STORED_BYTES * 95 / 100 \
      && fixture_stored_bytes <= PRODUCTION_STORED_BYTES * 105 / 100 )) ||
    fail "operational fixture stored bytes drifted: $fixture_stored_bytes"
  (( fixture_contract_bytes >= PRODUCTION_CONTRACT_PAYLOAD_BYTES * 99 / 100 \
      && fixture_contract_bytes <= PRODUCTION_CONTRACT_PAYLOAD_BYTES * 101 / 100 \
      && contract_average_bytes >= 18138 && contract_average_bytes <= 18506 )) ||
    fail "operational selected contract bytes drifted: total=$fixture_contract_bytes average=$contract_average_bytes"
  (( fixture_blueprint_bytes >= PRODUCTION_BLUEPRINT_SPEC_BYTES * 99 / 100 \
      && fixture_blueprint_bytes <= PRODUCTION_BLUEPRINT_SPEC_BYTES * 101 / 100 \
      && blueprint_average_bytes >= 16437 && blueprint_average_bytes <= 16769 )) ||
    fail "operational blueprint bytes drifted: total=$fixture_blueprint_bytes average=$blueprint_average_bytes"
fi
run1_ms="$(apply_migration_timed performance_one "$work/run1.log")"
run1_hash="$(validate_success performance_one "$CONTEXTS" "$TARGET_PROCESSES" \
  "$CONTEXT_PROCESSES" "$LEGACY_DOCUMENTS")"

prepare_database performance_two "$CONTEXTS" "$TARGET_PROCESSES" "$CONTEXT_PROCESSES" \
  "$LEGACY_DOCUMENTS" "$LEGACY_BYTES" "$LEGACY_ENTROPY_BYTES" \
  "$CONTRACT_PAYLOAD_TOTAL" "$BLUEPRINT_SPEC_TOTAL"
[[ "$(scalar performance_two 'select sum(octet_length(content)) from integrated_design_document')" == "$fixture_logical_bytes" ]] ||
  fail 'two-run fixture logical bytes drifted'
[[ "$(scalar performance_two 'select sum(pg_column_size(content)) from integrated_design_document')" == "$fixture_stored_bytes" ]] ||
  fail 'two-run fixture stored bytes drifted'
[[ "$(scalar performance_two 'select sum(octet_length(to_jsonb(contract)::text))
  from framework_professional_screen_contract contract')" == "$fixture_contract_bytes" ]] ||
  fail 'two-run selected contract payload bytes drifted'
[[ "$(scalar performance_two 'select sum(octet_length(specification_json))
  from framework_screen_blueprint')" == "$fixture_blueprint_bytes" ]] ||
  fail 'two-run blueprint specification bytes drifted'
run2_ms="$(apply_migration_timed performance_two "$work/run2.log")"
run2_hash="$(validate_success performance_two "$CONTEXTS" "$TARGET_PROCESSES" \
  "$CONTEXT_PROCESSES" "$LEGACY_DOCUMENTS")"
[[ "$run1_hash" == "$run2_hash" ]] || fail 'two-run generated result hash drifted'

observed_max_ms="$run1_ms"
if (( run2_ms > observed_max_ms )); then observed_max_ms="$run2_ms"; fi
headroom_ms=$((MIGRATION_BUDGET_MS - observed_max_ms))
headroom_tenths=$((headroom_ms * 1000 / MIGRATION_BUDGET_MS))
printf 'COMPOSITE_AXIS_MIGRATION_PERF_POSTGRES_PASS targetProcesses=%s contextProcesses=%s targetOnlyProcesses=%s contexts=%s axes=%s legacyDocuments=%s logicalBytes=%s storedBytes=%s contractPayloadBytes=%s contractAverageBytes=%s blueprintSpecBytes=%s blueprintAverageBytes=%s cpuQuota=%s cpuPeriod=%s memoryMax=%s pgdataClass=opt-resonance-data sourceLocks=6 targetSourceFailMs=%s h0SourceFailMs=%s lateTargetFailMs=%s legacyBytesPerRow=%s entropyBytes=%s run1Ms=%s run2Ms=%s observedMaxMs=%s budgetMs=%s headroomMs=%s headroomPct=%d.%d lockFailMs=%s hash=%s\n' \
  "$TARGET_PROCESSES" "$CONTEXT_PROCESSES" "$((TARGET_PROCESSES - CONTEXT_PROCESSES))" \
  "$CONTEXTS" "$((CONTEXTS * 18))" "$LEGACY_DOCUMENTS" "$fixture_logical_bytes" \
  "$fixture_stored_bytes" "$fixture_contract_bytes" "$contract_average_bytes" \
  "$fixture_blueprint_bytes" "$blueprint_average_bytes" "${cpu_max%% *}" "${cpu_max##* }" "$memory_max" \
  "$target_source_elapsed_ms" "$h0_source_elapsed_ms" "$late_target_elapsed_ms" \
  "$LEGACY_BYTES" "$LEGACY_ENTROPY_BYTES" "$run1_ms" "$run2_ms" \
  "$observed_max_ms" "$MIGRATION_BUDGET_MS" "$headroom_ms" \
  "$((headroom_tenths / 10))" "$((headroom_tenths % 10))" "$lock_elapsed_ms" "$run1_hash"
