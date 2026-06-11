#!/bin/bash
# NVIDIA Parallel API Execute Script
# Usage: parallel_nvidia.sh <MODEL> "<SYSTEM_PROMPT>" "<USER_TEMPLATE>" <BATCH_NUM> <TOTAL_BATCHES>
# Example: parallel_nvidia.sh "qwen/qwen3-next-80b-a3b-instruct" "You are a Korean translator." "Translate to Korean: {input}" 0 16

MODEL="$1"
SYSTEM_PROMPT="${2:-You are a helpful assistant.}"
USER_TEMPLATE="${3:-{input}}"
BATCH_NUM="${4:-0}"
TOTAL_BATCHES="${5:-1}"

API_URL="https://integrate.api.nvidia.com/v1/chat/completions"

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

csql() {
    kubectl -n $NS exec $POD -- csql -u 'dba' 'carbonet' -c "$1" 2>/dev/null
}

translate() {
    local text="$1"
    local api_key="$2"

    local user_content="${USER_TEMPLATE//\{input\}/$text}"

    curl -s --max-time 30 "$API_URL" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg model "$MODEL" \
            --arg system "$SYSTEM_PROMPT" \
            --arg user "$user_content" \
            '{
                model: $model,
                messages: [
                    {role: "system", content: $system},
                    {role: "user", content: $user}
                ],
                max_tokens: 200,
                temperature: 0.1
            }')" 2>/dev/null
}

echo "[Batch $BATCH_NUM] Starting with API: ${API_KEYS[$BATCH_NUM]:0:20}..."
echo "Model: $MODEL"

kubectl -n $NS exec $POD -- csql -u 'dba' 'carbonet' -c "SELECT DISTINCT english_name FROM emission_material_translation WHERE korean_name IS NULL;" > /tmp/names_batch_$BATCH_NUM.txt 2>/dev/null

count=0
success=0
api_key="${API_KEYS[$BATCH_NUM]}"

while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*\'(.+)\'[[:space:]]*$ ]]; then
        name="${BASH_REMATCH[1]}"
        idx=$((count % TOTAL_BATCHES))
        if [ $idx -eq $BATCH_NUM ]; then
            result=$(translate "$name" "$api_key")
            korean=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'].strip())" 2>/dev/null)

            if [ -n "$korean" ] && [ "$korean" != "ERROR" ] && [ "$korean" != "null" ]; then
                escaped_name=$(echo "$name" | sed "s/'/''/g")
                escaped_korean=$(echo "$korean" | sed "s/'/''/g")
                csql "UPDATE emission_material_translation SET korean_name = '$escaped_korean', last_updt_pnttm = CURRENT_DATETIME WHERE english_name = '$escaped_name';"
                success=$((success + 1))
            fi
            echo "[$count] $name -> $korean"
        fi
        count=$((count + 1))
    fi
done < /tmp/names_batch_$BATCH_NUM.txt

echo "배치 $BATCH_NUM 완료: $success/$count개 번역 성공"
rm -f /tmp/names_batch_$BATCH_NUM.txt