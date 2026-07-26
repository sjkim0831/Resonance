#!/usr/bin/env bash
# lib/worktree.sh - Per-task git worktree management with dirty-tree protection and conflict denial
# Features:
# - Create worktrees for specific tasks
# - Status checking for worktrees
# - Cleanup with dirty-tree protection
# - Conflict denial (prevents multiple worktrees for same task)
# - Never commit/push/deploy without approval

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./status.sh
source "${SCRIPT_DIR}/status.sh"
# shellcheck source=./safety.sh
source "${SCRIPT_DIR}/safety.sh"

# Worktree configuration
WORKTREE_BASE_DIR="${WORKTREE_BASE_DIR:-/tmp/resonance-agent-worktrees}"
WORKTREE_META_DIR="${WORKTREE_META_DIR:-${WORKTREE_BASE_DIR}/.meta}"
WORKTREE_LOCK_DIR="${WORKTREE_LOCK_DIR:-${WORKTREE_BASE_DIR}/.locks}"
WORKTREE_GIT_DIR="${WORKTREE_GIT_DIR:-/opt/Resonance}"
WORKTREE_MAIN_BRANCH="${WORKTREE_MAIN_BRANCH:-main}"
WORKTREE_DIR_PREFIX="${WORKTREE_DIR_PREFIX:-}"  # Empty prefix for cleaner paths

# Protected branch patterns (deny list - these cannot be used for worktrees)
readonly PROTECTED_BRANCH_PATTERNS=("main" "master" "develop" "release/*" "hotfix/*")

# Lease configuration (delegates to file-lease.sh)
LEASE_BASE_DIR="${LEASE_BASE_DIR:-${WORKTREE_BASE_DIR}/.leases}"

# Initialize directories
worktree_init() {
    mkdir -p "$WORKTREE_BASE_DIR" "$WORKTREE_META_DIR" "$WORKTREE_LOCK_DIR"
}

# _worktree_log - Log with timestamp
_worktree_log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] [$level] worktree: $msg"
}

# _worktree_is_protected_branch - Check if branch is protected (deny list)
_worktree_is_protected_branch() {
    local branch="$1"
    for pattern in "${PROTECTED_BRANCH_PATTERNS[@]}"; do
        if [[ "$branch" == $pattern ]]; then
            return 0  # Is protected
        fi
    done
    return 1  # Not protected
}

