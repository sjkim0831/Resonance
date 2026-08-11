#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HELPER="$ROOT/ops/scripts/runtime-qa-auth-common.sh"
POST_DEPLOY_VALIDATOR="$ROOT/ops/scripts/run-post-deploy-validation-groups.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
SCREEN_GATE_WRAPPER="$ROOT/ops/scripts/run-runtime-screen-gate-serialized.sh"
SCREEN_GATE="$ROOT/ops/scripts/resonance-full-screen-deploy-gate.sh"
FULL_SCREEN_SMOKE="$ROOT/projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh"
TMP_DIR="$(mktemp -d /tmp/runtime-qa-auth-concurrency.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

[[ -f "$HELPER" ]] || { echo '[runtime-qa-auth-concurrency] helper missing' >&2; exit 1; }
[[ -f "$POST_DEPLOY_VALIDATOR" ]] || { echo '[runtime-qa-auth-concurrency] post-deploy validator missing' >&2; exit 1; }
[[ -f "$AUTO_DEPLOY" ]] || { echo '[runtime-qa-auth-concurrency] auto-deploy runner missing' >&2; exit 1; }
[[ -f "$SCREEN_GATE_WRAPPER" ]] || { echo '[runtime-qa-auth-concurrency] screen gate wrapper missing' >&2; exit 1; }
[[ -f "$SCREEN_GATE" ]] || { echo '[runtime-qa-auth-concurrency] full screen gate missing' >&2; exit 1; }
[[ -f "$FULL_SCREEN_SMOKE" ]] || { echo '[runtime-qa-auth-concurrency] full screen smoke runner missing' >&2; exit 1; }
bash -n "$HELPER"
bash -n "$POST_DEPLOY_VALIDATOR"
bash -n "$AUTO_DEPLOY"
bash -n "$SCREEN_GATE_WRAPPER"
bash -n "$SCREEN_GATE"
bash -n "$FULL_SCREEN_SMOKE"

smoke_path_init="$TMP_DIR/full-screen-smoke-path-init.sh"
sed -n '1,/^auth_state_path=""$/p' "$FULL_SCREEN_SMOKE" >"$smoke_path_init"
bash -n "$smoke_path_init"
assert_smoke_output_path_contract() {
  local init_script="$1"
  local frontend_root="$ROOT/projects/carbonet-frontend/source"
  local wrapper_cache="$frontend_root/.cache/full-screen-smoke/runtime-screen-gate/fb84867b79-123"
  FRONTEND_ROOT_DIR="$frontend_root" \
    FULL_SCREEN_SMOKE_CACHE_DIR="$wrapper_cache" \
    FULL_SCREEN_SMOKE_RESULT_DIR="$wrapper_cache/results" \
    bash "$init_script" >/dev/null
  if FRONTEND_ROOT_DIR="$frontend_root" \
      FULL_SCREEN_SMOKE_CACHE_DIR="$wrapper_cache" \
      FULL_SCREEN_SMOKE_RESULT_DIR="$TMP_DIR/unsafe-results" \
      bash "$init_script" >/dev/null 2>&1; then
    return 1
  fi
}
assert_smoke_output_path_contract "$smoke_path_init"
assert_smoke_symlink_root_rejected() {
  local init_script="$1" component="$2"
  local fixture="$TMP_DIR/smoke-symlink-$component" frontend_root="$TMP_DIR/smoke-symlink-$component/frontend"
  local outside="$TMP_DIR/smoke-symlink-$component/outside" wrapper_cache sentinel
  rm -rf -- "$fixture"
  mkdir -p "$frontend_root" "$outside"
  if [[ "$component" == cache ]]; then
    ln -s "$outside" "$frontend_root/.cache"
    wrapper_cache="$frontend_root/.cache/full-screen-smoke/runtime-screen-gate/owned-run"
    sentinel="$outside/full-screen-smoke/runtime-screen-gate/owned-run/keep"
  else
    mkdir -p "$frontend_root/.cache"
    ln -s "$outside" "$frontend_root/.cache/full-screen-smoke"
    wrapper_cache="$frontend_root/.cache/full-screen-smoke/runtime-screen-gate/owned-run"
    sentinel="$outside/runtime-screen-gate/owned-run/keep"
  fi
  mkdir -p "$(dirname "$sentinel")"
  touch "$sentinel"
  if FRONTEND_ROOT_DIR="$frontend_root" \
      FULL_SCREEN_SMOKE_CACHE_DIR="$wrapper_cache" \
      FULL_SCREEN_SMOKE_RESULT_DIR="$wrapper_cache/results" \
      bash "$init_script" >/dev/null 2>&1; then
    return 1
  fi
  [[ -e "$sentinel" ]]
}
assert_smoke_symlink_root_rejected "$smoke_path_init" cache
assert_smoke_symlink_root_rejected "$smoke_path_init" full-screen-smoke
mutated_smoke_path_init="$TMP_DIR/full-screen-smoke-path-init-no-result-guard.sh"
sed '/^case "$result_dir" in$/,/^esac$/d' "$smoke_path_init" >"$mutated_smoke_path_init"
if assert_smoke_output_path_contract "$mutated_smoke_path_init"; then
  echo '[runtime-qa-auth-concurrency] smoke result allow-check removal mutation survived' >&2
  exit 1
