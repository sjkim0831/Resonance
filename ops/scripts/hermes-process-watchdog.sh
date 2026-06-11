#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
SELF_HEAL_SCRIPT="${SELF_HEAL_SCRIPT:-$ROOT_DIR/ops/scripts/hermes-agent-self-heal.sh}"
LAUNCHER_SCRIPT="${LAUNCHER_SCRIPT:-$ROOT_DIR/ops/scripts/hermes-launcher.sh}"
WATCHDOG_DIR="${HERMES_PROCESS_WATCHDOG_DIR:-$ROOT_DIR/var/ai-runtime/hermes-process-watchdog}"
LOG_FILE="$WATCHDOG_DIR/watchdog.log"
MAX_RESTARTS_PER_HOUR="${HERMES_WATCHDOG_MAX_RESTARTS_PER_HOUR:-3}"
RESTART_WINDOW_SECONDS=3600

mkdir -p "$WATCHDOG_DIR"

log() {
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "WATCHDOG" "$*" | tee -a "$LOG_FILE"
}

count_recent_restarts() {
  local now
  now="$(date +%s)"
  find "$WATCHDOG_DIR" -name "restart-*.log" -mmin -60 2>/dev/null | wc -l
}

record_restart() {
  local exit_code="$1"
  local pid="$2"
  touch "$WATCHDOG_DIR/restart-$(date +%Y%m%d-%H%M%S)-$$-${exit_code}.log"
}

is_hermes_running() {
  pgrep -f "[h]ermes-launcher" >/dev/null 2>&1 || pgrep -f "[h]ermes.*agent" >/dev/null 2>&1
}

start_hermes() {
  log "Starting Hermes agent..."
  nohup bash "$LAUNCHER_SCRIPT" >"$WATCHDOG_DIR/hermes-stdout.log" 2>"$WATCHDOG_DIR/hermes-stderr.log" &
  HERMES_PID=$!
  log "Hermes started with PID $HERMES_PID"
  echo "$HERMES_PID" >"$WATCHDOG_DIR/hermes.pid"
  return 0
}

stop_hermes() {
  local pid
  pid="$(cat "$WATCHDOG_DIR/hermes.pid" 2>/dev/null || echo "")"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    log "Stopping Hermes PID $pid"
    kill "$pid" 2>/dev/null || true
    sleep 2
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$WATCHDOG_DIR/hermes.pid"
}

trigger_self_heal() {
  local task_id="hermes-process-watchdog-$(date +%Y%m%d-%H%M%S)"
  local exit_code="$1"
  log "Triggering self-heal for task_id=$task_id exit_code=$exit_code"
  timeout 420s bash "$SELF_HEAL_SCRIPT" "$task_id" "$exit_code" "$WATCHDOG_DIR/hermes-stdout.log" "$WATCHDOG_DIR/hermes-stderr.log" >>"$WATCHDOG_DIR/self-heal.log" 2>&1 || true
}

log "Hermes Process Watchdog started (PID $$)"
log "ROOT_DIR=$ROOT_DIR"
log "SELF_HEAL_SCRIPT=$SELF_HEAL_SCRIPT"

while true; do
  sleep 10

  if ! is_hermes_running; then
    recent_restarts=$(count_recent_restarts)
    log "Hermes not running. Recent restarts: $recent_restarts/$MAX_RESTARTS_PER_HOUR per hour"

    if [ "$recent_restarts" -ge "$MAX_RESTARTS_PER_HOUR" ]; then
      log "Too many restarts ($recent_restarts in last hour). NOT restarting. Triggering self-heal."
      trigger_self_heal 1
      sleep 60
      continue
    fi

    stop_hermes 2>/dev/null || true
    start_hermes
    sleep 5

    if is_hermes_running; then
      log "Hermes restart successful"
      record_restart 0
    else
      log "Hermes restart failed"
      record_restart 1
      trigger_self_heal 1
    fi
  fi
done