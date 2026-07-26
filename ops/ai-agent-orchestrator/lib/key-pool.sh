#!/usr/bin/env bash
# lib/key-pool.sh - NVIDIA API key pool manager with AVAIABLE/COOLDOWN/DISABLED states
# - Atomic state updates via mkdir locks
# - Rotate on 401/403/429 immediately
# - SSE timeout: retry same key once, then rotate
# - Never print or persist full secrets; only fingerprints in logs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/status.sh
source "${SCRIPT_DIR}/status.sh"

# Key pool configuration
KEYPOOL_DIR="${KEYPOOL_DIR:-/var/tmp/agent-keypool}"
KEYPOOL_LOCK_DIR="${KEYPOOL_LOCK_DIR:-${KEYPOOL_DIR}/.locks}"
KEYPOOL_STATE_FILE="${KEYPOOL_STATE_FILE:-${KEYPOOL_DIR}/keys.json}"

# Cooldown defaults (seconds)
DEFAULT_COOLDOWN="${DEFAULT_COOLDOWN:-60}"
RATE_LIMIT_COOLDOWN="${RATE_LIMIT_COOLDOWN:-300}"
AUTH_FAILURE_COOLDOWN="${AUTH_FAILURE_COOLDOWN:-600}"

# Key states
readonly KEY_AVAILABLE="AVAILABLE"
readonly KEY_COOLDOWN="COOLDOWN"
readonly KEY_DISABLED="DISABLED"

_keypool_init() {
    mkdir -p "$KEYPOOL_DIR" "$KEYPOOL_LOCK_DIR"
    if [[ ! -f "$KEYPOOL_STATE_FILE" ]]; then
        printf '%s\n' '{"keys":[],"next_index":0}' > "$KEYPOOL_STATE_FILE"
    fi
}

_keypool_fingerprint() {
    local key="$1"
    printf '%s' "$key" | sha256sum | cut -c1-8
}

_acquire_lock() {
    local lock_name="$1"
    local lock_dir="${KEYPOOL_LOCK_DIR}/${lock_name}.lock"
    local max_retries="${2:-1000}"
    local base_delay="${3:-0.005}"
    local max_delay="${4:-0.1}"
    local stale_threshold="${5:-60}"

    for ((i=0; i<max_retries; i++)); do
        if mkdir "$lock_dir" 2>/dev/null; then
            printf '%s' "$lock_dir"
            return 0
        fi

        if [[ -d "$lock_dir" ]]; then
            local lock_age
            lock_age=$(($(date +%s) - $(stat -c %Y "$lock_dir" 2>/dev/null || echo 0)))
            if [[ "$lock_age" -gt "$stale_threshold" ]]; then
                rmdir "$lock_dir" 2>/dev/null || true
                if mkdir "$lock_dir" 2>/dev/null; then
                    printf '%s' "$lock_dir"
                    return 0
                fi
            fi
        fi

        local delay
        delay=$(printf '%s\n' "$base_delay" | awk -v n="$i" 'BEGIN{srand(); r=rand(); e=2^n; d=e * (0.5 + r * 0.5); if(d>'"$max_delay"')d='"$max_delay"'; printf "%.4f", d}')
        sleep "$delay"
    done
    return 1
}

_release_lock() {
    local lock_dir="$1"
    rmdir "$lock_dir" 2>/dev/null || true
}

_atomic_write() {
    local file="$1"
    local json="$2"

    local tmp
    tmp=$(mktemp "${file}.tmp.${BASHPID}.XXXXXX" 2>/dev/null) || return 1

    chmod 600 "$tmp" || { rm -f "$tmp"; return 1; }

    if ! printf '%s' "$json" | jq -e '.' > /dev/null 2>&1; then
        rm -f "$tmp"
        return 1
    fi

    printf '%s' "$json" > "$tmp" || { rm -f "$tmp"; return 1; }

    mv "$tmp" "$file" || { rm -f "$tmp"; return 1; }
}

_keypool_validate_or_recover() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        printf '{"keys":[],"next_index":0}' > "$file"
        return 0
    fi

    local content
    content=$(cat "$file" 2>/dev/null)

    if echo "$content" | jq -e '.' > /dev/null 2>&1; then
        return 0
    fi

    echo "[KEYPOOL] WARNING: Malformed JSON in $file, recovering..." >&2
    printf '{"keys":[],"next_index":0}' > "$file"
    return 0
}

_keypool_read() {
    local lock_dir
    lock_dir=$(_acquire_lock "keypool_read") || return 1
    local content
    content=$(cat "$KEYPOOL_STATE_FILE" 2>/dev/null || echo '{"keys":[],"next_index":0}')
    _release_lock "$lock_dir"
    printf '%s' "$content"
}

