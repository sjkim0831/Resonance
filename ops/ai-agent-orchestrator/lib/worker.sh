#!/usr/bin/env bash
# lib/worker.sh - Shared worker functions for AI session runtime
# - Requires slot and task file
# - Calls /usr/local/bin/kilo-slot
# - Writes heartbeat every 30s
# - Captures PID, log result, and exit code
# - Retries SSE timeout up to 2 times with continuation prompt
# - Uses exponential backoff
# - Enforces one active task per slot with mkdir lock
# - Safety: never allows commit/DB/deploy without approval

set -euo pipefail

# Source status and safety libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/status.sh
source "${SCRIPT_DIR}/status.sh"
# shellcheck source=../lib/safety.sh
source "${SCRIPT_DIR}/safety.sh"

KEYPOOL_ENABLED="${KEYPOOL_ENABLED:-false}"
if [[ "$KEYPOOL_ENABLED" == "true" ]]; then
    # shellcheck source=../lib/key-pool.sh
    source "${SCRIPT_DIR}/key-pool.sh"
fi

# Worker configuration defaults
WORKER_BASE_DIR="${WORKER_BASE_DIR:-/var/tmp/agent-workers}"
WORKER_LOCK_DIR="${WORKER_LOCK_DIR:-${WORKER_BASE_DIR}/.locks}"
WORKER_LOG_DIR="${WORKER_LOG_DIR:-${WORKER_BASE_DIR}/logs}"
WORKER_RUN_DIR="${WORKER_RUN_DIR:-${WORKER_BASE_DIR}/runs}"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-30}"
SSE_TIMEOUT_SECONDS="${SSE_TIMEOUT_SECONDS:-300}"
MAX_SSE_RETRIES="${MAX_SSE_RETRIES:-2}"
EXPONENTIAL_BACKOFF_BASE="${EXPONENTIAL_BACKOFF_BASE:-2}"
EXPONENTIAL_BACKOFF_MAX="${EXPONENTIAL_BACKOFF_MAX:-60}"

# Safety: actions requiring explicit approval
readonly SAFETY_APPROVAL_ACTIONS=("COMMIT" "DB_MUTATION" "DEPLOY")

# Initialize directories
worker_init() {
    mkdir -p "$WORKER_BASE_DIR" "$WORKER_LOCK_DIR" "$WORKER_LOG_DIR" "$WORKER_RUN_DIR"
}

# _worker_log - Log with timestamp
_worker_log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] [$level] $msg"
}

# worker_acquire_slot_lock - Acquire exclusive lock for a slot (mkdir-based)
# Returns 0 on success, 1 if lock cannot be acquired
worker_acquire_slot_lock() {
    local slot="$1"
    local lock_dir="${WORKER_LOCK_DIR}/slot-${slot}.lock"

    if mkdir "$lock_dir" 2>/dev/null; then
        echo "$lock_dir" > "${WORKER_RUN_DIR}/.active-slot-${slot}.lock"
        echo "$lock_dir"
        return 0
    fi
    return 1
}

# worker_release_slot_lock - Release slot lock
worker_release_slot_lock() {
    local slot="$1"
    local lock_file="${WORKER_RUN_DIR}/.active-slot-${slot}.lock"

    if [[ -f "$lock_file" ]]; then
        local lock_dir
        lock_dir=$(cat "$lock_file" 2>/dev/null || echo "")
        rmdir "$lock_dir" 2>/dev/null || true
        rm -f "$lock_file"
    fi
}

# worker_check_slot_lock - Check if slot is already locked (active task)
worker_check_slot_lock() {
    local slot="$1"
    local lock_dir="${WORKER_LOCK_DIR}/slot-${slot}.lock"
    [[ -d "$lock_dir" ]]
}

