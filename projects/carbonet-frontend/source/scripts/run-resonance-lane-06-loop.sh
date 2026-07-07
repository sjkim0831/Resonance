#!/usr/bin/env bash

set -u

frontend_root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "${frontend_root}/.." && pwd)"
lane_docs_path="${repo_root}/docs/ai/80-skills/resonance-10-session-assignment.md"
interval_ms=60000
max_loops="infinite"
stop_on_error="true"
state_root="${frontend_root}/.codex-state/resonance-lane-06"
state_file="${state_root}/last-loop.env"
summary_file="${state_root}/last-loop-summary.txt"
log_file=""
last_test_preflight_status="NOT_RUN"
last_test_preflight_note="not-run"

lane_targets=(
  "${repo_root}/docs/architecture/lane-start-instructions-05-06-08-09.md"
  "${repo_root}/docs/architecture/lane-code-start-checklists-05-06-08-09.md"
  "${repo_root}/docs/architecture/module-selection-api-contracts.md"
  "${repo_root}/docs/architecture/repair-and-verification-api-contracts.md"
  "${repo_root}/src/main/java/egovframework/com/feature/admin/web/ResonanceControlPlaneApiController.java"
  "${repo_root}/src/main/java/egovframework/com/feature/admin/service/impl/ResonanceControlPlaneServiceImpl.java"
  "${repo_root}/src/main/resources/egovframework/mapper/com/feature/admin/ResonanceControlPlaneMapper.xml"
  "${repo_root}/src/test/java/egovframework/com/feature/admin/service/impl/ResonanceControlPlaneServiceImplTest.java"
  "${repo_root}/src/test/java/egovframework/com/feature/admin/mapper/ResonanceControlPlaneMapperXmlContractTest.java"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once)
      max_loops=1
      shift
      ;;
    --keep-going-on-error)
      stop_on_error="false"
      shift
      ;;
    --interval-ms=*)
      interval_ms="${1#*=}"
      shift
      ;;
    --max-loops=*)
      max_loops="${1#*=}"
      shift
      ;;
    --state-root=*)
      state_root="${1#*=}"
      state_file="${state_root}/last-loop.env"
      summary_file="${state_root}/last-loop-summary.txt"
      shift
      ;;
    --log-file=*)
      log_file="${1#*=}"
      shift
      ;;
    *)
      echo "[lane-06] unknown option: $1" >&2
      exit 1
      ;;
  esac
done

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

sleep_interval() {
  python3 - <<'PY' "$interval_ms"
import sys, time
time.sleep(max(float(sys.argv[1]) / 1000.0, 0.0))
PY
}

log_line() {
  local line="$1"
  echo "$line"
  if [[ -n "$log_file" ]]; then
    mkdir -p "$(dirname "$log_file")"
    printf '%s\n' "$line" >> "$log_file"
  fi
}

run_step() {
  local description="$1"
  shift
  log_line "[lane-06] running: ${description}"
  if ! (cd "$repo_root" && "$@"); then
    log_line "[lane-06] failed: ${description}"
    if [[ "$stop_on_error" == "true" ]]; then
      exit 1
    fi
    return 1
  fi
  return 0
}

read_pending_changes() {
  (cd "$repo_root" && git status --short -- "${lane_targets[@]}") || return 1
}

read_target_snapshot() {
  (cd "$repo_root" && ls -ld "${lane_targets[@]}") || return 1
}

run_mapper_contract_check() {
  python3 - <<'PY' "$repo_root"
from pathlib import Path
import re
import sys

repo_root = Path(sys.argv[1])
xml_path = repo_root / "src/main/resources/egovframework/mapper/com/feature/admin/ResonanceControlPlaneMapper.xml"
xml = xml_path.read_text(encoding="utf-8")

occurred_at_count = len(re.findall(r"#\{occurredAt\}\s*,\s*0\s*,\s*#\{createdBy\}", xml))
if occurred_at_count != 4:
    raise SystemExit(f"expected exactly 4 standard occurredAt payload bindings, found {occurred_at_count}")

if re.search(r"CURRENT_DATETIME\s*,\s*0\s*,\s*#\{createdBy\}", xml):
    raise SystemExit("control-plane OCCURRED_AT columns must not be hard-coded to CURRENT_DATETIME")

module_binding_result_insert = re.compile(
    r"RSN_MODULE_BINDING_RESULT\s*\(.*?ROLLBACK_ANCHOR_YN,\s*OCCURRED_AT,\s*RESULT_PAYLOAD_JSON.*?"
    r"#\{nextRecommendedAction\},\s*#\{rollbackAnchorYn\},\s*#\{occurredAt\},\s*#\{resultPayloadJson\}",
    re.S,
)
if not module_binding_result_insert.search(xml):
    raise SystemExit("module binding result insert must bind OCCURRED_AT before RESULT_PAYLOAD_JSON")

print(f"[lane-06] mapper contract check passed: occurredAtBindings={occurred_at_count}")
PY
}

