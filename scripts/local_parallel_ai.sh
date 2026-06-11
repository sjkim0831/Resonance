#!/bin/bash
# Advanced Local Parallel Translation with Quality Control
# Usage: local_parallel_ai.sh [BATCH_SIZE] [VOTING_THRESHOLD]
# Example: local_parallel_ai.sh 100 2

BATCH_SIZE="${1:-50}"
VOTING_THRESHOLD="${2:-2}"

GPU_FREE=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader | awk '{print $1}')
GPU_TOTAL=32607
MODEL_MEMORY=4500  # ~4.5GB per 7B model in Q4

# Calculate max parallel instances
MAX_INSTANCES=1
if [ $GPU_FREE -gt 12000 ]; then
    MAX_INSTANCES=3
elif [ $GPU_FREE -gt 8000 ]; then
    MAX_INSTANCES=2
fi

echo "=== Local Parallel AI with Quality Control ==="
echo "GPU Free: ${GPU_FREE}MB"
echo "Max Parallel Instances: $MAX_INSTANCES"

# Model paths (priority order)
MODELS=(
    "/opt/util/ai/vLLM/models/qwen2.5-coder-7b-q4_k_m/Qwen2.5-Coder-7B-Q4_K_M.gguf"
    "/opt/util/ai/vLLM/models/qwen3.5-9b-q4_k_m/Qwen3.5-9B-Q4_K_M.gguf"
    "/opt/util/ai/vLLM/models/gemma4-e4b-q4_k_m/Gemma4-E4B-q4_k_m.gguf"
)

# Ports for each model server
PORTS=(24941 24942 24943 24944 24945 24946)

# API fallback keys
API_KEYS=(
    "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"
    "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"
    "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"
)
NVIDIA_API="https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_MODEL="qwen/qwen3-next-80b-a3b-instruct"

POD="cubrid-carbonet-0"
NS="carbonet-prod"

# ============================================================================
# Functions
# ============================================================================

start_model_server() {
    local idx=$1
    local model_path=$2
    local port=${PORTS[$idx]}

    # Kill existing on that port
    pkill -f "llama-server.*port $port" 2>/dev/null
    sleep 1

    nohup /opt/util/ai/vLLM/llama.cpp-tq3/build/bin/llama-server \
        -m "$model_path" \
        -a model_$idx \
        --host 127.0.0.1 --port $port \
        --api-key local123 \
        -c 256 -np 1 -t 4 \
        --reasoning off > /tmp/llama_$idx.log 2>&1 &

    echo "Started model $idx on port $port"
    sleep 3
}

csql() {
    kubectl -n $NS exec $POD -- csql -u 'dba' 'carbonet' -c "$1" 2>/dev/null
}

# Translate using local model
local_translate() {
    local term="$1"
    local port=$2
    local api_key="local123"

    curl -s --max-time 15 "http://127.0.0.1:$port/v1/chat/completions" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"model_$port\",\"messages\":[{\"role\":\"user\",\"content\":\"Translate to Korean: $term\"}],\"max_tokens\":100,\"temperature\":0.1}" \
        2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    c=d.get('choices',[{}])[0].get('message',{}).get('content','') or d.get('choices',[{}])[0].get('message',{}).get('reasoning_content','')
    print(c.strip())
except:
    print('')
" 2>/dev/null
}

# Translate using NVIDIA API (fallback)
nvidia_translate() {
    local term="$1"
    local api_key=$2

    curl -s --max-time 15 "$NVIDIA_API" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$NVIDIA_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Translate to Korean: $term\"}],\"max_tokens\":100}" \
        2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d['choices'][0]['message']['content'].strip())
except:
    print('')
" 2>/dev/null
}

# Voting mechanism - take most common result
vote_translations() {
    local translations=("$@")
    local count=${#translations[@]}

    if [ $count -eq 0 ]; then
        echo ""
        return
    fi

    # Count occurrences
    for t in "${translations[@]}"; do
        echo "$t"
    done | sort | uniq -c | sort -rn | head -1 | awk '{print $2}'
}

# ============================================================================
# Main Execution
# ============================================================================

echo "Starting $MAX_INSTANCES local model server(s)..."
for i in $(seq 0 $((MAX_INSTANCES-1))); do
    model_idx=$((i % ${#MODELS[@]}))
    start_model_server $i "${MODELS[$model_idx]}"
done

echo "Waiting for servers to be ready..."
sleep 10

# Get names to translate
echo "Fetching translation tasks..."
csql "SELECT DISTINCT english_name FROM emission_material_translation WHERE korean_name IS NULL LIMIT $BATCH_SIZE;" > /tmp/translate_tasks.txt 2>/dev/null

total=0
success=0
fallback_count=0

while read -r line; do
    if [[ "$line" =~ ^[[:space:]]*\'(.+)\'[[:space:]]*$ ]]; then
        name="${BASH_REMATCH[1]}"

        # Parallel local translations
        translations=()
        for i in $(seq 0 $((MAX_INSTANCES-1))); do
            t=$(local_translate "$name" ${PORTS[$i]})
            if [ -n "$t" ] && [ ${#t} -gt 1 ]; then
                translations+=("$t")
            fi
        done

        # If not enough local results, use NVIDIA API
        if [ ${#translations[@]} -lt $VOTING_THRESHOLD ]; then
            api_key_idx=$((total % ${#API_KEYS[@]}))
            t=$(nvidia_translate "$name" "${API_KEYS[$api_key_idx]}")
            if [ -n "$t" ]; then
                translations+=("$t")
                fallback_count=$((fallback_count + 1))
            fi
        fi

        # Vote for best translation
        if [ ${#translations[@]} -gt 0 ]; then
            korean=$(vote_translations "${translations[@]}")

            if [ -n "$korean" ]; then
                escaped_name=$(echo "$name" | sed "s/'/''/g")
                escaped_korean=$(echo "$korean" | sed "s/'/''/g")
                csql "UPDATE emission_material_translation SET korean_name = '$escaped_korean', last_updt_pnttm = CURRENT_DATETIME WHERE english_name = '$escaped_name';"
                success=$((success + 1))
                echo "[$total] $name -> $korean"
            fi
        fi

        total=$((total + 1))
    fi
done < /tmp/translate_tasks.txt

echo ""
echo "=== Results ==="
echo "Total processed: $total"
echo "Success: $success"
echo "NVIDIA API fallback: $fallback_count"

# Cleanup
rm -f /tmp/translate_tasks.txt

for i in $(seq 0 $((MAX_INSTANCES-1))); do
    pkill -f "llama-server.*model_$i" 2>/dev/null
done