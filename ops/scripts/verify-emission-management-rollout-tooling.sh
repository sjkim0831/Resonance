#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-emission-management-rollout-tooling.sh

Purpose:
  Run non-runtime smoke checks for the emission-management rollout helper
  scripts. This covers help/list/fixture/status output modes and fail-fast
  selector validation without requiring a live local :18000 service.
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMISSION_SCRIPT_NAME="verify-emission-management-rollout-tooling"
source "$ROOT_DIR/ops/scripts/emission-management-auth-common.sh"

TMP_DIR="$(mktemp -d /tmp/emission-rollout-tooling.XXXXXX)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

run_capture() {
  local name="$1"
  shift
  local output_file="$TMP_DIR/${name}.out"
  emission_info "running $name"
  "$@" >"$output_file"
  [[ -s "$output_file" ]] || emission_fail "$name produced no output"
}

run_expect_fail() {
  local name="$1"
  local expected_fragment="$2"
  shift 2
  local output_file="$TMP_DIR/${name}.out"
  emission_info "running $name (expected failure)"
  if "$@" >"$output_file" 2>&1; then
    emission_fail "$name unexpectedly succeeded"
  fi
  if ! grep -F "$expected_fragment" "$output_file" >/dev/null 2>&1; then
    emission_fail "$name did not include expected failure fragment: $expected_fragment"
  fi
}

assert_contains() {
  local name="$1"
  local expected_fragment="$2"
  local output_file="$TMP_DIR/${name}.out"
  grep -F "$expected_fragment" "$output_file" >/dev/null 2>&1 || emission_fail "$name missing expected fragment: $expected_fragment"
}

run_capture help-text bash "$ROOT_DIR/ops/scripts/help-emission-management-rollout.sh"
assert_contains help-text "Emission Management Rollout Commands"
assert_contains help-text "Read-only:"

run_capture help-json env EMISSION_HELP_OUTPUT=json bash "$ROOT_DIR/ops/scripts/help-emission-management-rollout.sh"
assert_contains help-json '"schemaVersion": 1'
assert_contains help-json '"commandCount": 13'

run_capture help-flat-json env EMISSION_HELP_OUTPUT=flat-json bash "$ROOT_DIR/ops/scripts/help-emission-management-rollout.sh"
assert_contains help-flat-json '"catalogMode": "flat"'

run_capture help-commands env EMISSION_HELP_OUTPUT=commands bash "$ROOT_DIR/ops/scripts/help-emission-management-rollout.sh"
assert_contains help-commands 'bash ops/scripts/list-emission-management-rollout-scopes.sh'

run_capture list-text bash "$ROOT_DIR/ops/scripts/list-emission-management-rollout-scopes.sh"
assert_contains list-text '[list-emission-management-rollout-scopes] supported scopes'
assert_contains list-text 'CEMENT:1'

run_capture list-json env EMISSION_SCOPE_LIST_OUTPUT=json bash "$ROOT_DIR/ops/scripts/list-emission-management-rollout-scopes.sh"
assert_contains list-json '"scopeCount": 6'

run_capture list-scopes env EMISSION_SCOPE_LIST_OUTPUT=scopes bash "$ROOT_DIR/ops/scripts/list-emission-management-rollout-scopes.sh"
assert_contains list-scopes 'CEMENT:1 CEMENT:2 CEMENT:3 LIME:1 LIME:2 LIME:3'

run_capture fixture-text bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-fixtures.sh"
assert_contains fixture-text 'verified 6 scope metadata rows'

run_capture fixture-json env EMISSION_FIXTURE_VERIFY_OUTPUT=json bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-fixtures.sh"
assert_contains fixture-json '"status": "ok"'

run_capture status-text env EMISSION_STATUS_INCLUDE_BOARD=false bash "$ROOT_DIR/ops/scripts/show-emission-management-rollout-status.sh"
assert_contains status-text '[show-emission-management-rollout-status]   supported scopes: 6'

run_capture status-json env EMISSION_STATUS_OUTPUT=json EMISSION_STATUS_INCLUDE_BOARD=false bash "$ROOT_DIR/ops/scripts/show-emission-management-rollout-status.sh"
assert_contains status-json '"supportedScopeCount": 6'
assert_contains status-json '"boardIncluded": false'

run_expect_fail help-invalid 'Unsupported EMISSION_HELP_OUTPUT' \
  env EMISSION_HELP_OUTPUT=bogus bash "$ROOT_DIR/ops/scripts/help-emission-management-rollout.sh"
run_expect_fail list-invalid 'unsupported EMISSION_SCOPE_LIST_OUTPUT' \
  env EMISSION_SCOPE_LIST_OUTPUT=bogus bash "$ROOT_DIR/ops/scripts/list-emission-management-rollout-scopes.sh"
run_expect_fail fixture-invalid 'unsupported EMISSION_FIXTURE_VERIFY_OUTPUT' \
  env EMISSION_FIXTURE_VERIFY_OUTPUT=bogus bash "$ROOT_DIR/ops/scripts/verify-emission-management-rollout-fixtures.sh"
run_expect_fail status-output-invalid 'unsupported EMISSION_STATUS_OUTPUT' \
  env EMISSION_STATUS_OUTPUT=bogus bash "$ROOT_DIR/ops/scripts/show-emission-management-rollout-status.sh"
run_expect_fail status-include-invalid 'unsupported EMISSION_STATUS_INCLUDE_BOARD' \
  env EMISSION_STATUS_INCLUDE_BOARD=bogus bash "$ROOT_DIR/ops/scripts/show-emission-management-rollout-status.sh"

emission_info "tooling smoke verification completed"
