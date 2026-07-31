#!/usr/bin/env bash
set -euo pipefail

root_dir="${FRONTEND_ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
state_dir="${FULL_SCREEN_SMOKE_BROWSER_SERVER_DIR:-$root_dir/.cache/full-screen-smoke/browser-server}"
endpoint_file="$state_dir/ws-endpoint"
pid_file="$state_dir/pid"
version_file="$state_dir/playwright-version"
lock_file="$state_dir/start.lock"
log_file="$state_dir/server.log"
expected_version="$(node -p "require('$root_dir/node_modules/@playwright/test/package.json').version")"
mkdir -p "$state_dir"

server_is_current() {
  local pid endpoint version
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  endpoint="$(cat "$endpoint_file" 2>/dev/null || true)"
  version="$(cat "$version_file" 2>/dev/null || true)"
  [[ "$pid" =~ ^[0-9]+$ && "$endpoint" == ws://127.0.0.1:* && "$version" == "$expected_version" ]] &&
    kill -0 "$pid" 2>/dev/null
}

exec 8>"$lock_file"
flock -x 8
if ! server_is_current; then
  stale_pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ "$stale_pid" =~ ^[0-9]+$ ]] && kill -0 "$stale_pid" 2>/dev/null; then
    kill "$stale_pid" 2>/dev/null || true
  fi
  rm -f "$endpoint_file" "$pid_file" "$version_file"
  nohup env \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" \
    node "$root_dir/scripts/playwright-browser-server.mjs" --state-dir "$state_dir" \
    >>"$log_file" 2>&1 </dev/null &

  for _ in {1..50}; do
    server_is_current && break
    sleep 0.1
  done
fi
server_is_current || {
  echo "[playwright-browser-server] failed to become ready; direct launch fallback will be used" >&2
  tail -n 20 "$log_file" >&2 || true
  exit 1
}

cat "$endpoint_file"
