#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JOB_SCRIPT="$ROOT/ops/scripts/run-flyway-migration-job.sh"
RUNNER="$ROOT/apps/carbonet-api/src/main/java/egovframework/com/migration/FlywayMigrationApplication.java"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
BUILD_DEPLOY="$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
FAILURE_HANDLER="$ROOT/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
LAUNCHER="$ROOT/ops/scripts/auto-deploy-main-launcher.sh"
tmp="$(mktemp -d)"
cleanup() {
  local status="$?"
  rm -rf "$tmp"
  return "$status"
}
trap cleanup EXIT INT TERM

bash -n "$JOB_SCRIPT"
python3 - "$JOB_SCRIPT" "$RUNNER" "$AUTO_DEPLOY" "$BUILD_DEPLOY" "$FAILURE_HANDLER" "$LAUNCHER" <<'PY'
import pathlib
import sys

job = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
runner = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
for token in (
    'timeout_seconds="${CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS:-}"',
    'timeout_seconds=900',
    'activeDeadlineSeconds',
    'CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS',
    'CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS',
    'CARBONET_FLYWAY_APPLICATION_NAME',
    'job_terminal=false',
    'controlled abort: quiescing the owned DB session',
    'terminal_state="OBSERVER_TIMEOUT"',
    'pg_cancel_backend',
    'pg_terminate_backend',
    'pg_is_in_recovery()',
    '--cascade=foreground',
    '--request-timeout=',
    'job-name=$job',
    '--recover-cleanup-hold',
    'RECOVERY_HOLD_CLEARED',
    'CLEANUP_BUDGET_EXHAUSTED',
    'JOB_APPLY_ARMED',
    'manifest=""',
    'if [[ -n "${manifest:-}" ]]',
):
    if token not in job:
        raise SystemExit(f"Flyway Job timeout contract missing: {token}")
if "carbonet_flyway_schema_history" in job:
    raise SystemExit("cleanup must not use a global failed-history invariant")
manifest_init = job.index('manifest=""')
cleanup_trap_arm = job.index("trap cleanup EXIT")
manifest_allocate = job.index('manifest="$(mktemp)"', cleanup_trap_arm)
deployment_read = job.index('get deployment "$deployment" -o json', manifest_allocate)
if not manifest_init < cleanup_trap_arm < manifest_allocate < deployment_read:
    raise SystemExit("Flyway manifest must be allocated only after validation and cleanup arming")
if job.count('manifest="$(mktemp)"') != 1:
    raise SystemExit("Flyway manifest must have one late allocation site")
arm = job.index("write_cleanup_hold_evidence JOB_APPLY_ARMED")
ownership = job.index("job_applied=true", arm)
apply = job.index('bounded_kubectl_for 30 -n "$namespace" apply -f "$manifest"', ownership)
if not arm < ownership < apply:
    raise SystemExit("durable cleanup evidence must be armed before ambiguous Job apply")
for token in (
    '.initSql(initSql)',
    'ApplicationName=',
    'SET statement_timeout',
    'SET lock_timeout',
    'boundedIntegerEnv(',
    'FLYWAY_MIGRATION_BUDGET',
):
    if token not in runner:
        raise SystemExit(f"Flyway Java timeout contract missing: {token}")
auto_source = pathlib.Path(sys.argv[3]).read_text(encoding="utf-8")
build_source = pathlib.Path(sys.argv[4]).read_text(encoding="utf-8")
handler_source = pathlib.Path(sys.argv[5]).read_text(encoding="utf-8")
launcher_source = pathlib.Path(sys.argv[6]).read_text(encoding="utf-8")
cleanup = auto_source.split("cleanup_remote_backup() {", 1)[1].split("\n}", 1)[0]
bounded_cleanup = auto_source.split("bounded_cleanup_kubectl() {", 1)[1].split("\n}", 1)[0]
if "exec -i" not in cleanup or "-v ON_ERROR_STOP=1 -v app_name=" not in cleanup:
    raise SystemExit("backup cleanup must feed psql variables through an interactive stdin command")
if '-c "select pg_terminate_backend' in cleanup:
    raise SystemExit("backup cleanup retained the psql -c variable interpolation bug")
if "bounded_cleanup_kubectl" not in cleanup:
    raise SystemExit("backup cleanup kubectl call is not externally bounded")
for token in ('timeout --signal=TERM --kill-after=1s', '--request-timeout="${request_timeout_seconds}s"'):
    if token not in bounded_cleanup:
        raise SystemExit(f"bounded deploy cleanup missing: {token}")
cleanup_trap = auto_source.split("cleanup_deploy() {", 1)[1].split("\n}", 1)[0]
hold_fixed = cleanup_trap.index("flyway_hold_active=true")
backup_cleanup = cleanup_trap.index("cleanup_remote_backup", hold_fixed)
if not hold_fixed < backup_cleanup:
    raise SystemExit("cleanup hold status 79 must be fixed before remote backup cleanup")
for token in (
    'cleanup_backup_dir="${BACKUP_DIR:-}"',
    '"${backup_partial_file:-}"',
    '"${roles_backup_partial_file:-}"',
    '[[ -z "$cleanup_backup_dir" ]]',
    '"$cleanup_backup_dir"/*.partial."$$"',
):
    if token not in cleanup_trap:
        raise SystemExit(f"nounset-safe partial backup cleanup missing: {token}")
