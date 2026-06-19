#!/bin/bash
#============================================================
# CUBRID 실시간 데이터 동기화 (5초마다 증분 덤프)
# 서버가 내려가도 마지막 시점 데이터 보존
#============================================================
set -euo pipefail

# CUBRID=/tmp/CUBRID-11.4.5.1866-e9c17f7-Linux.x86_64  # DEPRECATED
CUBRID=/home/cubrid/CUBRID  # Actual running instance
export PATH=$CUBRID/bin:$PATH
export CUBRID_DB_DIR=/opt/Resonance/data/cubrid

ARCHIVE_DIR="/opt/Resonance/data/cubrid/archive"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
LOG_FILE="/opt/Resonance/var/ai-runtime/live-sync.log"
PID_FILE="/var/run/cubrid-live-sync.pid"

INTERVAL=5
DB_NAME="carbonet"
DB_HOST="${CUBRID_HOST:-localhost}"
DB_PORT="${CUBRID_PORT:-33000}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

get_tables() {
    csql -u dba -c "SHOW TABLES;" ${DB_NAME}@${DB_HOST}:${DB_PORT} 2>/dev/null | grep -v "^>" | grep -v "^--" | grep -E "^[a-zA-Z_]" | awk '{print $NF}' | grep -v "^[0-9]*" || echo ""
}

dump_table() {
    local table=$1
    local outfile="$ARCHIVE_DIR/${table}_live.sql"
    local tmpfile="$ARCHIVE_DIR/.${table}_live.sql.tmp"

    csql -u dba -c "SELECT * FROM $table;" ${DB_NAME}@${DB_HOST}:${DB_PORT} 2>/dev/null | \
        grep -v "^>" | grep -v "^--" | grep -v "^$" > "$tmpfile" || return 1

    if [ -s "$tmpfile" ]; then
        echo "-- Dumped: $(date -Iseconds)" > "$outfile"
        echo "-- Table: $table" >> "$outfile"
        cat "$tmpfile" >> "$outfile"
        rm "$tmpfile"
        return 0
    fi
    rm -f "$tmpfile"
    return 1
}

full_dump() {
    log "Starting full dump..."
    mkdir -p "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"

    local tables=$(get_tables)
    local count=0

    for table in $tables; do
        if dump_table "$table"; then
            ((count++))
            log "  Dumped: $table"
        fi
    done

    log "Full dump complete: $count tables"
    echo $count
}

start_live_sync() {
    log "Starting live sync (interval: ${INTERVAL}s)"

    while true; do
        local tables=$(get_tables)
        local count=0

        for table in $tables; do
            if dump_table "$table" 2>/dev/null; then
                ((count++))
            fi
        done

        log "Sync tick: $count tables dumped"
        sleep $INTERVAL
    done
}

daemonize() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Already running (PID: $pid)"
            return 1
        fi
    fi

    nohup bash "$0" live >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    log "Daemon started (PID: $(cat $PID_FILE))"
}

stop() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null && log "Stopped (PID: $pid)"
        rm -f "$PID_FILE"
    else
        echo "Not running"
    fi
}

case "${1:-full}" in
    full)
        full_dump
        ;;
    live)
        start_live_sync
        ;;
    start)
        daemonize
        ;;
    stop)
        stop
        ;;
    status)
        if [ -f "$PID_FILE" ]; then
            local pid=$(cat "$PID_FILE")
            if kill -0 "$pid" 2>/dev/null; then
                echo "Running (PID: $pid)"
            else
                echo "Stale PID file"
            fi
        else
            echo "Not running"
        fi
        ;;
    *)
        echo "Usage: $0 {full|live|start|stop|status}"
        ;;
esac