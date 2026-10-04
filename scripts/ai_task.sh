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

API_KEYS=()
while IFS= read -r __nvidia_key; do
    [ -n "$__nvidia_key" ] && API_KEYS+=("$__nvidia_key")
done < "${NVIDIA_API_KEYS_FILE:-/etc/resonance/secrets/nvidia-api-keys}"

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