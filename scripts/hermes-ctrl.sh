#!/bin/bash
# Hermes Agent Control Script
# Usage: hermes-ctrl.sh [start|stop|status|restart|logs|command] [args]

HERMES_DIR="/opt/Resonance/hermes"
PID_FILE="/opt/Resonance/var/run/hermes.pid"
LOG_FILE="/opt/Resonance/var/logs/hermes/hermes.log"
OUT_DIR="/opt/Resonance/var/ai-runtime/hermes-cli"

source /opt/Resonance/.env 2>/dev/null || true

export ROOT_DIR="/opt/Resonance"
export HERMES_ROOT="$HERMES_DIR"

start() {
    echo "[Hermes] Starting..."
    mkdir -p "$(dirname $PID_FILE)" "$(dirname $LOG_FILE)" "$OUT_DIR"

    cd "$HERMES_DIR"

    cd "$HERMES_DIR"

    HERMES_BIN="python3 $HERMES_DIR/hermes"

    nohup bash -c "
        export ROOT_DIR=/opt/Resonance
        export HERMES_ROOT=$HERMES_DIR
        cd $HERMES_DIR
        $HERMES_BIN gateway --port 24456 >> $LOG_FILE 2>&1
    " > /dev/null 2>&1 &

    echo $! > $PID_FILE
    echo "[Hermes] Started PID: $(cat $PID_FILE)"
}

stop() {
    echo "[Hermes] Stopping..."
    if [ -f "$PID_FILE" ]; then
        kill $(cat $PID_FILE) 2>/dev/null || true
        rm -f $PID_FILE
    fi
    pkill -f "hermes.*gateway" 2>/dev/null || true
    echo "[Hermes] Stopped"
}

status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat $PID_FILE)
        if ps -p $PID > /dev/null 2>&1; then
            echo "[Hermes] Running PID: $PID"
            return 0
        fi
    fi

    if pgrep -f "hermes.*gateway" > /dev/null; then
        echo "[Hermes] Running (found by pgrep)"
        return 0
    fi

    echo "[Hermes] Not running"
    return 1
}

restart() {
    stop
    sleep 2
    start
}

logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -50 $LOG_FILE
    else
        echo "No log file found"
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    command|"")
        shift
        cd "$HERMES_DIR"
        exec python3 "$HERMES_DIR/hermes" "$@"
        ;;
    *)
        echo "Usage: hermes-ctrl.sh [start|stop|status|restart|logs|command]"
        exit 1
        ;;
esac