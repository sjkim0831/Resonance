#!/usr/bin/env bash
# tests/test-supervisor.sh - Temporary tests for agent-supervisor
# Tests supervisor command handling and integration

set -euo pipefail

# Test configuration
TEST_DIR="/tmp/agent-supervisor-test-$$"
mkdir -p "$TEST_DIR"

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Source the status library first
source "${ORCHESTRATOR_DIR}/lib/status.sh"

# Set up test environment
export QUEUE_DIR="${TEST_DIR}/queue"
export WORKER_BASE_DIR="${TEST_DIR}/workers"
export WORKER_LOCK_DIR="${TEST_DIR}/workers/.locks"
export WORKER_LOG_DIR="${TEST_DIR}/workers/logs"
export WORKER_RUN_DIR="${TEST_DIR}/workers/runs"
export APPROVAL_CONFIG_DIR="${TEST_DIR}/approvals"
export APPROVAL_TOKEN_DIR="${APPROVAL_CONFIG_DIR}/tokens"
export APPROVAL_LOG_DIR="${APPROVAL_CONFIG_DIR}/logs"
export APPROVAL_EVIDENCE_DIR="${APPROVAL_CONFIG_DIR}/evidence"
export DRY_RUN="${DRY_RUN:-true}"

# Source libraries
source "${ORCHESTRATOR_DIR}/lib/queue.sh"
source "${ORCHESTRATOR_DIR}/lib/approval.sh"

# Source agent-supervisor for supervisor_* functions
# The script has a guard to prevent main from running when sourced
source "${ORCHESTRATOR_DIR}/bin/agent-supervisor" 2>/dev/null || true

# _test_start - Mark test start
_test_start() {
    local test_name="$1"
    echo "[TEST] Starting: $test_name"
    ((TESTS_RUN++)) || true
}

# _test_pass - Mark test passed
_test_pass() {
    local test_name="$1"
    echo "[PASS] $test_name"
    ((TESTS_PASSED++)) || true
}

# _test_fail - Mark test failed
_test_fail() {
    local test_name="$1"
    local reason="$2"
    echo "[FAIL] $test_name: $reason"
    ((TESTS_FAILED++)) || true
}

# test_status_command - Test status command
test_status_command() {
    _test_start "supervisor_status_command"

    # Initialize queue
    queue_init

    local status
    status=$(supervisor_status "test-task")

    # Should be valid JSON
    if ! echo "$status" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "supervisor_status_command" "Status should be valid JSON"
        return 1
    fi

    # Should contain required fields
    if ! echo "$status" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'supervisor' in d; assert 'timestamp' in d; assert 'dry_run' in d" 2>/dev/null; then
        _test_fail "supervisor_status_command" "Status should contain required fields"
        return 1
    fi

    # Should show dry_run as true
    if ! echo "$status" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('dry_run') == True" 2>/dev/null; then
        _test_fail "supervisor_status_command" "dry_run should be true"
        return 1
    fi

    _test_pass "supervisor_status_command"
}

# test_submit_task - Test task submission
test_submit_task() {
    _test_start "supervisor_submit_task"

    local task_id
    task_id=$(supervisor_submit_task "Test task" '{}' 0 "COMMIT,DEPLOY")

    if [[ -z "$task_id" ]]; then
        _test_fail "supervisor_submit_task" "Should return task_id"
        return 1
    fi

    # Verify task was added to queue
    local task
    task=$(queue_get "$task_id")

    if [[ -z "$task" || "$task" == "null" ]]; then
        _test_fail "supervisor_submit_task" "Task should exist in queue"
        return 1
    fi

    _test_pass "supervisor_submit_task"
}

# test_check_approval_blocks - Test approval check blocks dangerous actions
test_check_approval_blocks() {
    _test_start "supervisor_check_approval_blocks"

    # Should block COMMIT without approval
    if supervisor_check_approval "COMMIT" "test-task" "" 2>/dev/null; then
        _test_fail "supervisor_check_approval_blocks" "COMMIT should be blocked"
        return 1
    fi

    # Should block DB_WRITE without approval
    if supervisor_check_approval "DB_WRITE" "test-task" "" 2>/dev/null; then
        _test_fail "supervisor_check_approval_blocks" "DB_WRITE should be blocked"
        return 1
    fi

    # Should block DEPLOY without approval
    if supervisor_check_approval "DEPLOY" "test-task" "" 2>/dev/null; then
        _test_fail "supervisor_check_approval_blocks" "DEPLOY should be blocked"
        return 1
    fi

    _test_pass "supervisor_check_approval_blocks"
}