runner_gate = auto_source.split("run_flyway_job_timeout_contract_if_required() {", 1)[1].split("\n}", 1)[0]
for token in (
    "ops/scripts/auto-deploy-main.sh",
    "ops/scripts/auto-deploy-main-launcher.sh",
    "ops/scripts/resonance-k8s-build-deploy-80-v2.sh",
    "ops/scripts/carbonet-auto-deploy-failure-handler.sh",
    "ops/scripts/run-flyway-migration-job.sh",
    "ops/tests/test-flyway-job-timeout-contract.sh",
    "FlywayMigrationApplication.java",
):
    if token not in runner_gate:
        raise SystemExit(f"runtime prebuild Flyway timeout mapping missing: {token}")
merge = auto_source.index('git merge --ff-only "$target_commit"')
call = auto_source.index("\nrun_flyway_job_timeout_contract_if_required\n", merge)
performance_call = auto_source.index("\nrun_composite_axis_migration_performance_if_required\n", call)
build = auto_source.index("bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh", performance_call)
if not merge < call < performance_call < build:
    raise SystemExit("Flyway timeout contract must run after candidate merge and before runtime build/deploy")
performance_gate = auto_source.split("run_composite_axis_migration_performance_if_required() {", 1)[1].split("\n}", 1)[0]
for token in (
    "V20260816154000__compile_composite_executable_design_authority.sql",
    "composite-axis-migration-performance-prerequisites.sql",
    "test-composite-axis-migration-performance-postgres.sh",
    "test-composite-executable-design-authority-postgres.sql",
    "test-project-runtime-purge-composite-migrations-postgres.sh",
    'timeout --signal=TERM --kill-after=10s "${timeout_seconds}s"',
):
    if token not in performance_gate:
        raise SystemExit(f"runtime-path composite migration performance gate missing: {token}")
for token in (
    'recover_flyway_cleanup_hold_if_present || exit $?',
    'flyway_cleanup_recovery_hold=true',
    'RECOVERY_HOLD preserved attempt/checkpoint state',
    'CARBONET_FLYWAY_CLEANUP_HOLD_FILE="$FLYWAY_CLEANUP_HOLD_FILE"',
    'FLYWAY_JOB_RUNNER="${CARBONET_FLYWAY_JOB_RUNNER:-$ROOT_DIR/ops/scripts/run-flyway-migration-job.sh}"',
    'if (( build_deploy_status == 79 ))',
):
    if token not in auto_source:
        raise SystemExit(f"auto-deploy cleanup-hold handoff missing: {token}")
preflight = auto_source.index('recover_flyway_cleanup_hold_if_present || exit $?')
attempt_recovery = auto_source.index('verify_bootstrap_orphan_recovery_helper || exit $?')
lock_open = auto_source.index('exec 9>"$LOCK_FILE"')
lock_acquire = auto_source.index('flock -n 9', lock_open)
if not lock_open < lock_acquire < preflight < attempt_recovery:
    raise SystemExit("deploy flock must precede cleanup hold and every durable recovery writer")
if 'if (( flyway_status == 79 ))' not in build_source or 'return 79' not in build_source:
    raise SystemExit("build/deploy child must preserve Flyway cleanup status 79")
hold = handler_source.index('category=FLYWAY_CLEANUP_HOLD')
attempt = handler_source.index('category=ATTEMPT_RECOVERY_PENDING')
if not hold < attempt:
    raise SystemExit("failure handler must prioritize cleanup hold over attempt recovery")
for token in (
    'target_commit:ops/scripts/run-flyway-migration-job.sh',
    'snapshot_flyway_job_runner_sha256=',
    'CARBONET_FLYWAY_JOB_RUNNER="$snapshot_flyway_job_runner"',
):
    if token not in launcher_source:
        raise SystemExit(f"target-bound cleanup runner snapshot missing: {token}")
PY

mkdir -p "$tmp/bin" "$tmp/captures" "$tmp/logs" "$tmp/manifest-tmp"
cat >"$tmp/deployment.json" <<'JSON'
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "carbonet-runtime",
          "image": "old-image",
          "env": [
            {"name": "CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS", "value": "1"},
            {"name": "CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS", "value": "1"}
          ]
        }]
      }
    }
  }
}
JSON

cat >"$tmp/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$MOCK_EVENTS"
joined=" $* "
if [[ "$joined" == *" get secret "* ]]; then
  printf '%s\n' '{"data":{"SPRING_FLYWAY_PASSWORD":"Zml4dHVyZQ=="}}'
  exit 0
fi
if [[ "$joined" == *" get deployment "* ]]; then
  [[ "${MOCK_DEPLOYMENT_FAILURE:-false}" != true ]] || exit 43
  cat "$MOCK_DEPLOYMENT"
  exit 0
fi
if [[ "$joined" == *" apply "* ]]; then
  file=""
  mode="live"
  while (($#)); do
    case "$1" in
      --dry-run=*) mode="${1#--dry-run=}" ;;
      -f) shift; file="$1" ;;
    esac
    shift
  done
  [[ -n "$file" ]]
  cp "$file" "$MOCK_CAPTURE_DIR/$mode.json"
  if [[ "$mode" == live && "${MOCK_APPLY_FAILURE:-false}" == true ]]; then
    exit 42
  fi
  exit 0
