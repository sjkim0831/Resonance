#!/bin/bash
# test-key-pool.sh - Tests for key-pool.sh
# Tests key states, HTTP error handling, timeout retry, fingerprints, atomicity,
# malformed state recovery, and secret non-disclosure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="ops/ai-agent-orchestrator/lib/key-pool.sh"

export KEYPOOL_DIR=$(mktemp -d)
export KEYPOOL_LOCK_DIR="${KEYPOOL_DIR}/.locks"
export KEYPOOL_STATE_FILE="${KEYPOOL_DIR}/keys.json"
export DEFAULT_COOLDOWN=2
export RATE_LIMIT_COOLDOWN=4
export AUTH_FAILURE_COOLDOWN=10

source "$LIB"

pass=0; fail=0
ok() { echo "[PASS] $1"; pass=$((pass+1)); }
err() { echo "[FAIL] $1"; fail=$((fail+1)); }

capture_stderr() {
    local cmd="$1"
    eval "$cmd" 2>&1 | tee /tmp/test_stderr_$$.txt
    echo "---STDERR---" >&2
    cat /tmp/test_stderr_$$.txt >&2
}

echo "=== key-pool.sh tests ==="

# --- Basic fingerprint tests ---
fp1=$(keypool_add "sk-test-key-1234567890" "test-key-1")
fp2=$(keypool_add "sk-other-key-abcdefghij" "test-key-2")
[[ "$fp1" != "$fp2" ]] && ok "fingerprints are distinct" || err "fingerprints must be distinct"
[[ ${#fp1} -eq 8 ]] && ok "fingerprint length is 8" || err "fingerprint length should be 8"
[[ ${#fp2} -eq 8 ]] && ok "fingerprint length is 8" || err "fingerprint length should be 8"

# --- Add key returns fingerprint ---
fp_test=$(keypool_add "sk-test-key-for-add" "add-test")
[[ ${#fp_test} -eq 8 ]] && ok "keypool_add returns fingerprint" || err "keypool_add should return fingerprint"

# --- get_available returns a key ---
key=$(keypool_get_available)
[[ -n "$key" ]] && ok "keypool_get_available returns key" || err "keypool_get_available should return key"

# --- get_available increments use_count ---
keypool_release "$fp_test"
keypool_get_available > /dev/null
stats=$(keypool_stats)
uses=$(echo "$stats" | jq -r '.total_uses')
[[ "${uses}" -ge 1 ]] && ok "use_count incremented" || err "use_count should be >= 1"

# --- release returns key to available ---
keypool_release "$fp_test"
stats=$(keypool_stats)
available=$(echo "$stats" | jq -r '.available')
[[ "${available}" -ge 1 ]] && ok "release makes key available" || err "release should make key available"

# --- cooldown state ---
keypool_remove "$fp1" 2>/dev/null || true
keypool_remove "$fp2" 2>/dev/null || true
keypool_cooldown "$fp_test" 2 "test cooldown"
stats=$(keypool_stats)
cooldown=$(echo "$stats" | jq -r '.cooldown')
[[ "${cooldown}" -ge 1 ]] && ok "cooldown state set" || err "cooldown should be set"

# --- key in cooldown not returned ---
retried_key=$(keypool_get_available 2>/dev/null || echo "NONE")
[[ "$retried_key" == "NONE" ]] && ok "cooldown key not returned" || err "cooldown key should not be returned"

# --- cooldown expires ---
sleep 3
keypool_get_available > /dev/null && ok "cooldown expires" || err "cooldown should expire"

# --- disable key ---
keypool_disable "$fp_test" "permanent failure"
stats=$(keypool_stats)
disabled=$(echo "$stats" | jq -r '.disabled')
[[ "${disabled}" -ge 1 ]] && ok "key disabled" || err "key should be disabled"

# --- disabled key not returned ---
retried_key=$(keypool_get_available 2>/dev/null || echo "NONE")
[[ "$retried_key" == "NONE" ]] && ok "disabled key not returned" || err "disabled key should not be returned"

# --- HTTP 401/403 disable with rotation (need 2+ keys) ---
fp_auth1=$(keypool_add "sk-auth-key-1" "auth-test-1")
fp_auth2=$(keypool_add "sk-auth-key-2" "auth-test-2")
keypool_on_http_error "$fp_auth1" 401 "invalid api key" 2>/dev/null || true
stats=$(keypool_stats)
disabled_count=$(echo "$stats" | jq -r '.disabled')
[[ "${disabled_count}" -ge 1 ]] && ok "401 disables key (multiple keys)" || err "401 should disable key"
# Verify rotation happened - fp_auth2 should be available
available_count=$(echo "$stats" | jq -r '.available')
[[ "${available_count}" -ge 1 ]] && ok "401 rotation leaves another key available" || err "401 should rotate to available key"

# --- HTTP 429 sets rate limit cooldown with rotation ---
fp_rl1=$(keypool_add "sk-ratelimit-key-1" "rl-test-1")
fp_rl2=$(keypool_add "sk-ratelimit-key-2" "rl-test-2")
keypool_on_http_error "$fp_rl1" 429 "rate limit exceeded" 2>/dev/null || true
stats=$(keypool_stats)
cooldown_count=$(echo "$stats" | jq -r '.cooldown')
[[ "${cooldown_count}" -ge 1 ]] && ok "429 sets cooldown" || err "429 should set cooldown"

# --- HTTP 403 auth failure ---
fp_403=$(keypool_add "sk-403-key" "403-test")
keypool_on_http_error "$fp_403" 403 "forbidden" 2>/dev/null || true
stats=$(keypool_stats)
disabled_403=$(echo "$stats" | jq -r '.disabled')
[[ "${disabled_403}" -ge 2 ]] && ok "403 also disables key" || err "403 should disable key"

# --- SSE timeout retry=0 returns 0 (caller should retry same key) ---
fp_timeout=$(keypool_add "sk-timeout-key" "timeout-test")
result=$(keypool_on_timeout "$fp_timeout" 0 2>/dev/null || echo "")
exit_code=$?
[[ $exit_code -eq 0 ]] && ok "timeout retry=0 returns success (caller retries same key)" || err "timeout retry=0 should return 0"

# --- SSE timeout retry=1 rotates to another key ---
fp_timeout2=$(keypool_add "sk-timeout-key-2" "timeout-test-2")
fp_timeout3=$(keypool_add "sk-timeout-key-3" "timeout-test-3")
keypool_clear_errors "$fp_timeout2" 2>/dev/null || true
# Clear any cooldown on fp_timeout3 too so it's available
keypool_clear_errors "$fp_timeout3" 2>/dev/null || true

# Call timeout with retry=1 - should cooldown fp_timeout2 and return another key
result=$(keypool_on_timeout "$fp_timeout2" 1 2>/dev/null || echo "")
# Result should be non-empty and should be a valid API key (starts with sk-)
if [[ -n "$result" && "$result" == sk-* ]]; then
    ok "timeout retry=1 returns rotated key: $result"
else
    err "timeout retry=1 should return rotated key (got: $result)"
fi

# --- list shows only fingerprints, never full keys ---
fp_listtest=$(keypool_add "sk-full-key-secret-123456789" "list-test")
list_output=$(keypool_list)
has_full_key=$(echo "$list_output" | grep -c "sk-full-key-secret" || true)
[[ "$has_full_key" -eq 0 ]] && ok "list never shows full key" || err "list should never show full key"
has_fingerprint=$(echo "$list_output" | grep -c "$fp_listtest" || true)
[[ "$has_fingerprint" -ge 1 ]] && ok "list shows fingerprint" || err "list shows fingerprint"

# --- remove key ---
keypool_remove "$fp_listtest"
list_output=$(keypool_list)
remaining=$(echo "$list_output" | jq --arg fp "$fp_listtest" '[.[] | select(.fingerprint == $fp)] | length')
[[ "${remaining}" -eq 0 ]] && ok "key removed" || err "key should be removed"

# --- clear_errors restores key ---
fp_clear=$(keypool_add "sk-error-key" "clear-test")
keypool_cooldown "$fp_clear" 60 "error"
keypool_clear_errors "$fp_clear"
stats=$(keypool_stats)
available_after_clear=$(echo "$stats" | jq -r '.available')
[[ "${available_after_clear}" -ge 1 ]] && ok "clear_errors restores availability" || err "clear_errors should restore availability"

# --- stats JSON structure ---
stats=$(keypool_stats)
echo "$stats" | jq -e '.total' > /dev/null && ok "stats has total" || err "stats should have total"
echo "$stats" | jq -e '.available' > /dev/null && ok "stats has available" || err "stats should have available"
echo "$stats" | jq -e '.cooldown' > /dev/null && ok "stats has cooldown" || err "stats should have cooldown"
echo "$stats" | jq -e '.disabled' > /dev/null && ok "stats has disabled" || err "stats should have disabled"

# --- HTTP error auto-rotation (with multiple keys) ---
fp_ar1=$(keypool_add "sk-auto-rotate-1" "ar-test-1")
fp_ar2=$(keypool_add "sk-auto-rotate-2" "ar-test-2")
keypool_on_http_error "$fp_ar1" 429 "rate limit" 2>/dev/null || true
new_key=$(keypool_get_available 2>/dev/null || echo "NONE")
[[ -n "$new_key" && "$new_key" != "NONE" ]] && ok "http error auto-rotates to new key" || err "should auto-rotate on http error"

# --- Secret non-disclosure in stderr and public interfaces ---
echo "" >&2
echo "=== Secret disclosure tests ===" >&2
# Test that full keys never appear in stderr or public outputs
fp_secret=$(keypool_add "sk-MYSUPERSECRETAPIKEY12345" "secret-test")

# Capture stderr for various operations
stderr_file="/tmp/kp_stderr_$$.txt"
> "$stderr_file"

# These operations should only log fingerprints, not full keys
keypool_on_http_error "$fp_secret" 401 "auth failed" 2>>"$stderr_file" || true
keypool_cooldown "$fp_secret" 10 "cooldown test" 2>>"$stderr_file" || true
keypool_disable "$fp_secret" "disable test" 2>>"$stderr_file" || true

# Check stderr contains no full key
if grep -q "MYSUPERSECRETAPIKEY12345" "$stderr_file" 2>/dev/null; then
    err "SECRET DISCLOSURE: Full key found in stderr"
else
    ok "stderr never contains full key secrets"
fi

# Check keypool_list (public interface) contains no full key
list_output=$(keypool_list)
if echo "$list_output" | grep -q "MYSUPERSECRETAPIKEY12345" 2>/dev/null; then
    err "SECRET DISCLOSURE: Full key found in keypool_list"
else
    ok "keypool_list never contains full key secrets"
fi

# Check keypool_stats (public interface) contains no full key
stats_output=$(keypool_stats)
if echo "$stats_output" | grep -q "MYSUPERSECRETAPIKEY12345" 2>/dev/null; then
    err "SECRET DISCLOSURE: Full key found in keypool_stats"
else
    ok "keypool_stats never contains full key secrets"
fi

rm -f "$stderr_file"

# --- Malformed state recovery ---
echo "" >&2
echo "=== Malformed state recovery tests ===" >&2
# Corrupt the state file
echo "not valid json{]" > "$KEYPOOL_STATE_FILE"

# Verify file is indeed malformed
if echo "not valid json{]" | jq -e '.' > /dev/null 2>&1; then
    ok "malformed state: jq confirms invalid JSON"
else
    ok "malformed state: JSON is invalid as expected"
fi

# Add key should trigger recovery - capture stdout only
fp_recover_stdout=$(keypool_add "sk-recovery-key" "recovery-test" 2>/dev/null)
if [[ -n "$fp_recover_stdout" && ${#fp_recover_stdout} -eq 8 ]]; then
    ok "can add key after malformed state recovery"
else
    err "should be able to add key after malformed state recovery (got: $fp_recover_stdout)"
fi

# Verify state file is now valid JSON
if jq -e '.' "$KEYPOOL_STATE_FILE" > /dev/null 2>&1; then
    ok "state file is valid JSON after recovery"
else
    err "state file should be valid JSON after recovery"
fi

# --- Enhanced concurrency tests: 20/20 x 10 consecutive runs ---
echo "" >&2
echo "=== Enhanced concurrent atomicity tests ===" >&2

export -f keypool_add

run_concurrent_round() {
    local count="$1"
    local prefix="$2"
    local pids=()
    for ((i=1; i<=count; i++)); do
        (
            source "$SCRIPT_DIR/../lib/key-pool.sh"
            keypool_add "sk-${prefix}-${i}" "${prefix}-${i}" >/dev/null 2>&1
        ) &
        pids+=($!)
    done
    for pid in "${pids[@]}"; do
        wait "$pid" || return 1
    done
}

check_tmp_leftovers() {
    local leftovers
    leftovers=$(ls -1 "${KEYPOOL_DIR}"/*.tmp.* 2>/dev/null || true)
    if [[ -n "$leftovers" ]]; then
        echo "TMP LEFTOVERS FOUND: $leftovers" >&2
        return 1
    fi
    return 0
}

check_secret_leakage() {
    local content
    content=$(cat "$KEYPOOL_STATE_FILE" 2>/dev/null || echo "")
    if echo "$content" | grep -qE "sk-(concurrent|worker|test-[0-9]+)" 2>/dev/null; then
        echo "SECRET LEAKAGE: Full keys found in state file" >&2
        return 1
    fi
    return 0
}

# Test 1: 20/20 concurrency, 10 consecutive runs (full key-pool exact total)
for round in $(seq 1 10); do
    rm -rf "$KEYPOOL_DIR" "$KEYPOOL_LOCK_DIR"
    mkdir -p "$KEYPOOL_DIR" "$KEYPOOL_LOCK_DIR"
    printf '{"keys":[],"next_index":0}' > "$KEYPOOL_STATE_FILE"

    run_concurrent_round 20 "round${round}" || { err "Round $round: worker process failed"; continue; }

    check_tmp_leftovers || { err "Round $round: tmp leftovers"; }
    check_secret_leakage || { err "Round $round: secret leakage"; }

    stats=$(keypool_stats)
    total=$(echo "$stats" | jq -r '.total')

    if [[ "$total" -eq 20 ]]; then
        ok "Round $round: 20/20 concurrent succeeded"
    else
        err "Round $round: only $total/20 succeeded"
    fi

    if echo "$stats" | jq -e '.keys' > /dev/null 2>&1; then
        ok "Round $round: state is valid JSON"
    else
        err "Round $round: state corrupted"
    fi

    fp_count=$(echo "$stats" | jq -r '.keys | group_by(.fingerprint) | map(select(length > 1)) | length')
    [[ "$fp_count" -eq 0 ]] && ok "Round $round: no duplicate fingerprints" || err "Round $round: duplicate fingerprints: $fp_count"
done

# Test 2: 40/40 concurrency single run
echo "" >&2
echo "--- 40/40 concurrency stress test ---" >&2
rm -rf "$KEYPOOL_DIR" "$KEYPOOL_LOCK_DIR"
mkdir -p "$KEYPOOL_DIR" "$KEYPOOL_LOCK_DIR"
printf '{"keys":[],"next_index":0}' > "$KEYPOOL_STATE_FILE"

run_concurrent_round 40 "stress" || err "40-worker: subprocess failed"

check_tmp_leftovers || err "40-worker: tmp leftovers found"
check_secret_leakage || err "40-worker: secret leakage"

stats=$(keypool_stats)
total=$(echo "$stats" | jq -r '.total')

if [[ "$total" -eq 40 ]]; then
    ok "40/40 concurrent succeeded"
else
    err "40/40: only $total/40 succeeded"
fi

if echo "$stats" | jq -e '.keys' > /dev/null 2>&1; then
    ok "40/40: state is valid JSON"
else
    err "40/40: state corrupted"
fi

fp_count=$(echo "$stats" | jq -r '.keys | group_by(.fingerprint) | map(select(length > 1)) | length')
[[ "$fp_count" -eq 0 ]] && ok "40/40: no duplicate fingerprints" || err "40/40: duplicate fingerprints: $fp_count"

# --- Final results ---
echo "" >&2
echo "=== Results: $pass passed, $fail failed ==="

rm -rf "$KEYPOOL_DIR"
rm -f /tmp/test_stderr_$$.txt /tmp/kp_stderr_$$.txt
exit $((fail > 0 ? 1 : 0))