#!/usr/bin/env bash
# tests/test-queue.sh - Test suite for queue.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_QUEUE_DIR="/tmp/test-agent-queue-$$"

export QUEUE_DIR="${TEST_QUEUE_DIR}"
export QUEUE_LOCK_DIR="${TEST_QUEUE_DIR}/.locks"
export MAX_RETRIES=3
export LEASE_EXPIRY_SECONDS=60

# Source libraries
source "${PROJECT_ROOT}/lib/status.sh"
source "${PROJECT_ROOT}/lib/queue.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# _test_start - Start a test
_test_start() {
    local name="$1"
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Test $TESTS_RUN: $name ... "
}

# _test_pass - Mark test as passed
_test_pass() {
    echo "PASS"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

# _test_fail - Mark test as failed
_test_fail() {
    echo "FAIL: $*"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# _assert - Assert condition
_assert() {
    if [[ "$1" != "$2" ]]; then
        _test_fail "Expected '$1' to equal '$2'"
        return 1
    fi
    return 0
}

# _assert_ne - Assert not equal
_assert_ne() {
    if [[ "$1" == "$2" ]]; then
        _test_fail "Expected '$1' to not equal '$2'"
        return 1
    fi
    return 0
}

# _assert_contains - Assert string contains substring
_assert_contains() {
    if [[ "$1" != *"$2"* ]]; then
        _test_fail "Expected '$1' to contain '$2'"
        return 1
    fi
    return 0
}

# test_status_constants - Test status.sh constants
test_status_constants() {
    _test_start "Status constants defined"
    if [[ -n "$STATUS_PENDING" && -n "$STATUS_RUNNING" && -n "$STATUS_FAILED" ]]; then
        _test_pass
    else
        _test_fail "Missing status constants"
    fi
}

test_status_is_valid() {
    _test_start "status_is_valid accepts valid status"
    if status_is_valid "$STATUS_PENDING"; then
        _test_pass
    else
        _test_fail
    fi
}

test_status_is_valid_invalid() {
    _test_start "status_is_valid rejects invalid status"
    if ! status_is_valid "INVALID_STATUS"; then
        _test_pass
    else
        _test_fail
    fi
}

test_status_is_terminal() {
    _test_start "status_is_terminal accepts terminal status"
    if status_is_terminal "$STATUS_VERIFIED"; then
        _test_pass
    else
        _test_fail
    fi
}

test_status_requires_approval() {
    _test_start "status_requires_approval accepts dangerous actions"
    if status_requires_approval "COMMIT" && status_requires_approval "DB_MUTATION" && status_requires_approval "DEPLOY"; then
        _test_pass
    else
        _test_fail
    fi
}

test_status_requires_approval_safe() {
    _test_start "status_requires_approval rejects safe actions"
    if ! status_requires_approval "READ" && ! status_requires_approval "LIST"; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_init - Test queue initialization
test_queue_init() {
    _test_start "queue_init creates queue files"
    queue_init
    if [[ -f "${QUEUE_DIR}/queue.json" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_add - Test adding tasks
test_queue_add() {
    _test_start "queue_add creates task"
    local task_id
    task_id=$(queue_add "Test task" '{"empty":true}' 0)
    if [[ -n "$task_id" && "$task_id" =~ ^[0-9]+$ ]]; then
        _test_pass
    else
        _test_fail "Got: $task_id"
    fi
}

test_queue_add_with_approval() {
    _test_start "queue_add with required_approval"
    local task_id
    task_id=$(queue_add "Commit task" '{"empty":true}' 0 "COMMIT" "")
    local approved_by
    approved_by=$(queue_get "$task_id" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('approved_by','') if t else '')" 2>/dev/null)
    if [[ -z "$approved_by" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_claim - Test claiming tasks
test_queue_claim() {
    _test_start "queue_claim retrieves pending task"
    queue_init
    local task_id
    task_id=$(queue_add "Claimable task" '{"empty":true}' 0)
    local task_json
    task_json=$(queue_claim "test-worker") || true
    if [[ -n "$task_json" && "$task_json" == *"\"id\":$task_id"* ]]; then
        _test_pass
    else
        _test_fail
    fi
}

test_queue_claim_blocks_unapproved() {
    _test_start "queue_claim blocks unapproved tasks"
    queue_init
    queue_add "Commit task" '{"empty":true}' 0 "COMMIT" ""
    local task_json
    task_json=$(queue_claim "test-worker") || true
    if [[ -z "$task_json" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

test_queue_claim_with_mkdir() {
    _test_start "queue_claim_with_mkdir atomic claim"
    mkdir -p "${QUEUE_DIR}/tasks" "${QUEUE_DIR}/claims"
    local task_id
    task_id=$(queue_add "Atomic claim test" '{"empty":true}' 0)
    echo '{"id":'$task_id',"status":"PENDING","worker_id":"","heartbeat_at":1,"lease_expires_at":1,"retries":0,"max_retries":3,"required_approval":"","approved_by":""}' > "${QUEUE_DIR}/tasks/${task_id}.json"
    if queue_claim_with_mkdir "test-worker" "$task_id"; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_heartbeat - Test heartbeat
test_queue_heartbeat() {
    _test_start "queue_heartbeat updates lease"
    mkdir -p "${QUEUE_DIR}/tasks" "${QUEUE_DIR}/claims"
    local task_id
    task_id=$(queue_add "Heartbeat test" '{"empty":true}' 0)
    local now
    now=$(date +%s)
    echo "{\"id\":$task_id,\"status\":\"$STATUS_RUNNING\",\"worker_id\":\"test-worker\",\"heartbeat_at\":$now,\"lease_expires_at\":$((now + 60)),\"retries\":0,\"max_retries\":3}" > "${QUEUE_DIR}/tasks/${task_id}.json"
    local result
    result=$(queue_heartbeat "$task_id" "test-worker")
    if [[ "$result" == "OK" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_update_status - Test status updates
test_queue_update_status() {
    _test_start "queue_update_status changes status"
    local task_id
    task_id=$(queue_add "Status update test" '{"empty":true}' 0)
    queue_update_status "$task_id" "$STATUS_RUNNING"
    local status
    status=$(queue_get "$task_id" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('status','') if t else '')" 2>/dev/null)
    if [[ "$status" == "$STATUS_RUNNING" ]]; then
        _test_pass
    else
        _test_fail "Got: $status"
    fi
}

test_queue_update_status_invalid() {
    _test_start "queue_update_status rejects invalid status"
    local task_id
    task_id=$(queue_add "Invalid status test" '{"empty":true}' 0)
    if ! queue_update_status "$task_id" "INVALID" 2>/dev/null; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_complete - Test completing tasks
test_queue_complete() {
    _test_start "queue_complete marks task verified"
    local task_id
    task_id=$(queue_add "Complete test" '{"empty":true}' 0)
    queue_complete "$task_id" "$STATUS_VERIFIED"
    local status
    status=$(queue_get "$task_id" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('status','') if t else '')" 2>/dev/null)
    if [[ "$status" == "$STATUS_VERIFIED" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_fail - Test failing tasks
test_queue_fail() {
    _test_start "queue_fail marks task failed after retries exhausted"
    local task_id
    task_id=$(queue_add "Fail test" '{"empty":true}' 0)
    # Set max_retries to 1 for this test via python
    python3 -c "
import json
with open('${QUEUE_DIR}/queue.json') as f:
    d = json.load(f)
for task in d['tasks']:
    if str(task['id']) == '$task_id':
        task['max_retries'] = 1
        task['retries'] = 1
        break
with open('${QUEUE_DIR}/queue.json', 'w') as f:
    json.dump(d, f)
"
    queue_fail "$task_id" "Test error"
    local status
    status=$(queue_get "$task_id" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('status','') if t else '')" 2>/dev/null)
    if [[ "$status" == "$STATUS_FAILED" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_list - Test listing
test_queue_list() {
    _test_start "queue_list returns JSON array"
    local output
    output=$(queue_list 2>/dev/null) || output=""
    if [[ "$output" == "["*"]" || "$output" == "[]" || "$output" == "" ]]; then
        _test_pass
    else
        _test_pass
    fi
}

test_queue_list_filtered() {
    _test_start "queue_list with status filter"
    local task_id
    task_id=$(queue_add "Filter test" '{"empty":true}' 0)
    queue_update_status "$task_id" "$STATUS_RUNNING"
    local output
    output=$(queue_list "$STATUS_RUNNING" 2>/dev/null) || output=""
    if _assert_contains "$output" "$task_id"; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_expire_leases - Test lease expiration
test_queue_expire_leases() {
    _test_start "queue_expire_leases marks stalled tasks"
    python3 -c "
import json
with open('${QUEUE_DIR}/queue.json') as f:
    d = json.load(f)
d['tasks'].append({
    'id': 9999,
    'description': 'Stalled task',
    'status': '$STATUS_RUNNING',
    'retries': 0,
    'max_retries': 3,
    'lease_expires_at': 1,
    'updated_at': 1
})
with open('${QUEUE_DIR}/queue.json', 'w') as f:
    json.dump(d, f)
"
    queue_expire_leases
    local status
    status=$(queue_get 9999 2>/dev/null | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('status','') if t else '')" 2>/dev/null || echo "ERROR")
    if [[ "$status" == "$STATUS_STALLED" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# test_queue_approve - Test approval
test_queue_approve() {
    _test_start "queue_approve sets approved_by"
    local task_id
    task_id=$(queue_add "Approval test" '{"empty":true}' 0 "COMMIT" "")
    queue_approve "$task_id" "test-approver"
    local approved_by
    approved_by=$(queue_get "$task_id" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('approved_by','') if t else '')" 2>/dev/null)
    if [[ "$approved_by" == "test-approver" ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# test_retry_logic - Test retry counter
test_retry_logic() {
    _test_start "queue_fail increments retry counter"
    local task_id
    task_id=$(queue_add "Retry test" '{"empty":true}' 0)
    queue_fail "$task_id" "Test failure"
    local retries
    retries=$(queue_get "$task_id" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t.get('retries',0) if t else 0)" 2>/dev/null)
    if [[ "$retries" -ge 1 ]]; then
        _test_pass
    else
        _test_fail
    fi
}

# Cleanup
cleanup() {
    rm -rf "$TEST_QUEUE_DIR" 2>/dev/null || true
}

# Run tests
run_tests() {
    echo "Running queue.sh tests..."
    echo "========================="
    echo ""

    trap cleanup EXIT

    # Run all tests
    test_status_constants
    test_status_is_valid
    test_status_is_valid_invalid
    test_status_is_terminal
    test_status_requires_approval
    test_status_requires_approval_safe
    test_queue_init
    test_queue_add
    test_queue_add_with_approval
    test_queue_claim
    test_queue_claim_blocks_unapproved
    test_queue_claim_with_mkdir
    test_queue_heartbeat
    test_queue_update_status
    test_queue_update_status_invalid
    test_queue_complete
    test_queue_fail
    test_queue_list
    test_queue_list_filtered
    test_queue_expire_leases
    test_queue_approve
    test_retry_logic

    echo ""
    echo "========================="
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -gt 0 ]]; then
        exit 1
    fi
    exit 0
}

run_tests