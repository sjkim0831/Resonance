#!/usr/bin/env bash
# File Watch Daemon for Hot Reload
# Watches source files and triggers auto-deploy on changes
# Usage: bash resonance-file-watch.sh [start|stop|status|test]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_FILE="$ROOT_DIR/.file-watch.pid"
LOG_FILE="$ROOT_DIR/var/logs/file-watch.log"
DEBOUNCE_SECONDS="${DEBOUNCE_SECONDS:-3}"
INOTIFY_WAIT="${INOTIFY_WAIT:-inotifywait}"

mkdir -p "$(dirname "$LOG_FILE")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*" | tee -a "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $*" | tee -a "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"; }

WATCH_PATHS=(
    "$ROOT_DIR/projects/carbonet-frontend/source"
    "$ROOT_DIR/projects/carbonet-frontend/src"
    "$ROOT_DIR/apps/carbonet-api/src"
    "$ROOT_DIR/modules"
    "$ROOT_DIR/projects/carbonet-adapter/src"
)

EXCLUDE_DIRS="--exclude 'node_modules' --exclude 'dist' --exclude 'target' --exclude '.git' --exclude '*.log' --exclude '*.class'"

check_inotify() {
    if command -v inotifywait &>/dev/null; then
        INOTIFY_WAIT="inotifywait"
        return 0
    fi
    
    if command -v fswatch &>/dev/null; then
        INOTIFY_WAIT="fswatch"
        return 0
    fi
    
    return 1
}

start_daemon() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo -e "${YELLOW}[WARN]${NC} File watch daemon already running (PID: $(cat "$PID_FILE"))"
        return 1
    fi

    if ! check_inotify; then
        log_warn "No file watcher available. Installing inotify-tools..."
        sudo apt-get update -qq && sudo apt-get install -y -qq inotify-tools >/dev/null 2>&1 || {
            log_warn "Cannot install inotify-tools. Using polling mode."
            start_polling_daemon
            return
        }
        INOTIFY_WAIT="inotifywait"
    fi

    log "Starting file watch daemon..."
    log "Watching paths: ${WATCH_PATHS[*]}"
    log "Debounce: ${DEBOUNCE_SECONDS}s"

    (
        LAST_TRIGGER=0
        while true; do
            if [ "$INOTIFY_WAIT" = "inotifywait" ]; then
                # inotifywait returns on events; wrap with timeout polling
                inotifywait -r -q -e modify,create,delete,move $EXCLUDE_DIRS "${WATCH_PATHS[@]}" 2>/dev/null &
                WATCH_PID=$!
            else
                # fswatch mode
                fswatch -r $EXCLUDE_DIRS "${WATCH_PATHS[@]}" 2>/dev/null &
                WATCH_PID=$!
            fi

            # Wait for either a change event or timeout
            sleep "$DEBOUNCE_SECONDS"
            
            # Check if any changes occurred
            if kill -0 $WATCH_PID 2>/dev/null; then
                kill $WATCH_PID 2>/dev/null || true
                CURRENT_TIME=$(date +%s)
                if [ $((CURRENT_TIME - LAST_TRIGGER)) -ge $DEBOUNCE_SECONDS ]; then
                    log "Change detected, triggering deploy..."
                    LAST_TRIGGER=$CURRENT_TIME
                    bash "$ROOT_DIR/ops/scripts/resonance-v3-deploy.sh" >> "$LOG_FILE" 2>&1 || {
                        log_warn "Deploy failed, will retry on next change"
                    }
                fi
            fi
        done
    ) &

    echo $! > "$PID_FILE"
    log_ok "File watch daemon started (PID: $(cat "$PID_FILE"))"
}

start_polling_daemon() {
    log "Starting polling-based file watch (fallback mode)..."
    
    (
        LAST_MD5=""
        while true; do
            sleep "$DEBOUNCE_SECONDS"
            
            # Quick hash of key files
            CURRENT_MD5=$(find "${WATCH_PATHS[@]}" -type f \( -name "*.java" -o -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" \) -mmin -1 2>/dev/null | sort | md5sum 2>/dev/null | cut -d' ' -f1)
            
            if [ -n "$CURRENT_MD5" ] && [ "$CURRENT_MD5" != "$LAST_MD5" ]; then
                LAST_MD5="$CURRENT_MD5"
                log "Change detected, triggering deploy..."
                bash "$ROOT_DIR/ops/scripts/resonance-v3-deploy.sh" >> "$LOG_FILE" 2>&1 || {
                    log_warn "Deploy failed, will retry on next change"
                }
            fi
        done
    ) &

    echo $! > "$PID_FILE"
    log_ok "Polling daemon started (PID: $(cat "$PID_FILE"))"
}

stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
            sleep 1
            kill -9 "$PID" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
        log_ok "File watch daemon stopped"
    else
        echo "No PID file found"
    fi
}

status_daemon() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo -e "${GREEN}[RUNNING]${NC} File watch daemon (PID: $(cat "$PID_FILE"))"
        echo "Log: $LOG_FILE"
        tail -10 "$LOG_FILE" 2>/dev/null || true
    else
        echo -e "${YELLOW}[STOPPED]${NC} File watch daemon not running"
    fi
}

test_watch() {
    log "Testing file watcher..."
    if check_inotify; then
        log_ok "File watcher available: $INOTIFY_WAIT"
    else
        log_warn "No file watcher (inotifywait/fswatch) available"
    fi
    log "Watch paths:"
    for path in "${WATCH_PATHS[@]}"; do
        if [ -d "$path" ]; then
            log "  ✓ $path"
        else
            log_warn "  ✗ $path (not found)"
        fi
    done
}

case "${1:-start}" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        status_daemon
        ;;
    test)
        test_watch
        ;;
    *)
        echo "Usage: $0 [start|stop|status|test]"
        exit 1
        ;;
esac