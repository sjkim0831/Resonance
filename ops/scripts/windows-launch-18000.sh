#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$ROOT_DIR/var/logs"
LOG_FILE="$LOG_DIR/windows-launch-18000.log"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "[windows-launch-18000] started at $(date '+%Y-%m-%d %H:%M:%S')"
echo "[windows-launch-18000] repo=$ROOT_DIR"
echo "[windows-launch-18000] running canonical build/restart sequence for :18000"

bash "$ROOT_DIR/ops/scripts/build-restart-18000.sh"
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-20}" bash "$ROOT_DIR/ops/scripts/codex-verify-18000-freshness.sh"

echo "[windows-launch-18000] completed at $(date '+%Y-%m-%d %H:%M:%S')"