fi
if [[ "$joined" == *" get job/"* ]]; then
  : >"$MOCK_OBSERVER_SEEN"
  state="${MOCK_JOB_STATE:-COMPLETE}"
  if [[ "$state" == ACTIVE_THEN_FAILED ]]; then
    count=0
    [[ -f "$MOCK_JOB_COUNTER" ]] && count="$(cat "$MOCK_JOB_COUNTER")"
    printf '%s' "$((count + 1))" >"$MOCK_JOB_COUNTER"
    (( count == 0 )) && state=ACTIVE || state=FAILED
  fi
  case "$state" in
    COMPLETE) printf '%s\n' '{"status":{"succeeded":1,"conditions":[{"type":"Complete","status":"True"}]}}' ;;
    FAILED) printf '%s\n' '{"status":{"failed":1,"conditions":[{"type":"Failed","status":"True"}]}}' ;;
    ACTIVE) printf '%s\n' '{"status":{"active":1}}' ;;
    *) exit 91 ;;
  esac
  exit 0
fi
if [[ "$joined" == *" exec "* ]]; then
  if [[ "${MOCK_BACKUP_CLEANUP_HANG:-false}" == true \
     && "$joined" == *" app_name=carbonet-auto-deploy-timeout-contract "* ]]; then
    /usr/bin/sleep 30
  fi
  sql="$(cat)"
  printf '%s\n' "$sql" >>"$MOCK_SQL"
  if [[ "$sql" == *"flyway_application_name"* ]]; then
    [[ "$sql" == *"pg_is_in_recovery()"* ]] || exit 92
  fi
  if [[ "$joined" == *" exec "* && "$joined" == *" postgres-patroni-old "* \
     && "${MOCK_OLD_PRIMARY_IS_REPLICA:-false}" == true ]]; then
    exit 93
  fi
  if [[ "$sql" == *"SELECT count(*) FROM pg_stat_activity"* \
      && -n "${MOCK_SESSION_SEQUENCE:-}" ]]; then
    count=0
    [[ -f "$MOCK_SESSION_COUNTER" ]] && count="$(cat "$MOCK_SESSION_COUNTER")"
    printf '%s' "$((count + 1))" >"$MOCK_SESSION_COUNTER"
    IFS=',' read -r -a sequence <<<"$MOCK_SESSION_SEQUENCE"
    index="$count"
    (( index >= ${#sequence[@]} )) && index=$((${#sequence[@]} - 1))
    printf '%s\n' "${sequence[$index]}"
    exit 0
  fi
  printf '%s\n' 0
  exit 0
fi
if [[ "$joined" == *" get pods "* ]]; then
  if [[ "${MOCK_POD_RESIDUE:-false}" == true ]]; then
    printf '%s\n' '{"items":[{"metadata":{"name":"flyway-residue"}}]}'
  else
    printf '%s\n' '{"items":[]}'
  fi
  exit 0
fi
if [[ "$joined" == *" logs job/"* ]]; then
  [[ "${MOCK_JOB_STATE:-COMPLETE}" == COMPLETE ]] && printf '%s\n' 'FLYWAY_MIGRATION_PASS fixture'
  exit 0
fi
if [[ "$joined" == *" delete job "* ]]; then
  count=0
  [[ -f "$MOCK_DELETE_COUNTER" ]] && count="$(cat "$MOCK_DELETE_COUNTER")"
  printf '%s' "$((count + 1))" >"$MOCK_DELETE_COUNTER"
  [[ "${MOCK_DELETE_FAILURE:-false}" != true ]]
  exit $?
fi
if [[ "$joined" == *" describe job/"* ]]; then
  exit 0
fi
printf 'unexpected kubectl invocation: %s\n' "$*" >&2
exit 90
SH
chmod +x "$tmp/bin/kubectl"

cat >"$tmp/bin/leader-resolver" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf 'RESOLVE %s\n' "${RESONANCE_POSTGRES_LEADER_POD:-unset}" >>"$MOCK_EVENTS"
count=0
[[ -f "$MOCK_RESOLVER_COUNTER" ]] && count="$(cat "$MOCK_RESOLVER_COUNTER")"
printf '%s' "$((count + 1))" >"$MOCK_RESOLVER_COUNTER"
if [[ -n "${MOCK_PRIMARY_SEQUENCE:-}" ]]; then
  IFS=',' read -r -a sequence <<<"$MOCK_PRIMARY_SEQUENCE"
  index="$count"
  (( index >= ${#sequence[@]} )) && index=$((${#sequence[@]} - 1))
  printf '%s\n' "${sequence[$index]}"
else
  printf '%s\n' postgres-patroni-primary
fi
SH
chmod +x "$tmp/bin/leader-resolver"

cat >"$tmp/bin/sleep" <<'SH'
#!/usr/bin/env bash
exit 0
SH
chmod +x "$tmp/bin/sleep"

cat >"$tmp/bin/date" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == +%Y%m%d%H%M%S ]]; then
  printf '%s\n' 20260817180000
elif [[ "${1:-}" == +%s && "${MOCK_DATE_MODE:-normal}" == timeout ]]; then
  if [[ -e "$MOCK_OBSERVER_SEEN" ]]; then value=1400; else value=1000; fi
  printf 'DATE %s\n' "$value" >>"$MOCK_EVENTS"
  printf '%s\n' "$value"
elif [[ "${1:-}" == +%s && "${MOCK_DATE_MODE:-normal}" == cleanup_hold ]]; then
  deletes=0
  [[ -f "$MOCK_DELETE_COUNTER" ]] && deletes="$(cat "$MOCK_DELETE_COUNTER")"
  value=$((1000 + deletes * 60))
  printf 'DATE %s\n' "$value" >>"$MOCK_EVENTS"
  printf '%s\n' "$value"
elif [[ "${1:-}" == +%s && "${MOCK_DATE_MODE:-normal}" == abort ]]; then
  count=0
  [[ -f "$MOCK_DATE_COUNTER" ]] && count="$(cat "$MOCK_DATE_COUNTER")"
  printf '%s' "$((count + 1))" >"$MOCK_DATE_COUNTER"
  if (( count == 1 )); then printf '%s\n' broken; else printf '%s\n' 1000; fi
else
  /usr/bin/date "$@"
fi
SH
chmod +x "$tmp/bin/date"

common_env=(
  PATH="$tmp/bin:$PATH"
  MOCK_DEPLOYMENT="$tmp/deployment.json"
  MOCK_CAPTURE_DIR="$tmp/captures"
  MOCK_EVENTS="$tmp/events"
  MOCK_JOB_COUNTER="$tmp/job-counter"
  MOCK_DATE_COUNTER="$tmp/date-counter"
  MOCK_SESSION_COUNTER="$tmp/session-counter"
  MOCK_DELETE_COUNTER="$tmp/delete-counter"
  MOCK_RESOLVER_COUNTER="$tmp/resolver-counter"
  MOCK_OBSERVER_SEEN="$tmp/observer-seen"
  MOCK_SQL="$tmp/sql"
  RESONANCE_POSTGRES_LEADER_POD=stale-injected-replica
  CARBONET_POSTDEPLOY_LEADER_RESOLVER="$tmp/bin/leader-resolver"
  CARBONET_POSTGRES_CONTAINER=patroni
  POSTGRES_DB=carbonet
  POSTGRES_ADMIN_USER=postgres
  CARBONET_FLYWAY_LOG_DIR="$tmp/logs"
  CARBONET_FLYWAY_CLEANUP_HOLD_FILE="$tmp/cleanup-hold.json"
  CARBONET_TARGET_COMMIT=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  TMPDIR="$tmp/manifest-tmp"
)

assert_manifest_residue_zero() {
  local context="$1" residue_count
  residue_count="$(find "$tmp/manifest-tmp" -mindepth 1 -maxdepth 1 -print | wc -l)"
  if [[ "$residue_count" != 0 ]]; then
    echo "Flyway manifest residue after $context: $residue_count" >&2
    find "$tmp/manifest-tmp" -mindepth 1 -maxdepth 1 -printf '%f\n' >&2
    exit 1
  fi
}

run_job() {
  env -u CARBONET_FLYWAY_JOB_TIMEOUT -u CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS \
    -u CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS \
    -u CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS \
    -u CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS \
    -u CARBONET_FLYWAY_CLEANUP_HOLD_TIMEOUT_SECONDS \
    "${common_env[@]}" "$@" bash "$JOB_SCRIPT" 'localhost:5000/carbonet-runtime:test'
}

reset_mock() {
  : >"$tmp/events"
  : >"$tmp/sql"
  rm -f "$tmp/job-counter" "$tmp/date-counter" "$tmp/session-counter" \
    "$tmp/delete-counter" "$tmp/resolver-counter" "$tmp/observer-seen"
}

: >"$tmp/events"
run_job CARBONET_FLYWAY_JOB_DRY_RUN=client >/dev/null
run_job CARBONET_FLYWAY_JOB_DRY_RUN=server \
  CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=600 \
  CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS=90 \
  CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS=480 \
  CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS=45 >/dev/null
assert_manifest_residue_zero 'client/server success'

python3 - "$tmp/captures/client.json" "$tmp/captures/server.json" <<'PY'
import json
import sys

def timeout_env(container):
    return {
        entry["name"]: entry.get("value")
        for entry in container["env"]
        if entry["name"].startswith("CARBONET_FLYWAY_")
    }

default = json.load(open(sys.argv[1], encoding="utf-8"))
override = json.load(open(sys.argv[2], encoding="utf-8"))
assert default["spec"]["activeDeadlineSeconds"] == 900
assert default["spec"]["template"]["spec"]["terminationGracePeriodSeconds"] == 30
default_env = timeout_env(default["spec"]["template"]["spec"]["containers"][0])
default_name = default_env.pop("CARBONET_FLYWAY_APPLICATION_NAME")
assert default_name.startswith("carbonet-flyway-20260817180000-")
assert default_env == {
    "CARBONET_FLYWAY_ENABLED": "true",
    "CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS": "10",
    "CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS": "780",
}
assert override["spec"]["activeDeadlineSeconds"] == 600
override_env = timeout_env(override["spec"]["template"]["spec"]["containers"][0])
override_name = override_env.pop("CARBONET_FLYWAY_APPLICATION_NAME")
assert override_name.startswith("carbonet-flyway-20260817180000-")
assert override_env == {
    "CARBONET_FLYWAY_ENABLED": "true",
    "CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS": "45",
    "CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS": "480",
}
PY

invalid_cases=(
  'CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=299'
  'CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=3601'
  'CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=999999999999999999999999'
  'CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=600 CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS=59'
  'CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=600 CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS=301'
  'CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=600 CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS=120 CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS=481'
  'CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS=4'
  'CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS=121'
  'CARBONET_FLYWAY_CLEANUP_HOLD_TIMEOUT_SECONDS=29'
  'CARBONET_FLYWAY_CLEANUP_HOLD_TIMEOUT_SECONDS=601'
  'CARBONET_FLYWAY_JOB_TIMEOUT=900s CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=900'
  'CARBONET_FLYWAY_JOB_TIMEOUT=15m'
)
invalid_early_exit_count=0
for invalid in "${invalid_cases[@]}"; do
  invalid_early_exit_count=$((invalid_early_exit_count + 1))
  # The fixture contains only variable assignments controlled by this test.
  read -r -a assignments <<<"$invalid"
  if run_job "${assignments[@]}" CARBONET_FLYWAY_JOB_DRY_RUN=client >/dev/null 2>&1; then
    printf 'invalid timeout contract passed: %s\n' "$invalid" >&2
    exit 1
  fi
  assert_manifest_residue_zero "invalid early exit $invalid_early_exit_count"
done
[[ "$invalid_early_exit_count" == 12 ]]

reset_mock
if run_job MOCK_DEPLOYMENT_FAILURE=true CARBONET_FLYWAY_JOB_DRY_RUN=client \
    >/dev/null 2>"$tmp/deployment-get.err"; then
  echo 'deployment read failure unexpectedly passed' >&2
  exit 1
fi
assert_manifest_residue_zero 'deployment read failure'
! grep -Fq ' apply ' "$tmp/events"
! grep -Fq ' delete job ' "$tmp/events"
[[ ! -e "$tmp/cleanup-hold.json" && ! -L "$tmp/cleanup-hold.json" ]]

# Execute the real backup cleanup function with a mocked kubectl boundary. psql
# only expands :'app_name' for stdin scripts, so the invocation must use exec -i
# and must not pass the SQL through -c.
: >"$tmp/events"; : >"$tmp/sql"
bounded_cleanup_function="$(sed -n '/^bounded_cleanup_kubectl() {$/,/^}$/p' "$AUTO_DEPLOY")"
backup_cleanup_function="$(sed -n '/^cleanup_remote_backup() {$/,/^}$/p' "$AUTO_DEPLOY")"
cleanup_deploy_function="$(sed -n '/^cleanup_deploy() {$/,/^}$/p' "$AUTO_DEPLOY")"
(
  eval "$bounded_cleanup_function"
  eval "$backup_cleanup_function"
  backup_cleanup_required=true
  backup_application_name=carbonet-auto-deploy-timeout-contract
  NAMESPACE=carbonet-prod
  POSTGRES_POD=postgres-patroni-0
  POSTGRES_CONTAINER=patroni
  POSTGRES_USER=postgres
  POSTGRES_DB=carbonet
  PATH="$tmp/bin:$PATH"
  MOCK_EVENTS="$tmp/events"
  MOCK_SQL="$tmp/sql"
  MOCK_DEPLOYMENT="$tmp/deployment.json"
  MOCK_CAPTURE_DIR="$tmp/captures"
  MOCK_JOB_COUNTER="$tmp/job-counter"
  MOCK_DATE_COUNTER="$tmp/date-counter"
  MOCK_SESSION_COUNTER="$tmp/session-counter"
  export PATH MOCK_EVENTS MOCK_SQL MOCK_DEPLOYMENT MOCK_CAPTURE_DIR
  export MOCK_JOB_COUNTER MOCK_DATE_COUNTER MOCK_SESSION_COUNTER
  cleanup_remote_backup
)
grep -Fq "application_name=:'app_name'" "$tmp/sql"
grep -Fq 'exec -i postgres-patroni-0' "$tmp/events"
! grep -Fq ' -c select pg_terminate_backend' "$tmp/events"

# A half-open API during backup-session cleanup must not delay the durable
# Flyway recovery handoff. Exercise the real cleanup trap with a kubectl mock
# that would sleep for 30 seconds: the outer 2-second cap wins and status 79 is
# preserved without entering either rollback helper. BACKUP_DIR and the main
# partial variable are intentionally absent, while the roles partial points at
# a sentinel: the extracted trap must remain nounset-safe and refuse deletion
# when backup initialization has not established its exact directory boundary.
: >"$tmp/events"; : >"$tmp/sql"; : >"$tmp/hold-cleanup-events"
printf '%s\n' ARMED >"$tmp/cleanup-hold.json"
guarded_partial="$tmp/guarded-roles.sql.gz.partial.$$"
printf '%s\n' GUARDED >"$guarded_partial"
mkdir -p "$tmp/hold-root"
hold_cleanup_started="$(/usr/bin/date +%s)"
set +e
(
  eval "$bounded_cleanup_function"
  eval "$backup_cleanup_function"
  eval "$cleanup_deploy_function"
  terminate_runtime_screen_gate_group() { :; }
  cleanup_local_schema_restore_container() { return 0; }
  recover_staged_postdeploy_attempt_after_failure() {
    printf '%s\n' ROLLBACK_CALLED >>"$tmp/hold-cleanup-events"
    return 0
  }
  reconcile_postdeploy_candidate_after_failure() {
    printf '%s\n' RECONCILE_CALLED >>"$tmp/hold-cleanup-events"
    return 0
  }
  backup_cleanup_required=true
  backup_application_name=carbonet-auto-deploy-timeout-contract
  NAMESPACE=carbonet-prod
  POSTGRES_POD=postgres-patroni-0
  POSTGRES_CONTAINER=patroni
  POSTGRES_USER=postgres
  POSTGRES_DB=carbonet
  CARBONET_DEPLOY_CLEANUP_KUBECTL_TIMEOUT_SECONDS=2
  CARBONET_DEPLOY_CLEANUP_KUBECTL_REQUEST_TIMEOUT_SECONDS=1
  flyway_cleanup_recovery_hold=true
  FLYWAY_CLEANUP_HOLD_FILE="$tmp/cleanup-hold.json"
  composite_autocompletion_gate_prepared=false
  runtime_asset_sync_pid=""
  catalog_identity_sync_pid=""
  backstage_visual_e2e_pid=""
  schema_restore_database=""
  schema_backup_dir=""
  unset BACKUP_DIR backup_partial_file
  roles_backup_partial_file="$guarded_partial"
  ROOT_DIR="$tmp/hold-root"
  persistent_build_worktree="$tmp/other-root"
  CARBONET_DEPLOY_SNAPSHOT_PATH=""
  POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$tmp/no-attempt.json"
  postdeploy_candidate_promoted=false
  postdeploy_candidate_initialized=false
  DEPLOY_PHASE_FILE="$tmp/hold-phases.jsonl"
  PATH="$tmp/bin:$PATH"
  MOCK_BACKUP_CLEANUP_HANG=true
  MOCK_EVENTS="$tmp/events"
  MOCK_SQL="$tmp/sql"
  export PATH MOCK_BACKUP_CLEANUP_HANG MOCK_EVENTS MOCK_SQL
  cleanup_deploy
) >/dev/null 2>"$tmp/hold-cleanup.err"
hold_cleanup_status=$?
set -e
hold_cleanup_elapsed=$(( $(/usr/bin/date +%s) - hold_cleanup_started ))
[[ "$hold_cleanup_status" == 79 && "$hold_cleanup_elapsed" -le 5 ]]
! grep -Fq 'unbound variable' "$tmp/hold-cleanup.err"
[[ -f "$guarded_partial" && "$(cat "$guarded_partial")" == GUARDED ]]
grep -Fq -- '--request-timeout=1s' "$tmp/events"
grep -Fq 'RECOVERY_HOLD preserved attempt/checkpoint state' "$tmp/hold-cleanup.err"
[[ ! -s "$tmp/hold-cleanup-events" ]]
[[ -f "$tmp/cleanup-hold.json" && "$(cat "$tmp/cleanup-hold.json")" == ARMED ]]
rm -f -- "$tmp/cleanup-hold.json"

# Invocation B must not even inspect/reconcile A's armed marker until it owns
# the same deploy flock. Holding fd8 models active invocation A; B exits at the
# exact nonblocking flock branch with cleanup calls=0 and marker bytes intact.
lock_reconcile_block="$(sed -n \
  '/^mkdir -p "$(dirname "$LOCK_FILE")"$/,/^recover_flyway_cleanup_hold_if_present || exit $?$/p' \
  "$AUTO_DEPLOY")"
[[ -n "$lock_reconcile_block" ]]
printf '%s\n' ARMED >"$tmp/active-marker"
active_marker_hash="$(sha256sum "$tmp/active-marker" | awk '{print $1}')"
: >"$tmp/lock-events"
exec 8>"$tmp/deploy.lock"
flock -n 8
set +e
(
  LOCK_FILE="$tmp/deploy.lock"
  CARBONET_RECOVERY_ONLY=false
  recover_flyway_cleanup_hold_if_present() {
    printf '%s\n' CLEANUP_CALLED >>"$tmp/lock-events"
    rm -f "$tmp/active-marker"
  }
  eval "$lock_reconcile_block"
) >/dev/null
contender_status=$?
set -e
flock -u 8
exec 8>&-
[[ "$contender_status" == 0 && ! -s "$tmp/lock-events" ]]
[[ -f "$tmp/active-marker" \
   && "$(sha256sum "$tmp/active-marker" | awk '{print $1}')" == "$active_marker_hash" ]]

# A successful terminal Job is logged before its owned resource is terminated.
# Foreground deletion and Pod zero must precede the first DB query, and every
# API call in the apply/observe/diagnostic/cleanup path carries a hard timeout.
reset_mock
run_job MOCK_JOB_STATE=COMPLETE >/dev/null
[[ ! -e "$tmp/cleanup-hold.json" && ! -L "$tmp/cleanup-hold.json" ]]
grep -Fq 'pg_is_in_recovery()' "$tmp/sql"
grep -Fq 'RESOLVE unset' "$tmp/events"
python3 - "$tmp/events" <<'PY'
import pathlib, sys
events = pathlib.Path(sys.argv[1]).read_text().splitlines()
apply = next(i for i, row in enumerate(events) if " apply " in f" {row} ")
observe = next(i for i, row in enumerate(events) if " get job/" in f" {row} ")
logs = next(i for i, row in enumerate(events) if " logs job/" in f" {row} ")
delete = next(i for i, row in enumerate(events) if " delete job " in f" {row} ")
pods = next(i for i, row in enumerate(events) if " get pods " in f" {row} ")
resolve = next(i for i, row in enumerate(events) if row.startswith("RESOLVE "))
drain = next(i for i, row in enumerate(events) if " exec " in f" {row} ")
assert apply < observe < logs < delete < pods < resolve < drain
for index in (apply, observe, logs, delete, pods, drain):
    assert "--request-timeout=" in events[index], events[index]
PY

# Observer timeout is a controlled abort. A stale caller-injected Pod is
# removed from the resolver environment; when the first freshly resolved Pod
# has become a replica, its same-session guard fails and cleanup retries against
# the next primary instead of accepting a false session-zero result.
reset_mock
if run_job MOCK_JOB_STATE=ACTIVE MOCK_DATE_MODE=timeout \
    MOCK_OLD_PRIMARY_IS_REPLICA=true \
    MOCK_PRIMARY_SEQUENCE=postgres-patroni-old,postgres-patroni-new \
    MOCK_SESSION_SEQUENCE=1,1,0 \
    CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS=300 \
    CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS=60 >/dev/null 2>"$tmp/observer.err"; then
  echo 'observer timeout unexpectedly passed' >&2
  exit 1
fi
grep -Fq 'controlled abort: quiescing the owned DB session' "$tmp/observer.err"
grep -Fq "pg_cancel_backend" "$tmp/sql"
grep -Fq "pg_terminate_backend" "$tmp/sql"
! grep -Fq "carbonet_flyway_schema_history" "$tmp/sql"
[[ ! -e "$tmp/cleanup-hold.json" && ! -L "$tmp/cleanup-hold.json" ]]
python3 - "$tmp/events" <<'PY'
import pathlib, sys
events = pathlib.Path(sys.argv[1]).read_text().splitlines()
deadline = next(i for i, row in enumerate(events) if row == "DATE 1400")
deletes = [i for i, row in enumerate(events) if " delete job " in f" {row} "]
pods = [i for i, row in enumerate(events) if " get pods " in f" {row} "]
old = next(i for i, row in enumerate(events) if " postgres-patroni-old " in f" {row} ")
new = next(i for i, row in enumerate(events) if " postgres-patroni-new " in f" {row} ")
queries = [i for i, row in enumerate(events) if " exec " in f" {row} "]
assert len(deletes) >= 2 and len(pods) >= 2
assert deadline < deletes[0] < pods[0] < old < deletes[1] < pods[1] < new
assert all(events[i] == "RESOLVE unset" for i, row in enumerate(events) if row.startswith("RESOLVE "))
assert max(queries) > new
PY

# A Failed condition is terminal immediately; SQL failure does not wait for the
# observer deadline before the owned Job is cleaned.
reset_mock
if run_job MOCK_JOB_STATE=ACTIVE_THEN_FAILED >/dev/null 2>"$tmp/failed.err"; then
  echo 'failed Job unexpectedly passed' >&2
  exit 1
fi
python3 - "$tmp/events" <<'PY'
import pathlib, sys
events = pathlib.Path(sys.argv[1]).read_text().splitlines()
observations = [i for i, row in enumerate(events) if " get job/" in f" {row} "]
delete = next(i for i, row in enumerate(events) if " delete job " in f" {row} ")
assert len(observations) == 2 and max(observations) < delete
assert not any(row.startswith("DATE 1400") for row in events)
PY

# An ambiguous apply failure is cleanup-owned because ownership is armed before
# the API request. A server-created Job can therefore never escape the trap.
reset_mock
if run_job MOCK_APPLY_FAILURE=true >/dev/null 2>"$tmp/apply.err"; then
  echo 'ambiguous apply failure unexpectedly passed' >&2
  exit 1
fi
python3 - "$tmp/events" <<'PY'
import pathlib, sys
events = pathlib.Path(sys.argv[1]).read_text().splitlines()
apply = next(i for i, row in enumerate(events) if " apply " in f" {row} ")
delete = next(i for i, row in enumerate(events) if " delete job " in f" {row} ")
pods = next(i for i, row in enumerate(events) if " get pods " in f" {row} ")
query = next(i for i, row in enumerate(events) if " exec " in f" {row} ")
assert apply < delete < pods < query
PY

# Persistent API cleanup failure exhausts a 120s bounded hold, returns the
# explicit no-rollback status 79, and writes strict durable evidence. A second
# migration is refused before apply while that evidence exists.
reset_mock
set +e
run_job MOCK_JOB_STATE=COMPLETE MOCK_DELETE_FAILURE=true MOCK_DATE_MODE=cleanup_hold \
  >"$tmp/hold.out" 2>"$tmp/hold.err"
hold_status=$?
set -e
[[ "$hold_status" == 79 ]]
python3 - "$tmp/cleanup-hold.json" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8"))
assert value["schemaVersion"] == 1 and value["status"] == "CLEANUP_UNPROVEN"
assert value["reason"] == "CLEANUP_BUDGET_EXHAUSTED"
assert value["cleanupHoldSeconds"] == 120 and value["terminationGraceSeconds"] == 30
assert value["applicationName"] == value["jobName"]
assert value["sourceCommit"] == "a" * 40
PY
[[ "$(cat "$tmp/delete-counter")" == 2 ]]
reset_mock
set +e
run_job MOCK_JOB_STATE=COMPLETE >"$tmp/blocked.out" 2>"$tmp/blocked.err"
blocked_status=$?
set -e
[[ "$blocked_status" == 79 ]]
grep -Fq 'RECOVERY_HOLD blocks a new migration' "$tmp/blocked.err"
! grep -Fq ' apply ' "$tmp/events"

# Strict recovery rejects a mutated source identity without touching the Job.
# The valid immutable marker then self-heals via the same delete/Pod0/session0
# sequence and is removed only after its hash remains unchanged.
cp "$tmp/cleanup-hold.json" "$tmp/cleanup-hold.valid.json"
python3 - "$tmp/cleanup-hold.json" <<'PY'
import json, sys
path = sys.argv[1]
value = json.load(open(path, encoding="utf-8"))
value["sourceCommit"] = "invalid"
with open(path, "w", encoding="utf-8") as stream:
    json.dump(value, stream, separators=(",", ":"), sort_keys=True)
    stream.write("\n")
PY
chmod 0600 "$tmp/cleanup-hold.json"
reset_mock
set +e
env "${common_env[@]}" bash "$JOB_SCRIPT" --recover-cleanup-hold \
  "$tmp/cleanup-hold.json" >/dev/null 2>"$tmp/invalid-hold.err"
invalid_hold_status=$?
set -e
[[ "$invalid_hold_status" == 79 && -f "$tmp/cleanup-hold.json" ]]
! grep -Fq ' delete job ' "$tmp/events"
cp -f "$tmp/cleanup-hold.valid.json" "$tmp/cleanup-hold.json"
python3 - "$tmp/cleanup-hold.json" <<'PY'
import json, sys
path = sys.argv[1]
value = json.load(open(path, encoding="utf-8"))
value["namespace"] = "wrong-namespace"
with open(path, "w", encoding="utf-8") as stream:
    json.dump(value, stream, separators=(",", ":"), sort_keys=True)
    stream.write("\n")
PY
chmod 0600 "$tmp/cleanup-hold.json"
reset_mock
set +e
env "${common_env[@]}" bash "$JOB_SCRIPT" --recover-cleanup-hold \
  "$tmp/cleanup-hold.json" >/dev/null 2>"$tmp/invalid-namespace.err"
invalid_namespace_status=$?
set -e
[[ "$invalid_namespace_status" == 79 && -f "$tmp/cleanup-hold.json" ]]
! grep -Fq ' delete job ' "$tmp/events"
rm -f "$tmp/cleanup-hold.json"
ln -s "$tmp/cleanup-hold.valid.json" "$tmp/cleanup-hold.json"
reset_mock
set +e
env "${common_env[@]}" bash "$JOB_SCRIPT" --recover-cleanup-hold \
  "$tmp/cleanup-hold.json" >/dev/null 2>"$tmp/invalid-path.err"
invalid_path_status=$?
set -e
[[ "$invalid_path_status" == 79 && -L "$tmp/cleanup-hold.json" ]]
! grep -Fq ' delete job ' "$tmp/events"
rm -f "$tmp/cleanup-hold.json"
mv -f "$tmp/cleanup-hold.valid.json" "$tmp/cleanup-hold.json"
chmod 0600 "$tmp/cleanup-hold.json"
reset_mock
env "${common_env[@]}" MOCK_SESSION_SEQUENCE=1,1,0 \
  bash "$JOB_SCRIPT" --recover-cleanup-hold "$tmp/cleanup-hold.json" \
  >"$tmp/recovered.out"
grep -Fq 'RECOVERY_HOLD_CLEARED' "$tmp/recovered.out"
[[ ! -e "$tmp/cleanup-hold.json" && ! -L "$tmp/cleanup-hold.json" ]]
grep -Fq 'pg_cancel_backend' "$tmp/sql"
grep -Fq 'pg_terminate_backend' "$tmp/sql"
python3 - "$tmp/events" <<'PY'
import pathlib, sys
events = pathlib.Path(sys.argv[1]).read_text().splitlines()
delete = next(i for i, row in enumerate(events) if " delete job " in f" {row} ")
pods = next(i for i, row in enumerate(events) if " get pods " in f" {row} ")
queries = [i for i, row in enumerate(events) if " exec " in f" {row} "]
assert delete < pods < min(queries) < max(queries)
PY
reset_mock
run_job MOCK_JOB_STATE=COMPLETE >/dev/null
[[ ! -e "$tmp/cleanup-hold.json" && ! -L "$tmp/cleanup-hold.json" ]]

assert_manifest_residue_zero 'full timeout contract'
printf '%s\n' 'FLYWAY_JOB_TIMEOUT_CONTRACT_PASS defaultJob=900s defaultStatement=780s settle=120s lock=10s observer=930s cleanupHold=120s bounds=12 terminalCleanup=6 prematureDelete=0 controlledAbort=1 dbSessionExact=1 failoverGuard=1 cancelTerminate=2 historyGlobal=0 podResidue=0 applyAmbiguity=owned holdExit=79 holdValidation=source+namespace+path holdRecovery=cleared lockRace=cleanup0+markerIntact parentHandoff=79 backupCleanupPsql=stdin backupCleanupHang=bounded2s+status79 manifestResidue=success0+invalid12x0+deploymentReadFailure0'
