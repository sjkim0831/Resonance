#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/run-large-move-app-closure.sh

Purpose:
  Run the app-closure structural verifier.

Next step:
  bash ops/scripts/codex-verify-18000-freshness.sh

Quick guide:
  bash ops/scripts/show-app-closure-sequence.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[run-large-move-app-closure] structural closure verification started"
bash "$ROOT_DIR/ops/scripts/verify-large-move-app-closure.sh"

echo "[run-large-move-app-closure] structural closure verification completed"
echo "[run-large-move-app-closure] next: bash ops/scripts/codex-verify-18000-freshness.sh"