# keypool_add - Add a key to the pool
# Returns the fingerprint of the added key
keypool_add() {
    local key="$1"
    local label="${2:-}"
    _keypool_init

    local fingerprint
    fingerprint=$(_keypool_fingerprint "$key")

    local lock_dir
    lock_dir=$(_acquire_lock "keypool_add") || { echo "ERROR: Could not acquire lock" >&2; return 1; }

    trap '_release_lock "$lock_dir" 2>/dev/null || true' EXIT

    _keypool_validate_or_recover "$KEYPOOL_STATE_FILE"
    local content
    content=$(cat "$KEYPOOL_STATE_FILE")
    local now
    now=$(date +%s)

    local key_json
    key_json=$(printf '{}' | jq \
        --arg key "$key" \
        --arg fingerprint "$fingerprint" \
        --arg label "$label" \
        --arg status "$KEY_AVAILABLE" \
        --argjson created_at "$now" \
        --argjson cooldown_until 0 \
        --argjson use_count 0 \
        --argjson error_count 0 \
        --arg last_error "" \
        '.key = $key | .fingerprint = $fingerprint | .label = $label | .status = $status | .created_at = $created_at | .cooldown_until = $cooldown_until | .use_count = $use_count | .error_count = $error_count | .last_error = $last_error')

    local new_content
    new_content=$(printf '%s' "$content" | jq --argjson key "$key_json" '.keys += [$key]')
    _atomic_write "$KEYPOOL_STATE_FILE" "$new_content"

    trap - EXIT
    _release_lock "$lock_dir"

    echo "$fingerprint"
}

# keypool_get_available - Get an available key (atomic claim)
# Sets KEYPOOL_LAST_USED_FINGERPRINT on success
keypool_get_available() {
    local lock_dir
    lock_dir=$(_acquire_lock "keypool_get") || return 1
    local now
    now=$(date +%s)

    local content
    content=$(cat "$KEYPOOL_STATE_FILE")

    local available_key
    available_key=$(printf '%s' "$content" | jq \
        --arg status_available "$KEY_AVAILABLE" \
        --arg status_cooldown "$KEY_COOLDOWN" \
        --arg status_disabled "$KEY_DISABLED" \
        --argjson now "$now" \
        '.keys | map(select(.status != $status_disabled and (.status == $status_available or (.status == $status_cooldown and .cooldown_until <= $now)))) | .[0] // null')

    if [[ -n "$available_key" && "$available_key" != "null" ]]; then
        local fp
        fp=$(printf '%s' "$available_key" | jq -r '.fingerprint')
        local new_content
        new_content=$(printf '%s' "$content" | jq \
            --arg fp "$fp" \
            '.keys |= map(if .fingerprint == $fp then .use_count += 1 else . end)')
        _atomic_write "$KEYPOOL_STATE_FILE" "$new_content"
        _release_lock "$lock_dir"

        export KEYPOOL_LAST_USED_FINGERPRINT="$(printf '%s' "$available_key" | jq -r '.fingerprint')"
        printf '%s' "$available_key" | jq -r '.key'
        return 0
    fi

    _release_lock "$lock_dir"
    return 1
}

# keypool_release - Return key to available state
keypool_release() {
    local fingerprint="$1"
    local lock_dir
    lock_dir=$(_acquire_lock "keypool_release") || return 1
    local content
    content=$(cat "$KEYPOOL_STATE_FILE")
    local now
    now=$(date +%s)
    local new_content
    new_content=$(printf '%s' "$content" | jq \
        --arg fp "$fingerprint" \
        --argjson now "$now" \
        '.keys |= map(if .fingerprint == $fp then .status = $status_available | .cooldown_until = 0 | .last_error = "" else . end)' \
        --arg status_available "$KEY_AVAILABLE")
    _atomic_write "$KEYPOOL_STATE_FILE" "$new_content"
    _release_lock "$lock_dir"
}

# keypool_cooldown - Set key to cooldown state
keypool_cooldown() {
    local fingerprint="$1"
    local seconds="${2:-$DEFAULT_COOLDOWN}"
    local reason="${3:-}"
    local lock_dir
    lock_dir=$(_acquire_lock "keypool_cooldown") || return 1
    local now
    now=$(date +%s)
    local cooldown_until=$((now + seconds))
    local content
    content=$(cat "$KEYPOOL_STATE_FILE")
    local new_content
    new_content=$(printf '%s' "$content" | jq \
        --arg fp "$fingerprint" \
        --argjson cooldown_until "$cooldown_until" \
        --argjson error_count_inc 1 \
        --arg status_cooldown "$KEY_COOLDOWN" \
        --arg reason "$reason" \
        '.keys |= map(if .fingerprint == $fp then .status = $status_cooldown | .cooldown_until = $cooldown_until | .error_count += 1 | .last_error = $reason else . end)')
    _atomic_write "$KEYPOOL_STATE_FILE" "$new_content"
    _release_lock "$lock_dir"
}

# keypool_disable - Permanently disable a key
keypool_disable() {
    local fingerprint="$1"
    local reason="${2:-}"
    local lock_dir
    lock_dir=$(_acquire_lock "keypool_disable") || return 1
    local content
    content=$(cat "$KEYPOOL_STATE_FILE")
    local new_content
    new_content=$(printf '%s' "$content" | jq \
        --arg fp "$fingerprint" \
        --arg status_disabled "$KEY_DISABLED" \
        --arg reason "$reason" \
        '.keys |= map(if .fingerprint == $fp then .status = $status_disabled | .last_error = $reason else . end)')
    _atomic_write "$KEYPOOL_STATE_FILE" "$new_content"
    _release_lock "$lock_dir"
}

