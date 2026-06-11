#!/bin/bash
# NVIDIA API Natural Language AI Router
# 16개 API 키 병렬 처리
# Usage: nl_ai.sh "<NATURAL_LANGUAGE_REQUEST>"
# Example: nl_ai.sh "emission 테이블 번역해줘"

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