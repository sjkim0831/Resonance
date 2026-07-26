#!/usr/bin/env bash
# tests/test-health.sh - Tests for agent-health health check script

set +euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_SCRIPT="${ORCHESTRATOR_DIR}/bin/agent-health"

TEST_DIR="/tmp/agent-health-test-$$"

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

_test_start() {
    local test_name="$1"
    echo "[TEST] Starting: $test_name"
    ((TESTS_RUN++)) || true
}

_test_pass() {
    local test_name="$1"
    echo "[PASS] $test_name"
    ((TESTS_PASSED++)) || true
}

_test_fail() {
    local test_name="$1"
    local reason="$2"
    echo "[FAIL] $test_name: $reason"
    ((TESTS_FAILED++)) || true
}

setup() {
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR/queue"
    mkdir -p "$TEST_DIR/workers/runs"
    mkdir -p "$TEST_DIR/keypool"
    mkdir -p "$TEST_DIR/logs"
    mkdir -p "$TEST_DIR/approvals"
    mkdir -p "$TEST_DIR/git"
}

teardown() {
    rm -rf "$TEST_DIR"
}

get_health_json() {
    QUEUE_DIR="${TEST_DIR}/queue" \
    WORKER_RUN_DIR="${TEST_DIR}/workers/runs" \
    KEYPOOL_DIR="${TEST_DIR}/keypool" \
    LOG_DIR="${TEST_DIR}/logs" \
    GIT_ROOT="${TEST_DIR}/git" \
    LIVE_STATUS_FILE="${TEST_DIR}/live-status.json" \
    bash "$HEALTH_SCRIPT" --json 2>/dev/null
}

test_help_flag() {
    _test_start "test_help_flag"
    local result
    result=$("$HEALTH_SCRIPT" --help 2>&1)
    if [[ $? -ne 0 ]]; then
        _test_fail "test_help_flag" "Should show help without error"
        return 1
    fi
    _test_pass "test_help_flag"
}

test_json_flag_exists() {
    _test_start "test_json_flag_exists"
    local output
    output=$(get_health_json)
    local jq_result
    jq_result=$(echo "$output" | jq -e . 2>&1)
    if [[ $? -ne 0 ]]; then
        _test_fail "test_json_flag_exists" "Should output valid JSON with --json"
        return 1
    fi
    _test_pass "test_json_flag_exists"
}

test_json_has_required_fields() {
    _test_start "test_json_has_required_fields"
    local output
    output=$(get_health_json)
    if ! echo "$output" | jq -e '.health' >/dev/null 2>&1; then
        _test_fail "test_json_has_required_fields" "JSON should have health field"
        return 1
    fi
    if ! echo "$output" | jq -e '.timestamp' >/dev/null 2>&1; then
        _test_fail "test_json_has_required_fields" "JSON should have timestamp field"
        return 1
    fi
    if ! echo "$output" | jq -e '.checks' >/dev/null 2>&1; then
        _test_fail "test_json_has_required_fields" "JSON should have checks field"
        return 1
    fi
    if ! echo "$output" | jq -e '.summary' >/dev/null 2>&1; then
        _test_fail "test_json_has_required_fields" "JSON should have summary field"
        return 1
    fi
    _test_pass "test_json_has_required_fields"
}

test_text_output() {
    _test_start "test_text_output"
    local output
    output=$(QUEUE_DIR="${TEST_DIR}/queue" WORKER_RUN_DIR="${TEST_DIR}/workers/runs" KEYPOOL_DIR="${TEST_DIR}/keypool" LOG_DIR="${TEST_DIR}/logs" GIT_ROOT="${TEST_DIR}/git" bash "$HEALTH_SCRIPT" 2>/dev/null)
    if ! echo "$output" | grep -q "AI Orchestrator Health Check"; then
        _test_fail "test_text_output" "Should have header in text output"
        return 1
    fi
    if ! echo "$output" | grep -q "Summary:"; then
        _test_fail "test_text_output" "Should have summary in text output"
        return 1
    fi
    if ! echo "$output" | grep -q "Overall:"; then
        _test_fail "test_text_output" "Should have overall status in text output"
        return 1
    fi
    _test_pass "test_text_output"
}

