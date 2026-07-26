#!/usr/bin/env bash
# lib/concurrency.sh - Resource-class limits with semaphore-based concurrency control
# Enforces bounded parallelism for: search, build, playwright, db_read, db_write, deploy

# Guard against multiple sourcing
[[ -n "${CONCURRENCY_SH_SOURCED:-}" ]] && return 0
readonly CONCURRENCY_SH_SOURCED=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/status.sh
source "${SCRIPT_DIR}/status.sh"

# Resource class configuration directory
CONCURRENCY_DIR="${CONCURRENCY_DIR:-/var/tmp/agent-concurrency}"
CONCURRENCY_LOCK_DIR="${CONCURRENCY_DIR}/.locks"
CONCURRENCY_STATE_DIR="${CONCURRENCY_DIR}/state"

# Default limits per resource class
: "${CONCURRENCY_LIMIT_SEARCH:=5}"
: "${CONCURRENCY_LIMIT_BUILD:=2}"
: "${CONCURRENCY_LIMIT_PLAYWRIGHT:=3}"
: "${CONCURRENCY_LIMIT_DB_READ:=10}"
: "${CONCURRENCY_LIMIT_DB_WRITE:=4}"
: "${CONCURRENCY_LIMIT_DEPLOY:=1}"

# All resource classes
readonly RESOURCE_CLASSES=(
    "search"
    "build"
    "playwright"
    "db_read"
    "db_write"
    "deploy"
)

# Resource class to limit mapping
declare -gA CONCURRENCY_LIMITS
CONCURRENCY_LIMITS["search"]="${CONCURRENCY_LIMIT_SEARCH}"
CONCURRENCY_LIMITS["build"]="${CONCURRENCY_LIMIT_BUILD}"
CONCURRENCY_LIMITS["playwright"]="${CONCURRENCY_LIMIT_PLAYWRIGHT}"
CONCURRENCY_LIMITS["db_read"]="${CONCURRENCY_LIMIT_DB_READ}"
CONCURRENCY_LIMITS["db_write"]="${CONCURRENCY_LIMIT_DB_WRITE}"
CONCURRENCY_LIMITS["deploy"]="${CONCURRENCY_LIMIT_DEPLOY}"

# concurrency_init - Initialize concurrency control directories
concurrency_init() {
    mkdir -p "$CONCURRENCY_DIR" "$CONCURRENCY_LOCK_DIR" "$CONCURRENCY_STATE_DIR"
    for class in "${RESOURCE_CLASSES[@]}"; do
        local count_file="${CONCURRENCY_STATE_DIR}/${class}.count"
        local permits_file="${CONCURRENCY_STATE_DIR}/${class}.permits"
        if [[ ! -f "$count_file" ]]; then
            echo "0" > "$count_file"
        fi
        if [[ ! -f "$permits_file" ]]; then
            echo "${CONCURRENCY_LIMITS[$class]}" > "$permits_file"
        fi
    done
}

# _acquire_class_lock - Acquire lock for a resource class
_acquire_class_lock() {
    local class="$1"
    local lock_dir="${CONCURRENCY_LOCK_DIR}/${class}.lock"
    if mkdir "$lock_dir" 2>/dev/null; then
        echo "$lock_dir"
        return 0
    fi
    return 1
}

# _release_class_lock - Release lock for a resource class
_release_class_lock() {
    local lock_dir="$1"
    rmdir "$lock_dir" 2>/dev/null || true
}

# _get_current_count - Get current active count for a class
_get_current_count() {
    local class="$1"
    local count_file="${CONCURRENCY_STATE_DIR}/${class}.count"
    cat "$count_file" 2>/dev/null || echo "0"
}

# _set_current_count - Set current active count for a class
_set_current_count() {
    local class="$1"
    local count="$2"
    local count_file="${CONCURRENCY_STATE_DIR}/${class}.count"
    echo "$count" > "$count_file"
}

# _get_permits - Get max permits for a class
_get_permits() {
    local class="$1"
    local permits_file="${CONCURRENCY_STATE_DIR}/${class}.permits"
    cat "$permits_file" 2>/dev/null || echo "${CONCURRENCY_LIMITS[$class]:-1}"
}

# concurrency_acquire - Acquire a permit for a resource class
# Returns 0 on success, 1 if limit reached
# Sets CONCURRENCY_ACQUIRE_TOKEN to unique token on success
concurrency_acquire() {
    local class="$1"
    local worker_id="${2:-$$}"
    local timeout_seconds="${3:-0}"

    # Validate class
    local valid_class=false
    for c in "${RESOURCE_CLASSES[@]}"; do
        if [[ "$c" == "$class" ]]; then
            valid_class=true
            break
        fi
    done
    if ! "$valid_class"; then
        echo "ERROR: Invalid resource class: $class" >&2
        return 1
    fi

    concurrency_init

    local lock_dir
    lock_dir=$(_acquire_class_lock "$class") || {
        echo "ERROR: Could not acquire lock for $class" >&2
        return 1
    }

    local count_file="${CONCURRENCY_STATE_DIR}/${class}.count"
    local permits_file="${CONCURRENCY_STATE_DIR}/${class}.permits"

    local current_count
    current_count=$(cat "$count_file")
    local max_permits
    max_permits=$(cat "$permits_file")

    local token=""
    if (( current_count < max_permits )); then
        # Generate unique token
        token="${class}-${worker_id}-$(date +%s%N)"
        local new_count=$((current_count + 1))
        echo "$new_count" > "$count_file"

        # Write token file
        local token_file="${CONCURRENCY_STATE_DIR}/${token}.token"
        cat > "$token_file" <<EOF
{
  "class": "$class",
  "worker_id": "$worker_id",
  "token": "$token",
  "acquired_at": $(date +%s)
}
EOF
    fi

    _release_class_lock "$lock_dir"

    if [[ -n "$token" ]]; then
        readonly CONCURRENCY_ACQUIRE_TOKEN="$token"
        echo "$token"
        return 0
    fi

    return 1
}

