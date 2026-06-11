#!/bin/bash
#========================================
# Glossary Generator - Fixed Temperature
#========================================

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
ENDPOINT="https://integrate.api.nvidia.com/v1/chat/completions"
MAX_TOKENS=2048
TEMPERATURE=0.1  # Lower temperature for cleaner responses
REQUEST_DELAY=10

NAMESPACE="carbonet-prod"
POD="cubrid-carbonet-0"
CUBRID_BIN="/home/cubrid/CUBRID/bin"

CATEGORIES=("emission" "carbon" "material" "energy" "waste" "water" "transport" "building" "process" "climate" "regulation" "certificate" "general")

log() { echo "[$(date '+%H:%M:%S')] $1"; }

pod_exec() {
    kubectl -n "$NAMESPACE" exec "$POD" -- bash -c "$1" 2>&1
}

call_api() {
    local prompt="$1"
    local key_idx=$2

    local response=$(curl -s --max-time 90 -X POST "$ENDPOINT" \
        -H "Authorization: Bearer ${NVIDIA_API_KEYS[$key_idx]}" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"$prompt\"}],\"max_tokens\":$MAX_TOKENS,\"temperature\":$TEMPERATURE}")

    echo "$response"
}

insert_term() {
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

generate_category() {
    local category=$1
    local key_idx=$2

    log "Generating: $category"

    local prompt="Generate 10 important ESG/탄소관리 terms for '$category' category. 
Return ONLY valid JSON array, no markdown, no explanation:
[{\"term_ko\":\"Korean term\",\"term_en\":\"English term\",\"definition\":\"Korean definition\"}]"

    local response=$(call_api "$prompt" "$key_idx")
    
    # Extract content - checking both content and reasoning_content
    local content=$(echo "$response" | jq -r '.choices[0].message.content // .choices[0].message.reasoning_content' 2>/dev/null | sed 's/```json//g' | sed 's/```//g' | tr -d '\n\r\t')

    if [ -z "$content" ] || [ "$content" = "null" ]; then
        log "Failed: $category (no response)"
        return 1
    fi

    # Parse and insert
    local count=0
    echo "$content" | jq -r '.[] | @json' 2>/dev/null | while read -r item; do
        local term_ko=$(echo "$item" | jq -r '.term_ko // empty' 2>/dev/null)
        local term_en=$(echo "$item" | jq -r '.term_en // empty' 2>/dev/null)
        local definition=$(echo "$item" | jq -r '.definition // empty' 2>/dev/null)

        if [ -n "$term_ko" ] && [ "$term_ko" != "empty" ] && [ "$term_ko" != "null" ]; then
            insert_term "$term_ko" "$term_en" "$category" "$definition"
            count=$((count + 1))
        fi
    done

    log "Done: $category ($count terms)"
}

main() {
    log "=== Glossary Generator (temp=0.1) ==="
    
    local idx=0
    for category in "${CATEGORIES[@]}"; do
        generate_category "$category" "$idx"
        idx=$((idx + 1))
        sleep $REQUEST_DELAY
    done

    log "=== Completed ==="
    local total=$(pod_exec "$CUBRID_BIN/csql -C -u dba resonance -c 'SELECT COUNT(*) FROM glossary;' 2>/dev/null" | grep -A1 "COUNT" | tail -1 | tr -d ' ')
    log "Total: $total terms"
}

main "$@"
