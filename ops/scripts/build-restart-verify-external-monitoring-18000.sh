#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/build-restart-verify-external-monitoring-18000.sh

Purpose:
  Run the standard :18000 build and restart flow, then verify
  /admin/external/monitoring bootstrap behavior on first entry.
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[build-restart-verify-external-monitoring-18000] build + restart started"
bash "$ROOT_DIR/ops/scripts/build-restart-18000.sh"

echo "[build-restart-verify-external-monitoring-18000] app closure verification started"
bash "$ROOT_DIR/ops/scripts/verify-large-move-app-closure.sh"

echo "[build-restart-verify-external-monitoring-18000] runtime + bootstrap verification started"
VERIFY_EXTERNAL_MONITORING_BOOTSTRAP=true bash "$ROOT_DIR/ops/scripts/codex-verify-18000-freshness.sh"

echo "[build-restart-verify-external-monitoring-18000] completed"
