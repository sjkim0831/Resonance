#!/usr/bin/env bash
# lib/failure.sh - Failure categories and bounded retry logic
# Categories: SSE, RATE_LIMIT, PERMISSION, TEST, CONFLICT, INFRA

# Guard against multiple sourcing
[[ -n "${FAILURE_SH_SOURCED:-}" ]] && return 0
readonly FAILURE_SH_SOURCED=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/status.sh
source "${SCRIPT_DIR}/status.sh"

# Failure categories
readonly FAILURE_CATEGORY_SSE="SSE"
readonly FAILURE_CATEGORY_RATE_LIMIT="RATE_LIMIT"
readonly FAILURE_CATEGORY_PERMISSION="PERMISSION"
readonly FAILURE_CATEGORY_TEST="TEST"
readonly FAILURE_CATEGORY_CONFLICT="CONFLICT"
readonly FAILURE_CATEGORY_INFRA="INFRA"

# All failure categories
readonly ALL_FAILURE_CATEGORIES=(
    "$FAILURE_CATEGORY_SSE"
    "$FAILURE_CATEGORY_RATE_LIMIT"
    "$FAILURE_CATEGORY_PERMISSION"
    "$FAILURE_CATEGORY_TEST"
    "$FAILURE_CATEGORY_CONFLICT"
    "$FAILURE_CATEGORY_INFRA"
)

# Default retry limits per category
: "${FAILURE_RETRY_SSE:=3}"
: "${FAILURE_RETRY_RATE_LIMIT:=5}"
: "${FAILURE_RETRY_PERMISSION:=2}"
: "${FAILURE_RETRY_TEST:=2}"
: "${FAILURE_RETRY_CONFLICT:=3}"
: "${FAILURE_RETRY_INFRA:=4}"

# Retry limits mapping
declare -gA FAILURE_RETRY_LIMITS
FAILURE_RETRY_LIMITS["$FAILURE_CATEGORY_SSE"]="${FAILURE_RETRY_SSE}"
FAILURE_RETRY_LIMITS["$FAILURE_CATEGORY_RATE_LIMIT"]="${FAILURE_RETRY_RATE_LIMIT}"
FAILURE_RETRY_LIMITS["$FAILURE_CATEGORY_PERMISSION"]="${FAILURE_RETRY_PERMISSION}"
FAILURE_RETRY_LIMITS["$FAILURE_CATEGORY_TEST"]="${FAILURE_RETRY_TEST}"
FAILURE_RETRY_LIMITS["$FAILURE_CATEGORY_CONFLICT"]="${FAILURE_RETRY_CONFLICT}"
FAILURE_RETRY_LIMITS["$FAILURE_CATEGORY_INFRA"]="${FAILURE_RETRY_INFRA}"

# Backoff configuration
: "${FAILURE_BACKOFF_BASE:=2}"
: "${FAILURE_BACKOFF_MAX:=120}"
: "${FAILURE_BACKOFF_JITTER:=0.1}"

# Failure category to HTTP status code mapping
declare -gA FAILURE_HTTP_STATUS
FAILURE_HTTP_STATUS["$FAILURE_CATEGORY_SSE"]="502"
FAILURE_HTTP_STATUS["$FAILURE_CATEGORY_RATE_LIMIT"]="429"
FAILURE_HTTP_STATUS["$FAILURE_CATEGORY_PERMISSION"]="403"
FAILURE_HTTP_STATUS["$FAILURE_CATEGORY_TEST"]="400"
FAILURE_HTTP_STATUS["$FAILURE_CATEGORY_CONFLICT"]="409"
FAILURE_HTTP_STATUS["$FAILURE_CATEGORY_INFRA"]="503"

# Failure directory
FAILURE_DIR="${FAILURE_DIR:-/var/tmp/agent-failures}"
FAILURE_STATE_DIR="${FAILURE_STATE_DIR:-${FAILURE_DIR}/state}"

# failure_init - Initialize failure tracking directory
failure_init() {
    mkdir -p "$FAILURE_DIR" "$FAILURE_STATE_DIR"
}

# failure_is_valid_category - Check if category is valid
failure_is_valid_category() {
    local category="$1"
    for cat in "${ALL_FAILURE_CATEGORIES[@]}"; do
        if [[ "$cat" == "$category" ]]; then
            return 0
        fi
    done
    return 1
}

# failure_get_retry_limit - Get retry limit for a category
failure_get_retry_limit() {
    local category="$1"
    echo "${FAILURE_RETRY_LIMITS[$category]:-3}"
}

# failure_get_http_status - Get expected HTTP status for category
failure_get_http_status() {
    local category="$1"
    echo "${FAILURE_HTTP_STATUS[$category]:-500}"
}