test_checks_all_present() {
    _test_start "test_checks_all_present"
    local output
    output=$(get_health_json)
    local expected_checks=(
        "live-status-watcher"
        "slots"
        "log-freshness"
        "queue-json"
        "required-files"
        "keypool-state"
        "git-root"
        "test-suite"
    )
    for check in "${expected_checks[@]}"; do
        if ! echo "$output" | jq -e ".checks[\"$check\"]" >/dev/null 2>&1; then
            _test_fail "test_checks_all_present" "Missing check: $check"
            return 1
        fi
    done
    _test_pass "test_checks_all_present"
}

test_summary_counts() {
    _test_start "test_summary_counts"
    local output
    output=$(get_health_json)
    local total passed degraded failed
    total=$(echo "$output" | jq -r '.summary.total')
    passed=$(echo "$output" | jq -r '.summary.passed')
    degraded=$(echo "$output" | jq -r '.summary.degraded')
    failed=$(echo "$output" | jq -r '.summary.failed')

    if ! [[ "$total" =~ ^[0-9]+$ ]]; then
        _test_fail "test_summary_counts" "total should be numeric, got: $total"
        return 1
    fi
    if ! [[ "$passed" =~ ^[0-9]+$ ]]; then
        _test_fail "test_summary_counts" "passed should be numeric, got: $passed"
        return 1
    fi

    local sum=$((passed + degraded + failed))
    if (( sum != total )); then
        _test_fail "test_summary_counts" "passed+degraded+failed != total ($sum != $total)"
        return 1
    fi
    _test_pass "test_summary_counts"
}

test_health_status_values() {
    _test_start "test_health_status_values"
    local output
    output=$(get_health_json)
    local health
    health=$(echo "$output" | jq -r '.health')
    case "$health" in
        PASS|DEGRADED|FAIL) ;;
        *)
            _test_fail "test_health_status_values" "Invalid health status: $health"
            return 1
            ;;
    esac
    _test_pass "test_health_status_values"
}

test_check_status_values() {
    _test_start "test_check_status_values"
    local output
    output=$(get_health_json)
    local checks_json
    checks_json=$(echo "$output" | jq -c '.checks')
    local check_names
    check_names=$(echo "$checks_json" | jq -r 'keys[]')
    while IFS= read -r check_name; do
        local status
        status=$(echo "$checks_json" | jq -r ".[\"$check_name\"].status")
        case "$status" in
            PASS|DEGRADED|FAILED) ;;
            *)
                _test_fail "test_check_status_values" "Invalid check status for $check_name: $status"
                return 1
                ;;
        esac
    done <<< "$check_names"
    _test_pass "test_check_status_values"
}

test_queue_json_valid() {
    _test_start "test_queue_json_valid"
    echo '{"tasks":[],"next_id":1}' > "${TEST_DIR}/queue/queue.json"
    local output
    output=$(get_health_json)
    local queue_status
    queue_status=$(echo "$output" | jq -r '.checks["queue-json"].status')
    if [[ "$queue_status" == "FAILED" ]]; then
        _test_fail "test_queue_json_valid" "queue-json should pass with valid JSON"
        return 1
    fi
    _test_pass "test_queue_json_valid"
}

test_queue_json_invalid() {
    _test_start "test_queue_json_invalid"
    echo 'not valid json' > "${TEST_DIR}/queue/queue.json"
    local output
    output=$(get_health_json)
    local queue_status
    queue_status=$(echo "$output" | jq -r '.checks["queue-json"].status')
    if [[ "$queue_status" != "FAILED" ]]; then
        _test_fail "test_queue_json_invalid" "queue-json should fail with invalid JSON"
        return 1
    fi
    _test_pass "test_queue_json_invalid"
}

test_keypool_state_valid() {
    _test_start "test_keypool_state_valid"
    echo '{"status":"healthy","size":5,"available":3}' > "${TEST_DIR}/keypool/state.json"
    local output
    output=$(get_health_json)
    local keypool_status
    keypool_status=$(echo "$output" | jq -r '.checks["keypool-state"].status')
    if [[ "$keypool_status" != "PASS" ]]; then
        _test_fail "test_keypool_state_valid" "keypool should pass with healthy status"
        return 1
    fi
    _test_pass "test_keypool_state_valid"
}

