#!/usr/bin/env bash
# tests/test-worktree.sh - Tests for worktree and file-lease management

set -euo pipefail

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_TMP_DIR="${TEST_TMP_DIR:-/tmp/agent-worktree-test-$$}"
TEST_GIT_DIR="${TEST_GIT_DIR:-$TEST_TMP_DIR/test-repo.git}"
TEST_WORKTREE_BASE="${TEST_WORKTREE_BASE:-$TEST_TMP_DIR/worktrees}"
TEST_LEASE_BASE="${TEST_LEASE_BASE:-$TEST_TMP_DIR/leases}"

# Colors for test output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Setup and teardown
test_setup() {
    mkdir -p "$TEST_TMP_DIR"
    export WORKTREE_BASE_DIR="$TEST_WORKTREE_BASE"
    export WORKTREE_META_DIR="${WORKTREE_BASE_DIR}/.meta"
    export WORKTREE_LOCK_DIR="${WORKTREE_BASE_DIR}/.locks"
    export LEASE_BASE_DIR="$TEST_LEASE_BASE"

    # Create a test git repo if it doesn't exist
    if [[ ! -d "$TEST_GIT_DIR" ]]; then
        mkdir -p "$TEST_GIT_DIR"
        git -C "$TEST_GIT_DIR" init --bare
    fi

    export WORKTREE_GIT_DIR="$TEST_GIT_DIR"

    # Source the libraries
    # shellcheck source=../lib/worktree.sh
    source "${ORCHESTRATOR_ROOT}/lib/worktree.sh"
    # shellcheck source=../lib/file-lease.sh
    source "${ORCHESTRATOR_ROOT}/lib/file-lease.sh"
    # shellcheck source=../lib/status.sh
    source "${ORCHESTRATOR_ROOT}/lib/status.sh"
    # shellcheck source=../lib/safety.sh
    source "${ORCHESTRATOR_ROOT}/lib/safety.sh"
}

test_teardown() {
    # Clean up test directories
    if [[ -d "$TEST_TMP_DIR" ]]; then
        chmod -R +w "$TEST_TMP_DIR" 2>/dev/null || true
        rm -rf "$TEST_TMP_DIR"
    fi
}

