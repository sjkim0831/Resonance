#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-18000}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/logs}"
PID_FILE="$RUN_DIR/carbonet-${PORT}.pid"
SUPERVISOR_LOG_FILE="${LOG_DIR}/carbonet-${PORT}-supervisor.log"
RESTART_DELAY_SECONDS="${RESTART_DELAY_SECONDS:-3}"

mkdir -p "$RUN_DIR" "$LOG_DIR"

resolve_running_pid() {
  ps -eo pid=,args= | awk -v jar_path="$RUN_DIR/carbonet-${PORT}.jar" -v port="--server.port=${PORT}" '
    index($0, jar_path) && index($0, port) {
      print $1;
      exit 0;
    }
  '
}

restore_pid_file_if_needed() {
  local expected_pid="$1"
  local resolved_pid=""

  if [[ -n "${expected_pid:-}" ]] && kill -0 "$expected_pid" 2>/dev/null; then
    printf '%s\n' "$expected_pid" > "$PID_FILE"
    return 0
  fi

  resolved_pid="$(resolve_running_pid || true)"
  if [[ -n "${resolved_pid:-}" ]] && kill -0 "$resolved_pid" 2>/dev/null; then
    printf '%s\n' "$resolved_pid" > "$PID_FILE"
    printf '[run-18000-supervised] %s restored pid file pid=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$resolved_pid" >>"$SUPERVISOR_LOG_FILE"
    return 0
  fi

  return 1
}

while true; do
  printf '[run-18000-supervised] %s starting port=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$PORT" >>"$SUPERVISOR_LOG_FILE"

  if ! bash "$ROOT_DIR/ops/scripts/start-18000.sh" >>"$SUPERVISOR_LOG_FILE" 2>&1; then
    if restore_pid_file_if_needed ""; then
      APP_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
      if [[ -n "${APP_PID:-}" ]]; then
        printf '[run-18000-supervised] %s adopted existing pid=%s after startup failure\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$APP_PID" >>"$SUPERVISOR_LOG_FILE"
      fi
    else
      printf '[run-18000-supervised] %s startup failed; retry in %ss\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$RESTART_DELAY_SECONDS" >>"$SUPERVISOR_LOG_FILE"
      sleep "$RESTART_DELAY_SECONDS"
      continue
    fi
  else
    APP_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  fi

  if [[ -z "${APP_PID:-}" ]]; then
    if ! restore_pid_file_if_needed ""; then
      printf '[run-18000-supervised] %s pid file missing after startup; retry in %ss\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$RESTART_DELAY_SECONDS" >>"$SUPERVISOR_LOG_FILE"
      sleep "$RESTART_DELAY_SECONDS"
      continue
    fi
    APP_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  fi

  while kill -0 "$APP_PID" 2>/dev/null; do
    if [[ ! -f "$PID_FILE" ]]; then
      restore_pid_file_if_needed "$APP_PID" || true
    fi
    sleep 5
  done

  rm -f "$PID_FILE"
  printf '[run-18000-supervised] %s process exited pid=%s; restart in %ss\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$APP_PID" "$RESTART_DELAY_SECONDS" >>"$SUPERVISOR_LOG_FILE"
  sleep "$RESTART_DELAY_SECONDS"
done
