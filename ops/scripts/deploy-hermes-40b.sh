#!/bin/bash
# Hermes 40B QLoRA + EXL3 Deployment Script

set -euo pipefail

MODEL_DIR="/opt/util/ai/vLLM/models/qwen3.6-40b-hermes-framework-exl3-4.0bpw"
LORA_DIR="/opt/util/ai/fine-tuning/hermes-framework-40b-qlora/outputs/hermes-framework-40b-qlora/final"
PORT="${PORT:-8080}"
API_KEY="${API_KEY:-qwer1234}"
LOG_DIR="/opt/Resonance/var/ai-runtime/hermes-learning"

echo "=========================================="
echo "Hermes 40B EXL3 + LoRA Deployment"
echo "=========================================="
echo "Model: $MODEL_DIR"
echo "LoRA: $LORA_DIR"
echo "Port: $PORT"
echo "=========================================="

# Check if files exist
if [ ! -d "$MODEL_DIR" ]; then
    echo "ERROR: Model not found at $MODEL_DIR"
    exit 1
fi

if [ ! -d "$LORA_DIR" ]; then
    echo "ERROR: LoRA not found at $LORA_DIR"
    exit 1
fi

# Check GPU
FREE_MEM=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader 2>/dev/null | head -1 | tr -d ' MiB')
echo "GPU free memory: ${FREE_MEM}MiB"

if [ "$FREE_MEM" -lt 20000 ]; then
    echo "WARNING: Not enough GPU memory. Need at least 20GB"
    exit 1
fi

# Stop existing llama-server if running
pkill -f "qwen3.6-40b-hermes" 2>/dev/null || true
sleep 2

# Start llama-server with LoRA
echo "Starting llama-server with LoRA adapter..."
cd /opt/util/ai/vLLM/llama.cpp-tq3/build

export CUDA_VISIBLE_DEVICES=0

nohup ./bin/llama-server \
    -m "$MODEL_DIR" \
    --lora "$LORA_DIR" \
    -a qwen3.6-40b-hermes \
    --host 127.0.0.1 \
    --port $PORT \
    --api-key $API_KEY \
    -ngl 99 \
    -c 32768 \
    -np 2 \
    -tb 16 \
    --jinja \
    --metrics \
    > "$LOG_DIR/llama-server-$(date +%Y%m%d-%H%M%S).log" 2>&1 &

LLAMA_PID=$!
echo "llama-server PID: $LLAMA_PID"

# Wait for startup
sleep 10

# Check if running
if ps -p $LLAMA_PID > /dev/null 2>&1; then
    echo "=========================================="
    echo "Deployment successful!"
    echo "=========================================="
    echo "Model: Qwen3.6-40B Hermes Framework (4bit EXL3)"
    echo "LoRA: hermes-framework-40b-qlora (200 steps)"
    echo "URL: http://127.0.0.1:$PORT"
    echo "API Key: $API_KEY"
    echo "=========================================="

    # Health check
    curl -s -H "Authorization: Bearer $API_KEY" "http://127.0.0.1:$PORT/health" | head -20 || echo "Health check pending..."

    echo ""
    echo "Log: $LOG_DIR/llama-server-*.log"
else
    echo "ERROR: Failed to start llama-server"
    exit 1
fi