#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
state="$TMP_ROOT/performance"
status_file="$TMP_ROOT/deploy-status.json"

record() {
  CARBONET_DEPLOY_ROOT="$TMP_ROOT" \
  CARBONET_DEPLOY_PERFORMANCE_DIR="$state" \
  CARBONET_DEPLOY_STATUS_FILE="$status_file" \
    bash "$ROOT_DIR/ops/scripts/record-deploy-performance.sh" frontend "$1" "$2"
}

record pass-25s 25000
jq -e '.status == "PASS" and .targetMs == 30000 and .sloElapsedMs == 25000 and .consecutiveBreachCount == 0' \
  "$state/latest.json" >/dev/null

record breach-31s 31000
jq -e '.status == "SLO_BREACH" and .targetMs == 30000 and .consecutiveBreachCount == 1' \
  "$state/latest.json" >/dev/null

record breach-32s 32000
jq -e '.status == "SLO_BREACH" and .consecutiveBreachCount == 2 and .slowestPhase == ""' \
  "$state/latest.json" >/dev/null
grep -q '^DEPLOY_PERFORMANCE_CONSECUTIVE_BREACH_COUNT=2$' "$state/diagnostic-required.env"

echo '[frontend-deploy-budget-test] PASS target=30000ms consecutiveBreaches=2'
