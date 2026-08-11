#!/usr/bin/env bash
set -euo pipefail

script="ops/scripts/auto-deploy-main.sh"
runner="projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assert_parallel_contract() {
  local candidate="$1"
  bash -n "$candidate" || return 1
  grep -q 'bounded browser gate running concurrently' "$candidate" || return 1
  grep -q 'run_runtime_release_validation_lanes' "$candidate" || return 1
  grep -q 'wait "$runtime_screen_gate_pid"' "$candidate" || return 1
  grep -q 'FULL_SCREEN_GATE_AUTO_ROLLBACK=false' "$candidate" || return 1
  grep -q 'screen contract runtime save skipped: validation groups failed' "$candidate" || return 1
  grep -q 'synchronous rollback completed before validation exit' "$candidate" || return 1
  grep -Fq 'OVERLAY_DIR="$live_frontend_overlay"' "$candidate" || return 1
  grep -Fq 'kill -TERM -- "-$pgid"' "$candidate" || return 1
  grep -Fq 'kill -KILL -- "-$pgid"' "$candidate" || return 1
  grep -q 'canonical_runtime_screen_gate_cache_root' "$candidate" || return 1
  python3 - "$candidate" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
start = text.index("run_runtime_release_validation_lanes() {")
end = text.index("\n}\ncleanup_deploy()", start)
lane = text[start:end]
assert lane.index('wait "$runtime_screen_gate_pid"') < lane.index('bash ops/scripts/resonance-full-screen-deploy-gate.sh restore')
assert lane.count('bash ops/scripts/resonance-full-screen-deploy-gate.sh restore') == 1
assert lane.index('run_postdeploy_candidate_validation_groups') < lane.index('run_screen_contract_runtime_save_gate_if_required')
assert 'if (( validation_status == 0 )); then' in lane
PY
}

bash -n "$runner"
assert_parallel_contract "$script"
grep -q 'test-results' "$runner"
grep -q 'sudo -n chown' "$runner"
grep -Fq 'physical_root_dir="$(realpath -e -- "$root_dir")"' "$runner"
grep -Fq 'assert_physical_smoke_cache_root || exit 2' "$runner"
grep -Fq '"$cache_dir"/*) ;;' "$runner"

sed '/FULL_SCREEN_GATE_AUTO_ROLLBACK=false/d' "$script" >"$tmp/auto-deploy-no-child-rollback-disable.sh"
if assert_parallel_contract "$tmp/auto-deploy-no-child-rollback-disable.sh" >/dev/null 2>&1; then
  echo '[postdeploy-browser-parallel-test] child auto-rollback-disable removal mutation survived' >&2
  exit 1
fi

# Exercise the actual coordinator with a validator failure and a concurrent
# browser lane. The main process must join the browser, skip screen-save, run
# exactly one synchronous restore to completion, and preserve the originating
# status unless rollback itself fails.
python3 - "$script" "$tmp/release-lanes.sh" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
start = text.index("run_runtime_release_validation_lanes() {")
end = text.index("\n}\ncleanup_deploy()", start) + 2
Path(sys.argv[2]).write_text(text[start:end] + "\n", encoding="utf-8")
PY
source "$tmp/release-lanes.sh"

run_postdeploy_candidate_validation_groups() {
  printf 'VALIDATOR_FAIL\n' >>"$EVENTS"
  return 23
}
run_screen_contract_runtime_save_gate_if_required() {
  printf 'SCREEN_SAVE_RAN\n' >>"$EVENTS"
}
cleanup_runtime_screen_gate_cache() {
  printf 'CACHE_CLEANED\n' >>"$EVENTS"
  runtime_screen_gate_cache_dir=""
}
terminate_runtime_screen_gate_group() {
  printf 'GROUP_TERMINATED\n' >>"$EVENTS"
  runtime_screen_gate_pid=""
  runtime_screen_gate_pgid=""
  cleanup_runtime_screen_gate_cache
}
bash() {
  [[ "$*" == *'resonance-full-screen-deploy-gate.sh restore'* ]] || return 90
  printf 'RESTORE_START\n' >>"$EVENTS"
  [[ -e "$BROWSER_JOINED" ]] || return 91
  touch "$ROLLBACK_IN_PROGRESS"
  sleep 0.08
  printf 'RESTORE_END\n' >>"$EVENTS"
  rm -f "$ROLLBACK_IN_PROGRESS"
  return "$MOCK_ROLLBACK_STATUS"
}

run_lane_scenario() {
  local rollback_status="$1" expected_status="$2" label="$3" lane_status=0
  EVENTS="$tmp/events-$label"
  BROWSER_JOINED="$tmp/browser-joined-$label"
  ROLLBACK_IN_PROGRESS="$tmp/rollback-in-progress-$label"
  MOCK_ROLLBACK_STATUS="$rollback_status"
  export EVENTS BROWSER_JOINED ROLLBACK_IN_PROGRESS MOCK_ROLLBACK_STATUS
  : >"$EVENTS"
  runtime_screen_gate_log="$tmp/browser-$label.log"
  : >"$runtime_screen_gate_log"
  runtime_screen_gate_cache_dir="$tmp/cache-$label"
  runtime_screen_gate_pgid=""
  PLAN_FRONTEND_REQUIRED=true
  live_frontend_overlay="$tmp/live-overlay"
  (
    sleep 0.08
    printf 'BROWSER_JOINED\n' >>"$EVENTS"
    touch "$BROWSER_JOINED"
  ) &
  runtime_screen_gate_pid=$!
  set +e
  run_runtime_release_validation_lanes true >"$tmp/lane-$label.log" 2>&1
  lane_status=$?
  set -e
  [[ "$lane_status" == "$expected_status" ]]
  [[ ! -e "$ROLLBACK_IN_PROGRESS" ]]
  [[ "$(grep -c '^RESTORE_START$' "$EVENTS")" == 1 ]]
  [[ "$(grep -c '^RESTORE_END$' "$EVENTS")" == 1 ]]
  ! grep -q '^SCREEN_SAVE_RAN$' "$EVENTS"
  python3 - "$EVENTS" <<'PY'
from pathlib import Path
import sys
events = Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
assert events.index("VALIDATOR_FAIL") < events.index("BROWSER_JOINED") < events.index("RESTORE_START") < events.index("RESTORE_END")
PY
}

run_lane_scenario 0 23 rollback-success
run_lane_scenario 71 71 rollback-failure

echo "[postdeploy-browser-parallel-test] PASS bounded=true joinedBeforeRestore=true screenSaveSkipped=true synchronousRestore=exactly-once rollbackCompletion=awaited originalStatus=23 rollbackFailureStatus=71 staticMutation=rejected"
