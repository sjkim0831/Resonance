#!/bin/bash
# Training Runtime Guard - Prevents automatic restart of GPU containers during training

CONTAINER_NAME="tabbyapi-hermes"
LOG_FILE="/opt/Resonance/var/ai-runtime/hermes-learning/container-guard.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

stop_and_guard() {
    log "Stopping $CONTAINER_NAME..."
    sudo docker stop "$CONTAINER_NAME" 2>/dev/null || sudo docker kill "$CONTAINER_NAME" 2>/dev/null
    sleep 1

    FREE_MEM=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader 2>/dev/null | head -1)
    log "GPU memory freed: ${FREE_MEM}MiB"

    if [ "$1" = "watch" ]; then
        log "Watching for restart attempts..."
        while true; do
            sleep 30
            RUNNING=$(sudo docker ps --format "{{.Names}}" 2>/dev/null | grep -w "$CONTAINER_NAME" || echo "")
            if [ -n "$RUNNING" ]; then
                log "Container restarted! Stopping again..."
                sudo docker stop "$CONTAINER_NAME" 2>/dev/null || sudo docker kill "$CONTAINER_NAME" 2>/dev/null
                FREE_MEM=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader 2>/dev/null | head -1)
                log "GPU memory freed: ${FREE_MEM}MiB"
            fi
        done
    fi
}

case "${1:-watch}" in
    stop)
        stop_and_guard
        ;;
    watch)
        log "Starting container guard in watch mode..."
        stop_and_guard watch
        ;;
    status)
        RUNNING=$(sudo docker ps --format "{{.Names}}" 2>/dev/null | grep -w "$CONTAINER_NAME" || echo "")
        if [ -n "$RUNNING" ]; then
            echo "Container $CONTAINER_NAME is RUNNING (GPU blocked)"
        else
            echo "Container $CONTAINER_NAME is STOPPED (GPU available)"
        fi
        nvidia-smi --query-gpu=memory.free,memory.used --format=csv
        ;;
    *)
        echo "Usage: $0 {stop|watch|status}"
        ;;
esac