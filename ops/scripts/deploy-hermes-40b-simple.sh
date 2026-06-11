#!/bin/bash
# Hermes 40B System - Using Hermes Prompt with Q4_K_M GGUF

MODEL_PATH="/opt/util/ai/vLLM/models/qwen3.6-40b-deck-opus-neo-code-q4_k_m/Qwen3.6-40B-Deck-Opus-NEO-CODE-HERE-2T-OT-Q4_K_M.gguf"
PORT="${PORT:-8080}"
API_KEY="${API_KEY:-qwer1234}"
LOG_DIR="/opt/Resonance/var/ai-runtime/hermes-learning"

HERMES_SYSTEM_PROMPT="You are Hermes-Carbonet, a senior Korean-speaking agent for the Resonance Carbonet framework. You understand the local codebase, Hermes Agent, Kubernetes deployment, AI model routing, recovery, and safe operations. Answer with concrete file paths, cautious execution steps, and verification evidence."

echo "=========================================="
echo "Hermes 40B System Deployment"
echo "=========================================="
echo "Model: Qwen3.6-40B Deck Opus (Q4_K_M)"
echo "Port: $PORT"
echo "=========================================="

# Check GPU
FREE_MEM=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader 2>/dev/null | head -1 | tr -d ' MiB')
echo "GPU free memory: ${FREE_MEM}MiB"

if [ "$FREE_MEM" -lt 20000 ]; then
    echo "ERROR: Not enough GPU memory. Need at least 20GB, have ${FREE_MEM}MiB"
    exit 1
fi

# Stop existing servers
pkill -f "llama-server.*8080" 2>/dev/null || true
sleep 2

# Start Hermes server
echo "Starting Hermes server with system prompt..."

cd /opt/util/ai/vLLM/llama.cpp-tq3/build

export CUDA_VISIBLE_DEVICES=0

nohup ./bin/llama-server \
    -m "$MODEL_PATH" \
    --host 127.0.0.1 \
    --port $PORT \
    --api-key $API_KEY \
    -ngl 99 \
    -c 32768 \
    -np 2 \
    -tb 16 \
    --jinja \
    --metrics \
    --log-disable \
    > "$LOG_DIR/hermes-server-$(date +%Y%m%d-%H%M%S).log" 2>&1 &

SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for startup
sleep 15

# Check if running
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo ""
    echo "=========================================="
    echo "Hermes 40B Server Running!"
    echo "=========================================="
    echo "URL: http://127.0.0.1:$PORT"
    echo "API Key: $API_KEY"
    echo ""

    # Health check
    echo "Testing health endpoint..."
    curl -s -H "Authorization: Bearer $API_KEY" "http://127.0.0.1:$PORT/health" | head -5 || echo "Health check pending..."

    echo ""
    echo "Test chat completion:"
    curl -s -X POST "http://127.0.0.1:$PORT/v1/chat/completions" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "hermes-40b",
            "messages": [
                {"role": "system", "content": "'"$HERMES_SYSTEM_PROMPT"'"},
                {"role": "user", "content": "안녕하세요, 당신은 누구인가요?"}
            ],
            "max_tokens": 200
        }' | head -100

    echo ""
    echo "=========================================="
    echo "Log: $LOG_DIR/hermes-server-*.log"
else
    echo "ERROR: Failed to start server"
    tail -30 "$LOG_DIR"/hermes-server-*.log 2>/dev/null | tail -20
    exit 1
fi