fi
mutated_smoke_root_init="$TMP_DIR/full-screen-smoke-path-init-symlink-trust.sh"
sed \
  -e '/^assert_physical_smoke_cache_root || exit 2$/d' \
  -e 's|^canonical_cache_root="$expected_cache_root"$|canonical_cache_root="$(realpath -m -- "$expected_cache_root")"|' \
  "$smoke_path_init" >"$mutated_smoke_root_init"
if assert_smoke_symlink_root_rejected "$mutated_smoke_root_init" cache; then
  echo '[runtime-qa-auth-concurrency] symlinked cache-root trust mutation survived' >&2
  exit 1
fi
echo '[runtime-screen-cache-contract] PASS wrapperPath=canonical unsafeResult=blocked cacheSymlink=blocked fullScreenSymlink=blocked outsideSentinel=preserved mutations=2'

python3 - "$HELPER" "$POST_DEPLOY_VALIDATOR" "$AUTO_DEPLOY" "$SCREEN_GATE_WRAPPER" "$SCREEN_GATE" "$FULL_SCREEN_SMOKE" "$ROOT" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
validator = Path(sys.argv[2]).read_text(encoding="utf-8")
auto_deploy = Path(sys.argv[3]).read_text(encoding="utf-8")
screen_wrapper = Path(sys.argv[4]).read_text(encoding="utf-8")
screen_gate = Path(sys.argv[5]).read_text(encoding="utf-8")
full_screen_smoke = Path(sys.argv[6]).read_text(encoding="utf-8")
root = Path(sys.argv[7]).resolve()

def assert_owner_contract(value):
    assert "CARBONET_QA_AUTH_LOCK_OWNER_BASHPID" in value
    assert 'local current_pid="${BASHPID:-$$}"' in value
    assert '"$lock_owner" != "$current_pid"' in value
    assert "Keep both inherited variables intact" in value
    assert "unset CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID" in value

assert_owner_contract(source)
assert "carbonet_qa_load_credentials()" in source
assert 'explicit credential pair is incomplete' in source
assert 'jsonpath=\'{.data.username}\'' in source
assert 'jsonpath=\'{.data.password}\'' in source
assert 'printf -v "$output_password_var"' in source
assert 'credential pair is unavailable or malformed' in source
assert "carbonet_qa_auth_run_serialized() (" in source
assert 'trap carbonet_qa_auth_release_lock EXIT' in source
assert '"$@" || lifecycle_status=$?' in source
assert 'return "$lifecycle_status"' in source
mutated = source.replace(
    'if [[ -n "$lock_fd" && "$lock_owner" != "$current_pid" ]]; then',
    'if [[ -n "$lock_fd" && "$lock_owner" == "$current_pid" ]]; then',
    1,
)
try:
    assert_owner_contract(mutated)
except AssertionError:
    pass
else:
    raise AssertionError("borrowed-release owner-check mutation survived")
credential_mutation = source.replace('if [[ -z "$explicit_user" || -z "$explicit_password" ]]; then', 'if false; then', 1)
try:
    assert 'if [[ -z "$explicit_user" || -z "$explicit_password" ]]; then' in credential_mutation
except AssertionError:
    pass
else:
    raise AssertionError("incomplete explicit credential mutation survived")

def assert_validator_contract(value):
    assert 'source "$root/ops/scripts/runtime-qa-auth-common.sh"' in value
    assert 'CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300' in value
    assert 'exec 9>"${CARBONET_QA_AUTH_LOCK_FILE' not in value
    assert 'flock -w "${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS' not in value
    shared_marker = "carbonet_qa_auth_run_serialized emission-shared-runtime"
    assert value.count(shared_marker) == 1
    shared_function_start = value.index("run_emission_shared_runtime() {")
    shared_function_end = value.index("\n  }", shared_function_start)
    shared_function = value[shared_function_start:shared_function_end]
    shared = [
        ("customer", "validate-customer-work-journey.sh"),
        ("activity", "validate-activity-data-runtime.sh"),
        ("calculation", "validate-emission-calculation-runtime.sh"),
        ("organizational-boundary", "validate-organizational-boundary-runtime.sh"),
        ("governance-change", "validate-governance-change-runtime.sh"),
        ("report", "validate-report-certification-runtime.sh"),
    ]
    positions = []
    for name, script in shared:
        command = f"run_emission_runtime_step {name} bash ops/scripts/{script}"
        assert command in shared_function
        positions.append(shared_function.index(command))
    assert positions == sorted(positions)
    assert shared_function.count("run_emission_runtime_step ") == 6
    assert shared_function.count("aggregate_status=1") == 6
    assert shared_function.count("[emission-shared-runtime] RECORDED name=") == 6
    assert 'return "$aggregate_status"' in shared_function
    assert "|| return $?" not in shared_function
    actor_start = 'if [[ "${VALIDATE_ACTOR_ACCOUNT:-true}" == "true" ]]'
    actor_script = "bash ops/scripts/validate-actor-account-customer-journey.sh"
    assert actor_start in value and actor_script in value
    actor_block = value[value.index(actor_start):value.index("else", value.index(actor_start))]
    assert "carbonet_qa_auth_run_serialized" not in actor_block
    assert value.index("start_emission_prep activity activity_prep") < value.index(shared_marker)
    assert value.index("start_emission_prep calculation calculation_prep") < value.index(shared_marker)
    assert value.index("start_emission_prep report report_prep") < value.index(shared_marker)
    assert value.index("wait_emission_preps") < value.index(shared_marker)
    assert value.index(shared_marker) < value.index('wait "$actor_pid"')
    assert 'wait "$lane_pid" || lane_status=$?' in value
    assert 'FAIL name=$lane_name status=$lane_status' in value
    assert 'cat "$lane_dir/$lane_name.log" >&2' in value
    assert 'FAIL status=$shared_status' in value
    assert 'FAIL name=actor-account-journey status=$actor_status' in value

