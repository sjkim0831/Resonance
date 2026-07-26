#!/usr/bin/env bash
# lib/approval.sh - Codex approval token enforcement for dangerous operations
# - Enforces approval tokens for COMMIT, DB_WRITE, DEPLOY
# - Dry-run by default
# - Zero-downtime deploy command generation only (no actual deploy)
# - Provides status JSON for builder UI
# - Connects queue/worker/search/inventory/worktree/leases/concurrency/failure evidence

set -euo pipefail

# Guard against multiple sourcing
[[ -n "${APPROVAL_SH_SOURCED:-}" ]] && return 0
readonly APPROVAL_SH_SOURCED=1

# Source dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/status.sh
source "${SCRIPT_DIR}/status.sh"

# Approval-specific required actions (uses DB_WRITE naming)
# This is separate from the status.sh APPROVAL_REQUIRED_ACTIONS which uses DB_MUTATION
readonly APPROVAL_TOKEN_ACTIONS=("COMMIT" "DB_WRITE" "DEPLOY")

# Approval token validity (seconds)
APPROVAL_TOKEN_TTL="${APPROVAL_TOKEN_TTL:-3600}"

mkdir -p "$APPROVAL_TOKEN_DIR" "$APPROVAL_LOG_DIR" "$APPROVAL_EVIDENCE_DIR"

# _approval_log - Log approval event (writes to log file only, not stdout)
_approval_log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="${APPROVAL_LOG_DIR}/approval-$(date +%Y%m%d).log"
    echo "[$ts] [$level] $msg" >> "$log_file"
}

# _json_escape - Escape string for JSON
_json_escape() {
    local str="$1"
    printf '%s' "$str" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || \
    printf '%s' "$str" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g; s/\n/\\n/g'
}

# _generate_token - Generate a unique approval token
_generate_token() {
    local action="$1"
    local task_id="$2"
    local worker_id="${3:-system}"
    local ts
    ts=$(date +%s)
    local rand
    rand=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
    echo "${action}-${task_id}-${worker_id}-${ts}-${rand}"
}

# approval_token_exists - Check if valid approval token exists
approval_token_exists() {
    local action="$1"
    local task_id="$2"

    local token_file="${APPROVAL_TOKEN_DIR}/${action}-${task_id}.token"

    if [[ ! -f "$token_file" ]]; then
        return 1
    fi

    # Check token age
    local token_age
    token_age=$(($(date +%s) - $(stat -c %Y "$token_file" 2>/dev/null || echo "0")))

    if (( token_age > APPROVAL_TOKEN_TTL )); then
        _approval_log "WARN" "Token expired for action=$action task_id=$task_id (age=${token_age}s)"
        rm -f "$token_file"
        return 1
    fi

    return 0
}

# approval_get_token_info - Get token metadata
approval_get_token_info() {
    local action="$1"
    local task_id="$2"

    local token_file="${APPROVAL_TOKEN_DIR}/${action}-${task_id}.token"

    if [[ ! -f "$token_file" ]]; then
        echo "{}"
        return
    fi

    if [[ -s "$token_file" ]]; then
        cat "$token_file"
    else
        echo "{}"
    fi
}

# approval_create_token - Create approval token (dry-run logs, never auto-creates for dangerous ops)
approval_create_token() {
    local action="$1"
    local task_id="$2"
    local approver="${3:-system}"
    local reason="${4:-}"

    # Never auto-create tokens for dangerous operations in dry-run mode
    if [[ "$DRY_RUN" == "true" ]]; then
        _approval_log "DRYRUN" "Would create approval token: action=$action task_id=$task_id approver=$approver"
        return 1
    fi

    local token
    token=$(_generate_token "$action" "$task_id" "$approver")
    local token_file="${APPROVAL_TOKEN_DIR}/${action}-${task_id}.token"

    local now
    now=$(date +%s)

    cat > "$token_file" <<EOF
{
  "token": "$token",
  "action": "$action",
  "task_id": "$task_id",
  "approver": "$approver",
  "reason": $(_json_escape "$reason"),
  "created_at": $now,
  "expires_at": $((now + APPROVAL_TOKEN_TTL))
}
EOF

    _approval_log "INFO" "Created approval token: action=$action task_id=$task_id token=$token"
    echo "$token"
}

