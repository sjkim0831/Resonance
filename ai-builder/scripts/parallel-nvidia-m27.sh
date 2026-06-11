#!/bin/bash
#========================================
# NVIDIA API Parallel Builder (M2.7)
# 16 API Keys 사용
#========================================

set -e

# 16개 API Keys
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
MAX_TOKENS=4096
TEMPERATURE=0.3
MAX_PARALLEL=16

log_info() { echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_err() { echo "[ERR] $(date '+%Y-%m-%d %H:%M:%S') $1"; }

# 단일 API 호출
call_nvidia() {
    local prompt="$1"
    local key_idx=$2
    local api_key="${NVIDIA_API_KEYS[$key_idx]}"
    
    curl -s --max-time 60 -X POST "$ENDPOINT" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"$MODEL\",
            \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}],
            \"max_tokens\": $MAX_TOKENS,
            \"temperature\": $TEMPERATURE
        }"
}

# 재시도 로직 포함 호출
call_with_retry() {
    local prompt="$1"
    local key_idx=$2
    local max_retries=3
    local delay=5
    
    for attempt in $(seq 1 $max_retries); do
        local response=$(call_nvidia "$prompt" "$key_idx")
        local status=$(echo "$response" | jq -r '.status // "ok"' 2>/dev/null)
        
        if [ "$status" = "429" ]; then
            log_err "Rate limited, retry in ${delay}s (attempt $attempt/$max_retries)"
            sleep $delay
            delay=$((delay * 2))
            continue
        elif [ "$status" = "null" ] || [ -z "$status" ]; then
            echo "$response" | jq -r '.choices[0].message.content' 2>/dev/null
            return 0
        fi
    done
    
    log_err "Failed after $max_retries attempts"
    return 1
}

# 병렬 처리
parallel_generate() {
    local prompts=("$@")
    local pids=()
    local results=()
    local idx=0
    
    for prompt in "${prompts[@]}"; do
        (
            result=$(call_with_retry "$prompt" "$idx")
            echo "$result"
        ) &
        pids+=($!)
        ((idx++))
        
        if [ ${#pids[@]} -ge $MAX_PARALLEL ]; then
            for i in $(seq 0 $((${#pids[@]} - 1))); do
                results[$i]=$(wait ${pids[$i]} 2>/dev/null)
            done
            pids=()
        fi
    done
    
    # 남은 작업 대기
    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null
    done
    
    echo "${results[@]}"
}

# 테스트
test_api() {
    log_info "Testing API with key 0..."
    local response=$(call_nvidia "Say hello in Korean" 0)
    local content=$(echo "$response" | jq -r '.choices[0].message.content' 2>/dev/null)
    
    if [ -n "$content" ] && [ "$content" != "null" ]; then
        log_info "API OK: $content"
    else
        log_err "API Error: $response"
    fi
}

# 메인
main() {
    log_info "=== NVIDIA M2.7 Parallel Builder (16 keys) ==="
    log_info "Model: $MODEL"
    log_info "Parallel jobs: $MAX_PARALLEL"
    
    test_api
}

main "$@"
