#!/usr/bin/env bash
set -euo pipefail

# Unified management script for Project Runtimes
# Usage: bash ops/scripts/manage-project-runtime.sh [start|stop|restart|status] [PROJECT_ID]

COMMAND="${1:-}"
PROJECT_ID="${2:-}"

if [[ -z "$COMMAND" || -z "$PROJECT_ID" ]]; then
    echo "Usage: $0 [start|stop|restart|status] [PROJECT_ID]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT_DIR/var/run/project-runtime/$PROJECT_ID"
PID_FILE="$RUN_DIR/project-runtime.pid"
MANIFEST_FILE="$ROOT_DIR/data/version-control/project-runtime-manifest.json"

get_port() {
  if [[ -f "$MANIFEST_FILE" ]]; then
    python3 -c "
import json, re
try:
  with open('$MANIFEST_FILE') as f:
    data = json.load(f)
  cmd = data.get('projects', {}).get('$PROJECT_ID', {}).get('runtime', {}).get('bootCommand', '')
  match = re.search(r'--server\.port=(\d+)', cmd)
  print(match.group(1) if match else '18000')
except Exception:
  print('18000')
" 2>/dev/null || echo "18000"
  else
    echo "18000"
  fi
}

status() {
    if [[ -f "$PID_FILE" ]]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "RUNNING (PID: $PID)"
            return 0
        else
            echo "STOPPED (Stale PID file)"
            return 1
        fi
    else
        echo "STOPPED"
        return 1
    fi
}

start() {
    if status > /dev/null; then
        echo "Project $PROJECT_ID is already running."
        return 0
    fi

    local port=$(get_port)
    echo "Starting Project $PROJECT_ID on port $port..."
    # Delegate to the actual start script, running in background using nohup
    nohup bash "$ROOT_DIR/ops/scripts/start-project-runtime.sh" "$PROJECT_ID" "$port" > /dev/null 2>&1 &
    NEW_PID=$!
    
    # Save PID
    mkdir -p "$RUN_DIR"
    echo "$NEW_PID" > "$PID_FILE"
    echo "Started with PID $NEW_PID"
}

stop() {
    if [[ -f "$PID_FILE" ]]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Stopping Project $PROJECT_ID (PID: $PID)..."
            kill "$PID"
            
            # Wait for process to exit
            for i in {1..10}; do
                if ! ps -p "$PID" > /dev/null 2>&1; then
                    break
                fi
                sleep 1
            done
            
            # Force kill if still running
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "Force killing PID $PID..."
                kill -9 "$PID"
            fi
            
            echo "Stopped."
        else
            echo "Process not running."
        fi
        rm -f "$PID_FILE"
    else
        echo "No PID file found. Project $PROJECT_ID is likely stopped."
    fi
}

case "$COMMAND" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo "Usage: $0 [start|stop|restart|status] [PROJECT_ID]"
        exit 1
        ;;
esac