run_targeted_test_preflight() {
  local output
  if output="$(cd "$repo_root" && mvn -o \
    -Dtest=ResonanceControlPlaneServiceImplTest,ResonanceControlPlaneMapperXmlContractTest \
    test 2>&1)"; then
    last_test_preflight_status="OK"
    last_test_preflight_note="targeted tests passed offline"
    log_line "[lane-06] targeted test preflight passed"
    return 0
  fi

  if printf '%s\n' "$output" | grep -q "surefire-junit-platform"; then
    last_test_preflight_status="BLOCKED"
    last_test_preflight_note="offline surefire-junit-platform:2.22.2 artifact missing"
    log_line "[lane-06] targeted test preflight blocked: ${last_test_preflight_note}"
    return 0
  fi

  last_test_preflight_status="FAILED"
  last_test_preflight_note="$(printf '%s\n' "$output" | tail -n 5 | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g' | sed 's/^ //; s/ $//')"
  log_line "[lane-06] targeted test preflight failed: ${last_test_preflight_note}"
  return 1
}

read_last_state() {
  if [[ -f "$state_file" ]]; then
    # shellcheck disable=SC1090
    source "$state_file"
  fi
}

write_state() {
  local loop="$1"
  local mode="$2"
  local status="$3"
  local started_at="$4"
  local completed_at="$5"

  mkdir -p "$state_root"
  cat > "$state_file" <<EOF
LAST_LOOP='${loop}'
LAST_MODE='${mode}'
LAST_STATUS='${status}'
LAST_STARTED_AT='${started_at}'
LAST_COMPLETED_AT='${completed_at}'
LAST_TEST_PREFLIGHT_STATUS='${last_test_preflight_status}'
LAST_TEST_PREFLIGHT_NOTE='${last_test_preflight_note}'
EOF
}

write_summary() {
  local loop="$1"
  local mode="$2"
  local status="$3"
  local pending_changes="$4"
  local target_snapshot="$5"

  mkdir -p "$state_root"
  {
    printf '[lane-06] last loop=%s mode=%s status=%s\n' "$loop" "$mode" "$status"
    printf '[lane-06] docs=%s\n' "$lane_docs_path"
    printf '[lane-06] summary-updated-at=%s\n' "$(timestamp)"
    printf '[lane-06] targeted-test-preflight=%s (%s)\n' "$last_test_preflight_status" "$last_test_preflight_note"
    if [[ -n "$pending_changes" ]]; then
      printf '[lane-06] pending changes from previous loop:\n'
      printf '%s\n' "$pending_changes" | sed 's/^/  /'
    else
      printf '[lane-06] pending changes from previous loop: none\n'
    fi
    printf '[lane-06] lane targets:\n'
    printf '%s\n' "$target_snapshot" | sed 's/^/  /'
  } > "$summary_file"
}

read_last_state

log_line "[lane-06] resonance loop target: ${lane_docs_path}"
log_line "[lane-06] allowed roots: src/main/java, src/main/resources/egovframework/mapper, src/test/java"
log_line "[lane-06] check order:"
for lane_target in "${lane_targets[@]}"; do
  log_line "[lane-06]   ${lane_target}"
done
log_line "[lane-06] interval=${interval_ms}ms maxLoops=${max_loops} stopOnError=${stop_on_error}"
if [[ -n "${LAST_LOOP:-}" ]]; then
  log_line "[lane-06] resume state: lastLoop=${LAST_LOOP} lastMode=${LAST_MODE:-unknown} lastStatus=${LAST_STATUS:-unknown} completedAt=${LAST_COMPLETED_AT:-unknown}"
fi

loop=0
while true; do
  loop=$((loop + 1))
  current_started_at="$(timestamp)"
  echo
  log_line "[lane-06] loop ${loop} started at ${current_started_at}"

  pending_changes="$(read_pending_changes)" || {
    log_line "[lane-06] failed: git status --short -- backend control-plane scope"
    exit 1
  }

  if [[ -n "$pending_changes" ]]; then
    mode="continue"
    log_line "[lane-06] mode=continue pending backend lane changes detected:"
    printf '%s\n' "$pending_changes" | sed 's/^/  /'
  else
    mode="rerun"
    log_line "[lane-06] mode=rerun no pending backend lane changes detected"
  fi

  log_line "[lane-06] target snapshot:"
  target_snapshot="$(read_target_snapshot)" || {
    log_line "[lane-06] failed: ls -ld lane targets"
    exit 1
  }
  printf '%s\n' "$target_snapshot" | sed 's/^/  /'

  failed="false"
  run_step \
    "mvn -o -DskipTests compile test-compile" \
    mvn -o -DskipTests compile test-compile || failed="true"
  run_step \
    "offline mapper contract check" \
    run_mapper_contract_check || failed="true"
  run_targeted_test_preflight || failed="true"

  current_completed_at="$(timestamp)"
  if [[ "$failed" == "true" ]]; then
    current_status="FAILED"
  elif [[ "$last_test_preflight_status" == "BLOCKED" ]]; then
    current_status="BLOCKED"
  else
    current_status="OK"
  fi
  write_state "$loop" "$mode" "$current_status" "$current_started_at" "$current_completed_at"
  write_summary "$loop" "$mode" "$current_status" "$pending_changes" "$target_snapshot"
  log_line "[lane-06] loop ${loop} completed at ${current_completed_at} status=${current_status}"

  if [[ "$max_loops" != "infinite" && "$loop" -ge "$max_loops" ]]; then
    break
  fi

  log_line "[lane-06] sleeping ${interval_ms}ms before next loop"
  sleep_interval
done
