#!/bin/bash
#========================================
# NVIDIA API Parallel Glossary Builder
# 16 API Keys + M2.7 Model
#========================================

set -e

# NVIDIA API Keys (16개)
NVIDIA_API_KEYS=(
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