# test_execute_commit_blocked - Test commit execution is blocked
test_execute_commit_blocked() {
    _test_start "supervisor_execute_commit_blocked"

    export DRY_RUN=true

    local output
    output=$(supervisor_execute_commit "test-task" "/tmp/worktree" "" 2>&1)

    if ! echo "$output" | grep -q "BLOCKED"; then
        _test_fail "supervisor_execute_commit_blocked" "Commit should be blocked"
        return 1
    fi

    _test_pass "supervisor_execute_commit_blocked"
}

# test_execute_db_write_blocked - Test DB write execution is blocked
test_execute_db_write_blocked() {
    _test_start "supervisor_execute_db_write_blocked"

    export DRY_RUN=true

    local output
    output=$(supervisor_execute_db_write "test-task" "testdb" "" 2>&1)

    if ! echo "$output" | grep -q "BLOCKED"; then
        _test_fail "supervisor_execute_db_write_blocked" "DB_WRITE should be blocked"
        return 1
    fi

    _test_pass "supervisor_execute_db_write_blocked"
}

# test_execute_deploy_generates_commands - Test deploy generates commands only
test_execute_deploy_generates_commands() {
    _test_start "supervisor_execute_deploy_generates_commands"

    export DRY_RUN=true

    local output
    output=$(supervisor_execute_deploy "test-task" "production" "" 2>&1)

    # Should be JSON with commands
    if ! echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'commands' in d" 2>/dev/null; then
        _test_fail "supervisor_execute_deploy_generates_commands" "Should return deploy commands JSON"
        return 1
    fi

    # Should be marked as dry_run
    if ! echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('dry_run') == True" 2>/dev/null; then
        _test_fail "supervisor_execute_deploy_generates_commands" "Should be marked as dry_run"
        return 1
    fi

    _test_pass "supervisor_execute_deploy_generates_commands"
}

# test_generate_deploy_no_approval - Test deploy generation without approval
test_generate_deploy_no_approval() {
    _test_start "supervisor_generate_deploy_no_approval"

    local output
    output=$(supervisor_generate_deploy "test-task" "staging")

    # Should be valid JSON
    if ! echo "$output" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "supervisor_generate_deploy_no_approval" "Should return valid JSON"
        return 1
    fi

    # Should contain commands
    if ! echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'commands' in d" 2>/dev/null; then
        _test_fail "supervisor_generate_deploy_no_approval" "Should contain commands"
        return 1
    fi

    _test_pass "supervisor_generate_deploy_no_approval"
}

# test_queue_status - Test queue status
test_queue_status() {
    _test_start "supervisor_queue_status"

    local status
    status=$(supervisor_queue_status)

    # Should be valid JSON
    if ! echo "$status" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "supervisor_queue_status" "Status should be valid JSON"
        return 1
    fi

    # Should contain queue_status
    if ! echo "$status" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'queue_status' in d" 2>/dev/null; then
        _test_fail "supervisor_queue_status" "Should contain queue_status"
        return 1
    fi

    _test_pass "supervisor_queue_status"
}

# test_queue_list - Test queue list
test_queue_list() {
    _test_start "supervisor_queue_list"

    local list
    list=$(supervisor_queue_list)

    # Should be valid JSON array
    if ! echo "$list" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "supervisor_queue_list" "List should be valid JSON"
        return 1
    fi

    _test_pass "supervisor_queue_list"
}