# approval_revoke_token - Revoke an approval token
approval_revoke_token() {
    local action="$1"
    local task_id="$2"

    local token_file="${APPROVAL_TOKEN_DIR}/${action}-${task_id}.token"

    if [[ -f "$token_file" ]]; then
        rm -f "$token_file"
        _approval_log "INFO" "Revoked approval token: action=$action task_id=$task_id"
    fi
}

# approval_require_token - Check if action requires approval token
approval_requires_token() {
    local action="$1"

    for req_action in "${APPROVAL_TOKEN_ACTIONS[@]}"; do
        [[ "$req_action" == "$action" ]] && return 0
    done
    return 1
}

# approval_check - Check if operation is approved (returns 0 if approved, 1 if blocked)
approval_check() {
    local action="$1"
    local task_id="${2:-unknown}"
    local approver="${3:-}"

    # Safety: always block dangerous operations without explicit token
    if ! approval_requires_token "$action"; then
        return 0
    fi

    # If explicit approver provided and DRY_RUN is disabled, allow
    if [[ -n "$approver" && "$DRY_RUN" != "true" ]]; then
        if approval_token_exists "$action" "$task_id"; then
            _approval_log "INFO" "Action approved via existing token: action=$action task_id=$task_id"
            return 0
        fi
        # In non-dry-run with approver, require explicit token
        _approval_log "BLOCK" "Action requires approval token: action=$action task_id=$task_id approver=$approver"
        return 1
    fi

    # Dry-run mode: always block dangerous operations with clear message
    if [[ "$DRY_RUN" == "true" ]]; then
        _approval_log "DRYRUN-BLOCK" "Action blocked in dry-run mode: action=$action task_id=$task_id"
        return 1
    fi

    # Check for existing valid token
    if approval_token_exists "$action" "$task_id"; then
        return 0
    fi

    _approval_log "BLOCK" "Action requires approval token: action=$action task_id=$task_id"
    return 1
}

# approval_enforce_commit - Enforce approval for commit operations
approval_enforce_commit() {
    local task_id="${1:-unknown}"
    local worktree_path="${2:-}"
    local approver="${3:-}"

    _approval_log "INFO" "Enforcing commit approval: task_id=$task_id worktree=$worktree_path"

    if ! approval_check "COMMIT" "$task_id" "$approver"; then
        _approval_log "BLOCK" "Commit blocked: task_id=$task_id"
        return 1
    fi

    # Log evidence for worktree commit
    if [[ -n "$worktree_path" ]]; then
        _approval_log "EVIDENCE" "Commit approved for worktree: $worktree_path"
    fi

    return 0
}

# approval_enforce_db_write - Enforce approval for DB write operations
approval_enforce_db_write() {
    local task_id="${1:-unknown}"
    local db_name="${2:-}"
    local approver="${3:-}"

    _approval_log "INFO" "Enforcing DB_WRITE approval: task_id=$task_id db=$db_name"

    if ! approval_check "DB_WRITE" "$task_id" "$approver"; then
        _approval_log "BLOCK" "DB_WRITE blocked: task_id=$task_id"
        return 1
    fi

    return 0
}

# approval_enforce_deploy - Enforce approval for deploy operations
# Generates zero-downtime deploy commands but NEVER executes them
approval_enforce_deploy() {
    local task_id="${1:-unknown}"
    local target_env="${2:-production}"
    local approver="${3:-}"

    _approval_log "INFO" "Enforcing DEPLOY approval: task_id=$task_id env=$target_env"

    if ! approval_check "DEPLOY" "$task_id" "$approver"; then
        _approval_log "BLOCK" "DEPLOY blocked: task_id=$task_id"
        return 1
    fi

    # Generate zero-downtime deploy commands (dry-run output only)
    local deploy_commands
    deploy_commands=$(approval_generate_deploy_commands "$task_id" "$target_env")

    _approval_log "INFO" "Deploy commands generated (not executed): task_id=$task_id"
    echo "$deploy_commands"

    return 0
}

