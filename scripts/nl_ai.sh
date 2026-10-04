#!/bin/bash
# NVIDIA API Natural Language AI Router
# 16개 API 키 병렬 처리
# Usage: nl_ai.sh "<NATURAL_LANGUAGE_REQUEST>"
# Example: nl_ai.sh "emission 테이블 번역해줘"

NVIDIA_API="https://integrate.api.nvidia.com/v1/chat/completions"
MODEL="qwen/qwen3-next-80b-a3b-instruct"

API_KEYS=()
while IFS= read -r __nvidia_key; do
    [ -n "$__nvidia_key" ] && API_KEYS+=("$__nvidia_key")
done < "${NVIDIA_API_KEYS_FILE:-/etc/resonance/secrets/nvidia-api-keys}"

POD="cubrid-carbonet-0"
NS="carbonet-prod"

nvidia_call() {
    local text="$1"
    local key_idx="$2"
    local api_key="${API_KEYS[$key_idx]}"

    curl -s --max-time 30 "$NVIDIA_API" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"$text\"}],\"max_tokens\":200,\"temperature\":0.1}" \
        2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d['choices'][0]['message']['content'].strip())
except:
    print('')
"
}

NATURAL_INPUT="$1"
LOWER_INPUT=$(echo "$NATURAL_INPUT" | tr '[:upper:]' '[:lower:]')

if echo "$LOWER_INPUT" | grep -qE "(번역|translate|translation)"; then
    echo "[Mode: Translation] Processing..."
    BATCH_NUM="${2:-0}"
    bash /opt/Resonance/scripts/parallel_nvidia.sh "$MODEL" "You are a Korean translation expert. Use scientific terminology." "Translate to Korean: {input}" "$BATCH_NUM" 16

elif echo "$LOWER_INPUT" | grep -qE "(요약|summarize|summary)"; then
    echo "[Mode: Summarize] Processing..."
    TARGET="$2"
    PROMPT="Summarize the following text concisely in Korean:"
    nvidia_call "$PROMPT $TARGET" 0

elif echo "$LOWER_INPUT" | grep -qE "(분류|classify|classification)"; then
    echo "[Mode: Classify] Processing..."
    TARGET="$2"
    PROMPT="Classify the following into categories: battery, metal, plastic, energy, agriculture, other. Reply only category name:"
    nvidia_call "$PROMPT $TARGET" 0

elif echo "$LOWER_INPUT" | grep -qE "(코드|code|generation)"; then
    echo "[Mode: Code Generation] Processing..."
    TARGET="$2"
    PROMPT="Generate code for: $TARGET"
    nvidia_call "$PROMPT" 0

elif echo "$LOWER_INPUT" | grep -qE "(rag|벡터|vector|임베딩)"; then
    echo "[Mode: RAG/Vector Data] Processing..."
    bash /opt/Resonance/scripts/build_training_data.sh rag 16

elif echo "$LOWER_INPUT" | grep -qE "(파인|finetune|tune)"; then
    echo "[Mode: Fine-tune Data] Processing..."
    bash /opt/Resonance/scripts/build_training_data.sh finetune 16

elif echo "$LOWER_INPUT" | grep -qE "(사전|glossary)"; then
    echo "[Mode: Glossary] Processing..."
    bash /opt/Resonance/scripts/build_training_data.sh glossary 16

else
    echo "[Mode: General] Processing..."
    nvidia_call "$NATURAL_INPUT" 0
fi