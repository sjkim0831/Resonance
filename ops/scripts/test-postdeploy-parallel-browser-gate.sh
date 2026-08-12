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
  grep -q 'durable reconciler owns rollback' "$candidate" || return 1
  grep -Fq 'OVERLAY_DIR="$live_frontend_overlay"' "$candidate" || return 1
  grep -Fq 'kill -TERM -- "-$pgid"' "$candidate" || return 1
  grep -Fq 'kill -KILL -- "-$pgid"' "$candidate" || return 1
  grep -q 'canonical_runtime_screen_gate_cache_root' "$candidate" || return 1
  python3 - "$candidate" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
start = text.index("run_runtime_release_validation_lanes() {")
end = text.index("\n}\n", start)
lane = text[start:end]
assert 'resonance-full-screen-deploy-gate.sh restore' not in lane
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
# no physical restore in the lane, and preserve the originating status for the
# single durable cleanup reconciler.
python3 - "$script" "$tmp/release-lanes.sh" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding="utf-8")
start = text.index("run_runtime_release_validation_lanes() {")
end = text.index("\n}\n", start) + 2
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
  printf 'UNEXPECTED_BASH:%s\n' "$*" >>"$EVENTS"
  return 90
}

run_lane_scenario() {
  local expected_status="$1" label="$2" lane_status=0
  EVENTS="$tmp/events-$label"
  BROWSER_JOINED="$tmp/browser-joined-$label"
  ROLLBACK_IN_PROGRESS="$tmp/rollback-in-progress-$label"
  export EVENTS BROWSER_JOINED ROLLBACK_IN_PROGRESS
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
  ! grep -q '^UNEXPECTED_BASH:' "$EVENTS"
  ! grep -q '^SCREEN_SAVE_RAN$' "$EVENTS"
  python3 - "$EVENTS" <<'PY'
from pathlib import Path
import sys
events = Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
assert events.index("VALIDATOR_FAIL") < events.index("BROWSER_JOINED")
PY
}

run_lane_scenario 23 deferred-rollback

echo "[postdeploy-browser-parallel-test] PASS bounded=true browserJoined=true screenSaveSkipped=true laneRestore=zero durableReconciler=singleOwner originalStatus=23 staticMutation=rejected"
