#!/bin/bash

# Independent Startup Script for Carbonet Runtimes
# Usage: ./startup.sh {project-runtime|operations-console} {start|stop|status} [project-id]

TYPE=$1
ACTION=$2
PROJECT_ID=$3

BASE_DIR="/opt/Resonance"
RUN_DIR="${BASE_DIR}/var/run"
JAR_PATH=""
PID_FILE=""
LOG_FILE=""

if [ "$TYPE" == "project-runtime" ]; then
    if [ -z "$PROJECT_ID" ]; then
        PROJECT_ID="default"
    fi
    JAR_PATH="${BASE_DIR}/apps/project-runtime/target/project-runtime.jar"
    PID_DIR="${RUN_DIR}/project-runtime/${PROJECT_ID}"
    PID_FILE="${PID_DIR}/project-runtime.pid"
    LOG_FILE="${BASE_DIR}/var/logs/project-runtime-${PROJECT_ID}.log"
elif [ "$TYPE" == "operations-console" ]; then
    JAR_PATH="${BASE_DIR}/apps/operations-console/target/operations-console.jar"
    PID_DIR="${RUN_DIR}/operations-console"
    PID_FILE="${PID_DIR}/operations-console.pid"
    LOG_FILE="${BASE_DIR}/var/logs/operations-console.log"
else
    echo "Usage: $0 {project-runtime|operations-console} {start|stop|status} [project-id]"
    exit 1
fi

mkdir -p "$(dirname "$PID_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

case "$ACTION" in
    start)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null; then
                echo "$TYPE is already running (PID: $PID)"
                exit 0
            fi
        fi
        echo "Starting $TYPE..."
        nohup java -jar "$JAR_PATH" > "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
        echo "$TYPE started with PID: $(cat "$PID_FILE")"
        ;;
    stop)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            echo "Stopping $TYPE (PID: $PID)..."
            kill "$PID"
            rm "$PID_FILE"
            echo "$TYPE stopped."
        else
            echo "$TYPE is not running (PID file not found)."
        fi
        ;;
    status)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null; then
                echo "$TYPE is running (PID: $PID)"
            else
                echo "$TYPE is not running (stale PID file found)."
            fi
        else
            echo "$TYPE is not running."
        fi
        ;;
    *)
        echo "Usage: $0 $TYPE {start|stop|status} [project-id]"
        exit 1
        ;;
esac
