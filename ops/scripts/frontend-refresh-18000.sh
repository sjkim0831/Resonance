#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/frontend-refresh-18000.sh

Purpose:
  Rebuild frontend assets for the local :18000 runtime when filesystem
  override mode is enabled, without repackaging the backend jar.

Follow with:
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[frontend-refresh-18000] frontend build started"
(cd "$ROOT_DIR/frontend" && npm run build)
echo "[frontend-refresh-18000] frontend build completed"
echo "[frontend-refresh-18000] local :18000 now serves assets from src/main/resources/static/react-app when filesystem override is enabled"
bash "$ROOT_DIR/ops/scripts/codex-verify-18000-freshness.sh"