# failure_calculate_backoff - Calculate exponential backoff with jitter
failure_calculate_backoff() {
    local attempt="$1"
    local base="${2:-$FAILURE_BACKOFF_BASE}"
    local max_delay="${3:-$FAILURE_BACKOFF_MAX}"
    local jitter="${4:-$FAILURE_BACKOFF_JITTER}"

    local delay=$((base ** attempt))
    if (( delay > max_delay )); then
        delay=$max_delay
    fi

    # Add jitter
    local jitter_amount
    jitter_amount=$(python3 -c "import random; print(int($delay * $jitter * (2 * random.random() - 1)))")
    delay=$((delay + jitter_amount))

    if (( delay < 1 )); then
        delay=1
    fi

    echo "$delay"
}

# failure_record - Record a failure event
failure_record() {
    local task_id="$1"
    local category="$2"
    local error_msg="${3:-}"
    local context="${4:-}"

    if ! failure_is_valid_category "$category"; then
        echo "ERROR: Invalid failure category: $category" >&2
        return 1
    fi

    failure_init

    local timestamp
    timestamp=$(date +%s)
    local failure_id="${task_id}-${category}-${timestamp}"

    local event_file="${FAILURE_STATE_DIR}/${failure_id}.json"
    cat > "$event_file" <<EOF
{
  "failure_id": "$failure_id",
  "task_id": "$task_id",
  "category": "$category",
  "error": "$error_msg",
  "context": $context,
  "timestamp": $timestamp,
  "retry_count": 0,
  "max_retries": ${FAILURE_RETRY_LIMITS[$category]}
}
EOF

    echo "$failure_id"
    return 0
}

# failure_increment_retry - Increment retry count for a failure
failure_increment_retry() {
    local failure_id="$1"

    local event_file
    event_file=$(find "${FAILURE_STATE_DIR}" -name "${failure_id}.json" 2>/dev/null | head -1)

    if [[ -z "$event_file" || ! -f "$event_file" ]]; then
        return 1
    fi

    python3 -c "
import json
with open('$event_file') as f:
    d = json.load(f)
d['retry_count'] = d.get('retry_count', 0) + 1
with open('$event_file', 'w') as f:
    json.dump(d, f)
print(d['retry_count'])
"
}

# failure_get_retry_count - Get current retry count
failure_get_retry_count() {
    local failure_id="$1"

    local event_file
    event_file=$(find "${FAILURE_STATE_DIR}" -name "${failure_id}.json" 2>/dev/null | head -1)

    if [[ -z "$event_file" || ! -f "$event_file" ]]; then
        echo "0"
        return
    fi

    python3 -c "import json; d=json.load(open('$event_file')); print(d.get('retry_count', 0))"
}

# failure_can_retry - Check if a failure can be retried
failure_can_retry() {
    local failure_id="$1"

    local event_file
    event_file=$(find "${FAILURE_STATE_DIR}" -name "${failure_id}.json" 2>/dev/null | head -1)

    if [[ -z "$event_file" || ! -f "$event_file" ]]; then
        return 1
    fi

    local retry_count
    retry_count=$(failure_get_retry_count "$failure_id")
    local max_retries
    max_retries=$(python3 -c "import json; d=json.load(open('$event_file')); print(d.get('max_retries', 3))")

    (( retry_count < max_retries ))
}

# failure_is_retryable_category - Check if category is retryable
failure_is_retryable_category() {
    local category="$1"

    # PERMISSION failures are not retryable without action
    if [[ "$category" == "$FAILURE_CATEGORY_PERMISSION" ]]; then
        return 1
    fi
    return 0
}

# failure_should_retry - Determine if a failure should be retried
failure_should_retry() {
    local failure_id="$1"

    local event_file
    event_file=$(find "${FAILURE_STATE_DIR}" -name "${failure_id}.json" 2>/dev/null | head -1)

    if [[ -z "$event_file" || ! -f "$event_file" ]]; then
        return 1
    fi

    local category
    category=$(python3 -c "import json; d=json.load(open('$event_file')); print(d.get('category', ''))" 2>/dev/null)

    if failure_is_retryable_category "$category"; then
        return 1
    fi

    failure_can_retry "$failure_id"
}

# failure_clear - Clear a failure event
failure_clear() {
    local failure_id="$1"

    local event_file
    event_file=$(find "${FAILURE_STATE_DIR}" -name "${failure_id}.json" 2>/dev/null | head -1)

    if [[ -n "$event_file" && -f "$event_file" ]]; then
        rm -f "$event_file"
    fi
}