def assert_auto_deploy_cohort(value, wrapper=screen_wrapper, gate=screen_gate):
    assert "run_serialized_carbonet_auth_lifecycle() {" in value
    alias_start = value.index("run_serialized_carbonet_auth_lifecycle() {")
    alias_end = value.index("run_actor_process_role_e2e_if_required() {", alias_start)
    alias = value[alias_start:alias_end]
    assert 'run_serialized_carbonet_actor_process_e2e_job "$@"' in alias
    assert value.count("run_serialized_carbonet_auth_lifecycle runtime-screen-gate") == 1
    assert 'carbonet_qa_auth_run_serialized runtime-screen-gate' in wrapper
    assert 'CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300' in wrapper
    assert 'bash ops/scripts/resonance-full-screen-deploy-gate.sh verify' in wrapper
    assert 'FULL_SCREEN_SMOKE_CACHE_DIR:-$FRONTEND_DIR/.cache/full-screen-smoke' in gate
    assert '"$smoke_cache_dir/manifest.json"' in gate
    frontend_start = value.index('frontend_smoke_pattern="$(node')
    frontend_end = value.index('echo "[auto-deploy] frontend overlay deployed', frontend_start)
    frontend = value[frontend_start:frontend_end]
    assert "run_serialized_carbonet_auth_lifecycle runtime-screen-gate" in frontend
    assert "bash ops/scripts/resonance-full-screen-deploy-gate.sh verify" in frontend
    background_start = value.index("runtime_screen_gate_log=", frontend_end)
    background_end = value.index("enable_postdeploy_candidate_mode", background_start)
    background = value[background_start:background_end]
    assert "setsid env RESONANCE_ROOT=" in background
    assert "bash ops/scripts/run-runtime-screen-gate-serialized.sh" in background
    assert 'FULL_SCREEN_SMOKE_CACHE_DIR="$runtime_screen_gate_cache_dir"' in background
    assert 'FULL_SCREEN_GATE_AUTO_ROLLBACK=false' in background
    assert 'OVERLAY_DIR="$live_frontend_overlay"' in background
    assert '>"$runtime_screen_gate_log" 2>&1 &' in background
    assert 'runtime_screen_gate_pgid="$runtime_screen_gate_pid"' in background
    cleanup_start = value.index("terminate_runtime_screen_gate_group() {")
    cleanup_end = value.index("cleanup_deploy() {", cleanup_start)
    cleanup = value[cleanup_start:cleanup_end]
    assert 'kill -TERM -- "-$pgid"' in cleanup
    assert 'kill -KILL -- "-$pgid"' in cleanup
    assert 'for attempt in $(seq 1 50)' in cleanup
    assert 'cleanup_runtime_screen_gate_cache' in cleanup
    assert 'canonical_runtime_screen_gate_cache_root() {' in value
    assert '[[ "$resolved_cache_root" == "$expected_cache_root" ]] || return 1' in value
    assert 'rm -rf -- "$canonical_candidate"' in value
    assert 'pkill' not in cleanup and 'killall' not in cleanup
    assert 'if wait "$runtime_screen_gate_pid"; then browser_status=0; else browser_status=$?; fi' in value
    assert 'concurrent browser gate failed status=$browser_status' in value
    lane_start = value.index("run_runtime_release_validation_lanes() {")
    lane_end = value.index("\n}\ncleanup_deploy()", lane_start)
    lane = value[lane_start:lane_end]
    assert lane.index('wait "$runtime_screen_gate_pid"') < lane.index('bash ops/scripts/resonance-full-screen-deploy-gate.sh restore')
    assert lane.count('bash ops/scripts/resonance-full-screen-deploy-gate.sh restore') == 1
    assert 'if (( validation_status == 0 )); then' in lane
    assert 'screen contract runtime save skipped: validation groups failed' in lane
    assert 'return "$rollback_status"' in lane and 'return "$release_failure_status"' in lane
    assert 'live_frontend_overlay="${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"' in value
    assert 'OVERLAY_DIR="${OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"' in gate
    assert 'verify-react-asset-closure.mjs" "$OVERLAY_DIR"' in gate
    gate_call = 'bash ops/scripts/resonance-full-screen-deploy-gate.sh'
    gate_positions = []
    offset = 0
    while True:
        position = value.find(gate_call, offset)
        if position < 0:
            break
        gate_positions.append(position)
        offset = position + 1
    assert len(gate_positions) == 7
    assert all('OVERLAY_DIR=' in value[max(0, position - 180):position] for position in gate_positions)
    screen_save_start = value.index("run_screen_contract_runtime_save_gate_if_required() {")
    screen_save_end = value.index("# Database availability", screen_save_start)
    screen_save = value[screen_save_start:screen_save_end]
    assert "run_serialized_carbonet_auth_lifecycle screen-contract-runtime-save" in screen_save
    assert "bash ops/scripts/validate-screen-contract-runtime-save.sh" in screen_save

