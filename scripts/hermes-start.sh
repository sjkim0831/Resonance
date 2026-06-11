#!/bin/bash
# Hermes Gateway Auto-start Script
# Usage: ./hermes-start.sh [start|stop|restart|status]

HERMES_DIR="/opt/Resonance/hermes"
LOG_DIR="/opt/Resonance/var/logs/hermes"
PID_FILE="/opt/Resonance/var/run/hermes-gateway.pid"
PORT=24456
HOST="0.0.0.0"

mkdir -p "$LOG_DIR" "$(dirname $PID_FILE)"

start() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "Hermes Gateway already running (PID: $(cat $PID_FILE))"
        return
    fi
    echo "Starting Hermes Gateway on $HOST:$PORT..."
    cd "$HERMES_DIR"
    nohup python3 hermes gateway --port $PORT --host $HOST > "$LOG_DIR/gateway.log" 2>&1 &
    echo $! > "$PID_FILE"
    echo "Started (PID: $(cat $PID_FILE))"
}

stop() {
    if [ -f "$PID_FILE" ]; then
        echo "Stopping Hermes Gateway (PID: $(cat $PID_FILE))..."
        kill $(cat "$PID_FILE") 2>/dev/null || true
        rm -f "$PID_FILE"
    fi
    pkill -f "hermes.*gateway.*$PORT" 2>/dev/null || true
    echo "Stopped"
}

status() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "Running (PID: $(cat $PID_FILE))"
        return 0
    fi
    if pgrep -f "hermes.*gateway" > /dev/null; then
        echo "Running (found by pgrep)"
        return 0
    fi
    echo "Not running"
    return 1
}

case "$1" in
    start) start ;;
    stop) stop ;;
    restart) stop; sleep 2; start ;;
    status) status ;;
    *) echo "Usage: $0 {start|stop|restart|status}" ;;
esac
