#!/bin/bash
# Hermes 40B Training Launcher with Container Guard

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/util/ai/fine-tuning/hermes-framework-40b-qlora}"
LOG_DIR="/opt/Resonance/var/ai-runtime/hermes-learning"
GUARD_SCRIPT="/opt/Resonance/ops/scripts/training-container-guard.sh"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TRAIN_LOG="${LOG_DIR}/training-${TIMESTAMP}.log"

echo "=========================================="
echo "Hermes 40B Training Launcher"
echo "=========================================="

# Check GPU availability
FREE_MEM=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader 2>/dev/null | head -1 | tr -d ' MiB')
echo "Current GPU free memory: ${FREE_MEM}MiB"

if [ "$FREE_MEM" -lt 20000 ]; then
    echo "ERROR: Not enough GPU memory. Need at least 20GB, have ${FREE_MEM}MiB"
    echo "Run '$GUARD_SCRIPT stop' first"
    exit 1
fi

# Start container guard in background
echo "Starting container guard..."
$GUARD_SCRIPT stop > "${LOG_DIR}/guard-${TIMESTAMP}.log" 2>&1 &

# Wait a moment for guard to stabilize
sleep 5

# Verify GPU is still free
FREE_MEM_AFTER=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader 2>/dev/null | head -1 | tr -d ' MiB')
if [ "$FREE_MEM_AFTER" -lt 20000 ]; then
    echo "ERROR: GPU memory dropped to ${FREE_MEM_AFTER}MiB after guard start"
    exit 1
fi

# Start training
echo "Starting training (log: $TRAIN_LOG)..."
echo "=========================================="

cd "$ROOT_DIR"
export CUDA_VISIBLE_DEVICES=0
export PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True"

nohup bash scripts/run_40b_full_pipeline.sh >> "$TRAIN_LOG" 2>&1 &
TRAIN_PID=$!

echo "Training PID: $TRAIN_PID"
echo "Log: $TRAIN_LOG"
echo "=========================================="

# Wait for training to start
sleep 10

# Check if training is running
if ps -p $TRAIN_PID > /dev/null 2>&1; then
    echo "Training is running..."
    tail -20 "$TRAIN_LOG"
else
    echo "Training failed to start. Check log: $TRAIN_LOG"
    tail -50 "$TRAIN_LOG"
    exit 1
fi

echo ""
echo "Training started successfully!"
echo "Monitor with: tail -f $TRAIN_LOG"
echo "Stop guard with: pkill -f training-container-guard"