test_keypool_state_depleted() {
    _test_start "test_keypool_state_depleted"
    echo '{"status":"depleted","size":0,"available":0}' > "${TEST_DIR}/keypool/state.json"
    local output
    output=$(get_health_json)
    local keypool_status
    keypool_status=$(echo "$output" | jq -r '.checks["keypool-state"].status')
    if [[ "$keypool_status" != "DEGRADED" ]]; then
        _test_fail "test_keypool_state_depleted" "keypool should be degraded with depleted status"
        return 1
    fi
    _test_pass "test_keypool_state_depleted"
}

test_no_modification() {
    _test_start "test_no_modification"
    local before_git
    before_git=$(git -C /opt/Resonance status --porcelain 2>/dev/null | head -1 || echo "")
    local before_queues
    before_queues=$(ls -la /var/tmp/agent-queue/queue.json 2>/dev/null || echo "")
    QUEUE_DIR="/var/tmp/agent-queue" WORKER_RUN_DIR="/var/tmp/agent-workers/runs" KEYPOOL_DIR="/var/tmp/agent-keypool" LOG_DIR="${ORCHESTRATOR_DIR}/logs" GIT_ROOT="/opt/Resonance" bash "$HEALTH_SCRIPT" --json >/dev/null 2>&1 || true
    local after_git
    after_git=$(git -C /opt/Resonance status --porcelain 2>/dev/null | head -1 || echo "")
    local after_queues
    after_queues=$(ls -la /var/tmp/agent-queue/queue.json 2>/dev/null || echo "")
    if [[ "$before_git" != "$after_git" ]]; then
        _test_fail "test_no_modification" "Git state changed after health check"
        return 1
    fi
    if [[ "$before_queues" != "$after_queues" ]]; then
        _test_fail "test_no_modification" "Queue state changed after health check"
        return 1
    fi
    _test_pass "test_no_modification"
}

test_live_status_watcher_fresh() {
    _test_start "test_live_status_watcher_fresh"
    local live_status_file="${TEST_DIR}/live-status.json"
    cat > "$live_status_file" << 'EOF'
{"updatedAt":"2026-07-12T00:00:00Z","workers":[{"slot":1,"session":"kilo-slot1-keypool-retry","status":"RUNNING"},{"slot":2,"session":"kilo-slot2-queue-repair","status":"RUNNING"}]}
EOF
    local output
    LIVE_STATUS_FILE="$live_status_file" bash "$HEALTH_SCRIPT" --json 2>/dev/null | jq -e '.checks["live-status-watcher"].status == "PASS"' >/dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        _test_fail "test_live_status_watcher_fresh" "fresh live-status should PASS"
        return 1
    fi
    _test_pass "test_live_status_watcher_fresh"
}

test_live_status_watcher_missing() {
    _test_start "test_live_status_watcher_missing"
    local live_status_file="${TEST_DIR}/nonexistent.json"
    local output
    export LIVE_STATUS_FILE="$live_status_file"
    output=$(bash "$HEALTH_SCRIPT" --json 2>/dev/null)
    unset LIVE_STATUS_FILE
    local status
    status=$(echo "$output" | jq -r '.checks["live-status-watcher"].status')
    if [[ "$status" != "DEGRADED" ]]; then
        _test_fail "test_live_status_watcher_missing" "missing live-status should be DEGRADED, got $status"
        return 1
    fi
    _test_pass "test_live_status_watcher_missing"
}

test_slots_from_live_status() {
    _test_start "test_slots_from_live_status"
    local live_status_file="${TEST_DIR}/live-status.json"
    mkdir -p "${TEST_DIR}/git"
    cat > "$live_status_file" << 'EOF'
{"updatedAt":"2026-07-12T00:00:00Z","workers":[{"slot":1,"session":"kilo-slot1-keypool-retry","status":"RUNNING"},{"slot":2,"session":"kilo-slot2-queue-repair","status":"RUNNING"},{"slot":3,"session":"kilo-slot3-health-real","status":"RUNNING"}]}
EOF
    echo "fake" > "${TEST_DIR}/git/.git"
    local output
    LIVE_STATUS_FILE="$live_status_file" GIT_ROOT="${TEST_DIR}/git" bash "$HEALTH_SCRIPT" --json 2>/dev/null | jq -e '.checks.slots.status == "PASS"' >/dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        _test_fail "test_slots_from_live_status" "3 slots with live-status should PASS"
        return 1
    fi
    _test_pass "test_slots_from_live_status"
}

