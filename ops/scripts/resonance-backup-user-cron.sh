#!/usr/bin/env bash
# resonance-backup-user-cron.sh - User-level backup cron (no root required)
# Usage: ./resonance-backup-user-cron.sh [start|stop|status|run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="/opt/Resonance/data/cubrid/backups"
LOG_DIR="/opt/Resonance/var/log"
PID_FILE="/tmp/resonance-backup.pid"

mkdir -p "$LOG_DIR" "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

run_backup() {
    local backup_type="${1:-full}"
    local git_token="${GIT_TOKEN:-}"

    log "Starting $backup_type backup..."

    if [[ -n "$git_token" ]]; then
        log "Git sync enabled"
        GIT_TOKEN="$git_token" bash "$SCRIPT_DIR/unified-backup.sh" "$backup_type"
    else
        log "Git sync disabled (no token)"
        GIT_TOKEN="" bash "$SCRIPT_DIR/unified-backup.sh" "$backup_type" --no-git
    fi

    log "$backup_type backup completed"
}

start_scheduled() {
    log "Starting scheduled backup daemon..."
    local interval="${1:-3600}"

    nohup bash "$SCRIPT_DIR/resonance-backup-daemon.sh" "$interval" > "$LOG_DIR/backup-daemon.log" 2>&1 &
    echo $! > "$PID_FILE"
    log "Daemon started (PID: $(cat $PID_FILE))"
}

stop_scheduled() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null && log "Daemon stopped (PID: $pid)" || log "Daemon not running"
        rm -f "$PID_FILE"
    else
        log "No daemon running"
    fi
}

case "${1:-run}" in
    start)
        start_scheduled "${2:-3600}"
        ;;
    stop)
        stop_scheduled
        ;;
    status)
        if [[ -f "$PID_FILE" ]]; then
            log "Daemon running (PID: $(cat $PID_FILE))"
        else
            log "Daemon not running"
        fi
        ;;
    full)
        run_backup full
        ;;
    quick)
        run_backup quick
        ;;
    unload)
        run_backup unload
        ;;
    test)
        log "Testing backup..."
        GIT_TOKEN="" bash "$SCRIPT_DIR/unified-backup.sh" quick --no-git
        ;;
    *)
        echo "Usage: $0 [start|stop|status|full|quick|unload|test]"
        ;;
esac