assert_validator_contract(validator)
assert_auto_deploy_cohort(auto_deploy)

def assert_screen_cache_contract(deploy, runner):
    canonical_relative = "projects/carbonet-frontend/source/.cache/full-screen-smoke"
    assert 'runtime_screen_gate_cache_dir="$runtime_screen_gate_cache_root/${target_commit:0:10}-$$"' in deploy
    assert 'physical_root_dir="$(realpath -e -- "$root_dir")"' in runner
    assert 'expected_cache_root="$physical_root_dir/.cache/full-screen-smoke"' in runner
    assert 'assert_physical_smoke_cache_root || exit 2' in runner
    assert '[[ "$resolved_cache_root" != "$expected_cache_root" ]]' in runner
    assert 'canonical_cache_root="$expected_cache_root"' in runner
    assert 'cache_dir="$(realpath -m -- "${FULL_SCREEN_SMOKE_CACHE_DIR:-$canonical_cache_root}")"' in runner
    assert 'result_dir="$(realpath -m -- "${FULL_SCREEN_SMOKE_RESULT_DIR:-$cache_dir/results}")"' in runner
    assert '"$canonical_cache_root"|"$canonical_cache_root"/*) ;;' in runner
    assert '"$cache_dir"/*) ;;' in runner
    assert 'unsafe smoke cache directory' in runner and 'unsafe smoke result directory' in runner
    canonical_root = (root / canonical_relative).resolve()
    wrapper_result = (canonical_root / "runtime-screen-gate" / "fb84867b79-123" / "results").resolve()
    assert wrapper_result.is_relative_to(canonical_root)

assert_screen_cache_contract(auto_deploy, full_screen_smoke)
mutated_smoke = full_screen_smoke.replace('"$cache_dir"/*) ;;', '*) ;;', 1)
assert mutated_smoke != full_screen_smoke
try:
    assert_screen_cache_contract(auto_deploy, mutated_smoke)
except AssertionError:
    pass
else:
    raise AssertionError("smoke result allow-check removal mutation survived")
mutated = validator.replace(
    "carbonet_qa_auth_run_serialized emission-shared-runtime",
    "run_without_auth_serialization emission-shared-runtime",
    1,
)
try:
    assert_validator_contract(mutated)
except AssertionError:
    pass
else:
    raise AssertionError("shared-lifecycle serialization-removal mutation survived")
mutated = validator.replace(
    "bash ops/scripts/validate-actor-account-customer-journey.sh",
    "carbonet_qa_auth_run_serialized actor-account-runtime bash ops/scripts/validate-actor-account-customer-journey.sh",
    1,
)
try:
    assert_validator_contract(mutated)
except AssertionError:
    pass
else:
    raise AssertionError("independent actor lane serialization mutation survived")
mutated = validator.replace("run_emission_runtime_step activity bash", "run_emission_runtime_step __ORDER_TMP__ bash", 1)
mutated = mutated.replace("run_emission_runtime_step calculation bash", "run_emission_runtime_step activity bash", 1)
mutated = mutated.replace("run_emission_runtime_step __ORDER_TMP__ bash", "run_emission_runtime_step calculation bash", 1)
try:
    assert_validator_contract(mutated)
except AssertionError:
    pass
else:
    raise AssertionError("shared-runtime order mutation survived")
mutated = validator.replace('CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300', 'CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-120', 1)
try:
    assert_validator_contract(mutated)
except AssertionError:
    pass
else:
    raise AssertionError("post-deploy auth timeout regression mutation survived")
for old, new, label in (
    ("run_serialized_carbonet_auth_lifecycle runtime-screen-gate", "run_unlocked_carbonet_auth_lifecycle runtime-screen-gate", "foreground-screen-gate"),
    ("run_serialized_carbonet_auth_lifecycle screen-contract-runtime-save", "run_unlocked_carbonet_auth_lifecycle screen-contract-runtime-save", "screen-save-gate"),
    ('run_serialized_carbonet_actor_process_e2e_job "$@"', '"$@"', "cohort-alias"),
):
    mutated = auto_deploy.replace(old, new, 1)
    try:
        assert_auto_deploy_cohort(mutated)
    except AssertionError:
        pass
    else:
        raise AssertionError(f"{label} serialization mutation survived")
mutated = screen_wrapper.replace("carbonet_qa_auth_run_serialized runtime-screen-gate", "run_unlocked_carbonet_auth_lifecycle runtime-screen-gate", 1)
try:
    assert_auto_deploy_cohort(auto_deploy, mutated)
except AssertionError:
    pass
else:
    raise AssertionError("background-screen-gate serialization mutation survived")
mutated_gate = screen_gate.replace('"$smoke_cache_dir/manifest.json"', '"$FRONTEND_DIR/.cache/full-screen-smoke/manifest.json"')
try:
    assert_auto_deploy_cohort(auto_deploy, screen_wrapper, mutated_gate)
