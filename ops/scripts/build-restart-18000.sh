#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/build-restart-18000.sh

Purpose:
  Run the canonical local build/package/runtime refresh line for :18000.

Follow with:
  bash ops/scripts/run-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh

Quick guide:
  bash ops/scripts/show-app-closure-sequence.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[build-restart-18000] frontend build started"
(cd "$ROOT_DIR/projects/carbonet-frontend/source" && npm run build)

echo "[build-restart-18000] backend package started"
rm -rf "$ROOT_DIR/apps/carbonet-app/target/classes/static/react-app"
(cd "$ROOT_DIR" && mvn -q -pl apps/carbonet-app -am -DskipTests package)

echo "[build-restart-18000] service restart started"
bash "$ROOT_DIR/ops/scripts/restart-18000-runtime.sh"

echo "[build-restart-18000] completed"