# keypool_on_http_error - Handle HTTP error response
# 401/403: immediate disable (auth failure)
# 429: rate limit cooldown
# Returns: 0 if key rotated, 1 if no keys available
keypool_on_http_error() {
    local fingerprint="$1"
    local http_status="$2"
    local error_msg="${3:-}"

    case "$http_status" in
        401|403)
            echo "[KEYPOOL] Auth failure on key ${fingerprint}: ${error_msg}" >&2
            keypool_disable "$fingerprint" "HTTP ${http_status}: ${error_msg}"
            ;;
        429)
            echo "[KEYPOOL] Rate limit on key ${fingerprint}: ${error_msg}" >&2
            keypool_cooldown "$fingerprint" "$RATE_LIMIT_COOLDOWN" "HTTP 429: ${error_msg}"
            ;;
        *)
            echo "[KEYPOOL] HTTP error ${http_status} on key ${fingerprint}: ${error_msg}" >&2
            keypool_cooldown "$fingerprint" "$DEFAULT_COOLDOWN" "HTTP ${http_status}: ${error_msg}"
            ;;
    esac

    local new_key
    if new_key=$(keypool_get_available 2>/dev/null); then
        echo "$new_key"
        return 0
    fi
    return 1
}

# keypool_on_timeout - Handle SSE timeout
# Returns: rotated key if retry succeeded, empty if no keys
keypool_on_timeout() {
    local fingerprint="$1"
    local retry_count="${2:-0}"

    if (( retry_count == 0 )); then
        echo "[KEYPOOL] SSE timeout on key ${fingerprint}, retrying same key once" >&2
        return 0
    fi

    echo "[KEYPOOL] SSE timeout retry exhausted on key ${fingerprint}, rotating" >&2
    keypool_cooldown "$fingerprint" "$DEFAULT_COOLDOWN" "SSE timeout after retry"

    local new_key
    new_key=$(keypool_get_available 2>/dev/null || echo "")
    if [[ -n "$new_key" ]]; then
        echo "$new_key"
    fi
    return 0
}

# keypool_get_stats - Get pool statistics
keypool_stats() {
    _keypool_init
    local content
    content=$(_keypool_read)
    printf '%s' "$content" | jq '{
        total: (.keys | length),
        available: (.keys | map(select(.status == "'"$KEY_AVAILABLE"'")) | length),
        cooldown: (.keys | map(select(.status == "'"$KEY_COOLDOWN"'")) | length),
        disabled: (.keys | map(select(.status == "'"$KEY_DISABLED"'")) | length),
        total_uses: (.keys | map(.use_count) | add // 0),
        keys: [.keys[] | {fingerprint, status, label, use_count, cooldown_until, error_count}]
    }'
}

# keypool_list - List keys (fingerprints only, never full keys)
keypool_list() {
    _keypool_init
    local content
    content=$(_keypool_read)
    printf '%s' "$content" | jq '.keys | map({fingerprint, status, label, use_count, cooldown_until, error_count})'
}

# keypool_remove - Remove a key by fingerprint
keypool_remove() {
    local fingerprint="$1"
    local lock_dir
    lock_dir=$(_acquire_lock "keypool_remove") || return 1
    local content
    content=$(cat "$KEYPOOL_STATE_FILE")
    local new_content
    new_content=$(printf '%s' "$content" | jq --arg fp "$fingerprint" '.keys |= map(select(.fingerprint != $fp))')
    _atomic_write "$KEYPOOL_STATE_FILE" "$new_content"
    _release_lock "$lock_dir"
}

# keypool_clear_errors - Reset error counts for a key (admin use)
keypool_clear_errors() {
    local fingerprint="$1"
    local lock_dir
    lock_dir=$(_acquire_lock "keypool_clear_errors") || return 1
    local content
    content=$(cat "$KEYPOOL_STATE_FILE")
    local new_content
    new_content=$(printf '%s' "$content" | jq \
        --arg fp "$fingerprint" \
        --arg status_available "$KEY_AVAILABLE" \
        '.keys |= map(if .fingerprint == $fp then .status = $status_available | .error_count = 0 | .cooldown_until = 0 | .last_error = "" else . end)')
    _atomic_write "$KEYPOOL_STATE_FILE" "$new_content"
    _release_lock "$lock_dir"
}

export KEYPOOL_DIR KEYPOOL_LOCK_DIR KEYPOOL_STATE_FILE
export KEYPOOL_LAST_USED_FINGERPRINT=""
export KEY_AVAILABLE KEY_COOLDOWN KEY_DISABLED
export DEFAULT_COOLDOWN RATE_LIMIT_COOLDOWN AUTH_FAILURE_COOLDOWN

_keypool_init