except AssertionError:
    pass
else:
    raise AssertionError("owned screen cache mutation survived")
for old, new, label in (
    ("setsid env RESONANCE_ROOT=", "env RESONANCE_ROOT=", "screen-process-group"),
    ('kill -TERM -- "-$pgid"', 'kill -TERM "$pid"', "group-term"),
    ('kill -KILL -- "-$pgid"', 'kill -KILL "$pid"', "group-kill"),
    ('[[ "$resolved_cache_root" == "$expected_cache_root" ]] || return 1', 'true', "cache-root-identity"),
    ('FULL_SCREEN_GATE_AUTO_ROLLBACK=false', 'FULL_SCREEN_GATE_AUTO_ROLLBACK=true', "child-auto-rollback"),
    ('OVERLAY_DIR="$live_frontend_overlay" FULL_SCREEN_GATE_BASE_COMMIT=', 'FULL_SCREEN_GATE_BASE_COMMIT=', "capture-live-overlay"),
):
    mutated = auto_deploy.replace(old, new, 1)
    try:
        assert_auto_deploy_cohort(mutated)
    except AssertionError:
        pass
    else:
        raise AssertionError(f"{label} mutation survived")
print("RUNTIME_QA_AUTH_OWNER_STATIC_PASS mutations=21 credentialLoader=secret-or-complete-env sharedLifecycles=6 lockAcquisitions=1 timeout=300s order=customer-activity-calculation-boundary-governance-report continueAfterFailure=true screenGatePaths=2 processGroup=owned-term-wait-kill ownedCache=physical-root screenSave=skip-on-validation-failure rollback=main-process-exactly-once overlay=mounted-all-paths")
PY

# Execute the validator's actual nested runtime functions with a mocked bash
# command. A first-step failure must be retained while all later validators,
# including the final report, still run under the same lifecycle.
python3 - "$POST_DEPLOY_VALIDATOR" "$TMP_DIR/emission-functions.sh" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
chunks = []
for name in ("run_emission_runtime_step", "run_emission_shared_runtime"):
    start = text.index(f"  {name}() {{")
    end = text.index("\n  }", start) + len("\n  }")
    chunks.append(text[start:end].replace("\n  ", "\n", 1).lstrip())
Path(sys.argv[2]).write_text("\n".join(chunks) + "\n", encoding="utf-8")
PY
source "$TMP_DIR/emission-functions.sh"
bash() {
  printf '%s\n' "$1" >>"$TMP_DIR/emission-executed.log"
  [[ "$1" != ops/scripts/validate-customer-work-journey.sh ]] || return 23
  return 0
}
set +e
run_emission_shared_runtime >"$TMP_DIR/emission-aggregate.log" 2>&1
emission_aggregate_status=$?
set -e
[[ "$emission_aggregate_status" == 1 ]]
[[ "$(wc -l <"$TMP_DIR/emission-executed.log" | tr -d ' ')" == 6 ]]
grep -Fxq ops/scripts/validate-report-certification-runtime.sh "$TMP_DIR/emission-executed.log"
grep -Fq 'RECORDED name=customer status=23' "$TMP_DIR/emission-aggregate.log"
unset -f bash

python3 - "$AUTO_DEPLOY" "$TMP_DIR/screen-group-functions.sh" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
chunks = []
for name in ("canonical_runtime_screen_gate_cache_root", "cleanup_runtime_screen_gate_cache", "terminate_runtime_screen_gate_group"):
    start = text.index(f"{name}() {{")
    end = text.index("\n}\n", start) + 2
    chunks.append(text[start:end])
Path(sys.argv[2]).write_text("\n".join(chunks) + "\n", encoding="utf-8")
PY
source "$TMP_DIR/screen-group-functions.sh"
ROOT_DIR="$TMP_DIR/process-group-root"
runtime_screen_gate_cache_dir="$ROOT_DIR/projects/carbonet-frontend/source/.cache/full-screen-smoke/runtime-screen-gate/owned-run"
mkdir -p "$runtime_screen_gate_cache_dir" "$ROOT_DIR/var/run/unrelated"
touch "$runtime_screen_gate_cache_dir/auth-state-owned.json" "$ROOT_DIR/var/run/unrelated/keep"
group_child_file="$TMP_DIR/screen-group-child.pid"
setsid bash -c 'trap "exit 0" TERM; sleep 30 & child=$!; printf "%s\n" "$child" >"$1"; wait "$child"' _ "$group_child_file" &
runtime_screen_gate_pid=$!
runtime_screen_gate_pgid=$runtime_screen_gate_pid
for _ in $(seq 1 50); do [[ -s "$group_child_file" ]] && break; sleep 0.02; done
[[ -s "$group_child_file" ]]
screen_group_child="$(<"$group_child_file")"
sleep 30 & unrelated_node_like_pid=$!
terminate_runtime_screen_gate_group
! kill -0 "$screen_group_child" 2>/dev/null
kill -0 "$unrelated_node_like_pid" 2>/dev/null
[[ ! -e "$ROOT_DIR/projects/carbonet-frontend/source/.cache/full-screen-smoke/runtime-screen-gate/owned-run" ]]
[[ -e "$ROOT_DIR/var/run/unrelated/keep" ]]
kill "$unrelated_node_like_pid"
wait "$unrelated_node_like_pid" 2>/dev/null || true