# approval_generate_deploy_commands - Generate zero-downtime deploy commands
approval_generate_deploy_commands() {
    local task_id="$1"
    local target_env="${2:-production}"

    # Always generate commands, never execute
    cat <<EOF
{
  "task_id": "$task_id",
  "target_env": "$target_env",
  "deploy_strategy": "zero-downtime",
  "commands": [
    "kubectl rollout status deployment/carbonet-runtime -n carbonet-prod",
    "kubectl set image deployment/carbonet-runtime carbonet-runtime=\${IMAGE_TAG} -n carbonet-prod",
    "kubectl rollout status deployment/carbonet-runtime -n carbonet-prod"
  ],
  "pre_deploy_checks": [
    "verify_patroni_quorum",
    "verify_replicas_ready",
    "verify_health_endpoint"
  ],
  "rollback_plan": [
    "kubectl rollout undo deployment/carbonet-runtime -n carbonet-prod"
  ],
  "generated_at": $(date +%s),
  "dry_run": true,
  "note": "Commands generated but not executed. Execute with valid approval token."
}
EOF
}

# approval_record_failure - Record failure evidence for concurrency/lease issues
approval_record_failure() {
    local task_id="$1"
    local failure_type="$2"
    local details="${3:-}"

    local evidence_file="${APPROVAL_EVIDENCE_DIR}/${task_id}-${failure_type}-$(date +%s).json"
    local now
    now=$(date +%s)

    cat > "$evidence_file" <<EOF
{
  "task_id": "$task_id",
  "failure_type": "$failure_type",
  "details": $(_json_escape "$details"),
  "timestamp": $now,
  "host": "$(hostname)",
  "user": "${USER:-unknown}",
  "dry_run": $DRY_RUN
}
EOF

    _approval_log "EVIDENCE" "Recorded failure: task_id=$task_id type=$failure_type"
    echo "$evidence_file"
}

# approval_check_concurrency - Check for concurrent operations on same resource
approval_check_concurrency() {
    local resource_type="$1"
    local resource_id="$2"
    local current_worker="$3"

    local lock_file="${APPROVAL_CONFIG_DIR}/.locks/${resource_type}-${resource_id}.lock"

    if [[ -f "$lock_file" ]]; then
        local lock_holder
        lock_holder=$(cat "$lock_file" 2>/dev/null || echo "unknown")

        if [[ "$lock_holder" != "$current_worker" ]]; then
            _approval_log "WARN" "Concurrent access detected: resource=${resource_type}:${resource_id} holder=$lock_holder requester=$current_worker"
            echo "BLOCKED: Resource ${resource_type}:${resource_id} is locked by ${lock_holder}"
            return 1
        fi
    fi

    # Create lock
    mkdir -p "$(dirname "$lock_file")"
    echo "$current_worker" > "$lock_file"
    return 0
}

# approval_release_concurrency - Release concurrency lock
approval_release_concurrency() {
    local resource_type="$1"
    local resource_id="$2"
    local current_worker="$3"

    local lock_file="${APPROVAL_CONFIG_DIR}/.locks/${resource_type}-${resource_id}.lock"

    if [[ -f "$lock_file" ]]; then
        local lock_holder
        lock_holder=$(cat "$lock_file" 2>/dev/null || echo "")

        if [[ "$lock_holder" == "$current_worker" ]]; then
            rm -f "$lock_file"
            _approval_log "INFO" "Released lock: resource=${resource_type}:${resource_id}"
        fi
    fi
}

