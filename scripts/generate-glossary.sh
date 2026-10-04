#!/bin/bash
#========================================
# Glossary Generator - Fixed Temperature
#========================================

NVIDIA_API_KEYS=()
while IFS= read -r __nvidia_key; do
    [ -n "$__nvidia_key" ] && NVIDIA_API_KEYS+=("$__nvidia_key")
done < "${NVIDIA_API_KEYS_FILE:-/etc/resonance/secrets/nvidia-api-keys}"

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
