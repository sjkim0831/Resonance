#!/usr/bin/env bash
# tests/test-approval.sh - Temporary tests for approval system
# Tests Codex approval token enforcement for COMMIT, DB_WRITE, DEPLOY

set -euo pipefail

# Test configuration
TEST_DIR="/tmp/agent-approval-test-$$"
APPROVAL_CONFIG_DIR="${TEST_DIR}/approvals"
APPROVAL_TOKEN_DIR="${APPROVAL_CONFIG_DIR}/tokens"
APPROVAL_LOG_DIR="${APPROVAL_CONFIG_DIR}/logs"
APPROVAL_EVIDENCE_DIR="${APPROVAL_CONFIG_DIR}/evidence"

# Export for sourcing
export APPROVAL_CONFIG_DIR APPROVAL_TOKEN_DIR APPROVAL_LOG_DIR APPROVAL_EVIDENCE_DIR
export DRY_RUN="${DRY_RUN:-true}"
export APPROVAL_TOKEN_TTL=3600

# Source the approval library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "${ORCHESTRATOR_DIR}/lib/status.sh"
source "${ORCHESTRATOR_DIR}/lib/approval.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

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

# test_approval_requires_token - Test that COMMIT, DB_WRITE, DEPLOY require tokens
test_approval_requires_token() {
    _test_start "approval_requires_token"

    for action in COMMIT DB_WRITE DEPLOY; do
        if ! approval_requires_token "$action"; then
            _test_fail "approval_requires_token" "Action $action should require token"
            return 1
        fi
    done

    # Non-dangerous actions should not require tokens
    for action in READ SEARCH STATUS; do
        if approval_requires_token "$action"; then
            _test_fail "approval_requires_token" "Action $action should NOT require token"
            return 1
        fi
    done

    _test_pass "approval_requires_token"
}

# test_approval_check_blocks_without_token - Test that approval_check blocks in dry-run
test_approval_check_blocks_without_token() {
    _test_start "approval_check_blocks_without_token"

    export DRY_RUN=true

    # All dangerous actions should be blocked in dry-run without tokens
    for action in COMMIT DB_WRITE DEPLOY; do
        if approval_check "$action" "test-task" ""; then
            _test_fail "approval_check_blocks_without_token" "Action $action should be blocked in dry-run"
            return 1
        fi
    done

    _test_pass "approval_check_blocks_without_token"
}

# test_approval_check_passes_for_read - Test that read operations pass
test_approval_check_passes_for_read() {
    _test_start "approval_check_passes_for_read"

    export DRY_RUN=true

    if ! approval_check "READ" "test-task" ""; then
        _test_fail "approval_check_passes_for_read" "READ should always pass"
        return 1
    fi

    if ! approval_check "STATUS" "test-task" ""; then
        _test_fail "approval_check_passes_for_read" "STATUS should always pass"
        return 1
    fi

    _test_pass "approval_check_passes_for_read"
}

# test_approval_enforce_commit_blocks - Test commit enforcement blocks
test_approval_enforce_commit_blocks() {
    _test_start "approval_enforce_commit_blocks"

    export DRY_RUN=true

    if approval_enforce_commit "test-task" "/tmp/worktree" ""; then
        _test_fail "approval_enforce_commit_blocks" "COMMIT should be blocked in dry-run"
        return 1
    fi

    _test_pass "approval_enforce_commit_blocks"
}

# test_approval_enforce_db_write_blocks - Test DB_WRITE enforcement blocks
test_approval_enforce_db_write_blocks() {
    _test_start "approval_enforce_db_write_blocks"

    export DRY_RUN=true

    if approval_enforce_db_write "test-task" "testdb" ""; then
        _test_fail "approval_enforce_db_write_blocks" "DB_WRITE should be blocked in dry-run"
        return 1
    fi

    _test_pass "approval_enforce_db_write_blocks"
}

# test_approval_enforce_deploy_blocks_in_dry_run - Test DEPLOY enforcement blocks in dry-run
test_approval_enforce_deploy_blocks_in_dry_run() {
    _test_start "approval_enforce_deploy_blocks_in_dry_run"

    export DRY_RUN=true

    # Should be blocked in dry-run mode
    if approval_enforce_deploy "test-task" "production" "" 2>/dev/null; then
        _test_fail "approval_enforce_deploy_blocks_in_dry_run" "DEPLOY should be blocked in dry-run"
        return 1
    fi

    _test_pass "approval_enforce_deploy_blocks_in_dry_run"
}

# test_approval_generate_deploy_commands - Test deploy command generation (no approval needed)
test_approval_generate_deploy_commands() {
    _test_start "approval_generate_deploy_commands"

    local output
    output=$(approval_generate_deploy_commands "test-task" "staging")

    # Should be valid JSON
    if ! echo "$output" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "approval_generate_deploy_commands" "Output should be valid JSON"
        return 1
    fi

    # Should contain deploy commands
    if ! echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'commands' in d" 2>/dev/null; then
        _test_fail "approval_generate_deploy_commands" "Should contain commands field"
        return 1
    fi

    # Should be marked as dry_run
    if ! echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('dry_run') == True" 2>/dev/null; then
        _test_fail "approval_generate_deploy_commands" "Should be marked as dry_run"
        return 1
    fi

    _test_pass "approval_generate_deploy_commands"
}