assert_auto_cleanup_symlink_rejected() {
  local helper_script="$1" component="$2"
  local fixture="$TMP_DIR/auto-cleanup-symlink-$component" root="$TMP_DIR/auto-cleanup-symlink-$component/root"
  local outside="$TMP_DIR/auto-cleanup-symlink-$component/outside" candidate sentinel
  rm -rf -- "$fixture"
  mkdir -p "$root/projects/carbonet-frontend/source" "$outside"
  if [[ "$component" == cache ]]; then
    ln -s "$outside" "$root/projects/carbonet-frontend/source/.cache"
    candidate="$root/projects/carbonet-frontend/source/.cache/full-screen-smoke/runtime-screen-gate/owned-run"
    sentinel="$outside/full-screen-smoke/runtime-screen-gate/owned-run/keep"
  else
    mkdir -p "$root/projects/carbonet-frontend/source/.cache"
    ln -s "$outside" "$root/projects/carbonet-frontend/source/.cache/full-screen-smoke"
    candidate="$root/projects/carbonet-frontend/source/.cache/full-screen-smoke/runtime-screen-gate/owned-run"
    sentinel="$outside/runtime-screen-gate/owned-run/keep"
  fi
  mkdir -p "$(dirname "$sentinel")"
  touch "$sentinel"
  (
    source "$helper_script"
    ROOT_DIR="$root"
    runtime_screen_gate_cache_dir="$candidate"
    if cleanup_runtime_screen_gate_cache >/dev/null 2>&1; then
      return 1
    fi
    [[ -e "$sentinel" ]]
  )
}
assert_auto_cleanup_symlink_rejected "$TMP_DIR/screen-group-functions.sh" cache
assert_auto_cleanup_symlink_rejected "$TMP_DIR/screen-group-functions.sh" full-screen-smoke
python3 - "$TMP_DIR/screen-group-functions.sh" "$TMP_DIR/screen-group-functions-trust-symlink.sh" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
guard = '''  if [[ -L "$physical_frontend_root/.cache" \\
     || -L "$physical_frontend_root/.cache/full-screen-smoke" \\
     || -L "$expected_cache_root" ]]; then
    return 1
  fi
'''
assert guard in text
text = text.replace(guard, "", 1)
text = text.replace('  [[ "$resolved_cache_root" == "$expected_cache_root" ]] || return 1\n', "", 1)
text = text.replace("  printf '%s\\n' \"$expected_cache_root\"\n", "  printf '%s\\n' \"$resolved_cache_root\"\n", 1)
Path(sys.argv[2]).write_text(text, encoding="utf-8")
PY
if assert_auto_cleanup_symlink_rejected "$TMP_DIR/screen-group-functions-trust-symlink.sh" cache; then
  echo '[runtime-qa-auth-concurrency] auto cleanup symlink-root trust mutation survived' >&2
  exit 1
fi

LIFECYCLE_LOCK="$TMP_DIR/lifecycle.lock"
LIFECYCLE_STATE_LOCK="$TMP_DIR/lifecycle-state.lock"
LIFECYCLE_ACTIVE="$TMP_DIR/lifecycle-active"
LIFECYCLE_EVENTS="$TMP_DIR/lifecycle-events"
LIFECYCLE_FIRST_STARTED="$TMP_DIR/lifecycle-first-started"
LIFECYCLE_INDEPENDENT_OVERLAP="$TMP_DIR/lifecycle-independent-overlap"
export LIFECYCLE_STATE_LOCK LIFECYCLE_ACTIVE LIFECYCLE_EVENTS LIFECYCLE_FIRST_STARTED
source "$HELPER"
export CARBONET_QA_AUTH_LOCK_FILE="$LIFECYCLE_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=10

loader_log="$TMP_DIR/credential-loader.log"
carbonet_qa_load_credentials LOADER_USER LOADER_PASSWORD explicit-user 'Explicit-Password-1!' >"$loader_log" 2>&1
[[ "$LOADER_USER" == explicit-user && "$LOADER_PASSWORD" == 'Explicit-Password-1!' && ! -s "$loader_log" ]]
unset LOADER_USER LOADER_PASSWORD
kubectl() {
  if [[ "$*" == *'.data.username'* ]]; then printf '%s' 'secret-user' | base64;
  elif [[ "$*" == *'.data.password'* ]]; then printf '%s' 'Secret-Password-2!' | base64;
  else return 1; fi
}
carbonet_qa_load_credentials LOADER_USER LOADER_PASSWORD '' '' carbonet-screen-smoke carbonet-prod >"$loader_log" 2>&1
[[ "$LOADER_USER" == secret-user && "$LOADER_PASSWORD" == 'Secret-Password-2!' && ! -s "$loader_log" ]]
if carbonet_qa_load_credentials LOADER_USER LOADER_PASSWORD only-user '' carbonet-screen-smoke carbonet-prod >"$loader_log" 2>&1; then
  echo '[runtime-qa-auth-concurrency] incomplete explicit credential pair did not fail closed' >&2
  exit 1
fi
grep -Fq 'explicit credential pair is incomplete' "$loader_log"
unset -f kubectl
unset LOADER_USER LOADER_PASSWORD

