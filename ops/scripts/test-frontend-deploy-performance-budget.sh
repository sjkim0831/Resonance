#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
state="$TMP_ROOT/performance"
status_file="$TMP_ROOT/deploy-status.json"
phase_file="$TMP_ROOT/phases.jsonl"

record() {
  CARBONET_DEPLOY_ROOT="$TMP_ROOT" \
  CARBONET_DEPLOY_PERFORMANCE_DIR="$state" \
  CARBONET_DEPLOY_STATUS_FILE="$status_file" \
  CARBONET_DEPLOY_PHASE_FILE="$phase_file" \
    bash "$ROOT_DIR/ops/scripts/record-deploy-performance.sh" frontend "$1" "$2" \
      >/dev/null 2>&1
}

printf '%s\n' \
  '{"phase":"frontend_overlay_ready","durationMs":25000}' \
  '{"phase":"frontend_parallel_validation","durationMs":120000}' \
  '{"phase":"frontend_candidate_finalize","durationMs":5000}' >"$phase_file"

record pass-150s 150000
jq -e '.status == "PASS" and .targetMs == 30000 and .verificationTargetMs == 180000 and .hardLimitMs == 240000 and .sloElapsedMs == 25000 and .elapsedMs == 150000 and .consecutiveBreachCount == 0' \
  "$state/latest.json" >/dev/null

record breach-181s 181000
jq -e '.status == "SLO_BREACH" and .reason == "VERIFICATION_TARGET_EXCEEDED" and .sloElapsedMs == 25000 and .consecutiveBreachCount == 1' \
  "$state/latest.json" >/dev/null

printf '%s\n' \
  '{"phase":"frontend_overlay_ready","durationMs":31000}' \
  '{"phase":"frontend_parallel_validation","durationMs":100000}' >"$phase_file"
record breach-ready-31s 131000
jq -e '.status == "SLO_BREACH" and .reason == "READY_TARGET_OR_25_PERCENT_REGRESSION" and .consecutiveBreachCount == 2 and .slowestPhase == "frontend_parallel_validation"' \
  "$state/latest.json" >/dev/null
grep -q '^DEPLOY_PERFORMANCE_CONSECUTIVE_BREACH_COUNT=2$' "$state/diagnostic-required.env"

echo '[frontend-deploy-budget-test] PASS readyTarget=30000ms verificationTarget=180000ms hardLimit=240000ms consecutiveBreaches=2'