# worker_heartbeat - Write heartbeat file for active task
worker_heartbeat() {
    local slot="$1"
    local task_id="$2"
    local pid="$3"
    local hb_file="${WORKER_RUN_DIR}/heartbeat-slot-${slot}.json"

    local now
    now=$(date +%s)
    cat > "$hb_file" <<EOF
{
  "slot": $slot,
  "task_id": "$task_id",
  "pid": $pid,
  "heartbeat_at": $now,
  "last_seen": "$(date -Iseconds)"
}
EOF
    _worker_log "DEBUG" "Heartbeat written for slot $slot task $task_id"
}

# worker_clear_heartbeat - Remove heartbeat file
worker_clear_heartbeat() {
    local slot="$1"
    local hb_file="${WORKER_RUN_DIR}/heartbeat-slot-${slot}.json"
    rm -f "$hb_file"
}

# worker_safety_check - Block dangerous actions without approval
# Returns 0 if allowed, 1 if blocked
worker_safety_check() {
    local action="$1"
    local task_id="${2:-unknown}"

    for safe_action in "${SAFETY_APPROVAL_ACTIONS[@]}"; do
        if [[ "$action" == "$safe_action" ]]; then
            _worker_log "BLOCK" "Action '$action' requires safety approval for task $task_id"
            return 1
        fi
    done
    return 0
}

# worker_validate_task_file - Validate task file exists and has required fields
worker_validate_task_file() {
    local task_file="$1"

    if [[ ! -f "$task_file" ]]; then
        _worker_log "ERROR" "Task file not found: $task_file"
        return 1
    fi

    if [[ ! -s "$task_file" ]]; then
        _worker_log "ERROR" "Task file is empty: $task_file"
        return 1
    fi

    # Validate JSON
    python3 -c "import json; json.load(open('$task_file'))" 2>/dev/null || {
        _worker_log "ERROR" "Task file is not valid JSON: $task_file"
        return 1
    }

    return 0
}

# worker_extract_task_field - Extract field from task JSON
worker_extract_task_field() {
    local task_file="$1"
    local field="$2"
    python3 -c "import json,sys; t=json.load(open('$task_file')); v=t.get('$field',''); print(json.dumps(v) if isinstance(v,dict) else v)" 2>/dev/null || echo ""
}

# worker_check_dangerous_actions - Scan task for dangerous actions that need approval
worker_check_dangerous_actions() {
    local task_file="$1"

    local payload
    payload=$(worker_extract_task_field "$task_file" "payload")

    if [[ -z "$payload" ]]; then
        return 0
    fi

    local action
    action=$(echo "$payload" | python3 -c "import json,sys; p=json.load(sys.stdin); print(p.get('action',''))" 2>/dev/null || echo "")

    worker_safety_check "$action" "$(worker_extract_task_field "$task_file" "id")"
}

# worker_calculate_backoff - Calculate exponential backoff delay
worker_calculate_backoff() {
    local attempt="$1"
    local base="${2:-$EXPONENTIAL_BACKOFF_BASE}"
    local max_delay="${3:-$EXPONENTIAL_BACKOFF_MAX}"

    local delay=$((base ** attempt))
    if (( delay > max_delay )); then
        delay=$max_delay
    fi
    echo "$delay"
}

