#!/bin/bash
# test-worker.sh - Tests for worker.sh and agent-worker
# Temp-directory tests for lock enforcement, heartbeat, backoff, safety

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="ops/ai-agent-orchestrator/lib/worker.sh"
BIN="ops/ai-agent-orchestrator/bin/agent-worker"

# Use temp directories for isolation
export WORKER_BASE_DIR=$(mktemp -d)
export WORKER_LOCK_DIR="${WORKER_BASE_DIR}/.locks"
export WORKER_LOG_DIR="${WORKER_BASE_DIR}/logs"
export WORKER_RUN_DIR="${WORKER_BASE_DIR}/runs"
export HEARTBEAT_INTERVAL=2  # Fast for testing
export MAX_SSE_RETRIES=2

source "$LIB"
chmod +x "$BIN"

pass=0; fail=0
ok() { echo "[PASS] $1"; ((++pass)); }
err() { echo "[FAIL] $1"; ((++fail)); }

echo "=== worker.sh tests ==="

# mkdir lock enforcement - one active task per slot
mkdir -p "$WORKER_LOCK_DIR"
lock1=$(worker_acquire_slot_lock "1") && ok "acquire slot 1 lock" || err "acquire slot 1 lock"
worker_check_slot_lock "1" && ok "slot 1 is locked" || err "slot 1 is locked"
worker_acquire_slot_lock "1" 2>/dev/null && err "second lock on slot 1 should fail" || ok "slot 1 already locked"
worker_release_slot_lock "1"
! worker_check_slot_lock "1" 2>/dev/null && ok "slot 1 released" || err "slot 1 not released"
lock2=$(worker_acquire_slot_lock "1") && ok "re-acquire slot 1 lock" || err "re-acquire slot 1 lock"
worker_release_slot_lock "1"

# multi-slot isolation
lock3=$(worker_acquire_slot_lock "2") && ok "slot 2 independent" || err "slot 2 independent"
lock4=$(worker_acquire_slot_lock "3") && ok "slot 3 independent" || err "slot 3 independent"
worker_release_slot_lock "2"
worker_release_slot_lock "3"

# heartbeat writing
mkdir -p "$WORKER_RUN_DIR"
worker_heartbeat "1" "test-task" "$$"
[[ -f "${WORKER_RUN_DIR}/heartbeat-slot-1.json" ]] && ok "heartbeat file created" || err "heartbeat file created"
grep -q "test-task" "${WORKER_RUN_DIR}/heartbeat-slot-1.json" && ok "heartbeat contains task_id" || err "heartbeat contains task_id"
grep -q "$$" "${WORKER_RUN_DIR}/heartbeat-slot-1.json" && ok "heartbeat contains pid" || err "heartbeat contains pid"
worker_clear_heartbeat "1"
! [[ -f "${WORKER_RUN_DIR}/heartbeat-slot-1.json" ]] 2>/dev/null && ok "heartbeat cleared" || err "heartbeat cleared"

# task file validation - missing file
worker_validate_task_file "/nonexistent/file.json" 2>/dev/null && err "missing file validation" || ok "missing file validation"

# task file validation - empty file
echo -n "" > "${WORKER_BASE_DIR}/empty.json"
worker_validate_task_file "${WORKER_BASE_DIR}/empty.json" 2>/dev/null && err "empty file validation" || ok "empty file validation"

# task file validation - invalid JSON
echo "not json" > "${WORKER_BASE_DIR}/invalid.json"
worker_validate_task_file "${WORKER_BASE_DIR}/invalid.json" 2>/dev/null && err "invalid JSON validation" || ok "invalid JSON validation"

# task file validation - valid JSON
echo '{"id":"task-123","description":"test"}' > "${WORKER_BASE_DIR}/valid.json"
worker_validate_task_file "${WORKER_BASE_DIR}/valid.json" && ok "valid JSON accepted" || err "valid JSON accepted"

# extract task fields
[[ "$(worker_extract_task_field "${WORKER_BASE_DIR}/valid.json" "id")" == "task-123" ]] && ok "extract id field" || err "extract id field"
[[ "$(worker_extract_task_field "${WORKER_BASE_DIR}/valid.json" "description")" == "test" ]] && ok "extract description field" || err "extract description field"
[[ -z "$(worker_extract_task_field "${WORKER_BASE_DIR}/valid.json" "nonexistent")" ]] && ok "missing field returns empty" || err "missing field returns empty"

