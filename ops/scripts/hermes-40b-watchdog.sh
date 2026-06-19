#!/bin/bash
# Hermes 40B GGUF Server Watchdog

LOG="/opt/Resonance/var/ai-runtime/hermes-learning/hermes-8081-watchdog.log"
PIDFILE="/tmp/hermes-40b-gguf.pid"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG"
}

kill_python3() {
    # Kill any python3 processes using GPU
    PIDS=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader 2>/dev/null | awk -F, '{print $1}')
    if [ -n "$PIDS" ]; then
        for pid in $PIDS; do
            sudo kill -9 $pid 2>/dev/null
        done
        sleep 0.5
    fi
}

check_and_restart() {
    if ! curl -s --max-time 5 http://127.0.0.1:8081/health > /dev/null 2>&1; then
        log "Server down, restarting..."

        # Kill existing process
        if [ -f "$PIDFILE" ]; then
            OLD_PID=$(cat "$PIDFILE")
            kill "$OLD_PID" 2>/dev/null
        fi

        # Kill python3 to free GPU
        kill_python3

        # Start new server
        nohup /opt/util/ai/vLLM/llama.cpp-tq3/build/bin/llama-server \
          -m /opt/util/ai/vLLM/models/qwen3.6-40b-deck-opus-neo-code-q4_k_m/*.gguf \
          -a qwen3.6-40b-hermes \
          --host 127.0.0.1 --port 8081 \
          --api-key qwer1234 \
          -ngl 60 \
          -c 100000 \
          -np 1 \
          --jinja \
          --metrics \
          --slots \
          > /opt/Resonance/var/ai-runtime/hermes-learning/hermes-8081.log 2>&1 &

        echo $! > "$PIDFILE"
        log "Restarted with PID $(cat $PIDFILE)"

        # Wait for server to be ready
        for i in {1..90}; do
            if curl -s --max-time 5 http://127.0.0.1:8081/health > /dev/null 2>&1; then
                log "Server is ready"
                return 0
            fi
            sleep 2
        done

        log "Server failed to start within 180 seconds"
        return 1
    fi
    return 0
}

log "Watchdog started"

# Initial startup
if ! curl -s --max-time 5 http://127.0.0.1:8081/health > /dev/null 2>&1; then
    log "Initial start..."

    # Kill python3 to free GPU
    kill_python3

    nohup /opt/util/ai/vLLM/llama.cpp-tq3/build/bin/llama-server \
      -m /opt/util/ai/vLLM/models/qwen3.6-40b-deck-opus-neo-code-q4_k_m/*.gguf \
      -a qwen3.6-40b-hermes \
      --host 127.0.0.1 --port 8081 \
      --api-key qwer1234 \
      -ngl 60 \
      -c 100000 \
      -np 1 \
      --jinja \
      --metrics \
      --slots \
      > /opt/Resonance/var/ai-runtime/hermes-learning/hermes-8081.log 2>&1 &
    echo $! > "$PIDFILE"
    sleep 180
fi

# Main loop
while true; do
    check_and_restart
    sleep 30
done