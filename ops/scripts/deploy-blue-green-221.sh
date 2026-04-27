#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/deploy-blue-green-221.sh

Purpose:
  Switch traffic through standby and main runtimes while verifying
  freshness on both ports.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  PORT=18001 bash ops/scripts/codex-verify-18000-freshness.sh
  PORT=18000 bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAIN_PORT="${MAIN_PORT:-18000}"
STANDBY_PORT="${STANDBY_PORT:-18001}"
HEALTH_PATH="${HEALTH_PATH:-/actuator/health}"
HEALTH_WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-90}"
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-20}"
NGINX_SWITCH_SCRIPT="${NGINX_SWITCH_SCRIPT:-$ROOT_DIR/ops/scripts/write-main-upstream.sh}"
NGINX_UPSTREAM_NAME="${NGINX_UPSTREAM_NAME:-carbonet_app}"
TARGET_HOST="${TARGET_HOST:-127.0.0.1}"
NGINX_MAIN_INCLUDE_PATH="${NGINX_MAIN_INCLUDE_PATH:-/etc/nginx/carbonet/carbonet-main-upstream.inc}"

main_log() {
  printf '[deploy-blue-green-221] %s\n' "$*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

wait_for_health() {
  local port="$1"
  local url="http://127.0.0.1:${port}${HEALTH_PATH}"
  local attempt
  for attempt in $(seq 1 "$HEALTH_WAIT_SECONDS"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      main_log "health ok: $url"
      return 0
    fi
    sleep 1
  done
  echo "Health check failed: $url" >&2
  return 1
}

verify_runtime_freshness() {
  local port="$1"
  main_log "freshness verify: ${port}"
  PORT="$port" VERIFY_WAIT_SECONDS="$VERIFY_WAIT_SECONDS" bash "$ROOT_DIR/ops/scripts/codex-verify-18000-freshness.sh"
}

switch_nginx() {
  local port="$1"
  sudo NGINX_UPSTREAM_NAME="$NGINX_UPSTREAM_NAME" NGINX_MAIN_INCLUDE_PATH="$NGINX_MAIN_INCLUDE_PATH" "$NGINX_SWITCH_SCRIPT" "$TARGET_HOST" "$port"
}

main() {
  require_command curl
  require_command bash

  main_log "start standby runtime: ${STANDBY_PORT}"
  PORT="$STANDBY_PORT" bash "$ROOT_DIR/ops/scripts/restart-18001.sh"
  wait_for_health "$STANDBY_PORT"
  verify_runtime_freshness "$STANDBY_PORT"

  main_log "switch nginx to standby: ${STANDBY_PORT}"
  switch_nginx "$STANDBY_PORT"

  main_log "stop main runtime: ${MAIN_PORT}"
  PORT="$MAIN_PORT" bash "$ROOT_DIR/ops/scripts/stop-18000.sh"

  main_log "start main runtime with new jar: ${MAIN_PORT}"
  PORT="$MAIN_PORT" bash "$ROOT_DIR/ops/scripts/start-18000.sh"
  wait_for_health "$MAIN_PORT"
  verify_runtime_freshness "$MAIN_PORT"

  main_log "switch nginx back to main: ${MAIN_PORT}"
  switch_nginx "$MAIN_PORT"

  main_log "stop standby runtime: ${STANDBY_PORT}"
  PORT="$STANDBY_PORT" bash "$ROOT_DIR/ops/scripts/stop-18001.sh"

  main_log "completed"
}

main "$@"
