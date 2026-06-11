#!/bin/bash
# AI Task Router with NVIDIA API 16 Keys
# Usage: ai_task.sh <ACTION> <ROUTE> [BATCH_NUM]
# Example: ai_task.sh translate /emission 0
# Example: ai_task.sh summarize /material 0
# Example: ai_task.sh classify /carbon 0

ACTION="$1"
ROUTE="$2"
BATCH_NUM="${3:-0}"
TOTAL_BATCHES=16

NVIDIA_API="https://integrate.api.nvidia.com/v1/chat/completions"
MODEL="qwen/qwen3-next-80b-a3b-instruct"

API_KEYS=(
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
    "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"
)

POD="cubrid-carbonet-0"
NS="carbonet-prod"

ROUTING_TABLE=(
    "/emission|/material_translation"
    "/carbon|/carbon_data"
    "/material|/material_data"
    "/product|/product_data"
)

case "$ACTION" in
    translate)
        bash /opt/Resonance/scripts/parallel_nvidia.sh "$MODEL" \
            "You are a Korean translation expert. Use scientific terminology." \
            "Translate to Korean: {input}" "$BATCH_NUM" "$TOTAL_BATCHES"
        ;;
    summarize)
        python3 << PYEOF
import subprocess, json
api_key = "${API_KEYS[$BATCH_NUM]}"
target = "$ROUTE"
prompt = f"Summarize concisely in Korean: {target}"
result = subprocess.run([
    "curl", "-s", "--max-time", "30", NVIDIA_API,
    "-H", f"Authorization: Bearer {api_key}",
    "-H", "Content-Type: application/json",
    "-d", json.dumps({"model": MODEL, "messages": [{"role":"user","content":prompt}], "max_tokens": 200})
], capture_output=True, text=True)
data = json.loads(result.stdout)
print(data["choices"][0]["message"]["content"])
PYEOF
        ;;
    classify)
        echo "Classifying route: $ROUTE"
        ;;
    rag)
        bash /opt/Resonance/scripts/build_training_data.sh rag "$TOTAL_BATCHES"
        ;;
    vector)
        bash /opt/Resonance/scripts/build_training_data.sh vector "$TOTAL_BATCHES"
        ;;
    finetune)
        bash /opt/Resonance/scripts/build_training_data.sh finetune "$TOTAL_BATCHES"
        ;;
    all)
        bash /opt/Resonance/scripts/build_training_data.sh all "$TOTAL_BATCHES"
        ;;
    *)
        echo "Usage: ai_task.sh <translate|summarize|classify|rag|vector|finetune|all> <ROUTE> [BATCH_NUM]"
        ;;
esac