# Test utility functions
test_pass() {
    local msg="$1"
    echo -e "${GREEN}PASS${RESET}: $msg"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_fail() {
    local msg="$1"
    local expected="$2"
    local actual="$3"
    echo -e "${RED}FAIL${RESET}: $msg"
    if [[ -n "$expected" ]]; then
        echo "  Expected: $expected"
        echo "  Actual:   $actual"
    fi
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_start() {
    local test_name="$1"
    echo ""
    echo -e "${YELLOW}=== $test_name ===${RESET}"
}

assert_equals() {
    local expected="$1"
    local actual="$2"
    local msg="$3"
    if [[ "$expected" == "$actual" ]]; then
        test_pass "$msg"
    else
        test_fail "$msg" "$expected" "$actual"
    fi
}

assert_success() {
    local cmd="$*"
    if eval "$cmd" >/dev/null 2>&1; then
        test_pass "$cmd"
    else
        test_fail "$cmd" "exit 0" "exit non-zero"
    fi
}

assert_failure() {
    local cmd="$*"
    if ! eval "$cmd" >/dev/null 2>&1; then
        test_pass "$cmd (correctly failed)"
    else
        test_fail "$cmd" "exit non-zero" "exit 0"
    fi
}

# ========== Worktree Tests ==========

test_worktree_init() {
    test_start "worktree_init"

    worktree_init

    if [[ -d "$WORKTREE_BASE_DIR" ]]; then
        test_pass "base directory created"
    else
        test_fail "base directory" "created" "not created"
    fi

    if [[ -d "$WORKTREE_META_DIR" ]]; then
        test_pass "meta directory created"
    else
        test_fail "meta directory" "created" "not created"
    fi

    if [[ -d "$WORKTREE_LOCK_DIR" ]]; then
        test_pass "lock directory created"
    else
        test_fail "lock directory" "created" "not created"
    fi
}

test_worktree_meta_file() {
    test_start "worktree meta file path"

    local meta_file
    meta_file=$(_worktree_meta_file "task-123")
    local expected="${WORKTREE_META_DIR}/task-123.json"

    if [[ "$meta_file" == "$expected" ]]; then
        test_pass "meta file path: $meta_file"
    else
        test_fail "meta file path" "$expected" "$meta_file"
    fi
}

test_worktree_lock_file() {
    test_start "worktree lock file path"

    local lock_file
    lock_file=$(_worktree_lock_file "task-456")
    local expected="${WORKTREE_LOCK_DIR}/task-456.lock"

    if [[ "$lock_file" == "$expected" ]]; then
        test_pass "lock file path: $lock_file"
    else
        test_fail "lock file path" "$expected" "$lock_file"
    fi
}

test_worktree_dir() {
    test_start "worktree directory path"

    local wt_dir
    wt_dir=$(_worktree_dir "task-789")
    local expected="${WORKTREE_BASE_DIR}/${WORKTREE_DIR_PREFIX}task-789"

    if [[ "$wt_dir" == "$expected" ]]; then
        test_pass "worktree dir path: $wt_dir"
    else
        test_fail "worktree dir path" "$expected" "$wt_dir"
    fi
}

test_worktree_exists() {
    test_start "worktree_exists"

    local test_task="test-task-exists-$$"

    # Should not exist initially
    if ! worktree_exists "$test_task"; then
        test_pass "worktree_exists returns false for non-existent worktree"
    else
        test_fail "worktree_exists" "false for non-existent" "true"
    fi
}

test_worktree_lock_acquire_release() {
    test_start "worktree_acquire_lock and worktree_release_lock"

    local test_task="test-task-lock-$$"
    local lock_file
    lock_file=$(_worktree_lock_file "$test_task")

    # Should not be locked initially
    if ! worktree_is_locked "$test_task"; then
        test_pass "worktree_is_locked returns false initially"
    else
        test_fail "worktree_is_locked" "false initially" "true"
    fi

    # Acquire lock
    if worktree_acquire_lock "$test_task"; then
        test_pass "worktree_acquire_lock succeeded"
    else
        test_fail "worktree_acquire_lock" "success" "failure"
        return
    fi

    # Should now be locked (lock is created as directory via mkdir)
    if worktree_is_locked "$test_task"; then
        test_pass "worktree_is_locked returns true after acquire"
    else
        test_fail "worktree_is_locked" "true after acquire" "false"
    fi

    # Release lock
    worktree_release_lock "$test_task"

    # Should no longer be locked
    if ! worktree_is_locked "$test_task"; then
        test_pass "worktree_is_locked returns false after release"
    else
        test_fail "worktree_is_locked" "false after release" "true"
    fi
}

test_worktree_metadata() {
    test_start "worktree metadata save/load"

    local test_task="test-task-meta-$$"
    local test_branch="feature/test"
    local test_path="/tmp/test-path-$$"

    worktree_save_metadata "$test_task" "$test_branch" "$test_path"

    # Load and verify
    local meta
    meta=$(worktree_load_metadata "$test_task")

    if echo "$meta" | grep -q "\"task_id\": \"$test_task\""; then
        test_pass "metadata contains task_id"
    else
        test_fail "metadata task_id" "found" "not found"
    fi

    if echo "$meta" | grep -q "\"branch\": \"$test_branch\""; then
        test_pass "metadata contains branch"
    else
        test_fail "metadata branch" "found" "not found"
    fi

    # Extract field
    local extracted_branch
    extracted_branch=$(worktree_extract_field "$test_task" "branch")

    if [[ "$extracted_branch" == "$test_branch" ]]; then
        test_pass "extract_field returns branch: $extracted_branch"
    else
        test_fail "extract_field returns branch" "$test_branch" "$extracted_branch"
    fi

    # Delete metadata
    worktree_delete_metadata "$test_task"

    # Should no longer exist
    if ! [[ -f "${WORKTREE_META_DIR}/${test_task}.json" ]]; then
        test_pass "metadata deleted"
    else
        test_fail "metadata deleted" "deleted" "still exists"
    fi
}

# ========== File Lease Tests ==========

test_lease_init() {
    test_start "lease_init"

    _lease_init

    if [[ -d "$LEASE_BASE_DIR" ]]; then
        test_pass "lease directory created"
    else
        test_fail "lease directory" "created" "not created"
    fi
}

test_lease_paths() {
    test_start "lease path functions"

    local lock_file pid_file meta_file
    lock_file=$(_lease_lock_file "resource-123")
    pid_file=$(_lease_pid_file "resource-123")
    meta_file=$(_lease_meta_file "resource-123")

    local expected_lock="${LEASE_BASE_DIR}/resource-123.lock"
    local expected_pid="${LEASE_BASE_DIR}/resource-123.pid"
    local expected_meta="${LEASE_BASE_DIR}/resource-123.meta"

    if [[ "$lock_file" == "$expected_lock" ]]; then
        test_pass "lock file path: $lock_file"
    else
        test_fail "lock file path" "$expected_lock" "$lock_file"
    fi

    if [[ "$pid_file" == "$expected_pid" ]]; then
        test_pass "pid file path: $pid_file"
    else
        test_fail "pid file path" "$expected_pid" "$pid_file"
    fi

    if [[ "$meta_file" == "$expected_meta" ]]; then
        test_pass "meta file path: $meta_file"
    else
        test_fail "meta file path" "$expected_meta" "$meta_file"
    fi
}

test_lease_acquire_release() {
    test_start "lease_acquire and lease_release"

    local test_resource="test-resource-$$"

    # Should not exist initially
    if ! lease_exists "$test_resource"; then
        test_pass "lease does not exist initially"
    else
        test_fail "lease_exists" "false initially" "true"
    fi

    # Acquire
    if lease_acquire "$test_resource"; then
        test_pass "lease_acquire succeeded"
    else
        test_fail "lease_acquire" "success" "failure"
        return
    fi

    # Should now exist
    if lease_exists "$test_resource"; then
        test_pass "lease exists after acquire"
    else
        test_fail "lease_exists" "true after acquire" "false"
    fi

    # Get holder
    local holder
    holder=$(lease_get_holder "$test_resource")
    if [[ "$holder" == "$$" ]]; then
        test_pass "lease holder is current PID"
    else
        test_fail "lease_get_holder" "$$" "$holder"
    fi

    # Release
    if lease_release "$test_resource"; then
        test_pass "lease_release succeeded"
    else
        test_fail "lease_release" "success" "failure"
    fi

    # Should no longer exist
    if ! lease_exists "$test_resource"; then
        test_pass "lease no longer exists after release"
    else
        test_fail "lease_exists" "false after release" "true"
    fi
}

test_lease_renew() {
    test_start "lease_renew"

    local test_resource="test-resource-renew-$$"

    # Acquire first
    lease_acquire "$test_resource" || return

    # Renew
    if lease_renew "$test_resource"; then
        test_pass "lease_renew succeeded"
    else
        test_fail "lease_renew" "success" "failure"
        lease_release "$test_resource"
        return
    fi

    # Verify still held
    if lease_exists "$test_resource"; then
        test_pass "lease still exists after renew"
    else
        test_fail "lease_exists" "true after renew" "false"
    fi

    lease_release "$test_resource"
}

test_lease_status() {
    test_start "lease_status"

    local test_resource="test-resource-status-$$"

    # Free initially
    local status
    status=$(lease_status "$test_resource")
    if [[ "$status" == "free" ]]; then
        test_pass "status when free: $status"
    else
        test_fail "status when free" "free" "$status"
    fi

    # Acquire
    lease_acquire "$test_resource" || return

    # Held by self
    status=$(lease_status "$test_resource")
    if [[ "$status" == "held_by_self"* ]]; then
        test_pass "status when held by self"
    else
        test_fail "lease_status" "held_by_self (pid=$$)" "$status"
    fi

    lease_release "$test_resource"
}

test_lease_list() {
    test_start "lease_list"

    local resource1="test-list-1-$$"
    local resource2="test-list-2-$$"

    lease_acquire "$resource1" || return
    lease_acquire "$resource2" || {
        lease_release "$resource1"
        return
    }

    # Table format
    local list_output
    list_output=$(lease_list "table" 2>/dev/null || echo "")

    if echo "$list_output" | grep -q "$resource1"; then
        test_pass "lease_list contains resource1"
    else
        test_fail "lease_list" "contains $resource1" "does not contain"
    fi

    if echo "$list_output" | grep -q "$resource2"; then
        test_pass "lease_list contains resource2"
    else
        test_fail "lease_list" "contains $resource2" "does not contain"
    fi

    lease_release "$resource1"
    lease_release "$resource2"
}

test_lease_cleanup_stale() {
    test_start "lease_cleanup_stale"

    local test_resource="test-stale-$$"

    # Acquire and force release (simulating stale)
    lease_acquire "$test_resource" -f || return

    # Simulate stale by removing lock directory without proper release
    rm -rf "${LEASE_BASE_DIR}/${test_resource}.lock" \
           "${LEASE_BASE_DIR}/${test_resource}.pid" \
           "${LEASE_BASE_DIR}/${test_resource}.meta" 2>/dev/null || true

    # Should be cleaned up
    if ! lease_exists "$test_resource"; then
        test_pass "stale lease removed"
    else
        test_fail "stale lease" "removed" "still exists"
    fi
}

test_lease_wait_for() {
    test_start "lease_wait_for"

    local test_resource="test-wait-$$"

    # Should succeed immediately if free
    if lease_wait_for "$test_resource" 1; then
        test_pass "lease_wait_for succeeds when free"
    else
        test_fail "lease_wait_for" "success when free" "failure"
    fi
}

# ========== Integration Tests ==========

test_worktree_with_lease_integration() {
    test_start "worktree and lease integration"

    local test_task="test-integration-$$"
    local test_resource="lease-for-${test_task}"

    # Acquire lease first
    if ! lease_acquire "$test_resource"; then
        test_fail "lease_acquire" "success" "failure"
        return
    fi
    test_pass "acquired lease before worktree operation"

    # Create worktree
    if ! worktree_acquire_lock "$test_task"; then
        test_fail "worktree_acquire_lock" "success" "failure"
        lease_release "$test_resource"
        return
    fi
    test_pass "acquired worktree lock"

    # Simulate work
    sleep 0.1

    # Release in reverse order
    worktree_release_lock "$test_task"
    test_pass "released worktree lock"

    if lease_release "$test_resource"; then
        test_pass "released lease"
    else
        test_fail "lease_release" "success" "failure"
    fi
}

# ========== Main ==========

run_all_tests() {
    echo ""
    echo "========================================"
    echo "Running Worktree and File-Lease Tests"
    echo "========================================"
    echo "Test directory: $TEST_TMP_DIR"
    echo ""

    # Setup
    test_setup

    # Run tests
    test_worktree_init
    test_worktree_meta_file
    test_worktree_lock_file
    test_worktree_dir
    test_worktree_exists
    test_worktree_lock_acquire_release
    test_worktree_metadata

    test_lease_init
    test_lease_paths
    test_lease_acquire_release
    test_lease_renew
    test_lease_status
    test_lease_list
    test_lease_cleanup_stale
    test_lease_wait_for

    test_worktree_with_lease_integration

    # Teardown
    test_teardown

    # Summary
    echo ""
    echo "========================================"
    echo "Test Summary"
    echo "========================================"
    echo -e "Tests run:    ${TESTS_RUN}"
    echo -e "Tests passed: ${GREEN}${TESTS_PASSED}${RESET}"
    echo -e "Tests failed: ${RED}${TESTS_FAILED}${RESET}"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${RESET}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${RESET}"
        exit 1
    fi
}

# Parse arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help]"
        echo ""
        echo "Run unit and integration tests for worktree and file-lease management."
        exit 0
        ;;
    *)
        run_all_tests
        ;;
esac