#!/bin/bash
#========================================
# NVIDIA API Parallel Builder (M2.7)
# 16 API Keys 사용
#========================================

set -e

# API 키는 절대 이 파일에 하드코딩하지 않는다.
# ops/scripts/import-hermes-nvidia-key-pool.py 와 동일한 컨벤션:
# NVIDIA_API_KEYS_FILE 환경변수(기본값 /etc/resonance/secrets/nvidia-api-keys),
# 한 줄에 키 하나씩 저장된 mode 0600 파일에서 로드한다.
NVIDIA_API_KEYS_FILE="${NVIDIA_API_KEYS_FILE:-/etc/resonance/secrets/nvidia-api-keys}"
if [ ! -f "$NVIDIA_API_KEYS_FILE" ]; then
    echo "[ERR] missing NVIDIA API keys file: $NVIDIA_API_KEYS_FILE" >&2
    exit 1
fi
mapfile -t NVIDIA_API_KEYS < <(grep -v '^[[:space:]]*$' "$NVIDIA_API_KEYS_FILE")
if [ "${#NVIDIA_API_KEYS[@]}" -eq 0 ]; then
    echo "[ERR] NVIDIA API keys file is empty: $NVIDIA_API_KEYS_FILE" >&2
    exit 1
fi

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
    local api_key="${NVIDIA_API_KEYS[$((key_idx % ${#NVIDIA_API_KEYS[@]}))]}"

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
    log_info "=== NVIDIA M2.7 Parallel Builder (${#NVIDIA_API_KEYS[@]} keys) ==="
    log_info "Model: $MODEL"
    log_info "Parallel jobs: $MAX_PARALLEL"

    test_api
}

main "$@"