# _worktree_validate_path_config - Verify base directory is safe
_worktree_validate_path_config() {
    local git_root
    git_root=$(git -C "$WORKTREE_GIT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")

    if [[ -z "$git_root" ]]; then
        _worktree_log "ERROR" "Cannot determine git repository root"
        return 1
    fi

    if [[ "$WORKTREE_BASE_DIR" == "$git_root"* ]]; then
        _worktree_log "ERROR" "WORKTREE_BASE_DIR cannot be inside git repository: $WORKTREE_BASE_DIR"
        return 1
    fi

    if [[ "$WORKTREE_BASE_DIR" != /* ]]; then
        _worktree_log "ERROR" "WORKTREE_BASE_DIR must be an absolute path: $WORKTREE_BASE_DIR"
        return 1
    fi

    return 0
}

# _worktree_audit_git_state - Log git state before operations
_worktree_audit_git_state() {
    local operation="$1"
    local target="$2"
    local before_state
    before_state=$(git -C "$WORKTREE_GIT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    _worktree_log "AUDIT" "GIT_OPERATION: $operation on $target (from branch: $before_state)"
}

# worktree_preflight_check - Verify clean state before operations
worktree_preflight_check() {
    local task_id="$1"

    # Check root repository is clean
    if ! safety_verify_git_clean "$WORKTREE_GIT_DIR"; then
        _worktree_log "ERROR" "Root repository has uncommitted changes. Cannot proceed."
        return 1
    fi

    # Validate path configuration
    if ! _worktree_validate_path_config; then
        _worktree_log "ERROR" "Path configuration validation failed"
        return 1
    fi

    # If worktree exists, verify it's clean before any operation
    if worktree_exists "$task_id"; then
        local wt_dir
        wt_dir=$(_worktree_dir "$task_id")
        if ! worktree_check_dirty "$wt_dir"; then
            _worktree_log "ERROR" "Worktree has uncommitted changes: $wt_dir"
            return 1
        fi
    fi

    return 0
}

# _worktree_meta_file - Get metadata file path for task
_worktree_meta_file() {
    local task_id="$1"
    echo "${WORKTREE_META_DIR}/${task_id}.json"
}

# _worktree_lock_file - Get lock file path for task
_worktree_lock_file() {
    local task_id="$1"
    echo "${WORKTREE_LOCK_DIR}/${task_id}.lock"
}

# _worktree_dir - Get worktree directory for task
_worktree_dir() {
    local task_id="$1"
    if [[ -n "$WORKTREE_DIR_PREFIX" ]]; then
        echo "${WORKTREE_BASE_DIR}/${WORKTREE_DIR_PREFIX}-${task_id}"
    else
        echo "${WORKTREE_BASE_DIR}/${task_id}"
    fi
}

# _worktree_git_dir - Get git dir for a worktree
_worktree_git_dir() {
    local worktree_path="$1"
    echo "${worktree_path}/.git"
}

# worktree_exists - Check if worktree exists for task
worktree_exists() {
    local task_id="$1"
    local wt_dir
    wt_dir=$(_worktree_dir "$task_id")
    [[ -d "$wt_dir" ]]
}

# worktree_is_locked - Check if task worktree is locked
worktree_is_locked() {
    local task_id="$1"
    local lock_file
    lock_file=$(_worktree_lock_file "$task_id")
    [[ -d "$lock_file" ]]
}

# worktree_validate_git_dir - Verify we're in a git repository
worktree_validate_git_dir() {
    if ! git -C "$WORKTREE_GIT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
        _worktree_log "ERROR" "Not a git repository: $WORKTREE_GIT_DIR"
        return 1
    fi
    return 0
}

# worktree_check_dirty - Check if worktree has uncommitted changes
# Returns 0 if clean, 1 if dirty
worktree_check_dirty() {
    local worktree_path="$1"
    local wt_git_dir
    wt_git_dir=$(_worktree_git_dir "$worktree_path")

    if [[ ! -d "$wt_git_dir" ]]; then
        _worktree_log "WARN" "Not a git worktree: $worktree_path"
        return 1
    fi

    # Check for uncommitted changes
    if [[ -n "$(git -C "$worktree_path" status --porcelain 2>/dev/null)" ]]; then
        _worktree_log "WARN" "Worktree has uncommitted changes: $worktree_path"
        return 1
    fi

    return 0
}

# worktree_check_conflict - Check if worktree path is already in use
worktree_check_conflict() {
    local worktree_path="$1"

    if [[ -d "$worktree_path" ]]; then
        # Check if it's a valid worktree
        if git worktree list --porcelain "$worktree_path" 2>/dev/null | head -1 | grep -q "^worktree"; then
            _worktree_log "ERROR" "Worktree already exists at: $worktree_path"
            return 1
        fi
        # Directory exists but not a valid worktree - conflict
        _worktree_log "ERROR" "Path already exists and is not a worktree: $worktree_path"
        return 1
    fi

    return 0
}

# worktree_acquire_lock - Acquire exclusive lock for task worktree
# Uses mkdir for atomic lock acquisition
# Returns 0 on success, 1 if lock cannot be acquired
worktree_acquire_lock() {
    local task_id="$1"
    local lock_file
    lock_file=$(_worktree_lock_file "$task_id")

    if mkdir "$lock_file" 2>/dev/null; then
        echo "$$" > "${lock_file}.pid"
        _worktree_log "DEBUG" "Acquired lock for task $task_id"
        return 0
    fi

    _worktree_log "WARN" "Failed to acquire lock for task $task_id - already locked"
    return 1
}

# worktree_release_lock - Release worktree lock
worktree_release_lock() {
    local task_id="$1"
    local lock_file
    lock_file=$(_worktree_lock_file "$task_id")
    local pid_file="${lock_file}.pid"

    if [[ -f "$pid_file" ]]; then
        local locker_pid
        locker_pid=$(cat "$pid_file" 2>/dev/null || echo "")
        if [[ "$locker_pid" == "$$" ]]; then
            rm -rf "$lock_file" "$pid_file" 2>/dev/null || rmdir "$lock_file" 2>/dev/null || true
            _worktree_log "DEBUG" "Released lock for task $task_id"
        else
            _worktree_log "WARN" "Lock for task $task_id owned by different process ($locker_pid != $$)"
        fi
    fi
}

# worktree_save_metadata - Save worktree metadata
worktree_save_metadata() {
    local task_id="$1"
    local branch="$2"
    local worktree_path="$3"
    local meta_file
    meta_file=$(_worktree_meta_file "$task_id")

    local now
    now=$(date +%s)

    cat > "$meta_file" <<EOF
{
  "task_id": "$task_id",
  "branch": "$branch",
  "worktree_path": "$worktree_path",
  "created_at": $now,
  "created_at_iso": "$(date -Iseconds)",
  "git_dir": "$WORKTREE_GIT_DIR"
}
EOF
    _worktree_log "DEBUG" "Saved metadata for task $task_id to $meta_file"
}

# worktree_load_metadata - Load worktree metadata for task
worktree_load_metadata() {
    local task_id="$1"
    local meta_file
    meta_file=$(_worktree_meta_file "$task_id")

    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    cat "$meta_file"
}

# worktree_extract_field - Extract field from metadata JSON
worktree_extract_field() {
    local task_id="$1"
    local field="$2"
    local meta
    meta=$(worktree_load_metadata "$task_id") || return 1
    echo "$meta" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('$field',''))" 2>/dev/null || echo ""
}

# worktree_delete_metadata - Delete worktree metadata
worktree_delete_metadata() {
    local task_id="$1"
    local meta_file
    meta_file=$(_worktree_meta_file "$task_id")
    rm -f "$meta_file"
}

# worktree_list - List all managed worktrees
worktree_list() {
    local format="${1:-table}"  # table or json

    if [[ ! -d "$WORKTREE_META_DIR" ]]; then
        if [[ "$format" == "json" ]]; then
            echo "[]"
        fi
        return 0
    fi

    local temp_json="/tmp/worktree_list_$$.json"
    echo "[]" > "$temp_json"

    for meta_file in "${WORKTREE_META_DIR}"/*.json; do
        [[ -f "$meta_file" ]] || continue
        local task_id
        task_id=$(basename "$meta_file" .json)
        local meta
        meta=$(worktree_load_metadata "$task_id") || continue

        if [[ "$format" == "json" ]]; then
            local entry
            entry=$(echo "$meta" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)))" 2>/dev/null || echo "{}")
            # Merge into temp_json
            python3 -c "
import json, sys
data = json.load(open('$temp_json'))
data.append(json.loads('${entry}'))
json.dump(data, open('$temp_json', 'w'))
" 2>/dev/null || true
        else
            local branch path created
            branch=$(echo "$meta" | python3 -c "import json,sys; print(json.load(sys.stdin).get('branch',''))" 2>/dev/null || echo "")
            path=$(echo "$meta" | python3 -c "import json,sys; print(json.load(sys.stdin).get('worktree_path',''))" 2>/dev/null || echo "")
            created=$(echo "$meta" | python3 -c "import json,sys; print(json.load(sys.stdin).get('created_at_iso',''))" 2>/dev/null || echo "")

            local status="unknown"
            if [[ -d "$path" ]]; then
                if worktree_check_dirty "$path" 2>/dev/null; then
                    status="clean"
                else
                    status="dirty"
                fi
            else
                status="missing"
            fi

            printf "%-30s %-20s %-40s %s\n" "$task_id" "$branch" "$path" "$status"
        fi
    done

    if [[ "$format" == "json" ]]; then
        cat "$temp_json"
    fi
    rm -f "$temp_json"
}

# worktree_status - Get status of a specific worktree
worktree_status() {
    local task_id="$1"

    if ! worktree_exists "$task_id"; then
        echo "not_found"
        return 1
    fi

    local wt_dir
    wt_dir=$(_worktree_dir "$task_id")

    local status="unknown"

    # Check if directory exists
    if [[ ! -d "$wt_dir" ]]; then
        echo "missing"
        return 0
    fi

    # Check if it's a valid git worktree
    if ! git -C "$wt_dir" rev-parse --git-dir >/dev/null 2>&1; then
        echo "invalid"
        return 0
    fi

    # Check for uncommitted changes
    if worktree_check_dirty "$wt_dir"; then
        status="clean"
    else
        status="dirty"
    fi

    echo "$status"
    return 0
}

# worktree_create - Create a new worktree for a task
# Returns 0 on success, 1 on failure
worktree_create() {
    local task_id="$1"
    local branch="${2:-}"
    local create_branch="${3:-false}"  # Create branch if it doesn't exist

    # Validate git dir
    worktree_validate_git_dir || return 1

    # Run preflight checks (dirty tree, path config, existing worktree)
    if ! worktree_preflight_check "$task_id"; then
        return 1
    fi

    # Check if worktree already exists
    if worktree_exists "$task_id"; then
        _worktree_log "ERROR" "Worktree already exists for task $task_id"
        return 1
    fi

    # Check if task is locked
    if worktree_is_locked "$task_id"; then
        _worktree_log "ERROR" "Task $task_id is already locked"
        return 1
    fi

    # Acquire lock
    worktree_acquire_lock "$task_id" || return 1

    local cleanup_lock=false
    trap 'if $cleanup_lock; then worktree_release_lock "$task_id" 2>/dev/null || true; fi' EXIT

    local wt_dir
    wt_dir=$(_worktree_dir "$task_id")

    # Verify worktree path is outside git repository
    local git_root
    git_root=$(git -C "$WORKTREE_GIT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")
    if [[ -n "$git_root" && "$wt_dir" == "$git_root"* ]]; then
        _worktree_log "ERROR" "Worktree path cannot be inside git repository root: $wt_dir"
        cleanup_lock=true
        return 1
    fi

    # Check for path conflict
    if ! worktree_check_conflict "$wt_dir"; then
        cleanup_lock=true
        return 1
    fi

    # Determine branch
    local target_branch="$branch"
    if [[ -z "$target_branch" ]]; then
        # Generate branch name from task
        target_branch="task/${task_id}"
    fi

    # NEW: Verify branch is protected BEFORE any git operations
    if _worktree_is_protected_branch "$target_branch"; then
        _worktree_log "ERROR" "Cannot create worktree on protected branch: $target_branch"
        cleanup_lock=true
        return 1
    fi

    # Check if branch exists locally
    local branch_exists=false
    if git -C "$WORKTREE_GIT_DIR" rev-parse --verify "$target_branch" >/dev/null 2>&1; then
        branch_exists=true
    fi

    # Create branch if requested and doesn't exist
    if [[ "$branch_exists" == "false" && "$create_branch" == "true" ]]; then
        _worktree_audit_git_state "checkout -b" "$target_branch"
        _worktree_log "INFO" "Creating new branch $target_branch from $WORKTREE_MAIN_BRANCH"
        if ! git -C "$WORKTREE_GIT_DIR" checkout -b "$target_branch"; then
            _worktree_log "ERROR" "Failed to create branch $target_branch"
            cleanup_lock=true
            return 1
        fi
    elif [[ "$branch_exists" == "false" ]]; then
        _worktree_log "ERROR" "Branch $target_branch does not exist and create_branch=false"
        cleanup_lock=true
        return 1
    fi

    # Create worktree with atomic mkdir protection
    _worktree_log "INFO" "Creating worktree at $wt_dir for branch $target_branch"

    # Create parent directory atomically
    local parent_dir
    parent_dir=$(dirname "$wt_dir")
    if ! mkdir -p "$parent_dir"; then
        _worktree_log "ERROR" "Failed to create parent directory: $parent_dir"
        cleanup_lock=true
        return 1
    fi

    # Add worktree WITHOUT suppressing errors
    if ! git -C "$WORKTREE_GIT_DIR" worktree add "$wt_dir" -b "$target_branch"; then
        _worktree_log "ERROR" "Failed to create git worktree"
        rmdir "$wt_dir" 2>/dev/null || true
        cleanup_lock=true
        return 1
    fi

    # NEW: Verify worktree was actually created
    if ! git -C "$WORKTREE_GIT_DIR" worktree list | grep -q "$wt_dir"; then
        _worktree_log "ERROR" "Worktree creation reported success but worktree not found"
        cleanup_lock=true
        return 1
    fi

    # Save metadata
    worktree_save_metadata "$task_id" "$target_branch" "$wt_dir"

    _worktree_log "INFO" "Created worktree for task $task_id at $wt_dir (branch: $target_branch)"

    cleanup_lock=false
    return 0
}

# worktree_cleanup - Clean up worktree for a task
# Options:
#   --force: Remove even if dirty (default: false)
#   --delete-branch: Also delete the branch (default: false)
worktree_cleanup() {
    local task_id="$1"
    local force="${2:-false}"
    local delete_branch="${3:-false}"

    if ! worktree_exists "$task_id"; then
        _worktree_log "WARN" "No worktree found for task $task_id"
        return 0
    fi

    local wt_dir
    wt_dir=$(_worktree_dir "$task_id")

    # Check if locked by another process
    if worktree_is_locked "$task_id"; then
        local lock_file
        lock_file=$(_worktree_lock_file "$task_id")
        local locker_pid
        locker_pid=$(cat "${lock_file}.pid" 2>/dev/null || echo "")
        if [[ "$locker_pid" != "$$" ]]; then
            _worktree_log "ERROR" "Worktree for task $task_id is locked by process $locker_pid"
            return 1
        fi
    fi

    # Acquire lock for cleanup
    worktree_acquire_lock "$task_id" || return 1

    local cleanup_lock=false
    trap 'if $cleanup_lock; then worktree_release_lock "$task_id" 2>/dev/null || true; fi' EXIT

    # Check dirty tree if not forcing
    if [[ "$force" != "true" ]]; then
        if ! worktree_check_dirty "$wt_dir"; then
            _worktree_log "ERROR" "Worktree has uncommitted changes. Use --force to override."
            cleanup_lock=true
            return 1
        fi
    fi

    # Get branch name before removing worktree
    local branch_name
    branch_name=$(worktree_extract_field "$task_id" "branch") || branch_name=""

    # Remove worktree
    _worktree_log "INFO" "Removing worktree at $wt_dir"
    if ! git -C "$WORKTREE_GIT_DIR" worktree remove "$wt_dir" --force 2>/dev/null; then
        _worktree_log "ERROR" "Failed to remove git worktree"
        cleanup_lock=true
        return 1
    fi

    # Optionally delete branch
    if [[ "$delete_branch" == "true" && -n "$branch_name" ]]; then
        # Don't delete main branch
        if [[ "$branch_name" != "$WORKTREE_MAIN_BRANCH" ]]; then
            _worktree_log "INFO" "Deleting branch $branch_name"
            git -C "$WORKTREE_GIT_DIR" branch -D "$branch_name" 2>/dev/null || true
        fi
    fi

    # Clean up metadata
    worktree_delete_metadata "$task_id"

    # Release lock before removing lock file
    worktree_release_lock "$task_id"
    cleanup_lock=false

    _worktree_log "INFO" "Cleaned up worktree for task $task_id"
    return 0
}

# worktree_prune - Prune stale worktree references
worktree_prune() {
    _worktree_log "INFO" "Pruning stale git worktree references"
    git -C "$WORKTREE_GIT_DIR" worktree prune
    _worktree_log "INFO" "Pruned git worktree references"
}

# worktree_verify - Verify worktree integrity
worktree_verify() {
    local task_id="$1"

    if ! worktree_exists "$task_id"; then
        _worktree_log "ERROR" "Worktree does not exist for task $task_id"
        return 1
    fi

    local wt_dir
    wt_dir=$(_worktree_dir "$task_id")

    # Check directory exists
    if [[ ! -d "$wt_dir" ]]; then
        _worktree_log "ERROR" "Worktree directory missing: $wt_dir"
        return 1
    fi

    # Check it's a valid git worktree
    if ! git -C "$wt_dir" rev-parse --git-dir >/dev/null 2>&1; then
        _worktree_log "ERROR" "Not a valid git worktree: $wt_dir"
        return 1
    fi

    # Check git link is valid
    local git_link
    git_link=$(readlink "$(_worktree_git_dir "$wt_dir")" 2>/dev/null || echo "")
    if [[ -z "$git_link" ]]; then
        _worktree_log "ERROR" "Git link broken in worktree: $wt_dir"
        return 1
    fi

    _worktree_log "INFO" "Worktree verification passed for task $task_id"
    return 0
}

# worktree_safety_block - Block dangerous operations without approval
# Returns 0 if allowed, 1 if blocked
worktree_safety_block() {
    local operation="$1"
    local task_id="${2:-}"

    # This integrates with safety.sh to ensure no commit/push/deploy without approval
    case "$operation" in
        commit|push|deploy|db)
            _worktree_log "BLOCK" "Operation '$operation' requires safety approval for task $task_id"
            return 1
            ;;
        *)
            return 0
            ;;
    esac
}

# Export configuration
export WORKTREE_BASE_DIR WORKTREE_META_DIR WORKTREE_LOCK_DIR
export WORKTREE_GIT_DIR WORKTREE_MAIN_BRANCH WORKTREE_DIR_PREFIX

# Initialize on source
worktree_init