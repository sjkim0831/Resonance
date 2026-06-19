#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
# Actual running CUBRID instance (external mode on this server)
CUBRID_HOME="${CUBRID_HOME:-/home/cubrid/CUBRID}"
# Kubernetes hostPath data directory - PRIMARY
CUBRID_DATA="${CUBRID_DATA:-/opt/Resonance/data/cubrid}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
LOG_FILE="${LOG_FILE:-/tmp/resonance-cubrid-autorecover.log}"
LOCK_FILE="${LOCK_FILE:-/var/lock/resonance-cubrid-autorecover.lock}"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"
exec >>"$LOG_FILE" 2>&1
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "$(date -Is) another autorecover run is active"; exit 0; }

log() {
  printf '[resonance-cubrid-autorecover] %s %s\n' "$(date -Is)" "$*"
}

is_cubrid_running() {
  pgrep -f "cub_server" >/dev/null 2>&1
}

is_broker_running() {
  pgrep -f "cub_broker" >/dev/null 2>&1
}

is_port_listening() {
  local port="$1"
  timeout 2 bash -c "nc -z localhost $port" >/dev/null 2>&1
}

check_cubrid_server() {
  local db_name="$1"
  if pgrep -f "cub_server $db_name" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

check_db_connectable() {
  local db_name="$1"
  local host="${2:-localhost}"
  "$CUBRID_HOME/bin/csql" -u dba -p "" -c "SELECT 1;" "$db_name@$host" >/dev/null 2>&1
}

start_cubrid_service() {
  log "starting CUBRID service..."
  export CUBRID="$CUBRID_HOME"
  export LD_LIBRARY_PATH="$CUBRID_HOME/lib:$LD_LIBRARY_PATH"
  export CUBRID_DATABASES="$CUBRID_DATA"
  cd "$CUBRID_HOME"
  "$CUBRID_HOME/bin/cubrid" service start >/dev/null 2>&1 || true
  sleep 5
}

restart_broker() {
  log "restarting CUBRID broker..."
  export CUBRID="$CUBRID_HOME"
  export LD_LIBRARY_PATH="$CUBRID_HOME/lib:$LD_LIBRARY_PATH"
  cd "$CUBRID_HOME"
  "$CUBRID_HOME/bin/cubrid" broker stop >/dev/null 2>&1 || true
  sleep 2
  "$CUBRID_HOME/bin/cubrid" broker start >/dev/null 2>&1 || true
  sleep 3
}

start_server() {
  local db_name="$1"
  log "starting CUBRID server for $db_name..."
  export CUBRID="$CUBRID_HOME"
  export LD_LIBRARY_PATH="$CUBRID_HOME/lib:$LD_LIBRARY_PATH"
  cd "$CUBRID_HOME"
  "$CUBRID_HOME/bin/cubrid" server start "$db_name" >/dev/null 2>&1 || true
  sleep 3
}

main() {
  log "start"

  if ! is_cubrid_running; then
    log "CUBRID server not running, starting service"
    start_cubrid_service
  else
    log "CUBRID server is running"
  fi

  local databases=("carbonet" "resonance")
  for db in "${databases[@]}"; do
    if ! check_cubrid_server "$db"; then
      log "database $db not running, starting..."
      start_server "$db"
    else
      log "database $db is running"
    fi
  done

  if ! is_broker_running; then
    log "CUBRID broker not running, restarting..."
    restart_broker
  else
    log "CUBRID broker is running"
  fi

  if ! is_port_listening 33000; then
    log "port 33000 not listening, forcing broker restart"
    restart_broker
  fi

  log "done"
  ps aux | grep -E "cub_server|cub_broker" | grep -v grep || true
}

main