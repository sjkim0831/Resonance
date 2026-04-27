#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-app-closure-all.sh

Purpose:
  Run the app-closure owner check sequence:
  1. ops/scripts self-audit
  2. structural app-closure verification

Default behavior:
  - runs audit + structural closure
  - prints the runtime freshness command to run next

Optional:
  VERIFY_RUNTIME=true bash ops/scripts/verify-app-closure-all.sh

Quick guide:
  bash ops/scripts/app-closure-help.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY_RUNTIME="${VERIFY_RUNTIME:-false}"

echo "[verify-app-closure-all] ops audit started"
bash "$ROOT_DIR/ops/scripts/audit-app-closure-ops.sh"

echo "[verify-app-closure-all] structural closure started"
bash "$ROOT_DIR/ops/scripts/run-large-move-app-closure.sh"

if [[ "$VERIFY_RUNTIME" == "true" ]]; then
  echo "[verify-app-closure-all] runtime freshness started"
  bash "$ROOT_DIR/ops/scripts/codex-verify-18000-freshness.sh"
else
  echo "[verify-app-closure-all] next: bash ops/scripts/codex-verify-18000-freshness.sh"
fi

echo "[verify-app-closure-all] completed"
