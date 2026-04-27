#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/build-restart-verify-emission-management-18000.sh

Purpose:
  Run the standard :18000 build and restart flow, then verify
  /admin/emission/management route, session bootstrap, save, and calculate flow.

Examples:
  bash ops/scripts/build-restart-verify-emission-management-18000.sh
  env VERIFY_DEFINITION_PUBLISH=true DEFINITION_RUNTIME_MODE=PRIMARY EXPECTED_PROMOTION_STATUS=PRIMARY_READY EXPECTED_DRAFT_ID_PREFIX='' bash ops/scripts/build-restart-verify-emission-management-18000.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[build-restart-verify-emission-management-18000] build + restart started"
bash "$ROOT_DIR/ops/scripts/build-restart-18000.sh"

echo "[build-restart-verify-emission-management-18000] app closure verification started"
bash "$ROOT_DIR/ops/scripts/verify-large-move-app-closure.sh"

echo "[build-restart-verify-emission-management-18000] runtime freshness verification started"
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-20}" bash "$ROOT_DIR/ops/scripts/codex-verify-18000-freshness.sh"

echo "[build-restart-verify-emission-management-18000] emission management flow verification started"
bash "$ROOT_DIR/ops/scripts/verify-emission-management-flow.sh"

echo "[build-restart-verify-emission-management-18000] completed"
