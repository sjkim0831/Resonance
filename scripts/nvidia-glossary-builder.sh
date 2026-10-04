#!/bin/bash
#========================================
# NVIDIA API Parallel Glossary Builder
# 16 API Keys + M2.7 Model
#========================================

set -e

# NVIDIA API Keys (16개)
NVIDIA_API_KEYS=()
while IFS= read -r __nvidia_key; do
    [ -n "$__nvidia_key" ] && NVIDIA_API_KEYS+=("$__nvidia_key")
done < "${NVIDIA_API_KEYS_FILE:-/etc/resonance/secrets/nvidia-api-keys}"

MODEL="minimaxai/minimax-m2.7"
MAX_TOKENS=2048
TEMPERATURE=0.2

# CUBRID
NAMESPACE="carbonet-prod"
POD="cubrid-carbonet-0"
CUBRID_BIN="/home/cubrid/CUBRID/bin"

# ESG/탄소관리 카테고리
CATEGORIES=(
    "emission"
    "carbon"
    "material"
    "energy"
    "waste"
    "water"
    "transport"
    "building"
    "process"
    "climate"
    "regulation"
    "certificate"
    "general"
)

log_info() { echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_err() { echo "[ERR] $(date '+%Y-%m-%d %H:%M:%S') $1"; }

pod_exec() {
    kubectl -n "$NAMESPACE" exec "$POD" -- bash -c "$1" 2>&1
}

# Generate glossary terms via NVIDIA API
generate_terms() {
    local category=$1
    local key_idx=$2
    local api_key="${NVIDIA_API_KEYS[$key_idx]}"
    local max_retries=3
    local retry_delay=5

    local prompt="You are a Korean ESG/탄소관리 expert. Generate 20 important terms for '$category' category in carbon management/ESG.

Format as JSON array (exactly this structure, no markdown):
[{\"term_ko\":\"Korean term\",\"term_en\":\"English term\",\"definition\":\"Brief Korean definition\"}]

Generate now:"

    for attempt in $(seq 1 $max_retries); do
        local response=$(curl -s --max-time 60 -X POST "https://integrate.api.nvidia.com/v1/chat/completions" \
            -H "Authorization: Bearer $api_key" \
            -H "Content-Type: application/json" \
            -d "{
                \"model\": \"$MODEL\",
                \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}],
                \"max_tokens\": $MAX_TOKENS,
                \"temperature\": $TEMPERATURE
            }" 2>&1)

        local status=$(echo "$response" | jq -r '.status // "ok"' 2>/dev/null)

        if [ "$status" = "429" ]; then
            log_err "Rate limited, waiting ${retry_delay}s (attempt $attempt/$max_retries)"
            sleep $retry_delay
            retry_delay=$((retry_delay * 2))
            continue
        fi

        echo "$response"
        return 0
    done

    echo '{"error": "rate_limit_exceeded"}'
    return 1
}

# Insert into CUBRID glossary
insert-term() {
    local term_ko=$1
    local term_en=$2
    local category=$3
    local definition=$4

    term_ko=$(echo "$term_ko" | sed "s/'/''/g")
    term_en=$(echo "$term_en" | sed "s/'/''/g")
    definition=$(echo "$definition" | sed "s/'/''/g")

    pod_exec "$CUBRID_BIN/csql -C -u dba resonance -c \"
        INSERT INTO glossary (term_ko, term_en, category, definition, confidence)
        VALUES ('$term_ko', '$term_en', '$category', '$definition', 0.85)
        ON DUPLICATE KEY UPDATE
            term_en = COALESCE(NULLIF('$term_en', ''), term_en),
            definition = COALESCE(NULLIF('$definition', ''), definition),
            last_updated = CURRENT_TIMESTAMP;
    \" 2>/dev/null"
}

# Process one category
process-category() {
    local category=$1
    local key_idx=$2

    log_info "Processing: $category (key $key_idx)"

    local response=$(generate_terms "$category" "$key_idx")
    local content=$(echo "$response" | jq -r '.choices[0].message.content' 2>/dev/null)

    if [ -z "$content" ] || [ "$content" = "null" ]; then
        log_err "Failed: $category"
        return 1
    fi

    content=$(echo "$content" | sed 's/```json//g' | sed 's/```//g' | tr -d '\n')

    local count=0
    echo "$content" | jq -r '.[] | @json' 2>/dev/null | while read -r item; do
        local term_ko=$(echo "$item" | jq -r '.term_ko // empty')
        local term_en=$(echo "$item" | jq -r '.term_en // empty')
        local definition=$(echo "$item" | jq -r '.definition // empty')

        if [ -n "$term_ko" ]; then
            insert-term "$term_ko" "$term_en" "$category" "$definition"
            ((count++)) || true
        fi
    done

    log_info "Done: $category ($count terms)"
}

# Main
main() {
    log_info "=== Glossary Builder Started (16 keys, reduced parallelism) ==="
    log_info "Model: $MODEL"

    local pids=()
    local idx=0
    local max_parallel=4

    for category in "${CATEGORIES[@]}"; do
        process-category "$category" "$idx" &
        pids+=($!)
        ((idx++))
        sleep 2

        if [ ${#pids[@]} -ge $max_parallel ]; then
            wait ${pids[0]}
            pids=("${pids[@]:1}")
        fi
    done

    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null
    done

    log_info "=== Completed ==="

    local total=$(pod_exec "$CUBRID_BIN/csql -C -u dba resonance -c 'SELECT COUNT(*) FROM glossary;' 2>/dev/null" | grep -A1 "COUNT" | tail -1 | tr -d ' ')
    log_info "Total terms: $total"
}

main "$@"