lifecycle_worker() {
  local label="$1" state_fd
  exec {state_fd}>"$LIFECYCLE_STATE_LOCK"
  flock "$state_fd"
  if [[ -e "$LIFECYCLE_ACTIVE" ]]; then
    printf 'OVERLAP %s\n' "$label" >>"$LIFECYCLE_EVENTS"
    flock -u "$state_fd"
    return 91
  fi
  touch "$LIFECYCLE_ACTIVE"
  printf 'START %s\n' "$label" >>"$LIFECYCLE_EVENTS"
  touch "$LIFECYCLE_FIRST_STARTED"
  flock -u "$state_fd"
  sleep 0.3
  flock "$state_fd"
  rm -f "$LIFECYCLE_ACTIVE"
  printf 'END %s\n' "$label" >>"$LIFECYCLE_EVENTS"
  flock -u "$state_fd"
}
export -f lifecycle_worker

declare -a lifecycle_pids=()
for label in first second; do
  carbonet_qa_auth_run_serialized "$label" bash -c 'lifecycle_worker "$1"' _ "$label" \
    >"$TMP_DIR/$label.log" 2>&1 &
  lifecycle_pids+=("$!")
done
(
  for _ in $(seq 1 100); do [[ -e "$LIFECYCLE_FIRST_STARTED" ]] && break; sleep 0.01; done
  [[ -e "$LIFECYCLE_FIRST_STARTED" ]]
  [[ -e "$LIFECYCLE_ACTIVE" ]] && touch "$LIFECYCLE_INDEPENDENT_OVERLAP"
) &
independent_pid=$!
lifecycle_failed=0
for pid in "${lifecycle_pids[@]}"; do wait "$pid" || lifecycle_failed=1; done
wait "$independent_pid"
(( lifecycle_failed == 0 )) || { echo '[runtime-qa-auth-concurrency] serialized lifecycle failed' >&2; exit 1; }
[[ -e "$LIFECYCLE_INDEPENDENT_OVERLAP" ]] || { echo '[runtime-qa-auth-concurrency] independent lane did not remain parallel' >&2; exit 1; }
[[ "$(grep -c '^START ' "$LIFECYCLE_EVENTS")" == 2 && "$(grep -c '^END ' "$LIFECYCLE_EVENTS")" == 2 ]]
! grep -q '^OVERLAP ' "$LIFECYCLE_EVENTS" || { echo '[runtime-qa-auth-concurrency] shared lifecycles overlapped' >&2; exit 1; }

carbonet_qa_auth_run_serialized nested-helper-probe \
  bash -c 'source "$1"; carbonet_qa_auth_acquire_lock; carbonet_qa_auth_release_lock; \
    [[ -n "${CARBONET_QA_AUTH_LOCK_FD:-}" && -n "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" ]]' \
  _ "$HELPER" >"$TMP_DIR/nested.log" 2>&1
set +e
failure_log="$(carbonet_qa_auth_run_serialized failure-probe bash -c 'echo CHILD_FAILURE_MARKER; exit 23' 2>&1)"
failure_status=$?
set -e
[[ "$failure_status" == 23 ]] || { echo "[runtime-qa-auth-concurrency] lifecycle failure status lost status=$failure_status" >&2; exit 1; }
grep -Fq 'CHILD_FAILURE_MARKER' <<<"$failure_log"
grep -Fq 'lifecycle failed name=failure-probe status=23' <<<"$failure_log"
carbonet_qa_auth_run_serialized recovery-probe bash -c 'exit 0' >"$TMP_DIR/recovery.log" 2>&1

LOCK_FILE="$TMP_DIR/shared.lock"
MARKER="$TMP_DIR/holder-ready"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$LOCK_FILE" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  touch "$MARKER"
  sleep 2
  carbonet_qa_auth_release_lock
) &
holder=$!
for _ in $(seq 1 50); do [[ -f "$MARKER" ]] && break; sleep 0.05; done
[[ -f "$MARKER" ]] || { echo '[runtime-qa-auth-concurrency] holder did not acquire lock' >&2; exit 1; }
SECONDS=0
(
  export CARBONET_QA_AUTH_LOCK_FILE="$LOCK_FILE" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  carbonet_qa_auth_release_lock
)
wait "$holder"
(( SECONDS >= 1 )) || { echo '[runtime-qa-auth-concurrency] concurrent verifier was not serialized' >&2; exit 1; }