# failure_list_by_category - List all failures for a category
failure_list_by_category() {
    local category="$1"

    failure_init

    local failures=()
    for event_file in "${FAILURE_STATE_DIR}"/*.json; do
        [[ -f "$event_file" ]] || continue
        local cat
        cat=$(python3 -c "import json; d=json.load(open('$event_file')); print(d.get('category', ''))" 2>/dev/null)
        if [[ "$cat" == "$category" ]]; then
            failures+=("$(basename "$event_file" .json)")
        fi
    done

    printf '%s\n' "${failures[@]}" 2>/dev/null || echo "[]"
}

# failure_get_stats - Get failure statistics
failure_get_stats() {
    failure_init

    declare -A category_counts
    local total=0

    for category in "${ALL_FAILURE_CATEGORIES[@]}"; do
        category_counts["$category"]=0
    done

    for event_file in "${FAILURE_STATE_DIR}"/*.json; do
        [[ -f "$event_file" ]] || continue
        local cat
        cat=$(python3 -c "import json; d=json.load(open('$event_file')); print(d.get('category', ''))" 2>/dev/null)
        if [[ -n "$cat" ]]; then
            category_counts["$cat"]=$((category_counts["$cat"] + 1))
            ((total++)) || true
        fi
    done

    python3 -c "
import json
print(json.dumps({
    'total': $total,
    'by_category': $(python3 -c "import json; print(json.dumps({k: v for k, v in ${category_counts[@]+"${category_counts[@]}"} }))")
}, indent=2))
" 2>/dev/null || echo '{"total":0,"by_category":{}}'
}

# failure_classify_from_error - Classify error into failure category
failure_classify_from_error() {
    local error_msg="$1"

    # Check for SSE-related errors
    if [[ "$error_msg" == *"SSE"* || "$error_msg" == *"stream"* || "$error_msg" == *"timeout"* || "$error_msg" == *"502"* ]]; then
        echo "$FAILURE_CATEGORY_SSE"
        return
    fi

    # Check for rate limit errors
    if [[ "$error_msg" == *"rate limit"* || "$error_msg" == *"429"* || "$error_msg" == *"too many"* || "$error_msg" == *"throttle"* ]]; then
        echo "$FAILURE_CATEGORY_RATE_LIMIT"
        return
    fi

    # Check for permission errors
    if [[ "$error_msg" == *"permission"* || "$error_msg" == *"denied"* || "$error_msg" == *"403"* || "$error_msg" == *"unauthorized"* || "$error_msg" == *"forbidden"* ]]; then
        echo "$FAILURE_CATEGORY_PERMISSION"
        return
    fi

    # Check for test errors
    if [[ "$error_msg" == *"test"* || "$error_msg" == *"assert"* || "$error_msg" == *"fail"* || "$error_msg" == *"400"* ]]; then
        echo "$FAILURE_CATEGORY_TEST"
        return
    fi

    # Check for conflict errors
    if [[ "$error_msg" == *"conflict"* || "$error_msg" == *"409"* || "$error_msg" == *"concurrent"* || "$error_msg" == *"lock"* ]]; then
        echo "$FAILURE_CATEGORY_CONFLICT"
        return
    fi

    # Check for infrastructure errors
    if [[ "$error_msg" == *"infra"* || "$error_msg" == *"503"* || "$error_msg" == *"unavailable"* || "$error_msg" == *"connection"* || "$error_msg" == *"network"* ]]; then
        echo "$FAILURE_CATEGORY_INFRA"
        return
    fi

    # Default to INFRA
    echo "$FAILURE_CATEGORY_INFRA"
}

# failure_execute_with_retry - Execute command with bounded retry logic
# Returns: exit code of command, or 1 if all retries exhausted
failure_execute_with_retry() {
    local task_id="$1"
    local category="$2"
    local cmd="$3"

    if ! failure_is_valid_category "$category"; then
        echo "ERROR: Invalid failure category: $category" >&2
        return 1
    fi

    local retry_limit
    retry_limit=$(failure_get_retry_limit "$category")

    local attempt=0
    local last_exit_code=0

    while (( attempt <= retry_limit )); do
        if (( attempt > 0 )); then
            local delay
            delay=$(failure_calculate_backoff "$attempt")
            echo "[RETRY] Attempt $attempt/$retry_limit, backing off ${delay}s for task $task_id"
            sleep "$delay"
        fi

        # Execute command
        set +e
        eval "$cmd"
        last_exit_code=$?
        set -e

        if (( last_exit_code == 0 )); then
            return 0
        fi

        ((attempt++)) || true
    done

    echo "[FAILURE] Task $task_id failed after $retry_limit retries (exit: $last_exit_code)"
    return "$last_exit_code"
}

# Export for subshells
export FAILURE_DIR FAILURE_STATE_DIR
export FAILURE_RETRY_LIMITS FAILURE_BACKOFF_BASE FAILURE_BACKOFF_MAX
for cat in "${ALL_FAILURE_CATEGORIES[@]}"; do
    export "FAILURE_RETRY_${cat^^}"
done