# test_approval_status_json - Test status JSON generation
test_approval_status_json() {
    _test_start "approval_status_json"

    local status
    status=$(approval_status_json "test-task" "true")

    # Should be valid JSON
    if ! echo "$status" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "approval_status_json" "Status should be valid JSON"
        return 1
    fi

    # Should contain required fields
    if ! echo "$status" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'timestamp' in d; assert 'dry_run' in d; assert 'approval_config' in d" 2>/dev/null; then
        _test_fail "approval_status_json" "Status should contain required fields"
        return 1
    fi

    # Should contain task_approvals when task_id provided
    if ! echo "$status" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'task_approvals' in d" 2>/dev/null; then
        _test_fail "approval_status_json" "Status should contain task_approvals"
        return 1
    fi

    _test_pass "approval_status_json"
}

# test_approval_record_failure - Test failure recording
test_approval_record_failure() {
    _test_start "approval_record_failure"

    local evidence_file
    evidence_file=$(approval_record_failure "test-task" "concurrency_error" "test details")

    if [[ ! -f "$evidence_file" ]]; then
        _test_fail "approval_record_failure" "Evidence file should be created"
        return 1
    fi

    # Should be valid JSON
    if ! python3 -c "import json; json.load(open('$evidence_file'))" 2>/dev/null; then
        _test_fail "approval_record_failure" "Evidence should be valid JSON"
        return 1
    fi

    _test_pass "approval_record_failure"
}

# test_approval_concurrency - Test concurrency checks
test_approval_concurrency() {
    _test_start "approval_concurrency"

    local worker1="worker-1-$$"
    local worker2="worker-2-$$"

    # Worker 1 should acquire lock
    if ! approval_check_concurrency "test-resource" "resource-1" "$worker1"; then
        _test_fail "approval_concurrency" "Worker 1 should acquire lock"
        return 1
    fi

    # Worker 2 should be blocked
    if approval_check_concurrency "test-resource" "resource-1" "$worker2" 2>/dev/null; then
        _test_fail "approval_concurrency" "Worker 2 should be blocked"
        approval_release_concurrency "test-resource" "resource-1" "$worker1"
        return 1
    fi

    # Worker 1 should release
    approval_release_concurrency "test-resource" "resource-1" "$worker1"

    _test_pass "approval_concurrency"
}

# test_approval_cleanup_expired - Test token cleanup
test_approval_cleanup_expired() {
    _test_start "approval_cleanup_expired"

    local cleaned
    cleaned=$(approval_cleanup_expired)

    # Should complete without error
    if ! [[ "$cleaned" =~ ^[0-9]+$ ]]; then
        _test_fail "approval_cleanup_expired" "Should return numeric count"
        return 1
    fi

    _test_pass "approval_cleanup_expired"
}

# test_approval_worktree_evidence - Test worktree evidence
test_approval_worktree_evidence() {
    _test_start "approval_worktree_evidence"

    local evidence
    evidence=$(approval_get_worktree_evidence "/tmp/test-worktree")

    # Should be valid JSON
    if ! echo "$evidence" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        _test_fail "approval_worktree_evidence" "Evidence should be valid JSON"
        return 1
    fi

    # Should contain required fields
    if ! echo "$evidence" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'worktree_path' in d; assert 'timestamp' in d" 2>/dev/null; then
        _test_fail "approval_worktree_evidence" "Evidence should contain required fields"
        return 1
    fi

    _test_pass "approval_worktree_evidence"
}

# setup - Create test environment
setup() {
    mkdir -p "$APPROVAL_TOKEN_DIR" "$APPROVAL_LOG_DIR" "$APPROVAL_EVIDENCE_DIR" "${APPROVAL_CONFIG_DIR}/.locks"
    mkdir -p "${TEST_DIR}/worktrees/test-worktree/.git"
}

# teardown - Clean up test environment
teardown() {
    rm -rf "$TEST_DIR"
}

# run_tests - Run all tests
run_tests() {
    echo "=========================================="
    echo "Running Approval System Tests"
    echo "=========================================="

    setup

    test_approval_requires_token
    test_approval_check_blocks_without_token
    test_approval_check_passes_for_read
    test_approval_enforce_commit_blocks
    test_approval_enforce_db_write_blocks
    test_approval_enforce_deploy_blocks_in_dry_run
    test_approval_generate_deploy_commands
    test_approval_status_json
    test_approval_record_failure
    test_approval_concurrency
    test_approval_cleanup_expired
    test_approval_worktree_evidence

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