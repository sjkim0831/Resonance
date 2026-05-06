#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/restart-18000.sh

Purpose:
  Run the canonical fresh restart line for :18000, or runtime-only restart
  when RESTART_MODE=runtime-only.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  bash ops/scripts/run-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESTART_MODE="${RESTART_MODE:-fresh}"

if [[ "$RESTART_MODE" == "runtime-only" ]]; then
  bash "$ROOT_DIR/ops/scripts/restart-18000-runtime.sh"
  exit 0
fi

if [[ "$RESTART_MODE" != "fresh" ]]; then
  echo "[restart-18000] unsupported RESTART_MODE=$RESTART_MODE (supported: fresh, runtime-only)" >&2
  exit 1
fi

echo "[restart-18000] fresh restart started"
(cd "$ROOT_DIR/projects/carbonet-frontend/source" && npm run build)
rm -rf "$ROOT_DIR/apps/carbonet-app/target/classes/static/react-app"
(cd "$ROOT_DIR" && mvn -q -pl apps/carbonet-app -am -DskipTests package)
bash "$ROOT_DIR/ops/scripts/restart-18000-runtime.sh"
echo "[restart-18000] fresh restart completed"