# approval_status_json - Generate status JSON for builder UI
approval_status_json() {
    local task_id="${1:-}"
    local include_details="${2:-false}"

    local now
    now=$(date +%s)

    local status_json
    status_json=$(cat <<EOF
{
  "timestamp": $now,
  "dry_run": $DRY_RUN,
  "approval_config": {
    "token_ttl": $APPROVAL_TOKEN_TTL,
    "required_actions": $(printf '%s\n' "${APPROVAL_TOKEN_ACTIONS[@]}" | jq -R . | jq -s .)
  },
  "pending_approvals": [],
  "active_locks": [],
  "recent_failures": []
}
EOF
)

    # Add task-specific details if requested
    if [[ -n "$task_id" && "$include_details" == "true" ]]; then
        # Check each dangerous action
        local commit_status="blocked"
        local db_write_status="blocked"
        local deploy_status="blocked"

        if approval_token_exists "COMMIT" "$task_id"; then
            commit_status="approved"
        fi
        if approval_token_exists "DB_WRITE" "$task_id"; then
            db_write_status="approved"
        fi
        if approval_token_exists "DEPLOY" "$task_id"; then
            deploy_status="approved"
        fi

        status_json=$(echo "$status_json" | python3 -c "
import json, sys
d = json.load(sys.stdin)
d['task_approvals'] = {
    'COMMIT': '$commit_status',
    'DB_WRITE': '$db_write_status',
    'DEPLOY': '$deploy_status'
}
d['task_id'] = '$task_id'
print(json.dumps(d, indent=2))
")
    fi

    echo "$status_json"
}

# approval_list_tokens - List all valid approval tokens
approval_list_tokens() {
    local action_filter="${1:-}"

    echo "["
    local first=true

    for token_file in "${APPROVAL_TOKEN_DIR}"/*.token; do
        [[ -f "$token_file" ]] || continue

        local file_action
        file_action=$(basename "$token_file" | cut -d'-' -f1)

        if [[ -n "$action_filter" && "$file_action" != "$action_filter" ]]; then
            continue
        fi

        if [[ -s "$token_file" ]]; then
            if [[ "$first" != "true" ]]; then
                echo ","
            fi
            cat "$token_file"
            first=false
        fi
    done

    echo "]"
}

# approval_cleanup_expired - Remove expired tokens
approval_cleanup_expired() {
    local cleaned=0

    for token_file in "${APPROVAL_TOKEN_DIR}"/*.token; do
        [[ -f "$token_file" ]] || continue

        local token_age
        token_age=$(($(date +%s) - $(stat -c %Y "$token_file" 2>/dev/null || echo "0")))

        if (( token_age > APPROVAL_TOKEN_TTL )); then
            rm -f "$token_file"
            ((cleaned++)) || true
        fi
    done

    _approval_log "INFO" "Cleaned up $cleaned expired tokens"
    echo "$cleaned"
}

# approval_get_worktree_evidence - Get worktree lease/concurrency evidence
approval_get_worktree_evidence() {
    local worktree_path="${1:-}"

    local evidence=""
    local now
    now=$(date +%s)

    # Check for stale leases
    if [[ -d "${APPROVAL_CONFIG_DIR}/.locks" ]]; then
        local stale_leases
        stale_leases=$(find "${APPROVAL_CONFIG_DIR}/.locks" -name "worktree-*.lock" -type d 2>/dev/null | while read -r lock_dir; do
            local lock_age=$((now - $(stat -c %Y "$lock_dir" 2>/dev/null || echo "0")))
            if (( lock_age > LEASE_EXPIRY_SECONDS )); then
                echo "$lock_dir"
            fi
        done | wc -l)

        evidence+="stale_worktree_leases:$stale_leases "
    fi

    # Get recent failures
    local recent_failures
    recent_failures=$(find "${APPROVAL_EVIDENCE_DIR}" -name "*.json" -mmin -60 2>/dev/null | wc -l)

    cat <<EOF
{
  "worktree_path": "$worktree_path",
  "timestamp": $now,
  "stale_leases": ${stale_leases:-0},
  "recent_failures": $recent_failures,
  "dry_run": $DRY_RUN
}
EOF
}

# Export for subshells
export APPROVAL_CONFIG_DIR APPROVAL_TOKEN_DIR APPROVAL_LOG_DIR APPROVAL_EVIDENCE_DIR
export DRY_RUN APPROVAL_TOKEN_TTL