test_slots_zero_active_is_failed() {
    _test_start "test_slots_zero_active_is_failed"
    local live_status_file="${TEST_DIR}/live-status.json"
    mkdir -p "${TEST_DIR}/git"
    cat > "$live_status_file" << 'EOF'
{"updatedAt":"2026-07-12T00:00:00Z","workers":[]}
EOF
    echo "fake" > "${TEST_DIR}/git/.git"
    local output
    LIVE_STATUS_FILE="$live_status_file" GIT_ROOT="${TEST_DIR}/git" bash "$HEALTH_SCRIPT" --json 2>/dev/null | jq -e '.checks.slots.status == "FAILED"' >/dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        _test_fail "test_slots_zero_active_is_failed" "0 active slots should be FAILED"
        return 1
    fi
    _test_pass "test_slots_zero_active_is_failed"
}

test_queue_missing_is_baseline() {
    _test_start "test_queue_missing_is_baseline"
    mkdir -p "${TEST_DIR}/git"
    echo "fake" > "${TEST_DIR}/git/.git"
    local output
    GIT_ROOT="${TEST_DIR}/git" bash "$HEALTH_SCRIPT" --json 2>/dev/null | jq -e '.checks["queue-json"].status == "PASS"' >/dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        _test_fail "test_queue_missing_is_baseline" "missing queue should be baseline PASS"
        return 1
    fi
    _test_pass "test_queue_missing_is_baseline"
}

test_dirty_root_protected_is_informational() {
    _test_start "test_dirty_root_protected_is_informational"
    mkdir -p "${TEST_DIR}/repo"
    rm -rf "${TEST_DIR}/repo/.git"
    cd "${TEST_DIR}/repo" && git init && git config init.defaultBranch main && git config user.email "test@test.com" && git config user.name "Test" && touch file1.txt && git add . && git commit -m "initial" >/dev/null 2>&1
    echo "change" > "${TEST_DIR}/repo/file1.txt"
    cd - >/dev/null
    local output
    GIT_ROOT="${TEST_DIR}/repo" output=$(bash "$HEALTH_SCRIPT" --json 2>/dev/null)
    local status
    status=$(echo "$output" | jq -r '.checks["git-root"].status')
    if [[ "$status" != "PASS" ]]; then
        _test_fail "test_dirty_root_protected_is_informational" "dirty on protected branch should be PASS (informational), got $status"
        return 1
    fi
    _test_pass "test_dirty_root_protected_is_informational"
}

test_health_exit_nonzero_for_degraded() {
    _test_start "test_health_exit_nonzero_for_degraded"
    local live_status_file="${TEST_DIR}/live-status.json"
    cat > "$live_status_file" << 'EOF'
{"updatedAt":"2020-01-01T00:00:00Z","workers":[]}
EOF
    mkdir -p "${TEST_DIR}/git"
    echo "fake" > "${TEST_DIR}/git/.git"
    LIVE_STATUS_FILE="$live_status_file" GIT_ROOT="${TEST_DIR}/git" bash "$HEALTH_SCRIPT" --json >/dev/null 2>&1
    local exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        _test_fail "test_health_exit_nonzero_for_degraded" "degraded state should exit non-zero, got $exit_code"
        return 1
    fi
    _test_pass "test_health_exit_nonzero_for_degraded"
}

test_no_secrets_in_output() {
    _test_start "test_no_secrets_in_output"
    local live_status_file="${TEST_DIR}/live-status.json"
    cat > "$live_status_file" << 'EOF'
{"updatedAt":"2026-07-12T00:00:00Z","workers":[{"slot":1,"session":"kilo-slot1-keypool-retry","status":"RUNNING","api_key":"secret123"}]}
EOF
    mkdir -p "${TEST_DIR}/git"
    echo "fake" > "${TEST_DIR}/git/.git"
    local output
    LIVE_STATUS_FILE="$live_status_file" GIT_ROOT="${TEST_DIR}/git" output=$(bash "$HEALTH_SCRIPT" --json 2>/dev/null)
    if echo "$output" | grep -i "secret123" >/dev/null 2>&1; then
        _test_fail "test_no_secrets_in_output" "secrets should not appear in health output"
        return 1
    fi
    _test_pass "test_no_secrets_in_output"
}