# test_worktree_check - Test worktree check
test_worktree_check() {
    _test_start "supervisor_worktree_check"

    mkdir -p "${TEST_DIR}/test-worktree/.git"

    local worktree_info
    worktree_info=$(supervisor_check_worktree "${TEST_DIR}/test-worktree")

    # Should be valid JSON
    if ! echo "$worktree_info" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "supervisor_worktree_check" "Worktree info should be valid JSON"
        return 1
    fi

    # Should contain timestamp and worktree_path
    if ! echo "$worktree_info" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'timestamp' in d" 2>/dev/null; then
        _test_fail "supervisor_worktree_check" "Should contain timestamp"
        return 1
    fi

    _test_pass "supervisor_worktree_check"
}

# test_approval_status - Test approval status
test_approval_status() {
    _test_start "supervisor_approval_status"

    local status
    status=$(supervisor_approval_status "test-task")

    # Should be valid JSON
    if ! echo "$status" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "supervisor_approval_status" "Status should be valid JSON"
        return 1
    fi

    # Should show task_approvals as blocked
    if ! echo "$status" | python3 -c "import json,sys; d=json.load(sys.stdin); ta=d.get('task_approvals',{}); assert ta.get('COMMIT') == 'blocked'" 2>/dev/null; then
        _test_fail "supervisor_approval_status" "COMMIT should be blocked"
        return 1
    fi

    _test_pass "supervisor_approval_status"
}

# test_record_failure - Test failure recording
test_record_failure() {
    _test_start "supervisor_record_failure"

    local result
    result=$(supervisor_record_failure "test-task" "test_failure" "test details")

    if ! echo "$result" | grep -q "Failure recorded"; then
        _test_fail "supervisor_record_failure" "Should confirm recording"
        return 1
    fi

    _test_pass "supervisor_record_failure"
}

# test_expire_leases - Test lease expiration
test_expire_leases() {
    _test_start "supervisor_expire_leases"

    # Should complete without error
    if ! supervisor_expire_leases 2>/dev/null; then
        _test_fail "supervisor_expire_leases" "Should complete without error"
        return 1
    fi

    _test_pass "supervisor_expire_leases"
}

# test_concurrency_check_release - Test concurrency check and release
test_concurrency_check_release() {
    _test_start "supervisor_concurrency_check_release"

    local worker_id="test-worker-$$"

    # Should acquire lock
    if ! supervisor_check_concurrency "test-resource" "resource-1" "$worker_id" 2>/dev/null; then
        _test_fail "supervisor_concurrency_check_release" "Should acquire lock"
        return 1
    fi

    # Should release lock
    if ! supervisor_release_concurrency "test-resource" "resource-1" "$worker_id" 2>/dev/null; then
        _test_fail "supervisor_concurrency_check_release" "Should release lock"
        return 1
    fi

    _test_pass "supervisor_concurrency_check_release"
}

# setup - Create test environment
setup() {
    mkdir -p "$QUEUE_DIR" "$QUEUE_LOCK_DIR" "${QUEUE_DIR}/tasks" "${QUEUE_DIR}/claims"
    mkdir -p "$WORKER_BASE_DIR" "$WORKER_LOCK_DIR" "$WORKER_LOG_DIR" "$WORKER_RUN_DIR"
    mkdir -p "$APPROVAL_TOKEN_DIR" "$APPROVAL_LOG_DIR" "$APPROVAL_EVIDENCE_DIR" "${APPROVAL_CONFIG_DIR}/.locks"
}

# teardown - Clean up test environment
teardown() {
    rm -rf "$TEST_DIR"
}

# run_tests - Run all tests
run_tests() {
    echo "=========================================="
    echo "Running Agent Supervisor Tests"
    echo "=========================================="

    setup

    test_status_command
    test_submit_task
    test_check_approval_blocks
    test_execute_commit_blocked
    test_execute_db_write_blocked
    test_execute_deploy_generates_commands
    test_generate_deploy_no_approval
    test_queue_status
    test_queue_list
    test_worktree_check
    test_approval_status
    test_record_failure
    test_expire_leases
    test_concurrency_check_release

    teardown

    echo ""
    echo "=========================================="
    echo "Test Results"
    echo "=========================================="
    echo "Tests run:    $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    echo "=========================================="

    if (( TESTS_FAILED > 0 )); then
        echo "SOME TESTS FAILED"
        exit 1
    else
        echo "ALL TESTS PASSED"
        exit 0
    fi
}

# Run tests if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_tests
fi