BORROW_LOCK="$TMP_DIR/borrowed-release.lock"
BORROW_OWNER_READY="$TMP_DIR/borrow-owner-ready"
BORROW_CHILD_RELEASED="$TMP_DIR/borrow-child-released"
BORROW_OWNER_RELEASE="$TMP_DIR/borrow-owner-release"
BORROW_COMPETITOR_ACQUIRED="$TMP_DIR/borrow-competitor-acquired"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$BORROW_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  [[ "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" == "${BASHPID:-$$}" ]]
  touch "$BORROW_OWNER_READY"
  (
    source "$HELPER"
    inherited_fd="${CARBONET_QA_AUTH_LOCK_FD:-}"
    inherited_owner="${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}"
    [[ -n "$inherited_fd" && -n "$inherited_owner" ]]
    [[ "$inherited_owner" != "${BASHPID:-$$}" ]]
    carbonet_qa_auth_acquire_lock
    carbonet_qa_auth_release_lock
    [[ "${CARBONET_QA_AUTH_LOCK_FD:-}" == "$inherited_fd" ]]
    [[ "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" == "$inherited_owner" ]]
    touch "$BORROW_CHILD_RELEASED"
  )
  while [[ ! -e "$BORROW_OWNER_RELEASE" ]]; do sleep 0.01; done
  carbonet_qa_auth_release_lock
) &
borrow_owner_pid=$!
for _ in $(seq 1 50); do [[ -f "$BORROW_OWNER_READY" ]] && break; sleep 0.05; done
[[ -f "$BORROW_OWNER_READY" ]] || { echo '[runtime-qa-auth-concurrency] borrowed owner did not acquire lock' >&2; exit 1; }
for _ in $(seq 1 50); do [[ -f "$BORROW_CHILD_RELEASED" ]] && break; sleep 0.05; done
[[ -f "$BORROW_CHILD_RELEASED" ]] || { echo '[runtime-qa-auth-concurrency] borrowed child did not release' >&2; exit 1; }
if (
  export CARBONET_QA_AUTH_LOCK_FILE="$BORROW_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=1
  unset CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID
  source "$HELPER"
  if carbonet_qa_auth_acquire_lock; then
    touch "$BORROW_COMPETITOR_ACQUIRED"
    carbonet_qa_auth_release_lock
    exit 0
  fi
  exit 1
); then
  echo '[runtime-qa-auth-concurrency] borrowed child unlocked the owner critical section' >&2
  exit 1
fi
[[ ! -e "$BORROW_COMPETITOR_ACQUIRED" ]]
touch "$BORROW_OWNER_RELEASE"
wait "$borrow_owner_pid"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$BORROW_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=2
  unset CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  carbonet_qa_auth_release_lock
)

TIMEOUT_LOCK="$TMP_DIR/timeout.lock"
TIMEOUT_MARKER="$TMP_DIR/timeout-ready"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$TIMEOUT_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  touch "$TIMEOUT_MARKER"
  sleep 3
  carbonet_qa_auth_release_lock
) &
timeout_holder=$!
for _ in $(seq 1 50); do [[ -f "$TIMEOUT_MARKER" ]] && break; sleep 0.05; done
[[ -f "$TIMEOUT_MARKER" ]] || { echo '[runtime-qa-auth-concurrency] timeout holder did not acquire lock' >&2; exit 1; }
if (
  export CARBONET_QA_AUTH_LOCK_FILE="$TIMEOUT_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=1
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
); then
  echo '[runtime-qa-auth-concurrency] lock timeout did not fail closed' >&2
  exit 1
fi
wait "$timeout_holder"

source "$HELPER"
CARBONET_QA_AUTH_LOCK_FILE="$TMP_DIR/logout.lock"
CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
carbonet_qa_auth_acquire_lock
CARBONET_QA_AUTH_SESSION_ACTIVE=1
printf 'cookie' > "$TMP_DIR/failure-cookie"
MOCK_LOGOUT_STATUS=503
curl() {
  local output_file=""
  while (($#)); do
    if [[ "$1" == "-o" ]]; then output_file="$2"; shift 2; else shift; fi
  done
  printf '{"status":"logoutFailure"}' > "$output_file"
  printf '%s' "$MOCK_LOGOUT_STATUS"
}
if carbonet_qa_logout "$TMP_DIR/failure-cookie" http://invalid.example; then
  echo '[runtime-qa-auth-concurrency] HTTP 503 logout was ignored' >&2
  exit 1
fi
[[ -z "${CARBONET_QA_AUTH_LOCK_FD:-}" && -z "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" ]] || {
  echo '[runtime-qa-auth-concurrency] failed logout leaked lock ownership' >&2
  exit 1
}

carbonet_qa_auth_acquire_lock
CARBONET_QA_AUTH_SESSION_ACTIVE=1
printf 'cookie' > "$TMP_DIR/success-cookie"
MOCK_LOGOUT_STATUS=200
curl() {
  local output_file=""
  while (($#)); do
    if [[ "$1" == "-o" ]]; then output_file="$2"; shift 2; else shift; fi
  done
  printf '{"status":"success"}' > "$output_file"
  printf '%s' "$MOCK_LOGOUT_STATUS"
}
carbonet_qa_logout "$TMP_DIR/success-cookie" http://invalid.example
[[ -z "${CARBONET_QA_AUTH_LOCK_FD:-}" && -z "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" ]] || {
  echo '[runtime-qa-auth-concurrency] successful logout leaked lock ownership' >&2
  exit 1
}

printf '[runtime-qa-auth-concurrency] PASS sharedLifecycles=6 lockAcquisitions=1 authTimeout=300s deterministicOrder=customer-activity-calculation-boundary-governance-report firstFailure=23 finalReport=executed aggregateStatus=1 overlap=0 independentActorLane=parallel independentPreparation=parallel nestedDeadlock=prevented failureStatus=23 failureLog=propagated borrowedRelease=no-op ownerRelease=exclusive competitorBlocked=true timeout=fail-closed logout200=required logout503=rejected lockReleased=true\n'
