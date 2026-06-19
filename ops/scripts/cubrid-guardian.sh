#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
WATCHDOG_SCRIPT="$ROOT_DIR/ops/scripts/cubrid-broker-watchdog.sh"
SELF_HEAL_SCRIPT="$ROOT_DIR/ops/scripts/resonance-k8s-self-heal.sh"
LOG_DIR="$ROOT_DIR/var/log/cubrid-guardian"
TIMESTAMP_FILE="$ROOT_DIR/var/run/cubrid-guardian.last"

mkdir -p "$LOG_DIR" "$(dirname "$TIMESTAMP_FILE")"

log() {
    printf '[cubrid-guardian] %s %s\n' "$(date -Is)" "$*"
}

is_running() {
    pgrep -f "cubrid-broker-watchdog" >/dev/null 2>&1
}

check_interval() {
    local last_run=0
    local interval_sec=300

    if [[ -f "$TIMESTAMP_FILE" ]]; then
        last_run=$(cat "$TIMESTAMP_FILE")
    fi

    local now
    now=$(date +%s)
    local elapsed=$((now - last_run))

    [[ $elapsed -ge $interval_sec ]]
}

run_watchdog() {
    log "running broker watchdog"
    bash "$WATCHDOG_SCRIPT" >> "$LOG_DIR/watchdog.log" 2>&1 || log "watchdog returned error"
}

run_self_heal() {
    log "running self-heal"
    bash "$SELF_HEAL_SCRIPT" >> "$LOG_DIR/self-heal.log" 2>&1 || log "self-heal returned error"
}

rotate_logs() {
    if [[ -f "$LOG_DIR/watchdog.log" ]] && [[ $(stat -c%s "$LOG_DIR/watchdog.log" 2>/dev/null || echo 0) -gt 10485760 ]]; then
        mv "$LOG_DIR/watchdog.log" "$LOG_DIR/watchdog.log.$(date +%Y%m%d_%H%M%S)"
        gzip "$LOG_DIR/watchdog.log."* 2>/dev/null || true
    fi

    if [[ -f "$LOG_DIR/self-heal.log" ]] && [[ $(stat -c%s "$LOG_DIR/self-heal.log" 2>/dev/null || echo 0) -gt 10485760 ]]; then
        mv "$LOG_DIR/self-heal.log" "$LOG_DIR/self-heal.log.$(date +%Y%m%d_%H%M%S)"
        gzip "$LOG_DIR/self-heal.log."* 2>/dev/null || true
    fi

    find "$LOG_DIR" -name "*.log.*.gz" -mtime +7 -delete 2>/dev/null || true
    find "$LOG_DIR" -name "*.log.*" -mtime +3 -delete 2>/dev/null || true
}

main() {
    log "guardian tick"

    rotate_logs

    if ! is_running; then
        run_watchdog
        date +%s > "$TIMESTAMP_FILE"
    else
        log "watchdog already running, skipping"
    fi

    if check_interval; then
        run_self_heal
        date +%s > "$TIMESTAMP_FILE"
    else
        log "self-heal interval not reached yet"
    fi

    log "guardian cycle complete"
}

main "$@"