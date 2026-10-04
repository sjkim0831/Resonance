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

API_KEYS=()
while IFS= read -r __nvidia_key; do
    [ -n "$__nvidia_key" ] && API_KEYS+=("$__nvidia_key")
done < "${NVIDIA_API_KEYS_FILE:-/etc/resonance/secrets/nvidia-api-keys}"

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