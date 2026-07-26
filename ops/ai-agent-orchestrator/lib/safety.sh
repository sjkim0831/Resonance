#!/usr/bin/env bash
# lib/safety.sh - Safety checks including approval flags blocking commit/DB/deploy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/status.sh
source "${SCRIPT_DIR}/status.sh"

# Safety configuration
SAFETY_ENABLED="${SAFETY_ENABLED:-true}"
DRY_RUN="${DRY_RUN:-false}"
APPROVAL_REQUIRED="${APPROVAL_REQUIRED:-true}"

# Log file for safety events
SAFETY_LOG="${SAFETY_LOG:-/var/tmp/agent-safety.log}"

# _safety_log - Log safety event
_safety_log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] [$level] $msg" >> "$SAFETY_LOG"
}

# safety_enabled - Check if safety checks are enabled
safety_enabled() {
    [[ "$SAFETY_ENABLED" == "true" ]]
}

# safety_check_approval - Verify approval before dangerous operations
# Returns 0 if approved, 1 otherwise
safety_check_approval() {
    local action="$1"
    local task_id="${2:-}"
    local approver="${3:-}"

    if ! safety_enabled; then
        _safety_log "WARN" "Safety checks disabled for action: $action"
        return 0
    fi

    if ! status_requires_approval "$action"; then
        return 0
    fi

    if [[ -n "$approver" ]]; then
        _safety_log "INFO" "Action $action approved by $approver for task $task_id"
        return 0
    fi

    _safety_log "BLOCK" "Action $action requires approval for task $task_id"
    return 1
}

# safety_check_task_approval - Check if task has required approval
safety_check_task_approval() {
    local task_json="$1"

    local required_approval
    required_approval=$(echo "$task_json" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('required_approval',''))" 2>/dev/null || echo "")

    if [[ -z "$required_approval" ]]; then
        return 0
    fi

    local approved_by
    approved_by=$(echo "$task_json" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('approved_by',''))" 2>/dev/null || echo "")

    if [[ -n "$approved_by" ]]; then
        return 0
    fi

    _safety_log "BLOCK" "Task requires approval ($required_approval) but not yet approved"
    return 1
}

# safety_block_commit - Block commit if not approved
safety_block_commit() {
    local task_id="${1:-}"
    local approver="${2:-}"

    if [[ "$APPROVAL_REQUIRED" != "true" ]]; then
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        _safety_log "DRYRUN" "Would execute COMMIT for task $task_id"
        return 0
    fi

    safety_check_approval "COMMIT" "$task_id" "$approver"
}

# safety_block_db_mutation - Block DB mutation if not approved
safety_block_db_mutation() {
    local task_id="${1:-}"
    local approver="${2:-}"

    if [[ "$APPROVAL_REQUIRED" != "true" ]]; then
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        _safety_log "DRYRUN" "Would execute DB_MUTATION for task $task_id"
        return 0
    fi

    safety_check_approval "DB_MUTATION" "$task_id" "$approver"
}

# safety_block_deploy - Block deploy if not approved
safety_block_deploy() {
    local task_id="${1:-}"
    local approver="${2:-}"

    if [[ "$APPROVAL_REQUIRED" != "true" ]]; then
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        _safety_log "DRYRUN" "Would execute DEPLOY for task $task_id"
        return 0
    fi

    safety_check_approval "DEPLOY" "$task_id" "$approver"
}

# safety_block_push - Block push if not approved
safety_block_push() {
    local task_id="${1:-}"
    local approver="${2:-}"

    if [[ "$APPROVAL_REQUIRED" != "true" ]]; then
        return 0
    fi

    safety_check_approval "PUSH" "$task_id" "$approver"
}

# safety_block_delete - Block delete if not approved
safety_block_delete() {
    local task_id="${1:-}"
    local approver="${2:-}"

    if [[ "$APPROVAL_REQUIRED" != "true" ]]; then
        return 0
    fi

    safety_check_approval "DELETE" "$task_id" "$approver"
}

# safety_require_review - Require review before continuing
safety_require_review() {
    local task_id="${1:-}"
    local review_status="${2:-}"

    if ! safety_enabled; then
        return 0
    fi

    if [[ "$review_status" != "$STATUS_REVIEW_REQUIRED" ]]; then
        return 0
    fi

    _safety_log "BLOCK" "Task $task_id requires review before proceeding"
    return 1
}

# safety_allow_proceed - Check if task can proceed
safety_allow_proceed() {
    local task_json="$1"

    local status
    status=$(echo "$task_json" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('status',''))" 2>/dev/null || echo "")

    case "$status" in
        "$STATUS_PENDING"|"$STATUS_RETRYING"|"$STATUS_STALLED")
            safety_check_task_approval "$task_json"
            ;;
        "$STATUS_RUNNING"|"$STATUS_BLOCKED"|"$STATUS_REVIEW_REQUIRED")
            return 0
            ;;
        "$STATUS_VERIFIED"|"$STATUS_DEPLOY_READY"|"$STATUS_FAILED")
            _safety_log "INFO" "Task $task_id in terminal status: $status"
            return 0
            ;;
        *)
            _safety_log "WARN" "Unknown status: $status"
            return 1
            ;;
    esac
}

# safety_enforce_dry_run - Enforce dry-run mode for safety
safety_enforce_dry_run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        _safety_log "INFO" "Running in DRY_RUN mode - no changes will be made"
        return 0
    fi
    return 1
}

# safety_verify_git_clean - Verify git working tree is clean
safety_verify_git_clean() {
    local git_dir="${1:-$(pwd)}"

    if ! command -v git >/dev/null 2>&1; then
        return 0
    fi

    if ! git -C "$git_dir" rev-parse --git-dir >/dev/null 2>&1; then
        return 0
    fi

    if [[ -n "$(git -C "$git_dir" status --porcelain)" ]]; then
        _safety_log "WARN" "Git working tree is not clean in $git_dir"
        return 1
    fi

    return 0
}

# safety_verify_branch - Verify branch is safe for operation
safety_verify_branch() {
    local branch="${1:-}"
    local allowed_branch="${2:-main}"

    if [[ "$branch" == "$allowed_branch" ]]; then
        _safety_log "WARN" "Attempted operation on protected branch: $branch"
        return 1
    fi

    return 0
}

# safety_can_deploy - Combined check for deploy eligibility
safety_can_deploy() {
    local task_json="$1"

    local status
    status=$(echo "$task_json" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('status',''))" 2>/dev/null || echo "")

    if [[ "$status" != "$STATUS_VERIFIED" && "$status" != "$STATUS_DEPLOY_READY" ]]; then
        _safety_log "BLOCK" "Task not in deployable status: $status"
        return 1
    fi

    safety_check_task_approval "$task_json"
}

export SAFETY_ENABLED DRY_RUN APPROVAL_REQUIRED SAFETY_LOG