#!/usr/bin/env bash
# lib/queue.sh - JSON file queue with atomic claim, heartbeat, lease expiry, retries

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/status.sh
source "${SCRIPT_DIR}/status.sh"

QUEUE_DIR="${QUEUE_DIR:-/var/tmp/agent-queue}"
QUEUE_LOCK_DIR="${QUEUE_LOCK_DIR:-${QUEUE_DIR}/.locks}"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-30}"
LEASE_EXPIRY_SECONDS="${LEASE_EXPIRY_SECONDS:-300}"
MAX_RETRIES="${MAX_RETRIES:-3}"

queue_init() {
    mkdir -p "$QUEUE_DIR" "$QUEUE_LOCK_DIR"
    if [[ ! -f "${QUEUE_DIR}/queue.json" ]]; then
        printf '%s\n' '{"tasks":[],"next_id":1}' > "${QUEUE_DIR}/queue.json"
    fi
}

_acquire_lock() {
    local lock_name="$1"
    local lock_dir="${QUEUE_LOCK_DIR}/${lock_name}.lock"
    if mkdir "$lock_dir" 2>/dev/null; then
        printf '%s' "$lock_dir"
        return 0
    fi
    return 1
}

_release_lock() {
    local lock_dir="$1"
    rmdir "$lock_dir" 2>/dev/null || true
}

_atomic_write() {
    local file="$1"
    local json="$2"
    if ! printf '%s' "$json" | jq -e . >/dev/null 2>&1; then
        printf 'ERROR: Invalid JSON in _atomic_write\n' >&2
        return 1
    fi
    local tmp="${file}.tmp.$$"
    printf '%s' "$json" > "$tmp" && mv "$tmp" "$file"
}

_read_queue() {
    local lock_dir
    lock_dir=$(_acquire_lock "queue_read") || return 1
    local content
    content=$(cat "${QUEUE_DIR}/queue.json" 2>/dev/null)
    _release_lock "$lock_dir"
    local validated
    validated=$(printf '%s' "$content" | jq -e . 2>/dev/null)
    if [[ $? -eq 0 && -n "$validated" ]]; then
        printf '%s' "$validated"
    else
        printf '%s' '{"tasks":[],"next_id":1}'
    fi
}

queue_add() {
    local desc="$1"
    local payload="${2}"
    local priority="${3:-0}"
    local required_approval="${4:-}"
    local approved_by="${5:-}"
    [[ -z "$payload" ]] && payload='{"empty":true}'
    queue_init
    local lock_dir
    lock_dir=$(_acquire_lock "queue_add") || { printf 'ERROR: Could not acquire lock\n' >&2; return 1; }
    local content
    content=$(cat "${QUEUE_DIR}/queue.json")
    local next_id
    next_id=$(printf '%s' "$content" | jq -r '.next_id // 1')
    local now
    now=$(date +%s)
    local task_json
    task_json=$(printf '{}' | jq \
        --argjson id "$next_id" \
        --arg desc "$desc" \
        --arg payload "$payload" \
        --arg status "$STATUS_PENDING" \
        --argjson priority "$priority" \
        --arg required_approval "$required_approval" \
        --arg approved_by "$approved_by" \
        --argjson created_at "$now" \
        --argjson updated_at "$now" \
        --argjson heartbeat_at "$now" \
        --argjson retries 0 \
        --argjson max_retries "$MAX_RETRIES" \
        '.id = $id | .description = $desc | .payload = ($payload | fromjson) | .status = $status | .priority = $priority | .required_approval = $required_approval | .approved_by = $approved_by | .created_at = $created_at | .updated_at = $updated_at | .heartbeat_at = $heartbeat_at | .retries = $retries | .max_retries = $max_retries | .error = null | .lease_expires_at = null')
    local new_content
    new_content=$(printf '%s' "$content" | jq --argjson task "$task_json" '.tasks += [$task] | .next_id += 1')
    _atomic_write "${QUEUE_DIR}/queue.json" "$new_content"
    _release_lock "$lock_dir"
    printf '%s' "$next_id"
}

