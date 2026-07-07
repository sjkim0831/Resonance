#!/usr/bin/env bash

set -u

frontend_root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "${frontend_root}/.." && pwd)"
lane_docs_path="${repo_root}/docs/ai/80-skills/resonance-10-session-assignment.md"
interval_ms=60000
max_loops="infinite"
stop_on_error="false"
state_root="${frontend_root}/.codex-state/resonance-lane-05"
state_file="${state_root}/last-loop.env"
summary_file="${state_root}/last-loop-summary.txt"
log_file=""

lane_targets=(
  "${repo_root}/docs/architecture/lane-start-instructions-05-06-08-09.md"
  "${repo_root}/docs/architecture/screen-family-ui-consistency-contract.md"
  "${repo_root}/docs/frontend/admin-template-parity-inventory.md"
  "${repo_root}/docs/prototypes/resonance-ui/index.html"
  "${repo_root}/docs/prototypes/resonance-ui/project-runtime.html"
  "${frontend_root}/src"
  "${frontend_root}/scripts"
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
      echo "[lane-05] unknown option: $1" >&2
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
  log_line "[lane-05] running: ${description}"
  if ! (cd "$frontend_root" && "$@"); then
    log_line "[lane-05] failed: ${description}"
    if [[ "$stop_on_error" == "true" ]]; then
      exit 1
    fi
    return 1
  fi
  return 0
}

read_pending_changes() {
  (cd "$repo_root" && git status --short -- frontend/src frontend/scripts) || return 1
}

read_target_snapshot() {
  (cd "$repo_root" && ls -ld "${lane_targets[@]}") || return 1
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
    printf '[lane-05] last loop=%s mode=%s status=%s\n' "$loop" "$mode" "$status"
    printf '[lane-05] docs=%s\n' "$lane_docs_path"
    printf '[lane-05] summary-updated-at=%s\n' "$(timestamp)"
    if [[ -n "$pending_changes" ]]; then
      printf '[lane-05] pending changes from previous loop:\n'
      printf '%s\n' "$pending_changes" | sed 's/^/  /'
    else
      printf '[lane-05] pending changes from previous loop: none\n'
    fi
    printf '[lane-05] lane targets:\n'
    printf '%s\n' "$target_snapshot" | sed 's/^/  /'
  } > "$summary_file"
}

read_last_state

log_line "[lane-05] resonance loop target: ${lane_docs_path}"
log_line "[lane-05] allowed roots: frontend/src, frontend/scripts"
log_line "[lane-05] check order:"
for lane_target in "${lane_targets[@]}"; do
  log_line "[lane-05]   ${lane_target}"
done
log_line "[lane-05] interval=${interval_ms}ms maxLoops=${max_loops} stopOnError=${stop_on_error}"
if [[ -n "${LAST_LOOP:-}" ]]; then
  log_line "[lane-05] resume state: lastLoop=${LAST_LOOP} lastMode=${LAST_MODE:-unknown} lastStatus=${LAST_STATUS:-unknown} completedAt=${LAST_COMPLETED_AT:-unknown}"
fi

loop=0
while true; do
  loop=$((loop + 1))
  current_started_at="$(timestamp)"
  echo
  log_line "[lane-05] loop ${loop} started at ${current_started_at}"

  pending_changes="$(read_pending_changes)" || {
    log_line "[lane-05] failed: git status --short -- frontend/src frontend/scripts"
    exit 1
  }

  if [[ -n "$pending_changes" ]]; then
    mode="continue"
    log_line "[lane-05] mode=continue pending changes detected:"
    printf '%s\n' "$pending_changes" | sed 's/^/  /'
  else
    mode="rerun"
    log_line "[lane-05] mode=rerun no pending frontend lane changes detected"
  fi

  log_line "[lane-05] target snapshot:"
  target_snapshot="$(read_target_snapshot)" || {
    log_line "[lane-05] failed: ls -ld lane targets"
    exit 1
  }
  printf '%s\n' "$target_snapshot" | sed 's/^/  /'

  failed="false"
  run_step "npm run audit:ui-governance" npm run audit:ui-governance || failed="true"
  run_step "npm run audit:generated-output" npm run audit:generated-output || failed="true"
  run_step "npm run build" npm run build || failed="true"

  current_completed_at="$(timestamp)"
  current_status="$([[ "$failed" == "true" ]] && echo FAILED || echo OK)"
  write_state "$loop" "$mode" "$current_status" "$current_started_at" "$current_completed_at"
  write_summary "$loop" "$mode" "$current_status" "$pending_changes" "$target_snapshot"
  log_line "[lane-05] loop ${loop} completed at ${current_completed_at} status=${current_status}"

  if [[ "$max_loops" != "infinite" && "$loop" -ge "$max_loops" ]]; then
    break
  fi

  log_line "[lane-05] sleeping ${interval_ms}ms before next loop"
  sleep_interval
done