# worker_execute_with_retry - Execute SSE command with retries and exponential backoff
# Continuation prompt references existing files
worker_execute_with_retry() {
    local slot="$1"
    local task_file="$2"
    local task_id="$3"
    local max_retries="${4:-$MAX_SSE_RETRIES}"

    local attempt=0
    local last_exit_code=0
    local last_output=""

    while (( attempt <= max_retries )); do
        if (( attempt > 0 )); then
            local delay
            delay=$(worker_calculate_backoff "$attempt")
            _worker_log "INFO" "Retry $attempt/$max_retries for task $task_id, backing off ${delay}s"
            sleep "$delay"
        fi

        # Build continuation prompt referencing existing files
        local continuation_prompt
        continuation_prompt="Continuing task ${task_id} from slot ${slot}. Existing files:"
        if [[ -f "$task_file" ]]; then
            continuation_prompt+=" task_file=${task_file}"
        fi

        # Execute with timeout and capture
        local output_file="${WORKER_LOG_DIR}/task-${task_id}-attempt-${attempt}.log"
        local pid_file="${WORKER_LOG_DIR}/task-${task_id}-pid.txt"

        _worker_log "INFO" "Executing task $task_id attempt $attempt on slot $slot"

        # Call kilo-slot with timeout handling
        local start_time
        start_time=$(date +%s)

        # Run kilo-slot and capture output with timeout
        set +e
        (
            set -e
            /usr/local/bin/kilo-slot "$slot" \
                --task-id "$task_id" \
                --continuation-prompt "$continuation_prompt" \
                --session-file "${WORKER_RUN_DIR}/session-slot-${slot}.json" \
                > "$output_file" 2>&1
        )
        last_exit_code=$?
        set -e

        local end_time
        end_time=$(date +%s)

        # Record PID if still running
        echo $$ > "$pid_file" 2>/dev/null || true

        # Check for timeout (SSE timeout)
        local duration=$((end_time - start_time))
        if (( duration >= SSE_TIMEOUT_SECONDS )); then
            _worker_log "WARN" "SSE timeout detected (${duration}s >= ${SSE_TIMEOUT_SECONDS}s) for task $task_id"
            last_exit_code=124  # Timeout exit code
            if [[ "$KEYPOOL_ENABLED" == "true" && -n "${KEYPOOL_LAST_USED_FINGERPRINT:-}" ]]; then
                keypool_on_timeout "$KEYPOOL_LAST_USED_FINGERPRINT" "$attempt"
            fi
        fi

        # Store output
        last_output=$(cat "$output_file" 2>/dev/null || echo "")

        # Check if successful
        if (( last_exit_code == 0 )); then
            _worker_log "INFO" "Task $task_id completed successfully on attempt $attempt"
            echo "$output_file"
            return 0
        fi

        ((attempt++)) || true
    done

    # All retries exhausted
    _worker_log "ERROR" "Task $task_id failed after $max_retries retries (exit code: $last_exit_code)"
    echo "$last_output" > "${WORKER_LOG_DIR}/task-${task_id}-final.log"
    return "$last_exit_code"
}

# worker_capture_result - Capture task result, PID, and exit code
worker_capture_result() {
    local task_id="$1"
    local output_file="$2"
    local exit_code="$3"
    local result_file="${WORKER_LOG_DIR}/result-${task_id}.json"

    local now
    now=$(date +%s)
    local duration=0

    if [[ -f "$output_file" ]]; then
        # Calculate duration from log file
        local first_line
        first_line=$(head -1 "$output_file" 2>/dev/null || echo "")
        # Duration is approximate
        duration=$(($now - $(stat -c %Y "$output_file" 2>/dev/null || echo "$now")))
    fi

    cat > "$result_file" <<EOF
{
  "task_id": "$task_id",
  "exit_code": $exit_code,
  "output_file": "$output_file",
  "completed_at": $now,
  "duration_seconds": $duration,
  "success": $([[ "$exit_code" == "0" ]] && echo "true" || echo "false")
}
EOF
    echo "$result_file"
}

# worker_cleanup - Cleanup worker resources for a slot
worker_cleanup() {
    local slot="$1"

    # Release slot lock
    worker_release_slot_lock "$slot"

    # Clear heartbeat
    worker_clear_heartbeat "$slot"

    # Clear session file
    rm -f "${WORKER_RUN_DIR}/session-slot-${slot}.json"

    _worker_log "INFO" "Cleaned up resources for slot $slot"
}

# Export for subshells
export WORKER_BASE_DIR WORKER_LOCK_DIR WORKER_LOG_DIR WORKER_RUN_DIR
export HEARTBEAT_INTERVAL SSE_TIMEOUT_SECONDS MAX_SSE_RETRIES
export EXPONENTIAL_BACKOFF_BASE EXPONENTIAL_BACKOFF_MAX
export KEYPOOL_ENABLED

# Initialize on source
worker_init