queue_claim() {
    local worker_id="${1:-$$}"
    local now
    now=$(date +%s)
    local lease_deadline=$((now + LEASE_EXPIRY_SECONDS))
    queue_init
    local lock_dir
    lock_dir=$(_acquire_lock "queue_claim") || return 1
    local content
    content=$(cat "${QUEUE_DIR}/queue.json")

    # Find first claimable task id (sorted by priority ASC, then created_at ASC for FIFO)
    local target_id
    target_id=$(printf '%s' "$content" | jq -r \
        --arg status_pending "$STATUS_PENDING" \
        --arg status_stalled "$STATUS_STALLED" \
        --arg status_retrying "$STATUS_RETRYING" \
        --argjson max_retries "$MAX_RETRIES" \
        'def can_claim: (.status as $s | ($s == $status_pending or $s == $status_stalled or $s == $status_retrying)) and (if (.required_approval | length) > 0 then (.approved_by | length) > 0 else true end) and ((.retries // 0) < (.max_retries // $max_retries)); ([.tasks[] | select(can_claim)] | sort_by(.priority, .created_at) | .[0] | .id) // empty')

    if [[ -n "$target_id" && "$target_id" != "null" ]]; then
        # Single jq transformation: preserve all tasks, update exactly selected task to RUNNING
        local new_content
        new_content=$(printf '%s' "$content" | jq \
            --argjson now "$now" \
            --argjson lease_deadline "$lease_deadline" \
            --arg worker_id "$worker_id" \
            --arg status_running "$STATUS_RUNNING" \
            --argjson target_id "$target_id" \
            '(.tasks | map(if (.id | tonumber) == ($target_id | tonumber) then .status = $status_running | .worker_id = $worker_id | .heartbeat_at = $now | .lease_expires_at = $lease_deadline else . end)) as $updated | {tasks: $updated, next_id: .next_id}')

        if ! printf '%s' "$new_content" | jq -e . >/dev/null 2>&1; then
            _release_lock "$lock_dir"
            return 1
        fi

        _atomic_write "${QUEUE_DIR}/queue.json" "$new_content"
        _release_lock "$lock_dir"

        # Return the claimed task
        printf '%s' "$new_content" | jq -c --argjson target_id "$target_id" '.tasks | map(select((.id | tonumber) == $target_id)) | .[0]'
        return 0
    fi
    _release_lock "$lock_dir"
    return 1
}

queue_claim_with_mkdir() {
    local worker_id="${1:-$$}"
    local task_id="$2"
    local task_file="${QUEUE_DIR}/tasks/${task_id}.json"
    local claim_file="${QUEUE_DIR}/claims/${task_id}-${worker_id}.claim"
    mkdir -p "${QUEUE_DIR}/tasks" "${QUEUE_DIR}/claims"
    if [[ -f "$claim_file" ]]; then
        return 1
    fi
    if mkdir "$claim_file" 2>/dev/null; then
        local now
        now=$(date +%s)
        local lease_deadline=$((now + LEASE_EXPIRY_SECONDS))
        if [[ -f "$task_file" ]]; then
            local current
            current=$(cat "$task_file")
            local can_claim
            can_claim=$(printf '%s' "$current" | jq \
                --arg status_pending "$STATUS_PENDING" \
                --arg status_stalled "$STATUS_STALLED" \
                --arg status_retrying "$STATUS_RETRYING" \
                --argjson max_retries "$MAX_RETRIES" \
                '(.status == $status_pending or .status == $status_stalled or .status == $status_retrying) and (if .required_approval != "" then .approved_by != "" else true end) and (.retries // 0) < (.max_retries // $max_retries)')
            if [[ "$can_claim" == "true" ]]; then
                local updated
                updated=$(printf '%s' "$current" | jq \
                    --argjson now "$now" \
                    --argjson lease_deadline "$lease_deadline" \
                    --arg worker_id "$worker_id" \
                    --arg status_running "$STATUS_RUNNING" \
                    '.status = $status_running | .worker_id = $worker_id | .heartbeat_at = $now | .lease_expires_at = $lease_deadline')
                _atomic_write "$task_file" "$updated"
                return 0
            fi
        fi
        rmdir "$claim_file" 2>/dev/null || true
    fi
    return 1
}

