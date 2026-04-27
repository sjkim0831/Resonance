#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/stop-18001.sh

Purpose:
  Stop the local standby :18001 runtime and clean up the standby pid file.

Related start path:
  bash ops/scripts/start-18001.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-18001}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
PID_FILE="$RUN_DIR/carbonet-${PORT}.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "[stop-18001] pid file not found: $PID_FILE"
  exit 0
fi

APP_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -z "${APP_PID:-}" ]]; then
  rm -f "$PID_FILE"
  echo "[stop-18001] stale pid file removed"
  exit 0
fi

if ! kill -0 "$APP_PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "[stop-18001] process already stopped: pid=$APP_PID"
  exit 0
fi

kill -- "-$APP_PID" 2>/dev/null || kill "$APP_PID" 2>/dev/null || true

for _ in $(seq 1 20); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "[stop-18001] stopped: pid=$APP_PID"
    exit 0
  fi
  sleep 1
done

kill -9 -- "-$APP_PID" 2>/dev/null || kill -9 "$APP_PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "[stop-18001] force stopped: pid=$APP_PID"