# exponential backoff calculation
delay0=$(worker_calculate_backoff 0)
[[ "$delay0" -eq 1 ]] && ok "backoff attempt 0 = 1s" || err "backoff attempt 0 (got $delay0)"
delay1=$(worker_calculate_backoff 1)
[[ "$delay1" -eq 2 ]] && ok "backoff attempt 1 = 2s" || err "backoff attempt 1 (got $delay1)"
delay2=$(worker_calculate_backoff 2)
[[ "$delay2" -eq 4 ]] && ok "backoff attempt 2 = 4s" || err "backoff attempt 2 (got $delay2)"
delay3=$(worker_calculate_backoff 3)
[[ "$delay3" -eq 8 ]] && ok "backoff attempt 3 = 8s" || err "backoff attempt 3 (got $delay3)"
delay10=$(worker_calculate_backoff 10)
[[ "$delay10" -le 60 ]] && ok "backoff capped at max 60s" || err "backoff exceeds max (got $delay10)"

# safety checks - dangerous actions require approval
worker_safety_check "COMMIT" "t1" 2>/dev/null && err "COMMIT should be blocked" || ok "COMMIT blocked without approval"
worker_safety_check "DB_MUTATION" "t2" 2>/dev/null && err "DB_MUTATION should be blocked" || ok "DB_MUTATION blocked without approval"
worker_safety_check "DEPLOY" "t3" 2>/dev/null && err "DEPLOY should be blocked" || ok "DEPLOY blocked without approval"
worker_safety_check "SEARCH" "t4" && ok "SAFE action allowed" || err "SAFE action blocked"

# safety check - dangerous action detection in task file
echo '{"id":"t5","payload":{"action":"COMMIT"}}' > "${WORKER_BASE_DIR}/unsafe-task.json"
worker_check_dangerous_actions "${WORKER_BASE_DIR}/unsafe-task.json" 2>/dev/null && err "unsafe task detected" || ok "unsafe task blocked"

echo '{"id":"t6","payload":{"action":"SEARCH"}}' > "${WORKER_BASE_DIR}/safe-task.json"
worker_check_dangerous_actions "${WORKER_BASE_DIR}/safe-task.json" && ok "safe task allowed" || err "safe task blocked"

# result capture
result_file=$(worker_capture_result "test-task" "${WORKER_BASE_DIR}/test-output.log" "0")
[[ -f "$result_file" ]] && ok "result file created" || err "result file created"
grep -q '"exit_code": 0' "$result_file" && ok "exit code 0 captured" || err "exit code 0 captured"
grep -q '"success": true' "$result_file" && ok "success=true for exit 0" || err "success=true for exit 0"

result_file2=$(worker_capture_result "test-task-fail" "${WORKER_BASE_DIR}/test-output2.log" "1")
grep -q '"exit_code": 1' "$result_file2" && ok "exit code 1 captured" || err "exit code 1 captured"
grep -q '"success": false' "$result_file2" && ok "success=false for exit 1" || err "success=false for exit 1"

# agent-worker CLI - requires slot and task file
$BIN 2>/dev/null && err "missing args should fail" || ok "missing args fails"
help_out=$($BIN --help 2>&1 || true) && grep -q "Usage:" <<< "$help_out" && ok "--help works" || err "--help works"

# agent-worker - invalid slot
$BIN 5 "${WORKER_BASE_DIR}/valid.json" 2>/dev/null && err "invalid slot rejected" || ok "invalid slot rejected"

# agent-worker - missing task file
$BIN 1 "/nonexistent/task.json" 2>/dev/null && err "missing task file rejected" || ok "missing task file rejected"

# agent-worker - unsafe task blocked
$BIN 1 "${WORKER_BASE_DIR}/unsafe-task.json" 2>/dev/null && err "unsafe task blocked by worker" || ok "unsafe task blocked by worker"

# agent-worker - slot already locked
mkdir -p "$WORKER_LOCK_DIR"
mkdir "${WORKER_LOCK_DIR}/slot-1.lock"
$BIN 1 "${WORKER_BASE_DIR}/safe-task.json" 2>/dev/null && err "busy slot rejected" || ok "busy slot rejected"
rmdir "${WORKER_LOCK_DIR}/slot-1.lock"

echo ""
echo "=== Results: $pass passed, $fail failed ==="

# Cleanup
rm -rf "$WORKER_BASE_DIR"
exit $((fail > 0 ? 1 : 0))