queue_heartbeat() {
    local task_id="$1"
    local worker_id="${2:-$$}"
    local now
    now=$(date +%s)
    local lease_deadline=$((now + LEASE_EXPIRY_SECONDS))
    local task_file="${QUEUE_DIR}/tasks/${task_id}.json"
    if [[ -f "$task_file" ]]; then
        local current
        current=$(cat "$task_file")
        local can_update
        can_update=$(printf '%s' "$current" | jq --arg worker_id "$worker_id" --arg status_running "$STATUS_RUNNING" '.worker_id == $worker_id and .status == $status_running')
        if [[ "$can_update" == "true" ]]; then
            local updated
            updated=$(printf '%s' "$current" | jq --argjson now "$now" --argjson lease_deadline "$lease_deadline" '.heartbeat_at = $now | .lease_expires_at = $lease_deadline')
            _atomic_write "$task_file" "$updated"
            printf 'OK'
        else
            printf 'NOT_CLAIMED'
        fi
        return 0
    fi
    local lock_dir
    lock_dir=$(_acquire_lock "queue_heartbeat") || return 1
    local content
    content=$(cat "${QUEUE_DIR}/queue.json")
    local found
    found=$(printf '%s' "$content" | jq --argjson task_id "$task_id" --arg worker_id "$worker_id" --arg status_running "$STATUS_RUNNING" '.tasks | to_entries | map(select(.value.id == $task_id and .value.worker_id == $worker_id and .value.status == $status_running)) | first')
    if [[ "$found" != "null" ]]; then
        local idx
        idx=$(printf '%s' "$found" | jq '.key')
        local updated
        updated=$(printf '%s' "$content" | jq --argjson idx "$idx" --argjson now "$now" --argjson lease_deadline "$lease_deadline" '.tasks[$idx | tonumber].heartbeat_at = $now | .tasks[$idx | tonumber].lease_expires_at = $lease_deadline')
        _atomic_write "${QUEUE_DIR}/queue.json" "$updated"
        _release_lock "$lock_dir"
        printf 'OK'
    else
        _release_lock "$lock_dir"
        printf 'NOT_CLAIMED'
    fi
}

queue_update_status() {
    local task_id="$1"
    local new_status="$2"
    local error_msg="${3:-}"
    if ! status_is_valid "$new_status"; then
        printf 'ERROR: Invalid status: %s\n' "$new_status" >&2
        return 1
    fi
    local now
    now=$(date +%s)
    local task_file="${QUEUE_DIR}/tasks/${task_id}.json"
    if [[ -f "$task_file" ]]; then
        local current
        current=$(cat "$task_file")
        local updated
        if [[ -n "$error_msg" ]]; then
            updated=$(printf '%s' "$current" | jq --arg status "$new_status" --argjson updated_at "$now" --arg error "$error_msg" '.status = $status | .updated_at = $updated_at | .error = $error')
        else
            updated=$(printf '%s' "$current" | jq --arg status "$new_status" --argjson updated_at "$now" '.status = $status | .updated_at = $updated_at')
        fi
        _atomic_write "$task_file" "$updated"
        return 0
    fi
    local lock_dir
    lock_dir=$(_acquire_lock "queue_update_status") || return 1
    local content
    content=$(cat "${QUEUE_DIR}/queue.json")
    local new_content
    if [[ -n "$error_msg" ]]; then
        new_content=$(printf '%s' "$content" | jq --argjson task_id "$task_id" --arg status "$new_status" --argjson updated_at "$now" --arg error "$error_msg" '.tasks |= map(if (.id | tonumber) == ($task_id | tonumber) then .status = $status | .updated_at = $updated_at | .error = $error else . end)')
    else
        new_content=$(printf '%s' "$content" | jq --argjson task_id "$task_id" --arg status "$new_status" --argjson updated_at "$now" '.tasks |= map(if (.id | tonumber) == ($task_id | tonumber) then .status = $status | .updated_at = $updated_at else . end)')
    fi
    _atomic_write "${QUEUE_DIR}/queue.json" "$new_content"
    _release_lock "$lock_dir"
}

queue_complete() {
    local task_id="$1"
    local result_status="${2:-$STATUS_VERIFIED}"
    queue_update_status "$task_id" "$result_status"
}

