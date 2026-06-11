#!/bin/bash
# Monitor training and deploy when complete

TRAIN_LOG="/opt/Resonance/var/ai-runtime/hermes-learning/training-extra-500-20260611-080927.log"
DEPLOY_SCRIPT="/opt/Resonance/ops/scripts/deploy-hermes-40b.sh"
CHECK_INTERVAL=60

echo "Monitoring training progress..."
echo "Log: $TRAIN_LOG"

while true; do
    if [ ! -f "$TRAIN_LOG" ]; then
        echo "Log file not found, waiting..."
        sleep $CHECK_INTERVAL
        continue
    fi

    # Check if training process is running
    if ! pgrep -f "train_qlora.py" > /dev/null; then
        echo "Training process not running"

        # Check final adapter exists
        FINAL_ADAPTER="/opt/util/ai/fine-tuning/hermes-framework-40b-qlora/outputs/hermes-framework-40b-qlora/final"
        if [ -f "$FINAL_ADAPTER/adapter_model.safetensors" ]; then
            echo "Training completed! Final adapter exists."
            echo ""
            echo "=========================================="
            echo "Starting deployment..."
            echo "=========================================="
            bash "$DEPLOY_SCRIPT"
            break
        else
            echo "Training may have failed. Check log."
            tail -30 "$TRAIN_LOG"
            break
        fi
    fi

    # Show progress
    TAIL=$(tail -5 "$TRAIN_LOG" 2>/dev/null | grep -E "it/s|step" | tail -1)
    if [ -n "$TAIL" ]; then
        echo "[$(date '+%H:%M:%S')] $TAIL"
    fi

    sleep $CHECK_INTERVAL
done