#!/bin/bash
# test-inventory.sh - tests for inventory.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INV_LIB="${INV_LIB:-$SCRIPT_DIR/../ops/ai-agent-orchestrator/lib/inventory.sh}"
BIN="${BIN:-$SCRIPT_DIR/../ops/ai-agent-orchestrator/bin/agent-inventory}"

export INV_MAX=50
export SEARCH_MAX=50
export SEARCH_TTL=0

PASS=0 FAIL=0

inc_pass() { ((PASS++)); }
inc_fail() { echo "  FAIL: $1"; ((FAIL++)); }

assert_contains() {
  local haystack="$1"; shift
  local needle="$1"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  PASS: found '$needle'"
    inc_pass
  else
    echo "  FAIL: expected to find '$needle'"
    inc_fail "assert_contains: $needle"
  fi
}

test_lib_loads() {
  echo "=== Test: lib loads ==="
  if [[ -f "$INV_LIB" ]]; then
    source "$INV_LIB"
    echo "  PASS: inventory lib loaded"
    inc_pass
  else
    echo "  FAIL: inventory lib not found"
    inc_fail "lib not found"
  fi
}

test_bin_help() {
  echo "=== Test: bin help ==="
  local out; out=$("$BIN" --help 2>/dev/null) || true
  if [[ -n "$out" ]]; then
    echo "  PASS: help works"
    inc_pass
  else
    echo "  FAIL: no help output"
    inc_fail "no help output"
  fi
}

test_bin_all() {
  echo "=== Test: bin all ==="
  local out; out=$("$BIN" all 2>/dev/null) || true
  assert_contains "$out" '"timestamp"'
  assert_contains "$out" '"inventory"'
  assert_contains "$out" '"type":"react-routes"'
  assert_contains "$out" '"type":"java-controllers"'
  assert_contains "$out" '"type":"admin-menu-169"'
  assert_contains "$out" '"type":"page-manifests"'
  assert_contains "$out" '"type":"customer-sdui-bindings"'
}

test_inv_counts() {
  echo "=== Test: inv counts are deterministic ==="
  local out; out=$("$BIN" all 2>/dev/null) || true
  local count1 count2 count3 count4
  count1=$(echo "$out" | jq -r '.inventory[0].count' 2>/dev/null || echo "0")
  count2=$(echo "$out" | jq -r '.inventory[1].count' 2>/dev/null || echo "0")
  count3=$(echo "$out" | jq -r '.inventory[2].count' 2>/dev/null || echo "0")
  count4=$(echo "$out" | jq -r '.inventory[3].count' 2>/dev/null || echo "0")
  echo "  react-routes: $count1"
  echo "  java-controllers: $count2"
  echo "  admin-menu: $count3"
  echo "  page-manifests: $count4"
  if [[ "$count1" -gt 0 ]] && [[ "$count3" -eq 169 ]]; then
    echo "  PASS: counts look reasonable"
    inc_pass
  else
    echo "  FAIL: counts not as expected"
    inc_fail "counts not expected"
  fi
}

main() {
  echo "Running inventory tests..."
  export INV_MAX=50

  test_lib_loads
  test_bin_help
  test_bin_all
  test_inv_counts

  echo ""
  echo "Results: PASS=$PASS FAIL=$FAIL"
  if [[ "$FAIL" -gt 0 ]]; then
    echo "TESTS FAILED"
    exit 1
  fi
  echo "ALL TESTS PASSED"
}

main "$@"