queue_fail() {
    local task_id="$1"
    local error_msg="${2:-Unknown error}"
    local task_file="${QUEUE_DIR}/tasks/${task_id}.json"
    local retries=0
    local max_retries=$MAX_RETRIES
    if [[ -f "$task_file" ]]; then
        retries=$(jq -r '.retries // 0' "$task_file" 2>/dev/null || echo "0")
        max_retries=$(jq -r '.max_retries // '"$MAX_RETRIES" "$task_file" 2>/dev/null || echo "$MAX_RETRIES")
    else
        local content
        content=$(_read_queue)
        retries=$(printf '%s' "$content" | jq --argjson task_id "$task_id" '[.tasks[] | select(.id == $task_id)] | .[0].retries // 0')
        max_retries=$(printf '%s' "$content" | jq --argjson task_id "$task_id" '[.tasks[] | select(.id == $task_id)] | .[0].max_retries // '"$MAX_RETRIES")
    fi
    if (( retries < max_retries )); then
        local new_retries=$((retries + 1))
        local lock_dir
        lock_dir=$(_acquire_lock "queue_fail") || return 1
        local content
        content=$(cat "${QUEUE_DIR}/queue.json")
        local new_content
        new_content=$(printf '%s' "$content" | jq --argjson task_id "$task_id" --argjson new_retries "$new_retries" --arg status "$STATUS_RETRYING" --arg error "$error_msg" '.tasks |= map(if (.id | tonumber) == ($task_id | tonumber) then .status = $status | .retries = $new_retries | .error = $error else . end)')
        _atomic_write "${QUEUE_DIR}/queue.json" "$new_content"
        _release_lock "$lock_dir"
    else
        queue_update_status "$task_id" "$STATUS_FAILED" "$error_msg (max retries reached)"
    fi
}

queue_requeue() {
    local task_id="$1"
    queue_update_status "$task_id" "$STATUS_PENDING"
}

queue_list() {
    local status_filter="${1:-}"
    local content
    content=$(_read_queue)
    if [[ -n "$status_filter" ]]; then
        printf '%s' "$content" | jq --arg status "$status_filter" '.tasks | map(select(.status == $status))'
    else
        printf '%s' "$content" | jq '.tasks'
    fi
}

queue_get() {
    local task_id="$1"
    local content
    content=$(_read_queue)
    printf '%s' "$content" | jq --argjson task_id "$task_id" '.tasks | map(select(.id == $task_id)) | .[0] // null'
}

queue_expire_leases() {
    local now
    now=$(date +%s)
    local lock_dir
    lock_dir=$(_acquire_lock "queue_expire_leases") || return 1
    local content
    content=$(cat "${QUEUE_DIR}/queue.json")
    local new_content
    new_content=$(printf '%s' "$content" | jq --argjson now "$now" --arg status_running "$STATUS_RUNNING" --arg status_stalled "$STATUS_STALLED" '.tasks |= map(if .status == $status_running and (.lease_expires_at != null) and .lease_expires_at < $now then .status = $status_stalled | .updated_at = $now else . end)')
    _atomic_write "${QUEUE_DIR}/queue.json" "$new_content"
    _release_lock "$lock_dir"
}

queue_approve() {
    local task_id="$1"
    local approver="${2:-system}"
    local lock_dir
    lock_dir=$(_acquire_lock "queue_approve") || return 1
    local content
    content=$(cat "${QUEUE_DIR}/queue.json")
    local new_content
    new_content=$(printf '%s' "$content" | jq --argjson task_id "$task_id" --arg approver "$approver" '.tasks |= map(if (.id | tonumber) == ($task_id | tonumber) then .approved_by = $approver else . end)')
    _atomic_write "${QUEUE_DIR}/queue.json" "$new_content"
    _release_lock "$lock_dir"
}

queue_pending_count() {
    local content
    content=$(_read_queue)
    printf '%s' "$content" | jq '[.tasks[] | select(.status == "'"$STATUS_PENDING"'" or .status == "'"$STATUS_RETRYING"'" or .status == "'"$STATUS_STALLED"'")] | length'
}

export QUEUE_DIR QUEUE_LOCK_DIR HEARTBEAT_INTERVAL LEASE_EXPIRY_SECONDS MAX_RETRIES