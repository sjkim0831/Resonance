#!/usr/bin/env bash

set -u

frontend_root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "${frontend_root}/.." && pwd)"
lane_docs_path="${repo_root}/docs/ai/80-skills/resonance-10-session-assignment.md"
interval_ms=60000
max_loops="infinite"
stop_on_error="true"

lane_targets=(
  "${repo_root}/docs/architecture/lane-start-instructions-05-06-08-09.md"
  "${repo_root}/docs/architecture/lane-code-start-checklists-05-06-08-09.md"
  "${repo_root}/docs/architecture/parity-and-smoke-checklists.md"
  "${repo_root}/docs/architecture/repair-and-verification-api-examples.md"
  "${repo_root}/docs/architecture/implementation-handoff-health-checklist.md"
  "${repo_root}/docs/prototypes/resonance-ui/current-runtime-compare.html"
  "${repo_root}/docs/prototypes/resonance-ui/repair-workbench.html"
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
    *)
      echo "[lane-09] unknown option: $1" >&2
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

run_step() {
  local description="$1"
  shift
  echo "[lane-09] running: ${description}"
  if ! (cd "$frontend_root" && "$@"); then
    echo "[lane-09] failed: ${description}" >&2
    if [[ "$stop_on_error" == "true" ]]; then
      exit 1
    fi
    return 1
  fi
  return 0
}

read_pending_changes() {
  (cd "$repo_root" && git status --short -- docs/architecture docs/prototypes/resonance-ui frontend/src/features frontend/scripts) || return 1
}

print_target_snapshot() {
  (cd "$repo_root" && ls -lt "${lane_targets[@]}") || return 1
}

echo "[lane-09] resonance loop target: ${lane_docs_path}"
echo "[lane-09] allowed roots: docs/architecture, docs/prototypes/resonance-ui, frontend/src/features, frontend/scripts"
echo "[lane-09] interval=${interval_ms}ms maxLoops=${max_loops} stopOnError=${stop_on_error}"

loop=0
while true; do
  loop=$((loop + 1))
  echo
  echo "[lane-09] loop ${loop} started at $(timestamp)"

  pending_changes="$(read_pending_changes)" || {
    echo "[lane-09] failed: git status --short -- docs/architecture docs/prototypes/resonance-ui frontend/src/features frontend/scripts" >&2
    exit 1
  }

  if [[ -n "$pending_changes" ]]; then
    echo "[lane-09] mode=continue pending lane-09 changes detected:"
    printf '%s\n' "$pending_changes" | sed 's/^/  /'
  else
    echo "[lane-09] mode=rerun no pending lane-09 changes detected"
  fi

  echo "[lane-09] target snapshot:"
  print_target_snapshot | sed 's/^/  /' || {
    echo "[lane-09] failed: ls -lt lane targets" >&2
    exit 1
  }

  failed="false"
  run_step "npm run build" npm run build || failed="true"

  echo "[lane-09] loop ${loop} completed at $(timestamp) status=$([[ "$failed" == "true" ]] && echo FAILED || echo OK)"

  if [[ "$max_loops" != "infinite" && "$loop" -ge "$max_loops" ]]; then
    break
  fi

  echo "[lane-09] sleeping ${interval_ms}ms before next loop"
  sleep_interval
done