test_slots_count_matches_session_list() {
    _test_start "test_slots_count_matches_session_list"
    local live_status_file="${TEST_DIR}/live-status.json"
    mkdir -p "${TEST_DIR}/git"
    echo "fake" > "${TEST_DIR}/git/.git"
    cat > "$live_status_file" << 'EOF'
{"updatedAt":"2026-07-12T00:00:00Z","workers":[{"slot":1,"session":"kilo-slot1-keypool-retry","status":"RUNNING"},{"slot":2,"session":"kilo-slot2-queue-repair","status":"RUNNING"},{"slot":3,"session":null,"status":"IDLE"}]}
EOF
    local output
    LIVE_STATUS_FILE="$live_status_file" GIT_ROOT="${TEST_DIR}/git" output=$(bash "$HEALTH_SCRIPT" --json 2>/dev/null)
    local slots_details
    slots_details=$(echo "$output" | jq -r '.checks.slots.details')
    local slots_count
    slots_count=$(echo "$slots_details" | sed -n 's/^\([0-9]\+\)\/[0-9]\+.*/\1/p')
    local sessions_in_bracket
    sessions_in_bracket=$(echo "$slots_details" | sed -n 's/.*\[\(.*\)\]/\1/p' | tr ',' '\n' | wc -l)
    if (( slots_count != sessions_in_bracket )); then
        _test_fail "test_slots_count_matches_session_list" "slots count $slots_count != sessions in list $sessions_in_bracket (details: $slots_details)"
        return 1
    fi
    _test_pass "test_slots_count_matches_session_list"
}

test_legacy_log_not_degraded_when_live_status_fresh() {
    _test_start "test_legacy_log_not_degraded_when_live_status_fresh"
    local live_status_file="${TEST_DIR}/live-status.json"
    mkdir -p "${TEST_DIR}/git"
    echo "fake" > "${TEST_DIR}/git/.git"
    mkdir -p "${TEST_DIR}/logs"
    cat > "$live_status_file" << 'EOF'
{"updatedAt":"2026-07-12T00:00:00Z","workers":[{"slot":1,"session":"kilo-slot1-active","status":"RUNNING"}]}
EOF
    touch -t $(date -d "2 hours ago" +%Y%m%d%H%M) "${TEST_DIR}/logs/agent-supervisor.log"
    touch -t $(date -d "10 seconds ago" +%Y%m%d%H%M) "${TEST_DIR}/logs/agent-kilo-slot1-active.log"
    local output
    LIVE_STATUS_FILE="$live_status_file" LOG_DIR="${TEST_DIR}/logs" GIT_ROOT="${TEST_DIR}/git" output=$(bash "$HEALTH_SCRIPT" --json 2>/dev/null)
    local log_status
    log_status=$(echo "$output" | jq -r '.checks["log-freshness"].status')
    local overall_health
    overall_health=$(echo "$output" | jq -r '.health')
    if [[ "$log_status" == "DEGRADED" ]]; then
        _test_fail "test_legacy_log_not_degraded_when_live_status_fresh" "legacy log should be informational, got status=$log_status"
        return 1
    fi
    if [[ "$overall_health" == "DEGRADED" ]]; then
        _test_fail "test_legacy_log_not_degraded_when_live_status_fresh" "overall should not be DEGRADED due to legacy log, got health=$overall_health"
        return 1
    fi
    _test_pass "test_legacy_log_not_degraded_when_live_status_fresh"
}

run_tests() {
    echo "=========================================="
    echo "Running Agent Health Check Tests"
    echo "=========================================="

    setup

    test_help_flag
    test_json_flag_exists
    test_json_has_required_fields
    test_text_output
    test_checks_all_present
    test_summary_counts
    test_health_status_values
    test_check_status_values
    test_queue_json_valid
    test_queue_json_invalid
    test_keypool_state_valid
    test_keypool_state_depleted
    test_no_modification
    test_live_status_watcher_fresh
    test_live_status_watcher_missing
    test_slots_from_live_status
    test_slots_zero_active_is_failed
    test_queue_missing_is_baseline
    test_dirty_root_protected_is_informational
    test_health_exit_nonzero_for_degraded
    test_no_secrets_in_output
    test_slots_count_matches_session_list
    test_legacy_log_informational_when_live_status_fresh

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

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_tests
fi