# concurrency_release - Release a permit token
concurrency_release() {
    local token="$1"

    if [[ -z "$token" ]]; then
        return 0
    fi

    local token_file="${CONCURRENCY_STATE_DIR}/${token}.token"
    if [[ ! -f "$token_file" ]]; then
        return 0
    fi

    local class
    class=$(python3 -c "import json; d=json.load(open('$token_file')); print(d.get('class',''))" 2>/dev/null || echo "")

    if [[ -z "$class" ]]; then
        rm -f "$token_file"
        return 0
    fi

    local lock_dir
    lock_dir=$(_acquire_class_lock "$class") || return 1

    local count_file="${CONCURRENCY_STATE_DIR}/${class}.count"
    local current_count
    current_count=$(cat "$count_file" 2>/dev/null || echo "0")

    if (( current_count > 0 )); then
        echo "$((current_count - 1))" > "$count_file"
    fi

    rm -f "$token_file"
    _release_class_lock "$lock_dir"

    return 0
}

# concurrency_wait - Wait until a permit is available (with optional timeout)
concurrency_wait() {
    local class="$1"
    local timeout_seconds="${2:-0}"

    local start_time
    start_time=$(date +%s)

    while true; do
        if concurrency_acquire "$class" "wait-$$" >/dev/null 2>&1; then
            concurrency_release "$CONCURRENCY_ACQUIRE_TOKEN"
            return 0
        fi

        if (( timeout_seconds > 0 )); then
            local elapsed
            elapsed=$(($(date +%s) - start_time))
            if (( elapsed >= timeout_seconds )); then
                return 1
            fi
        fi

        sleep 1
    done
}

# concurrency_get_status - Get current status for a resource class
concurrency_get_status() {
    local class="$1"
    local count_file="${CONCURRENCY_STATE_DIR}/${class}.count"
    local permits_file="${CONCURRENCY_STATE_DIR}/${class}.permits"

    concurrency_init

    local current_count
    current_count=$(cat "$count_file" 2>/dev/null || echo "0")
    local max_permits
    max_permits=$(cat "$permits_file" 2>/dev/null || echo "0")

    python3 -c "
import json
print(json.dumps({
    'class': '$class',
    'current': $current_count,
    'limit': $max_permits,
    'available': $((max_permits - current_count)),
    'utilization': round($current_count / $max_permits * 100, 1) if $max_permits > 0 else 0
}, indent=2))
"
}

# concurrency_list_active - List all active tokens for a class
concurrency_list_active() {
    local class="${1:-}"

    concurrency_init

    local tokens=()
    for token_file in "${CONCURRENCY_STATE_DIR}"/*.token; do
        [[ -f "$token_file" ]] || continue
        local t
        t=$(basename "$token_file" .token)
        if [[ -z "$class" ]]; then
            tokens+=("$t")
        else
            local token_class
            token_class=$(python3 -c "import json; d=json.load(open('$token_file')); print(d.get('class',''))" 2>/dev/null || echo "")
            if [[ "$token_class" == "$class" ]]; then
                tokens+=("$t")
            fi
        fi
    done

    printf '%s\n' "${tokens[@]}" 2>/dev/null || echo "[]"
}

# concurrency_reset - Reset all concurrency state (use with caution)
concurrency_reset() {
    for class in "${RESOURCE_CLASSES[@]}"; do
        local lock_dir="${CONCURRENCY_LOCK_DIR}/${class}.lock"
        rmdir "$lock_dir" 2>/dev/null || true
    done
    rm -f "${CONCURRENCY_STATE_DIR}"/*.token
    rm -f "${CONCURRENCY_STATE_DIR}"/*.count
    rm -f "${CONCURRENCY_STATE_DIR}"/*.permits
}

# concurrency_check_limit - Check if a class is at its limit
concurrency_check_limit() {
    local class="$1"
    concurrency_init

    local current_count
    current_count=$(_get_current_count "$class")
    local max_permits
    max_permits=$(_get_permits "$class")

    (( current_count < max_permits ))
}

# concurrency_set_limit - Dynamically adjust limit for a resource class
concurrency_set_limit() {
    local class="$1"
    local new_limit="$2"

    if (( new_limit < 1 )); then
        echo "ERROR: Limit must be >= 1" >&2
        return 1
    fi

    concurrency_init

    local lock_dir
    lock_dir=$(_acquire_class_lock "$class") || return 1

    local permits_file="${CONCURRENCY_STATE_DIR}/${class}.permits"
    echo "$new_limit" > "$permits_file"
    CONCURRENCY_LIMITS["$class"]="$new_limit"

    _release_class_lock "$lock_dir"
    return 0
}

# Export for subshells
export CONCURRENCY_DIR CONCURRENCY_LOCK_DIR CONCURRENCY_STATE_DIR
export CONCURRENCY_LIMITS
for class in "${RESOURCE_CLASSES[@]}"; do
    export "CONCURRENCY_LIMIT_${class^^}=${CONCURRENCY_LIMITS[$class]}"
done